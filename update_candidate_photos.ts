import sqlite3 from "sqlite3";
import path from "path";

// Main list provided by the user
const rawData = [
  { rawName: "Delegado Fernando Fernandes (PROS)", url: "https://drive.google.com/file/d/1o7yulXu7tW3HihzSWu5D4VxYy46eeozj/view?usp=sharing" },
  { rawName: "Professor Reginaldo Veras (PDT)", url: "https://drive.google.com/file/d/1RqQGOa8mcekC_fdDhCOf3cJjeBMAkFuC/view?usp=sharing" },
  { rawName: "Rafael Prudente (MDB)", url: "https://drive.google.com/file/d/1rE3Ugxyiyf8ECOOS8ycTqzMwJQqmtsMj/view?usp=sharing" },
  { rawName: "Delmasso (PRB)", url: "https://drive.google.com/file/d/1cd2fABwUV9W0xdYJ0sH7cVTi9bpTnbFH/view?usp=sharing" },
  { rawName: "Agaciel Maia (PR)", url: "https://drive.google.com/file/d/1OuE1kpqjAjUqCDU4gD4QQz87bqOqU7Tq/view?usp=sharing" },
  { rawName: "José Gomes (PSB)", url: "https://drive.google.com/file/d/1cCACjmVmqrEk_PgcZCzvhTJ-LFskjbvB/view?usp=sharing" },
  { rawName: "Arlete Sampaio (PT)", url: "https://drive.google.com/file/d/1q_jLiY1tBtgE18DMYTnRHWSvbwbDNgzV/view?usp=sharing" },
  { rawName: "Cláudio Abrantes (PDT)", url: "https://drive.google.com/file/d/10ap_SivLJ7OMpTZQw54StNNsdsHbGyvT/view?usp=sharing" },
  { rawName: "Valdelino Barcelos (PP)", url: "https://drive.google.com/file/d/1Isu_K3xceY81txplI-jkXkea2i2pmc9I/view?usp=sharing" },
  { rawName: "Júlia Lucy (NOVO)", url: "https://drive.google.com/file/d/1giMjYgV1gZmTYKehamGEH5iJSypt0G8m/view?usp=sharing" },
  { rawName: "Reginaldo Sardinha (AVANTE)", url: "https://drive.google.com/file/d/1GLZzShl31AsF2X7hpxRkwfRAt4OSnyuy/view?usp=sharing" },
  { rawName: "Leandro Grass (REDE)", url: "https://drive.google.com/file/d/10U6ZUmqn7ZqG9eEwUsIDOnHUjQYEA8BW/view?usp=sharing" },
  { rawName: "Julio César (PRB)", url: "https://drive.google.com/file/d/1tcikV1KWY3LbPT0maSRHDHnyhWbABEBl/view?usp=sharing" },
  { rawName: "Professor Israel (PV)", url: "https://drive.google.com/file/d/1euYUHBkfu2WZz8zheW5L_xKQE8xMSLPz/view?usp=sharing" },
  { rawName: "Dr. Michel (PP)", url: "https://drive.google.com/file/d/10Zfzw2ISE8If_CUTdl4czvcjJ8tnTIEG/view?usp=sharing" },
  { rawName: "Delmasso (PTN)", url: "https://drive.google.com/file/d/1cd2fABwUV9W0xdYJ0sH7cVTi9bpTnbFH/view?usp=sharing" },
  { rawName: "Joe Valle (PDT)", url: "https://drive.google.com/file/d/1OEFEMtCh5_AQ7xn0LmKrnOZW3qy3LBIT/view?usp=sharing" },
  { rawName: "Sandra Faraj (SD)", url: "https://drive.google.com/file/d/1X5HDzI-BcL82VB4Ch5eXOVYYYHaWZPNt/view?usp=sharing" },
  { rawName: "Wasny de Roure (PT)", url: "https://drive.google.com/file/d/1anJea8SRntKnHP6cObECmv7lh-jTu0Jr/view?usp=sharing" },
  { rawName: "Rafael Prudente (PMDB)", url: "https://drive.google.com/file/d/1rE3Ugxyiyf8ECOOS8ycTqzMwJQqmtsMj/view?usp=sharing" },
  { rawName: "Liliane Roriz (PRTB)", url: "https://drive.google.com/file/d/1lWc5iUw7egRpn4fk_5AO-a_rqD2D8-xj/view?usp=sharing" },
  { rawName: "Juarezão (PRTB)", url: "https://drive.google.com/file/d/1bFCeA1VRsqPA7AcLAtgH42yarBjKLZnE/view?usp=sharing" },
  { rawName: "Chico Leite (PT)", url: "https://drive.google.com/file/d/1N3TyiYM0U867PzYghamAPxJZ-dyduhWp/view?usp=sharing" },
  { rawName: "Agaciel Maia (PTC)", url: "https://drive.google.com/file/d/1OuE1kpqjAjUqCDU4gD4QQz87bqOqU7Tq/view?usp=sharing" },
  { rawName: "Cristiano Araújo (PTB)", url: "https://drive.google.com/file/d/19nSW-KDSX01aVq0Y1pxtRi0rY3ecIYRD/view?usp=sharing" },
  { rawName: "Bispo Renato (PR)", url: "https://drive.google.com/file/d/1nQEe_YOsQpt1zPUQRCTrkNfASWxmohXs/view?usp=sharing" },
  { rawName: "Celina Leão (PDT)", url: "https://drive.google.com/file/d/1klDpproKr_Y7QBPH5OxEOGoO2W_s4Hwg/view?usp=sharing" },
  { rawName: "Reginaldo Veras (PDT)", url: "https://drive.google.com/file/d/1RqQGOa8mcekC_fdDhCOf3cJjeBMAkFuC/view?usp=sharing" },
  { rawName: "Lira (PHS)", url: "https://drive.google.com/file/d/1epD6wLMiafkZQbtcMITQaM_xJ5xTr_PD/view?usp=sharing" },
  { rawName: "Telma Rufino (PPL)", url: "https://drive.google.com/file/d/12Yy2GBOO--QpJ-MVeSouRCerzUKP80Mg/view?usp=sharing" },
  { rawName: "Raimundo Ribeiro (PSDB)", url: "https://drive.google.com/file/d/1WHKuKEh63Pw-YnOGh35J-HyMlZaHOLkU/view?usp=sharing" },
  { rawName: "Luzia de Paula (PEN)", url: "https://drive.google.com/file/d/1HcVduL97OSybUlxoZkELV4tllCXK7yEd/view?usp=sharing" },
  { rawName: "1 - Fábio Felix", url: "https://drive.google.com/file/d/1aFU1richKRLMXwcsQeR0vN-XT-X3pldF/view?usp=sharing" },
  { rawName: "2 - Chico Vigilante", url: "https://drive.google.com/file/d/1KMA5DZhpWcTV7kdw1o6jEvZnmJiFfWAY/view?usp=sharing" },
  { rawName: "3 - Max Maciel", url: "https://drive.google.com/file/d/1LLbvhx0T0tc5lueue1B2lCTaoUS4zKM1/view?usp=sharing" },
  { rawName: "4 - Daniel Donizet", url: "https://drive.google.com/file/d/1ym92XN3zjqPeWheXW4d43CdfB9YmFA4_/view?usp=sharing" },
  { rawName: "5 - Martins Machado", url: "https://drive.google.com/file/d/1F8lSh2GesYg0Z1MoBDuJuNvuABcQIDNc/view?usp=sharing" },
  { rawName: "6 - Robério Negreiros", url: "https://drive.google.com/file/d/1_zpid5FDNlu23cw1Mau5Mxq-lj2zKuXW/view?usp=sharing" },
  { rawName: "7 - Jorge Vianna", url: "https://drive.google.com/file/d/1c47nhWtXnW-zl6X6UbBIUC1hgWiNgQca/view?usp=sharing" },
  { rawName: "8 - Jaqueline Silva", url: "https://drive.google.com/file/d/1n0PnQ_VtW2KkZeHaEW-gEVFI-27zvbt2/view?usp=sharing" },
  { rawName: "9 - Thiago Manzoni", url: "https://drive.google.com/file/d/1gi_TWI5KQzMdGrXSwnIttz-HLmOHg99g/view?usp=sharing" },
  { rawName: "10 - Eduardo Pedrosa", url: "https://drive.google.com/file/d/1JnnWLIDKeCM3l5L246M0uXff1BJjpMxp/view?usp=sharing" },
  { rawName: "11 - Joaquim Roriz Neto", url: "https://drive.google.com/file/d/1F3kFg3l9bQNOqwwnJ4V5y09Z8IiJKpEk/view?usp=sharing" },
  { rawName: "12 - Iolando", url: "https://drive.google.com/file/d/1d_eRuqwyc79YSCfbImQCLZdtDiSKFAnR/view?usp=sharing" },
  { rawName: "13 - Pastor Daniel de Castro", url: "https://drive.google.com/file/d/1RTd9ByBo6IU4gP5ULLjh_I_czJM4hXDE/view?usp=sharing" },
  { rawName: "14 - Hermeto", url: "https://drive.google.com/file/d/1EKNn6tEUBZX9dqLf4rJzxfT6L3cLM2C-/view?usp=sharing" },
  { rawName: "15 - Roosevelt Vilela", url: "https://drive.google.com/file/d/1t-vnsCh-u8rsv5LGPxuIA7dqq9nX1b01/view?usp=sharing" },
  { rawName: "16 - Doutora Jane", url: "https://drive.google.com/file/d/1Ut5ZEz3g4EewWdAfr7JHRrAxGOeaYOzH/view?usp=sharing" },
  { rawName: "17 - Rogério Morro da Cruz", url: "https://drive.google.com/file/d/1TVbZTrIQymlV3IJ6PJQ04TuEHFLZobRc/view?usp=sharing" },
  { rawName: "18 - Gabriel Magno", url: "https://drive.google.com/file/d/1O7Rxu3HrLgBTCsbKshvOGeLN9yNkxwP9/view?usp=sharing" },
  { rawName: "19 - João Cardoso", url: "https://drive.google.com/file/d/1YP95Vl5TiHJ_gj5tmJGKtyiG8-2Pnxf7/view?usp=sharing" },
  { rawName: "20 - Paula Belmonte", url: "https://drive.google.com/file/d/1M7nTajXEzAUKn90bfA9JP7C-F7gE6qDN/view?usp=sharing" },
  { rawName: "21 - Ricardo Vale", url: "https://drive.google.com/file/d/1k5KpbX602zcx2fvipN8wxqW2ATwO32w1/view?usp=sharing" },
  { rawName: "22 - Wellington Luiz", url: "https://drive.google.com/file/d/1wUcpe7yEfPFFRaIHrq8fgmhb9hzlDofo/view?usp=sharing" },
  { rawName: "23 - Pepa", url: "https://drive.google.com/file/d/1pg6yZtZ3fvFLLJBB7UGB9qvokWu_PX9I/view?usp=sharing" },
  { rawName: "24 - Dayse Amarilio", url: "https://drive.google.com/file/d/12dsbOU5u2KSnEzUpTjtOLCn0wbbxFQXF/view?usp=sharing" }
];

