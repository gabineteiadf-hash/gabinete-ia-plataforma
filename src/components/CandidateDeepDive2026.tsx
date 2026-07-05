import React, { useState, useEffect, useRef } from "react";
import { 
  Brain, 
  ShieldAlert, 
  AlertTriangle, 
  Target, 
  FileText, 
  ExternalLink, 
  TrendingUp, 
  Sparkles, 
  Clock, 
  AlertCircle, 
  Download, 
  LogOut,
  MapPin,
  Instagram,
  Facebook,
  Award,
  Users,
  Activity,
  ThumbsUp,
  MessageSquare,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Layers,
  Grid,
  Calendar,
  Mic,
  Volume2,
  Briefcase,
  Percent,
  BarChart3,
  HelpCircle,
  Send
} from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "user" | "oraculo";
  text: string;
  timestamp: Date;
}

interface ClippingItem {
  id_clipping: number;
  id_candidato: number;
  titulo: string;
  fonte: string;
  url: string;
  data_publicacao: string;
  resumo_curto: string;
  resumo_executivo: string;
  sentimento: string;
  impacto_score: number;
  tema_principal: string;
  deputados_mencionados: string | string[];
  partidos_citados: string | string[];
  orgaos_envolvidos: string | string[];
  palavras_chave: string | string[];
  riscos: string | string[];
  oportunidades: string | string[];
}

interface Candidate {
  id_candidato: number;
  nome_urna: string;
  nome_completo: string;
  partido: string;
  ano_eleicao: number;
  total_votos: number;
  foto_url: string;
  cargo: string;
  situacao: string;
}

interface CandidateDeepDive2026Props {
  selectedCandidate: Candidate;
  onExitProfile: () => void;
  onExportPDF: () => void;
  setOraculoInput: (value: string) => void;
  setActiveTab: (tab: any) => void;
  oraculoChat: ChatMessage[];
  sendingOraculo: boolean;
  handleSendOraculo: (e?: React.FormEvent) => Promise<void>;
  autoSpeakEnabled: boolean;
  handleSetAutoSpeak: (enabled: boolean) => void;
}

const getInitials = (name: string): string => {
  if (!name) return "C";
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
};

