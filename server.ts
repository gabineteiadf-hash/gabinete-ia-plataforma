import express from "express";
import path from "path";
import sqlite3 from "sqlite3";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import { seedHistoricalData, atualizarCampanhas2026 } from "./migration"; 

dotenv.config();

const app = express();
app.use(express.json());
app.use("/assets", express.static(path.join(process.cwd(), "public", "assets")));
app.use("/fotos", express.static(path.join(process.cwd(), "public", "assets", "fotos")));

const PORT = 3000;

// Setup SQLite Database
const dbPath = path.join(process.cwd(), "eleicoes.db");
let db = new sqlite3.Database(dbPath);

// Prevent database locked errors under concurrent requests
db.run("PRAGMA busy_timeout = 10000;");

// In-memory cache for Google Drive photos
let drivePhotoCache: Map<string, string> = new Map();
let driveRawNamesCache: Map<string, string> = new Map();
let lastCacheFetchTime = 0;

// Normalize string for Google Drive name matching (strip accents, spaces, symbols to alphanumeric only)
function normalizeNameForDrive(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Dynamically scrapes the public Google Drive photos folder
async function fetchGoogleDriveFolderFiles(): Promise<Map<string, string>> {
  const now = Date.now();
  // 10 minutes TTL cache
  if (drivePhotoCache.size > 0 && (now - lastCacheFetchTime < 10 * 60 * 1000)) {
    return drivePhotoCache;
  }

  const folderId = "1qya6V8ZCcbyybIMOrWUjBhyR-wOYaO5F";
  const url = `https://drive.google.com/drive/folders/${folderId}`;
  console.log(`[Drive Photo API] Fetching public photo folder page: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const rawHtml = await response.text();

    // Decode hex and unicode escapes (like \x00e1 for 'á' or \x22 for '"') before matching
    const html = rawHtml
      .replace(/\\x([0-9a-fA-F]{4})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\x([0-9a-fA-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

    const regex = /data-id="([a-zA-Z0-9_-]{25,})"/g;
    const newCache = new Map<string, string>();
    const newRawCache = new Map<string, string>();
    let m;
    while ((m = regex.exec(html)) !== null) {
      const fileId = m[1];
      // Check both backwards and forwards (500 chars window) around data-id to find the label/tooltip
      const sub = html.substring(Math.max(0, m.index - 500), Math.min(html.length, m.index + 500));
      const fileMatch = sub.match(/aria-label="([^"]+)"/) || 
                        sub.match(/data-tooltip="([^"]+)"/) || 
                        sub.match(/<strong class="DNoYtb">([^<]+)<\/strong>/);
      if (fileMatch) {
        let name = fileMatch[1];
        // Clean up common suffixes or file extension
        name = name.replace(/\s+Image\s+Shared$/i, '')
                   .replace(/\s+Image$/i, '')
                   .replace(/\.[a-zA-Z0-9]+$/, '')
                   .trim();
        const norm = normalizeNameForDrive(name);
        newCache.set(norm, fileId);
        newRawCache.set(name, fileId);
      }
    }

    if (newCache.size > 0) {
      drivePhotoCache = newCache;
      driveRawNamesCache = newRawCache;
      lastCacheFetchTime = now;
      console.log(`[Drive Photo API] Successfully loaded and cached ${drivePhotoCache.size} photo mappings from Google Drive.`);
    }
  } catch (err: any) {
    console.error(`[Drive Photo API] Error fetching or parsing Google Drive folder: ${err.message}`);
  }
  return drivePhotoCache;
}

// API Endpoints
app.get("/api/fotos/:candidatoId", async (req, res) => {
    const { candidatoId } = req.params;
    const logMsg = (msg: string) => {
        try {
            fs.appendFileSync(path.join(process.cwd(), "logs/diagnostic.log"), `${new Date().toISOString()} - ${msg}\n`);
        } catch (e) {}
    };
    
    logMsg(`Foto requested for ID: ${candidatoId}`);
    try {
        const overridesDrive: Record<string, string> = {
          "Thiago Manzoni": "https://drive.google.com/file/d/1gi_TWI5KQzMdGrXSwnIttz-HLmOHg99g/view?usp=sharing",
          "Wellington Luiz": "https://drive.google.com/file/d/1wUcpe7yEfPFFRaIHrq8fgmhb9hzlDofo/view?usp=drive_link",
          "Valdelino Barcelos": "https://drive.google.com/file/d/1Isu_K3xceY81txplI-jkXkea2i2pmc9I/view?usp=drive_link",
          "Telma Rufino": "https://drive.google.com/file/d/12Yy2GBOO--QpJ-MVeSouRCerzUKP80Mg/view?usp=drive_link",
          "Wasny de Roure": "https://drive.google.com/file/d/1anJea8SRntKnHP6cObECmv7lh-jTu0Jr/view?usp=drive_link",
          "Hermeto": "https://drive.google.com/file/d/1d_eRuqwyc79YSCfbImQCLZdtDiSKFAnR/view?usp=drive_link",
          "Doutora Jane": "1Ut5ZEz3g4EewWdAfr7JHRrAxGOeaYOzH"
        };

        const extractDriveFileId = (str: string): string => {
          if (!str) return "";
          if (str.includes("11yITBtgF18DmYTNRhWSvwbDbNDvZV")) {
            return "1Ut5ZEz3g4EewWdAfr7JHRrAxGOeaYOzH";
          }
          if (str.includes("drive.google.com") || str.includes("googleusercontent.com")) {
            const match = str.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match) return match[1];
          }
          return str.replace(/\/view.*$/, "").replace(/\?.*$/, "").trim();
        };

        // Fetch up-to-date Google Drive photo files list
        const driveFiles = await fetchGoogleDriveFolderFiles();

        const idNum = parseInt(candidatoId, 10);
        // Pre-defined ID mapping for 2026 candidates to prevent overlapping/wrong SQLite ID resolution
        const idToNameMap: Record<number, string> = {
          20261: "Fábio Felix",
          20262: "Chico Vigilante",
          20263: "Max Maciel",
          20264: "Robério Negreiros",
          20265: "Eduardo Pedrosa",
          20266: "Dayse Amarilio",
          20267: "Gabriel Magno",
          20268: "Doutora Jane",
          20269: "Hermeto"
        };

        let fileId: string | undefined = undefined;
        let row: any = null;

        if (!isNaN(idNum) && idToNameMap[idNum]) {
            const mappedName = idToNameMap[idNum];
            logMsg(`Mapped 2026 candidate ID ${idNum} directly to name: ${mappedName}`);
            // Query database to resolve candidate's full record by mapped name
            row = await new Promise((resolve) => {
                db.get("SELECT id_candidato, nome_urna, nome_completo FROM Candidatos WHERE nome_urna = ? OR nome_completo = ? LIMIT 1", [mappedName, mappedName], (err, dbRow) => {
                    if (err || !dbRow) {
                        // Fallback: mock a row
                        resolve({ nome_urna: mappedName, nome_completo: mappedName });
                    } else {
                        resolve(dbRow);
                    }
                });
            });
        } else {
            // Standard candidate ID query
            row = await new Promise((resolve) => {
                if (isNaN(idNum)) {
                    resolve(null);
                    return;
                }
                db.get("SELECT id_candidato, nome_urna, nome_completo FROM Candidatos WHERE id_candidato = ?", [idNum], (err, dbRow) => {
                    if (err) resolve(null);
                    else resolve(dbRow);
                });
            });
        }
        
        if (row) {
            logMsg(`Database result for candidate: ${JSON.stringify(row)}`);
            const normUrna = normalizeNameForDrive(row.nome_urna);
            const normCompleto = normalizeNameForDrive(row.nome_completo || "");

            // PRIORITY BYPASS CHECK (overridesDrive)
            // If the resolved candidate matches any override, bypass immediately
            for (const [key, val] of Object.entries(overridesDrive)) {
                const normKey = normalizeNameForDrive(key);
                if (normKey === normUrna || normKey === normCompleto || normUrna.includes(normKey) || normCompleto.includes(normKey)) {
                    fileId = extractDriveFileId(val);
                    logMsg(`Matched priority bypass exception for candidate '${row.nome_urna}': ${key} -> Drive ID: ${fileId}`);
                    break;
                }
            }

            if (!fileId) {
                // Tier 1: Exact Match on Nome Urna
                if (driveFiles.has(normUrna)) {
                    fileId = driveFiles.get(normUrna);
                    logMsg(`Matched on exact Nome Urna: ${row.nome_urna} -> Drive ID: ${fileId}`);
                }
                // Tier 2: Exact Match on Nome Completo
                else if (normCompleto && driveFiles.has(normCompleto)) {
                    fileId = driveFiles.get(normCompleto);
                    logMsg(`Matched on exact Nome Completo: ${row.nome_completo} -> Drive ID: ${fileId}`);
                }
                // Tier 3: Substring/Inclusion Matching
                else {
                    for (const [normFile, fid] of driveFiles.entries()) {
                        if (normFile.includes(normUrna) || normUrna.includes(normFile) ||
                            (normCompleto && (normFile.includes(normCompleto) || normCompleto.includes(normFile)))) {
                            fileId = fid;
                            logMsg(`Matched on substring match for candidate ${row.nome_urna}: Drive File Key '${normFile}' -> Drive ID: ${fileId}`);
                            break;
                        }
                    }
                }

                // Tier 4: Fuzzy word overlap matching (accent/case insensitive, spaces/connectives ignored)
                if (!fileId) {
                    const getWords = (s: string) => {
                        if (!s) return [];
                        return s
                            .normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "")
                            .toLowerCase()
                            .split(/[^a-z0-9]+/)
                            .filter(w => w.length >= 3);
                    };

                    const candidateWords = [...new Set([
                        ...getWords(row.nome_urna),
                        ...getWords(row.nome_completo || "")
                    ])];

                    if (candidateWords.length > 0) {
                        for (const [rawName, fid] of driveRawNamesCache.entries()) {
                            const fileWords = getWords(rawName);
                            // Count overlapping words
                            const matchCount = candidateWords.filter(cw => 
                                fileWords.some(fw => fw === cw || fw.includes(cw) || cw.includes(fw))
                            ).length;

                            // Match if at least 2 words overlap, or candidate only has 1 word and it overlaps
                            if (matchCount >= 2 || (candidateWords.length === 1 && matchCount === 1)) {
                                fileId = fid;
                                logMsg(`Matched via fuzzy word overlap: Candidate ${row.nome_urna} (${candidateWords.join(",")}) matched with Drive file '${rawName}' (${fileWords.join(",")}) -> Drive ID: ${fileId}`);
                                break;
                            }
                        }
                    }
                }
            }
        } else {
            // Not found in DB or non-numeric ID. Match directly on overrides or candidateId string
            const normId = normalizeNameForDrive(candidatoId);
            for (const [key, val] of Object.entries(overridesDrive)) {
                const normKey = normalizeNameForDrive(key);
                if (normKey === normId || normId.includes(normKey) || normKey.includes(normId)) {
                    fileId = extractDriveFileId(val);
                    logMsg(`Matched priority bypass directly on input string '${candidatoId}': ${key} -> Drive ID: ${fileId}`);
                    break;
                }
            }

            if (!fileId) {
                if (driveFiles.has(normId)) {
                    fileId = driveFiles.get(normId);
                    logMsg(`Matched directly on normalized candidateId string '${candidatoId}' -> Drive ID: ${fileId}`);
                } else {
                    for (const [normFile, fid] of driveFiles.entries()) {
                        if (normFile.includes(normId) || normId.includes(normFile)) {
                            fileId = fid;
                            logMsg(`Matched directly on substring for candidateId string '${candidatoId}' -> Drive ID: ${fileId}`);
                            break;
                        }
                    }
                }
            }
        }

        if (fileId) {
            logMsg(`Redirecting photo request to Google Drive direct image URL: https://lh3.googleusercontent.com/d/${fileId}`);
            return res.redirect(`https://lh3.googleusercontent.com/d/${fileId}`);
        } else {
            logMsg(`DRIVE PHOTO NOT FOUND for ID/Name: ${candidatoId} - returning clean 404`);
            return res.status(404).json({ error: "Foto não localizada no Google Drive" });
        }
    } catch (err: any) {
        logMsg(`Failed to fetch photo dynamically from Google Drive: ${err.message}`);
        return res.status(404).json({ error: "Foto não localizada ou erro ao processar" });
    }
});

