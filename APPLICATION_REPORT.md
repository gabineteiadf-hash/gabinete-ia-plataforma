# Relatório do Aplicativo: Gabinete IA - Engenharia Geoeleitoral

## Visão Geral
O Gabinete IA é uma plataforma avançada de análise de dados eleitorais e financeiros, focada na CLDF (Câmara Legislativa do Distrito Federal). O objetivo é fornecer transparência e insights estratégicos sobre o desempenho, gastos e eficiência dos Deputados Distritais ao longo de diferentes legislaturas.

## Stack Tecnológica
- **Frontend**: React (18+) com TypeScript, Vite.
- **Backend**: Express.js (Node.js) rodando em um container no Google Cloud Run.
- **Banco de Dados**: SQLite (`eleicoes.db`) para armazenamento local/persistente dos dados eleitorais.
- **Integração de IA**: API Gemini (via `@google/genai` SDK) para o "Oráculo do Gabinete IA" (assistente inteligente).
- **Estilização**: Tailwind CSS.
- **Análise de Dados**: Processamento de arquivos Excel/CSV para atualização de base de dados.

## Funcionalidades Principais
1. **Engenharia Geoeleitoral**: Painel interativo para visualizar resultados e métricas eleitorais (2014, 2018, 2022). Permite filtrar por candidato, comparar gastos e eficiência de votos.
2. **Oráculo do Gabinete IA**: Chatbot inteligente integrado à base de dados para responder perguntas complexas sobre gastos de campanha, fornecedores e eficiência de votos.
3. **Auditoria IA**: Ferramenta de auditoria para analisar inconsistências ou padrões em dados financeiros.
4. **Resiliência e Proxy de Fotos**: O aplicativo possui um mecanismo robusto de carregamento de fotos de candidatos, com múltiplos fallbacks (proxy local, URL direta do Drive, placeholders).

## Estrutura do Banco de Dados
A aplicação utiliza um banco de dados SQLite (`eleicoes.db`) contendo tabelas para:
- Deputados
- Resultados eleitorais por ano
- Gastos de campanha
- Informações geoeleitorais

A atualização é feita através de scripts TypeScript que processam arquivos planilhas (.xlsx/.csv).

## Integração IA (Gemini)
O Oráculo utiliza os modelos Gemini via backend para garantir a segurança da chave de API e para realizar consultas complexas no SQLite através de um sistema de orquestração. Implementa padrões de resiliência (retry com backoff exponencial para erros 503 e 429).
