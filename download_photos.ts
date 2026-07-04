import * as fs from "fs";
import * as path from "path";
import sqlite3 from "sqlite3";

const FOTOS_DIR = path.join(process.cwd(), "public", "assets", "fotos");

// Ensure the directory exists
if (!fs.existsSync(FOTOS_DIR)) {
  fs.mkdirSync(FOTOS_DIR, { recursive: true });
}

// Helper to convert full-size Wikimedia Commons image URLs to lightweight thumbnail URLs (which are not rate-limited)
function convertToThumbnailUrl(url: string, width: number = 500): string {
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
}

// Map of candidates we know have direct, verified Wikimedia URLs (which we convert to thumbnails on download)
const hardcodedUrls: Record<string, string> = {
  "fabio_felix": "https://upload.wikimedia.org/wikipedia/commons/e/e3/F%C3%A1bio_Felix_%2848943960132%29_%28cropped%29.jpg",
  "chico_vigilante": "https://upload.wikimedia.org/wikipedia/commons/e/ea/Chico_Vigilante_em_2019.jpg",
  "roberio_negreiros": "https://upload.wikimedia.org/wikipedia/commons/c/c5/Rob%C3%A9rio_Negreiros_em_2019.jpg",
  "daniel_donizet": "https://upload.wikimedia.org/wikipedia/commons/9/90/Daniel_Donizet_em_2019.jpg",
  "jorge_vianna": "https://upload.wikimedia.org/wikipedia/commons/0/07/Jorge_Vianna_em_2019.jpg",
  "jaqueline_silva": "https://upload.wikimedia.org/wikipedia/commons/f/fb/Jaqueline_Silva_em_2019.jpg",
  "eduardo_pedrosa": "https://upload.wikimedia.org/wikipedia/commons/7/75/Eduardo_Pedrosa_em_2019.jpg",
  "iolando": "https://upload.wikimedia.org/wikipedia/commons/1/1d/Iolando_em_2019.jpg",
  "martins_machado": "https://upload.wikimedia.org/wikipedia/commons/e/ec/Deputado_Martins_Machado.jpg",
  "hermeto": "https://upload.wikimedia.org/wikipedia/commons/a/ac/Deputado_Hermeto.jpg",
  "roosevelt_vilela": "https://upload.wikimedia.org/wikipedia/commons/b/ba/Roosevelt_Vilela_em_2019.jpg",
  "joao_cardoso_professor_auditor": "https://upload.wikimedia.org/wikipedia/commons/d/dd/Deputado_Jo%C3%A3o_Cardoso.jpg",
  "joao_cardoso": "https://upload.wikimedia.org/wikipedia/commons/d/dd/Deputado_Jo%C3%A3o_Cardoso.jpg",
  "professor_reginaldo_veras": "https://upload.wikimedia.org/wikipedia/commons/7/7d/Reginaldo_Veras_em_2019.jpg",
  "reginaldo_veras": "https://upload.wikimedia.org/wikipedia/commons/7/7d/Reginaldo_Veras_em_2019.jpg",
  "rafael_prudente": "https://upload.wikimedia.org/wikipedia/commons/1/13/Rafael_Prudente_em_2019.jpg",
  "delmasso": "https://upload.wikimedia.org/wikipedia/commons/e/ed/Rodrigo_Delmasso_em_2019.jpg",
  "agaciel_maia": "https://upload.wikimedia.org/wikipedia/commons/4/41/Agaciel_Maia_em_2019.jpg",
  "jose_gomes": "https://upload.wikimedia.org/wikipedia/commons/3/30/Deputado_Jos%C3%A9_Gomes.jpg",
  "arlete_sampaio": "https://upload.wikimedia.org/wikipedia/commons/2/29/Arlete_Sampaio_em_2019.jpg",
  "claudio_abrantes": "https://upload.wikimedia.org/wikipedia/commons/e/eb/Cl%C3%A1udio_Abrantes_em_2019.jpg",
  "valdelino_barcelos": "https://upload.wikimedia.org/wikipedia/commons/a/aa/Deputado_Valdelino_Barcelos.jpg",
  "julia_lucy": "https://upload.wikimedia.org/wikipedia/commons/d/df/J%C3%BAlia_Lucy_em_2019.jpg",
  "reginaldo_sardinha": "https://upload.wikimedia.org/wikipedia/commons/1/1c/Deputado_Reginaldo_Sardinha.jpg",
  "leandro_grass": "https://upload.wikimedia.org/wikipedia/commons/4/4b/Leandro_Grass_em_2019.jpg",
  "julio_cesar": "https://upload.wikimedia.org/wikipedia/commons/d/de/Deputado_Julio_Cesar.jpg",
  "professor_israel": "https://upload.wikimedia.org/wikipedia/commons/c/ca/Israel_Batista.jpg",
  "joe_valle": "https://upload.wikimedia.org/wikipedia/commons/c/cf/Joe_Valle.jpg",
  "sandra_faraj": "https://upload.wikimedia.org/wikipedia/commons/8/82/Sandra_Faraj.jpg",
  "celina_leao": "https://upload.wikimedia.org/wikipedia/commons/e/ec/Deputada_Celina_Le%C3%A3o.jpg",
  "delegado_fernando_fernandes": "https://upload.wikimedia.org/wikipedia/commons/e/ec/Delegado_Fernando_Fernandes.jpg",
  "luzia_de_paula": "https://upload.wikimedia.org/wikipedia/commons/6/6e/Luzia_de_Paula.jpg",
  "bispo_renato": "https://upload.wikimedia.org/wikipedia/commons/7/7b/Bispo_Renato.jpg",
  "max_maciel": "https://upload.wikimedia.org/wikipedia/commons/d/df/Max_Maciel_%28cropped%29.jpg",
  "paula_belmonte": "https://upload.wikimedia.org/wikipedia/commons/4/4b/Paula_Belmonte_em_junho_de_2019_%28cropped%29.jpg",
  "doutora_jane": "https://upload.wikimedia.org/wikipedia/commons/e/e0/Jane_Kl%C3%A9bia_em_2019_%28cropped%29.jpg",
  "doutorajane": "https://upload.wikimedia.org/wikipedia/commons/e/e0/Jane_Kl%C3%A9bia_em_2019_%28cropped%29.jpg",
  "gabriel_magno": "https://upload.wikimedia.org/wikipedia/commons/2/23/Gabriel_Magno_em_2023.jpg",
  "ricardo_vale": "https://upload.wikimedia.org/wikipedia/commons/b/b3/Ricardo_Vale.jpg",
  "wellington_luiz": "https://upload.wikimedia.org/wikipedia/commons/b/bd/Wellington_Luiz.jpg",
  "dayse_amarilio": "https://upload.wikimedia.org/wikipedia/commons/9/9d/Dayse_Amarilio.jpg"
};