// ...

async function forceResetDatabaseFile() {
  console.log("Performing force reset of the database file...");
  try {
    await new Promise<void>((resolve) => {
      db.close((err) => {
        if (err) {
          console.error("Error closing SQLite connection before deletion:", err);
        }
        resolve();
      });
    });
  } catch (e: any) {
    console.error("Failed to close db cleanly:", e.message || e);
  }

  const dbPath = path.join(process.cwd(), "eleicoes.db");
  const backupPath = path.join(process.cwd(), "eleicoes.db.bak");

  if (fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
      console.log("Deleted database file: eleicoes.db");
    } catch (e: any) {
      console.error(`Failed to delete ${dbPath}:`, e.message);
    }
  }

  if (fs.existsSync(backupPath)) {
    try {
      fs.unlinkSync(backupPath);
      console.log("Deleted database backup file: eleicoes.db.bak");
    } catch (e: any) {
      console.error(`Failed to delete ${backupPath}:`, e.message);
    }
  }

  db = new sqlite3.Database(dbPath);
  db.run("PRAGMA busy_timeout = 10000;");
  console.log("Brand new SQLite connection opened on fresh eleicoes.db");
}

async function rebuildDatabase() {
  console.log("Rebuilding database from scratch...");
  try {
    // 1. Initialize tables and seed candidate list
    await initDatabase();
    console.log("Database tables and candidates seeded successfully.");
    
    // 2. Load historical voting geoelectoral records from the spreadsheet/migration
    await seedHistoricalData(dbPath);
    console.log("Geoelectoral votes loaded and synchronized successfully.");
    
    // 3. Update 2026 campaigns
    await atualizarCampanhas2026(dbPath);
    console.log("2026 campaign data updated successfully.");
    
    console.log("Database rebuild completed perfectly!");
  } catch (err: any) {
    console.error("Critical error during database rebuild:", err.message || err);
  }
}

async function ensureDatabaseInitialized() {
  console.log("Initializing database and campaign data...");
  let isCorrupted = false;

  try {
    const isCorrupt = await new Promise<boolean>((resolve) => {
      db.get("SELECT name FROM sqlite_master LIMIT 1", (err) => {
        if (err) {
          const msg = String(err.message || err);
          console.error(`Pre-check SQLite Master failed: ${msg}`);
          if (msg.toUpperCase().includes("CORRUPT") || msg.toUpperCase().includes("MALFORMED") || msg.toUpperCase().includes("DISK I/O")) {
            resolve(true);
            return;
          }
        }
        db.get("SELECT COUNT(*) FROM Candidatos", (err2) => {
          if (err2) {
            const msg2 = String(err2.message || err2);
            console.error(`Pre-check Candidatos failed: ${msg2}`);
            if (msg2.toUpperCase().includes("CORRUPT") || msg2.toUpperCase().includes("MALFORMED") || msg2.toUpperCase().includes("DISK I/O")) {
              resolve(true);
            } else {
              resolve(false);
            }
          } else {
            resolve(false);
          }
        });
      });
    });

    if (isCorrupt) {
      isCorrupted = true;
    }
  } catch (err: any) {
    console.error("Checking database for corruption failed:", err);
    isCorrupted = true;
  }

  if (isCorrupted) {
    console.warn("Database corruption detected during pre-check. Forcing database reset...");
    await forceResetDatabaseFile();
    await rebuildDatabase();
    return;
  }

  // Normal flow
  try {
    const tableExists = await new Promise<boolean>((resolve) => {
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='Candidatos'", (err, row) => {
        if (err || !row) resolve(false);
        else resolve(true);
      });
    });

    if (!tableExists) {
      console.log("Candidatos table not found. Creating and seeding tables...");
      await initDatabase();
    }

    // 1. Seed historical data if needed
    await seedHistoricalData(dbPath);
    
    // 2. Update 2026 data every time
    await atualizarCampanhas2026(dbPath);
    
  } catch (err: any) {
    const errMsg = String(err.message || err);
    console.error("Initialization failed:", errMsg);
    if (errMsg.toUpperCase().includes("CORRUPT") || errMsg.toUpperCase().includes("MALFORMED") || errMsg.toUpperCase().includes("DISK I/O")) {
      console.warn("Database corruption detected during initialization. Forcing database reset...");
      await forceResetDatabaseFile();
      await rebuildDatabase();
    }
  }
}

// Lazy-initialize Google GenAI to prevent module-load crashes if API key is missing
let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

