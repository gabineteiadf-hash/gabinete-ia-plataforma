import sqlite3 from 'sqlite3';

function runQuery(db: sqlite3.Database, query: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function main() {
  // Wait a moment for server to finish initializing the database
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const db = new sqlite3.Database('eleicoes.db');
  try {
    const tables = await runQuery(db, "SELECT name FROM sqlite_master WHERE type='table'");
    console.log("Tables in database:", tables.map(t => t.name));

    const countCandidates = await runQuery(db, "SELECT COUNT(*) as count FROM Candidatos");
    console.log("Total candidates:", countCandidates[0].count);

    const candidatesByYear = await runQuery(db, "SELECT ano_eleicao, COUNT(*) as count FROM Candidatos GROUP BY ano_eleicao");
    console.log("Candidates by year:", candidatesByYear);

    const telma = await runQuery(db, "SELECT * FROM Candidatos WHERE nome_urna LIKE '%Telma%' OR nome_completo LIKE '%Telma%'");
    console.log("Telma candidates:", telma);

    if (telma.length > 0) {
      for (const t of telma) {
        const financial = await runQuery(db, "SELECT * FROM Resumo_Financeiro WHERE id_candidato = ?", [t.id_candidato]);
        console.log(`Financial for ${t.nome_urna} (${t.ano_eleicao}):`, financial);

        const votes = await runQuery(db, "SELECT * FROM Geoeleitoral_Votos WHERE id_candidato = ? LIMIT 5", [t.id_candidato]);
        console.log(`Geoeleitoral votes for ${t.nome_urna} (${t.ano_eleicao}):`, votes);

        const votesSum = await runQuery(db, "SELECT SUM(votos) as total FROM Geoeleitoral_Votos WHERE id_candidato = ?", [t.id_candidato]);
        console.log(`Sum of votes for ${t.nome_urna} (${t.ano_eleicao}):`, votesSum[0].total);
      }
    }
  } catch (err: any) {
    console.error("Error querying db:", err.message);
  } finally {
    db.close();
  }
}

main();