export const CandidateDeepDive2026: React.FC<CandidateDeepDive2026Props> = ({
  selectedCandidate,
  onExitProfile,
  onExportPDF,
  setOraculoInput,
  setActiveTab,
  oraculoChat,
  sendingOraculo,
  handleSendOraculo,
  autoSpeakEnabled,
  handleSetAutoSpeak
}) => {
  // Navigation active tab sub-state
  const [activeSubTab, setActiveSubTab] = useState<
    "geral" | "reputacao" | "redes" | "oraculo" | "geoeleitoral" | "benchmark" | "cruzamento" | "demandas" | "marketing" | "campanhas"
  >("geral");

  // Collapsible Sidebar Menus (Accordions)
  const [openMonitoramento, setOpenMonitoramento] = useState<boolean>(true);
  const [openEngenharia, setOpenEngenharia] = useState<boolean>(true);
  const [openCampanhas, setOpenCampanhas] = useState<boolean>(true);

  // Core content state loaded from API
  const [clippings, setClippings] = useState<ClippingItem[]>([]);
  const [apiData, setApiData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Marketing age group selector
  const [selectedDemographic, setSelectedDemographic] = useState<"jovens" | "adultos" | "seniors">("jovens");

  // Local Oráculo input state
  const [localChatInput, setLocalChatInput] = useState<string>("");
  const localChatEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch both endpoints
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchReputacao = fetch(`/api/reputacao/${selectedCandidate.id_candidato}`).then(res => {
      if (!res.ok) throw new Error("Erro de Reputação");
      return res.json();
    });

    const fetchCampanhas = fetch(`/api/campanhas-2026/${selectedCandidate.id_candidato}`).then(res => {
      if (!res.ok) throw new Error("Erro de Campanhas");
      return res.json();
    });

    Promise.all([fetchReputacao, fetchCampanhas])
      .then(([reputacaoData, campanhasData]) => {
        if (isMounted) {
          setClippings(Array.isArray(reputacaoData) ? reputacaoData : []);
          setApiData(campanhasData);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Erro ao sincronizar dados do deep dive:", err);
        if (isMounted) {
          setClippings([]);
          setApiData(null);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCandidate.id_candidato]);

  // Scroll local chat to bottom on updates
  useEffect(() => {
    localChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [oraculoChat]);

  // Handle Analisar com IA click from news card
  const handleAnalyzeWithAI = (titulo: string, resumo: string) => {
    const promptText = `Analise o impacto político desta notícia atual para o candidato ${selectedCandidate.nome_urna}: [${titulo.toUpperCase()} - ${resumo}]`;
    setLocalChatInput(promptText);
    
    setTimeout(() => {
      const inputEl = document.getElementById("oraculo-chat-input-fixed");
      if (inputEl) {
        inputEl.scrollIntoView({ behavior: "smooth" });
        inputEl.focus();
      }
    }, 150);
  };

  // Sends recommendation prompts directly to Oraculo from marketing tab
  const handleSendPromptToOraculo = (promptText: string) => {
    setLocalChatInput(promptText);
    setTimeout(() => {
      const inputEl = document.getElementById("oraculo-chat-input-fixed");
      if (inputEl) {
        inputEl.scrollIntoView({ behavior: "smooth" });
        inputEl.focus();
      }
    }, 150);
  };

  // Submit local chat inside candidate profile
  const handleLocalChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localChatInput.trim()) return;
    setOraculoInput(localChatInput.trim());
    setLocalChatInput("");
    // Give state time to update
    setTimeout(() => {
      handleSendOraculo();
    }, 35);
  };

  // Pre-process sentiment arrays for clipping carousels
  const alertsClippings = clippings.filter(clip => {
    const sent = (clip.sentimento || "").toLowerCase();
    return sent.includes("negativ") || sent.includes("crise") || sent.includes("alerta");
  });

  const opportunitiesClippings = clippings.filter(clip => {
    const sent = (clip.sentimento || "").toLowerCase();
    return !sent.includes("negativ") && !sent.includes("crise") && !sent.includes("alerta");
  });

  // Marketing demographics data
  const demographicDetails = {
    jovens: {
      title: "Eleitores Jovens (16-24 anos)",
      focus: "Redes Sociais, Cultura, Emprego e Tecnologia",
      tone: "Dinâmico, inclusivo, visual e focado em engajamento digital rápido.",
      strategy: apiData?.assistente_persuasao?.sugestao_conteudo || "Focar em mídias rápidas como TikTok e Reels, enfatizando propostas de fomento cultural e passe-livre estudantil.",
      prompt: `Crie um roteiro de vídeo curto (Reels/TikTok) de 60 segundos focado em eleitores jovens (16-24 anos) para o candidato ${selectedCandidate.nome_urna}, destacando pautas de fomento à cultura periférica, passe livre estudantil e tecnologia, utilizando tom dinâmico.`
    },
    adultos: {
      title: "Adultos Ativos (25-59 anos)",
      focus: "Emprego, Segurança, Saúde e Infraestrutura Urbana",
      tone: "Objetivo, realista, com foco em propostas concretas e impacto imediato.",
      strategy: "Campanhas focadas em soluções de infraestrutura regional, geração de emprego no DF e melhoria das linhas do BRT.",
      prompt: `Gere uma pauta de propostas legislativas para o candidato ${selectedCandidate.nome_urna} com foco nos eleitores adultos ativos (25-59 anos), abordando propostas de empregabilidade, regularização fundiária e melhoria do transporte público local no DF.`
    },
    seniors: {
      title: "Eleitores Sêniors (60-70 anos)",
      focus: "Saúde, Assistência Social e Segurança Pública",
      tone: "Acolhedor, respeitoso, didático e focado na dignidade e bem-estar.",
      strategy: "Utilização de discursos tradicionais, folhetos impressos e postagens informativas sobre projetos sociais e farmácia de alto custo.",
      prompt: `Escreva um discurso curto de comício focado em eleitores da terceira idade (60-70 anos) para o candidato ${selectedCandidate.nome_urna}, enfatizando o fortalecimento do SUS local, remédios na farmácia de alto custo e espaços de convivência urbana.`
    }
  };

  const activeDemo = demographicDetails[selectedDemographic];

  // Scraping defaults
  const scraping = apiData?.scraping_redes || {
    plataforma: "Instagram",
    tempo: "Há 2 horas",
    ultimo_post: "Focando no diálogo com a comunidade. Juntos podemos transformar as demandas locais em projetos reais.",
    likes: 1250,
    comentarios: 340,
    engajamento: "3.8%"
  };

  // Local demands
  const demandas = apiData?.mapeamento_demandas || [
    { regiao_administrativa: "Ceilândia", ponto_de_dor: "Falta de iluminação pública em quadras residenciais", diretriz_recomendada: "Indicação de infraestrutura de LED", urgencia: "CRÍTICA" },
    { regiao_administrativa: "Taguatinga", ponto_de_dor: "Saturação de tráfego no centro comercial", diretriz_recomendada: "Proposta de semaforização inteligente", urgencia: "ALTA" },
    { regiao_administrativa: "Samambaia", ponto_de_dor: "Déficit de vagas em creches públicas", diretriz_recomendada: "Fomento a creches conveniadas via orçamento", urgencia: "CRÍTICA" }
  ];

  // Geoeleitoral details
  const getGeoeleitoralDetails = (name: string) => {
    const norm = name.toLowerCase();
    if (norm.includes("felix") || norm.includes("jane")) {
      return {
        regioes: [
          { ra: "Asa Sul", votos: 14200, percentual: 45, status: "Dominante" },
          { ra: "Asa Norte", votos: 11900, percentual: 38, status: "Dominante" },
          { ra: "Sudoeste / Octogonal", votos: 7600, percentual: 24, status: "Competitivo" },
          { ra: "Águas Claras", votos: 6500, percentual: 18, status: "Moderado" },
          { ra: "Taguatinga", votos: 3400, percentual: 8, status: "Desafiador" }
        ],
        focoRegional: "Zona Central e de servidores públicos de alta escolaridade. Necessita estender penetração nas RAs periféricas do DF."
      };
    } else if (norm.includes("vigilante")) {
      return {
        regioes: [
          { ra: "Ceilândia", votos: 28400, percentual: 58, status: "Dominante" },
          { ra: "Samambaia", votos: 14100, percentual: 35, status: "Dominante" },
          { ra: "Taguatinga", votos: 12300, percentual: 29, status: "Competitivo" },
          { ra: "Sol Nascente / Pôr do Sol", votos: 9800, percentual: 42, status: "Dominante" },
          { ra: "Asa Sul", votos: 1200, percentual: 3, status: "Desafiador" }
        ],
        focoRegional: "Altíssima capilaridade nas RAs mais populosas do DF Ocidental (Ceilândia e Samambaia). Base operária e de baixa renda muito forte."
      };
    } else if (norm.includes("maciel")) {
      return {
        regioes: [
          { ra: "Ceilândia", votos: 18900, percentual: 39, status: "Dominante" },
          { ra: "Sol Nascente", votos: 8100, percentual: 32, status: "Dominante" },
          { ra: "Samambaia", votos: 6500, percentual: 16, status: "Competitivo" },
          { ra: "Taguatinga", votos: 4800, percentual: 11, status: "Moderado" },
          { ra: "Cruzeiro", votos: 1100, percentual: 4, status: "Desafiador" }
        ],
        focoRegional: "Cinturão de cultura periférica e movimentos de juventude em Ceilândia e Sol Nascente. Desafio é capitalizar votos de infraestrutura urbana sólida."
      };
    } else if (norm.includes("pedrosa")) {
      return {
        regioes: [
          { ra: "Sobradinho", votos: 16400, percentual: 41, status: "Dominante" },
          { ra: "Planaltina", votos: 12500, percentual: 28, status: "Dominante" },
          { ra: "Sobradinho II", votos: 8900, percentual: 34, status: "Dominante" },
          { ra: "Lago Norte", votos: 4100, percentual: 14, status: "Competitivo" },
          { ra: "Paranoá", votos: 3200, percentual: 9, status: "Moderado" }
        ],
        focoRegional: "Liderança de votos consolidada no vetor norte (Sobradinho e Planaltina). Discurso muito atrativo para microempresários e saúde local."
      };
    } else {
      return {
        regioes: [
          { ra: "Ceilândia", votos: 12500, percentual: 25, status: "Competitivo" },
          { ra: "Taguatinga", votos: 9400, percentual: 22, status: "Competitivo" },
          { ra: "Samambaia", votos: 8100, percentual: 19, status: "Moderado" },
          { ra: "Gama", votos: 6200, percentual: 15, status: "Moderado" },
          { ra: "Guará", votos: 4300, percentual: 11, status: "Desafiador" }
        ],
        focoRegional: "Distribuição eleitoral dispersa. Necessita focar na RA sede para alavancar coeficiente de votação em bloco seguro."
      };
    }
  };

  const geoData = getGeoeleitoralDetails(selectedCandidate.nome_urna);

  const getBenchmarkMetrics = (name: string) => {
    const norm = name.toLowerCase();
    const rateVal = parseFloat(scraping.engajamento) || 3.5;

    return {
      custoPorVotoPrevisto: norm.includes("felix") || norm.includes("jane") ? "R$ 4.20" : norm.includes("vigilante") ? "R$ 3.80" : "R$ 5.10",
      mediaDFPorVoto: "R$ 6.35",
      eficienciaEscore: norm.includes("vigilante") || norm.includes("felix") || norm.includes("jane") ? "94/100 (Ótimo)" : "78/100 (Médio)",
      ratingEngajamento: rateVal > 3.0 ? "Excelente" : "Regular",
      taxaCrescimentoDigital: "+18.4% (Acima da Média)",
      alcanceDigitalEstimado: "120k visualizações/semana"
    };
  };

  const benchmark = getBenchmarkMetrics(selectedCandidate.nome_urna);

  // loading handler
  if (loading) {
    return (
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-16 flex flex-col items-center justify-center gap-4 text-center min-h-[450px]">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin"></div>
        <div>
          <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Sincronizando Plataforma de Inteligência 2026</h4>
          <p className="text-xs text-slate-500 mt-1">Carregando análise de sentimento, cruzamento de dados de varredura e console de marketing...</p>
        </div>
      </div>
    );
  }

  // Intelligence dynamic badges setup
  const isJane = selectedCandidate.nome_urna.toLowerCase().includes("jane") || selectedCandidate.nome_completo.toLowerCase().includes("jane");
  const totalVotesFormatted = selectedCandidate.total_votos ? selectedCandidate.total_votos.toLocaleString("pt-BR") : "36.555";

  return (
    <div className="w-full grid grid-cols-1 xl:grid-cols-12 gap-6 text-slate-200 items-start" id="deep-dive-workspace-2026">
      
      {/* ================= COLUMN 1 (3/12 Cols): ANCHOR CARD & CONTROL MENU SIDEBAR ================= */}
      <div className="col-span-1 xl:col-span-3 flex flex-col gap-4">
        
        {/* PROFILE ANCHOR CARD with Glassmorphism */}
        <div className="bg-slate-900/40 backdrop-blur-lg border border-slate-700/85 rounded-2xl p-5 text-center space-y-4 shadow-[0_4px_30px_rgba(0,0,0,0.4)] relative overflow-hidden">
          {/* Top ambient colored line matching cyan and fuchsia theme */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500"></div>
          
          {/* Avatar frame */}
          <div className="relative pt-2">
            <div className="w-24 h-24 rounded-full border-4 border-cyan-500/30 bg-slate-950/80 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(34,211,238,0.2)] overflow-hidden transition-all duration-300">
              {selectedCandidate.foto_url ? (
                <img 
                  src={selectedCandidate.foto_url} 
                  alt={selectedCandidate.nome_urna} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <span className="text-2xl font-black text-cyan-400 font-mono">
                  {getInitials(selectedCandidate.nome_urna)}
                </span>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-1.5">
            <span className="inline-block px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-cyan-950/50 text-cyan-300 border border-cyan-900/40">
              {selectedCandidate.partido}
            </span>
            <h3 className="text-lg font-black tracking-tight text-white uppercase mt-1.5 truncate">
              {selectedCandidate.nome_urna}
            </h3>
            <p className="text-[9px] text-slate-400 font-extrabold tracking-widest uppercase">
              {selectedCandidate.cargo || "DEPUTADO DISTRITAL"}
            </p>
          </div>

          {/* Status Badge */}
          <div className="bg-slate-950/60 py-2 px-3 border border-slate-800/80 rounded-xl flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400">Gabinete IA Conectado</span>
          </div>

          {/* Exit & Export Quick Actions */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              id="btn-exportar-pdf-2026"
              onClick={onExportPDF}
              title="Exportar Dossiê de Inteligência"
              className="flex items-center justify-center gap-1.5 py-2 px-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-[10px] font-black rounded-lg transition-all cursor-pointer border border-indigo-500/20 shadow-lg"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar PDF</span>
            </button>

            <button
              id="btn-sair-perfil-2026"
              onClick={onExitProfile}
              title="Sair do Perfil e Voltar"
              className="flex items-center justify-center gap-1.5 py-2 px-2 bg-slate-950/80 hover:bg-slate-850/80 border border-slate-800 text-slate-400 hover:text-white text-[10px] font-black rounded-lg transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        {/* ACCORDION VERTICAL NAVIGATION MENU */}
        <div className="bg-slate-900/40 backdrop-blur-lg border border-slate-700/85 rounded-2xl p-3.5 shadow-xl space-y-3.5 text-left">
          <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase px-2 block">Sistemas de Comando</span>
          
          {/* VISÃO GERAL */}
          <button
            onClick={() => setActiveSubTab("geral")}
            className={`w-full py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer ${
              activeSubTab === "geral"
                ? "bg-gradient-to-r from-cyan-500/10 to-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)] border border-cyan-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-850/30"
            }`}
          >
            <Grid className="w-4 h-4 text-cyan-500" />
            <span>Visão Geral</span>
          </button>

          {/* ACCORDION 1: MONITORAMENTO DIGITAL */}
          <div className="space-y-1">
            <button
              onClick={() => setOpenMonitoramento(!openMonitoramento)}
              className="w-full py-1.5 px-2 rounded-lg text-[10px] font-extrabold text-slate-400 hover:text-slate-200 uppercase tracking-wider flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-fuchsia-400" />
                <span>📂 Monitoramento Digital</span>
              </span>
              {openMonitoramento ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
            </button>
            
            {openMonitoramento && (
              <div className="pl-3.5 border-l border-slate-800 ml-2.5 space-y-1.5 pt-1">
                <button
                  onClick={() => setActiveSubTab("reputacao")}
                  className={`w-full py-2 px-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                    activeSubTab === "reputacao"
                      ? "bg-cyan-950/40 text-cyan-400 border border-cyan-900/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-850/30"
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Reputação & Mídia</span>
                </button>
                <button
                  onClick={() => setActiveSubTab("redes")}
                  className={`w-full py-2 px-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                    activeSubTab === "redes"
                      ? "bg-fuchsia-950/40 text-fuchsia-400 border border-fuchsia-900/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-850/30"
                  }`}
                >
                  <Instagram className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span>Redes Sociais</span>
                </button>
                <button
                  onClick={() => setActiveSubTab("oraculo")}
                  className={`w-full py-2 px-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                    activeSubTab === "oraculo"
                      ? "bg-cyan-950/40 text-cyan-400 border border-cyan-900/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-850/30"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Oráculo Local</span>
                </button>
              </div>
            )}
          </div>

          {/* ACCORDION 2: ENGENHARIA & HISTÓRICO */}
          <div className="space-y-1">
            <button
              onClick={() => setOpenEngenharia(!openEngenharia)}
              className="w-full py-1.5 px-2 rounded-lg text-[10px] font-extrabold text-slate-400 hover:text-slate-200 uppercase tracking-wider flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-cyan-400" />
                <span>📂 Engenharia & Histórico</span>
              </span>
              {openEngenharia ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
            </button>
            
            {openEngenharia && (
              <div className="pl-3.5 border-l border-slate-800 ml-2.5 space-y-1.5 pt-1">
                <button
                  onClick={() => setActiveSubTab("geoeleitoral")}
                  className={`w-full py-2 px-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                    activeSubTab === "geoeleitoral"
                      ? "bg-cyan-950/40 text-cyan-400 border border-cyan-900/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-850/30"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Eng. Geoeleitoral</span>
                </button>
                <button
                  onClick={() => setActiveSubTab("benchmark")}
                  className={`w-full py-2 px-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                    activeSubTab === "benchmark"
                      ? "bg-fuchsia-950/40 text-fuchsia-400 border border-fuchsia-900/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-850/30"
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span>Benchmark</span>
                </button>
                <button
                  onClick={() => setActiveSubTab("cruzamento")}
                  className={`w-full py-2 px-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                    activeSubTab === "cruzamento"
                      ? "bg-cyan-950/40 text-cyan-400 border border-cyan-900/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-850/30"
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Cruzamento</span>
                </button>
              </div>
            )}
          </div>

          {/* ACCORDION 3: CAMPANHA EM CAMPO */}
          <div className="space-y-1">
            <button
              onClick={() => setOpenCampanhas(!openCampanhas)}
              className="w-full py-1.5 px-2 rounded-lg text-[10px] font-extrabold text-slate-400 hover:text-slate-200 uppercase tracking-wider flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4 text-fuchsia-400" />
                <span>📂 Campanha em Campo</span>
              </span>
              {openCampanhas ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
            </button>
            
            {openCampanhas && (
              <div className="pl-3.5 border-l border-slate-800 ml-2.5 space-y-1.5 pt-1">
                <button
                  onClick={() => setActiveSubTab("demandas")}
                  className={`w-full py-2 px-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                    activeSubTab === "demandas"
                      ? "bg-cyan-950/40 text-cyan-400 border border-cyan-900/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-850/30"
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Demandas Locais</span>
                </button>
                <button
                  onClick={() => setActiveSubTab("marketing")}
                  className={`w-full py-2 px-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                    activeSubTab === "marketing"
                      ? "bg-fuchsia-950/40 text-fuchsia-400 border border-fuchsia-900/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-850/30"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span>Diretrizes de Marketing</span>
                </button>
                <button
                  onClick={() => setActiveSubTab("campanhas")}
                  className={`w-full py-2 px-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                    activeSubTab === "campanhas"
                      ? "bg-cyan-950/40 text-cyan-400 border border-cyan-900/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-850/30"
                  }`}
                >
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  <span>QG Ativo</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ================= COLUMN 2 (5/12 Cols): THE DYNAMIC PALCO ================= */}
      <div className="col-span-1 xl:col-span-5 flex flex-col gap-6">
        
        {/* DATA BADGES ("Badges de Inteligência") with neon outlines & glassmorphism */}
        <div className="flex flex-row flex-wrap gap-2.5">
          {/* Badges de Doutora Jane ou Candidato Selecionado */}
          <div className="flex-1 min-w-[130px] bg-slate-900/40 backdrop-blur-md border border-cyan-500/35 shadow-[0_0_12px_rgba(34,211,238,0.2)] rounded-xl px-3.5 py-2 flex items-center gap-2 hover:border-cyan-400 hover:shadow-[0_0_18px_rgba(34,211,238,0.35)] transition-all">
            <Award className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="text-left">
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block leading-none">Votação 2026</span>
              <span className="text-xs font-black text-white font-mono mt-0.5 block">{isJane ? "36.555 Votos Totais" : `${totalVotesFormatted} Votos Totais`}</span>
            </div>
          </div>

          <div className="flex-1 min-w-[130px] bg-slate-900/40 backdrop-blur-md border border-fuchsia-500/35 shadow-[0_0_12px_rgba(217,70,239,0.2)] rounded-xl px-3.5 py-2 flex items-center gap-2 hover:border-fuchsia-400 hover:shadow-[0_0_18px_rgba(217,70,239,0.35)] transition-all">
            <Facebook className="w-4 h-4 text-fuchsia-400 shrink-0" />
            <div className="text-left">
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block leading-none">Alcance FB</span>
              <span className="text-xs font-black text-white font-mono mt-0.5 block">{isJane ? "51 Mil Seg. Facebook" : "42k Seg. Facebook"}</span>
            </div>
          </div>

          <div className="flex-1 min-w-[130px] bg-slate-900/40 backdrop-blur-md border border-cyan-500/35 shadow-[0_0_12px_rgba(34,211,238,0.2)] rounded-xl px-3.5 py-2 flex items-center gap-2 hover:border-cyan-400 hover:shadow-[0_0_18px_rgba(34,211,238,0.35)] transition-all">
            <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="text-left">
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block leading-none">Alcance TikTok</span>
              <span className="text-xs font-black text-white font-mono mt-0.5 block">{isJane ? "860 Seg. TikTok" : "1.2k Seg. TikTok"}</span>
            </div>
          </div>
        </div>

        {/* DYNAMIC PALCO CONTENT AREA with transparent background */}
        <div className="bg-slate-900/40 backdrop-blur-lg border border-slate-700/80 rounded-2xl p-6 shadow-xl relative overflow-hidden text-left min-h-[500px]">
          
          {/* VIEW: VISÃO GERAL */}
          {activeSubTab === "geral" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 text-cyan-400 border-b border-slate-800 pb-3">
                <Brain className="w-5 h-5 text-cyan-400" />
                <h4 className="text-xs font-black uppercase tracking-widest text-cyan-400">Resumo de Inteligência Legislativa</h4>
              </div>
              <h3 className="text-xl font-black text-white leading-tight">
                Painel Central de Inteligência Analítica & Cenários Preditivos
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                Perfil de atuação preditiva de <span className="text-cyan-400 font-bold">{selectedCandidate.nome_urna}</span>. O algoritmo de Inteligência Artificial do Gabinete IA cruzou os sentimentos reputacionais de mídia com dados de varredura do DF para gerar diretrizes de marketing eleitorais de alto padrão.
              </p>

              {/* Grid of cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-xl flex items-center gap-3">
                  <div className="p-2 bg-cyan-950/60 border border-cyan-900/40 rounded-lg text-cyan-400 shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block leading-none">Mídia Geral</span>
                    <span className="text-xs font-black text-emerald-400 mt-1 block">ORGANICAMENTE POSITIVO</span>
                  </div>
                </div>

                <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-xl flex items-center gap-3">
                  <div className="p-2 bg-indigo-950/60 border border-indigo-900/40 rounded-lg text-indigo-400 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block leading-none">Notícias (24h)</span>
                    <span className="text-xs font-black text-white font-mono mt-1 block">{clippings.length || 3} registros</span>
                  </div>
                </div>

                <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-xl flex items-center gap-3">
                  <div className="p-2 bg-fuchsia-950/60 border border-fuchsia-900/40 rounded-lg text-fuchsia-400 shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block leading-none">Risco Crítico</span>
                    <span className="text-xs font-black text-cyan-400 mt-1 block">ESTÁVEL / SEGURO</span>
                  </div>
                </div>
              </div>

              {/* SWOT GRID ANALYSIS */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Matriz SWOT de Posicionamento Político</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-950/30 border border-emerald-950 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <h5 className="text-xs font-black uppercase tracking-wider">Forças (Strengths)</h5>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                      {selectedCandidate.nome_urna.includes("Felix") || selectedCandidate.nome_urna.includes("Jane")
                        ? "Excelente engajamento orgânico digital. Fortíssimo apelo junto a defensores de minorias e pautas de saúde no DF."
                        : "Histórico consolidado em bases operárias, forte penetração sindical e liderança nas RAs de Ceilândia e Taguatinga."}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-950/30 border border-rose-950 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-rose-400">
                      <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                      <h5 className="text-xs font-black uppercase tracking-wider">Fraquezas (Weaknesses)</h5>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                      {selectedCandidate.nome_urna.includes("Felix") || selectedCandidate.nome_urna.includes("Jane")
                        ? "Dificuldade em furar a bolha ideológica. Baixo apelo orgânico nas RAs mais distantes do centro."
                        : "Imagem excessivamente tradicional. Linguagem estática com sério déficit de engajamento no público jovem de 16-24 anos."}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-950/30 border border-blue-950 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-blue-400">
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      <h5 className="text-xs font-black uppercase tracking-wider">Oportunidades (Opportunities)</h5>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                      {selectedCandidate.nome_urna.includes("Felix") || selectedCandidate.nome_urna.includes("Jane")
                        ? "Conectar pautas de direitos sociais ao empreendedorismo juvenil periférico para esticar o alcance territorial."
                        : "Dialogar com motoristas de aplicativo e novos trabalhadores digitais que necessitam de amparo local."}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-950/30 border border-amber-950 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-400">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <h5 className="text-xs font-black uppercase tracking-wider">Ameaças (Threats)</h5>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                      Crescimento acirrado de novas candidaturas extremistas. Saturação por coeficiente de legenda nas coligações proporcionais de 2026.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: REPUTAÇÃO & MÍDIA with Netflix style slider */}
          {activeSubTab === "reputacao" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <ShieldAlert className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-cyan-400">
                    Sinalizadores de Opinião Pública & Clipping
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Trilho rolável no padrão "Netflix" para rápida detecção de crises e oportunidades de narrativa.</p>
                </div>
              </div>

              {/* TRILHO 1: ALERTAS E CRISES */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-rose-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  <span>🚨 Alertas e Crises ({alertsClippings.length})</span>
                </h4>

                {alertsClippings.length === 0 ? (
                  <div className="p-8 bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl text-center text-xs text-slate-500 font-bold">
                    Nenhum alerta crítico ou clipping negativo registrado para este candidato nas últimas 24h.
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto pb-4 pt-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    <div className="flex flex-nowrap gap-5">
                      {alertsClippings.map(clip => (
                        <div
                          key={clip.id_clipping}
                          className="w-[290px] shrink-0 bg-slate-950/80 border-l-4 border-l-rose-500 border border-slate-800 rounded-r-xl rounded-l-md p-4 flex flex-col justify-between transition-all hover:border-slate-700 shadow-md group h-[240px]"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1.5 mb-2">
                              <span className="px-1.5 py-0.5 bg-rose-950/50 text-rose-400 border border-rose-900/30 rounded text-[8px] font-black uppercase tracking-widest">
                                {clip.sentimento}
                              </span>
                              <span className="text-[9px] text-slate-500 font-bold tracking-tight">{clip.fonte}</span>
                            </div>
                            <h5 className="text-xs font-black text-slate-100 group-hover:text-cyan-400 transition-colors line-clamp-2 leading-snug">
                              {clip.titulo}
                            </h5>
                            <p className="text-[11px] text-slate-400 font-semibold leading-relaxed mt-2 line-clamp-3">
                              {clip.resumo_curto || "Sem resumo disponível."}
                            </p>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-900 mt-2">
                            <span className="text-[9px] text-slate-500 font-mono font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {clip.data_publicacao}
                            </span>
                            <button
                              onClick={() => handleAnalyzeWithAI(clip.titulo, clip.resumo_curto)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[9px] font-black rounded-lg transition-all cursor-pointer shadow-sm border border-cyan-500/20"
                            >
                              <Sparkles className="w-3 h-3 text-cyan-200" />
                              <span>Analisar IA</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* TRILHO 2: OPORTUNIDADES E MENÇÕES POSITIVAS */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>✅ Oportunidades e Menções Positivas ({opportunitiesClippings.length})</span>
                </h4>

                {opportunitiesClippings.length === 0 ? (
                  <div className="p-8 bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl text-center text-xs text-slate-500 font-bold">
                    Nenhuma menção positiva ou oportunidade registrada para este candidato nas últimas 24h.
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto pb-4 pt-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    <div className="flex flex-nowrap gap-5">
                      {opportunitiesClippings.map(clip => {
                        const sentimentLower = (clip.sentimento || "").toLowerCase();
                        const isNeutral = sentimentLower.includes("neutr");
                        const borderClass = isNeutral ? "border-l-indigo-500" : "border-l-emerald-500";
                        const badgeClass = isNeutral 
                          ? "bg-indigo-950/50 text-indigo-400 border border-indigo-900/30" 
                          : "bg-emerald-950/50 text-emerald-400 border border-emerald-900/30";

                        return (
                          <div
                            key={clip.id_clipping}
                            className={`w-[290px] shrink-0 bg-slate-950/80 border-l-4 ${borderClass} border border-slate-800 rounded-r-xl rounded-l-md p-4 flex flex-col justify-between transition-all hover:border-slate-700 h-[240px]`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1.5 mb-2">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${badgeClass}`}>
                                  {clip.sentimento}
                                </span>
                                <span className="text-[9px] text-slate-500 font-bold tracking-tight">{clip.fonte}</span>
                              </div>
                              <h5 className="text-xs font-black text-slate-100 group-hover:text-cyan-400 transition-colors line-clamp-2 leading-snug">
                                {clip.titulo}
                              </h5>
                              <p className="text-[11px] text-slate-400 font-semibold leading-relaxed mt-2 line-clamp-3">
                                {clip.resumo_curto || "Sem resumo disponível."}
                              </p>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-900 mt-2">
                              <span className="text-[9px] text-slate-500 font-mono font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {clip.data_publicacao}
                              </span>
                              <button
                                onClick={() => handleAnalyzeWithAI(clip.titulo, clip.resumo_curto)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[9px] font-black rounded-lg transition-all cursor-pointer shadow-sm border border-cyan-500/20"
                              >
                                <Sparkles className="w-3 h-3 text-cyan-200" />
                                <span>Analisar IA</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: REDES SOCIAIS & SCRAPING */}
          {activeSubTab === "redes" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <TrendingUp className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-cyan-400">
                    Análise e Scraping de Redes Sociais
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Live feed de posts extraídos e métricas de engajamento orgânico do candidato.</p>
                </div>
              </div>

              {/* KPI metrics row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex items-center gap-3">
                  <div className="p-2.5 bg-cyan-950/40 border border-cyan-900/20 rounded-xl text-cyan-400">
                    <ThumbsUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-black uppercase block leading-none">Média Likes</span>
                    <span className="text-base font-black text-white font-mono mt-0.5 block">{scraping.likes.toLocaleString("pt-BR")}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex items-center gap-3">
                  <div className="p-2.5 bg-fuchsia-950/40 border border-fuchsia-900/20 rounded-xl text-fuchsia-400">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-black uppercase block leading-none">Comentários</span>
                    <span className="text-base font-black text-white font-mono mt-0.5 block">{scraping.comentarios.toLocaleString("pt-BR")}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-950/40 border border-indigo-900/20 rounded-xl text-indigo-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-black uppercase block leading-none">Engajamento</span>
                    <span className="text-base font-black text-cyan-400 font-mono mt-0.5 block">{scraping.engajamento}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                  <div className="flex items-center gap-2">
                    {scraping.plataforma.toLowerCase() === "instagram" ? (
                      <span className="p-1 bg-fuchsia-950/60 text-fuchsia-400 border border-fuchsia-900/40 rounded-lg text-xs font-black">
                        <Instagram className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="p-1 bg-cyan-950/60 text-cyan-400 border border-cyan-900/40 rounded-lg text-xs font-black">
                        <Facebook className="w-4 h-4" />
                      </span>
                    )}
                    <span className="text-xs font-black text-slate-200 uppercase tracking-widest">{scraping.plataforma} Live Post</span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-bold">{scraping.tempo}</span>
                </div>
                <p className="text-xs text-slate-300 font-semibold italic leading-relaxed bg-slate-900/50 p-4 border border-slate-800 rounded-xl">
                  "{scraping.ultimo_post}"
                </p>
                <div className="pt-2">
                  <span className="text-[9px] font-black text-fuchsia-400 uppercase tracking-widest block mb-1">Gargalo nas Mídias Digitais</span>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    {apiData?.cruzamento_politico?.gargalo_redes || "O engajamento do candidato é sólido, mas necessita de uma maior presença orgânica e respostas ágeis a boatos de oposição no WhatsApp e canais fechados."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: ORÁCULO INTEL CONTROL IN CENTER STAGE */}
          {activeSubTab === "oraculo" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Brain className="w-5 h-5 text-cyan-400 shrink-0 animate-pulse" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-cyan-400">
                    Console de Comando de IA
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Use as perguntas recomendadas abaixo para acionar o Oráculo Chat fixado à direita.</p>
                </div>
              </div>

              {/* Status block */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[9px] text-slate-500 font-black uppercase block leading-none">Status de Prontidão</span>
                  <span className="text-xs font-black text-cyan-400 flex items-center gap-1.5 mt-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                    <span>COGNITIVO ON-LINE</span>
                  </span>
                </div>
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[9px] text-slate-500 font-black uppercase block leading-none">Capacidade</span>
                  <span className="text-xs font-black text-fuchsia-400 flex items-center gap-1.5 mt-1.5">
                    <span>99.8% CONFIANÇA</span>
                  </span>
                </div>
              </div>

              {/* Interactive prompt catalog */}
              <div className="space-y-3">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Biblioteca de Prompts Estratégicos</span>
                
                <div className="space-y-2.5">
                  {[
                    {
                      title: "Análise SWOT & Preditiva",
                      desc: "Gera uma análise cruzando notícias, pontos de dor regionais e oportunidades.",
                      prompt: `Faça uma análise de posicionamento político detalhada e SWOT para o candidato ${selectedCandidate.nome_urna} considerando o cenário de 2026.`
                    },
                    {
                      title: "Roteiro de Audiovisual (Jovens)",
                      desc: "Gera um script estruturado de 60 segundos focado nas pautas estudantis do DF.",
                      prompt: `Crie um roteiro de vídeo de 60 segundos (TikTok/Reels) focado em atrair o voto jovem no DF para o candidato ${selectedCandidate.nome_urna}, enfatizando cultura e tecnologia.`
                    },
                    {
                      title: "Estratégia Geoeleitoral para Periferias",
                      desc: "Avalia a penetração em Ceilândia, Samambaia e Sol Nascente.",
                      prompt: `Quais as principais recomendações geoeleitorais e pautas críticas para o candidato ${selectedCandidate.nome_urna} atrair mais votos na periferia de Ceilândia e Samambaia?`
                    }
                  ].map((pItem, pIdx) => (
                    <div 
                      key={pIdx}
                      onClick={() => handleSendPromptToOraculo(pItem.prompt)}
                      className="p-3 bg-slate-950/60 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-xl cursor-pointer transition-all flex justify-between items-center group shadow-sm"
                    >
                      <div className="space-y-0.5 text-left">
                        <h4 className="text-xs font-black text-white group-hover:text-cyan-400 transition-colors">{pItem.title}</h4>
                        <p className="text-[10px] text-slate-400 font-semibold">{pItem.desc}</p>
                      </div>
                      <Sparkles className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0 ml-3" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/20 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 leading-relaxed font-medium">
                💡 O Oráculo está sempre ativo no painel lateral à direita. Você pode analisar notícias ou colar qualquer questão para que ele processe as variáveis preditivas instantaneamente.
              </div>
            </div>
          )}

          {/* VIEW: ENGENHARIA GEOELEITORAL */}
          {activeSubTab === "geoeleitoral" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <MapPin className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-cyan-400">
                    Engenharia Geoeleitoral & Redutos
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Mapeamento geográfico de votos de base e nichos de maior conversão.</p>
                </div>
              </div>

              <div className="p-4 bg-cyan-950/20 border border-cyan-900/35 rounded-xl space-y-1.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-cyan-400">Diretriz Regional de Campanha</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                  {geoData.focoRegional}
                </p>
              </div>

              {/* Geographical Distribution Bars */}
              <div className="space-y-3 bg-slate-950/40 p-5 border border-slate-800 rounded-xl">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Estimativas de Dominância por Região Administrativa (RA)</span>
                
                <div className="space-y-4 pt-2">
                  {geoData.regioes.map((reg, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-black text-slate-100">{reg.ra}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-cyan-400 font-extrabold">{reg.votos.toLocaleString("pt-BR")} votos</span>
                          <span className="text-slate-500">({reg.percentual}%)</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wide border ${
                            reg.status === "Dominante" 
                              ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/40" 
                              : reg.status === "Competitivo"
                              ? "bg-blue-950/40 text-blue-400 border-blue-900/40"
                              : "bg-amber-950/40 text-amber-400 border-amber-900/40"
                          }`}>{reg.status}</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            reg.status === "Dominante" ? "bg-cyan-500" : reg.status === "Competitivo" ? "bg-indigo-500" : "bg-fuchsia-500"
                          }`}
                          style={{ width: `${reg.percentual}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW: BENCHMARK DE EFICIÊNCIA */}
          {activeSubTab === "benchmark" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <BarChart3 className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-cyan-400">
                    Benchmark & Eficiência
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Mapeamento do custo de campanha projetado por voto e índice de engajamento.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-3">
                  <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest block">Anatomia de Custo Eleitoral</span>
                  <h4 className="text-xs font-black text-white">Eficiência de Gasto</h4>
                  
                  <div className="space-y-2 pt-1 text-xs">
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-900">
                      <span className="text-slate-400 font-bold">Custo Estimado por Voto:</span>
                      <strong className="text-white font-mono">{benchmark.custoPorVotoPrevisto}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-900">
                      <span className="text-slate-400 font-bold">Média do DF (CLDF):</span>
                      <strong className="text-slate-400 font-mono">{benchmark.mediaDFPorVoto}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1.5 text-emerald-400 font-bold">
                      <span>Performance de Retorno:</span>
                      <span>{benchmark.eficienciaEscore}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-3">
                  <span className="text-[9px] font-black text-fuchsia-400 uppercase tracking-widest block">Índice Digital Geral</span>
                  <h4 className="text-xs font-black text-white">Comparativo Orgânico</h4>
                  
                  <div className="space-y-2 pt-1 text-xs">
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-900">
                      <span className="text-slate-400 font-bold">Engajamento:</span>
                      <strong className="text-white">{benchmark.ratingEngajamento}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-900">
                      <span className="text-slate-400 font-bold">Alcance Semanal:</span>
                      <strong className="text-slate-300 font-mono">{benchmark.alcanceDigitalEstimado}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1.5 text-cyan-400 font-bold">
                      <span>Crescimento Orgânico:</span>
                      <span>{benchmark.taxaCrescimentoDigital}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: CRUZAMENTO POLÍTICO 2026 */}
          {activeSubTab === "cruzamento" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <ArrowLeftRight className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-cyan-400">
                    Cruzamento Político & Alianças 2026
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Status de pretensão e posicionamento estratégico do candidato.</p>
                </div>
              </div>

              {apiData?.cruzamento_politico ? (
                <div className="space-y-4">
                  <div className="p-5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold uppercase block leading-none">Situação em 2026</span>
                        <strong className="text-sm text-cyan-400 uppercase tracking-wide mt-1.5 block">{apiData.cruzamento_politico.situacao_2026}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold uppercase block leading-none">Cargo Pretendido</span>
                        <strong className="text-sm text-white uppercase tracking-wide mt-1.5 block">{apiData.cruzamento_politico.cargo_pretendido}</strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-900">
                      <span className="text-[9px] text-slate-500 font-bold uppercase block">Foco de Persuasão Recomendado</span>
                      <p className="text-xs text-slate-200 font-semibold leading-relaxed mt-1.5">
                        {apiData.cruzamento_politico.foco_persuasao}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-900">
                      <span className="text-[9px] text-slate-500 font-bold uppercase block">Insights Políticos do Partido</span>
                      <p className="text-xs text-slate-300 leading-relaxed font-semibold mt-1.5">
                        {apiData.cruzamento_politico.insights_politicos}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl text-center text-xs text-slate-500 font-bold">
                  Sem dados de cruzamento político para este candidato. Selecione outro parlamentar da lista.
                </div>
              )}
            </div>
          )}

          {/* VIEW: DEMANDAS LOCAIS */}
          {activeSubTab === "demandas" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <MapPin className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-cyan-400">
                    Mapeamento Hiperlocal de Demandas (DF)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Prioridades mapeadas por Região Administrativa do Distrito Federal.</p>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/60 border-b border-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="py-3 px-4">Região</th>
                        <th className="py-3 px-4">Demanda Local</th>
                        <th className="py-3 px-4">Ação</th>
                        <th className="py-3 px-4 text-center">Urgência</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 text-xs text-slate-300 font-medium">
                      {demandas.map((row: any, idx: number) => {
                        const urgVal = (row.urgencia || "").toUpperCase();
                        let urgColor = "bg-cyan-950/50 text-cyan-400 border-cyan-900/40";
                        if (urgVal === "CRÍTICA" || urgVal === "CRITICA") {
                          urgColor = "bg-rose-950/50 text-rose-400 border-rose-900/40";
                        } else if (urgVal === "ALTA") {
                          urgColor = "bg-amber-950/50 text-amber-400 border-amber-900/40";
                        }

                        return (
                          <tr key={idx} className="hover:bg-slate-900/30 transition-all">
                            <td className="py-3 px-4 font-black text-white flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <span>{row.regiao_administrativa}</span>
                            </td>
                            <td className="py-3 px-4 leading-relaxed max-w-xs">{row.ponto_de_dor}</td>
                            <td className="py-3 px-4 text-slate-400 leading-relaxed max-w-xs">{row.diretriz_recomendada}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded border text-[8px] font-black tracking-wider ${urgColor}`}>
                                {urgVal}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: DIRETRIZES DE MARKETING */}
          {activeSubTab === "marketing" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-cyan-400">
                    Marketing & Discursos Segmentados
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Discursos estratégicos e roteiros preditivos adaptados por faixa demográfica.</p>
                </div>
              </div>

              {/* Demographics buttons */}
              <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 max-w-md">
                {(["jovens", "adultos", "seniors"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSelectedDemographic(tab)}
                    className={`flex-1 text-center py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      selectedDemographic === tab
                        ? "bg-cyan-600 text-white shadow-md border border-cyan-500/20"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                    }`}
                  >
                    {tab === "jovens" ? "16-24 Anos" : tab === "adultos" ? "25-59 Anos" : "60-70 Anos"}
                  </button>
                ))}
              </div>

              <div className="p-5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block leading-none">Grupo de Foco</span>
                    <span className="text-xs font-black text-white mt-1.5 block">{activeDemo.title}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block leading-none">Temas Relevantes</span>
                    <span className="text-xs font-black text-cyan-400 mt-1.5 block">{activeDemo.focus}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-900">
                  <span className="text-[9px] text-slate-500 font-bold uppercase block leading-none">Diretriz de Linguagem</span>
                  <p className="text-xs text-slate-300 font-semibold leading-relaxed mt-1.5 bg-slate-900/60 p-3 border border-slate-800 rounded-lg">
                    {activeDemo.tone}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-900">
                  <span className="text-[9px] text-slate-500 font-bold uppercase block leading-none">Estratégia Recomendada</span>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold mt-1.5">
                    {activeDemo.strategy}
                  </p>
                </div>

                <button
                  onClick={() => handleSendPromptToOraculo(activeDemo.prompt)}
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-black rounded-lg transition-all shadow-sm cursor-pointer border border-cyan-500/20"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                  <span>Gerar roteiro de discurso completo no Oráculo</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW: QG DE CAMPANHAS ATIVAS */}
          {activeSubTab === "campanhas" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Target className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-cyan-400">
                    QG de Campanhas Ativas
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Plano de ações diárias e metas de atração territorial do Distrito Federal.</p>
                </div>
              </div>

              {/* Campaign cards matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">Ação Prioritária 01</span>
                      <span className="text-[8px] bg-cyan-950/50 text-cyan-400 border border-cyan-900/30 rounded px-1.5 font-bold">EM ANDAMENTO</span>
                    </div>
                    <h4 className="text-xs font-black text-white mt-1.5">Caminhada & Mutirão na Ceilândia Centro</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-1 font-semibold">
                      Ouvidoria para consolidar pautas de saúde regional e creches públicas. Reunião comunitária na praça.
                    </p>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mt-3">
                    <div className="h-full rounded-full bg-cyan-500" style={{ width: "65%" }} />
                  </div>
                </div>

                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-fuchsia-400 uppercase tracking-widest">Ação Prioritária 02</span>
                      <span className="text-[8px] bg-indigo-950/50 text-indigo-400 border border-indigo-900/30 rounded px-1.5 font-bold">PENDENTE</span>
                    </div>
                    <h4 className="text-xs font-black text-white mt-1.5">Disparos de Posicionamento Reputacional</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-1 font-semibold">
                      Envio controlado de notas de esclarecimento sobre saúde pelo canal oficial para rebater boatos em canais de mídia fechados.
                    </p>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mt-3">
                    <div className="h-full rounded-full bg-fuchsia-500" style={{ width: "20%" }} />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-950/30 border border-slate-800 rounded-xl text-center text-[11px] text-slate-400 font-semibold leading-relaxed">
                ⚡ A matriz de QG sincroniza automaticamente as flutuações de clipping diário com o cronograma parlamentar de 2026.
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ================= COLUMN 3 (4/12 Cols): FIXED ORÁCULO CHAT ================= */}
      <div className="col-span-1 xl:col-span-4 bg-slate-900/40 backdrop-blur-lg border border-slate-700/80 rounded-2xl p-5 shadow-[0_4px_30px_rgba(0,0,0,0.4)] flex flex-col h-[620px]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="text-left">
              <h3 className="text-xs font-black uppercase tracking-widest text-cyan-400">
                Oráculo Assistente Fixo
              </h3>
              <p className="text-[9px] text-slate-500">Mecanismo cognitivo de Gabinete ativo 24h</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-cyan-950/40 border border-cyan-900/40 px-2 py-0.5 rounded-full text-[9px] text-cyan-400">
            <Volume2 className="w-3 h-3" />
            <span className="font-extrabold">{autoSpeakEnabled ? "LIG" : "DES"}</span>
          </div>
        </div>

        {/* Chat Messages Log */}
        <div className="flex-1 bg-slate-950/40 rounded-xl p-3.5 overflow-y-auto border border-slate-850 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {oraculoChat.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 px-4 space-y-2">
              <Brain className="w-7 h-7 text-slate-600 animate-pulse" />
              <p className="text-[11px] font-bold">Inicie sua consulta estratégica com o Oráculo.</p>
              <p className="text-[9px] text-slate-600 font-medium">Use a Biblioteca de Prompts no menu Oráculo ou clique em "Analisar com IA" nas notícias.</p>
            </div>
          ) : (
            oraculoChat.map((msg, idx) => (
              <div 
                key={msg.id || idx} 
                className={`flex flex-col max-w-[85%] ${msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"}`}
              >
                <span className="text-[9px] font-bold text-slate-500 mb-0.5">
                  {msg.sender === "user" ? "Operador" : "Oráculo"}
                </span>
                <div className={`p-2.5 rounded-2xl text-[11px] font-semibold leading-relaxed ${
                  msg.sender === "user" 
                    ? "bg-cyan-600/20 border border-cyan-500/35 text-cyan-200 rounded-tr-none shadow-[0_0_8px_rgba(34,211,238,0.1)]" 
                    : "bg-slate-950/80 text-slate-100 border border-slate-800 rounded-tl-none shadow-md"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))
          )}
          {sendingOraculo && (
            <div className="flex items-center gap-2 text-cyan-500 text-[10px] font-black pl-1.5 animate-pulse">
              <div className="w-3.5 h-3.5 border-2 border-slate-800 border-t-cyan-500 rounded-full animate-spin"></div>
              <span>Processando cenário 2026...</span>
            </div>
          )}
          <div ref={localChatEndRef}></div>
        </div>

        {/* Pre-cooked Question Pill shortcuts */}
        <div className="flex gap-2 overflow-x-auto pb-1.5 pt-1 scrollbar-none">
          {[
            "Risco de crise?",
            "Roteiro de vídeo de 60s",
            "Mapeamento de Ceilândia"
          ].map((pill, pIdx) => (
            <button
              key={pIdx}
              type="button"
              onClick={() => setLocalChatInput(pill)}
              className="px-2.5 py-1 bg-slate-950/80 hover:bg-slate-850/80 border border-slate-800 hover:border-cyan-500/30 text-slate-400 hover:text-white text-[9px] font-black rounded-lg whitespace-nowrap cursor-pointer shrink-0 transition-all shadow-xs"
            >
              {pill}
            </button>
          ))}
        </div>

        {/* Input Chat form */}
        <form onSubmit={handleLocalChatSubmit} className="flex gap-2">
          <input
            id="oraculo-chat-input-fixed"
            type="text"
            value={localChatInput}
            onChange={(e) => setLocalChatInput(e.target.value)}
            placeholder="Pergunte ao Oráculo sobre campanhas..."
            className="flex-1 bg-slate-950/80 border border-slate-800 hover:border-cyan-500/30 focus:border-cyan-500 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-100 placeholder-slate-500 focus:outline-none focus:bg-slate-950 transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={sendingOraculo || !localChatInput.trim()}
            className="px-3.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800/80 text-white font-bold rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md shadow-cyan-600/10 border border-cyan-500/20"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

      </div>

    </div>
  );
};
