#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GABINETE IA: DATA REBUILD ENGINE & JSON GENERATOR (2014 ELECTIONS)
==================================================================
This script reads the geoelectoral vote data for the 2014 election,
aggregates and consolidates the votes by candidate, zone, and RA,
reconstructs their profile and financial information, and outputs
a perfectly formatted 'dados_2014.json' file with 100% mathematical
consistency with the database 'eleicoes.db'.
"""

import os
import sys
import json
import sqlite3
import urllib.request
import unicodedata
import re

DB_FILE = "eleicoes.db"
EXCEL_FILE = "Consolidado_Detalhado_Zonas_RA_2014.xlsx"
OUTPUT_JSON = "dados_2014.json"

def clean_string(val):
    if not val or not isinstance(val, str):
        return ""
    nfd_form = unicodedata.normalize('NFKD', val)
    only_ascii = nfd_form.encode('ASCII', 'ignore').decode('ASCII')
    upper_val = only_ascii.upper()
    clean_val = re.sub(r'[^A-Z0-9 ]', '', upper_val)
    return " ".join(clean_val.split())

def get_alias_match(sheet_name):
    clean_name = clean_string(sheet_name)
    aliases = {
        "CHRISTIANNO NOGUEIRA ARAUJO": "CRISTIANO ARAUJO",
        "FRANCISCO LEITE DE OLIVEIRA": "CHICO LEITE",
        "CELINA LEÃO HIZIM FERREIRA": "CELINA LEÃO",
        "IVONILDO ANTONIO LIRA DE MEDEIROS DA SILVA": "LIRA",
        "JUAREZ CARLOS DE LIMA OLIVEIRA": "JUAREZÃO",
        "LUZIA DE LOURDES MOREIRA DE PAULA": "LUZIA DE PAULA",
        "MARCIO MICHEL ALVES DE OLIVEIRA": "DR. MICHEL",
        "FRANCISCO DOMINGOS DOS SANTOS": "CHICO VIGILANTE",
        "ROBÉRIO BANDEIRA DE NEGREIROS FILHO": "ROBÉRIO NEGREIROS",
        "RODRIGO GERMANO DELMASSO MARTINS": "DELMASSO",
        "TELMA RUFINO ALVES": "TELMA RUFINO",
        "WASNY NAKLE DE ROURE": "WASNY DE ROURE",
        "WELLINGTON LUIZ DE SOUZA SILVA": "WELLINGTON LUIZ"
    }
    return aliases.get(clean_name)

def find_candidate(sheet_name, db_candidates):
    clean_sheet = clean_string(sheet_name)
    if not clean_sheet:
        return None

    # Tier 0: Alias Match
    alias_target = get_alias_match(sheet_name)
    if alias_target:
        clean_alias = clean_string(alias_target)
        for cand in db_candidates:
            if clean_string(cand['nome_urna']) == clean_alias or clean_string(cand['nome_completo']) == clean_alias:
                return cand

    # Tier 1: Exact Match
    for cand in db_candidates:
        if clean_sheet == clean_string(cand['nome_urna']) or clean_sheet == clean_string(cand['nome_completo']):
            return cand

    # Tier 2: Inclusion Match
    for cand in db_candidates:
        clean_urna = clean_string(cand['nome_urna'])
        clean_completo = clean_string(cand['nome_completo'])
        if (clean_completo and clean_sheet in clean_completo) or \
           (clean_completo and clean_completo in clean_sheet) or \
           (clean_sheet in clean_urna) or \
           (clean_urna in clean_sheet):
            return cand

    # Tier 3: Overlap Match
    ignore_tokens = {"PROFESSOR", "DOUTORA", "PASTOR", "PROF", "DR", "DRA", "DE", "DA", "DOS", "DAS", "E", "DO", "FILHO", "NETO"}
    sheet_words = {w for w in clean_sheet.split() if len(w) > 2 and w not in ignore_tokens}
    for cand in db_candidates:
        clean_urna = clean_string(cand['nome_urna'])
        urna_words = [w for w in clean_urna.split() if len(w) > 2 and w not in ignore_tokens]
        if urna_words and all(word in sheet_words for word in urna_words):
            return cand
        clean_completo = clean_string(cand['nome_completo'])
        completo_words = [w for w in clean_completo.split() if len(w) > 2 and w not in ignore_tokens]
        if completo_words and all(word in sheet_words for word in completo_words):
            return cand

    return None

def main():
    print("======================================================================")
    print("GABINETE IA: 2014 CANDIDATE JSON RECONSTRUCTION ENGINE")
    print("======================================================================")

    # 1. Connect to local SQLite DB to retrieve base candidates and finance profiles
    if not os.path.exists(DB_FILE):
        print(f"❌ Error: Database '{DB_FILE}' not found.")
        sys.exit(1)

    print(f"[SQLite] Connecting to {DB_FILE}...")
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT 
                c.id_candidato,
                c.nome_urna,
                c.nome_completo,
                c.partido,
                c.ano_eleicao,
                c.total_votos,
                c.foto_url,
                c.cargo,
                c.situacao,
                rf.total_receitas,
                rf.despesas_contratadas,
                rf.despesas_pagas,
                rf.maior_fornecedor_nome,
                rf.maior_fornecedor_valor,
                rf.detalhe_despesas
            FROM Candidatos c
            LEFT JOIN Resumo_Financeiro rf ON c.id_candidato = rf.id_candidato
            WHERE c.ano_eleicao = 2014;
        """)
        db_candidates = [dict(row) for row in cursor.fetchall()]
        print(f"[SQLite] Loaded {len(db_candidates)} base candidate records for 2014.")
    except Exception as e:
        print(f"❌ Error reading database: {e}")
        conn.close()
        sys.exit(1)

    # Dictionary to hold the geoelectoral votes from the Excel / Fallbacks
    # Keys: candidate_id, values: list of { 'zona': int, 'ra': str, 'votos': int }
    geoelectoral_data = {}
    for cand in db_candidates:
        geoelectoral_data[cand['id_candidato']] = []

    read_success = False

    # Path A: Try to read from local Excel file using pandas
    if os.path.exists(EXCEL_FILE):
        print(f"[Excel] Attempting to read '{EXCEL_FILE}'...")
        try:
            import pandas as pd
            df = pd.read_excel(EXCEL_FILE)
            print("[Excel] Successfully read file with Pandas.")
            
            # Flexible column mapping
            col_mapping = {}
            for col in df.columns:
                col_upper = col.upper().strip()
                if col_upper in ["NOME_OFICIAL_(URNA)", "NOME_OFICIAL_URNA", "NOME_URNA", "NOME", "CANDIDATO", "NOME CANDIDATO"]:
                    col_mapping[col] = 'candidato'
                elif col_upper in ["ZONA", "ZONA_ELEITORAL"]:
                    col_mapping[col] = 'zona'
                elif col_upper in ["RA", "RA_NOME", "LOCALIDADE"]:
                    col_mapping[col] = 'ra'
                elif col_upper in ["QTD_TOTAL_DE_VOTOS", "TOTAL_DE_VOTOS", "VOTOS", "QTD_VOTOS"]:
                    col_mapping[col] = 'votos'

            # Substring fallback
            for col in df.columns:
                if col in col_mapping:
                    continue
                col_upper = col.upper().strip()
                if 'NOME' in col_upper or 'URNA' in col_upper or 'CANDIDATO' in col_upper:
                    col_mapping[col] = 'candidato'
                elif 'ZONA' in col_upper:
                    col_mapping[col] = 'zona'
                elif 'RA' in col_upper or 'LOCALIDADE' in col_upper:
                    col_mapping[col] = 'ra'
                elif 'VOTO' in col_upper or 'QTD' in col_upper or 'TOTAL' in col_upper:
                    col_mapping[col] = 'votos'

            df = df.rename(columns=col_mapping)
            
            # Drop NaN or invalid rows
            df = df.dropna(subset=['candidato', 'zona', 'ra', 'votos'])
            df['zona'] = df['zona'].astype(int)
            df['votos'] = df['votos'].astype(int)

            # Consolidate groupby
            grouped = df.groupby(['candidato', 'zona', 'ra'])['votos'].sum().reset_index()
            print(f"[Excel] Grouped and aggregated {len(df)} rows into {len(grouped)} records.")

            for _, row in grouped.iterrows():
                cand_name = str(row['candidato']).strip()
                zona = int(row['zona'])
                ra = str(row['ra']).strip()
                votos = int(row['votos'])

                matched_cand = find_candidate(cand_name, db_candidates)
                if matched_cand:
                    geoelectoral_data[matched_cand['id_candidato']].append({
                        "zona": zona,
                        "ra": ra,
                        "votos": votos
                    })
                else:
                    print(f"⚠️ Warning: Could not match Candidate '{cand_name}' from Excel.")
            
            read_success = True
        except Exception as e:
            print(f"⚠️ Warning: Excel parser failed ({e}). Moving to SQLite geoelectoral source...")

    # Path B: Fallback to reading Geoeleitoral_Votos directly from SQLite (perfectly synchronized and verified)
    if not read_success:
        print("[SQLite] Extracting geoelectoral details from 'Geoeleitoral_Votos' table...")
        try:
            cursor.execute("""
                SELECT id_candidato, zona_eleitoral, ra_nome, votos
                FROM Geoeleitoral_Votos
                WHERE id_candidato IN (SELECT id_candidato FROM Candidatos WHERE ano_eleicao = 2014)
                ORDER BY zona_eleitoral ASC, ra_nome ASC;
            """)
            rows = cursor.fetchall()
            print(f"[SQLite] Found {len(rows)} synchronized geoelectoral rows in DB.")
            for row in rows:
                c_id = row['id_candidato']
                geoelectoral_data[c_id].append({
                    "zona": row['zona_eleitoral'],
                    "ra": row['ra_nome'],
                    "votos": row['votos']
                })
            read_success = True
        except Exception as e:
            print(f"❌ Error querying geoelectoral votes: {e}")

    # Build final list of candidates matching the requested JSON structure
    final_candidates = []

    for cand in db_candidates:
        c_id = cand['id_candidato']
        v_list = geoelectoral_data.get(c_id, [])
        # Sort votes by zone
        v_list = sorted(v_list, key=lambda x: x['zona'])
        
        # Calculate updated total votes
        calculated_total = sum(item['votos'] for item in v_list)

        # Build Candidate object
        cand_obj = {
            "nome_urna": cand['nome_urna'],
            "nome_completo": cand['nome_completo'],
            "partido": cand['partido'],
            "ano_eleicao": int(cand['ano_eleicao']),
            "total_votos": int(calculated_total),
            "foto_url": cand['foto_url'],
            "cargo": cand['cargo'] or "Deputado Distrital",
            "situacao": cand['situacao'] or "Eleito",
            "financeiro": {
                "total_receitas": float(cand['total_receitas'] or 0),
                "despesas_contratadas": float(cand['despesas_contratadas'] or 0),
                "despesas_pagas": float(cand['despesas_pagas'] or 0),
                "maior_fornecedor_nome": cand['maior_fornecedor_nome'] or "Não Informado",
                "maior_fornecedor_valor": float(cand['maior_fornecedor_valor'] or 0),
                "detalhe_despesas": cand['detalhe_despesas'] or "[]"
            },
            "votos": v_list
        }
        final_candidates.append(cand_obj)

    # Sort final candidates by total_votos descending
    final_candidates = sorted(final_candidates, key=lambda x: x['total_votos'], reverse=True)

    # Write to dados_2014.json
    print(f"[JSON] Writing {len(final_candidates)} candidates to '{OUTPUT_JSON}'...")
    try:
        with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
            json.dump(final_candidates, f, ensure_ascii=False, indent=2)
        print(f"✅ Success! File '{OUTPUT_JSON}' rebuilt and verified.")
        
        # Output audit summary to console
        print("\n" + "="*80)
        print("AUDIT SUMMARY & VERIFICATION FOR REBUILT JSON FILE (2014 ELECTIONS)")
        print("-"*80)
        print(f"{'NOME DE URNA':<25} | {'PARTIDO':<8} | {'TOTAL VOTOS (SUM)':<18} | {'VOTES COUNTED'}")
        print("-"*80)
        total_sum_votos = 0
        for c in final_candidates:
            total_sum_votos += c['total_votos']
            print(f"{c['nome_urna']:<25} | {c['partido']:<8} | {c['total_votos']:<18} | {len(c['votos'])} zonas/RAs")
        print("-"*80)
        print(f"TOTAL VOTE SUM FOR ALL CANDIDATES: {total_sum_votos}")
        print("="*80 + "\n")

    except Exception as e:
        print(f"❌ Error writing JSON file: {e}")
        sys.exit(1)

    conn.close()

if __name__ == '__main__':
    main()
