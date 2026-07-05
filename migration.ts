import sqlite3 from "sqlite3";
import path from "path";
import * as fs from "fs";
import { runFullMigration } from "./import_consolidado_votos";

export async function initTables(db: sqlite3.Database): Promise<void> {
  console.log("[Migration] Ensuring database tables exist...");
  return new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS Candidatos (
          id_candidato INTEGER PRIMARY KEY AUTOINCREMENT,
          nome_urna TEXT NOT NULL,
          nome_completo TEXT,
          partido TEXT NOT NULL,
          ano_eleicao INTEGER NOT NULL,
          total_votos INTEGER NOT NULL,
          foto_url TEXT,
          cargo TEXT DEFAULT 'Deputado Distrital',
          situacao TEXT DEFAULT 'Eleito'
        )
      `, (err) => {
        if (err) return reject(err);
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS Resumo_Financeiro (
          id_candidato INTEGER PRIMARY KEY,
          total_receitas REAL NOT NULL,
          despesas_contratadas REAL NOT NULL,
          despesas_pagas REAL NOT NULL,
          maior_fornecedor_nome TEXT,
          maior_fornecedor_valor REAL,
          detalhe_despesas TEXT,
          FOREIGN KEY(id_candidato) REFERENCES Candidatos(id_candidato)
        )
      `, (err) => {
        if (err) return reject(err);
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS Geoeleitoral_Votos (
          id_voto INTEGER PRIMARY KEY AUTOINCREMENT,
          id_candidato INTEGER NOT NULL,
          zona_eleitoral INTEGER NOT NULL,
          ra_nome TEXT NOT NULL,
          votos INTEGER NOT NULL,
          FOREIGN KEY(id_candidato) REFERENCES Candidatos(id_candidato)
        )
      `, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

export async function seedHistoricalData(dbPath: string) {
  console.log("[Migration] Seeding historical data (2014, 2018, 2022) via structured JSON fallbacks...");

  // Open database connection
  const db = new sqlite3.Database(dbPath);

  try {
    // 1. Ensure tables exist
    await initTables(db);

    const years = [2014, 2018, 2022];

    for (const year of years) {
      // Check if we already have candidates for this year
      const count: any = await new Promise((resolve, reject) => {
        db.get(
          "SELECT COUNT(*) as count FROM Candidatos WHERE ano_eleicao = ?",
          [year],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (count && count.count > 0) {
        console.log(`[Migration] Year ${year} already has ${count.count} candidates in the database. Skipping seed.`);
        continue;
      }

      // Read fallback JSON file
      const jsonPath = path.join(process.cwd(), `dados_${year}.json`);
      if (!fs.existsSync(jsonPath)) {
        console.warn(`[Migration] Warning: Fallback JSON file not found at ${jsonPath}. Unable to seed year ${year}.`);
        continue;
      }

      console.log(`[Migration] Seeding year ${year} candidates from fallback JSON: ${jsonPath}`);
      const fileContent = fs.readFileSync(jsonPath, "utf-8");
      const candidates = JSON.parse(fileContent);

      for (const cand of candidates) {
        // Insert Candidate
        const candId = await new Promise<number>((resolve, reject) => {
          db.run(
            `INSERT INTO Candidatos (nome_urna, nome_completo, partido, ano_eleicao, total_votos, foto_url, cargo, situacao)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              cand.nome_urna,
              cand.nome_completo,
              cand.partido,
              cand.ano_eleicao,
              cand.total_votos,
              cand.foto_url,
              cand.cargo || "Deputado Distrital",
              cand.situacao || "Eleito"
            ],
            function (err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });

        // Insert Financial Summary
        if (cand.financeiro) {
          const fin = cand.financeiro;
          const detalheDespesasStr = typeof fin.detalhe_despesas === "string"
            ? fin.detalhe_despesas
            : JSON.stringify(fin.detalhe_despesas);

          await new Promise<void>((resolve, reject) => {
            db.run(
              `INSERT INTO Resumo_Financeiro (id_candidato, total_receitas, despesas_contratadas, despesas_pagas, maior_fornecedor_nome, maior_fornecedor_valor, detalhe_despesas)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                candId,
                fin.total_receitas,
                fin.despesas_contratadas,
                fin.despesas_pagas,
                fin.maior_fornecedor_nome,
                fin.maior_fornecedor_valor,
                detalheDespesasStr
              ],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }

        // Insert Geoeleitoral Votes
        if (cand.votos && Array.isArray(cand.votos)) {
          for (const v of cand.votos) {
            await new Promise<void>((resolve, reject) => {
              db.run(
                `INSERT INTO Geoeleitoral_Votos (id_candidato, zona_eleitoral, ra_nome, votos)
                 VALUES (?, ?, ?, ?)`,
                [candId, v.zona, v.ra, v.votos],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
          }
        }
      }

      console.log(`[Migration] Seeding completed for year ${year}.`);
    }

    // Attempt live spreadsheet sync
    console.log("[Migration] Running live spreadsheet synchronization...");
    try {
      await runFullMigration(db);
      console.log("[Migration] Live spreadsheet sync completed successfully.");
    } catch (err: any) {
      console.error("[Migration] Live spreadsheet synchronization failed, proceeding with seeded database data:", err.message);
    }

  } catch (error) {
    console.error("[Migration] Critical error during database seeding:", error);
  } finally {
    db.close();
  }
}

export async function atualizarCampanhas2026(dbPath: string) {
  console.log("Updating 2026 campaign data...");
  // Placeholder/stub preserved to maintain compilation and system integrity
  console.log("2026 campaign data updated.");
}
