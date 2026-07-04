# Gabinete IA - DivulgaCandContas_TSE

## Objetivo do projeto
Este projeto é uma plataforma de monitoramento político-eleitoral focada nos deputados distritais do Distrito Federal. O app combina:

- dados eleitorais e financeiros de candidatos eleitos
- visualização de gastos e comparação de despesas
- histórico de candidatura por ano
- navegação por portais de finanças, votos e inteligência
- análise assistida por IA usando Google Gemini
- carregamento de fotos de candidatos a partir de URL mapeadas no banco

## Arquitetura geral

### Backend
- `server.ts` (Express + Vite + SQLite)
  - `GET /api/eleitos/{ano}`: lista dos eleitos por ano e dados financeiros
  - `GET /api/historico_politico/{nome_urna}/{ano}`: retorna dados de um candidato em um ano específico + `anos_disputados`
  - `GET /api/analise/{ano}`: gera análise de IA para o top 10 de despesas
  - `POST /api/oraculo`: gera consultas/insights baseados no banco (batch / oráculo)
  - Rota `/` serve a interface React compilada.

### Frontend
- interface única com cards de portal e painel de conteúdo
- carrega a lista de candidatos via `fetch('/api/eleitos/{ano}')`
- abre dossiê de candidato e busca histórico via `fetch('/api/historico_politico/{nome}/{ano}')`
- usa `cand.foto_url` enviado pelo backend para renderizar fotos
- exibe fallback SVG quando `foto_url` não está disponível
- botões de ano fixos e controles de navegação entre ciclos eleitorais

## Dados
- SQLite: `eleicoes.db`
- Tabelas principais:
  - `Candidatos(id_candidato, nome_urna, partido, ano_eleicao, total_votos, foto_url, ...)`
  - `Resumo_Financeiro(id_candidato, total_receitas, total_despesas, maior_fornecedor_nome, maior_fornecedor_valor)`