// Helper to normalize the name matching CandidateAvatar's pattern
function normalizeWithUnderscores(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "") // keep alpha, num, spaces, underscores, hyphens
    .replace(/[\s-]+/g, "_") // replace spaces and hyphens with a single underscore
    .trim();
}

// Download image and save to file with browser user-agent
async function downloadImage(url: string, destPath: string): Promise<boolean> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  };
  
  const targetUrl = convertToThumbnailUrl(url, 500);
  try {
    const response = await fetch(targetUrl, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: status ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
    console.log(`Successfully downloaded: ${path.basename(destPath)}`);
    return true;
  } catch (err: any) {
    console.error(`Error downloading from ${targetUrl}: ${err.message}`);
    return false;
  }
}

// Search Wikipedia Pageimage via Summary REST API
async function searchWikipediaImage(name: string, fullName?: string): Promise<string | null> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  };
  const queries = [name];
  if (fullName && fullName !== name) {
    queries.push(fullName);
  }
  
  for (const query of queries) {
    try {
      console.log(`Searching Wikipedia for: "${query}"`);
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
        
        console.log(`Found Wikipedia article title: "${bestTitle}"`);
        // Fetch from high-performance Wikipedia summary endpoint
        const summaryUrl = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`;
        const summaryRes = await fetch(summaryUrl, { headers }).then(r => r.json() as any);
        
        if (summaryRes.thumbnail && summaryRes.thumbnail.source) {
          console.log(`Found summary thumbnail image: ${summaryRes.thumbnail.source}`);
          return summaryRes.thumbnail.source;
        } else if (summaryRes.originalimage && summaryRes.originalimage.source) {
          console.log(`Found summary original image: ${summaryRes.originalimage.source}`);
          return summaryRes.originalimage.source;
        }
      }
    } catch (err: any) {
      console.error(`Error fetching from Wikipedia API for "${query}": ${err.message}`);
    }
  }
  return null;
}

// Main execution
async function run() {
  console.log("Starting photos download script with dynamic thumbnail conversion...");
  
  const dbPath = path.join(process.cwd(), "eleicoes.db");
  const db = new sqlite3.Database(dbPath);
  
  const candidates: { nome_urna: string; nome_completo: string }[] = await new Promise((resolve, reject) => {
    db.all(
      "SELECT DISTINCT nome_urna, nome_completo FROM Candidatos", 
      (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
  
  db.close();
  
  console.log(`Found ${candidates.length} unique candidates in the database.`);
  
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  
  for (const cand of candidates) {
    const normalized = normalizeWithUnderscores(cand.nome_urna);
    const destFile = path.join(FOTOS_DIR, `${normalized}.jpg`);
    
    // Check if we already have this photo downloaded and it's not a tiny/empty file
    if (fs.existsSync(destFile) && fs.statSync(destFile).size > 1000) {
      console.log(`Photo for "${cand.nome_urna}" already exists. Skipping.`);
      skipCount++;
      continue;
    }
    
    let url: string | undefined = undefined;
    
    // 1. Try Wikipedia search first as it is most up-to-date and fetches thumbnails directly
    console.log(`Searching Wikipedia for dynamic photo for "${cand.nome_urna}"...`);
    url = await searchWikipediaImage(cand.nome_urna, cand.nome_completo) || undefined;
    
    // 2. Fall back to converted hardcoded URLs if search fails
    if (!url) {
      console.log(`Wikipedia search failed. Trying hardcoded URL for "${cand.nome_urna}"...`);
      url = hardcodedUrls[normalized];
      
      // Check aliases
      if (!url && normalized === "doutora_jane") {
        url = hardcodedUrls["doutorajane"];
      }
      if (!url && normalized === "joao_cardoso_professor_auditor") {
        url = hardcodedUrls["joao_cardoso"];
      }
      if (!url && normalized === "professor_reginaldo_veras") {
        url = hardcodedUrls["reginaldo_veras"];
      }
    }
    
    if (url) {
      console.log(`Downloading photo for "${cand.nome_urna}" from: ${url}`);
      const success = await downloadImage(url, destFile);
      if (success) {
        successCount++;
        // If there's an alias, copy it as well to prevent missing files
        if (normalized === "doutora_jane") {
          try { fs.copyFileSync(destFile, path.join(FOTOS_DIR, "doutorajane.jpg")); } catch (e) {}
        }
        if (normalized === "joao_cardoso_professor_auditor") {
          try { fs.copyFileSync(destFile, path.join(FOTOS_DIR, "joao_cardoso.jpg")); } catch (e) {}
        }
        if (normalized === "professor_reginaldo_veras") {
          try { fs.copyFileSync(destFile, path.join(FOTOS_DIR, "reginaldo_veras.jpg")); } catch (e) {}
        }
      } else {
        failCount++;
      }
    } else {
      console.warn(`Could not find any profile photo for "${cand.nome_urna}" (${cand.nome_completo}).`);
      failCount++;
    }
    
    // Wait slightly to be polite to Wikipedia API
    await new Promise(r => setTimeout(r, 150));
  }
  
  console.log("\n--- Download Summary ---");
  console.log(`Total checked: ${candidates.length}`);
  console.log(`Skipped (already exist): ${skipCount}`);
  console.log(`Successfully downloaded: ${successCount}`);
  console.log(`Failed / Not Found: ${failCount}`);
  console.log("------------------------\n");
}

run().catch(console.error);
