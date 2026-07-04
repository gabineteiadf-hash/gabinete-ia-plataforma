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
  const db = new sqlite3.Database('eleicoes.db');
  try {
    const candidates = await runQuery(db, `
      SELECT 
        c.id_candidato, c.nome_urna, c.ano_eleicao, c.total_votos,
        rf.id_candidato as has_financial, rf.total_receitas, rf.despesas_contratadas,
        SUM(g.votos) as geo_votes_sum
      FROM Candidatos c
      LEFT JOIN Resumo_Financeiro rf ON c.id_candidato = rf.id_candidato
      LEFT JOIN Geoeleitoral_Votos g ON c.id_candidato = g.id_candidato
      GROUP BY c.id_candidato
    `);

    console.log("Checking mismatches...");
    let issuesFound = 0;
    for (const c of candidates) {
      const geoSum = c.geo_votes_sum || 0;
      const totalVotos = c.total_votos || 0;
      const diff = Math.abs(totalVotos - geoSum);
      const missingFinancial = !c.has_financial;
      const zeroExpenses = !missingFinancial && c.despesas_contratadas === 0;

      if (diff > 0 || missingFinancial || zeroExpenses) {
        issuesFound++;
        console.log(`⚠️ Issue with ${c.nome_urna} (${c.ano_eleicao}) [ID: ${c.id_candidato}]:`);
        if (diff > 0) {
          console.log(`   - Vote mismatch: Candidate Total = ${totalVotos}, Geoelectoral Sum = ${geoSum} (Diff: ${diff})`);
        }
        if (missingFinancial) {
          console.log(`   - Missing financial summary in Resumo_Financeiro!`);
        }
        if (zeroExpenses) {
          console.log(`   - despesas_contratadas is 0! (Receitas: ${c.total_receitas})`);
        }
      }
    }

    if (issuesFound === 0) {
      console.log("✅ No mismatches or issues found! All candidates have financial summaries, correct vote counts, and matching geoelectoral sums.");
    } else {
      console.log(`Total candidates with issues: ${issuesFound}`);
    }

  } catch (err: any) {
    console.error("Error querying db:", err.message);
  } finally {
    db.close();
  }
}

main();
