import sqlite3 from "sqlite3";
import path from "path";
import * as fs from "fs";

/**
 * Interface que representa a estrutura de cada linha da planilha de dados geoeleitorais.
 */
export interface LinhaPlanilhaVotos {
  ANO: number;
  "NOME_OFICIAL_(URNA)": string;
  "LOCALIDADE_(RA)": string;
  ZONA: number;
  QTD_TOTAL_DE_VOTOS: number;
}

/**
 * Interface auxiliar para candidatos cadastrados no banco de dados.
 */
interface CandidatoDB {
  id_candidato: number;
  nome_urna: string;
  nome_completo: string | null;
  ano_eleicao: number;
}

/**
 * Função utilitária para limpar e padronizar nomes para o casamento perfeito (match).
 * Remove acentos, padroniza espaços extras, remove pontuações e converte para CAIXA ALTA.
 *
 * @param text Nome original do candidato
 * @returns Nome limpo e padronizado
 */
export function higienizarNome(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos / diacríticos
    .toUpperCase()                    // Padroniza em Caixa Alta
    .replace(/\s+/g, " ")             // Substitui múltiplos espaços por um espaço simples
    .trim();                          // Remove espaços nas extremidades
}

/**
 * Executa a carga e migração dos votos geoeleitorais.
 * 
 * @param db Instância de conexão ativa com o SQLite
 * @param dadosVotos Array de dados extraídos da planilha de votos
 */
