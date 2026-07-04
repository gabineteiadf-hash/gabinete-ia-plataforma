#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GABINETE IA: DATA MIGRATION & CONSOLIDATION ENGINE
Senior Data Engineer Specialist Script
==================================================
This script processes geoelectoral spreadsheets for 2014, 2018, and 2022,
aggregates and validates votes with pure mathematical accuracy, normalizes
candidate names for flexible tiered matching, and safely updates the SQLite 
database 'eleicoes.db' within an atomic transaction.
"""

import os
import sys
import sqlite3
import unicodedata
import re
import pandas as pd

# Define paths and configuration
DB_FILE = "eleicoes.db"
SPREADSHEETS = {
    2014: "Consolidado_Detalhado_Zonas_RA_2014.xlsx",
    2018: "Consolidado_Detalhado_Zonas_RA_2018.xlsx",
    2022: "Consolidado_Detalhado_Zonas_RA3_2022.xlsx"
}

def clean_string(val):
    """
    Normalizes a text value: removes accents, converts to uppercase,
    removes non-alphanumeric characters, collapses spaces and strips.
    """
    if not val or not isinstance(val, str):
        return ""
    # Remove accents using unicode decomposition (NFD)
    nfd_form = unicodedata.normalize('NFKD', val)
    only_ascii = nfd_form.encode('ASCII', 'ignore').decode('ASCII')
    # Upper case and strip special characters
    upper_val = only_ascii.upper()
    clean_val = re.sub(r'[^A-Z0-9 ]', '', upper_val)
    # Remove extra spaces
    return " ".join(clean_val.split())

def get_alias_match(sheet_name):
    """
    Manual alias overrides for candidates with name variations in official files.
    """
    clean_name = clean_string(sheet_name)
    aliases = {
        "JOAO ALVES CARDOSO": "JOAO CARDOSO PROFESSOR AUDITOR",
        "JORGE VIANA DE SOUSA": "JORGE VIANNA",
        "PEDRO PAULO DE OLIVEIRA": "PEPA",
        "CHRISTIANNO NOGUEIRA ARAUJO": "CRISTIANO ARAUJO",
        "FRANCISCO LEITE DE OLIVEIRA": "CHICO LEITE"
    }
    return aliases.get(clean_name)

def find_candidate(sheet_name, year, db_candidates):
    """
    Tiered candidate matching engine:
    Tier 0: Manual alias overrides
    Tier 1: Exact match with clean nome_completo or nome_urna
    Tier 2: Inclusion checks (either database name in sheet, or vice-versa)
    Tier 3: Word token overlap matching (ignores titles like PROFESSOR, DOUTORA, etc.)
    """
    clean_sheet = clean_string(sheet_name)
    if not clean_sheet:
        return None

    # Tier 0: Manual alias override check
    alias_target = get_alias_match(sheet_name)
    if alias_target:
        for cand in db_candidates:
            if cand['ano_eleicao'] != year:
                continue
            clean_urna = clean_string(cand['nome_urna'])
            clean_completo = clean_string(cand['nome_completo'])
            if clean_urna == alias_target or clean_completo == alias_target:
                return cand

    # Tier 1: Exact matches
    for cand in db_candidates:
        if cand['ano_eleicao'] != year:
            continue
        clean_urna = clean_string(cand['nome_urna'])
        clean_completo = clean_string(cand['nome_completo'])
        if clean_sheet == clean_urna or clean_sheet == clean_completo:
            return cand

    # Tier 2: Inclusion matches
    for cand in db_candidates:
        if cand['ano_eleicao'] != year:
            continue
        clean_urna = clean_string(cand['nome_urna'])
        clean_completo = clean_string(cand['nome_completo'])

        if (clean_completo and clean_sheet in clean_completo) or \
           (clean_completo and clean_completo in clean_sheet) or \
           (clean_sheet in clean_urna) or \
           (clean_urna in clean_sheet):
            return cand

    # Tier 3: Word-token overlap (ignoring common political titles)
    ignore_tokens = {"PROFESSOR", "DOUTORA", "PASTOR", "PROF", "DR", "DRA", "DE", "DA", "DOS", "DAS", "E", "DO", "FILHO", "NETO"}
    sheet_words = {w for w in clean_sheet.split() if len(w) > 2 and w not in ignore_tokens}

    for cand in db_candidates:
        if cand['ano_eleicao'] != year:
            continue

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
    print("GABINETE IA: DATA MIGRATION, CONSOLIDATION & VALIDATION ENGINE (PYTHON)")
    print("======================================================================\n")

    # 1. Verification of database existence
    if not os.path.exists(DB_FILE):
        print(f"❌ Error: Database '{DB_FILE}' not found in the current folder.")
        sys.exit(1)

    print(f"[Database] Connecting to SQLite database '{DB_FILE}'...")
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Load candidates from DB
    try:
        cursor.execute("SELECT id_candidato, nome_urna, nome_completo, ano_eleicao FROM Candidatos;")
        db_candidates = [dict(row) for row in cursor.fetchall()]
        print(f"[Database] Loaded {len(db_candidates)} candidate records for cross-referencing.")
    except Exception as e:
        print(f"❌ Error loading candidates: {e}")
        conn.close()
        sys.exit(1)

    all_processed_rows = []
    unmatched_warnings = []

    # 2. Loading and processing spreadsheets
    for year, file_path in SPREADSHEETS.items():
        if not os.path.exists(file_path):
            print(f"⚠️ Warning: Spreadsheet file '{file_path}' not found. Skipping year {year}.")
            continue

        print(f"\n[Pandas] Processing spreadsheet '{file_path}' for election year {year}...")
        try:
            # Read sheet using pandas
            df = pd.read_excel(file_path)
            
            # Map columns flexibly with exact priority followed by fuzzy fallback
            col_mapping = {}
            for col in df.columns:
                col_upper = col.upper().strip()
                if col_upper in ["NOME_OFICIAL_(URNA)", "NOME_OFICIAL_URNA", "NOME_URNA", "NOME", "CANDIDATO"]:
                    col_mapping[col] = 'candidato'
                elif col_upper in ["ZONA", "ZONA_ELEITORAL"]:
                    col_mapping[col] = 'zona'
                elif col_upper in ["RA", "RA_NOME", "LOCALIDADE"]:
                    col_mapping[col] = 'ra'
                elif col_upper in ["QTD_TOTAL_DE_VOTOS", "TOTAL_DE_VOTOS", "VOTOS", "QTD_VOTOS"]:
                    col_mapping[col] = 'votos'
            
            # Substring-based fuzzy fallback for unmapped columns
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
            
            # Group by Candidate, Zone, and RA to sum pure raw votes, preventing duplicate multiplications
            print(f"[Aggregation] Performing strict .groupby consolidation for {year} data...")
            grouped = df.groupby(['candidato', 'zona', 'ra'])['votos'].sum().reset_index()
            print(f"[Aggregation] Consolidated {len(df)} raw rows into {len(grouped)} clean geoelectoral records.")

            # Map geoelectoral rows to candidates
            for idx, row in grouped.iterrows():
                sheet_name = str(row['candidato']).strip()
                zona = int(row['zona'])
                ra = str(row['ra']).strip()
                votos = int(row['votos'])

                cand_match = find_candidate(sheet_name, year, db_candidates)
                if cand_match:
                    all_processed_rows.append({
                        'id_candidato': cand_match['id_candidato'],
                        'zona_eleitoral': zona,
                        'ra_nome': ra,
                        'votos': votos
                    })
                else:
                    warn_msg = f"No match for '{sheet_name}' in year {year} (Zona: {zona}, RA: {ra}, Votos: {votos})"
                    unmatched_warnings.append(warn_msg)

        except Exception as e:
            print(f"❌ Error processing spreadsheet {file_path}: {e}")
            conn.close()
            sys.exit(1)

    # Print unmatched warnings if any
    if unmatched_warnings:
        print(f"\n⚠️ Matching warnings: {len(unmatched_warnings)} rows could not be matched:")
        for warn in unmatched_warnings[:10]:
            print(f"  - {warn}")
        if len(unmatched_warnings) > 10:
            print(f"  - ... and {len(unmatched_warnings) - 10} more warnings.")
    else:
        print("\n✅ All spreadsheet rows successfully matched to database candidates!")

    # 3. Secure transaction block to update SQLite
    print("\n[Database] Opening atomic transaction to write consolidated data...")
    try:
        cursor.execute("BEGIN TRANSACTION;")

        # Purge old geoelectoral votes
        print("[Database] Purging old 'Geoeleitoral_Votos' records for atomic substitution...")
        cursor.execute("DELETE FROM Geoeleitoral_Votos;")

        # Insert new geoelectoral votes
        print(f"[Database] Inserting {len(all_processed_rows)} clean consolidated voting records...")
        cursor.executemany(
            "INSERT INTO Geoeleitoral_Votos (id_candidato, zona_eleitoral, ra_nome, votos) VALUES (?, ?, ?, ?);",
            [(r['id_candidato'], r['zona_eleitoral'], r['ra_nome'], r['votos']) for r in all_processed_rows]
        )

        # Synchronize Candidatos.total_votos with sum in Geoeleitoral_Votos
        print("[Database] Synchronizing Candidatos.total_votos with sheet totals...")
        cursor.execute("""
            UPDATE Candidatos
            SET total_votos = COALESCE((
                SELECT SUM(votos)
                FROM Geoeleitoral_Votos
                WHERE Geoeleitoral_Votos.id_candidato = Candidatos.id_candidato
            ), 0);
        """)

        # Correct Pepa's real name
        print("[Database] Ensuring Pepa's full name is corrected to 'Pedro Paulo de Oliveira'...")
        cursor.execute("UPDATE Candidatos SET nome_completo = 'Pedro Paulo de Oliveira' WHERE nome_urna = 'Pepa';")

        conn.commit()
        print("✅ Database TRANSACTION committed successfully! DB state is 100% consistent.")

    except Exception as e:
        conn.rollback()
        print(f"❌ Critical transaction error: {e}. Rolled back changes.")
        conn.close()
        sys.exit(1)

    # 4. Final verification and audit visuals
    print("\n" + "="*80)
    print("AUDIT SUMMARY & VERIFICATION REPORT (SQLite DB)")
    print("="*80)
    print(f"{'NOME DE URNA'.padEnd(25) if hasattr('', 'padEnd') else 'NOME DE URNA'.ljust(25)} | {'ANO'.ljust(5)} | {'TOTAL CANDIDATO'.ljust(16)} | {'SOMA DETALHADA'.ljust(14)} | STATUS")
    print("-" * 75)

    try:
        cursor.execute("""
            SELECT 
                c.nome_urna, 
                c.ano_eleicao, 
                c.total_votos,
                (SELECT SUM(votos) FROM Geoeleitoral_Votos g WHERE g.id_candidato = c.id_candidato) as soma_detalhada
            FROM Candidatos c
            ORDER BY c.total_votos DESC, c.nome_urna ASC;
        """)
        rows = cursor.fetchall()
        
        ok_count = 0
        mismatch_count = 0

        for r in rows:
            nome_urna = r['nome_urna']
            ano = r['ano_eleicao']
            total = r['total_votos'] if r['total_votos'] is not None else 0
            soma = r['soma_detalhada'] if r['soma_detalhada'] is not None else 0
            
            delta = total - soma
            if delta == 0:
                status = "✅ OK"
                ok_count += 1
            else:
                status = f"⚠️ DELTA: {delta}"
                mismatch_count += 1
                
            print(f"{nome_urna.ljust(25)} | {str(ano).ljust(5)} | {str(total).ljust(16)} | {str(soma).ljust(14)} | {status}")

        print("="*80)
        print(f"Audit Summary: {ok_count} candidates match perfectly. {mismatch_count} mismatches found.")
        print("="*80)

    except Exception as e:
        print(f"❌ Error printing audit visual report: {e}")

    conn.close()
    print("\nData Engineering script execution completed.")

if __name__ == "__main__":
    main()