async function generateContentWithFallback(params: {
  contents: any;
  config?: any;
}, retries = 3, delay = 1000): Promise<any> {
  const ai = getAiClient();
  try {
    return await ai.models.generateContent({
      model: "gemini-1.5-flash",
      ...params,
    });
  } catch (err: any) {
    if ((err.code === 503 || err.code === 429) && retries > 0) {
        console.warn(`[Gemini API] ${err.code} error, retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return generateContentWithFallback(params, retries - 1, delay * 2);
    }
    
    console.warn("Primary model gemini-1.5-flash failed, attempting fallback to gemini-flash-latest:", err);
    try {
      return await ai.models.generateContent({
        model: "gemini-flash-latest",
        ...params,
      });
    } catch (fallbackErr: any) {
      console.error("Fallback to gemini-flash-latest also failed:", fallbackErr);
      throw err;
    }
  }
}

// Promised database queries helpers
const dbAll = (query: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (query: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbRun = (query: string, params: any[] = []): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(query, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Database Initialization and Seeding Tables Only (no hardcoded data)
async function initDatabase() {
  console.log("Initializing database tables...");
  
  await dbRun(`
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
  `);

  await dbRun(`
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
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS Geoeleitoral_Votos (
      id_voto INTEGER PRIMARY KEY AUTOINCREMENT,
      id_candidato INTEGER NOT NULL,
      zona_eleitoral INTEGER NOT NULL,
      ra_nome TEXT NOT NULL,
      votos INTEGER NOT NULL,
      FOREIGN KEY(id_candidato) REFERENCES Candidatos(id_candidato)
    )
  `);
}

// API Endpoints

// Dynamic on-demand Wikipedia profile photo fetch and cache endpoint
app.get("/api/proxy-foto", async (req, res) => {
  try {
    const nomeUrna = req.query.nome as string;
    if (!nomeUrna) {
      return res.status(400).json({ error: "Nome da urna é obrigatório" });
    }

    const normalized = nomeUrna
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, "")
      .replace(/[\s-]+/g, "_")
      .trim();

    const normalizedNoUnderscore = normalized.replace(/_/g, "");

    const FOTOS_DIR = path.join(process.cwd(), "public", "assets", "fotos");
    
    // Try multiple filename variations
    const candidates = [
        `${normalized}.jpg`,
        `${normalizedNoUnderscore}.jpg`
    ];

    let destFile = null;
    for (const filename of candidates) {
        const filePath = path.join(FOTOS_DIR, filename);
        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
            destFile = filePath;
            break;
        }
    }

    console.log(`[Proxy-Foto] Looking for files: ${JSON.stringify(candidates)}, normalized: ${normalized}`);

    // Ensure the folder exists
    if (!fs.existsSync(FOTOS_DIR)) {
      fs.mkdirSync(FOTOS_DIR, { recursive: true });
    }

    // 1. If file already exists locally, send it directly
    if (destFile) {
      return res.sendFile(destFile);
    }


    // 2. Otherwise, fetch from Wikipedia Summary dynamically on-demand!
    console.log(`[Proxy-Foto] Searching Wikipedia on-the-fly for "${nomeUrna}" (normalized: ${normalized})...`);
    
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };

    // Helper to fetch and convert to thumbnail if needed
    const convertToThumbnailUrl = (url: string, width: number = 500): string => {
      if (url.includes("upload.wikimedia.org/wikipedia/commons/") && !url.includes("/thumb/")) {
        const parts = url.split("upload.wikimedia.org/wikipedia/commons/");
        if (parts.length === 2) {
          const pathAndName = parts[1];
          const nameParts = pathAndName.split("/");
          const fileName = nameParts[nameParts.length - 1];
          return `https://upload.wikimedia.org/wikipedia/commons/thumb/${pathAndName}/${width}px-${fileName}`;
        }
      }
      return url;
    };

    let url: string | null = null;
    const queries = [nomeUrna];
    
    // Check if we have complete name and/or custom photo URL in database
    const row: any = await new Promise((resolve) => {
      db.get("SELECT nome_completo, foto_url FROM Candidatos WHERE nome_urna = ? LIMIT 1", [nomeUrna], (err, r) => {
        resolve(r);
      });
    });

    if (row && row.nome_completo && row.nome_completo !== nomeUrna) {
      queries.push(row.nome_completo);
    }

    // Prioritize direct/Google Drive URL from database if present
    if (row && row.foto_url && row.foto_url.trim() !== "") {
      const dbUrl = row.foto_url.trim();
      if (dbUrl.includes("drive.google.com")) {
        const match = dbUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || dbUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          url = `https://lh3.googleusercontent.com/d/${match[1]}`;
          console.log(`[Proxy-Foto] Found Google Drive photo URL in DB for "${nomeUrna}": converted to ${url}`);
        }
      } else {
        url = dbUrl;
        console.log(`[Proxy-Foto] Found custom photo URL in DB for "${nomeUrna}": ${url}`);
      }
    }

    // If no direct photo URL is found in the database, fallback to searching Wikipedia on-demand
    if (!url) {
      for (const query of queries) {
      try {
        const searchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1`;
        const searchRes = await fetch(searchUrl, { headers }).then(r => r.json() as any);
        
        if (searchRes.query && searchRes.query.search && searchRes.query.search.length > 0) {
          let bestTitle = "";
          for (const hit of searchRes.query.search) {
            const text = (hit.title + " " + hit.snippet).toLowerCase();
            if (
              text.includes("deputado") || 
              text.includes("deputada") || 
              text.includes("polític") || 
              text.includes("distrital") || 
              text.includes("brasília") || 
              text.includes("cldf") || 
              text.includes("câmara")
            ) {
              bestTitle = hit.title;
              break;
            }
          }
          
          if (!bestTitle) {
            bestTitle = searchRes.query.search[0].title;
          }
          
          const summaryUrl = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`;
          const summaryRes = await fetch(summaryUrl, { headers }).then(r => r.json() as any);
          
          if (summaryRes.thumbnail && summaryRes.thumbnail.source) {
            url = summaryRes.thumbnail.source;
            break;
          } else if (summaryRes.originalimage && summaryRes.originalimage.source) {
            url = summaryRes.originalimage.source;
            break;
          }
        }
      } catch (err: any) {
        console.error(`[Proxy-Foto] Wikipedia search error for "${query}":`, err.message);
      }
    }
    }

    // 3. Download the photo if found
    if (url) {
      const targetUrl = convertToThumbnailUrl(url, 500);
      console.log(`[Proxy-Foto] Downloading picture from: ${targetUrl}`);
      
      const response = await fetch(targetUrl, { headers });
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(destFile, buffer);
        console.log(`[Proxy-Foto] Successfully downloaded and cached to: ${destFile}`);
        return res.sendFile(destFile);
      } else {
        console.warn(`[Proxy-Foto] Failed to download thumbnail. Status: ${response.status}`);
      }
    }

    // 4. Send 404 if not found (frontend will gracefully handle and show fallback initials)
    return res.status(404).json({ error: "Foto não encontrada no Wikipedia" });
  } catch (err: any) {
    console.error("[Proxy-Foto Erro]:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 1. Get elected candidates list by election year
app.get("/api/eleitos/:ano", async (req, res) => {
  try {
    const { ano } = req.params;
    const year = parseInt(ano, 10);
    
    if (isNaN(year)) {
      return res.status(400).json({ error: "Ano inválido" });
    }

    const query = `
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
      JOIN Resumo_Financeiro rf ON c.id_candidato = rf.id_candidato
      WHERE c.ano_eleicao = ?
      ORDER BY c.total_votos DESC
    `;

    const candidates = await dbAll(query, [year]);
    
    // Parse detailed expenses JSON if any
    const parsedCandidates = candidates.map(cand => ({
      ...cand,
      detalhe_despesas: cand.detalhe_despesas ? JSON.parse(cand.detalhe_despesas) : []
    }));

    res.json(parsedCandidates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get detailed candidate profile and candidate history across years
app.get("/api/historico_politico/:nome_urna/:ano", async (req, res) => {
  try {
    const { nome_urna, ano } = req.params;
    const year = parseInt(ano, 10);

    if (isNaN(year)) {
      return res.status(400).json({ error: "Ano inválido" });
    }

    // Get specific year details
    const candQuery = `
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
      JOIN Resumo_Financeiro rf ON c.id_candidato = rf.id_candidato
      WHERE LOWER(c.nome_urna) = LOWER(?) AND c.ano_eleicao = ?
    `;

    const candidate = await dbGet(candQuery, [nome_urna, year]);

    if (!candidate) {
      return res.status(404).json({ error: "Candidato não encontrado no ano especificado" });
    }

    // Parse detailed expenses
    candidate.detalhe_despesas = candidate.detalhe_despesas ? JSON.parse(candidate.detalhe_despesas) : [];

    // Get geographical votes
    const votesQuery = `
      SELECT zona_eleitoral, ra_nome, votos 
      FROM Geoeleitoral_Votos 
      WHERE id_candidato = ?
      ORDER BY votos DESC
    `;
    const geoVotes = await dbAll(votesQuery, [candidate.id_candidato]);
    candidate.votos_geoeleitorais = geoVotes;

    // Get all election years disputed/present in the DB for this candidate
    const historyQuery = `
      SELECT ano_eleicao, partido, total_votos, situacao
      FROM Candidatos
      WHERE LOWER(nome_urna) = LOWER(?)
      ORDER BY ano_eleicao DESC
    `;
    const historicalDisputes = await dbAll(historyQuery, [nome_urna]);
    
    // Add years disputed to the response
    res.json({
      candidate,
      anos_disputados: historicalDisputes
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint for reputation management and media clipping
app.get("/api/reputacao/:candidatoId", async (req, res) => {
  try {
    const { candidatoId } = req.params;
    let candId = parseInt(candidatoId, 10);

    if (isNaN(candId)) {
      return res.status(400).json({ error: "ID do candidato inválido" });
    }

    // Map hardcoded 2026 IDs to their database candidate records using nome_urna
    if (candId > 20000) {
      const mapping: Record<number, string> = {
        20261: "Fábio Felix",
        20262: "Chico Vigilante",
        20263: "Max Maciel",
        20264: "Robério Negreiros",
        20265: "Eduardo Pedrosa",
        20266: "Dayse Amarilio",
        20267: "Gabriel Magno",
        20268: "Doutora Jane",
        20269: "Hermeto"
      };
      const nomeUrna = mapping[candId];
      if (nomeUrna) {
        const dbCand = await dbGet("SELECT id_candidato FROM Candidatos WHERE nome_urna = ? LIMIT 1", [nomeUrna]);
        if (dbCand && dbCand.id_candidato) {
          candId = dbCand.id_candidato;
        }
      }
    }

    const query = `
      SELECT * FROM Reputacao_Clipping 
      WHERE id_candidato = ?
      ORDER BY data_publicacao DESC
    `;

    const clippings = await dbAll(query, [candId]);

    const parsedClippings = clippings.map(clip => {
      const parsed = { ...clip };
      try {
        parsed.deputados_mencionados = clip.deputados_mencionados ? JSON.parse(clip.deputados_mencionados) : [];
      } catch (e) {
        parsed.deputados_mencionados = [];
      }

      try {
        parsed.partidos_citados = clip.partidos_citados ? JSON.parse(clip.partidos_citados) : [];
      } catch (e) {
        parsed.partidos_citados = [];
      }

      try {
        parsed.orgaos_envolvidos = clip.orgaos_envolvidos ? JSON.parse(clip.orgaos_envolvidos) : [];
      } catch (e) {
        parsed.orgaos_envolvidos = [];
      }

      try {
        parsed.palavras_chave = clip.palavras_chave ? JSON.parse(clip.palavras_chave) : [];
      } catch (e) {
        parsed.palavras_chave = [];
      }

      try {
        parsed.riscos = clip.riscos ? JSON.parse(clip.riscos) : [];
      } catch (e) {
        parsed.riscos = [];
      }

      try {
        parsed.oportunidades = clip.oportunidades ? JSON.parse(clip.oportunidades) : [];
      } catch (e) {
        parsed.oportunidades = [];
      }

      return parsed;
    });

    res.json(parsedClippings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. AI analysis of the general election and financial stats for a given year
app.get("/api/analise/:ano", async (req, res) => {
  try {
    const { ano } = req.params;
    const year = parseInt(ano, 10);

    if (isNaN(year)) {
      return res.status(400).json({ error: "Ano inválido" });
    }

    // Get all candidates and financial stats for analysis
    const query = `
      SELECT 
        c.nome_urna,
        c.partido,
        c.total_votos,
        rf.total_receitas,
        rf.despesas_contratadas,
        rf.despesas_pagas,
        rf.maior_fornecedor_nome,
        rf.maior_fornecedor_valor
      FROM Candidatos c
      JOIN Resumo_Financeiro rf ON c.id_candidato = rf.id_candidato
      WHERE c.ano_eleicao = ?
      ORDER BY rf.despesas_contratadas DESC
    `;
    const stats = await dbAll(query, [year]);

    if (stats.length === 0) {
      return res.status(404).json({ error: `Nenhum dado encontrado para o ano ${year}` });
    }

    // Build the analysis prompt for Gemini
    let prompt = `Você é o auditor político-financeiro líder da plataforma "Gabinete IA".
Sua tarefa é auditar e fornecer uma análise detalhada baseada nos dados oficiais de Despesas Contratadas e Receitas dos Deputados Distritais eleitos para a CLDF no ano de ${year}.

Regras fundamentais:
- Use exclusivamente o valor das "Despesas Contratadas" como o valor oficial das despesas de campanha, pois representa o compromisso formal de gasto do candidato (conforme recomendação de auditoria técnica do TSE). Nunca confunda ou priorize "Despesas Pagas" sobre as contratadas.
- Analise a eficiência financeira (Custo por Voto = Despesas Contratadas / Total Votos).
- Aponte partidos mais eficientes ou com maior concentração de gastos.
- Analise potenciais anomalias ou concentrações nos maiores fornecedores.

Abaixo estão os dados dos candidatos (ordenados por maior Despesa Contratada):
\n`;

    stats.forEach((cand, i) => {
      const costPerVote = cand.total_votos > 0 ? (cand.despesas_contratadas / cand.total_votos).toFixed(2) : "0.00";
      prompt += `${i + 1}. ${cand.nome_urna} (${cand.partido}):
   - Votos: ${cand.total_votos}
   - Receitas: R$ ${cand.total_receitas.toLocaleString("pt-BR")}
   - Despesas Contratadas (Valor Oficial): R$ ${cand.despesas_contratadas.toLocaleString("pt-BR")}
   - Despesas Pagas: R$ ${cand.despesas_pagas.toLocaleString("pt-BR")}
   - Custo por Voto: R$ ${costPerVote}
   - Maior Fornecedor: "${cand.maior_fornecedor_nome}" (R$ ${cand.maior_fornecedor_valor.toLocaleString("pt-BR")})
\n`;
    });

    prompt += `\nForneça uma análise aprofundada estruturada em Markdown, dividida nas seguintes seções:
1. **Panorama de Auditoria Financeira**: Resumo geral das despesas contratadas totais, médias de arrecadação e eficiência de gastos.
2. **Análise de Custo por Voto (Eficiência)**: Identificação de quem obteve a campanha mais barata e a mais cara por voto recebido.
3. **Auditoria de Fornecedores e Concentração**: Insights sobre os principais fornecedores e se há dependência ou riscos de cartel/superfaturamento de materiais de impressão/propaganda no DF.
4. **Recomendações e Conclusões**: Ações de monitoramento social para o portal do cidadão ou controle fiscal.`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        analysis: `⚠️ **Chave do Gemini API não configurada.** 
        Esta é uma análise gerada de forma offline devido à falta de chave:
        
        * **Total de Candidatos Analisados:** ${stats.length}
        * **Campanha com maior Despesa Contratada:** ${stats[0].nome_urna} (${stats[0].partido}) - R$ ${stats[0].despesas_contratadas.toLocaleString("pt-BR")}
        * **Campanha com menor Despesa Contratada:** ${stats[stats.length - 1].nome_urna} (${stats[stats.length - 1].partido}) - R$ ${stats[stats.length - 1].despesas_contratadas.toLocaleString("pt-BR")}
        
        *Insira sua CHAVE_GEMINI no painel Secrets do AI Studio para ativar as análises completas por Inteligência Artificial!*`
      });
    }

    const response = await generateContentWithFallback({
      contents: prompt,
    });

    res.json({ analysis: response.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Interfaces for Campanha 2026 Endpoint
interface CampaignPost2026 {
  platform: string;
  time: string;
  text: string;
  likes: number;
  comments: number;
  engagement: string;
}

interface CampaignPersuasion2026 {
  ageGroup: string;
  focus: string;
  suggestion: string;
}

interface CampaignDemanda2026 {
  ra: string;
  dor: string;
  diretriz: string;
  urgencia: string;
}

interface LocalCandidateData2026 {
  posts: CampaignPost2026[];
  persuasion: CampaignPersuasion2026;
  demandas: CampaignDemanda2026[];
}

interface CsvRow2026 {
  candidato_id: string;
  nome_urna: string;
  partido: string;
  situacao_2026: string;
  cargo_pretendido: string;
  gargalo_redes: string;
  foco_persuasao: string;
  urgencia_demandas: string;
  insights_politicos: string;
}

// Custom CSV Parser for robust multi-line field support with quote escaping
function parseCsv2026(csvText: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentCell.trim());
      currentCell = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentCell.trim());
      if (row.length > 0 && (row.length > 1 || row[0] !== "")) {
        lines.push(row);
      }
      row = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }
  if (currentCell || row.length > 0) {
    row.push(currentCell.trim());
    lines.push(row);
  }
  return lines;
}

// Core electoral metadata and strategies matching regional administrative areas
const candidateLocalData: Record<string, LocalCandidateData2026> = {
  "fabiofelix": {
    posts: [
      { platform: "Instagram", time: "2 horas", text: "Estivemos na UPA de Ceilândia cobrando mais médicos pediatras. A saúde pública precisa de atenção urgente!", likes: 2450, comments: 189, engagement: "8.4%" },
    ],
    persuasion: {
      ageGroup: "16-24",
      focus: "Enfoque em pautas de diversidade, fomento à cultura urbana e defesa da universidade pública.",
      suggestion: "Crie um reels interativo mostrando os bastidores da fiscalização nas UPAs de Brasília, usando legendas dinâmicas e trilha sonora urbana acelerada."
    },
    demandas: [
      { ra: "Samambaia", dor: "Falta de iluminação pública e insegurança perto de faculdades à noite.", diretriz: "Propor emendas de infraestrutura urbana focada em segurança nos trajetos acadêmicos.", urgencia: "CRÍTICA" },
      { ra: "Ceilândia", dor: "Tempo de espera excessivo na UPA local para consultas gerais.", diretriz: "Articulação de frentes parlamentares de auditoria de atendimento de saúde nas UPAs.", urgencia: "CRÍTICA" },
      { ra: "Planaltina", dor: "Falta de espaços de cultura e lazer para a juventude da periferia.", diretriz: "Destinação de recursos de emendas para implantação de Centros Culturais Comunitários.", urgencia: "ALTA" }
    ]
  },
  "chicovigilante": {
    posts: [
      { platform: "Instagram", time: "2 horas", text: "Fiscalizando as obras de infraestrutura em Taguatinga. O asfalto está chegando mas precisamos de drenagem pluvial!", likes: 1540, comments: 98, engagement: "4.8%" },
    ],
    persuasion: {
      ageGroup: "16-24",
      focus: "Foco em cursos de capacitação técnica, emprego jovem e o papel do Estado na economia.",
      suggestion: "Vídeo curto explicando os direitos de motoristas e entregadores de aplicativo, com linguagem acessível, direta e sem jargões sindicais."
    },
    demandas: [
      { ra: "Taguatinga", dor: "Inundações frequentes no centro durante as chuvas devido a galerias antigas.", diretriz: "Destinar emenda parlamentar para obras urgentes de microdrenagem de águas pluviais.", urgencia: "CRÍTICA" },
      { ra: "Recanto das Emas", dor: "Escassez de linhas de ônibus diretas para o Plano Piloto em horários de pico.", diretriz: "Audiência pública com a Secretaria de Transporte para readequação de frotas e horários.", urgencia: "ALTA" },
      { ra: "Ceilândia", dor: "Falta de policiamento preventivo nas paradas de ônibus periféricas.", diretriz: "Indicação parlamentar para instalação de postos comunitários móveis da PMDF.", urgencia: "ALTA" }
    ]
  },
  "maxmaciel": {
    posts: [
      { platform: "Instagram", time: "2 horas", text: "Mais um encontro do 'Gabinete na Quebrada' em Ceilândia! A cultura e o esporte salvam vidas e geram oportunidades.", likes: 2980, comments: 215, engagement: "9.2%" },
    ],
    persuasion: {
      ageGroup: "16-24",
      focus: "Enfoque na cultura hip-hop, economia criativa e ciclovias integradas.",
      suggestion: "Reels em formato de vlog dinâmico acompanhando uma batalha de rima na Praça do Cidadão, conectando cultura periférica com emendas parlamentares reais."
    },
    demandas: [
      { ra: "Sol Nascente", dor: "Falta de asfalto e calçadas acessíveis nas proximidades do trecho II do Sol Nascente.", diretriz: "Fiscalizar verbas do PAC destinadas ao DF e propor emendas para pavimentação imediata.", urgencia: "CRÍTICA" },
      { ra: "Guará", dor: "Degradação ambiental e falta de manutenção nos parques urbanos locais.", diretriz: "Articulação de emenda parlamentar de preservação e revitalização do Parque do Guará.", urgencia: "MÉDIA" },
      { ra: "Ceilândia", dor: "Poucos centros de treinamento esportivo gratuitos para jovens de periferia.", diretriz: "Destinação de recursos para escolinhas esportivas comunitárias integradas.", urgencia: "ALTA" }
    ]
  },
  "roberionegreiros": {
    posts: [
      { platform: "Instagram", time: "2 horas", text: "Apresentamos hoje o projeto que cria incentivos fiscais para jovens empreendedores abrirem negócios no DF!", likes: 980, comments: 45, engagement: "3.2%" },
    ],
    persuasion: {
      ageGroup: "16-24",
      focus: "Foco no empreendedorismo tecnológico, startups, capacitação em TI e redução da burocracia estatal.",
      suggestion: "Carrossel interativo no Instagram mostrando o passo a passo simplificado para abrir um MEI no DF com apoio de emendas de fomento à inovação."
    },
    demandas: [
      { ra: "Lago Sul", dor: "Aumento de pequenos furtos em residências e comércios locais à noite.", diretriz: "Instalação de câmeras inteligentes de segurança integradas e solicitação de reforço de patrulha PMDF.", urgencia: "ALTA" },
      { ra: "Sudoeste", dor: "Congestionamento intenso nos acessos e rotatórias nos horários de pico escolares.", diretriz: "Estudo de engenharia de tráfego com o DETRAN-DF para rotas de fluxo alternativo.", urgencia: "MÉDIA" },
      { ra: "Águas Claras", dor: "Falta de áreas verdes estruturadas e lixeiras de descarte seletivo adequadas.", diretriz: "Proposta de emendas para revitalização de praças públicas com lixeiras de coleta inteligente.", urgencia: "MÉDIA" }
    ]
  },
  "eduardopedrosa": {
    posts: [
      { platform: "Instagram", time: "2 horas", text: "Visitando o Hospital de Apoio de Brasília. Vamos ampliar as emendas para o tratamento de oncologia infantil!", likes: 1750, comments: 92, engagement: "6.1%" },
    ],
    persuasion: {
      ageGroup: "16-24",
      focus: "Discussão sobre inovação no ensino de tecnologia e programas de bolsas estudantis técnicas.",
      suggestion: "Vídeo estilo 'explainer' detalhando o projeto de emendas para tratamento de oncologia e ampliação de leitos pediátricos, focado em divulgação social."
    },
    demandas: [
      { ra: "Sobradinho", dor: "Erosão de solo e falta de asfalto em condomínios em processo de regularização.", diretriz: "Articular com a Terracap celeridade nas licenças de infraestrutura urbana e drenagem profunda.", urgencia: "CRÍTICA" },
      { ra: "Planaltina", dor: "Carência de leitos de UTI infantil no Hospital Regional de Planaltina.", diretriz: "Destinação de emenda impositiva específica para equipar nova ala pediátrica com leitos especializados.", urgencia: "CRÍTICA" },
      { ra: "Fercal", dor: "Problemas recorrentes com poeira e poços artesianos irregulares na comunidade.", diretriz: "Indicação parlamentar para ligação de rede hídrica da CAESB e fomento à pavimentação asfáltica.", urgencia: "ALTA" }
    ]
  },
  "dayseamarilio": {
    posts: [
      { platform: "Instagram", time: "2 horas", text: "Defendemos hoje a convocação imediata de todos os enfermeiros e técnicos aprovados no concurso da SES-DF!", likes: 3200, comments: 412, engagement: "11.5%" },
    ],
    persuasion: {
      ageGroup: "16-24",
      focus: "Conscientização sobre saúde mental, canais de escuta escolar e prevenção à ansiedade juvenil.",
      suggestion: "Postagens de acolhimento e reels explicativos sobre redes de apoio psicológico gratuito na universidade e escolas, com design humanizado."
    },
    demandas: [
      { ra: "Guará", dor: "Dificuldade de agendamento de consultas básicas e exames na UBS local.", diretriz: "Destinar recursos de emenda parlamentar para informatização e atendimento eletrônico na UBS do Guará.", urgencia: "ALTA" },
      { ra: "Ceilândia", dor: "Falta de profissionais especializados em saúde da mulher e exames preventivos.", diretriz: "Propor mutirão de exames ginecológicos preventivos (Carreta da Mulher) em regiões vulneráveis do Sol Nascente.", urgencia: "CRÍTICA" },
      { ra: "São Sebastião", dor: "Dificuldade de atendimento odontológico público de emergência fora do horário comercial.", diretriz: "Solicitação junto à SES de plantão odontológico estendido nas UPAs periféricas.", urgencia: "ALTA" }
    ]
  },
  "gabrielmagno": {
    posts: [
      { platform: "Instagram", time: "2 horas", text: "Inadmissível a falta de professores substitutos nas escolas públicas do DF. A educação de nossas crianças está em risco!", likes: 1980, comments: 204, engagement: "7.1%" },
    ],
    persuasion: {
      ageGroup: "16-24",
      focus: "Passe livre estudantil irrestrito, acesso à internet em ambientes públicos e cursinhos populares gratuitos.",
      suggestion: "Transmissão ao vivo ou reels enérgico denunciando os gargalos da educação básica e propondo a ampliação do passe livre estudantil integral."
    },
    demandas: [
      { ra: "Planaltina", dor: "Falta de manutenção predial crônica em escolas públicas históricas da região.", diretriz: "Criar emendas parlamentares específicas vinculadas à reforma de telhados, fiação e banheiros das escolas de Planaltina.", urgencia: "CRÍTICA" },
      { ra: "Paranoá", dor: "Falta de creches públicas para mães trabalhadoras que precisam deixar seus filhos.", diretriz: "Indicação parlamentar para convênios com creches locais e fomento à construção de novos CEIs.", urgencia: "CRÍTICA" },
      { ra: "Itapoã", dor: "Falta de cursinhos preparatórios gratuitos para o ENEM focados em estudantes da rede pública.", diretriz: "Destinação de emenda para financiamento de cursinho comunitário de preparação para o ENEM e PAS no Itapoã.", urgencia: "ALTA" }
    ]
  },
  "doutorajane": {
    posts: [
      { platform: "Instagram", time: "2 horas", text: "Reunião de trabalho com as mulheres de São Sebastião. Nosso projeto de capacitação profissional e autonomia financeira já mudou vidas!", likes: 1250, comments: 74, engagement: "4.1%" },
    ],
    persuasion: {
      ageGroup: "16-24",
      focus: "Prevenção à violência doméstica, canais de denúncia segura e formação profissional digital.",
      suggestion: "Vídeo tutorial de 45 segundos demonstrando como utilizar canais de denúncia sigilosa contra a violência de gênero, com tom acolhedor e informativo."
    },
    demandas: [
      { ra: "São Sebastião", dor: "Atraso no atendimento do CRAS e falta de servidores para agilizar cadastros assistenciais.", diretriz: "Articulação junto à SEDES para abertura de concurso público emergencial de assistentes sociais.", urgencia: "CRÍTICA" },
      { ra: "Santa Maria", dor: "Ocorrência de casos de violência doméstica e falta de acolhimento especializado imediato.", diretriz: "Propor implantação de uma Delegacia Especializada de Atendimento à Mulher (DEAM) de plantão 24h na região sul.", urgencia: "CRÍTICA" },
      { ra: "Gama", dor: "Estradas de terra precárias ligando assentamentos agrícolas à área de comércio central.", diretriz: "Emendas impositivas para encascalhamento e asfalto frio em trechos rurais integrados ao Gama.", urgencia: "ALTA" }
    ]
  },
  "hermeto": {
    posts: [
      { platform: "Instagram", time: "2 horas", text: "Trabalhando firme pela segurança pública! Propomos o aumento do efetivo policial e reestruturação de delegacias.", likes: 1450, comments: 94, engagement: "5.4%" },
    ],
    persuasion: {
      ageGroup: "16-24",
      focus: "Acesso facilitado a complexos esportivos, internet wifi livre e parcerias de primeiro emprego.",
      suggestion: "Reels curto mostrando a revitalização das quadras poliesportivas e arenas de areia, incentivando a prática esportiva juvenil como prevenção social."
    },
    demandas: [
      { ra: "Candangolândia", dor: "Aumento nos índices de criminalidade urbana no comércio e imediações do metrô.", diretriz: "Criação de canais de vigilância interligados e ampliação da ronda ostensiva militar do batalhão local.", urgencia: "ALTA" },
      { ra: "Vila Telebrasília", dor: "Vias residenciais de tráfego estreito gerando colisões de trânsito.", diretriz: "Estudo de viabilidade de sinalização horizontal de mão única e desvios de estacionamento.", urgencia: "MÉDIA" },
      { ra: "Guará", dor: "Iluminação pública falha em becos residenciais tradicionais.", diretriz: "Encaminhar pedido urgente à CEB Iluminação para troca imediata para lâmpadas de LED modernas de alto fluxo.", urgencia: "ALTA" }
    ]
  },
  "default": {
    posts: [
      { platform: "Instagram", time: "2 horas", text: "Trabalhando firme pela segurança pública e desenvolvimento do Distrito Federal! Nosso compromisso com as RAs é inegociável.", likes: 1100, comments: 75, engagement: "5.1%" }
    ],
    persuasion: {
      ageGroup: "16-24",
      focus: "Discurso aberto focado em geração de empregos técnicos e infraestrutura de lazer nas RAs.",
      suggestion: "Vídeo curto prestando contas de emendas locais e chamando a comunidade para debater melhorias públicas."
    },
    demandas: [
      { ra: "Ceilândia", dor: "Dificuldades de infraestrutura urbana local e iluminação pública.", diretriz: "Criação de projetos locais de emendas para melhorias nos acessos residenciais.", urgencia: "ALTA" },
      { ra: "Samambaia", dor: "Falta de segurança preventiva em áreas comerciais periféricas.", diretriz: "Indicação de ampliação de monitoramento por câmeras e rondas preventivas.", urgencia: "MÉDIA" },
      { ra: "Planaltina", dor: "Carência de espaços comunitários esportivos modernos.", diretriz: "Articulação de emendas destinadas a reformas de campos e quadras de esporte.", urgencia: "ALTA" }
    ]
  }
};

// GET /api/campanhas-2026/:candidatoId
app.get("/api/campanhas-2026/:candidatoId", async (req, res) => {
  try {
    const { candidatoId } = req.params;
    let nomeUrna = "";
    let dbCandidate: any = null;

    // Helper to normalize strings for flexible map/dictionary lookup
    const normalizeKey = (name: string): string => {
      if (!name) return "";
      return name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .trim();
    };

    const idNum = parseInt(candidatoId, 10);
    if (!isNaN(idNum)) {
      // Pre-defined ID mapping for 2026 candidates
      const idToNameMap: Record<number, string> = {
        20261: "Fábio Felix",
        20262: "Chico Vigilante",
        20263: "Max Maciel",
        20264: "Robério Negreiros",
        20265: "Eduardo Pedrosa",
        20266: "Dayse Amarilio",
        20267: "Gabriel Magno",
        20268: "Doutora Jane",
        20269: "Hermeto"
      };

      if (idToNameMap[idNum]) {
        nomeUrna = idToNameMap[idNum];
      } else {
        // Fallback: look up in database Candidatos table to resolve previous-year candidate links
        try {
          dbCandidate = await dbGet("SELECT nome_urna FROM Candidatos WHERE id_candidato = ?", [idNum]);
          if (dbCandidate) {
            nomeUrna = dbCandidate.nome_urna;
          }
        } catch (dbErr) {
          console.error("Database lookup error in /api/campanhas-2026:", dbErr);
        }
      }
    } else {
      // It's a string, use directly (e.g. name alias or name slug)
      nomeUrna = candidatoId;
    }

    const normName = normalizeKey(nomeUrna);

    // Read and parse status_varredura_deputados_2026.csv to execute tiered matching & political insights crossing
    const csvPath = path.join(process.cwd(), "status_varredura_deputados_2026.csv");
    let csvRows: CsvRow2026[] = [];

    if (fs.existsSync(csvPath)) {
      try {
        const csvContent = fs.readFileSync(csvPath, "utf-8");
        const parsed = parseCsv2026(csvContent);
        if (parsed.length > 0) {
          const headers = parsed[0];
          for (let i = 1; i < parsed.length; i++) {
            const row = parsed[i];
            if (row.length < headers.length) continue;
            const obj: any = {};
            headers.forEach((h, index) => {
              obj[h.trim()] = row[index];
            });
            csvRows.push(obj as CsvRow2026);
          }
        }
      } catch (csvErr) {
        console.error("Error reading or parsing status_varredura_deputados_2026.csv:", csvErr);
      }
    }

    // Tiered match in CSV: match by ID or by normalized name
    const csvRow = csvRows.find(row => {
      if (row.candidato_id === candidatoId) return true;
      const csvNormName = normalizeKey(row.nome_urna);
      if (csvNormName === normName) return true;
      return false;
    });

    const localData = candidateLocalData[normName] || candidateLocalData["default"];
    const matchedPost = localData.posts[0];

    // Build perfect responsive schema matching the Gabinete IA campaign panel design (image_6542f4.png)
    const responseData = {
      scraping_redes: {
        plataforma: matchedPost.platform,
        tempo: matchedPost.time,
        ultimo_post: matchedPost.text,
        likes: matchedPost.likes,
        comentarios: matchedPost.comments,
        engajamento: matchedPost.engagement
      },
      assistente_persuasao: {
        faixa_etaria: localData.persuasion.ageGroup,
        foco_linguagem: csvRow ? `${csvRow.foco_persuasao} | ${localData.persuasion.focus}` : localData.persuasion.focus,
        sugestao_conteudo: csvRow 
          ? `${localData.persuasion.suggestion}\n\n[Insights Gabinete IA - Estratégia de ${csvRow.situacao_2026.toUpperCase()} - ${csvRow.cargo_pretendido}]: ${csvRow.insights_politicos}` 
          : localData.persuasion.suggestion
      },
      mapeamento_demandas: localData.demandas.map(d => ({
        regiao_administrativa: d.ra,
        ponto_de_dor: d.dor,
        diretriz_recomendada: d.diretriz,
        urgencia: csvRow ? (csvRow.urgencia_demandas.toUpperCase() === "CRÍTICA" ? "CRÍTICA" : csvRow.urgencia_demandas.toUpperCase()) : d.urgencia
      }))
    };

    // Embed crossed details if matched in status_varredura_deputados_2026.csv
    if (csvRow) {
      Object.assign(responseData, {
        cruzamento_politico: {
          situacao_2026: csvRow.situacao_2026,
          cargo_pretendido: csvRow.cargo_pretendido,
          gargalo_redes: csvRow.gargalo_redes,
          foco_persuasao: csvRow.foco_persuasao,
          insights_politicos: csvRow.insights_politicos
        }
      });
    }

    res.json(responseData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. "Oráculo" AI Consulting - Dynamic retrieval augmented political consultant
const handleOraculoChat = async (req: express.Request, res: express.Response) => {
  try {
    // 2. Captura do Prompt
    const promptText = req.body.message || req.body.question;
    const historico = req.body.historico || [];

    if (!promptText) {
      return res.status(400).json({ error: "A pergunta ou mensagem é obrigatória" });
    }

    // 1. Validação da API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Erro: GEMINI_API_KEY não definida nas variáveis de ambiente.");
      return res.status(500).json({
        error: "Erro: GEMINI_API_KEY não definida nas variáveis de ambiente.",
        message: "A chave da API Gemini não foi configurada no servidor.",
        answer: "⚠️ **Chave Gemini API não configurada.** O Oráculo está temporariamente indisponível. Por favor, configure a variável de ambiente GEMINI_API_KEY no painel de segredos do AI Studio."
      });
    }

    // Retrieve full context from the SQLite database
    let contextText = "";
    try {
      const allCandidates = await dbAll(`
        SELECT 
          c.nome_urna, c.partido, c.ano_eleicao, c.total_votos, c.situacao,
          rf.total_receitas, rf.despesas_contratadas, rf.despesas_pagas,
          rf.maior_fornecedor_nome, rf.maior_fornecedor_valor
        FROM Candidatos c
        JOIN Resumo_Financeiro rf ON c.id_candidato = rf.id_candidato
      `);

      const zonesData = await dbAll(`
        SELECT c.nome_urna, gv.ra_nome, gv.votos
        FROM Geoeleitoral_Votos gv
        JOIN Candidatos c ON gv.id_candidato = c.id_candidato
      `);

      // Prepare a compact text summary of the database for RAG context
      contextText = "DADOS DAS ELEIÇÕES DA CLDF (DISTRITAIS) DISPONÍVEIS NO BANCO:\n";
      allCandidates.forEach(cand => {
        contextText += `- Deputado ${cand.nome_urna} (${cand.partido}), Ano: ${cand.ano_eleicao}, Votos Totais: ${cand.total_votos}, Receitas: R$${cand.total_receitas}, Despesas Contratadas: R$${cand.despesas_contratadas}, Despesas Pagas: R$${cand.despesas_pagas}, Maior Fornecedor: "${cand.maior_fornecedor_nome}" (R$${cand.maior_fornecedor_valor})\n`;
      });

      contextText += "\nDISTRIBUIÇÃO PRINCIPAL DE VOTOS GEOELEITORAIS POR REGIÃO ADMINISTRATIVA (RA):\n";
      const votesByCandAndRA: Record<string, string[]> = {};
      zonesData.forEach(v => {
        if (!votesByCandAndRA[v.nome_urna]) votesByCandAndRA[v.nome_urna] = [];
        votesByCandAndRA[v.nome_urna].push(`${v.ra_nome}: ${v.votos} votos`);
      });
      for (const [name, array] of Object.entries(votesByCandAndRA)) {
        contextText += `- ${name}: ${array.slice(0, 4).join(", ")}\n`;
      }
    } catch (dbErr: any) {
      console.warn("Aviso: Falha ao ler dados de candidatos do SQLite para o contexto:", dbErr.message);
    }

    // 3. Configuração do Modelo: systemInstruction para estrategista político sênior do Distrito Federal
    const systemInstruction = `Você é o "Oráculo do Gabinete IA", um consultor político sênior e estrategista de dados especialista na Câmara Legislativa do Distrito Federal (CLDF).
Seu objetivo é responder perguntas de forma altamente analítica, estratégica, precisa e em português, usando o contexto fornecido abaixo (representando a base de dados SQLite consolidada de candidaturas distritais de 2014, 2018 e 2022) e considerando o histórico da conversa quando aplicável.

Diretrizes Críticas de Resposta:
1. Sempre priorize o valor das "Despesas Contratadas" como o gasto oficial e legal do candidato para análises financeiras e de custo por voto. Mencione isso de forma clara caso o usuário pergunte sobre gastos.
2. Seja objetivo, pragmático e estratégico. Use formatação Markdown elegante com tabelas ou tópicos sempre que facilitar a leitura.
3. Caso a resposta necessite de cálculos simples (como somas, médias de gastos por partido, custos por voto), realize-os com base nos dados fornecidos e exiba os passos ou resultados de forma transparente.
4. Se o usuário fizer perguntas que não podem ser respondidas com os dados fornecidos ou fora do escopo, responda elegantemente informando os limites do seu escopo e oriente o usuário de forma construtiva.

Aqui está o contexto extraído em tempo real do banco SQLite:
${contextText}`;

    // Construct contents array with history
    const contents: any[] = [];
    if (Array.isArray(historico)) {
      historico.forEach((msg: any) => {
        const role = (msg.role === "user" || msg.sender === "user") ? "user" : "model";
        const text = msg.text || msg.message || (msg.parts && msg.parts[0]?.text);
        if (text) {
          contents.push({
            role: role,
            parts: [{ text: text }]
          });
        }
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: promptText }]
    });

    // 4. Resiliência e Logs Robustos
    // Initialize GoogleGenAI SDK client with the verified environment API key
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    // Invoke Gemini model with fallback strategy (using modern generateContent method as per the official SDK)
    let responseText = "";
    try {
      console.log(`[Oráculo] Enviando prompt para gemini-3.5-flash com ${contents.length} mensagens...`);
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2, // Low temperature for high factual accuracy
        }
      });
      responseText = response.text || "";
    } catch (apiErr: any) {
      console.warn(`[Oráculo] Erro com modelo principal gemini-3.5-flash (${apiErr.message}). Tentando fallback para gemini-flash-latest...`);
      try {
        const response = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.2,
          }
        });
        responseText = response.text || "";
      } catch (fallbackErr: any) {
        console.error(`[Oráculo] Erro fatal: modelo de fallback gemini-flash-latest também falhou: ${fallbackErr.message}`);
        throw fallbackErr; // Propagate to outer try/catch for standard 500 response
      }
    }

    res.json({ answer: responseText });
  } catch (err: any) {
    // 4. Resiliência e Logs
    console.error(`Erro ao obter respostas do Oráculo no backend (Google Gen AI API Falhou): ${err.message}`);
    if (err.stack) {
      console.error(err.stack);
    }
    res.status(500).json({
      error: "Desculpe, ocorreu um erro ao obter respostas do Oráculo.",
      message: err.message
    });
  }
};

app.post("/api/oraculo", handleOraculoChat);
app.post("/api/chat", handleOraculoChat);

// 5. Import candidates and financial records from Google Sheets spreadsheet
app.post("/api/importar_candidatos", async (req, res) => {
  try {
    const { candidates } = req.body;

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: "Nenhum candidato enviado para importação" });
    }

    let importedCount = 0;

    for (const cand of candidates) {
      // Validate minimum required fields
      if (!cand.nome_urna || !cand.partido || !cand.ano_eleicao) {
        continue;
      }

      const totalVotos = parseInt(cand.total_votos, 10) || 0;
      const receitas = parseFloat(cand.total_receitas) || 0;
      const despesasContratadas = parseFloat(cand.despesas_contratadas) || 0;
      const despesasPagas = parseFloat(cand.despesas_pagas) || 0;
      const maiorFornecedorNome = cand.maior_fornecedor_nome || "Não Informado";
      const maiorFornecedorValor = parseFloat(cand.maior_fornecedor_valor) || 0;
      const detalheDespesas = cand.detalhe_despesas ? JSON.stringify(cand.detalhe_despesas) : JSON.stringify([]);

      // Insert candidate
      const candId = await new Promise<number>((resolve, reject) => {
        db.run(
          `INSERT INTO Candidatos (nome_urna, nome_completo, partido, ano_eleicao, total_votos, foto_url, cargo, situacao)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cand.nome_urna,
            cand.nome_completo || cand.nome_urna,
            cand.partido,
            parseInt(cand.ano_eleicao, 10),
            totalVotos,
            cand.foto_url || "",
            cand.cargo || "Deputado Distrital",
            cand.situacao || "Eleito"
          ],
          function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      // Insert financial summary
      await dbRun(
        `INSERT INTO Resumo_Financeiro (id_candidato, total_receitas, despesas_contratadas, despesas_pagas, maior_fornecedor_nome, maior_fornecedor_valor, detalhe_despesas)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          candId,
          receitas,
          despesasContratadas,
          despesasPagas,
          maiorFornecedorNome,
          maiorFornecedorValor,
          detalheDespesas
        ]
      );

      importedCount++;
    }

    res.json({ success: true, imported_count: importedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper functions for candidate matching
function cleanString(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getAliasMatch(sheetName: string): string | null {
  const clean = cleanString(sheetName);
  if (clean === "JOAO ALVES CARDOSO") return "JOAO CARDOSO PROFESSOR AUDITOR";
  if (clean === "JORGE VIANA DE SOUSA") return "JORGE VIANNA";
  if (clean === "PEDRO PAULO DE OLIVEIRA") return "PEPA";
  if (clean === "CHRISTIANNO NOGUEIRA ARAUJO") return "CRISTIANO ARAUJO";
  if (clean === "FRANCISCO LEITE DE OLIVEIRA") return "CHICO LEITE";
  return null;
}

function findCandidate(
  candidates: { id_candidato: number; nome_urna: string; nome_completo: string | null; ano_eleicao: number }[],
  sheetName: string,
  year: number
): { id_candidato: number; nome_urna: string } | null {
  const cleanSheet = cleanString(sheetName);

  // Overrides first
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

  // Tier 1: Exact matches
  for (const cand of candidates) {
    if (cand.ano_eleicao !== year) continue;
    const cleanCompleto = cleanString(cand.nome_completo || "");
    const cleanUrna = cleanString(cand.nome_urna);
    if (cleanCompleto === cleanSheet || cleanUrna === cleanSheet) {
      return cand;
    }
  }

  // Tier 2: Part-of / Inclusion
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

  // Tier 3: Word overlap
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

// 5b. Import detailed Geoelectoral voting results from Google Sheets
app.post("/api/importar_geoeleitoral", async (req, res) => {
  try {
    const { rows, ano } = req.body;
    const year = parseInt(ano, 10) || 2022;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "Nenhum dado geoeleitoral enviado" });
    }

    // Step 1: Strict Grouping in Memory (Composite Key: [NOME_CANDIDATO + ANO + ZONA + LOCALIDADE_RA])
    interface GroupedVote {
      sheetName: string;
      ano: number;
      zona: number;
      ra: string;
      votos: number;
    }

    const groupedVotes = new Map<string, GroupedVote>();

    for (const r of rows) {
      const sheetName = r.nome_urna || r.nome_completo || "";
      const ra = r.ra_nome || r.ra || "Não Informado";
      const zona = parseInt(r.zona_eleitoral || r.zona, 10) || 0;
      const votos = parseInt(r.votos, 10) || 0;

      if (!sheetName) continue;

      const cleanSheetName = cleanString(sheetName);
      const cleanRA = cleanString(ra);
      const compositeKey = `${cleanSheetName}#${year}#${zona}#${cleanRA}`;

      if (groupedVotes.has(compositeKey)) {
        const existing = groupedVotes.get(compositeKey)!;
        existing.votos += votos;
      } else {
        groupedVotes.set(compositeKey, {
          sheetName,
          ano: year,
          zona,
          ra,
          votos
        });
      }
    }

    // Load candidates cache for the specific year
    const dbCandidates = await dbAll(
      "SELECT id_candidato, nome_urna, nome_completo, ano_eleicao, total_votos FROM Candidatos WHERE ano_eleicao = ?",
      [year]
    );

    // Track candidate vote totals dynamically
    const candidateNewTotals = new Map<number, number>();
    const newlyCreatedCandidates = new Map<string, number>();

    // Open transaction for safe and atomic upserts
    await dbRun("BEGIN TRANSACTION;");

    try {
      // Clear geoelectoral votes only for candidates of this specific election year to prevent residual duplicate votes
      await dbRun(
        "DELETE FROM Geoeleitoral_Votos WHERE id_candidato IN (SELECT id_candidato FROM Candidatos WHERE ano_eleicao = ?)",
        [year]
      );

      let votesRowsImported = 0;

      for (const [key, item] of groupedVotes.entries()) {
        const cleanName = cleanString(item.sheetName);
        let candId: number | null = null;

        // Try matching in existing DB candidates
        const matched = findCandidate(dbCandidates, item.sheetName, year);
        if (matched) {
          candId = matched.id_candidato;
        } else if (newlyCreatedCandidates.has(cleanName)) {
          candId = newlyCreatedCandidates.get(cleanName)!;
        } else {
          // Create new candidate in transaction
          const insertResult = await new Promise<any>((resolve, reject) => {
            db.run(
              `INSERT INTO Candidatos (nome_urna, nome_completo, partido, ano_eleicao, total_votos, cargo, situacao)
               VALUES (?, ?, ?, ?, 0, 'Deputado Distrital', 'Eleito')`,
              [item.sheetName, item.sheetName, "S/P", year],
              function (err) {
                if (err) reject(err);
                else resolve(this);
              }
            );
          });
          candId = insertResult.lastID;
          newlyCreatedCandidates.set(cleanName, candId);

          // Create matching financial record for consistency
          await dbRun(
            `INSERT INTO Resumo_Financeiro (id_candidato, total_receitas, despesas_contratadas, despesas_pagas, maior_fornecedor_nome, maior_fornecedor_valor, detalhe_despesas)
             VALUES (?, 0, 0, 0, 'Não Informado', 0, '[]')`,
            [candId]
          );
        }

        // Accumulate new total votes in memory
        const currentSum = candidateNewTotals.get(candId) || 0;
        candidateNewTotals.set(candId, currentSum + item.votos);

        // Insert detailed geoelectoral vote
        await dbRun(
          "INSERT INTO Geoeleitoral_Votos (id_candidato, zona_eleitoral, ra_nome, votos) VALUES (?, ?, ?, ?)",
          [candId, item.zona, item.ra, item.votos]
        );
        votesRowsImported++;
      }

      // Synchronize Candidatos.total_votos with the newly accumulated exact sums
      for (const [candId, newTotal] of candidateNewTotals.entries()) {
        await dbRun(
          "UPDATE Candidatos SET total_votos = ? WHERE id_candidato = ?",
          [newTotal, candId]
        );
      }

      await dbRun("COMMIT;");

      res.json({
        success: true,
        candidates_count: candidateNewTotals.size,
        votes_rows_count: votesRowsImported
      });

    } catch (txErr: any) {
      await dbRun("ROLLBACK;");
      throw txErr;
    }

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Setup Vite Dev Server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Initialize database with corruption safety before starting Express listener
ensureDatabaseInitialized().then(() => {
  startServer();
});
