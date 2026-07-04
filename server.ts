import express from "express";
import path from "path";
import sqlite3 from "sqlite3";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
app.use(express.json());
app.use("/assets", express.static(path.join(process.cwd(), "public", "assets")));
app.use("/fotos", express.static(path.join(process.cwd(), "public", "assets", "fotos")));

const PORT = 3000;

// Setup SQLite Database
const dbPath = path.join(process.cwd(), "eleicoes.db");
const db = new sqlite3.Database(dbPath);

// Prevent database locked errors under concurrent requests
db.run("PRAGMA busy_timeout = 10000;");

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

// Seeding function for 2014 election data to allow electoral efficiency analysis
async function seed2014() {
  const candidates2014 = [
    {
      nome_urna: "Julio César",
      nome_completo: "Julio César Ribeiro",
      partido: "PRB",
      ano_eleicao: 2014,
      total_votos: 29384,
      foto_url: "/assets/fotos/julio_cesar.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 140000.0,
      despesas_contratadas: 135000.0,
      despesas_pagas: 130000.0,
      maior_fornecedor_nome: "Gráfica Alvorada",
      maior_fornecedor_valor: 25000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 65000.0 },
        { category: "Serviços de Terceiros", value: 40000.0 },
        { category: "Combustíveis", value: 25000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 12000 },
        { zona: 2, ra: "Sobradinho", votos: 10000 },
        { zona: 3, ra: "Taguatinga", votos: 7384 }
      ]
    },
    {
      nome_urna: "Robério Negreiros",
      nome_completo: "Robério Negreiros Filho",
      partido: "PMDB",
      ano_eleicao: 2014,
      total_votos: 25646,
      foto_url: "/assets/fotos/roberio_negreiros.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 410000.0,
      despesas_contratadas: 395000.0,
      despesas_pagas: 380000.0,
      maior_fornecedor_nome: "Mídia Externa Brasília Comunicação",
      maior_fornecedor_valor: 85000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Outdoors/Mídia Externa", value: 135000.0 },
        { category: "Serviços Prestados por Terceiros", value: 100000.0 },
        { category: "Publicidade por Materiais Impressos", value: 75000.0 },
        { category: "Locação de Veículos", value: 50000.0 },
        { category: "Combustíveis", value: 35000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 10000 },
        { zona: 2, ra: "Sobradinho", votos: 8000 },
        { zona: 3, ra: "Taguatinga", votos: 7646 }
      ]
    },
    {
      nome_urna: "Professor Israel",
      nome_completo: "Israel Matos Batista",
      partido: "PV",
      ano_eleicao: 2014,
      total_votos: 22500,
      foto_url: "/assets/fotos/professor_israel.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 160000.0,
      despesas_contratadas: 152000.0,
      despesas_pagas: 148000.0,
      maior_fornecedor_nome: "Editora Expressão de Brasília Ltda",
      maior_fornecedor_valor: 45000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 60000.0 },
        { category: "Produção de Vídeo e Redes Sociais", value: 35000.0 },
        { category: "Serviços Prestados por Terceiros", value: 25000.0 },
        { category: "Locação de Veículos", value: 18000.0 },
        { category: "Combustíveis", value: 14000.0 }
      ]),
      votos: [
        { zona: 5, ra: "Guará", votos: 11000 },
        { zona: 1, ra: "Plano Piloto", votos: 7000 },
        { zona: 3, ra: "Taguatinga", votos: 4500 }
      ]
    },
    {
      nome_urna: "Dr. Michel",
      nome_completo: "Michel Alano de Sousa Belo",
      partido: "PP",
      ano_eleicao: 2014,
      total_votos: 22422,
      foto_url: "/assets/fotos/dr_michel.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 130000.0,
      despesas_contratadas: 122000.0,
      despesas_pagas: 118000.0,
      maior_fornecedor_nome: "Editora e Gráfica Candanga",
      maior_fornecedor_valor: 28000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 55000.0 },
        { category: "Serviços de Terceiros", value: 40000.0 },
        { category: "Combustíveis", value: 23000.0 }
      ]),
      votos: [
        { zona: 2, ra: "Sobradinho", votos: 12000 },
        { zona: 1, ra: "Plano Piloto", votos: 6000 },
        { zona: 3, ra: "Taguatinga", votos: 4422 }
      ]
    },
    {
      nome_urna: "Delmasso",
      nome_completo: "Rodrigo Delmasso",
      partido: "PTN",
      ano_eleicao: 2014,
      total_votos: 20894,
      foto_url: "/assets/fotos/delmasso.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 150000.0,
      despesas_contratadas: 142000.0,
      despesas_pagas: 138000.0,
      maior_fornecedor_nome: "Gráfica do DF Central",
      maior_fornecedor_valor: 30000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 65000.0 },
        { category: "Militância de Rua", value: 45000.0 },
        { category: "Combustíveis", value: 28000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 10000 },
        { zona: 5, ra: "Guará", votos: 6000 },
        { zona: 3, ra: "Taguatinga", votos: 4894 }
      ]
    },
    {
      nome_urna: "Joe Valle",
      nome_completo: "Joe Valle",
      partido: "PDT",
      ano_eleicao: 2014,
      total_votos: 20352,
      foto_url: "/assets/fotos/joe_valle.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 170000.0,
      despesas_contratadas: 162000.0,
      despesas_pagas: 158000.0,
      maior_fornecedor_nome: "Mídia Externa Brasília",
      maior_fornecedor_valor: 40000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Outdoors", value: 70000.0 },
        { category: "Publicidade por Impressos", value: 55000.0 },
        { category: "Combustíveis", value: 33000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 9000 },
        { zona: 5, ra: "Guará", votos: 7000 },
        { zona: 3, ra: "Taguatinga", votos: 4352 }
      ]
    },
    {
      nome_urna: "Sandra Faraj",
      nome_completo: "Sandra Faraj Cavalcante",
      partido: "SD",
      ano_eleicao: 2014,
      total_votos: 20269,
      foto_url: "/assets/fotos/sandra_faraj.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 120000.0,
      despesas_contratadas: 110000.0,
      despesas_pagas: 105000.0,
      maior_fornecedor_nome: "Gráfica Taguatinga Central",
      maior_fornecedor_valor: 22000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 45000.0 },
        { category: "Atividades de Militância", value: 25000.0 },
        { category: "Serviços de Terceiros", value: 18000.0 },
        { category: "Locação de Veículos", value: 12000.0 },
        { category: "Combustíveis", value: 10000.0 }
      ]),
      votos: [
        { zona: 10, ra: "Brazlândia", votos: 10000 },
        { zona: 3, ra: "Taguatinga", votos: 6000 },
        { zona: 1, ra: "Plano Piloto", votos: 4269 }
      ]
    },
    {
      nome_urna: "Wasny de Roure",
      nome_completo: "Wasny de Roure",
      partido: "PT",
      ano_eleicao: 2014,
      total_votos: 19318,
      foto_url: "/assets/fotos/wasny_de_roure.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 145000.0,
      despesas_contratadas: 138000.0,
      despesas_pagas: 132000.0,
      maior_fornecedor_nome: "Gráfica Ceilândia S.A.",
      maior_fornecedor_valor: 32000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 65000.0 },
        { category: "Atividades de Militância", value: 40000.0 },
        { category: "Combustíveis", value: 27000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 9000 },
        { zona: 2, ra: "Sobradinho", votos: 6000 },
        { zona: 3, ra: "Taguatinga", votos: 4318 }
      ]
    },
    {
      nome_urna: "Rafael Prudente",
      nome_completo: "Rafael Prudente",
      partido: "PMDB",
      ano_eleicao: 2014,
      total_votos: 17581,
      foto_url: "/assets/fotos/rafael_prudente.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 180000.0,
      despesas_contratadas: 170000.0,
      despesas_pagas: 165000.0,
      maior_fornecedor_nome: "Mídia Externa Brasília",
      maior_fornecedor_valor: 45000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Outdoors", value: 80000.0 },
        { category: "Publicidade por Impressos", value: 55000.0 },
        { category: "Combustíveis", value: 30000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 8000 },
        { zona: 5, ra: "Guará", votos: 5000 },
        { zona: 3, ra: "Taguatinga", votos: 4581 }
      ]
    },
    {
      nome_urna: "Chico Vigilante",
      nome_completo: "Francisco Domingos dos Santos",
      partido: "PT",
      ano_eleicao: 2014,
      total_votos: 17040,
      foto_url: "/assets/fotos/chico_vigilante.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 180000.0,
      despesas_contratadas: 172000.0,
      despesas_pagas: 168000.0,
      maior_fornecedor_nome: "Gráfica Ceilândia Central S/A",
      maior_fornecedor_valor: 30000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 65000.0 },
        { category: "Atividades de Militância", value: 45000.0 },
        { category: "Produção de Rádio, TV e Vídeo", value: 30000.0 },
        { category: "Combustíveis", value: 18000.0 },
        { category: "Locação de Veículos", value: 14000.0 }
      ]),
      votos: [
        { zona: 6, ra: "Ceilândia", votos: 10000 },
        { zona: 20, ra: "Ceilândia Norte", votos: 4000 },
        { zona: 3, ra: "Taguatinga", votos: 3040 }
      ]
    },
    {
      nome_urna: "Liliane Roriz",
      nome_completo: "Liliane Maria Roriz",
      partido: "PRTB",
      ano_eleicao: 2014,
      total_votos: 16745,
      foto_url: "/assets/fotos/liliane_roriz.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 135000.0,
      despesas_contratadas: 125000.0,
      despesas_pagas: 120000.0,
      maior_fornecedor_nome: "Gráfica Alvorada",
      maior_fornecedor_valor: 24000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 60000.0 },
        { category: "Serviços de Terceiros", value: 38000.0 },
        { category: "Combustíveis", value: 22000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 7000 },
        { zona: 2, ra: "Sobradinho", votos: 5000 },
        { zona: 3, ra: "Taguatinga", votos: 4745 }
      ]
    },
    {
      nome_urna: "Juarezão",
      nome_completo: "Juarez Oliveira",
      partido: "PRTB",
      ano_eleicao: 2014,
      total_votos: 15923,
      foto_url: "/assets/fotos/juarezao.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 110000.0,
      despesas_contratadas: 102000.0,
      despesas_pagas: 98000.0,
      maior_fornecedor_nome: "Gráfica Sobradinho Comunicações",
      maior_fornecedor_valor: 22000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 45000.0 },
        { category: "Atividades de Militância", value: 35000.0 },
        { category: "Combustíveis", value: 18000.0 }
      ]),
      votos: [
        { zona: 2, ra: "Sobradinho", votos: 8000 },
        { zona: 1, ra: "Plano Piloto", votos: 4000 },
        { zona: 3, ra: "Taguatinga", votos: 3923 }
      ]
    },
    {
      nome_urna: "Chico Leite",
      nome_completo: "Chico Leite",
      partido: "PT",
      ano_eleicao: 2014,
      total_votos: 15636,
      foto_url: "/assets/fotos/chico_leite.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 130000.0,
      despesas_contratadas: 122000.0,
      despesas_pagas: 118000.0,
      maior_fornecedor_nome: "Coletivo Cultural do DF",
      maior_fornecedor_valor: 25000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 55000.0 },
        { category: "Serviços de Terceiros", value: 40000.0 },
        { category: "Combustíveis", value: 23000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 8000 },
        { zona: 5, ra: "Guará", votos: 4000 },
        { zona: 3, ra: "Taguatinga", votos: 3636 }
      ]
    },
    {
      nome_urna: "Agaciel Maia",
      nome_completo: "Agaciel da Silva Maia",
      partido: "PTC",
      ano_eleicao: 2014,
      total_votos: 14876,
      foto_url: "/assets/fotos/agaciel_maia.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 155000.0,
      despesas_contratadas: 145000.0,
      despesas_pagas: 140000.0,
      maior_fornecedor_nome: "Gráfica do DF Central",
      maior_fornecedor_valor: 35000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 70000.0 },
        { category: "Serviços de Terceiros", value: 45000.0 },
        { category: "Combustíveis", value: 25000.0 }
      ]),
      votos: [
        { zona: 2, ra: "Sobradinho", votos: 7000 },
        { zona: 1, ra: "Plano Piloto", votos: 4000 },
        { zona: 3, ra: "Taguatinga", votos: 3876 }
      ]
    },
    {
      nome_urna: "Cristiano Araújo",
      nome_completo: "Cristiano Nogueira Araújo",
      partido: "PTB",
      ano_eleicao: 2014,
      total_votos: 14657,
      foto_url: "/assets/fotos/cristiano_araujo.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 125000.0,
      despesas_contratadas: 118000.0,
      despesas_pagas: 112000.0,
      maior_fornecedor_nome: "Editora Distrito S.A.",
      maior_fornecedor_valor: 26000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 50000.0 },
        { category: "Serviços de Terceiros", value: 38000.0 },
        { category: "Combustíveis", value: 24000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 7000 },
        { zona: 2, ra: "Sobradinho", votos: 4000 },
        { zona: 3, ra: "Taguatinga", votos: 3657 }
      ]
    },
    {
      nome_urna: "Ricardo Vale",
      nome_completo: "Ricardo Vale da Silva",
      partido: "PT",
      ano_eleicao: 2014,
      total_votos: 14223,
      foto_url: "/assets/fotos/ricardo_vale.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 115000.0,
      despesas_contratadas: 108000.0,
      despesas_pagas: 104000.0,
      maior_fornecedor_nome: "Mídia Popular",
      maior_fornecedor_valor: 24000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 45000.0 },
        { category: "Serviços de Terceiros", value: 35000.0 },
        { category: "Combustíveis", value: 24000.0 }
      ]),
      votos: [
        { zona: 2, ra: "Sobradinho", votos: 6000 },
        { zona: 1, ra: "Plano Piloto", votos: 5000 },
        { zona: 3, ra: "Taguatinga", votos: 3223 }
      ]
    },
    {
      nome_urna: "Bispo Renato",
      nome_completo: "Renato Andrade dos Santos",
      partido: "PR",
      ano_eleicao: 2014,
      total_votos: 14216,
      foto_url: "/assets/fotos/bispo_renato.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 120000.0,
      despesas_contratadas: 112000.0,
      despesas_pagas: 108000.0,
      maior_fornecedor_nome: "Gráfica Planaltina Central",
      maior_fornecedor_valor: 25000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 50000.0 },
        { category: "Serviços de Terceiros", value: 38000.0 },
        { category: "Combustíveis", value: 20000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 6000 },
        { zona: 2, ra: "Sobradinho", votos: 5000 },
        { zona: 3, ra: "Taguatinga", votos: 3216 }
      ]
    },
    {
      nome_urna: "Celina Leão",
      nome_completo: "Celina Leão Lourenço",
      partido: "PDT",
      ano_eleicao: 2014,
      total_votos: 12670,
      foto_url: "/assets/fotos/celina_leao.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 140000.0,
      despesas_contratadas: 132000.0,
      despesas_pagas: 128000.0,
      maior_fornecedor_nome: "Consultoria Alvorada S/C",
      maior_fornecedor_valor: 30000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 60000.0 },
        { category: "Serviços de Terceiros", value: 40000.0 },
        { category: "Combustíveis", value: 28000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 5500 },
        { zona: 5, ra: "Guará", votos: 4000 },
        { zona: 3, ra: "Taguatinga", votos: 3170 }
      ]
    },
    {
      nome_urna: "Reginaldo Veras",
      nome_completo: "Reginaldo Veras",
      partido: "PDT",
      ano_eleicao: 2014,
      total_votos: 12506,
      foto_url: "/assets/fotos/reginaldo_veras.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 110000.0,
      despesas_contratadas: 105000.0,
      despesas_pagas: 100000.0,
      maior_fornecedor_nome: "Comunicação Brasília",
      maior_fornecedor_valor: 20000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 45000.0 },
        { category: "Atividades de Militância", value: 35000.0 },
        { category: "Combustíveis", value: 20000.0 }
      ]),
      votos: [
        { zona: 5, ra: "Guará", votos: 6000 },
        { zona: 1, ra: "Plano Piloto", votos: 4000 },
        { zona: 3, ra: "Taguatinga", votos: 2506 }
      ]
    },
    {
      nome_urna: "Lira",
      nome_completo: "Ivonildo Medeiros",
      partido: "PHS",
      ano_eleicao: 2014,
      total_votos: 11463,
      foto_url: "/assets/fotos/lira.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 95000.0,
      despesas_contratadas: 88000.0,
      despesas_pagas: 84000.0,
      maior_fornecedor_nome: "Gráfica do Cruzeiro",
      maior_fornecedor_valor: 18000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 40000.0 },
        { category: "Militância de Rua", value: 28000.0 },
        { category: "Combustíveis", value: 16000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 5000 },
        { zona: 2, ra: "Sobradinho", votos: 3500 },
        { zona: 3, ra: "Taguatinga", votos: 2963 }
      ]
    },
    {
      nome_urna: "Telma Rufino",
      nome_completo: "Telma Rufino",
      partido: "PPL",
      ano_eleicao: 2014,
      total_votos: 11364,
      foto_url: "/assets/fotos/telma_rufino.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 98000.0,
      despesas_contratadas: 90000.0,
      despesas_pagas: 86000.0,
      maior_fornecedor_nome: "Digital Ads DF",
      maior_fornecedor_valor: 18000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 42000.0 },
        { category: "Militância de Rua", value: 28000.0 },
        { category: "Combustíveis", value: 16000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 5000 },
        { zona: 5, ra: "Guará", votos: 3500 },
        { zona: 3, ra: "Taguatinga", votos: 2864 }
      ]
    },
    {
      nome_urna: "Wellington Luiz",
      nome_completo: "Wellington Luiz de Souza Silva",
      partido: "PMDB",
      ano_eleicao: 2014,
      total_votos: 10330,
      foto_url: "/assets/fotos/wellington_luiz.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 112000.0,
      despesas_contratadas: 105000.0,
      despesas_pagas: 100000.0,
      maior_fornecedor_nome: "Gráfica Gama Sul",
      maior_fornecedor_valor: 22000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 45000.0 },
        { category: "Militância de Rua", value: 33000.0 },
        { category: "Combustíveis", value: 22000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 4500 },
        { zona: 2, ra: "Sobradinho", votos: 3000 },
        { zona: 3, ra: "Taguatinga", votos: 2830 }
      ]
    },
    {
      nome_urna: "Raimundo Ribeiro",
      nome_completo: "Raimundo Ribeiro",
      partido: "PSDB",
      ano_eleicao: 2014,
      total_votos: 10026,
      foto_url: "/assets/fotos/raimundo_ribeiro.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 105000.0,
      despesas_contratadas: 98000.0,
      despesas_pagas: 94000.0,
      maior_fornecedor_nome: "Editora Verde DF",
      maior_fornecedor_valor: 20000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 42000.0 },
        { category: "Militância de Rua", value: 30000.0 },
        { category: "Combustíveis", value: 22000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 4000 },
        { zona: 5, ra: "Guará", votos: 3000 },
        { zona: 3, ra: "Taguatinga", votos: 3026 }
      ]
    },
    {
      nome_urna: "Luzia de Paula",
      nome_completo: "Luzia de Paula",
      partido: "PEN",
      ano_eleicao: 2014,
      total_votos: 7428,
      foto_url: "/assets/fotos/luzia_de_paula.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 85000.0,
      despesas_contratadas: 78000.0,
      despesas_pagas: 74000.0,
      maior_fornecedor_nome: "Gráfica de Taguatinga",
      maior_fornecedor_valor: 15000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Impressos", value: 35000.0 },
        { category: "Militância de Rua", value: 24000.0 },
        { category: "Combustíveis", value: 15000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 3000 },
        { zona: 2, ra: "Sobradinho", votos: 2500 },
        { zona: 3, ra: "Taguatinga", votos: 1928 }
      ]
    }
  ];

  for (const cand of candidates2014) {
    const candId = await new Promise<number>((resolve, reject) => {
      db.run(
        `INSERT INTO Candidatos (nome_urna, nome_completo, partido, ano_eleicao, total_votos, foto_url, cargo, situacao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [cand.nome_urna, cand.nome_completo, cand.partido, cand.ano_eleicao, cand.total_votos, cand.foto_url, cand.cargo, cand.situacao],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    await dbRun(
      `INSERT INTO Resumo_Financeiro (id_candidato, total_receitas, despesas_contratadas, despesas_pagas, maior_fornecedor_nome, maior_fornecedor_valor, detalhe_despesas)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [candId, cand.receitas, cand.despesas_contratadas, cand.despesas_pagas, cand.maior_fornecedor_nome, cand.maior_fornecedor_valor, cand.detalhe_despesas]
    );

    for (const v of cand.votos) {
      await dbRun(
        `INSERT INTO Geoeleitoral_Votos (id_candidato, zona_eleitoral, ra_nome, votos)
         VALUES (?, ?, ?, ?)`,
        [candId, v.zona, v.ra, v.votos]
      );
    }
  }
  console.log("Seeded 2014 candidates successfully!");
}

// Database Initialization and Seeding
async function initDatabase() {
  console.log("Initializing database...");
  
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

  // Check if seeded already
  const candidatesCount: any = await dbGet("SELECT COUNT(*) as count FROM Candidatos");
  if (candidatesCount && candidatesCount.count > 0) {
    const count2014: any = await dbGet("SELECT COUNT(*) as count FROM Candidatos WHERE ano_eleicao = 2014");
    if (!count2014 || count2014.count === 0) {
      console.log("Seeding 2014 candidates to existing database...");
      await seed2014();
    } else {
      console.log("Database already fully seeded (including 2014).");
    }
    return;
  }

  console.log("Seeding candidates...");

  // Candidates 2022
  const candidates2022 = [
    {
      nome_urna: "Fábio Felix",
      nome_completo: "Fábio Felix Silveira",
      partido: "PSOL",
      ano_eleicao: 2022,
      total_votos: 51775,
      foto_url: "/assets/fotos/fabio_felix.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 420000.0,
      despesas_contratadas: 398500.0,
      despesas_pagas: 385000.0,
      maior_fornecedor_nome: "Editora Expressão de Brasília Ltda",
      maior_fornecedor_valor: 85000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 145000.0 },
        { category: "Serviços Prestados por Terceiros", value: 110000.0 },
        { category: "Produção de Rádio, TV e Vídeo", value: 75000.0 },
        { category: "Doações Financeiras a Candidatos", value: 35000.0 },
        { category: "Combustíveis e Lubrificantes", value: 33500.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 15200 },
        { zona: 5, ra: "Guará", votos: 8500 },
        { zona: 3, ra: "Taguatinga", votos: 7200 },
        { zona: 6, ra: "Ceilândia", votos: 6800 },
        { zona: 13, ra: "Samambaia", votos: 5400 },
        { zona: 2, ra: "Sobradinho", votos: 4200 },
        { zona: 99, ra: "Outras RAs", votos: 4475 }
      ]
    },
    {
      nome_urna: "Chico Vigilante",
      nome_completo: "Francisco Domingos dos Santos",
      partido: "PT",
      ano_eleicao: 2022,
      total_votos: 31201,
      foto_url: "/assets/fotos/chico_vigilante.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 360000.0,
      despesas_contratadas: 342000.0,
      despesas_pagas: 330000.0,
      maior_fornecedor_nome: "Gráfica Ceilândia Central S/A",
      maior_fornecedor_valor: 62000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 120000.0 },
        { category: "Serviços Prestados por Terceiros", value: 95000.0 },
        { category: "Combustíveis e Lubrificantes", value: 52000.0 },
        { category: "Locação de Imóveis", value: 45000.0 },
        { category: "Militância e Mobilização de Rua", value: 30000.0 }
      ]),
      votos: [
        { zona: 6, ra: "Ceilândia", votos: 14500 },
        { zona: 20, ra: "Ceilândia Norte", votos: 8200 },
        { zona: 3, ra: "Taguatinga", votos: 3500 },
        { zona: 13, ra: "Samambaia", votos: 2800 },
        { zona: 99, ra: "Outras RAs", votos: 2201 }
      ]
    },
    {
      nome_urna: "Max Maciel",
      nome_completo: "Max Maciel de Araujo",
      partido: "PSOL",
      ano_eleicao: 2022,
      total_votos: 35758,
      foto_url: "/assets/fotos/max_maciel.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 310000.0,
      despesas_contratadas: 295000.0,
      despesas_pagas: 280000.0,
      maior_fornecedor_nome: "Digital Marketing DF Ltda",
      maior_fornecedor_valor: 45000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Serviços Prestados por Terceiros", value: 105000.0 },
        { category: "Publicidade por Materiais Impressos", value: 85000.0 },
        { category: "Impulsionamento de Conteúdos", value: 45000.0 },
        { category: "Locação de Veículos", value: 35000.0 },
        { category: "Despesas com Pessoal", value: 25000.0 }
      ]),
      votos: [
        { zona: 6, ra: "Ceilândia", votos: 12100 },
        { zona: 13, ra: "Samambaia", votos: 9300 },
        { zona: 3, ra: "Taguatinga", votos: 5800 },
        { zona: 1, ra: "Plano Piloto", votos: 4200 },
        { zona: 99, ra: "Outras RAs", votos: 4358 }
      ]
    },
    {
      nome_urna: "Paula Belmonte",
      nome_completo: "Paula Belmonte Ferreira",
      partido: "Cidadania",
      ano_eleicao: 2022,
      total_votos: 17207,
      foto_url: "/assets/fotos/paula_belmonte.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 640000.0,
      despesas_contratadas: 610000.0,
      despesas_pagas: 590000.0,
      maior_fornecedor_nome: "Focus Comunicação e Estratégia",
      maior_fornecedor_valor: 15000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Serviços Prestados por Terceiros", value: 240000.0 },
        { category: "Publicidade por Materiais Impressos", value: 150000.0 },
        { category: "Pesquisas e Testes de Opinião", value: 95000.0 },
        { category: "Locação de Veículos", value: 75000.0 },
        { category: "Despesas de Pessoal", value: 50000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 6500 },
        { zona: 5, ra: "Guará", votos: 3400 },
        { zona: 2, ra: "Sobradinho", votos: 2800 },
        { zona: 3, ra: "Taguatinga", votos: 2100 },
        { zona: 99, ra: "Outras RAs", votos: 2407 }
      ]
    },
    {
      nome_urna: "Robério Negreiros",
      nome_completo: "Robério Negreiros Filho",
      partido: "PSD",
      ano_eleicao: 2022,
      total_votos: 31394,
      foto_url: "/assets/fotos/roberio_negreiros.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 580000.0,
      despesas_contratadas: 550000.0,
      despesas_pagas: 520000.0,
      maior_fornecedor_nome: "Mídia Externa Brasília Comunicação",
      maior_fornecedor_valor: 110000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Outdoors/Mídia Externa", value: 180000.0 },
        { category: "Serviços Prestados por Terceiros", value: 150000.0 },
        { category: "Publicidade por Materiais Impressos", value: 110000.0 },
        { category: "Locação de Veículos", value: 65000.0 },
        { category: "Combustíveis", value: 45000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 8900 },
        { zona: 2, ra: "Sobradinho", votos: 7100 },
        { zona: 3, ra: "Taguatinga", votos: 5300 },
        { zona: 5, ra: "Guará", votos: 4800 },
        { zona: 99, ra: "Outras RAs", votos: 5294 }
      ]
    },
    {
      nome_urna: "Daniel Donizet",
      nome_completo: "Daniel Donizet de Oliveira",
      partido: "PL",
      ano_eleicao: 2022,
      total_votos: 33583,
      foto_url: "/assets/fotos/daniel_donizet.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 290000.0,
      despesas_contratadas: 285000.0,
      despesas_pagas: 270000.0,
      maior_fornecedor_nome: "Gráfica e Editora Gama Sul",
      maior_fornecedor_valor: 50000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 105000.0 },
        { category: "Militância de Rua e Carros de Som", value: 75000.0 },
        { category: "Serviços de Terceiros", value: 50000.0 },
        { category: "Locação de Imóvel e Comitê", value: 30000.0 },
        { category: "Combustíveis", value: 25000.0 }
      ]),
      votos: [
        { zona: 4, ra: "Gama", votos: 16500 },
        { zona: 15, ra: "Santa Maria", votos: 9200 },
        { zona: 14, ra: "Recanto das Emas", votos: 4100 },
        { zona: 99, ra: "Outras RAs", votos: 3783 }
      ]
    },
    {
      nome_urna: "Jorge Vianna",
      nome_completo: "Jorge Vianna de Sousa",
      partido: "PSD",
      ano_eleicao: 2022,
      total_votos: 30605,
      foto_url: "/assets/fotos/jorge_vianna.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 280000.0,
      despesas_contratadas: 265000.0,
      despesas_pagas: 255000.0,
      maior_fornecedor_nome: "Agência Saúde e Comunicação",
      maior_fornecedor_valor: 40000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 95000.0 },
        { category: "Produção de Vídeo e Redes Sociais", value: 65000.0 },
        { category: "Locação de Veículos de Som", value: 45000.0 },
        { category: "Despesas de Pessoal", value: 35000.0 },
        { category: "Combustíveis", value: 25000.0 }
      ]),
      votos: [
        { zona: 3, ra: "Taguatinga", votos: 10500 },
        { zona: 13, ra: "Samambaia", votos: 8400 },
        { zona: 6, ra: "Ceilândia", votos: 6100 },
        { zona: 99, ra: "Outras RAs", votos: 5605 }
      ]
    },
    {
      nome_urna: "Jaqueline Silva",
      nome_completo: "Jaqueline Angela da Silva",
      partido: "MDB",
      ano_eleicao: 2022,
      total_votos: 26452,
      foto_url: "/assets/fotos/jaqueline_silva.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 340000.0,
      despesas_contratadas: 325000.0,
      despesas_pagas: 310000.0,
      maior_fornecedor_nome: "Comunicação Brasília e Eventos Ltda",
      maior_fornecedor_valor: 70000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Eventos e Comício de Campanha", value: 110000.0 },
        { category: "Publicidade por Materiais Impressos", value: 95000.0 },
        { category: "Serviços Prestados por Terceiros", value: 60000.0 },
        { category: "Locação de Veículos", value: 35000.0 },
        { category: "Combustíveis", value: 25000.0 }
      ]),
      votos: [
        { zona: 15, ra: "Santa Maria", votos: 12400 },
        { zona: 4, ra: "Gama", votos: 6500 },
        { zona: 14, ra: "Recanto das Emas", votos: 3800 },
        { zona: 99, ra: "Outras RAs", votos: 3752 }
      ]
    },
    {
      nome_urna: "Thiago Manzoni",
      nome_completo: "Thiago Manzoni dos Santos",
      partido: "PL",
      ano_eleicao: 2022,
      total_votos: 25554,
      foto_url: "/assets/fotos/thiago_manzoni.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 260000.0,
      despesas_contratadas: 245000.0,
      despesas_pagas: 235000.0,
      maior_fornecedor_nome: "Agência de Tráfego Pago & Ads",
      maior_fornecedor_valor: 55000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Impulsionamento de Conteúdo Online", value: 85000.0 },
        { category: "Publicidade por Materiais Impressos", value: 60000.0 },
        { category: "Produção de Áudio e Vídeo", value: 50000.0 },
        { category: "Serviços Prestados por Terceiros", value: 30000.0 },
        { category: "Combustíveis", value: 20000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 11200 },
        { zona: 5, ra: "Guará", votos: 5400 },
        { zona: 2, ra: "Sobradinho", votos: 4100 },
        { zona: 99, ra: "Outras RAs", votos: 4854 }
      ]
    },
    {
      nome_urna: "Eduardo Pedrosa",
      nome_completo: "Eduardo Souza Pedrosa",
      partido: "União Brasil",
      ano_eleicao: 2022,
      total_votos: 22489,
      foto_url: "/assets/fotos/eduardo_pedrosa.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 410000.0,
      despesas_contratadas: 390000.0,
      despesas_pagas: 375000.0,
      maior_fornecedor_nome: "Consultoria Política Alvorada",
      maior_fornecedor_valor: 90000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Serviços Prestados por Terceiros", value: 145000.0 },
        { category: "Publicidade por Materiais Impressos", value: 115000.0 },
        { category: "Locação de Veículos", value: 65000.0 },
        { category: "Combustíveis", value: 35000.0 },
        { category: "Despesas de Pessoal", value: 30000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 9200 },
        { zona: 16, ra: "São Sebastião", votos: 5100 },
        { zona: 8, ra: "Paranoá", votos: 3400 },
        { zona: 99, ra: "Outras RAs", votos: 4789 }
      ]
    },
    {
      nome_urna: "Iolando",
      nome_completo: "Iolando Almeida de Souza",
      partido: "MDB",
      ano_eleicao: 2022,
      total_votos: 20757,
      foto_url: "/assets/fotos/iolando.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 230000.0,
      despesas_contratadas: 220000.0,
      despesas_pagas: 210000.0,
      maior_fornecedor_nome: "Gráfica e Editora Taguatinga Sul",
      maior_fornecedor_valor: 38000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 85000.0 },
        { category: "Atividades de Militância", value: 55000.0 },
        { category: "Serviços de Terceiros", value: 35000.0 },
        { category: "Locação de Veículos", value: 25000.0 },
        { category: "Combustíveis", value: 20000.0 }
      ]),
      votos: [
        { zona: 10, ra: "Brazlândia", votos: 11200 },
        { zona: 3, ra: "Taguatinga", votos: 4100 },
        { zona: 6, ra: "Ceilândia", votos: 2800 },
        { zona: 99, ra: "Outras RAs", votos: 2657 }
      ]
    },
    {
      nome_urna: "Dayse Amarilio",
      nome_completo: "Dayse Amarilio dos Santos",
      partido: "PSB",
      ano_eleicao: 2022,
      total_votos: 11019,
      foto_url: "/assets/fotos/dayse_amarilio.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 150000.0,
      despesas_contratadas: 142000.0,
      despesas_pagas: 135000.0,
      maior_fornecedor_nome: "Gráfica Distrito Federal Central",
      maior_fornecedor_valor: 30000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 55000.0 },
        { category: "Produção de Vídeo e Redes Sociais", value: 35000.0 },
        { category: "Serviços Prestados por Terceiros", value: 25000.0 },
        { category: "Locação de Veículos", value: 15000.0 },
        { category: "Combustíveis", value: 12000.0 }
      ]),
      votos: [
        { zona: 5, ra: "Guará", votos: 4100 },
        { zona: 1, ra: "Plano Piloto", votos: 3200 },
        { zona: 3, ra: "Taguatinga", votos: 1800 },
        { zona: 99, ra: "Outras RAs", votos: 1919 }
      ]
    },
    {
      nome_urna: "Martins Machado",
      nome_completo: "Martins Machado Silva",
      partido: "Republicanos",
      ano_eleicao: 2022,
      total_votos: 31993,
      foto_url: "/assets/fotos/martins_machado.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 320000.0,
      despesas_contratadas: 310000.0,
      despesas_pagas: 300000.0,
      maior_fornecedor_nome: "Gráfica Alvorada de Brasília",
      maior_fornecedor_valor: 45000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 98000.0 },
        { category: "Serviços de Terceiros", value: 85000.0 },
        { category: "Militância de Rua", value: 55000.0 },
        { category: "Combustíveis", value: 35000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 8200 },
        { zona: 2, ra: "Sobradinho", votos: 11500 },
        { zona: 3, ra: "Taguatinga", votos: 4500 },
        { zona: 99, ra: "Outras RAs", votos: 7793 }
      ]
    },
    {
      nome_urna: "Joaquim Roriz Neto",
      nome_completo: "Joaquim Domingos Roriz Neto",
      partido: "PL",
      ano_eleicao: 2022,
      total_votos: 21057,
      foto_url: "/assets/fotos/joaquim_roriz_neto.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 450000.0,
      despesas_contratadas: 435000.0,
      despesas_pagas: 420000.0,
      maior_fornecedor_nome: "Mídia & Produção Brasília Ltda",
      maior_fornecedor_valor: 85000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 135000.0 },
        { category: "Serviços Prestados por Terceiros", value: 115000.0 },
        { category: "Militância e Mobilização", value: 85000.0 },
        { category: "Locação de Veículos", value: 65000.0 },
        { category: "Combustíveis", value: 35000.0 }
      ]),
      votos: [
        { zona: 13, ra: "Samambaia", votos: 8500 },
        { zona: 6, ra: "Ceilândia", votos: 6400 },
        { zona: 3, ra: "Taguatinga", votos: 3200 },
        { zona: 99, ra: "Outras RAs", votos: 2957 }
      ]
    },
    {
      nome_urna: "Pastor Daniel de Castro",
      nome_completo: "Daniel de Castro Sousa",
      partido: "PP",
      ano_eleicao: 2022,
      total_votos: 20402,
      foto_url: "/assets/fotos/pastor_daniel_de_castro.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 210000.0,
      despesas_contratadas: 205000.0,
      despesas_pagas: 195000.0,
      maior_fornecedor_nome: "Gráfica e Comunicação Evangélica",
      maior_fornecedor_valor: 42000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 75000.0 },
        { category: "Produção de Vídeos e Eventos", value: 55000.0 },
        { category: "Serviços de Terceiros", value: 35000.0 },
        { category: "Locação de Veículos", value: 25000.0 },
        { category: "Combustíveis", value: 15000.0 }
      ]),
      votos: [
        { zona: 3, ra: "Taguatinga", votos: 11500 },
        { zona: 6, ra: "Ceilândia", votos: 4200 },
        { zona: 13, ra: "Samambaia", votos: 2100 },
        { zona: 99, ra: "Outras RAs", votos: 2602 }
      ]
    },
    {
      nome_urna: "Hermeto",
      nome_completo: "Joao Hermeto de Oliveira Neto",
      partido: "MDB",
      ano_eleicao: 2022,
      total_votos: 20332,
      foto_url: "/assets/fotos/hermeto.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 290000.0,
      despesas_contratadas: 280000.0,
      despesas_pagas: 270000.0,
      maior_fornecedor_nome: "Comercial e Produtora Candanga",
      maior_fornecedor_valor: 55000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 90000.0 },
        { category: "Atividades de Militância de Rua", value: 65000.0 },
        { category: "Locação de Veículos de Som", value: 45000.0 },
        { category: "Serviços Prestados por Terceiros", value: 40000.0 },
        { category: "Combustíveis", value: 40000.0 }
      ]),
      votos: [
        { zona: 21, ra: "Núcleo Bandeirante", votos: 12500 },
        { zona: 5, ra: "Guará", votos: 3100 },
        { zona: 1, ra: "Plano Piloto", votos: 2200 },
        { zona: 99, ra: "Outras RAs", votos: 2532 }
      ]
    },
    {
      nome_urna: "Roosevelt Vilela",
      nome_completo: "Roosevelt Vilela Pires",
      partido: "PL",
      ano_eleicao: 2022,
      total_votos: 20223,
      foto_url: "/assets/fotos/roosevelt_vilela.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 330000.0,
      despesas_contratadas: 315000.0,
      despesas_pagas: 305000.0,
      maior_fornecedor_nome: "Focus Produções de Mídia Ltda",
      maior_fornecedor_valor: 60000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 115000.0 },
        { category: "Serviços Prestados por Terceiros", value: 75000.0 },
        { category: "Locação de Veículos de Som", value: 55000.0 },
        { category: "Militância de Rua", value: 45000.0 },
        { category: "Combustíveis", value: 25000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 6400 },
        { zona: 5, ra: "Guará", votos: 5100 },
        { zona: 3, ra: "Taguatinga", votos: 4100 },
        { zona: 99, ra: "Outras RAs", votos: 4623 }
      ]
    },
    {
      nome_urna: "Doutora Jane",
      nome_completo: "Jane Klebia do Nascimento Silva Reis",
      partido: "AGIR",
      ano_eleicao: 2022,
      total_votos: 19006,
      foto_url: "/assets/fotos/doutorajane.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 180000.0,
      despesas_contratadas: 172000.0,
      despesas_pagas: 165000.0,
      maior_fornecedor_nome: "Focus Comunicação e Impressos",
      maior_fornecedor_valor: 35000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 65000.0 },
        { category: "Serviços Prestados por Terceiros", value: 45000.0 },
        { category: "Locação de Veículos", value: 30000.0 },
        { category: "Militância e Mobilização", value: 20000.0 },
        { category: "Combustíveis", value: 12000.0 }
      ]),
      votos: [
        { zona: 2, ra: "Sobradinho", votos: 10200 },
        { zona: 1, ra: "Plano Piloto", votos: 3100 },
        { zona: 5, ra: "Guará", votos: 1800 },
        { zona: 99, ra: "Outras RAs", votos: 3906 }
      ]
    },
    {
      nome_urna: "Rogério Morro da Cruz",
      nome_completo: "Bernardo Rogério Mata de Araújo Junior",
      partido: "PMN",
      ano_eleicao: 2022,
      total_votos: 18207,
      foto_url: "/assets/fotos/rogerio_morro_da_cruz.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 140000.0,
      despesas_contratadas: 132000.0,
      despesas_pagas: 125000.0,
      maior_fornecedor_nome: "Gráfica do Morro Central",
      maior_fornecedor_valor: 28000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 45000.0 },
        { category: "Atividades de Militância de Rua", value: 35000.0 },
        { category: "Serviços Prestados por Terceiros", value: 25000.0 },
        { category: "Locação de Veículos", value: 15000.0 },
        { category: "Combustíveis", value: 12000.0 }
      ]),
      votos: [
        { zona: 16, ra: "São Sebastião", votos: 13500 },
        { zona: 1, ra: "Plano Piloto", votos: 1500 },
        { zona: 99, ra: "Outras RAs", votos: 3207 }
      ]
    },
    {
      nome_urna: "Gabriel Magno",
      nome_completo: "Gabriel Magno Pereira Cruz",
      partido: "PT",
      ano_eleicao: 2022,
      total_votos: 18207,
      foto_url: "/assets/fotos/gabriel_magno.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 240000.0,
      despesas_contratadas: 230000.0,
      despesas_pagas: 220000.0,
      maior_fornecedor_nome: "Mídia & Opinião Comunicação",
      maior_fornecedor_valor: 48000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 75000.0 },
        { category: "Serviços Prestados por Terceiros", value: 65000.0 },
        { category: "Produção de Vídeo e Áudio", value: 45000.0 },
        { category: "Militância de Rua", value: 25000.0 },
        { category: "Combustíveis", value: 20000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 8400 },
        { zona: 5, ra: "Guará", votos: 4100 },
        { zona: 3, ra: "Taguatinga", votos: 2500 },
        { zona: 99, ra: "Outras RAs", votos: 3207 }
      ]
    },
    {
      nome_urna: "Joao Cardoso Professor Auditor",
      nome_completo: "Joao Cardoso da Silva",
      partido: "AVANTE",
      ano_eleicao: 2022,
      total_votos: 17579,
      foto_url: "/assets/fotos/joao_cardoso.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 160000.0,
      despesas_contratadas: 152000.0,
      despesas_pagas: 145000.0,
      maior_fornecedor_nome: "Gráfica Sobradinho Comunicação",
      maior_fornecedor_valor: 35000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 55000.0 },
        { category: "Serviços Prestados por Terceiros", value: 45000.0 },
        { category: "Locação de Veículos", value: 25000.0 },
        { category: "Militância de Rua", value: 15000.0 },
        { category: "Combustíveis", value: 12000.0 }
      ]),
      votos: [
        { zona: 2, ra: "Sobradinho", votos: 11500 },
        { zona: 1, ra: "Plano Piloto", votos: 2100 },
        { zona: 99, ra: "Outras RAs", votos: 3979 }
      ]
    },
    {
      nome_urna: "Ricardo Vale",
      nome_completo: "Ricardo Vale da Silva",
      partido: "PT",
      ano_eleicao: 2022,
      total_votos: 17077,
      foto_url: "/assets/fotos/ricardo_vale.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 220000.0,
      despesas_contratadas: 210000.0,
      despesas_pagas: 200000.0,
      maior_fornecedor_nome: "Editora Expressão de Brasília Ltda",
      maior_fornecedor_valor: 42000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 70000.0 },
        { category: "Serviços Prestados por Terceiros", value: 55000.0 },
        { category: "Atividades de Militância", value: 45000.0 },
        { category: "Locação de Veículos", value: 25000.0 },
        { category: "Combustíveis", value: 15000.0 }
      ]),
      votos: [
        { zona: 2, ra: "Sobradinho", votos: 8900 },
        { zona: 1, ra: "Plano Piloto", votos: 3200 },
        { zona: 5, ra: "Guará", votos: 1800 },
        { zona: 99, ra: "Outras RAs", votos: 3177 }
      ]
    },
    {
      nome_urna: "Wellington Luiz",
      nome_completo: "Wellington Luiz de Souza Silva",
      partido: "MDB",
      ano_eleicao: 2022,
      total_votos: 16933,
      foto_url: "/assets/fotos/wellington_luiz.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 280000.0,
      despesas_contratadas: 270000.0,
      despesas_pagas: 260000.0,
      maior_fornecedor_nome: "Mídia & Comunicação Brasília S.A.",
      maior_fornecedor_valor: 55000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 85000.0 },
        { category: "Militância de Rua e Carros de Som", value: 65000.0 },
        { category: "Serviços Prestados por Terceiros", value: 55000.0 },
        { category: "Locação de Veículos", value: 45000.0 },
        { category: "Combustíveis", value: 20000.0 }
      ]),
      votos: [
        { zona: 1, ra: "Plano Piloto", votos: 7200 },
        { zona: 5, ra: "Guará", votos: 3500 },
        { zona: 3, ra: "Taguatinga", votos: 2800 },
        { zona: 99, ra: "Outras RAs", votos: 3433 }
      ]
    },
    {
      nome_urna: "Pepa",
      nome_completo: "Eduardo Cesar de Alencar",
      partido: "PP",
      ano_eleicao: 2022,
      total_votos: 15393,
      foto_url: "/assets/fotos/pepa.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 150000.0,
      despesas_contratadas: 145000.0,
      despesas_pagas: 138000.0,
      maior_fornecedor_nome: "Gráfica e Comunicação Central Planaltina",
      maior_fornecedor_valor: 32000.0,
      detalhe_despesas: JSON.stringify([
        { category: "Publicidade por Materiais Impressos", value: 52000.0 },
        { category: "Atividades de Militância", value: 42000.0 },
        { category: "Serviços Prestados por Terceiros", value: 25000.0 },
        { category: "Locação de Veículos", value: 15000.0 },
        { category: "Combustíveis", value: 11000.0 }
      ]),
      votos: [
        { zona: 11, ra: "Planaltina", votos: 9800 },
        { zona: 2, ra: "Sobradinho", votos: 2500 },
        { zona: 99, ra: "Outras RAs", votos: 3093 }
      ]
    }
  ];

  // Candidates 2018 (Historical Data)
  const candidates2018 = [
    {
      nome_urna: "Martins Machado",
      nome_completo: "Martins Machado Silva",
      partido: "PRB",
      ano_eleicao: 2018,
      total_votos: 29457,
      foto_url: "/assets/fotos/martins_machado.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 150000,
      despesas_contratadas: 140000,
      despesas_pagas: 135000,
      maior_fornecedor_nome: "Gráfica Alvorada",
      maior_fornecedor_valor: 30000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":70000},{"category":"Serviços de Terceiros","value":45000},{"category":"Combustíveis","value":25000}]),
      votos: [
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 12000
          },
          {
                  "zona": 2,
                  "ra": "Sobradinho",
                  "votos": 10000
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 7457
          }
  ]
    },
    {
      nome_urna: "Delegado Fernando Fernandes",
      nome_completo: "Fernando Fernandes",
      partido: "PROS",
      ano_eleicao: 2018,
      total_votos: 29420,
      foto_url: "/assets/fotos/delegado_fernando_fernandes.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 160000,
      despesas_contratadas: 155000,
      despesas_pagas: 150000,
      maior_fornecedor_nome: "Editora Brasília Comunicações",
      maior_fornecedor_valor: 45000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":80000},{"category":"Atividades de Militância","value":50000},{"category":"Combustíveis","value":25000}]),
      votos: [
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 12000
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 10000
          },
          {
                  "zona": 2,
                  "ra": "Sobradinho",
                  "votos": 7420
          }
  ]
    },
    {
      nome_urna: "Professor Reginaldo Veras",
      nome_completo: "Reginaldo Veras",
      partido: "PDT",
      ano_eleicao: 2018,
      total_votos: 27998,
      foto_url: "/assets/fotos/reginaldo_veras.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 120000,
      despesas_contratadas: 115000,
      despesas_pagas: 110000,
      maior_fornecedor_nome: "Gráfica Ceilândia S.A.",
      maior_fornecedor_valor: 35000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":60000},{"category":"Serviços de Terceiros","value":35000},{"category":"Combustíveis","value":20000}]),
      votos: [
          {
                  "zona": 5,
                  "ra": "Guará",
                  "votos": 15000
          },
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 8000
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 4998
          }
  ]
    },
    {
      nome_urna: "Rafael Prudente",
      nome_completo: "Rafael Prudente",
      partido: "MDB",
      ano_eleicao: 2018,
      total_votos: 26373,
      foto_url: "/assets/fotos/rafael_prudente.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 240000,
      despesas_contratadas: 230000,
      despesas_pagas: 225000,
      maior_fornecedor_nome: "Mídia Externa Brasília",
      maior_fornecedor_valor: 65000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Outdoors","value":110000},{"category":"Publicidade por Impressos","value":80000},{"category":"Combustíveis","value":40000}]),
      votos: [
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 10000
          },
          {
                  "zona": 5,
                  "ra": "Guará",
                  "votos": 8000
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 8373
          }
  ]
    },
    {
      nome_urna: "Delmasso",
      nome_completo: "Rodrigo Delmasso",
      partido: "PRB",
      ano_eleicao: 2018,
      total_votos: 23227,
      foto_url: "/assets/fotos/delmasso.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 180000,
      despesas_contratadas: 170000,
      despesas_pagas: 165000,
      maior_fornecedor_nome: "Gráfica Alvorada",
      maior_fornecedor_valor: 40000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":90000},{"category":"Atividades de Militância","value":50000},{"category":"Combustíveis","value":30000}]),
      votos: [
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 10000
          },
          {
                  "zona": 5,
                  "ra": "Guará",
                  "votos": 7000
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 6227
          }
  ]
    },
    {
      nome_urna: "Chico Vigilante",
      nome_completo: "Francisco Domingos dos Santos",
      partido: "PT",
      ano_eleicao: 2018,
      total_votos: 20975,
      foto_url: "/assets/fotos/chico_vigilante.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 210000,
      despesas_contratadas: 195000,
      despesas_pagas: 190000,
      maior_fornecedor_nome: "Gráfica Ceilândia Central S/A",
      maior_fornecedor_valor: 35000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":85000},{"category":"Serviços Prestados por Terceiros","value":45000},{"category":"Combustíveis","value":30000},{"category":"Locação de Comitês","value":20000},{"category":"Militância de Rua","value":15000}]),
      votos: [
          {
                  "zona": 6,
                  "ra": "Ceilândia",
                  "votos": 11200
          },
          {
                  "zona": 20,
                  "ra": "Ceilândia Norte",
                  "votos": 4800
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 4975
          }
  ]
    },
    {
      nome_urna: "Robério Negreiros",
      nome_completo: "Robério Negreiros Filho",
      partido: "PSD",
      ano_eleicao: 2018,
      total_votos: 18819,
      foto_url: "/assets/fotos/roberio_negreiros.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 480000,
      despesas_contratadas: 460000,
      despesas_pagas: 440000,
      maior_fornecedor_nome: "Mídia Externa Brasília Comunicação",
      maior_fornecedor_valor: 95000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Outdoors/Mídia Externa","value":155000},{"category":"Serviços Prestados por Terceiros","value":120000},{"category":"Publicidade por Materiais Impressos","value":85000},{"category":"Locação de Veículos","value":60000},{"category":"Combustíveis","value":40000}]),
      votos: [
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 7800
          },
          {
                  "zona": 2,
                  "ra": "Sobradinho",
                  "votos": 5900
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 5119
          }
  ]
    },
    {
      nome_urna: "Agaciel Maia",
      nome_completo: "Agaciel da Silva Maia",
      partido: "PR",
      ano_eleicao: 2018,
      total_votos: 17715,
      foto_url: "/assets/fotos/agaciel_maia.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 190000,
      despesas_contratadas: 185000,
      despesas_pagas: 180000,
      maior_fornecedor_nome: "Gráfica do DF Central",
      maior_fornecedor_valor: 45000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":90000},{"category":"Serviços de Terceiros","value":55000},{"category":"Combustíveis","value":40000}]),
      votos: [
          {
                  "zona": 2,
                  "ra": "Sobradinho",
                  "votos": 8500
          },
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 5000
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 4215
          }
  ]
    },
    {
      nome_urna: "José Gomes",
      nome_completo: "José Gomes de Souza",
      partido: "PSB",
      ano_eleicao: 2018,
      total_votos: 16537,
      foto_url: "/assets/fotos/jose_gomes.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 150000,
      despesas_contratadas: 142000,
      despesas_pagas: 138000,
      maior_fornecedor_nome: "Editora e Gráfica Candanga",
      maior_fornecedor_valor: 32000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":65000},{"category":"Militância de Rua","value":45000},{"category":"Combustíveis","value":32000}]),
      votos: [
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 7000
          },
          {
                  "zona": 5,
                  "ra": "Guará",
                  "votos": 5000
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 4537
          }
  ]
    },
    {
      nome_urna: "Arlete Sampaio",
      nome_completo: "Arlete de Sampaio",
      partido: "PT",
      ano_eleicao: 2018,
      total_votos: 15537,
      foto_url: "/assets/fotos/arlete_sampaio.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 140000,
      despesas_contratadas: 132000,
      despesas_pagas: 128000,
      maior_fornecedor_nome: "Mídia Popular",
      maior_fornecedor_valor: 28000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":60000},{"category":"Atividades de Militância","value":45000},{"category":"Combustíveis","value":27000}]),
      votos: [
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 8000
          },
          {
                  "zona": 5,
                  "ra": "Guará",
                  "votos": 4000
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 3537
          }
  ]
    },
    {
      nome_urna: "Cláudio Abrantes",
      nome_completo: "Cláudio Abrantes",
      partido: "PDT",
      ano_eleicao: 2018,
      total_votos: 14238,
      foto_url: "/assets/fotos/claudio_abrantes.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 130000,
      despesas_contratadas: 122000,
      despesas_pagas: 118000,
      maior_fornecedor_nome: "Gráfica Planaltina Central",
      maior_fornecedor_valor: 25000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":55000},{"category":"Serviços de Terceiros","value":40000},{"category":"Combustíveis","value":27000}]),
      votos: [
          {
                  "zona": 11,
                  "ra": "Planaltina",
                  "votos": 7500
          },
          {
                  "zona": 2,
                  "ra": "Sobradinho",
                  "votos": 4000
          },
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 2738
          }
  ]
    },
    {
      nome_urna: "Jaqueline Silva",
      nome_completo: "Jaqueline Angela da Silva",
      partido: "PTB",
      ano_eleicao: 2018,
      total_votos: 13106,
      foto_url: "/assets/fotos/jaqueline_silva.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 110000,
      despesas_contratadas: 105000,
      despesas_pagas: 100000,
      maior_fornecedor_nome: "Comunicação Brasília",
      maior_fornecedor_valor: 22000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":45000},{"category":"Militância de Rua","value":35000},{"category":"Combustíveis","value":25000}]),
      votos: [
          {
                  "zona": 15,
                  "ra": "Santa Maria",
                  "votos": 6500
          },
          {
                  "zona": 4,
                  "ra": "Gama",
                  "votos": 4000
          },
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 2606
          }
  ]
    },
    {
      nome_urna: "Jorge Vianna",
      nome_completo: "Jorge Vianna de Sousa",
      partido: "PODE",
      ano_eleicao: 2018,
      total_votos: 13070,
      foto_url: "/assets/fotos/jorge_vianna.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 120000,
      despesas_contratadas: 112000,
      despesas_pagas: 108000,
      maior_fornecedor_nome: "Editora Distrito S.A.",
      maior_fornecedor_valor: 26000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":50000},{"category":"Produção de Redes Sociais","value":35000},{"category":"Combustíveis","value":27000}]),
      votos: [
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 6000
          },
          {
                  "zona": 13,
                  "ra": "Samambaia",
                  "votos": 4500
          },
          {
                  "zona": 6,
                  "ra": "Ceilândia",
                  "votos": 2570
          }
  ]
    },
    {
      nome_urna: "Iolando",
      nome_completo: "Iolando Almeida de Souza",
      partido: "PSC",
      ano_eleicao: 2018,
      total_votos: 13000,
      foto_url: "/assets/fotos/iolando.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 110000,
      despesas_contratadas: 105000,
      despesas_pagas: 100000,
      maior_fornecedor_nome: "Gráfica Taguatinga Central",
      maior_fornecedor_valor: 20000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Materiais Impressos","value":45000},{"category":"Atividades de Militância","value":25000},{"category":"Serviços de Terceiros","value":15000},{"category":"Locação de Veículos","value":12000},{"category":"Combustíveis","value":8000}]),
      votos: [
          {
                  "zona": 10,
                  "ra": "Brazlândia",
                  "votos": 7500
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 2100
          },
          {
                  "zona": 6,
                  "ra": "Ceilândia",
                  "votos": 3400
          }
  ]
    },
    {
      nome_urna: "Eduardo Pedrosa",
      nome_completo: "Eduardo Souza Pedrosa",
      partido: "PTC",
      ano_eleicao: 2018,
      total_votos: 12806,
      foto_url: "/assets/fotos/eduardo_pedrosa.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 180000,
      despesas_contratadas: 170000,
      despesas_pagas: 165000,
      maior_fornecedor_nome: "Consultoria Alvorada S/C",
      maior_fornecedor_valor: 40000,
      detalhe_despesas: JSON.stringify([{"category":"Serviços Prestados por Terceiros","value":65000},{"category":"Publicidade por Materiais Impressos","value":50000},{"category":"Locação de Veículos","value":25000},{"category":"Combustíveis","value":18000},{"category":"Despesas Administrativas","value":12000}]),
      votos: [
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 5200
          },
          {
                  "zona": 16,
                  "ra": "São Sebastião",
                  "votos": 2900
          },
          {
                  "zona": 8,
                  "ra": "Paranoá",
                  "votos": 4706
          }
  ]
    },
    {
      nome_urna: "João Cardoso",
      nome_completo: "João Cardoso da Silva",
      partido: "AVANTE",
      ano_eleicao: 2018,
      total_votos: 12654,
      foto_url: "/assets/fotos/joao_cardoso.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 110000,
      despesas_contratadas: 102000,
      despesas_pagas: 98000,
      maior_fornecedor_nome: "Gráfica Sobradinho Comunicações",
      maior_fornecedor_valor: 22000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":45000},{"category":"Atividades de Militância","value":35000},{"category":"Combustíveis","value":22000}]),
      votos: [
          {
                  "zona": 2,
                  "ra": "Sobradinho",
                  "votos": 7500
          },
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 3000
          },
          {
                  "zona": 5,
                  "ra": "Guará",
                  "votos": 2154
          }
  ]
    },
    {
      nome_urna: "Roosevelt Vilela",
      nome_completo: "Roosevelt Vilela Pires",
      partido: "PSB",
      ano_eleicao: 2018,
      total_votos: 12257,
      foto_url: "/assets/fotos/roosevelt_vilela.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 120000,
      despesas_contratadas: 112000,
      despesas_pagas: 108000,
      maior_fornecedor_nome: "Gráfica do DF Central",
      maior_fornecedor_valor: 26000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":50000},{"category":"Atividades de Militância","value":35000},{"category":"Combustíveis","value":27000}]),
      votos: [
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 5000
          },
          {
                  "zona": 5,
                  "ra": "Guará",
                  "votos": 4000
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 3257
          }
  ]
    },
    {
      nome_urna: "Hermeto",
      nome_completo: "Joao Hermeto de Oliveira Neto",
      partido: "PHS",
      ano_eleicao: 2018,
      total_votos: 11552,
      foto_url: "/assets/fotos/hermeto.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 115000,
      despesas_contratadas: 108000,
      despesas_pagas: 104000,
      maior_fornecedor_nome: "Mídia Bandeirante",
      maior_fornecedor_valor: 24000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":45000},{"category":"Atividades de Militância","value":35000},{"category":"Combustíveis","value":28000}]),
      votos: [
          {
                  "zona": 21,
                  "ra": "Núcleo Bandeirante",
                  "votos": 6500
          },
          {
                  "zona": 5,
                  "ra": "Guará",
                  "votos": 3000
          },
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 2052
          }
  ]
    },
    {
      nome_urna: "Fábio Felix",
      nome_completo: "Fábio Felix Silveira",
      partido: "PSOL",
      ano_eleicao: 2018,
      total_votos: 10955,
      foto_url: "/assets/fotos/fabio_felix.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 90000,
      despesas_contratadas: 85000,
      despesas_pagas: 82000,
      maior_fornecedor_nome: "Coletivo Cultural do DF",
      maior_fornecedor_valor: 12000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Materiais Impressos","value":32000},{"category":"Atividades de Militância","value":22000},{"category":"Produção de Vídeo e Redes Sociais","value":15000},{"category":"Despesas Administrativas","value":10000},{"category":"Combustíveis","value":6000}]),
      votos: [
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 4100
          },
          {
                  "zona": 5,
                  "ra": "Guará",
                  "votos": 2100
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 4755
          }
  ]
    },
    {
      nome_urna: "Valdelino Barcelos",
      nome_completo: "Valdelino Barcelos",
      partido: "PP",
      ano_eleicao: 2018,
      total_votos: 9704,
      foto_url: "/assets/fotos/valdelino_barcelos.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 100000,
      despesas_contratadas: 92000,
      despesas_pagas: 88000,
      maior_fornecedor_nome: "Gráfica do DF Central",
      maior_fornecedor_valor: 20000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":40000},{"category":"Militância de Rua","value":30000},{"category":"Combustíveis","value":22000}]),
      votos: [
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 4000
          },
          {
                  "zona": 5,
                  "ra": "Guará",
                  "votos": 3000
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 2704
          }
  ]
    },
    {
      nome_urna: "Daniel Donizet",
      nome_completo: "Daniel Donizet de Oliveira",
      partido: "PRP",
      ano_eleicao: 2018,
      total_votos: 9128,
      foto_url: "/assets/fotos/daniel_donizet.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 95000,
      despesas_contratadas: 88000,
      despesas_pagas: 84000,
      maior_fornecedor_nome: "Gráfica Gama Sul",
      maior_fornecedor_valor: 18000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":38000},{"category":"Militância de Rua","value":30000},{"category":"Combustíveis","value":20000}]),
      votos: [
          {
                  "zona": 4,
                  "ra": "Gama",
                  "votos": 4500
          },
          {
                  "zona": 15,
                  "ra": "Santa Maria",
                  "votos": 3000
          },
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 1628
          }
  ]
    },
    {
      nome_urna: "Júlia Lucy",
      nome_completo: "Júlia Lucy",
      partido: "NOVO",
      ano_eleicao: 2018,
      total_votos: 7655,
      foto_url: "/assets/fotos/julia_lucy.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 85000,
      despesas_contratadas: 78000,
      despesas_pagas: 74000,
      maior_fornecedor_nome: "Digital Ads DF",
      maior_fornecedor_valor: 15000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade em Redes Sociais","value":35000},{"category":"Publicidade por Impressos","value":25000},{"category":"Despesas Administrativas","value":18000}]),
      votos: [
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 4000
          },
          {
                  "zona": 5,
                  "ra": "Guará",
                  "votos": 2000
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 1655
          }
  ]
    },
    {
      nome_urna: "Reginaldo Sardinha",
      nome_completo: "Reginaldo Sardinha",
      partido: "AVANTE",
      ano_eleicao: 2018,
      total_votos: 6738,
      foto_url: "/assets/fotos/reginaldo_sardinha.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 75000,
      despesas_contratadas: 68000,
      despesas_pagas: 65000,
      maior_fornecedor_nome: "Gráfica do Cruzeiro",
      maior_fornecedor_valor: 12000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":30000},{"category":"Militância de Rua","value":25000},{"category":"Combustíveis","value":13000}]),
      votos: [
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 3000
          },
          {
                  "zona": 5,
                  "ra": "Guará",
                  "votos": 2000
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 1738
          }
  ]
    },
    {
      nome_urna: "Leandro Grass",
      nome_completo: "Leandro Grass",
      partido: "REDE",
      ano_eleicao: 2018,
      total_votos: 6578,
      foto_url: "/assets/fotos/leandro_grass.jpg",
      cargo: "Deputado Distrital",
      situacao: "Eleito",
      receitas: 70000,
      despesas_contratadas: 64000,
      despesas_pagas: 60000,
      maior_fornecedor_nome: "Editora Verde DF",
      maior_fornecedor_valor: 11000,
      detalhe_despesas: JSON.stringify([{"category":"Publicidade por Impressos","value":28000},{"category":"Produção de Vídeo","value":22000},{"category":"Combustíveis","value":14000}]),
      votos: [
          {
                  "zona": 1,
                  "ra": "Plano Piloto",
                  "votos": 3500
          },
          {
                  "zona": 5,
                  "ra": "Guará",
                  "votos": 2000
          },
          {
                  "zona": 3,
                  "ra": "Taguatinga",
                  "votos": 1078
          }
  ]
    }
  ];

  const allToSeed = [...candidates2022, ...candidates2018];

  for (const cand of allToSeed) {
    const insertCandResult = await new Promise<any>((resolve, reject) => {
      db.run(
        `INSERT INTO Candidatos (nome_urna, nome_completo, partido, ano_eleicao, total_votos, foto_url, cargo, situacao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [cand.nome_urna, cand.nome_completo, cand.partido, cand.ano_eleicao, cand.total_votos, cand.foto_url, cand.cargo, cand.situacao],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    const candId = insertCandResult;

    await dbRun(
      `INSERT INTO Resumo_Financeiro (id_candidato, total_receitas, despesas_contratadas, despesas_pagas, maior_fornecedor_nome, maior_fornecedor_valor, detalhe_despesas)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [candId, cand.receitas, cand.despesas_contratadas, cand.despesas_pagas, cand.maior_fornecedor_nome, cand.maior_fornecedor_valor, cand.detalhe_despesas]
    );

    for (const v of cand.votos) {
      await dbRun(
        `INSERT INTO Geoeleitoral_Votos (id_candidato, zona_eleitoral, ra_nome, votos)
         VALUES (?, ?, ?, ?)`,
        [candId, v.zona, v.ra, v.votos]
      );
    }
  }

  console.log("Database seeded successfully with 2022 & 2018 CLDF candidates!");
  console.log("Seeding 2014 candidates on initial run...");
  await seed2014();
}

// Ensure database setup completes
initDatabase().catch(err => {
  console.error("DATABASE INIT ERROR:", err);
  fs.writeFileSync(path.join(process.cwd(), "db_error.txt"), err.stack || err.message || String(err));
});

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

startServer();
