import sqlite3 from "sqlite3";
import path from "path";
import * as fs from "fs";

/**
 * Interface representing a candidate in the SQLite database.
 */
interface CandidatoDB {
  id_candidato: number;
  nome_urna: string;
  nome_completo: string | null;
  ano_eleicao: number;
  total_votos: number;
}

/**
 * Interface representing the composite-grouped voting row.
 */
interface GroupedVote {
  sheetName: string;
  ano: number;
  zona: number;
  ra: string;
  votos: number;
}

/**
 * Helper to normalize and sanitize strings for precise comparison.
 * Removes accents, punctuation, double spaces, and converts to uppercase.
 */
function cleanString(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents and diacritics
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "") // Keep only alphanumeric and space characters
    .replace(/\s+/g, " ") // Normalize double/multiple spaces to single spaces
    .trim();
}

/**
 * Returns a manual alias mapping for candidates with alternate spellings in the sheet.
 */
function getAliasMatch(sheetName: string): string | null {
  const clean = cleanString(sheetName);
  if (clean === "JOAO ALVES CARDOSO") return "JOAO CARDOSO PROFESSOR AUDITOR";
  if (clean === "JORGE VIANA DE SOUSA") return "JORGE VIANNA";
  if (clean === "PEDRO PAULO DE OLIVEIRA") return "PEPA";
  if (clean === "CHRISTIANNO NOGUEIRA ARAUJO") return "CRISTIANO ARAUJO";
  if (clean === "FRANCISCO LEITE DE OLIVEIRA") return "CHICO LEITE";
  if (clean.includes("FABIO FELIX")) return "FABIO FELIX";
  return null;
}

/**
 * Implements a multi-tiered candidate matching engine.
 * Supports exact match, inclusion checks, and word-token overlap to align
 * name variations securely and avoid false negatives.
 */
function findCandidate(
  candidates: CandidatoDB[],
  sheetName: string,
  year: number
): CandidatoDB | null {
  const cleanSheet = cleanString(sheetName);

  // Check manual alias overrides first
  const aliasTarget = getAliasMatch(sheetName);
  if (aliasTarget) {
    for (const cand of candidates) {
      if (cand.ano_eleicao !== year) continue;
      const cleanUrna = cleanString(cand.nome_urna);
      const cleanCompleto = cleanString(cand.nome_completo || "");
      if (cleanUrna === aliasTarget || cleanCompleto === aliasTarget) {
        return cand;
      }
    }
  }

  // Tier 1: Exact matches with clean nome_completo or nome_urna
  for (const cand of candidates) {
    if (cand.ano_eleicao !== year) continue;

    const cleanCompleto = cleanString(cand.nome_completo || "");
    const cleanUrna = cleanString(cand.nome_urna);

    if (cleanCompleto === cleanSheet || cleanUrna === cleanSheet) {
      return cand;
    }
  }

  // Tier 2: Part-of / Inclusion matches (e.g. "FÁBIO FELIX SILVEIRA" contains "FABIO FELIX")
  for (const cand of candidates) {
    if (cand.ano_eleicao !== year) continue;

    const cleanCompleto = cleanString(cand.nome_completo || "");
    const cleanUrna = cleanString(cand.nome_urna);

    if (
      (cleanCompleto && cleanSheet.includes(cleanCompleto)) ||
      (cleanCompleto && cleanCompleto.includes(cleanSheet)) ||
      cleanSheet.includes(cleanUrna) ||
      cleanUrna.includes(cleanSheet)
    ) {
      return cand;
    }
  }

  // Tier 3: Word token overlap matching (ignores titles like PROFESSOR, DOUTORA, PASTOR)
  const ignoreTokens = new Set(["PROFESSOR", "DOUTORA", "PASTOR", "PROF", "DR", "DRA"]);
  const sheetWords = cleanSheet.split(" ").filter(w => w.length > 2 && !ignoreTokens.has(w));

  for (const cand of candidates) {
    if (cand.ano_eleicao !== year) continue;

    const cleanUrna = cleanString(cand.nome_urna);
    const urnaWords = cleanUrna.split(" ").filter(w => w.length > 2 && !ignoreTokens.has(w));

    if (urnaWords.length > 0 && urnaWords.every(word => sheetWords.includes(word))) {
      return cand;
    }

    const cleanCompleto = cleanString(cand.nome_completo || "");
    const completoWords = cleanCompleto.split(" ").filter(w => w.length > 2 && !ignoreTokens.has(w));

    if (completoWords.length > 0 && completoWords.every(word => sheetWords.includes(word))) {
      return cand;
    }
  }

  return null;
}

/**
 * Dynamically scrapes the shared Google Drive folder page to extract the file ID
 * for the consolidated voting spreadsheet, with a hardcoded fallback if scraping fails.
 */