// Helper to extract Google Drive file ID
function extractDriveId(url: string): string {
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return "";
}

// Convert Drive URL to high performance direct link
function toHighPerfUrl(url: string): string {
  const fileId = extractDriveId(url);
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  return url;
}

// Normalize strings for matching
function cleanString(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "") // Keep only alphanumeric and space characters
    .replace(/\s+/g, " ") // Normalize double spaces
    .trim();
}

// Strip titles like PROFESSOR, DELEGADO, DR, DRA, PASTOR, DOUTORA, PROF, etc.
function stripTitles(str: string): string {
  const clean = cleanString(str);
  const titles = [
    "PROFESSOR", "PROFESSORA", "PROF", "DELEGADO", "DELEGADA", 
    "DR", "DRA", "DOUTOR", "DOUTORA", "PASTOR", "PASTORA"
  ];
  let words = clean.split(" ");
  while (words.length > 0 && titles.includes(words[0])) {
    words.shift();
  }
  return words.join(" ");
}

interface CandidateDB {
  id_candidato: number;
  nome_urna: string;
  nome_completo: string | null;
  ano_eleicao: number;
}

async function run() {
  console.log("=======================================================");
  console.log("GABINETE IA: CANDIDATE PHOTO UPDATE ENGINE");
  console.log("=======================================================");

  const dbPath = path.join(process.cwd(), "eleicoes.db");
  const db = new sqlite3.Database(dbPath);

  const dbAll = (sql: string, params: any[] = []): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  };

  const dbRun = (sql: string, params: any[] = []): Promise<any> => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  };

  // 1. Fetch all candidates
  const dbCandidates: CandidateDB[] = await dbAll(
    "SELECT id_candidato, nome_urna, nome_completo, ano_eleicao FROM Candidatos"
  );
  console.log(`Loaded ${dbCandidates.length} candidate records from database.`);

  // 2. Map and Consolidate Input List
  // Some candidates are repeated with different parties/years.
  // We want to map each unique candidate to their high performance Google Drive URL.
  const photoMap = new Map<string, string>(); // Cleaned stripped Name -> HighPerf URL

  for (const item of rawData) {
    // Clean rawName: e.g., "Delegado Fernando Fernandes (PROS)" -> "Fernando Fernandes"
    let name = item.rawName;
    
    // Remove leading numbers like "1 - "
    name = name.replace(/^\d+\s*-\s*/, "");
    
    // Remove party suffix like " (PROS)"
    name = name.replace(/\s*\([^)]+\)$/, "");
    
    const cleanName = cleanString(name);
    const strippedName = stripTitles(name);
    const highPerfUrl = toHighPerfUrl(item.url);

    if (!strippedName) continue;

    // Check if we already have a record for this stripped name
    if (!photoMap.has(strippedName)) {
      photoMap.set(strippedName, highPerfUrl);
    }
  }

  console.log(`Consolidated ${photoMap.size} unique candidate photo mappings.`);

  // 3. Perform matching and prepare update statements
  // We want to update `foto_url` in the DB for all records matching the candidate name.
  // To be robust: a candidate in the DB matches if:
  // - Clean nome_urna matches strippedName
  // - Clean nome_completo matches strippedName
  // - Or vice versa (sub-string overlap after stripping titles)
  
  let matchCount = 0;
  const updates: { id: number; url: string; name: string; year: number }[] = [];

  for (const dbCand of dbCandidates) {
    const cleanUrna = cleanString(dbCand.nome_urna);
    const strippedUrna = stripTitles(dbCand.nome_urna);
    const cleanCompleto = cleanString(dbCand.nome_completo || "");
    const strippedCompleto = stripTitles(dbCand.nome_completo || "");

    let matchedUrl: string | null = null;

    // Direct check in photoMap
    if (photoMap.has(strippedUrna)) {
      matchedUrl = photoMap.get(strippedUrna)!;
    } else if (photoMap.has(cleanUrna)) {
      matchedUrl = photoMap.get(cleanUrna)!;
    } else if (strippedCompleto && photoMap.has(strippedCompleto)) {
      matchedUrl = photoMap.get(strippedCompleto)!;
    } else {
      // Fuzzy/Token check
      for (const [photoName, url] of photoMap.entries()) {
        if (
          strippedUrna.includes(photoName) || 
          photoName.includes(strippedUrna) ||
          (strippedCompleto && (strippedCompleto.includes(photoName) || photoName.includes(strippedCompleto)))
        ) {
          matchedUrl = url;
          break;
        }
      }
    }

    // Manual aliases or fine-tunings
    if (!matchedUrl) {
      if (strippedUrna === "JOAO CARDOSO PROFESSOR AUDITOR" && photoMap.has("JOAO CARDOSO")) {
        matchedUrl = photoMap.get("JOAO CARDOSO")!;
      }
      if (strippedUrna === "PEPA" && photoMap.has("PEPA")) {
        matchedUrl = photoMap.get("PEPA")!;
      }
    }

    if (matchedUrl) {
      updates.push({
        id: dbCand.id_candidato,
        url: matchedUrl,
        name: dbCand.nome_urna,
        year: dbCand.ano_eleicao
      });
      matchCount++;
    } else {
      console.log(`⚠️ Unmatched Candidate: ${dbCand.nome_urna} (${dbCand.ano_eleicao})`);
    }
  }

  console.log(`Matched ${matchCount} out of ${dbCandidates.length} candidate rows.`);

  // 4. Execute atomic transaction to update Candidatos.foto_url
  await dbRun("BEGIN TRANSACTION;");
  try {
    for (const update of updates) {
      await dbRun(
        "UPDATE Candidatos SET foto_url = ? WHERE id_candidato = ?",
        [update.url, update.id]
      );
    }
    await dbRun("COMMIT;");
    console.log("🚀 COMMIT COMPLETED. Database is updated successfully!");
  } catch (err: any) {
    await dbRun("ROLLBACK;");
    console.error("❌ Transaction failed, rolled back.", err);
    db.close();
    process.exit(1);
  }

  db.close();
  console.log("Done.");
}

run().catch(console.error);