export async function migrarVotosGeoeleitorais(
  db: sqlite3.Database,
  dadosVotos: LinhaPlanilhaVotos[]
): Promise<{ processados: number; sucessos: number; falhas: number }> {
  console.log(`[Migração] Iniciando migração de ${dadosVotos.length} registros...`);

  // 1. Carrega todos os candidatos cadastrados no banco para cache em memória
  // Isso evita fazer milhares de queries SELECT individuais durante a inserção, acelerando muito a migração.
  const candidatos: CandidatoDB[] = await new Promise((resolve, reject) => {
    db.all(
      "SELECT id_candidato, nome_urna, nome_completo, ano_eleicao FROM Candidatos",
      (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });

  console.log(`[Migração] Carregados ${candidatos.length} candidatos do banco de dados para casamento de nomes.`);

  // Mapeamos os candidatos em memória usando chaves estruturadas e higienizadas para busca O(1)
  // Chave: HIGIENIZADO(nome) + "_" + ano
  const candidatosMap = new Map<string, number>();
  
  for (const cand of candidatos) {
    const nomeUrnaClean = higienizarNome(cand.nome_urna);
    const nomeCompletoClean = cand.nome_completo ? higienizarNome(cand.nome_completo) : "";
    
    // Mapeia pela Urna + Ano
    if (nomeUrnaClean) {
      candidatosMap.set(`${nomeUrnaClean}_${cand.ano_eleicao}`, cand.id_candidato);
    }
    
    // Mapeia pelo Nome Completo + Ano
    if (nomeCompletoClean) {
      candidatosMap.set(`${nomeCompletoClean}_${cand.ano_eleicao}`, cand.id_candidato);
    }
  }

  let processados = 0;
  let sucessos = 0;
  let falhas = 0;

  // Promisify das funções básicas do SQLite para controle robusto de fluxo assíncrono
  const dbRun = (sql: string, params: any[]): Promise<void> => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  const dbGet = (sql: string, params: any[]): Promise<any> => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  };

  // 2. Iniciamos a Transação para garantir performance extrema em lote (Bulk Insert / Upsert)
  await dbRun("BEGIN TRANSACTION;", []);

  try {
    for (const linha of dadosVotos) {
      processados++;
      const nomeInputClean = higienizarNome(linha["NOME_OFICIAL_(URNA)"]);
      const ano = linha.ANO;
      const zona = linha.ZONA;
      const localidade = linha["LOCALIDADE_(RA)"].trim();
      const votos = linha.QTD_TOTAL_DE_VOTOS;

      // Busca o id_candidato correspondente usando o cache O(1)
      const candKey = `${nomeInputClean}_${ano}`;
      let idCandidato = candidatosMap.get(candKey);

      // Se não encontrar por casamento direto, tenta busca parcial no cache
      if (!idCandidato) {
        for (const cand of candidatos) {
          if (cand.ano_eleicao === ano) {
            const candUrnaClean = higienizarNome(cand.nome_urna);
            const candCompletoClean = cand.nome_completo ? higienizarNome(cand.nome_completo) : "";
            
            if (candUrnaClean.includes(nomeInputClean) || nomeInputClean.includes(candUrnaClean) ||
                candCompletoClean.includes(nomeInputClean) || nomeInputClean.includes(candCompletoClean)) {
              idCandidato = cand.id_candidato;
              break;
            }
          }
        }
      }

      if (!idCandidato) {
        console.warn(`[Aviso] Candidato não encontrado na tabela principal: "${linha["NOME_OFICIAL_(URNA)"]}" para o ano ${ano}. Registro ignorado.`);
        falhas++;
        continue;
      }

      // 3. Estratégia de Upsert: Verifica se o registro de voto já existe para este candidato, zona e RA
      const rowExist = await dbGet(
        "SELECT id_voto FROM Geoeleitoral_Votos WHERE id_candidato = ? AND zona_eleitoral = ? AND ra_nome = ? LIMIT 1",
        [idCandidato, zona, localidade]
      );

      if (rowExist) {
        // Se existir, atualiza a quantidade de votos
        await dbRun(
          "UPDATE Geoeleitoral_Votos SET votos = ? WHERE id_voto = ?",
          [votos, rowExist.id_voto]
        );
      } else {
        // Se não existir, insere o novo registro
        await dbRun(
          "INSERT INTO Geoeleitoral_Votos (id_candidato, zona_eleitoral, ra_nome, votos) VALUES (?, ?, ?, ?)",
          [idCandidato, zona, localidade, votos]
        );
      }

      sucessos++;
    }

    // 4. Se tudo correu bem, efetuamos o Commit da transação
    await dbRun("COMMIT;", []);
    console.log("[Migração] Transação de banco de dados gravada com sucesso!");
    
  } catch (err: any) {
    // Se ocorrer qualquer erro, fazemos o Rollback para manter o banco estável
    await dbRun("ROLLBACK;", []);
    console.error("[Erro Crítico] Falha na transação de migração. Executado ROLLBACK para segurança.", err.message);
    throw err;
  }

  return { processados, sucessos, falhas };
}

/**
 * Função executável principal para demonstrar o funcionamento do script de migração.
 */
async function executarDemonstracao() {
  const dbPath = path.join(process.cwd(), "eleicoes.db");
  const db = new sqlite3.Database(dbPath);

  // Exemplo de massa de dados da planilha simulada/mapeada em JSON
  const dadosPlanilhaExemplo: LinhaPlanilhaVotos[] = [
    {
      ANO: 2022,
      "NOME_OFICIAL_(URNA)": "Fábio Felix Silveira", // Nome completo
      "LOCALIDADE_(RA)": "Asa Norte",
      ZONA: 1,
      QTD_TOTAL_DE_VOTOS: 1250,
    },
    {
      ANO: 2022,
      "NOME_OFICIAL_(URNA)": "FABIO FELIX", // Nome de Urna, variação de caixa
      "LOCALIDADE_(RA)": "Ceilândia",
      ZONA: 16,
      QTD_TOTAL_DE_VOTOS: 3200,
    },
    {
      ANO: 2022,
      "NOME_OFICIAL_(URNA)": "Max Maciel",
      "LOCALIDADE_(RA)": "Taguatinga",
      ZONA: 3,
      QTD_TOTAL_DE_VOTOS: 1850,
    },
    {
      ANO: 2022,
      "NOME_OFICIAL_(URNA)": "Daniel Donizet de Oliveira",
      "LOCALIDADE_(RA)": "Gama",
      ZONA: 14,
      QTD_TOTAL_DE_VOTOS: 2430,
    }
  ];

  try {
    console.log("=== INICIANDO SCRIPT DE MIGRAÇÃO EM LOTE ===");
    const resultado = await migrarVotosGeoeleitorais(db, dadosPlanilhaExemplo);
    console.log("\n--- RESULTADO DA MIGRAÇÃO ---");
    console.log(`Registros da Planilha Analisados: ${resultado.processados}`);
    console.log(`Upserts (Sucessos) no Banco: ${resultado.sucessos}`);
    console.log(`Registros não Correspondidos (Falhas): ${resultado.falhas}`);
    console.log("=========================================\n");
  } catch (error) {
    console.error("Erro durante a migração de demonstração:", error);
  } finally {
    db.close();
  }
}

// Executa o script quando rodado diretamente no terminal
if (process.argv[1] && process.argv[1].includes("migrate_votos")) {
  executarDemonstracao();
}