async function getSpreadsheetIdFromFolder(folderId: string): Promise<string> {
  const fallbackId = "1bkmW6f7l42-kor9bTFC67BGyH1kDNf9pyTA946yJvmY";
  const url = `https://drive.google.com/drive/folders/${folderId}`;

  console.log(`[Drive API] Fetching public folder page for dynamic ID extraction: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const html = await res.text();
    
    // Look for the specific filename and extract the Google Drive file ID
    const term = "Consolidado_Detalhado_Zonas_RA_2014_2018_2022";
    const index = html.indexOf(term);
    
    if (index !== -1) {
      const surroundingHtml = html.substring(Math.max(0, index - 1000), Math.min(html.length, index + 1000));
      // Standard Google Drive file ID regex
      const idMatch = surroundingHtml.match(/data-id="([a-zA-Z0-9_-]{25,})"/);
      if (idMatch && idMatch[1]) {
        console.log(`[Drive API] Scraper successfully found matching Spreadsheet ID: ${idMatch[1]}`);
        return idMatch[1];
      }
    }

    console.warn(`[Drive API] Target filename not found in HTML. Using stable fallback ID: ${fallbackId}`);
    return fallbackId;
  } catch (err: any) {
    console.error(`[Drive API] Scraping failed: ${err.message}. Cascading to fallback ID.`);
    return fallbackId;
  }
}

/**
 * Main migration coordinator.
 */export async function runFullMigration(db: sqlite3.Database) {
  const folderId = "1Hx40kNiiKn7ey92y1dDKRTXTjcU3zWhg";
  
  console.log("\n=======================================================");
  console.log("GABINETE IA: DATA MIGRATION ENGINE (VOTING CONSOLIDATION)");
  console.log("=======================================================\n");

  // Step 1: Discover and Download Sheet
  const fileId = await getSpreadsheetIdFromFolder(folderId);
  const downloadUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`;

  console.log(`[Download] Fetching CSV data stream from export endpoint...`);
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download spreadsheet content. Status: ${response.status}`);
  }

  const csvText = await response.text();
  const lines = csvText.split(/\r?\n/);
  console.log(`[Download] Downloaded successfully. Total raw lines: ${lines.length}`);

  // Step 2: Strict Grouping in Memory (Composite Key)
  console.log(`[Aggregation] Grouping rows to avoid nested loop inflation...`);
  const groupedVotes = new Map<string, GroupedVote>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse cells respecting double quotes for complex names
    const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"(.*)"$/, '$1').trim());
    if (cells.length < 5) continue;

    const ano = parseInt(cells[0], 10);
    const sheetName = cells[1];
    const ra = cells[2];
    const zona = parseInt(cells[3], 10);
    const votos = parseInt(cells[4], 10);

    if (isNaN(ano) || !sheetName || !ra || isNaN(zona) || isNaN(votos)) {
      continue;
    }

    // Compose strict key: NOME_CANDIDATO + ANO + ZONA + LOCALIDADE_RA
    const cleanSheetName = cleanString(sheetName);
    const cleanRA = cleanString(ra);
    const compositeKey = `${cleanSheetName}#${ano}#${zona}#${cleanRA}`;

    if (groupedVotes.has(compositeKey)) {
      const existing = groupedVotes.get(compositeKey)!;
      existing.votos += votos;
    } else {
      groupedVotes.set(compositeKey, {
        sheetName,
        ano,
        zona,
        ra,
        votos
      });
    }
  }

  console.log(`[Aggregation] Successfully consolidated into ${groupedVotes.size} unique geoelectoral voting records.`);

  // Step 3: Use passed Database connection & Load Candidates Cache
  
  const runQuery = (sql: string, params: any[] = []): Promise<void> => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  const getCandidatesFromDB = (): Promise<CandidatoDB[]> => {
    return new Promise((resolve, reject) => {
      db.all("SELECT id_candidato, nome_urna, nome_completo, ano_eleicao, total_votos FROM Candidatos", (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  };

  const candidates = await getCandidatesFromDB();
  console.log(`[Database] Loaded ${candidates.length} candidate records from system.`);

  // Maps to accumulate exact total voting math per candidate ID
  const candidateNewTotals = new Map<number, number>();
  const voteInserts: { id_candidato: number; zona: number; ra: string; votos: number }[] = [];
  
  let matchedCount = 0;
  let mismatchedCount = 0;
  const mismatchedCandidates = new Set<string>();

  // Match and build insertion payload
  for (const [key, item] of groupedVotes.entries()) {
    const matchedCandidate = findCandidate(candidates, item.sheetName, item.ano);

    if (matchedCandidate) {
      matchedCount++;
      const id = matchedCandidate.id_candidato;

      // Add to total_votos math
      const currentSum = candidateNewTotals.get(id) || 0;
      candidateNewTotals.set(id, currentSum + item.votos);

      // Save for insert block
      voteInserts.push({
        id_candidato: id,
        zona: item.zona,
        ra: item.ra,
        votos: item.votos
      });
    } else {
      mismatchedCount++;
      mismatchedCandidates.add(`${item.sheetName} (${item.ano})`);
    }
  }

  console.log(`[Matching] Successfully mapped ${voteInserts.length} voting rows to candidates.`);
  if (mismatchedCount > 0) {
    console.warn(`[Matching Warning] ${mismatchedCount} rows could not be matched. Unique unmatched candidates:`);
    mismatchedCandidates.forEach(c => console.log(`  - ${c}`));
  }

  // Step 4: Atomic Database Transaction
  console.log(`\n[Database] Opening atomic transaction block for writing...`);
  await runQuery("BEGIN TRANSACTION;");

  try {
    // A. Wipe old geoelectoral voting records
    console.log(`[Database] Purging old 'Geoeleitoral_Votos' records for atomic substitution...`);
    await runQuery("DELETE FROM Geoeleitoral_Votos;");

    // B. Bulk insert new correct consolidated votes
    console.log(`[Database] Inserting ${voteInserts.length} new consolidated rows...`);
    const insertStmt = db.prepare(
      "INSERT INTO Geoeleitoral_Votos (id_candidato, zona_eleitoral, ra_nome, votos) VALUES (?, ?, ?, ?)"
    );

    for (const vote of voteInserts) {
      await new Promise<void>((resolve, reject) => {
        insertStmt.run([vote.id_candidato, vote.zona, vote.ra, vote.votos], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    await new Promise<void>((resolve, reject) => {
      insertStmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // C. Update total votes in the Candidatos table to correct mathematical totals
    console.log(`[Database] Synchronizing Candidatos.total_votos with exact sheet summation...`);
    const updateStmt = db.prepare("UPDATE Candidatos SET total_votos = ? WHERE id_candidato = ?");

    for (const [candId, newTotal] of candidateNewTotals.entries()) {
      await new Promise<void>((resolve, reject) => {
        updateStmt.run([newTotal, candId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    await new Promise<void>((resolve, reject) => {
      updateStmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // D. Correct Pepa's real name from "Eduardo Cesar de Alencar" to "Pedro Paulo de Oliveira"
    console.log(`[Database] Fixing Pepa's full name to "Pedro Paulo de Oliveira"...`);
    await runQuery("UPDATE Candidatos SET nome_completo = 'Pedro Paulo de Oliveira' WHERE nome_urna = 'Pepa';");

    // Commit Transaction
    await runQuery("COMMIT;");
    console.log(`[Database] COMMIT completed successfully. DB state is 100% consistent.`);

    // Visual Audit Verification
    console.log(`\n=======================================================`);
    console.log("AUDIT SUMMARY & VERIFICATION FOR CANDIDATES");
    console.log("=======================================================");
    
    await new Promise<void>((resolve) => {
      db.all(
        `SELECT c.nome_urna, c.ano_eleicao, c.total_votos, SUM(g.votos) as total_votos_geo
         FROM Candidatos c
         LEFT JOIN Geoeleitoral_Votos g ON c.id_candidato = g.id_candidato
         GROUP BY c.id_candidato
         ORDER BY c.ano_eleicao DESC, c.total_votos DESC`,
        (err, rows: any[]) => {
          if (err) {
            console.error("Audit query failed:", err);
          } else {
            console.log(`${"NOME DE URNA".padEnd(25)} | ${"ANO".padEnd(5)} | ${"TOTAL CANDIDATO".padEnd(16)} | ${"SOMA DETALHADA"}`);
            console.log("-".repeat(70));
            rows.forEach(r => {
              const totalVotos = r.total_votos || 0;
              const totalVotosGeo = r.total_votos_geo || 0;
              const delta = totalVotos - totalVotosGeo;
              const alert = delta !== 0 ? `⚠️ DELTA: ${delta}` : "✅ OK";
              console.log(
                `${r.nome_urna.padEnd(25)} | ${r.ano_eleicao.toString().padEnd(5)} | ${totalVotos.toString().padEnd(16)} | ${totalVotosGeo.toString().padEnd(14)} | ${alert}`
              );
            });
          }
          console.log("=======================================================\n");
          resolve();
        }
      );
    });

  } catch (err: any) {
    console.error(`[Database Error] Write phase failed! Executing ROLLBACK...`);
    await runQuery("ROLLBACK;");
    throw err;
  }
}

// Exported for central usage in migration.ts
