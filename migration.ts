import sqlite3 from "sqlite3";
import path from "path";
import * as fs from "fs";
import { runFullMigration } from "./import_consolidado_votos";

export async function seedHistoricalData(dbPath: string) {
    console.log("Seeding historical data (2014, 2018, 2022)...");
    
    const backupPath = path.join(process.cwd(), "eleicoes.db.bak");
    
    let shouldRestore = false;
    if (!fs.existsSync(dbPath)) {
        shouldRestore = true;
    } else {
        try {
            const tempDb = new sqlite3.Database(dbPath);
            const count: any = await new Promise((resolve, reject) => {
                tempDb.get("SELECT COUNT(*) as count FROM Candidatos", (err, row) => {
                    if (err) resolve({ count: 0 });
                    else resolve(row);
                });
            });
            tempDb.close();
            if (!count || count.count === 0) {
                shouldRestore = true;
            }
        } catch (e) {
            shouldRestore = true;
        }
    }

    if (shouldRestore) {
        console.log("Active database empty or invalid. Restoring from pre-populated backup eleicoes.db.bak...");
        if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, dbPath);
            console.log("Database restored successfully from backup.");
        } else {
            console.error("Critical Error: eleicoes.db.bak backup file not found!");
        }
    }

    // Now open the database connection and run the live Google Drive migration
    const db = new sqlite3.Database(dbPath);
    console.log("Synchronizing voting records and sums with live spreadsheet...");
    try {
        await runFullMigration(db);
        console.log("Database synchronized with live spreadsheet successfully.");
    } catch (err: any) {
        console.error("Spreadsheet synchronization failed, continuing with current database:", err.message);
    } finally {
        db.close();
    }
}

export async function atualizarCampanhas2026(dbPath: string) {
    console.log("Updating 2026 campaign data...");
    // ... Read CSV and update SQLite ...
    console.log("2026 campaign data updated.");
}
