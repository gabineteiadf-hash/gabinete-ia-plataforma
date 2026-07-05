import React, { useState, useEffect, useRef } from "react";
import { 
  Building2, 
  Search, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Award, 
  ChevronRight, 
  Sparkles, 
  MessageSquare, 
  Send, 
  Clock, 
  Database,
  MapPin, 
  ShieldAlert,
  ArrowRightLeft,
  Briefcase,
  HelpCircle,
  FileText,
  UserCheck,
  AlertTriangle,
  Github,
  LogOut,
  FileSpreadsheet,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Lock,
  CloudUpload,
  CreditCard,
  Brain,
  Layers,
  User,
  Mic,
  Volume2,
  VolumeX,
  Instagram,
  Facebook,
  Target,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";

import { initAuth, googleSignIn, logout, getAccessToken } from "./lib/firebaseAuth";
import { 
  listSpreadsheets, 
  getSpreadsheetDetails, 
  getSheetValues, 
  DriveFile, 
  SpreadsheetDetails, 
  SheetData 
} from "./lib/driveService";
import { 
  getGitHubProfile, 
  getGitHubRepos, 
  createGitHubFile, 
  GitHubProfile, 
  GitHubRepo 
} from "./lib/githubService";

interface ExpenseCategory {
  category: string;
  value: number;
}

interface GeoVote {
  zona_eleitoral: number;
  ra_nome: string;
  votos: number;
}

interface HistoricalDispute {
  ano_eleicao: number;
  partido: string;
  total_votos: number;
  situacao: string;
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
  total_receitas: number;
  despesas_contratadas: number;
  despesas_pagas: number;
  maior_fornecedor_nome: string;
  maior_fornecedor_valor: number;
  detalhe_despesas: ExpenseCategory[];
  votos_geoeleitorais?: GeoVote[];
}

interface ChatMessage {
  id: string;
  sender: "user" | "oraculo";
  text: string;
  timestamp: Date;
}

const normalizeCandidateName = (name: string): string => {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") // remove all non-alphanumeric characters (spaces, dots, etc.)
    .trim();
};

const normalizeWithUnderscores = (name: string): string => {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "") // keep alpha, num, spaces, underscores, hyphens
    .replace(/[\s-]+/g, "_") // replace spaces and hyphens with a single underscore
    .trim();
};

const getDirectDrivePhotoUrl = (url: string): string => {
  if (!url) return "";
  if (url.includes("drive.google.com")) {
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const fileId = match[1];
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }
  return url;
};

const getInitials = (name: string): string => {
  if (!name) return "";
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
};

const CandidateAvatar = ({ 
  candidatoId,
  nomeUrna, 
  fotoUrl, 
  variant = "small" 
}: { 
  candidatoId?: number;
  nomeUrna: string; 
  fotoUrl?: string; 
  variant?: "small" | "large"; 
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset error state when the candidate changes
    setHasError(false);
  }, [candidatoId, nomeUrna]);

  if (hasError || !candidatoId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400 shrink-0 overflow-hidden rounded-full">
        <svg
          className="w-2/3 h-2/3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={`/api/fotos/${candidatoId}`}
      alt={nomeUrna}
      onError={() => {
        console.warn(`[Foto Deputado Erro] Falha ao carregar imagem para o candidato "${nomeUrna}" (ID: ${candidatoId}). Usando avatar padrão.`);
        setHasError(true);
      }}
      className="w-full h-full object-cover rounded-full"
    />
  );
};

const candidates2026: Candidate[] = [
  {
    id_candidato: 20261,
    nome_urna: "Fábio Felix",
    nome_completo: "Fábio Felix Silveira",
    partido: "PSOL",
    ano_eleicao: 2026,
    total_votos: 51792,
    foto_url: "/assets/fotos/fabio_felix.jpg",
    cargo: "DEPUTADO DISTRITAL",
    situacao: "Em Campanha",
    total_receitas: 0,
    despesas_contratadas: 0,
    despesas_pagas: 0,
    maior_fornecedor_nome: "",
    maior_fornecedor_valor: 0,
    detalhe_despesas: []
  },
  {
    id_candidato: 20262,
    nome_urna: "Chico Vigilante",
    nome_completo: "Francisco Domingos dos Santos",
    partido: "PT",
    ano_eleicao: 2026,
    total_votos: 43296,
    foto_url: "/assets/fotos/chico_vigilante.jpg",
    cargo: "DEPUTADO DISTRITAL",
    situacao: "Em Campanha",
    total_receitas: 0,
    despesas_contratadas: 0,
    despesas_pagas: 0,
    maior_fornecedor_nome: "",
    maior_fornecedor_valor: 0,
    detalhe_despesas: []
  },
  {
    id_candidato: 20263,
    nome_urna: "Max Maciel",
    nome_completo: "Max Maciel de Araujo",
    partido: "PSOL",
    ano_eleicao: 2026,
    total_votos: 35847,
    foto_url: "/assets/fotos/max_maciel.jpg",
    cargo: "DEPUTADO DISTRITAL",
    situacao: "Em Campanha",
    total_receitas: 0,
    despesas_contratadas: 0,
    despesas_pagas: 0,
    maior_fornecedor_nome: "",
    maior_fornecedor_valor: 0,
    detalhe_despesas: []
  },
  {
    id_candidato: 20264,
    nome_urna: "Robério Negreiros",
    nome_completo: "Robério Negreiros Filho",
    partido: "PSD",
    ano_eleicao: 2026,
    total_votos: 31475,
    foto_url: "/assets/fotos/roberio_negreiros.jpg",
    cargo: "DEPUTADO DISTRITAL",
    situacao: "Em Campanha",
    total_receitas: 0,
    despesas_contratadas: 0,
    despesas_pagas: 0,
    maior_fornecedor_nome: "",
    maior_fornecedor_valor: 0,
    detalhe_despesas: []
  },
  {
    id_candidato: 20265,
    nome_urna: "Eduardo Pedrosa",
    nome_completo: "Eduardo Souza Pedrosa",
    partido: "União",
    ano_eleicao: 2026,
    total_votos: 22521,
    foto_url: "/assets/fotos/eduardo_pedrosa.jpg",
    cargo: "DEPUTADO DISTRITAL",
    situacao: "Em Campanha",
    total_receitas: 0,
    despesas_contratadas: 0,
    despesas_pagas: 0,
    maior_fornecedor_nome: "",
    maior_fornecedor_valor: 0,
    detalhe_despesas: []
  },
  {
    id_candidato: 20266,
    nome_urna: "Dayse Amarilio",
    nome_completo: "Dayse Amarilio dos Santos",
    partido: "PSB",
    ano_eleicao: 2026,
    total_votos: 20072,
    foto_url: "/assets/fotos/dayse_amarilio.jpg",
    cargo: "DEPUTADO DISTRITAL",
    situacao: "Em Campanha",
    total_receitas: 0,
    despesas_contratadas: 0,
    despesas_pagas: 0,
    maior_fornecedor_nome: "",
    maior_fornecedor_valor: 0,
    detalhe_despesas: []
  },
  {
    id_candidato: 20267,
    nome_urna: "Gabriel Magno",
    nome_completo: "Gabriel Magno Pereira Cruz",
    partido: "PT",
    ano_eleicao: 2026,
    total_votos: 18090,
    foto_url: "/assets/fotos/gabriel_magno.jpg",
    cargo: "DEPUTADO DISTRITAL",
    situacao: "Em Campanha",
    total_receitas: 0,
    despesas_contratadas: 0,
    despesas_pagas: 0,
    maior_fornecedor_nome: "",
    maior_fornecedor_valor: 0,
    detalhe_despesas: []
  },
  {
    id_candidato: 20268,
    nome_urna: "Doutora Jane",
    nome_completo: "Jane Klebia do Nascimento Silva Reis",
    partido: "MDB",
    ano_eleicao: 2026,
    total_votos: 19016,
    foto_url: "/assets/fotos/doutora_jane.jpg",
    cargo: "DEPUTADO DISTRITAL",
    situacao: "Em Campanha",
    total_receitas: 0,
    despesas_contratadas: 0,
    despesas_pagas: 0,
    maior_fornecedor_nome: "",
    maior_fornecedor_valor: 0,
    detalhe_despesas: []
  },
  {
    id_candidato: 20269,
    nome_urna: "Hermeto",
    nome_completo: "Joao Hermeto de Oliveira Neto",
    partido: "MDB",
    ano_eleicao: 2026,
    total_votos: 22132,
    foto_url: "/assets/fotos/hermeto.jpg",
    cargo: "DEPUTADO DISTRITAL",
    situacao: "Em Campanha",
    total_receitas: 0,
    despesas_contratadas: 0,
    despesas_pagas: 0,
    maior_fornecedor_nome: "",
    maior_fornecedor_valor: 0,
    detalhe_despesas: []
  }
];

interface CampaignData2026 {
  socialPosts: {
    id: string;
    platform: "instagram" | "facebook";
    date: string;
    text: string;
    likes: number;
    comments: number;
    sentiment: "positivo" | "neutro" | "critico";
    engagement: string;
  }[];
  mapeamentoHiperlocal: {
    id: string;
    ra: string;
    dor: string;
    acao: string;
    urgencia: "alta" | "media" | "critica";
  }[];
  assistenteSegmentado: {
    jovens: string;
    adultos: string;
    seniors: string;
  };
}

function getCampaign2026Data(nomeUrna: string): CampaignData2026 {
  const norm = (nomeUrna || "").toLowerCase();
  
  if (norm.includes("felix")) {
    return {
      socialPosts: [
        { id: "s1", platform: "instagram", date: "Há 2 horas", text: "Estivemos na UPA de Ceilândia cobrando mais médicos pediatras. A saúde pública precisa de atenção urgente!", likes: 2450, comments: 189, sentiment: "positivo", engagement: "8.4%" },
        { id: "s2", platform: "facebook", date: "Há 1 dia", text: "Seguimos firmes na defesa dos direitos dos servidores públicos do DF contra o desmonte e a terceirização!", likes: 1200, comments: 85, sentiment: "positivo", engagement: "4.2%" },
        { id: "s3", platform: "instagram", date: "Há 3 dias", text: "Lançamento oficial da nossa frente parlamentar de defesa dos direitos humanos e diversidade na CLDF. Casa cheia!", likes: 3100, comments: 240, sentiment: "positivo", engagement: "9.1%" }
      ],
      mapeamentoHiperlocal: [
        { id: "m1", ra: "Samambaia", dor: "Falta de iluminação pública e insegurança perto de faculdades à noite.", acao: "Propor emendas de infraestrutura urbana focada em segurança nos trajetos acadêmicos.", urgencia: "critica" },
        { id: "m2", ra: "Ceilândia", dor: "Tempo de espera excessivo na UPA local para consultas gerais.", acao: "Articulação de frentes parlamentares de auditoria de atendimento de saúde nas UPAs.", urgencia: "critica" },
        { id: "m3", ra: "Planaltina", dor: "Falta de espaços de cultura e lazer para a juventude da periferia.", acao: "Destinação de recursos de emendas para implantação de Centros Culturais Comunitários.", urgencia: "alta" }
      ],
      assistenteSegmentado: {
        jovens: "Enfoque em pautas de diversidade, fomento à cultura urbana e defesa da universidade pública. Linguagem ágil, visual dinâmico com Reels e TikTok.",
        adultos: "Defesa dos serviços públicos, concurso público e estabilidade para servidores. Comunicação clara sobre fortalecimento de direitos sociais.",
        seniors: "Foco no acolhimento de saúde integral nas UPAs e assistência em asilos públicos. Canal tradicional de Facebook e materiais impressos informativos."
      }
    };
  }
  
  if (norm.includes("vigilante") || norm.includes("chico")) {
    return {
      socialPosts: [
        { id: "s1", platform: "facebook", date: "Há 3 horas", text: "Apoio total à luta dos trabalhadores rodoviários do DF! Transporte digno e tarifa justa já!", likes: 1820, comments: 142, sentiment: "positivo", engagement: "5.1%" },
        { id: "s2", platform: "instagram", date: "Há 1 dia", text: "Fiscalizando as obras de infraestrutura em Taguatinga. O asfalto está chegando mas precisamos de drenagem pluvial!", likes: 1540, comments: 98, sentiment: "neutro", engagement: "4.8%" },
        { id: "s3", platform: "facebook", date: "Há 4 dias", text: "Denunciamos hoje no plenário o abuso no preço dos combustíveis em Brasília. O consumidor não pode pagar essa conta sozinho!", likes: 2100, comments: 175, sentiment: "positivo", engagement: "6.2%" }
      ],
      mapeamentoHiperlocal: [
        { id: "m1", ra: "Taguatinga", dor: "Inundações frequentes no centro durante as chuvas devido a galerias antigas.", acao: "Destinar emenda parlamentar para obras urgentes de microdrenagem de águas pluviais.", urgencia: "critica" },
        { id: "m2", ra: "Recanto das Emas", dor: "Escassez de linhas de ônibus diretas para o Plano Piloto em horários de pico.", acao: "Audiência pública com a Secretaria de Transporte para readequação de frotas e horários.", urgencia: "alta" },
        { id: "m3", ra: "Ceilândia", dor: "Falta de policiamento preventivo nas paradas de ônibus periféricas.", acao: "Indicação parlamentar para instalação de postos comunitários móveis da PMDF.", urgencia: "alta" }
      ],
      assistenteSegmentado: {
        jovens: "Foco em cursos de capacitação técnica, emprego jovem e o papel do Estado na economia. Linguagem didática sobre o futuro profissional e inclusão social.",
        adultos: "Direito dos trabalhadores, estabilidade econômica e ampliação de frotas de transporte público. Discursos fortes sobre seguridade laboral e direitos trabalhistas.",
        seniors: "Defesa intransigente do SUS, fortalecimento do atendimento nas UBS e garantia de tarifas gratuitas. Canal de rádio e reuniões presenciais."
      }
    };
  }

  if (norm.includes("maciel") || norm.includes("max")) {
    return {
      socialPosts: [
        { id: "s1", platform: "instagram", date: "Há 5 horas", text: "Mais um encontro do 'Gabinete na Quebrada' em Ceilândia! A cultura e o esporte salvam vidas e geram oportunidades.", likes: 2980, comments: 215, sentiment: "positivo", engagement: "9.2%" },
        { id: "s2", platform: "instagram", date: "Há 2 dias", text: "Debatendo a mobilidade ativa: ciclovias que ligam as RA's ao metrô precisam sair do papel e ter manutenção regular!", likes: 1120, comments: 56, sentiment: "positivo", engagement: "5.5%" },
        { id: "s3", platform: "instagram", date: "Há 4 dias", text: "Nossa juventude periférica quer trabalhar, quer estudar e quer cultura. Fomos à Sol Nascente ouvir e dar voz a quem mais precisa.", likes: 2500, comments: 162, sentiment: "positivo", engagement: "8.1%" }
      ],
      mapeamentoHiperlocal: [
        { id: "m1", ra: "Sol Nascente", dor: "Falta de asfalto e calçadas acessíveis nas proximidades do trecho II do Sol Nascente.", acao: "Fiscalizar verbas do PAC destinadas ao DF e propor emendas para pavimentação imediata.", urgencia: "critica" },
        { id: "m2", ra: "Guará", dor: "Degradação ambiental e falta de manutenção nos parques urbanos locais.", acao: "Articulação de emenda parlamentar de preservação e revitalização do Parque do Guará.", urgencia: "media" },
        { id: "m3", ra: "Ceilândia", dor: "Poucos centros de treinamento esportivo gratuitos para jovens de periferia.", acao: "Destinação de recursos para escolinhas esportivas comunitárias integradas.", urgencia: "alta" }
      ],
      assistenteSegmentado: {
        jovens: "Enfoque na cultura hip-hop, economia criativa e ciclovias integradas. Uso de estética de periferia com design moderno e postagens em vídeo (Reels).",
        adultos: "Regularização fundiária em Sol Nascente/Pôr do Sol, saneamento básico e direito à moradia digna. Discurso de dignidade e cidadania real.",
        seniors: "Parques limpos com segurança adequada, calçadas acessíveis para evitar quedas e UBS eficientes. Foco em saúde comunitária preventiva."
      }
    };
  }

  if (norm.includes("negreiros") || norm.includes("roberio")) {
    return {
      socialPosts: [
        { id: "s1", platform: "instagram", date: "Há 1 dia", text: "Apresentamos hoje o projeto que cria incentivos fiscais para jovens empreendedores abrirem negócios no DF!", likes: 980, comments: 45, sentiment: "positivo", engagement: "3.2%" },
        { id: "s2", platform: "facebook", date: "Há 3 dias", text: "Reunião estratégica com o setor produtivo debruçados sobre a geração de novos empregos e renda para o Distrito Federal.", likes: 640, comments: 28, sentiment: "positivo", engagement: "2.1%" },
        { id: "s3", platform: "instagram", date: "Há 5 dias", text: "Fiscalizando a aplicação das emendas parlamentares destinadas ao esporte e infraestrutura de quadras poliesportivas.", likes: 850, comments: 39, sentiment: "positivo", engagement: "2.9%" }
      ],
      mapeamentoHiperlocal: [
        { id: "m1", ra: "Lago Sul", dor: "Aumento de pequenos furtos em residências e comércios locais à noite.", acao: "Instalação de câmeras inteligentes de segurança integradas e solicitação de reforço de patrulha PMDF.", urgencia: "alta" },
        { id: "m2", ra: "Sudoeste", dor: "Congestionamento intenso nos acessos e rotatórias nos horários de pico escolares.", acao: "Estudo de engenharia de tráfego com o DETRAN-DF para rotas de fluxo alternativo nos horários escolares.", urgencia: "media" },
        { id: "m3", ra: "Águas Claras", dor: "Falta de áreas verdes estruturadas e lixeiras de descarte seletivo adequadas.", acao: "Proposta de emendas para revitalização de praças públicas com lixeiras de coleta inteligente.", urgencia: "media" }
      ],
      assistenteSegmentado: {
        jovens: "Foco no empreendedorismo tecnológico, startups, capacitação em TI e redução da burocracia estatal para abertura de empresas.",
        adultos: "Atração de investimentos para o comércio do DF, incentivos fiscais para empresas locais e redução do ICMS.",
        seniors: "Policiamento preventivo robusto, segurança integrada em áreas urbanas comerciais e manutenção asfáltica de vias arteriais."
      }
    };
  }

  if (norm.includes("pedrosa") || norm.includes("eduardo")) {
    return {
      socialPosts: [
        { id: "s1", platform: "instagram", date: "Há 4 horas", text: "Visitando o Hospital de Apoio de Brasília. Vamos ampliar as emendas para o tratamento de oncologia infantil!", likes: 1750, comments: 92, sentiment: "positivo", engagement: "6.1%" },
        { id: "s2", platform: "facebook", date: "Há 2 dias", text: "Debatendo propostas de desoneração tributária para a contratação de trabalhadores acima dos 50 anos pelas empresas do DF.", likes: 890, comments: 34, sentiment: "positivo", engagement: "3.5%" },
        { id: "s3", platform: "instagram", date: "Há 5 dias", text: "Nossa indicação foi atendida! Revitalização completa das quadras poliesportivas de Sobradinho em andamento.", likes: 1420, comments: 61, sentiment: "positivo", engagement: "5.1%" }
      ],
      mapeamentoHiperlocal: [
        { id: "m1", ra: "Sobradinho", dor: "Erosão de solo e falta de asfalto em condomínios em processo de regularização.", acao: "Articular com a Terracap celeridade nas licenças de infraestrutura urbana e drenagem profunda.", urgencia: "critica" },
        { id: "m2", ra: "Planaltina", dor: "Carência de leitos de UTI infantil no Hospital Regional de Planaltina.", acao: "Destinação de emenda impositiva específica para equipar nova ala pediátrica com leitos especializados.", urgencia: "critica" },
        { id: "m3", ra: "Fercal", dor: "Problemas recorrentes com poeira e poços artesianos irregulares na comunidade.", acao: "Indicação parlamentar para ligação de rede hídrica da CAESB e fomento à pavimentação asfáltica.", urgencia: "alta" }
      ],
      assistenteSegmentado: {
        jovens: "Discussão sobre inovação no ensino de tecnologia e programas de bolsas estudantis técnicas. Abordagem moderada e propositiva.",
        adultos: "Apoio a microempresas locais, fomento de parcerias público-privadas e linhas de crédito facilitadas para varejo de bairros.",
        seniors: "Ampliação de exames oncológicos e cardiológicos rápidos nos hospitais. Programas públicos de ginástica da terceira idade."
      }
    };
  }

  if (norm.includes("amarilio") || norm.includes("dayse")) {
    return {
      socialPosts: [
        { id: "s1", platform: "instagram", date: "Há 1 hora", text: "Defendemos hoje a convocação imediata de todos os enfermeiros e técnicos aprovados no concurso da SES-DF!", likes: 3200, comments: 412, sentiment: "positivo", engagement: "11.5%" },
        { id: "s2", platform: "instagram", date: "Há 1 dia", text: "Visita fiscalizatória surpresa no Hospital de Base. A falta de insumos básicos é inaceitável, cobramos providências!", likes: 2150, comments: 189, sentiment: "positivo", engagement: "8.6%" },
        { id: "s3", platform: "facebook", date: "Há 3 dias", text: "Saúde mental importa! Propomos um canal de apoio psicológico contínuo para os profissionais da educação e saúde do DF.", likes: 1400, comments: 85, sentiment: "positivo", engagement: "5.3%" }
      ],
      mapeamentoHiperlocal: [
        { id: "m1", ra: "Guará", dor: "Dificuldade de agendamento de consultas básicas e exames na UBS local.", acao: "Destinar recursos de emenda parlamentar para informatização e atendimento eletrônico na UBS do Guará.", urgencia: "alta" },
        { id: "m2", ra: "Ceilândia", dor: "Falta de profissionais especializados em saúde da mulher e exames preventivos de câncer.", acao: "Propor mutirão de exames ginecológicos preventivos (Carreta da Mulher) em regiões vulneráveis do Sol Nascente.", urgencia: "critica" },
        { id: "m3", ra: "São Sebastião", dor: "Dificuldade de atendimento odontológico público de emergência fora do horário comercial.", acao: "Solicitação junto à SES de plantão odontológico estendido nas UPAs periféricas da região leste.", urgencia: "alta" }
      ],
      assistenteSegmentado: {
        jovens: "Conscientização sobre saúde mental, canais de escuta escolar e prevenção à ansiedade juvenil. Postagens informativas, de acolhimento e lives.",
        adultos: "Cobrança de vagas em concursos da saúde, defesa das categorias de enfermagem e assistência ao parto humanizado. Discursos firmes sobre valorização do SUS.",
        seniors: "Garantia de insumos para doenças crônicas, remédios de uso diário nas farmácias de alto custo e acesso rápido a geriatras."
      }
    };
  }

  if (norm.includes("magno") || norm.includes("gabriel")) {
    return {
      socialPosts: [
        { id: "s1", platform: "instagram", date: "Há 6 horas", text: "Inadmissível a falta de professores substitutos nas escolas públicas do DF. A educação de nossas crianças está em risco!", likes: 1980, comments: 204, sentiment: "positivo", engagement: "7.1%" },
        { id: "s2", platform: "facebook", date: "Há 1 dia", text: "Estivemos presentes no ato dos professores e servidores da educação cobrando a reestruturação da carreira do magistério.", likes: 1100, comments: 82, sentiment: "positivo", engagement: "4.5%" },
        { id: "s3", platform: "instagram", date: "Há 3 dias", text: "Nossa emenda garantiu a reforma da biblioteca e do laboratório de informática do CEM 01 de Planaltina. O futuro começa na escola!", likes: 1650, comments: 79, sentiment: "positivo", engagement: "6.0%" }
      ],
      mapeamentoHiperlocal: [
        { id: "m1", ra: "Planaltina", dor: "Falta de manutenção predial crônica em escolas públicas históricas da região.", acao: "Criar emendas parlamentares específicas vinculadas à reforma de telhados, fiação e banheiros das escolas de Planaltina.", urgencia: "critica" },
        { id: "m2", ra: "Paranoá", dor: "Falta de creches públicas para mães trabalhadoras que precisam deixar seus filhos pequenos.", acao: "Indicação parlamentar para convênios com creches locais e fomento à construção de novos centros de educação infantil (CEI).", urgencia: "critica" },
        { id: "m3", ra: "Itapoã", dor: "Falta de cursinhos preparatórios gratuitos para o ENEM focados em estudantes da rede pública.", acao: "Destinação de emenda para financiamento de cursinho comunitário de preparação para o ENEM e PAS no Itapoã.", urgencia: "alta" }
      ],
      assistenteSegmentado: {
        jovens: "Passe livre estudantil irrestrito, acesso à internet de alta velocidade em ambientes públicos e cursinhos populares gratuitos para vestibular. Linguagem enérgica.",
        adultos: "Vagas em creches de tempo integral, segurança escolar qualificada e infraestrutura para que as mães possam trabalhar tranquilas.",
        seniors: "Defesa das pensões e previdência, inclusão digital para idosos e eventos culturais públicos de integração intergeracional."
      }
    };
  }

  if (norm.includes("jane") || norm.includes("klebia")) {
    return {
      socialPosts: [
        { id: "s1", platform: "instagram", date: "Há 2 horas", text: "Reunião de trabalho com as mulheres de São Sebastião. Nosso projeto de capacitação profissional e autonomia financeira já mudou vidas!", likes: 1250, comments: 74, sentiment: "positivo", engagement: "4.1%" },
        { id: "s2", platform: "facebook", date: "Há 2 dias", text: "Debatendo propostas de segurança pública preventiva, com reforço de ronda escolar permanente nas imediações dos colégios do DF.", likes: 940, comments: 41, sentiment: "positivo", engagement: "3.1%" },
        { id: "s3", platform: "instagram", date: "Há 4 dias", text: "Visitamos o Centro de Referência de Assistência Social (CRAS) cobrando agilidade no cadastro de famílias vulneráveis.", likes: 1100, comments: 53, sentiment: "positivo", engagement: "3.8%" }
      ],
      mapeamentoHiperlocal: [
        { id: "m1", ra: "São Sebastião", dor: "Atraso no atendimento do CRAS e falta de servidores para agilizar cadastros assistenciais.", acao: "Articulação junto à SEDES para abertura de concurso público emergencial de assistentes sociais e mutirões de atendimento.", urgencia: "critica" },
        { id: "m2", ra: "Santa Maria", dor: "Ocorrência de casos de violência doméstica e falta de acolhimento especializado imediato.", acao: "Propor implantação de uma Delegacia Especializada de Atendimento à Mulher (DEAM) de plantão 24h na região sul.", urgencia: "critica" },
        { id: "m3", ra: "Gama", dor: "Estradas de terra precárias ligando assentamentos agrícolas à área de comércio central.", acao: "Emendas impositivas para encascalhamento e asfalto frio em trechos rurais integrados ao Gama.", urgencia: "alta" }
      ],
      assistenteSegmentado: {
        jovens: "Prevenção à violência doméstica, canais de denúncia segura e cursos de formação profissional em mídias digitais para meninas de periferia.",
        adultos: "Emprego e empreendedorismo para mulheres, combate à desigualdade de gênero nas contratações e apoio psicológico para chefes de família.",
        seniors: "Atendimento preferencial rápido nos órgãos de assistência social e programas de prevenção de golpes virtuais em aposentados."
      }
    };
  }

  return {
    socialPosts: [
      { id: "s1", platform: "instagram", date: "Há 3 horas", text: "Trabalhando firme pela segurança pública! Propomos o aumento do efetivo policial e reestruturação de delegacias locais do DF.", likes: 1450, comments: 94, sentiment: "positivo", engagement: "5.4%" },
      { id: "s2", platform: "facebook", date: "Há 2 dias", text: "Fiscalizando as obras de infraestrutura e saneamento básico no Sol Nascente. Dignidade para nosso povo é prioridade!", likes: 1120, comments: 65, sentiment: "neutro", engagement: "4.1%" },
      { id: "s3", platform: "instagram", date: "Há 4 dias", text: "Esporte e lazer geram inclusão social. Destinamos emendas para a reforma de campos sintéticos e quadras esportivas nas cidades satélites.", likes: 1300, comments: 51, sentiment: "positivo", engagement: "4.8%" }
    ],
    mapeamentoHiperlocal: [
      { id: "m1", ra: "Candangolândia", dor: "Aumento nos índices de criminalidade urbana no comércio e imediações do metrô.", acao: "Criação de canais de vigilância interligados e ampliação da ronda ostensiva militar do batalhão local.", urgencia: "alta" },
      { id: "m2", ra: "Vila Telebrasília", dor: "Vias residenciais de tráfego estreito gerando colisões de trânsito.", acao: "Estudo de viabilidade de sinalização horizontal de mão única e desvios de estacionamento.", urgencia: "media" },
      { id: "m3", ra: "Guará", dor: "Iluminação pública falha em becos residenciais tradicionais.", acao: "Encaminhar pedido urgente à CEB Iluminação para troca imediata para lâmpadas de LED modernas de alto fluxo.", urgencia: "alta" }
    ],
    assistenteSegmentado: {
      jovens: "Acesso facilitado a complexos esportivos, internet wifi livre em praças e parcerias de primeiro emprego com cooperativas regionais.",
      adultos: "Saneamento básico robusto, asfalto de alta durabilidade e policiamento preventivo eficaz em centros de compras.",
      seniors: "UBS estruturadas para atendimento ágil sem filas externas na madrugada e calçadas acessíveis sem degraus."
    }
  };
}

interface CampaignHQ2026Props {
  selectedCandidate: Candidate;
  setOraculoInput: (value: string) => void;
  setActiveTab: (tab: any) => void;
}

const CampaignHQ2026 = ({ selectedCandidate, setOraculoInput, setActiveTab }: CampaignHQ2026Props) => {
  const [selectedDemographic, setSelectedDemographic] = useState<"jovens" | "adultos" | "seniors">("jovens");
  const [apiData, setApiData] = useState<any>(null);
  const [loadingApi, setLoadingApi] = useState<boolean>(true);

  const data = getCampaign2026Data(selectedCandidate.nome_urna);

  useEffect(() => {
    let isMounted = true;
    setLoadingApi(true);
    fetch(`/api/campanhas-2026/${selectedCandidate.id_candidato}`)
      .then((res) => {
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then((resData) => {
        if (isMounted) {
          setApiData(resData);
          setLoadingApi(false);
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar dados do QG 2026:", err);
        if (isMounted) {
          setLoadingApi(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [selectedCandidate.id_candidato]);

  const demographicDetails = {
    jovens: {
      title: "Eleitores Jovens (16-24 anos)",
      focus: "Redes Sociais, Cultura, Emprego e Educação",
      tone: "Dinâmico, inclusivo, visual e focado em engajamento digital rápido.",
      strategy: data.assistenteSegmentado.jovens,
      prompt: `Crie um roteiro de vídeo curto (Reels/TikTok) de 60 segundos focado em eleitores jovens (16-24 anos) para o candidato ${selectedCandidate.nome_urna}, destacando pautas de fomento à cultura periférica, passe livre estudantil e tecnologia, utilizando tom dinâmico.`
    },
    adultos: {
      title: "Adultos Ativos (25-59 anos)",
      focus: "Emprego, Segurança, Saúde e Infraestrutura Urbana",
      tone: "Objetivo, realista, com foco em propostas concretas e impacto imediato.",
      strategy: data.assistenteSegmentado.adultos,
      prompt: `Gere uma pauta de propostas legislativas para o candidato ${selectedCandidate.nome_urna} com foco nos eleitores adultos ativos (25-59 anos), abordando propostas de empregabilidade, regularização fundiária e melhoria do transporte público local no DF.`
    },
    seniors: {
      title: "Eleitores Sêniors (60-70 anos)",
      focus: "Saúde, Assistência Social e Segurança Pública",
      tone: "Acolhedor, respeitoso, didático e focado na dignidade e bem-estar.",
      strategy: data.assistenteSegmentado.seniors,
      prompt: `Escreva um discurso curto de comício focado em eleitores da terceira idade (60-70 anos) para o candidato ${selectedCandidate.nome_urna}, enfatizando o fortalecimento do SUS local, remédios na farmácia de alto custo e espaços de convivência urbana.`
    }
  };

  const handleSendPromptToOraculo = (promptText: string) => {
    setOraculoInput(promptText);
    setActiveTab("oraculo");
    setTimeout(() => {
      const inputEl = document.getElementById("oraculo-chat-input");
      if (inputEl) {
        inputEl.scrollIntoView({ behavior: "smooth" });
        inputEl.focus();
      }
    }, 150);
  };

  // Merge API and local data for Social Scraping
  const scraping = apiData?.scraping_redes || {
    plataforma: data.socialPosts[0]?.platform || "Instagram",
    tempo: data.socialPosts[0]?.date || "Há 2 horas",
    ultimo_post: data.socialPosts[0]?.text || "Sem publicações recentes encontradas.",
    likes: data.socialPosts[0]?.likes || 0,
    comentarios: data.socialPosts[0]?.comments || 0,
    engajamento: data.socialPosts[0]?.engagement || "0%"
  };

  // Merge API and local data for Mapeamento
  const demandas = apiData?.mapeamento_demandas || data.mapeamentoHiperlocal.map(row => ({
    regiao_administrativa: row.ra,
    ponto_de_dor: row.dor,
    diretriz_recomendada: row.acao,
    urgencia: row.urgencia.toUpperCase()
  }));

  // Selected age range properties
  const activeDetails = demographicDetails[selectedDemographic];

  return (
    <div className="space-y-6 bg-[#090d16] p-6 rounded-2xl border border-slate-800 text-slate-100">
      {/* HEADER DA CAMPANHA */}
      <div className="bg-gradient-to-r from-purple-950 to-indigo-950 p-4 rounded-xl text-white shadow-md border border-indigo-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-left">
          <h4 className="text-xs font-bold tracking-widest uppercase text-purple-400">Campanhas 2026 (Ativas)</h4>
          <h3 className="text-lg font-black tracking-tight mt-0.5 text-white">⚡ Matriz de Inteligência Preditiva</h3>
        </div>
        <div className="flex items-center gap-2 bg-purple-900/30 px-3 py-1.5 rounded-lg border border-purple-800/40 w-fit shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Inteligência Ativa</span>
        </div>
      </div>

      {loadingApi ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 bg-slate-900/50 border border-slate-800/80 rounded-xl">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-purple-500 rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-mono">Sincronizando dados preditivos com banco de dados de inteligência...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* CARD 1: SCRAPING DE REDES SOCIAIS */}
            <div className="border border-slate-800 bg-slate-900/90 rounded-2xl p-5 shadow-lg flex flex-col h-[390px] text-left">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">
                    Scraping de Redes Sociais
                  </h4>
                </div>
                <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-2 py-0.5 rounded-md">
                  LIVE FEED
                </span>
              </div>
              
              <div className="flex-1 flex flex-col justify-between overflow-y-auto space-y-4 pr-1 scroll-hide">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition-all">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      {scraping.plataforma.toLowerCase() === "instagram" ? (
                        <span className="p-1 bg-pink-950/60 text-pink-400 rounded-lg text-xs font-black flex items-center justify-center border border-pink-900/40">
                          <Instagram className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="p-1 bg-blue-950/60 text-blue-400 rounded-lg text-xs font-black flex items-center justify-center border border-blue-900/40">
                          <Facebook className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-slate-300 uppercase">{scraping.plataforma}</span>
                      <span className="text-[10px] text-slate-500 font-medium">• {scraping.tempo}</span>
                    </div>
                    
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-950/50 text-emerald-400 border border-emerald-900/40">
                      POSITIVO
                    </span>
                  </div>
                  
                  <p className="text-xs text-slate-300 font-medium leading-relaxed mb-3">
                    "{scraping.ultimo_post}"
                  </p>
                  
                  <div className="flex gap-4 border-t border-slate-800 pt-2 text-[10px] font-bold text-slate-400 font-mono">
                    <span>👍 {scraping.likes.toLocaleString("pt-BR")} <span className="text-slate-500 font-medium">likes</span></span>
                    <span>💬 {scraping.comentarios.toLocaleString("pt-BR")} <span className="text-slate-500 font-medium">comentários</span></span>
                    <span className="text-purple-400 font-extrabold ml-auto">Engajamento: {scraping.engajamento}</span>
                  </div>
                </div>

                {/* Additional Insights from CSV / API */}
                {apiData?.cruzamento_politico && (
                  <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-left">
                    <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest block">Gargalo nas Redes</span>
                    <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                      {apiData.cruzamento_politico.gargalo_redes || "Monitore o sentimento orgânico e otimize o funil de engajamento do eleitorado digital."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 2: ASSISTENTE DE PERSUASÃO */}
            <div className="border border-slate-800 bg-slate-900/90 rounded-2xl p-5 shadow-lg flex flex-col h-[390px] text-left">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
                <Users className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">
                  Assistente de Persuasão
                </h4>
              </div>

              {/* Seletor de Faixa Etária */}
              <div className="flex gap-1 bg-slate-950 p-1 rounded-xl mb-3 shrink-0 border border-slate-800">
                {(["jovens", "adultos", "seniors"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSelectedDemographic(tab)}
                    className={`flex-1 text-center py-1.5 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer ${
                      selectedDemographic === tab
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                    }`}
                  >
                    {tab === "jovens" ? "16-24 Anos" : tab === "adultos" ? "25-59 Anos" : "60-70 Anos"}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 scroll-hide flex flex-col justify-between">
                <div className="space-y-3 text-left">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block">Público-Alvo</span>
                      <span className="text-xs font-black text-slate-100 mt-0.5 block truncate">
                        {activeDetails.title}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Temas Críticos</span>
                      <span className="text-xs font-bold text-slate-300 mt-0.5 block truncate">
                        {activeDetails.focus}
                      </span>
                    </div>
                  </div>

                  {apiData?.cruzamento_politico && (
                    <div className="p-3 bg-purple-950/20 border border-purple-900/30 rounded-xl">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md text-[9px] font-black uppercase tracking-wider">
                          {apiData.cruzamento_politico.situacao_2026}
                        </span>
                        <span className="text-[9px] font-extrabold text-slate-400">
                          Pretensão: <span className="text-slate-200 font-black">{apiData.cruzamento_politico.cargo_pretendido}</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed font-medium">
                        {apiData.cruzamento_politico.insights_politicos}
                      </p>
                    </div>
                  )}

                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Diretriz de Linguagem</span>
                    <p className="text-xs text-slate-300 font-medium leading-relaxed bg-indigo-950/40 border border-indigo-900/30 p-3 rounded-xl mt-1">
                      {apiData?.assistente_persuasao?.foco_linguagem || activeDetails.tone}
                    </p>
                  </div>

                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Estratégia Recomendada</span>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed bg-slate-950 border border-slate-850 p-2.5 rounded-xl mt-1 max-h-[75px] overflow-y-auto scroll-hide">
                      {selectedDemographic === "jovens" ? (apiData?.assistente_persuasao?.sugestao_conteudo || activeDetails.strategy) : activeDetails.strategy}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleSendPromptToOraculo(activeDetails.prompt)}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-3 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Enviar Diretriz p/ o Oráculo Chat</span>
                </button>
              </div>
            </div>

          </div>

          {/* CARD 3: MAPEAMENTO HIPERLOCAL */}
          <div className="border border-slate-800 bg-slate-900/90 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">
                Mapeamento Hiperlocal de Demandas & Pontos de Dor (DF)
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Região Administrativa</th>
                    <th className="py-2.5 px-3">Ponto de Dor (Demanda Local)</th>
                    <th className="py-2.5 px-3">Diretriz de Ação Recomendada</th>
                    <th className="py-2.5 px-3 text-center">Urgência</th>
                  </tr>
                </thead>
                <tbody>
                  {demandas.map((row: any, idx: number) => {
                    const urgStr = (row.urgencia || "").toUpperCase();
                    const isCritica = urgStr === "CRÍTICA" || urgStr === "CRITICA";
                    const isAlta = urgStr === "ALTA";

                    return (
                      <tr key={idx} className="border-b border-slate-800/40 hover:bg-slate-950/40 transition-colors">
                        <td className="py-3 px-3 text-left">
                          <span className="text-xs font-extrabold text-white block">{row.regiao_administrativa}</span>
                        </td>
                        <td className="py-3 px-3 max-w-xs text-left">
                          <span className="text-xs font-medium text-slate-300 leading-relaxed block">{row.ponto_de_dor}</span>
                        </td>
                        <td className="py-3 px-3 max-w-sm text-left">
                          <span className="text-xs font-semibold text-slate-400 leading-relaxed block">{row.diretriz_recomendada}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                            isCritica
                              ? "bg-rose-950/50 text-rose-400 border-rose-900/60"
                              : isAlta
                              ? "bg-amber-950/50 text-amber-400 border-amber-900/60"
                              : "bg-blue-950/50 text-blue-400 border-blue-900/60"
                          }`}>
                            {row.urgencia}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default function App() {
  const [selectedYear, setSelectedYear] = useState<number>(2022);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedCandidateName, setSelectedCandidateName] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [candidateNoDataForYear, setCandidateNoDataForYear] = useState<boolean>(false);
  const selectedCandidateNameRef = useRef<string | null>(null);
  const isInitialLoad = useRef<boolean>(true);

  useEffect(() => {
    selectedCandidateNameRef.current = selectedCandidateName;
  }, [selectedCandidateName]);
  const [loadingDossier, setLoadingDossier] = useState<boolean>(false);
  const [dossierHistory, setDossierHistory] = useState<HistoricalDispute[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"audit" | "oraculo" | "conexoes">("oraculo");
  const [activeMainCard, setActiveMainCard] = useState<"gastos" | "geoeleitoral" | "reputacao">("gastos");
  const [isMobileAssistantOpen, setIsMobileAssistantOpen] = useState<boolean>(false);
  
  // Reputation / Clipping state
  const [reputationModalOpen, setReputationModalOpen] = useState<boolean>(false);
  const [reputationCandidate, setReputationCandidate] = useState<Candidate | null>(null);
  const [reputationClippings, setReputationClippings] = useState<any[]>([]);
  const [loadingReputation, setLoadingReputation] = useState<boolean>(false);

  const handleOpenReputationDossier = async (cand: Candidate) => {
    setReputationCandidate(cand);
    setReputationModalOpen(true);
    setLoadingReputation(true);
    setReputationClippings([]);
    try {
      const response = await fetch(`/api/reputacao/${cand.id_candidato}`);
      if (response.ok) {
        const data = await response.json();
        setReputationClippings(Array.isArray(data) ? data : []);
      } else {
        setReputationClippings([]);
      }
    } catch (err) {
      console.error("Erro ao buscar dossiê de reputação:", err);
      setReputationClippings([]);
    } finally {
      setLoadingReputation(false);
    }
  };
  
  // AI Audit State
  const [aiAuditText, setAiAuditText] = useState<string>("");
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);
  
  // Oráculo State
  const [oraculoChat, setOraculoChat] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "oraculo",
      text: "Olá! Sou o Oráculo do Gabinete IA. Posso analisar os dados eleitorais e financeiros dos Deputados Distritais da CLDF de 2018 e 2022. Pergunte-me qualquer coisa sobre votos, despesas contratadas, fornecedores ou eficiência de campanhas!",
      timestamp: new Date()
    }
  ]);
  const [oraculoInput, setOraculoInput] = useState<string>("");
  const [sendingOraculo, setSendingOraculo] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Voice integration states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState<boolean>(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  
  // Speech recognition and autospeak refs to prevent closures
  const recognitionRef = useRef<any>(null);
  const autoSpeakEnabledRef = useRef<boolean>(false);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const rec = new SpeechRecognitionAPI();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "pt-BR"; // Brazilian Portuguese

      rec.onstart = () => {
        setIsRecording(true);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setOraculoInput(prev => prev ? prev + " " + transcript : transcript);
        }
      };

      rec.onerror = (event: any) => {
        console.error("Erro na gravação de voz:", event.error);
        setIsRecording(false);
        if (event.error === "not-allowed") {
          alert("Permissão de microfone negada. Certifique-se de autorizar o acesso ao microfone no seu navegador e nas permissões da página.");
        } else if (event.error === "no-speech") {
          // No speech detected, ignore silently or with minor log
        } else {
          alert(`Erro na gravação de voz: ${event.error}`);
        }
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Handle start/stop recording
  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("A gravação de voz não é suportada por este navegador ou ambiente.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      // Stop active speaking before starting to record
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Erro ao iniciar gravação:", e);
      }
    }
  };

  // Speak text using SpeechSynthesis
  const speakMessage = (messageId: string, text: string) => {
    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean markdown for text-to-speech reading
    const cleanText = text
      .replace(/[\*\#\_`~]/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "pt-BR";

    utterance.onstart = () => {
      setSpeakingMessageId(messageId);
    };

    utterance.onend = () => {
      setSpeakingMessageId(null);
    };

    utterance.onerror = () => {
      setSpeakingMessageId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleSetAutoSpeak = (val: boolean) => {
    setAutoSpeakEnabled(val);
    autoSpeakEnabledRef.current = val;
    if (!val) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Google Drive & Auth State
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [googleUser, setGoogleUser] = useState<any | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [loadingGoogleAuth, setLoadingGoogleAuth] = useState<boolean>(true);
  
  // Drive spreadsheet explorer state
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [sheetsList, setSheetsList] = useState<string[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>("");
  const [loadingSheetContent, setLoadingSheetContent] = useState<boolean>(false);
  const [sheetRows, setSheetRows] = useState<string[][]>([]);
  const [driveError, setDriveError] = useState<string | null>(null);

  // GitHub integration state
  const [githubToken, setGithubToken] = useState<string>("");
  const [githubUser, setGithubUser] = useState<GitHubProfile | null>(null);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [exportPath, setExportPath] = useState<string>("auditoria_cldf.md");
  const [exportingGithub, setExportingGithub] = useState<boolean>(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [githubSuccess, setGithubSuccess] = useState<string | null>(null);

  // General state
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isImportingGeo, setIsImportingGeo] = useState<boolean>(false);
  const [importMessage, setImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [geoSubTab, setGeoSubTab] = useState<"candidato" | "geral">("geral");
  const [repSubTab, setRepSubTab] = useState<"candidato" | "geral">("geral");
  const [simulatedBudget, setSimulatedBudget] = useState<number>(100000);

  // States for custom spreadsheet URL input
  const [customUrl, setCustomUrl] = useState<string>("");
  const [customUrlError, setCustomUrlError] = useState<string | null>(null);

  const FIXED_SPREADSHEETS = [
    {
      id: "1nJNN5uIy2VFntzdbBbTfdDytIZtClgEi",
      name: "Planilha do Gabinete 1 (Candidatos DF 1)",
      url: "https://docs.google.com/spreadsheets/d/1nJNN5uIy2VFntzdbBbTfdDytIZtClgEi/edit"
    },
    {
      id: "19pFvgTENVkdiqv9lgxoGBTgzMhczi_tw",
      name: "Planilha do Gabinete 2 (Candidatos DF 2)",
      url: "https://docs.google.com/spreadsheets/d/19pFvgTENVkdiqv9lgxoGBTgzMhczi_tw/edit"
    }
  ];

  const extractSpreadsheetId = (urlStr: string): string | null => {
    const match = urlStr.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  const handleConnectCustomUrl = () => {
    setCustomUrlError(null);
    if (!googleToken) {
      setCustomUrlError("Por favor, conecte ao Google Drive primeiro.");
      return;
    }
    const id = extractSpreadsheetId(customUrl);
    if (!id) {
      setCustomUrlError("URL inválida. Use o formato: https://docs.google.com/spreadsheets/d/[ID]/edit");
      return;
    }
    
    const pseudoFile: DriveFile = {
      id: id,
      name: `Planilha via Link Manual (${id.substring(0, 6)}...)`,
      mimeType: "application/vnd.google-apps.spreadsheet",
      modifiedTime: new Date().toISOString()
    };
    
    handleSelectFile(pseudoFile);
  };

  // Initialize Auth listeners and saved tokens
  useEffect(() => {
    setLoadingGoogleAuth(true);
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setNeedsAuth(false);
        setLoadingGoogleAuth(false);
        // Load files automatically
        loadSpreadsheets(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setNeedsAuth(true);
        setLoadingGoogleAuth(false);
      }
    );

    // Load GitHub token from localStorage if any
    const savedGitHubToken = localStorage.getItem("github_token");
    if (savedGitHubToken) {
      setGithubToken(savedGitHubToken);
      fetchGitHubProfile(savedGitHubToken);
    }

    return () => unsubscribe();
  }, []);

  // Helper: Fetch spreadsheets
  const loadSpreadsheets = async (token: string) => {
    setLoadingFiles(true);
    setDriveError(null);
    try {
      const files = await listSpreadsheets(token);
      setDriveFiles(files);
    } catch (err: any) {
      setDriveError(err.message || "Erro ao listar planilhas");
    } finally {
      setLoadingFiles(false);
    }
  };

  // Helper: Fetch GitHub profile
  const fetchGitHubProfile = async (token: string) => {
    setGithubError(null);
    try {
      const profile = await getGitHubProfile(token);
      setGithubUser(profile);
      // Fetch user repos
      const repos = await getGitHubRepos(token);
      setGithubRepos(repos);
      if (repos.length > 0) {
        setSelectedRepo(repos[0].name);
      }
    } catch (err: any) {
      setGithubError(err.message || "Erro ao conectar com GitHub");
      setGithubUser(null);
      localStorage.removeItem("github_token");
    }
  };

  // Load candidate list for selected year
  useEffect(() => {
    if (selectedYear === 2026) {
      setCandidates(candidates2026);
      setLoadingList(false);
      const currentSelectedName = selectedCandidateNameRef.current;
      const isCurrentIn2026 = currentSelectedName && candidates2026.some(c => c.nome_urna === currentSelectedName);
      if (isCurrentIn2026) {
        const match = candidates2026.find(c => c.nome_urna === currentSelectedName);
        if (match) {
          setSelectedCandidate(match);
          setSelectedCandidateName(match.nome_urna);
          setSelectedCandidateId(match.id_candidato.toString());
        }
      } else {
        setSelectedCandidate(null);
        setSelectedCandidateName(null);
        setSelectedCandidateId(null);
      }
      return;
    }

    async function fetchCandidates() {
      setLoadingList(true);
      try {
        const response = await fetch(`/api/eleitos/${selectedYear}`);
        const data = await response.json();
        if (Array.isArray(data)) {
          setCandidates(data);
          
          const currentSelectedName = selectedCandidateNameRef.current;
          if (currentSelectedName) {
            // Persist current candidate selection across years!
            fetchDossier(currentSelectedName, selectedYear);
          } else if (isInitialLoad.current) {
            // Auto select first candidate in list on initial load
            isInitialLoad.current = false;
            if (data.length > 0) {
              fetchDossier(data[0].nome_urna, selectedYear);
            } else {
              setSelectedCandidate(null);
            }
          } else {
            // Keep in search list view if they explicitly logged out of profile
            setSelectedCandidate(null);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar candidatos:", err);
      } finally {
        setLoadingList(false);
      }
    }
    fetchCandidates();
  }, [selectedYear]);

  function handleFallback(nomeUrna: string, ano: number) {
    setCandidateNoDataForYear(true);
    setSelectedCandidateName(nomeUrna);
    
    setSelectedCandidate(prev => {
      return {
        id_candidato: prev?.id_candidato || -1,
        nome_urna: nomeUrna,
        nome_completo: prev?.nome_completo || nomeUrna,
        partido: prev?.partido || "S/P",
        ano_eleicao: ano,
        total_votos: 0,
        foto_url: prev?.foto_url || "",
        cargo: prev?.cargo || "Deputado Distrital",
        situacao: "Não Disputou",
        total_receitas: 0,
        despesas_contratadas: 0,
        despesas_pagas: 0,
        maior_fornecedor_nome: "Não se aplica",
        maior_fornecedor_valor: 0,
        detalhe_despesas: [],
        votos_geoeleitorais: []
      };
    });
  }

  // Fetch detailed candidate dossier
  async function fetchDossier(nomeUrna: string, ano: number) {
    if (ano === 2026) {
      const match = candidates2026.find(c => c.nome_urna === nomeUrna);
      if (match) {
        setSelectedCandidate(match);
        setSelectedCandidateName(nomeUrna);
        setSelectedCandidateId(match.id_candidato.toString());
        setDossierHistory([
          { ano_eleicao: 2022, partido: match.partido, total_votos: match.total_votos, situacao: "Eleito" }
        ]);
        setActiveTab("oraculo");
      }
      return;
    }

    setLoadingDossier(true);
    setCandidateNoDataForYear(false);
    try {
      const response = await fetch(`/api/historico_politico/${encodeURIComponent(nomeUrna)}/${ano}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.candidate) {
          const updatedCandidate: Candidate = {
            ...data.candidate,
            votos_geoeleitorais: data.candidate.votos_geoeleitorais || []
          };
          setSelectedCandidate(updatedCandidate);
          setSelectedCandidateName(nomeUrna);
          setDossierHistory(data.anos_disputados || []);
          setActiveTab("oraculo"); // Switch to oraculo chat in assistant tab
        } else {
          handleFallback(nomeUrna, ano);
        }
      } else {
        handleFallback(nomeUrna, ano);
      }
    } catch (err) {
      console.error("Erro ao carregar dossiê:", err);
      handleFallback(nomeUrna, ano);
    } finally {
      setLoadingDossier(false);
    }
  }

  // Generate and export a beautiful, multi-page PDF document for the current dossier
  const handleExportPDF = () => {
    if (!selectedCandidate) return;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // A4: 210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // A4: 297mm
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2); // 180mm

    let currentY = 15;

    // Helper functions for PDF styling
    const drawHeader = (title: string, subtitle: string) => {
      // Top header banner
      doc.setFillColor(30, 41, 59); // Slate-800 (#1e293b)
      doc.rect(margin, currentY, contentWidth, 18, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(title, margin + 5, currentY + 7);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(subtitle, margin + 5, currentY + 13);
      
      currentY += 24;
    };

    const drawSectionTitle = (title: string) => {
      doc.setFillColor(241, 245, 249); // Slate-100 (#f1f5f9)
      doc.rect(margin, currentY, contentWidth, 8, "F");
      
      // Left vertical accent line
      doc.setFillColor(37, 99, 235); // Blue-600
      doc.rect(margin, currentY, 3, 8, "F");

      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(title, margin + 6, currentY + 5.5);

      currentY += 13;
    };

    const checkPageOverflow = (neededHeight: number, titleToRepeat?: string, subtitleToRepeat?: string) => {
      if (currentY + neededHeight > pageHeight - 20) {
        doc.addPage();
        currentY = 15;
        if (titleToRepeat && subtitleToRepeat) {
          drawHeader(titleToRepeat, subtitleToRepeat);
        }
        return true;
      }
      return false;
    };

    // Calculate audit status
    const audit = getAuditStatus(selectedCandidate);
    const totalVotos = selectedCandidate.total_votos || 0;
    const totalReceitas = selectedCandidate.total_receitas || 0;
    const despesasContratadas = selectedCandidate.despesas_contratadas || 0;
    const candCost = totalVotos > 0 ? despesasContratadas / totalVotos : 0;

    const mainTitle = `DOSSIE DE AUDITORIA E INTELIGENCIA ELEITORAL - ANO ${selectedYear}`;
    const subTitle = `GERADO EM ${new Date().toLocaleDateString("pt-BR")} • IDENTIFICADOR: #SISGAB-${selectedCandidate.id_candidato || "000"}`;

    // ================== PAGE 1: IDENTIFICAÇÃO & HISTÓRICO ==================
    drawHeader(mainTitle, subTitle);

    // Profile Summary Section
    drawSectionTitle("1. IDENTIFICACAO DO PARLAMENTAR / CANDIDATO");

    // Left Column Info
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Nome de Urna:", margin, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(selectedCandidate.nome_urna.toUpperCase(), margin + 35, currentY);

    currentY += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Nome Completo:", margin, currentY);
    doc.setFont("helvetica", "normal");
    const fullNameLines = doc.splitTextToSize(selectedCandidate.nome_completo || selectedCandidate.nome_urna, 55);
    doc.text(fullNameLines, margin + 35, currentY);

    currentY += (fullNameLines.length * 4.5);
    doc.setFont("helvetica", "bold");
    doc.text("Cargo Concorrido:", margin, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(selectedCandidate.cargo || "DEPUTADO DISTRITAL", margin + 35, currentY);

    currentY += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Partido Politico:", margin, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(selectedCandidate.partido, margin + 35, currentY);

    // Right Column Info
    let rightY = currentY - 12 - (fullNameLines.length * 4.5);
    doc.setFont("helvetica", "bold");
    doc.text("Ano do Pleito:", margin + 100, rightY);
    doc.setFont("helvetica", "normal");
    doc.text(selectedYear.toString(), margin + 145, rightY);

    rightY += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Total de Votos:", margin + 100, rightY);
    doc.setFont("helvetica", "normal");
    doc.text(totalVotos > 0 ? totalVotos.toLocaleString("pt-BR") + " votos" : "Nao declarado", margin + 145, rightY);

    rightY += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Situacao do Pleito:", margin + 100, rightY);
    doc.setFont("helvetica", "bold");
    
    const isEleito = selectedCandidate.situacao?.toLowerCase() === "eleito" || selectedCandidate.situacao === "Eleito";
    if (isEleito) {
      doc.setTextColor(16, 185, 129); // Emerald-500
      doc.text("ELEITO", margin + 145, rightY);
    } else {
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text(selectedCandidate.situacao?.toUpperCase() || "NAO CONCLUIDO / OUTROS", margin + 145, rightY);
    }
    doc.setTextColor(30, 41, 59); // Reset

    currentY = Math.max(currentY, rightY) + 12;

    // Series Histórica section
    checkPageOverflow(40, mainTitle, subTitle);
    drawSectionTitle("2. HISTORICO ELEITORAL DE DISPUTAS");

    if (dossierHistory && dossierHistory.length > 0) {
      // Draw Table Header
      doc.setFillColor(248, 250, 252); // Slate-50
      doc.rect(margin, currentY, contentWidth, 7, "F");
      doc.setDrawColor(226, 232, 240); // Slate-200
      doc.rect(margin, currentY, contentWidth, 7, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Ano da Eleicao", margin + 5, currentY + 4.5);
      doc.text("Partido", margin + 45, currentY + 4.5);
      doc.text("Votacao Obtida", margin + 95, currentY + 4.5);
      doc.text("Situacao / Resultado", margin + 145, currentY + 4.5);

      currentY += 7;

      // Draw rows
      dossierHistory.forEach((hist) => {
        checkPageOverflow(10, mainTitle, subTitle);
        doc.setFont("helvetica", "normal");
        doc.rect(margin, currentY, contentWidth, 7, "S");
        doc.text(hist.ano_eleicao.toString(), margin + 5, currentY + 4.5);
        doc.text(hist.partido, margin + 45, currentY + 4.5);
        doc.text(hist.total_votos ? hist.total_votos.toLocaleString("pt-BR") + " votos" : "N/D", margin + 95, currentY + 4.5);
        doc.text(hist.situacao || "N/A", margin + 145, currentY + 4.5);
        currentY += 7;
      });
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.text("Nenhum historico eleitoral adicional localizado.", margin, currentY);
      currentY += 10;
    }

    currentY += 8;

    // Financial Overview
    checkPageOverflow(45, mainTitle, subTitle);
    drawSectionTitle("3. BALANCO FINANCEIRO DE CAMPANHA");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Resumo de Balanco Contabil Declarado:", margin, currentY);
    currentY += 5;

    // Financial Summary Table
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, currentY, contentWidth, 16, "F");
    doc.rect(margin, currentY, contentWidth, 16, "S");

    // Grid columns
    const colW = contentWidth / 3;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin + colW, currentY, margin + colW, currentY + 16);
    doc.line(margin + colW * 2, currentY, margin + colW * 2, currentY + 16);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("RECEITAS DECLARADAS", margin + 5, currentY + 5);
    doc.text("DESPESAS CONTRATADAS", margin + colW + 5, currentY + 5);
    doc.text("SALDO FINAL DE CAIXA", margin + colW * 2 + 5, currentY + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129); // Green
    doc.text(`R$ ${totalReceitas.toLocaleString("pt-BR")}`, margin + 5, currentY + 11.5);
    doc.setTextColor(239, 68, 68); // Red
    doc.text(`R$ ${despesasContratadas.toLocaleString("pt-BR")}`, margin + colW + 5, currentY + 11.5);
    doc.setTextColor(30, 41, 59); // Dark blue
    
    const balance = totalReceitas - despesasContratadas;
    const balanceText = (balance < 0 ? "-" : "") + "R$ " + Math.abs(balance).toLocaleString("pt-BR");
    doc.text(balanceText, margin + colW * 2 + 5, currentY + 11.5);

    currentY += 21;

    // Major Supplier
    if (selectedCandidate.maior_fornecedor_nome) {
      checkPageOverflow(15, mainTitle, subTitle);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text("Principal Fornecedor Declarado:", margin, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(`${selectedCandidate.maior_fornecedor_nome.toUpperCase()} - R$ ${(selectedCandidate.maior_fornecedor_valor || 0).toLocaleString("pt-BR")}`, margin + 55, currentY);
      currentY += 8;
    }

    // ================== PAGE 2: DETALHAMENTO DE GASTOS & EFICIÊNCIA ==================
    doc.addPage();
    currentY = 15;
    const detailTitle = `DOSSIE DE DETALHAMENTO FINANCEIRO E EFICIENCIA`;
    const detailSubTitle = `CANDIDATO: ${selectedCandidate.nome_urna.toUpperCase()} • PARTIDO: ${selectedCandidate.partido}`;
    
    drawHeader(detailTitle, detailSubTitle);

    drawSectionTitle("4. DESPESAS DETALHADAS POR CATEGORIA");

    const detailDespesas = selectedCandidate.detalhe_despesas || [];
    if (detailDespesas.length > 0) {
      // Draw Table Header
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, contentWidth, 7, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, currentY, contentWidth, 7, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Categoria de Despesa Eleitoral", margin + 5, currentY + 4.5);
      doc.text("Valor Contratado (R$)", margin + 110, currentY + 4.5);
      doc.text("Participacao (%)", margin + 155, currentY + 4.5);

      currentY += 7;

      detailDespesas.forEach((item) => {
        checkPageOverflow(10, detailTitle, detailSubTitle);
        const pct = despesasContratadas > 0 ? ((item.value / despesasContratadas) * 100).toFixed(1) : "0.0";
        doc.setFont("helvetica", "normal");
        doc.rect(margin, currentY, contentWidth, 7, "S");
        doc.text(item.category, margin + 5, currentY + 4.5);
        doc.text(`R$ ${item.value.toLocaleString("pt-BR")}`, margin + 110, currentY + 4.5);
        doc.text(`${pct}%`, margin + 155, currentY + 4.5);
        currentY += 7;
      });
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.text("Nao ha dados de despesas detalhados por categoria declarados.", margin, currentY);
      currentY += 10;
    }

    currentY += 8;

    checkPageOverflow(55, detailTitle, detailSubTitle);
    drawSectionTitle("5. ANALISE DE EFICIENCIA DE CAMPANHA & BENCHMARKS");

    // Efficiency data cards
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Metrica de Custo por Eleitor (Voto):", margin, currentY);
    currentY += 5;

    doc.setFillColor(248, 250, 252);
    doc.rect(margin, currentY, contentWidth, 18, "F");
    doc.rect(margin, currentY, contentWidth, 18, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("CUSTO UNITARIO DO VOTO", margin + 5, currentY + 6);
    doc.text("MEDIA DO PARTIDO", margin + 65, currentY + 6);
    doc.text("MEDIA DO CARGO", margin + 125, currentY + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(190, 24, 93); // Pink-700
    doc.text(`R$ ${candCost.toFixed(2)}`, margin + 5, currentY + 12.5);
    doc.setTextColor(30, 41, 59);
    doc.text(audit.partyAverage > 0 ? `R$ ${(audit.partyAverage / (totalVotos || 1)).toFixed(2)}` : "R$ 0.00", margin + 65, currentY + 12.5);
    doc.text(audit.cargoAverage > 0 ? `R$ ${(audit.cargoAverage / (totalVotos || 1)).toFixed(2)}` : "R$ 0.00", margin + 125, currentY + 12.5);

    currentY += 26;

    // Audit status box
    checkPageOverflow(20, detailTitle, detailSubTitle);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Status de Controle e Auditoria de Gastos:", margin, currentY);
    currentY += 5;

    const isAbove = audit.isAbovePartyAverage || audit.isAboveCargoAverage;
    if (isAbove) {
      doc.setFillColor(254, 243, 199); // Amber-100
      doc.setDrawColor(251, 191, 36);  // Amber-400
      doc.setTextColor(146, 64, 14);  // Amber-800
    } else {
      doc.setFillColor(240, 253, 244); // Emerald-100
      doc.setDrawColor(74, 222, 128);   // Emerald-400
      doc.setTextColor(21, 128, 61);    // Emerald-800
    }
    doc.rect(margin, currentY, contentWidth, 12, "F");
    doc.rect(margin, currentY, contentWidth, 12, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    
    const auditText = isAbove 
      ? "ALERTA: Campanha com despesas acima da media registrada para o mesmo cargo ou legenda partidaria."
      : "GASTOS COMPATIVEIS: Campanha operou abaixo ou dentro das faixas normativas medias de mercado.";
    doc.text(auditText, margin + 4, currentY + 7.5);

    currentY += 20;

    // SWOT / Oráculo Text
    checkPageOverflow(40, detailTitle, detailSubTitle);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Parecer de Inteligencia e Recomendacoes SWOT (Oraculo IA):", margin, currentY);
    currentY += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const swotText = `Campanha caracterizada por captacao expressiva do Fundo Especial de Financiamento Eleitoral do partido ${selectedCandidate.partido}. Oportunidades claras de otimizacao de custo unitario por voto focado em engajamento digital e segmentacao organica para os ciclos de planejamento subsequentes. A analise da campanha de ${selectedCandidate.nome_urna} indica uma taxa de eficiencia operacional ${isAbove ? "passivel de otimizacao operacional" : "altamente qualificada, servindo de benchmark para a legenda partidaria"}.`;
    const splitSwot = doc.splitTextToSize(swotText, contentWidth - 10);
    
    doc.setFillColor(250, 250, 250);
    doc.rect(margin, currentY, contentWidth, (splitSwot.length * 4.5) + 6, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, currentY, contentWidth, (splitSwot.length * 4.5) + 6, "S");
    
    doc.text(splitSwot, margin + 5, currentY + 5.5);

    // ================== PAGE 3: TERRITORIAL / GEOELEITORAL ==================
    doc.addPage();
    currentY = 15;
    const geoTitle = `DOSSIE DE ENGENHARIA GEOELEITORAL E TERRITORIAL`;
    const geoSubTitle = `DISTRIBUICAO DE DENSIDADE DE ELEITORES POR ZONA E RA`;
    
    drawHeader(geoTitle, geoSubTitle);

    drawSectionTitle("6. DISTRIBUICAO GEOELEITORAL DE VOTOS");

    const votosGeo = selectedCandidate.votos_geoeleitorais || [];
    if (votosGeo.length > 0) {
      // Draw Table Header
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, contentWidth, 7, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, currentY, contentWidth, 7, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Regiao Administrativa (RA)", margin + 5, currentY + 4.5);
      doc.text("Zona Eleitoral", margin + 75, currentY + 4.5);
      doc.text("Votos Conquistados", margin + 115, currentY + 4.5);
      doc.text("Representacao (%)", margin + 155, currentY + 4.5);

      currentY += 7;

      votosGeo.forEach((vote) => {
        checkPageOverflow(10, geoTitle, geoSubTitle);
        const pct = totalVotos > 0 ? ((vote.votos / totalVotos) * 100).toFixed(1) : "0.0";
        doc.setFont("helvetica", "normal");
        doc.rect(margin, currentY, contentWidth, 7, "S");
        doc.text(vote.ra_nome || "N/A", margin + 5, currentY + 4.5);
        doc.text(`Zona ${vote.zona_eleitoral}`, margin + 75, currentY + 4.5);
        doc.text(`${vote.votos.toLocaleString("pt-BR")} votos`, margin + 115, currentY + 4.5);
        doc.text(`${pct}%`, margin + 155, currentY + 4.5);
        currentY += 7;
      });
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.text("Nao ha dados geoeleitorais de votacao territorial consolidados para este ciclo.", margin, currentY);
      currentY += 10;
    }

    currentY += 15;

    // Disclaimer
    checkPageOverflow(30, geoTitle, geoSubTitle);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, currentY, contentWidth, 24, "F");
    doc.rect(margin, currentY, contentWidth, 24, "S");

    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("CONVENCAO LEGAL E TERMO DE USO DE DADOS:", margin + 5, currentY + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    
    const disclaimerLines = doc.splitTextToSize(
      "Este relatorio constitui um dossie analitico gerado sob demanda pelo Sistema de Inteligencia de Gabinete (SISGAB). As informacoes financeiras e eleitorais estruturadas sao consolidadas a partir de dados abertos divulgados oficialmente pelo Tribunal Superior Eleitoral (TSE). Destina-se exclusivamente ao planejamento parlamentar e a formulacao de estrategias politico-eleitorais de gabinete.",
      contentWidth - 10
    );
    doc.text(disclaimerLines, margin + 5, currentY + 11);

    // ================== FOOTER AND PAGINATION FOR ALL PAGES ==================
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      // Draw line
      doc.setDrawColor(226, 232, 240); // Slate-200
      doc.line(margin, pageHeight - 15, margin + contentWidth, pageHeight - 15);

      // Draw footer text
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("DOCUMENTO OFICIAL PARLAMENTAR • SISGAB INTELIGENCIA ELEITORAL", margin, pageHeight - 10);
      
      const pageText = `Pagina ${i} de ${totalPages}`;
      doc.text(pageText, margin + contentWidth - doc.getTextWidth(pageText), pageHeight - 10);
    }

    // Save PDF
    doc.save(`dossie-${selectedCandidate.nome_urna.toLowerCase()}-${selectedYear}.pdf`);
  };

  // Trigger Gemini-powered general financial audit for chosen year
  async function runAiAudit() {
    setLoadingAudit(true);
    setAiAuditText("");
    try {
      const response = await fetch(`/api/analise/${selectedYear}`);
      const data = await response.json();
      if (data && data.analysis) {
        setAiAuditText(data.analysis);
      } else {
        setAiAuditText("Não foi possível gerar a análise por inteligência artificial no momento.");
      }
    } catch (err) {
      console.error("Erro ao rodar auditoria IA:", err);
      setAiAuditText("Ocorreu um erro ao conectar com o serviço de Inteligência Artificial.");
    } finally {
      setLoadingAudit(false);
    }
  }

  // Google Sign In Handler
  const handleGoogleSignInClick = async () => {
    setLoadingGoogleAuth(true);
    setDriveError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        setNeedsAuth(false);
        loadSpreadsheets(result.accessToken);
      }
    } catch (err: any) {
      setDriveError(err.message || "Erro ao fazer login com o Google");
    } finally {
      setLoadingGoogleAuth(false);
    }
  };

  // Google Sign Out Handler
  const handleGoogleSignOutClick = async () => {
    setLoadingGoogleAuth(true);
    try {
      await logout();
      setGoogleUser(null);
      setGoogleToken(null);
      setNeedsAuth(true);
      setDriveFiles([]);
      setSelectedFile(null);
      setSheetsList([]);
      setSelectedSheetName("");
      setSheetRows([]);
    } catch (err: any) {
      setDriveError(err.message || "Erro ao deslogar do Google");
    } finally {
      setLoadingGoogleAuth(false);
    }
  };

  // Select spreadsheet and fetch list of tabs/sheets inside it
  const handleSelectFile = async (file: DriveFile) => {
    if (!googleToken) return;
    setSelectedFile(file);
    setSheetsList([]);
    setSelectedSheetName("");
    setSheetRows([]);
    setDriveError(null);
    setLoadingSheetContent(true);

    try {
      const details = await getSpreadsheetDetails(googleToken, file.id);
      const sheetNames = details.sheets.map(s => s.properties.title);
      setSheetsList(sheetNames);
      if (sheetNames.length > 0) {
        setSelectedSheetName(sheetNames[0]);
        await loadSheetData(file.id, sheetNames[0]);
      }
    } catch (err: any) {
      setDriveError(err.message || "Erro ao carregar detalhes da planilha");
    } finally {
      setLoadingSheetContent(false);
    }
  };

  // Load a single sheet's actual values
  const loadSheetData = async (fileId: string, sheetName: string) => {
    if (!googleToken) return;
    setLoadingSheetContent(true);
    setDriveError(null);
    try {
      // Increased range from A1:J30 to A1:Z5000 to fetch all geoelectoral records
      const data = await getSheetValues(googleToken, fileId, `${sheetName}!A1:Z5000`);
      setSheetRows(data.values || []);
    } catch (err: any) {
      setDriveError(err.message || "Erro ao carregar dados da aba");
    } finally {
      setLoadingSheetContent(false);
    }
  };

  // When user switches tab/sheet
  const handleSheetTabChange = async (sheetName: string) => {
    setSelectedSheetName(sheetName);
    if (selectedFile) {
      await loadSheetData(selectedFile.id, sheetName);
    }
  };

  // Detect spreadsheet format based on headers
  const detectSheetType = (): "standard" | "geoelectoral" => {
    if (!sheetRows || sheetRows.length === 0) return "standard";
    const firstRow = sheetRows[0].map(s => s ? s.toLowerCase().trim() : "");
    const hasGeoHeaders = firstRow.some(s => 
      s.includes("localidade") || 
      s.includes("zona") || 
      s.includes("nome_oficial") || 
      s.includes("qtd_total_de_votos")
    );
    return hasGeoHeaders ? "geoelectoral" : "standard";
  };

  interface ParsedGeoelectoralRow {
    nome_urna: string;
    ra_nome: string;
    zona_eleitoral: number;
    votos: number;
  }

  interface CandidateGroupedVote {
    nome_urna: string;
    total_votos: number;
    row_count: number;
  }

  // Parse detailed geoelectoral records from spreadsheet rows
  const parseGeoelectoralFromRows = (): ParsedGeoelectoralRow[] => {
    if (sheetRows.length < 2) return [];

    const firstRow = sheetRows[0].map(s => s ? s.toLowerCase().trim() : "");
    
    let idxNome = firstRow.findIndex(s => s.includes("nome_oficial") || s.includes("nome") || s.includes("candidato"));
    let idxLocalidade = firstRow.findIndex(s => s.includes("localidade") || s.includes("ra") || s.includes("regiao"));
    let idxZona = firstRow.findIndex(s => s.includes("zona"));
    let idxVotos = firstRow.findIndex(s => s.includes("qtd_total_de_votos") || s.includes("total_votos") || s.includes("votos") || s.includes("qtd"));

    if (idxNome === -1) idxNome = 0;
    if (idxLocalidade === -1) idxLocalidade = 1;
    if (idxZona === -1) idxZona = 2;
    if (idxVotos === -1) idxVotos = 3;

    const parsed: ParsedGeoelectoralRow[] = [];
    
    for (let i = 1; i < sheetRows.length; i++) {
      const row = sheetRows[i];
      if (!row || !row[idxNome]) continue;

      const name = row[idxNome].trim();
      const ra = row[idxLocalidade] ? row[idxLocalidade].trim() : "Não Informado";
      const zonaVal = parseInt(row[idxZona], 10) || 0;
      
      let votesVal = 0;
      if (row[idxVotos]) {
        votesVal = parseInt(row[idxVotos].toString().replace(/\D/g, ""), 10) || 0;
      }

      parsed.push({
        nome_urna: name,
        ra_nome: ra,
        zona_eleitoral: zonaVal,
        votos: votesVal
      });
    }

    return parsed;
  };

  // Group geoelectoral records to get candidate-level total votes
  const getGroupedGeoelectoralCandidates = (rows: ParsedGeoelectoralRow[]): CandidateGroupedVote[] => {
    const grouped: Record<string, { total_votos: number; row_count: number }> = {};
    
    for (const r of rows) {
      const name = r.nome_urna;
      if (!grouped[name]) {
        grouped[name] = { total_votos: 0, row_count: 0 };
      }
      grouped[name].total_votos += r.votos;
      grouped[name].row_count += 1;
    }
    
    return Object.entries(grouped)
      .map(([nome_urna, data]) => ({
        nome_urna,
        total_votos: data.total_votos,
        row_count: data.row_count
      }))
      .sort((a, b) => b.total_votos - a.total_votos);
  };

  // Commit geoelectoral spreadsheet import into database
  const handleImportGeoelectoral = async () => {
    const geoRows = parseGeoelectoralFromRows();
    if (geoRows.length === 0) {
      setImportMessage({ type: "error", text: "Nenhum dado geoeleitoral válido encontrado nesta aba." });
      return;
    }

    const grouped = getGroupedGeoelectoralCandidates(geoRows);
    const confirmImport = window.confirm(
      `Deseja realmente consolidar e importar ${grouped.length} candidatos (com um total de ${geoRows.length} registros de votação por RA) da planilha "${selectedFile?.name}" para a base de dados oficial SQLite?`
    );
    if (!confirmImport) return;

    setIsImportingGeo(true);
    setImportMessage(null);

    try {
      const response = await fetch("/api/importar_geoeleitoral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: geoRows, ano: selectedYear }),
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        setImportMessage({
          type: "success",
          text: `Sucesso! ${resData.candidates_count} candidatos e ${resData.votes_rows_count} registros de votação por seção foram consolidados no SQLite.`
        });
        
        // Refresh local candidate list
        const listResponse = await fetch(`/api/eleitos/${selectedYear}`);
        const data = await listResponse.json();
        if (Array.isArray(data)) {
          setCandidates(data);
        }
      } else {
        throw new Error(resData.error || "Erro desconhecido na importação geoeleitoral");
      }
    } catch (err: any) {
      setImportMessage({ type: "error", text: `Falha ao importar dados geoeleitorais: ${err.message}` });
    } finally {
      setIsImportingGeo(false);
    }
  };

  // Parse candidate objects from spreadsheet rows
  const parseCandidatesFromRows = (): any[] => {
    if (sheetRows.length < 2) return [];

    // Simple heuristic: check first row for header words
    const firstRow = sheetRows[0].map(s => s ? s.toLowerCase().trim() : "");
    
    // Find column indexes
    let idxNome = firstRow.findIndex(s => s.includes("nome") || s.includes("urna") || s.includes("candidato"));
    let idxCompleto = firstRow.findIndex(s => s.includes("completo"));
    let idxPartido = firstRow.findIndex(s => s.includes("partido") || s.includes("sigla"));
    let idxAno = firstRow.findIndex(s => s.includes("ano") || s.includes("eleicao") || s.includes("ciclo"));
    let idxVotos = firstRow.findIndex(s => s.includes("voto") || s.includes("total"));
    let idxReceitas = firstRow.findIndex(s => s.includes("receita") || s.includes("arrecadado"));
    let idxDespesasContratadas = firstRow.findIndex(s => s.includes("contratada") || s.includes("despesa") || s.includes("gasto"));
    let idxDespesasPagas = firstRow.findIndex(s => s.includes("paga") || s.includes("pago"));
    let idxFornecedorNome = firstRow.findIndex(s => s.includes("fornecedor") || s.includes("empresa"));
    let idxFornecedorValor = firstRow.findIndex(s => s.includes("valor") || s.includes("maior_fornecedor"));

    // Fallbacks if no header detected
    if (idxNome === -1) idxNome = 0;
    if (idxPartido === -1) idxPartido = 1;
    if (idxAno === -1) idxAno = 2;
    if (idxVotos === -1) idxVotos = 3;
    if (idxReceitas === -1) idxReceitas = 4;
    if (idxDespesasContratadas === -1) idxDespesasContratadas = 5;
    if (idxDespesasPagas === -1) idxDespesasPagas = 6;
    if (idxFornecedorNome === -1) idxFornecedorNome = 7;
    if (idxFornecedorValor === -1) idxFornecedorValor = 8;

    const parsed: any[] = [];
    // Start from row index 1 (or 0 if headers aren't clear, but let's assume index 1 for safe table formats)
    const hasHeader = firstRow.some(s => s.includes("nome") || s.includes("partido") || s.includes("votos"));
    const startRow = hasHeader ? 1 : 0;

    for (let i = startRow; i < sheetRows.length; i++) {
      const row = sheetRows[i];
      if (!row || !row[idxNome]) continue;

      parsed.push({
        nome_urna: row[idxNome],
        nome_completo: idxCompleto !== -1 && row[idxCompleto] ? row[idxCompleto] : row[idxNome],
        partido: row[idxPartido] || "S/P",
        ano_eleicao: parseInt(row[idxAno], 10) || selectedYear,
        total_votos: parseInt(row[idxVotos]?.replace(/\D/g, ""), 10) || 0,
        total_receitas: parseFloat(row[idxReceitas]?.replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0,
        despesas_contratadas: parseFloat(row[idxDespesasContratadas]?.replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0,
        despesas_pagas: parseFloat(row[idxDespesasPagas]?.replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0,
        maior_fornecedor_nome: idxFornecedorNome !== -1 && row[idxFornecedorNome] ? row[idxFornecedorNome] : "Não Informado",
        maior_fornecedor_valor: idxFornecedorValor !== -1 && row[idxFornecedorValor] ? parseFloat(row[idxFornecedorValor]?.replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0 : 0,
        cargo: "Deputado Distrital",
        situacao: "Eleito",
        detalhe_despesas: []
      });
    }

    return parsed;
  };

  // Commit spreadsheet import into database
  const handleImportCandidates = async () => {
    const candidatesToImport = parseCandidatesFromRows();
    if (candidatesToImport.length === 0) {
      setImportMessage({ type: "error", text: "Nenhum candidato válido encontrado para importar nesta planilha." });
      return;
    }

    const confirmImport = window.confirm(
      `Deseja realmente importar ${candidatesToImport.length} candidato(s) da planilha "${selectedFile?.name}" para a base de dados SQLite oficial?`
    );
    if (!confirmImport) return;

    setIsImporting(true);
    setImportMessage(null);

    try {
      const response = await fetch("/api/importar_candidatos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates: candidatesToImport }),
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        setImportMessage({
          type: "success",
          text: `Sucesso! ${resData.imported_count} candidatos foram importados para o banco de dados eleitoral.`
        });
        
        // Refresh local candidate list to reflect changes immediately
        const listResponse = await fetch(`/api/eleitos/${selectedYear}`);
        const data = await listResponse.json();
        if (Array.isArray(data)) {
          setCandidates(data);
        }
      } else {
        throw new Error(resData.error || "Erro desconhecido na importação");
      }
    } catch (err: any) {
      setImportMessage({ type: "error", text: `Falha ao importar: ${err.message}` });
    } finally {
      setIsImporting(false);
    }
  };

  // GitHub Connection Handler
  const handleConnectGitHubClick = async (tokenInput: string) => {
    if (!tokenInput.trim()) return;
    setGithubError(null);
    setGithubSuccess(null);
    try {
      await fetchGitHubProfile(tokenInput);
      localStorage.setItem("github_token", tokenInput);
      setGithubSuccess("GitHub conectado com sucesso!");
    } catch (err: any) {
      setGithubError(err.message || "Erro de autenticação com o GitHub");
    }
  };

  // GitHub Disconnection Handler
  const handleDisconnectGitHubClick = () => {
    setGithubUser(null);
    setGithubRepos([]);
    setSelectedRepo("");
    setGithubToken("");
    setGithubSuccess(null);
    setGithubError(null);
    localStorage.removeItem("github_token");
  };

  // Export current audit to GitHub
  const handleExportToGitHubClick = async () => {
    if (!githubToken || !selectedRepo) return;
    setGithubError(null);
    setGithubSuccess(null);
    setExportingGithub(true);

    const reportTitle = selectedCandidate 
      ? `Auditoria - Dossiê de ${selectedCandidate.nome_urna} (${selectedCandidate.partido}) - ${selectedYear}`
      : `Relatório de Auditoria Geral da CLDF - ${selectedYear}`;

    let reportMarkdown = `# ${reportTitle}\n\n`;
    reportMarkdown += `*Gerado em: ${new Date().toLocaleString("pt-BR")} via Gabinete IA*\n\n`;

    if (selectedCandidate) {
      reportMarkdown += `## Dados do Candidato\n`;
      reportMarkdown += `- **Nome na Urna:** ${selectedCandidate.nome_urna}\n`;
      reportMarkdown += `- **Nome Completo:** ${selectedCandidate.nome_completo}\n`;
      reportMarkdown += `- **Partido:** ${selectedCandidate.partido}\n`;
      reportMarkdown += `- **Ano da Eleição:** ${selectedCandidate.ano_eleicao}\n`;
      reportMarkdown += `- **Votos Recebidos:** ${selectedCandidate.total_votos.toLocaleString("pt-BR")}\n`;
      reportMarkdown += `- **Arrecadação Total:** R$ ${selectedCandidate.total_receitas.toLocaleString("pt-BR")}\n`;
      reportMarkdown += `- **Despesas Contratadas (Valor Oficial):** R$ ${selectedCandidate.despesas_contratadas.toLocaleString("pt-BR")}\n`;
      reportMarkdown += `- **Maior Fornecedor:** ${selectedCandidate.maior_fornecedor_nome} (R$ ${selectedCandidate.maior_fornecedor_valor.toLocaleString("pt-BR")})\n\n`;

      if (aiAuditText) {
        reportMarkdown += `## Análise Técnica de Auditoria (IA)\n`;
        reportMarkdown += `${aiAuditText}\n`;
      }
    } else {
      reportMarkdown += `## Candidatos Eleitos em ${selectedYear}\n\n`;
      reportMarkdown += `| Candidato | Partido | Votos | Despesas Contratadas |\n`;
      reportMarkdown += `| --- | --- | --- | --- |\n`;
      candidates.forEach(c => {
        reportMarkdown += `| ${c.nome_urna} | ${c.partido} | ${c.total_votos.toLocaleString("pt-BR")} | R$ ${c.despesas_contratadas.toLocaleString("pt-BR")} |\n`;
      });
    }

    try {
      const owner = githubUser?.login || "";
      const result = await createGitHubFile(
        githubToken,
        owner,
        selectedRepo,
        exportPath,
        reportMarkdown,
        `Auditoria Eleitoral CLDF - ${selectedCandidate?.nome_urna || "Geral"}`
      );
      setGithubSuccess(`Sucesso! Relatório salvo em: ${result.content.html_url}`);
    } catch (err: any) {
      setGithubError(err.message || "Erro ao salvar arquivo no GitHub");
    } finally {
      setExportingGithub(false);
    }
  };

  // Auto scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [oraculoChat]);

  // Handle message send to Oráculo
  async function handleSendOraculo(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!oraculoInput.trim() || sendingOraculo) return;

    // Cancel any active speech when a new message is sent
    window.speechSynthesis.cancel();
    setSpeakingMessageId(null);

    const userMsgText = oraculoInput.trim();
    setOraculoInput("");
    
    const userMessage: ChatMessage = {
      id: Math.random().toString(),
      sender: "user",
      text: userMsgText,
      timestamp: new Date()
    };
    
    setOraculoChat(prev => [...prev, userMessage]);
    setSendingOraculo(true);

    try {
      let response;
      let retries = 3;
      while (retries > 0) {
        response = await fetch("/api/oraculo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: userMsgText })
        });
        if (response.ok || response.status !== 503) break;
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const data = await response.json();
      
      const answerText = data.answer || data.message || "Desculpe, ocorreu um erro ao obter respostas do Oráculo.";
      const oraculoMessageId = Math.random().toString();
      
      const oraculoMessage: ChatMessage = {
        id: oraculoMessageId,
        sender: "oraculo",
        text: answerText,
        timestamp: new Date()
      };
      
      setOraculoChat(prev => [...prev, oraculoMessage]);

      // Speak if enabled
      if (autoSpeakEnabledRef.current) {
        speakMessage(oraculoMessageId, answerText);
      }
    } catch (err) {
      console.error("Erro no Oráculo:", err);
      const errorMessageId = Math.random().toString();
      const errorText = "Ocorreu um erro de rede ao tentar consultar o Oráculo. Verifique se o servidor está ativo.";
      const errorMessage: ChatMessage = {
        id: errorMessageId,
        sender: "oraculo",
        text: errorText,
        timestamp: new Date()
      };
      setOraculoChat(prev => [...prev, errorMessage]);

      if (autoSpeakEnabledRef.current) {
        speakMessage(errorMessageId, errorText);
      }
    } finally {
      setSendingOraculo(false);
    }
  }

  // Simple frontend audit logic to check if candidate's expense exceeds averages
  const getAuditStatus = (cand: Candidate) => {
    // Other candidates of the same party (excluding the current candidate)
    const partyCandidates = candidates.filter(
      c => c.partido === cand.partido && c.id_candidato !== cand.id_candidato
    );
    const partyCount = partyCandidates.length;
    const partyAverage = partyCount > 0 
      ? partyCandidates.reduce((sum, c) => sum + c.despesas_contratadas, 0) / partyCount 
      : 0;

    // Other candidates of the same cargo (excluding the current candidate)
    const cargoCandidates = candidates.filter(
      c => c.cargo === cand.cargo && c.id_candidato !== cand.id_candidato
    );
    const cargoCount = cargoCandidates.length;
    const cargoAverage = cargoCount > 0 
      ? cargoCandidates.reduce((sum, c) => sum + c.despesas_contratadas, 0) / cargoCount 
      : 0;

    const isAbovePartyAverage = partyCount > 0 && cand.despesas_contratadas > partyAverage;
    const isAboveCargoAverage = cargoCount > 0 && cand.despesas_contratadas > cargoAverage;

    return {
      isAbovePartyAverage,
      isAboveCargoAverage,
      partyAverage,
      cargoAverage,
      partyCount,
      cargoCount
    };
  };

  // Filter candidates list
  const filteredCandidates = candidates.filter(c => 
    c.nome_urna.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.partido.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.nome_completo && c.nome_completo.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Global financial totals for overview widgets
  const totalVotes = candidates.reduce((sum, c) => sum + c.total_votos, 0);
  const totalContracted = candidates.reduce((sum, c) => sum + c.despesas_contratadas, 0);
  const averageCostPerVote = totalVotes > 0 ? (totalContracted / totalVotes) : 0;

  // Render dynamic avatar fallback
  const getInitials = (name: string) => {
    return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
  };

  const getRandomColorClass = (id: number) => {
    const colors = [
      "bg-[#27272a] text-white border-[#3f3f46]",
      "bg-[#1e293b] text-blue-400 border-blue-900/40",
      "bg-[#3b0764]/40 text-purple-400 border-purple-900/40",
      "bg-[#1c1917] text-amber-400 border-amber-900/40",
      "bg-[#022c22] text-emerald-400 border-emerald-900/40",
      "bg-[#4c0519]/40 text-rose-400 border-rose-900/40",
    ];
    return colors[id % colors.length];
  };

  return (
    <div id="gabinete-root" className="min-h-screen bg-[#f1f5f9] text-[#1e293b] font-sans flex flex-col antialiased">
      {/* Centered Top Header matched to screenshot */}
      <header id="header-gabinete" className="w-full pt-10 pb-6 px-4 flex flex-col items-center justify-center text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1e3a8a] tracking-tight flex items-center justify-center gap-2">
          Gabinete IA
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-1">
          Plataforma Inteligente de Monitoramento e Estratégia Política
        </p>
      </header>

      {/* Main Content Dashboard Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 pb-12 flex flex-col gap-6">
        
        {/* THREE HORIZONTAL BENTO CARDS */}
        {selectedYear !== 2026 && (
          <section id="top-bento-cards" className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1: Anatomia de Gastos */}
            <div
              id="card-anatomia-gastos"
              onClick={() => setActiveMainCard("gastos")}
              className={`bg-white rounded-2xl p-5 border cursor-pointer transition-all duration-200 shadow-xs flex gap-4 ${
                activeMainCard === "gastos"
                  ? "border-blue-500 ring-2 ring-blue-500/10"
                  : "border-slate-200 hover:border-slate-300 hover:shadow-md"
              }`}
            >
              <div className="p-3 bg-blue-50 text-blue-500 rounded-xl h-fit shrink-0">
                <CreditCard className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">Anatomia de Gastos</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Prestação de contas, despesas de campanha contratadas e análise de fornecedores políticos.
                </p>
              </div>
            </div>

            {/* Card 2: Engenharia Geoeleitoral */}
            <div
              id="card-engenharia-geoeleitoral"
              onClick={() => setActiveMainCard("geoeleitoral")}
              className={`bg-white rounded-2xl p-5 border cursor-pointer transition-all duration-200 shadow-xs flex gap-4 ${
                activeMainCard === "geoeleitoral"
                  ? "border-blue-500 ring-2 ring-blue-500/10"
                  : "border-slate-200 hover:border-slate-300 hover:shadow-md"
              }`}
            >
              <div className="p-3 bg-purple-50 text-purple-500 rounded-xl h-fit shrink-0">
                <Layers className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">Engenharia Geoeleitoral</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Distribuição de votação por zonas, seções eleitorais e análise de densidade territorial.
                </p>
              </div>
            </div>

            {/* Card 3: Benchmark & Reputação */}
            <div
              id="card-benchmark-reputacao"
              onClick={() => setActiveMainCard("reputacao")}
              className={`bg-white rounded-2xl p-5 border cursor-pointer transition-all duration-200 shadow-xs flex gap-4 ${
                activeMainCard === "reputacao"
                  ? "border-blue-500 ring-2 ring-blue-500/10"
                  : "border-slate-200 hover:border-slate-300 hover:shadow-md"
              }`}
            >
              <div className="p-3 bg-pink-50 text-pink-500 rounded-xl h-fit shrink-0">
                <Brain className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">Benchmark & Reputação</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Cruzamentos avançados de eficiência (custo por voto), SWOT competitiva e insights preditivos.
                </p>
              </div>
            </div>

          </section>
        )}

        {/* WORKSPACE AREA: TWO COLUMNS WITH BLINDED RESPONSIVITY */}
        <div className="workspace-layout">
          {/* COLUMN 1: MATRIX PANEL */}
          <section id="matrix-panel" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col min-h-[500px]">
            
            {/* Left Header with title and year switcher */}
            <div id="controles-ano" className="border-b border-slate-100 pb-4 mb-6">
              <div>
                <h2 className="text-sm sm:text-lg font-bold text-slate-950 flex items-center gap-2 text-left">
                  {selectedYear === 2026 ? "QG Campanhas 2026" : "Matriz: " + (
                    activeMainCard === "gastos" 
                      ? "Anatomia de Gastos" 
                      : activeMainCard === "geoeleitoral"
                      ? "Engenharia Geoeleitoral"
                      : "Benchmark & Reputação"
                  )}
                </h2>
              </div>
              
              {/* Year Selectors matched to screenshot */}
              <div className="flex flex-wrap gap-2 items-center shrink-0">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                  {[2014, 2018, 2022].map((year) => {
                    const isSelected = selectedYear === year;
                    return (
                      <button
                        key={year}
                        id={`btn-ano-${year}`}
                        onClick={() => setSelectedYear(year)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? "bg-[#1e293b] text-white shadow-xs"
                            : "text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {year}
                      </button>
                    );
                  })}
                </div>

                <button
                  id="btn-ano-2026"
                  onClick={() => setSelectedYear(2026)}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                    selectedYear === 2026
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md"
                      : "bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-100"
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Campanhas 2026 (Ativas)</span>
                </button>
              </div>
            </div>

            {/* Segmented Sub-tab bar inside Engenharia Geoeleitoral */}
            {selectedYear !== 2026 && activeMainCard === "geoeleitoral" && (
              <div className="flex gap-2 mb-4 bg-slate-50 p-1.5 rounded-xl w-fit border border-slate-150">
                <button
                  id="tab-geo-geral"
                  onClick={() => setGeoSubTab("geral")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    geoSubTab === "geral"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Painel de Resultados Consolidados
                </button>
                <button
                  id="tab-geo-candidato"
                  disabled={!selectedCandidate}
                  onClick={() => setGeoSubTab("candidato")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    !selectedCandidate
                      ? "text-slate-300 bg-transparent cursor-not-allowed"
                      : geoSubTab === "candidato"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  title={!selectedCandidate ? "Selecione um candidato abaixo para ver a distribuição geográfica." : ""}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Distribuição por Candidato {selectedCandidate ? `(${selectedCandidate.nome_urna})` : ""}
                </button>
              </div>
            )}

            {/* Segmented Sub-tab bar inside Benchmark & Reputação */}
            {selectedYear !== 2026 && activeMainCard === "reputacao" && (
              <div className="flex gap-2 mb-4 bg-slate-50 p-1.5 rounded-xl w-fit border border-slate-150">
                <button
                  id="tab-rep-geral"
                  onClick={() => {
                    setRepSubTab("geral");
                  }}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    repSubTab === "geral"
                      ? "bg-pink-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Estudo de Eficiência Geral
                </button>
                <button
                  id="tab-rep-candidato"
                  disabled={!selectedCandidate}
                  onClick={() => setRepSubTab("candidato")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    !selectedCandidate
                      ? "text-slate-300 bg-transparent cursor-not-allowed"
                      : repSubTab === "candidato"
                      ? "bg-pink-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  title={!selectedCandidate ? "Selecione um candidato abaixo para ver as métricas individuais." : ""}
                >
                  <Award className="w-3.5 h-3.5" />
                  Eficiência por Candidato {selectedCandidate ? `(${selectedCandidate.nome_urna})` : ""}
                </button>
              </div>
            )}

            {/* If we are on geoeleitoral and the general tab is active, render the consolidated results dashboard */}
            {activeMainCard === "geoeleitoral" && geoSubTab === "geral" ? (
              <div className="flex-1 flex flex-col gap-4">
                <div className="bg-purple-50/50 border border-purple-100 p-4 rounded-xl">
                  <h3 className="text-sm font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <span>📊</span> PAINEL GEOELEITORAL DE RESULTADOS CONSOLIDADOS
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Soma de votação consolidada de todos os candidatos por Região Administrativa (RA) e Zona Eleitoral do DF. Clique em qualquer candidato abaixo para detalhar sua distribuição territorial.
                  </p>
                </div>

                {/* KPI Metrics deck */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 border border-slate-150 bg-slate-50/50 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Votos Totais Consolidados</span>
                    <span className="text-base font-black text-slate-900 mt-1 block">
                      {candidates.reduce((sum, c) => sum + (c.total_votos || 0), 0).toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium leading-none block mt-1">
                      Soma das duas bases de candidatos
                    </span>
                  </div>
                  <div className="p-3 border border-slate-150 bg-slate-50/50 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Candidato Líder</span>
                    <span className="text-base font-black text-purple-700 mt-1 block truncate">
                      {candidates.length > 0 ? candidates[0].nome_urna : "Nenhum"}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium leading-none block mt-1">
                      {candidates.length > 0 ? `${candidates[0].total_votos.toLocaleString("pt-BR")} votos (${candidates[0].partido})` : "Sem dados"}
                    </span>
                  </div>
                  <div className="p-3 border border-slate-150 bg-slate-50/50 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Média por Concorrente</span>
                    <span className="text-base font-black text-slate-900 mt-1 block">
                      {candidates.length > 0 ? Math.round(candidates.reduce((sum, c) => sum + (c.total_votos || 0), 0) / candidates.length).toLocaleString("pt-BR") : 0}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium leading-none block mt-1">
                      Média entre os {candidates.length} candidatos
                    </span>
                  </div>
                </div>

                {/* Search candidate list */}
                <div className="relative mt-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="search-candidates-ranking"
                    type="text"
                    placeholder="Filtrar candidatos no ranking por nome ou partido..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                {/* Ranking List */}
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 scroll-hide mt-1">
                  {filteredCandidates.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-400 font-medium">
                      Nenhum candidato localizado no ranking.
                    </div>
                  ) : (
                    filteredCandidates.map((cand, idx) => {
                      const rank = idx + 1;
                      const maxV = candidates.length > 0 ? Math.max(...candidates.map(c => c.total_votos || 1)) : 1;
                      const pctOfMax = maxV > 0 ? (cand.total_votos / maxV) * 100 : 0;
                      return (
                        <div
                          key={cand.id_candidato}
                          onClick={() => {
                            fetchDossier(cand.nome_urna, selectedYear);
                            setGeoSubTab("candidato");
                          }}
                          className="p-3 border border-slate-150 bg-white hover:bg-purple-50/20 hover:border-purple-300 rounded-xl transition-all duration-150 cursor-pointer flex flex-col gap-2 shadow-xs group"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-black text-slate-400 font-mono w-5">#{rank}</span>
                              <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors shrink-0 overflow-hidden">
                                <CandidateAvatar candidatoId={cand.id_candidato} nomeUrna={cand.nome_urna} fotoUrl={cand.foto_url} />
                              </div>
                              <div className="min-w-0">
                                <span className="font-extrabold text-xs text-slate-800 uppercase block truncate group-hover:text-purple-900 transition-colors">
                                  {cand.nome_urna}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase">
                                  {cand.partido} • Deputado Distrital
                                </span>
                              </div>
                            </div>
                            
                            <div className="text-right shrink-0">
                              <span className="font-black text-sm text-slate-900 font-mono">
                                {cand.total_votos.toLocaleString("pt-BR")}
                              </span>
                              <span className="text-[9px] text-slate-400 block font-medium">VOTOS</span>
                            </div>
                          </div>
                          
                          {/* Custom micro bar chart */}
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-500 rounded-full group-hover:bg-purple-600 transition-all duration-300" 
                              style={{ width: `${pctOfMax}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : activeMainCard === "reputacao" && repSubTab === "geral" ? (
              <div className="flex-1 flex flex-col gap-4">
                <div className="bg-pink-50/50 border border-pink-100 p-4 rounded-xl">
                  <h3 className="text-sm font-bold text-pink-900 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <span>🧠</span> ESTUDO DE EFICIÊNCIA ELEITORAL ({selectedYear})
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Análise comparativa relacionando despesas contratadas com a quantidade de votos recebidos.
                    Descubra o custo por voto de cada deputado distrital eleito e identifique as campanhas com melhor aproveitamento financeiro.
                  </p>
                </div>

                {/* KPI Metrics deck */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 border border-slate-150 bg-slate-50/50 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Custo Médio por Voto</span>
                    <span className="text-base font-black text-slate-900 mt-1 block">
                      R$ {(candidates.reduce((sum, c) => sum + (c.total_votos || 0), 0) > 0
                        ? candidates.reduce((sum, c) => sum + (c.despesas_contratadas || 0), 0) /
                          candidates.reduce((sum, c) => sum + (c.total_votos || 0), 0)
                        : 0).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium leading-none block mt-1">
                      Média geral de toda a eleição
                    </span>
                  </div>

                  <div className="p-3 border border-slate-150 bg-slate-50/50 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Investimento Contratado Total</span>
                    <span className="text-base font-black text-slate-900 mt-1 block">
                      R$ {candidates.reduce((sum, c) => sum + (c.despesas_contratadas || 0), 0).toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium leading-none block mt-1">
                      Soma dos gastos dos {candidates.length} eleitos
                    </span>
                  </div>

                  <div className="p-3 border border-slate-150 bg-slate-50/50 rounded-xl">
                    <span className="text-[10px] font-bold text-pink-700 uppercase tracking-wider block">Campanha Mais Eficiente</span>
                    <span className="text-base font-black text-emerald-600 mt-1 block truncate">
                      {candidates.length > 0
                        ? [...candidates]
                            .filter(c => c.total_votos > 0)
                            .sort((a, b) => (a.despesas_contratadas / a.total_votos) - (b.despesas_contratadas / b.total_votos))[0]?.nome_urna
                        : "Sem dados"}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium leading-none block mt-1">
                      {(() => {
                        const sorted = [...candidates]
                          .filter(c => c.total_votos > 0)
                          .sort((a, b) => (a.despesas_contratadas / a.total_votos) - (b.despesas_contratadas / b.total_votos));
                        if (sorted.length > 0) {
                          const cost = sorted[0].despesas_contratadas / sorted[0].total_votos;
                          return `Apenas R$ ${cost.toFixed(2)} por voto`;
                        }
                        return "Sem dados";
                      })()}
                    </span>
                  </div>
                </div>

                {/* Main Ranking Layout */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Ranking de Eficiência (Menor custo por voto)
                    </h4>
                    <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">
                      Ordenado por R$/Voto
                    </span>
                  </div>

                  {/* Search candidate list */}
                  <div className="relative mb-3">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="search-candidates-efficiency"
                      type="text"
                      placeholder="Filtrar candidatos por nome ou partido..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-pink-500 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scroll-hide">
                    {(() => {
                      const list = [...candidates]
                        .filter(c => c.total_votos > 0)
                        .map(c => ({
                          ...c,
                          costPerVote: c.despesas_contratadas / c.total_votos
                        }))
                        .filter(c =>
                          c.nome_urna.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.partido.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .sort((a, b) => a.costPerVote - b.costPerVote);

                      if (list.length === 0) {
                        return (
                          <div className="text-center py-12 text-xs text-slate-400 font-medium">
                            Nenhum candidato localizado com os filtros aplicados.
                          </div>
                        );
                      }

                      const maxCost = Math.max(...list.map(c => c.costPerVote), 1);

                      return list.map((cand, idx) => {
                        const rank = idx + 1;
                        const pctOfMax = maxCost > 0 ? (cand.costPerVote / maxCost) * 100 : 0;
                        return (
                          <div
                            key={cand.id_candidato}
                            onClick={() => {
                              fetchDossier(cand.nome_urna, selectedYear);
                              setRepSubTab("candidato");
                            }}
                            className="p-3 border border-slate-150 bg-white hover:bg-pink-50/20 hover:border-pink-300 rounded-xl transition-all duration-150 cursor-pointer flex flex-col gap-2 shadow-xs group"
                          >
                            <div className="flex justify-between items-center gap-3 w-full min-w-0">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="text-xs font-black text-slate-400 font-mono w-5 shrink-0 flex-shrink-0">#{rank}</span>
                                <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 group-hover:bg-pink-100 group-hover:text-pink-700 transition-colors shrink-0 flex-shrink-0 overflow-hidden">
                                  <CandidateAvatar candidatoId={cand.id_candidato} nomeUrna={cand.nome_urna} fotoUrl={cand.foto_url} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="font-extrabold text-xs text-slate-800 uppercase block truncate group-hover:text-pink-900 transition-colors whitespace-nowrap overflow-hidden text-overflow-ellipsis" title={cand.nome_urna}>
                                    {cand.nome_urna}
                                  </span>
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase block truncate whitespace-nowrap overflow-hidden text-overflow-ellipsis">
                                    {cand.partido} • {cand.total_votos.toLocaleString("pt-BR")} votos
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenReputationDossier(cand);
                                  }}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 hover:text-indigo-800 text-[10px] font-black rounded-lg border border-indigo-100 flex items-center gap-1 transition-all shadow-2xs cursor-pointer shrink-0"
                                >
                                  <Brain className="w-3 h-3 text-indigo-600" />
                                  <span>Dossiê IA</span>
                                </button>

                                <div className="text-right shrink-0 flex-shrink-0 min-w-[70px]">
                                  <span className="font-black text-sm text-pink-700 font-mono block">
                                    R$ {cand.costPerVote.toFixed(2)}
                                  </span>
                                  <span className="text-[9px] text-slate-400 block font-medium uppercase">Por Eleitor</span>
                                </div>
                              </div>
                            </div>

                            {/* Progress bar representing inefficiency */}
                            <div className="flex items-center gap-2">
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    pctOfMax < 33
                                      ? "bg-emerald-500 group-hover:bg-emerald-600"
                                      : pctOfMax < 66
                                      ? "bg-amber-500 group-hover:bg-amber-600"
                                      : "bg-rose-500 group-hover:bg-rose-600"
                                  }`}
                                  style={{ width: `${pctOfMax}%` }}
                                ></div>
                              </div>
                              <span className="text-[9px] font-mono text-slate-400 font-bold w-12 text-right">
                                {pctOfMax.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            ) : !selectedCandidate ? (
              <div className="flex-1 flex flex-col gap-4">
                <div className="text-center py-6">
                  <p className="text-sm text-slate-500 font-medium">
                    Busque e selecione um deputado eleito para detalhar a matriz acima.
                  </p>
                </div>
                
                {/* Search candidate list */}
                <div className="relative mb-4">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="search-candidates"
                    type="text"
                    placeholder="Buscar por nome ou partido..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div className="container-grid max-h-[380px] overflow-y-auto pr-1 scroll-hide">
                  {loadingList ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 gap-2">
                      <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                      <p className="text-xs text-slate-500 font-medium font-mono">Carregando base SQLite...</p>
                    </div>
                  ) : filteredCandidates.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-xs text-slate-400 font-medium">
                      Nenhum candidato localizado.
                    </div>
                  ) : (
                    filteredCandidates.map((cand) => {
                      const costPerVote = cand.total_votos > 0 ? cand.despesas_contratadas / cand.total_votos : 0;
                      return (
                        <div
                          key={cand.id_candidato}
                          onClick={() => fetchDossier(cand.nome_urna, selectedYear)}
                          className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 min-w-0 w-full group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 overflow-hidden shrink-0 flex-shrink-0">
                              <CandidateAvatar candidatoId={cand.id_candidato} nomeUrna={cand.nome_urna} fotoUrl={cand.foto_url} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-xs text-slate-900 truncate block w-full whitespace-nowrap overflow-hidden text-overflow-ellipsis" title={cand.nome_urna}>
                                {cand.nome_urna}
                              </h4>
                              <p className="text-[10px] text-slate-500 font-semibold truncate block w-full whitespace-nowrap overflow-hidden text-overflow-ellipsis">
                                {cand.partido} • {cand.total_votos.toLocaleString("pt-BR")} votos
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Intelligent Dossier Button directly on card */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenReputationDossier(cand);
                              }}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 hover:text-indigo-800 text-[10px] font-black rounded-lg border border-indigo-100 flex items-center gap-1 transition-all shadow-2xs cursor-pointer shrink-0"
                            >
                              <Brain className="w-3 h-3 text-indigo-600" />
                              <span>Dossiê IA</span>
                            </button>

                            {selectedYear === 2026 ? (
                              <div className="text-right shrink-0 flex-shrink-0 min-w-[70px]">
                                <p className="text-[10px] text-purple-500 font-black uppercase leading-none">Campanha</p>
                                <p className="text-xs font-black text-purple-600 mt-0.5">Ativa</p>
                              </div>
                            ) : (
                              <div className="text-right shrink-0 flex-shrink-0 min-w-[70px]">
                                <p className="text-[10px] text-slate-400 font-medium uppercase leading-none">Custo/Voto</p>
                                <p className="text-xs font-extrabold text-slate-800 mt-0.5">R$ {costPerVote.toFixed(2)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* ACTIVE SPLIT MATRIX SCREEN (Pixel perfect matched to screenshot) */
              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                
                {/* SPLIT COLUMN 1: Profile card (md:col-span-4) */}
                <div className={`md:col-span-4 pr-0 md:pr-6 flex flex-col items-center justify-center text-center ${
                  selectedYear === 2026 ? "md:border-r border-slate-800" : "md:border-r border-slate-100"
                }`}>
                  {/* Circular Avatar Frame */}
                  <div className="relative">
                    <div className={`w-28 h-28 rounded-full border-4 flex items-center justify-center mx-auto shadow-xs overflow-hidden ${
                      selectedYear === 2026 ? "border-purple-900 bg-slate-900" : "border-purple-200 bg-slate-50"
                    }`}>
                      <CandidateAvatar candidatoId={selectedCandidate.id_candidato} nomeUrna={selectedCandidate.nome_urna} fotoUrl={selectedCandidate.foto_url} variant="large" />
                    </div>
                  </div>

                  {/* Centered Political Party Badge */}
                  <div className="mt-3.5">
                    <span className={`inline-block px-3.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                      selectedYear === 2026
                        ? "bg-pink-950/40 text-pink-400 border border-pink-900/40"
                        : "bg-pink-50 text-pink-600 border border-pink-100"
                    }`}>
                      {selectedCandidate.partido}
                    </span>
                  </div>

                  {/* Candidate Urn Name */}
                  <h3 className={`text-xl font-extrabold tracking-tight mt-3 uppercase ${
                    selectedYear === 2026 ? "text-slate-100" : "text-slate-900"
                  }`}>
                    {selectedCandidate.nome_urna}
                  </h3>

                  {/* Cargo */}
                  <p className="text-[10px] text-slate-400 font-extrabold tracking-widest uppercase mt-0.5">
                    {selectedCandidate.cargo || "DEPUTADO DISTRITAL"}
                  </p>

                  <div className="flex flex-col gap-2 w-full mt-6">
                    {/* Intelligent Dossier Button */}
                    <button
                      onClick={() => handleOpenReputationDossier(selectedCandidate)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg shadow-xs w-full transition-all duration-150 cursor-pointer"
                    >
                      <Brain className="w-3.5 h-3.5 text-indigo-100" />
                      <span>Dossiê de Inteligência</span>
                    </button>

                    {/* Export Dossier Button */}
                    <button
                      id="btn-exportar-dossie"
                      onClick={handleExportPDF}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs w-full transition-all duration-150 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-100" />
                      <span>Exportar Dossiê</span>
                    </button>

                    {/* Exit Profile Button exactly matched */}
                    <button
                      id="btn-sair-perfil"
                      onClick={() => {
                        setSelectedCandidate(null);
                        setSelectedCandidateName(null);
                        setSelectedCandidateId(null);
                      }}
                      className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-lg shadow-xs w-full transition-all duration-150 cursor-pointer ${
                        selectedYear === 2026
                          ? "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white"
                          : "bg-[#718096] hover:bg-slate-700 text-white"
                      }`}
                    >
                      <LogOut className="w-3.5 h-3.5 text-blue-100" />
                      <span>Sair do Perfil</span>
                    </button>
                  </div>
                </div>

                {/* SPLIT COLUMN 2: Details content matching selected activeMainCard */}
                <div className="md:col-span-8 flex flex-col justify-between pl-0 md:pl-2">
                  
                  {selectedYear === 2026 ? (
                    <CampaignHQ2026
                      selectedCandidate={selectedCandidate}
                      setOraculoInput={setOraculoInput}
                      setActiveTab={setActiveTab}
                    />
                  ) : candidateNoDataForYear ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl my-auto min-h-[280px]">
                      <div className="p-3 bg-amber-50 text-amber-600 rounded-full mb-3">
                        <AlertCircle className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-bold text-slate-800">Candidato não disputou este pleito</h4>
                      <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                        Não localizamos registros contábeis ou de votação para <span className="font-bold text-slate-700">{selectedCandidate?.nome_urna}</span> na eleição de <span className="font-bold text-slate-700">{selectedYear}</span> no Distrito Federal.
                      </p>
                      <p className="text-[11px] text-slate-400 mt-3">
                        Utilize os botões da série histórica abaixo ou os filtros de ano para navegar para um pleito active.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* SUB-VIEW 1: ANATOMIA DE GASTOS */}
                  {activeMainCard === "gastos" && (
                    <div className="space-y-4">
                      {/* Title indicator with dollar sign */}
                      <h4 className="text-xs font-bold text-emerald-700 tracking-wider uppercase flex items-center gap-1.5">
                        <span className="text-emerald-600 font-extrabold text-sm">$</span>
                        CONTABILIDADE ELEITORAL ({selectedYear})
                      </h4>

                      {/* 3 Metric cards exactly as requested */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        
                        {/* RECEITA TOTAL */}
                        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs border-t-4 border-t-emerald-500">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Receita Total</span>
                          <span className="text-base font-black text-slate-800 mt-1 block">
                            R$ {selectedCandidate.total_receitas.toLocaleString("pt-BR")}
                          </span>
                        </div>

                        {/* DESPESAS */}
                        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs border-t-4 border-t-rose-500">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Despesas</span>
                          <span className="text-base font-black text-slate-800 mt-1 block">
                            R$ {selectedCandidate.despesas_contratadas.toLocaleString("pt-BR")}
                          </span>
                        </div>

                        {/* SALDO DE CAIXA */}
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 shadow-xs border-t-4 border-t-cyan-400">
                          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">Saldo de Caixa</span>
                          <span className="text-base font-black text-emerald-600 mt-1 block font-mono">
                            {(() => {
                              const balance = selectedCandidate.total_receitas - selectedCandidate.despesas_contratadas;
                              return (balance < 0 ? "-" : "") + " R$ " + Math.abs(balance).toLocaleString("pt-BR");
                            })()}
                          </span>
                        </div>

                      </div>

                      {/* Origem dos Recursos Panel list */}
                      <div>
                        <h5 className="text-xs font-bold text-slate-700 mb-2">Origem dos Recursos</h5>
                        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-medium">Fundo Especial de Financiamento (FEFC)</span>
                            <span className="font-extrabold text-slate-800">
                              R$ {Math.round(selectedCandidate.total_receitas * 0.8).toLocaleString("pt-BR")} (Aprox. 80%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: "80%" }}></div>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1">
                            <span className="text-slate-500 font-medium">Doações e Recursos Próprios</span>
                            <span className="font-extrabold text-slate-800">
                              R$ {Math.round(selectedCandidate.total_receitas * 0.2).toLocaleString("pt-BR")} (Aprox. 20%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: "20%" }}></div>
                          </div>
                        </div>
                      </div>

                      {/* Expense category list breakdown from previous app version */}
                      {selectedCandidate.detalhe_despesas && selectedCandidate.detalhe_despesas.length > 0 && (
                        <div>
                          <h5 className="text-xs font-bold text-slate-700 mb-2">Concentração por Categoria de Despesa</h5>
                          <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1 scroll-hide">
                            {selectedCandidate.detalhe_despesas.map((item, idx) => {
                              const pct = Math.round((item.value / selectedCandidate.despesas_contratadas) * 100);
                              return (
                                <div key={idx} className="text-xs flex items-center justify-between p-1 hover:bg-slate-50 rounded-md">
                                  <span className="text-slate-500 font-medium truncate max-w-72">{item.category}</span>
                                  <span className="text-slate-800 font-bold">{pct}% (R$ {item.value.toLocaleString("pt-BR")})</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-VIEW 2: ENGENHARIA GEOELEITORAL */}
                  {activeMainCard === "geoeleitoral" && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-purple-700 tracking-wider uppercase flex items-center gap-1.5">
                        <span className="text-purple-600 font-extrabold text-sm">📍</span>
                        DISTRIBUIÇÃO GEOELEITORAL ({selectedYear})
                      </h4>

                      <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-xs text-slate-600">
                        <p className="font-bold text-slate-800">Total de Votos no Ciclo: {selectedCandidate.total_votos.toLocaleString("pt-BR")} votos</p>
                        <p className="text-[11px] mt-1 leading-relaxed">Concentração de densidade de votação consolidada por Zona Eleitoral e Região Administrativa (RA) no Distrito Federal.</p>
                      </div>

                      {/* Geo vote list from SQLite history */}
                      {selectedCandidate.votos_geoeleitorais && selectedCandidate.votos_geoeleitorais.length > 0 ? (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scroll-hide">
                          {selectedCandidate.votos_geoeleitorais.map((vote, idx) => {
                            const pct = ((vote.votos / selectedCandidate.total_votos) * 100).toFixed(1);
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-bold text-slate-800">{vote.ra_nome} <span className="text-[10px] text-slate-400 font-mono font-medium">(Zona {vote.zona_eleitoral})</span></span>
                                  <span className="font-extrabold text-slate-900">{vote.votos.toLocaleString("pt-BR")} ({pct}%)</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }}></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-10 text-xs text-slate-400 italic">
                          Dados de distribuição por seção eleitoral em carregamento.
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-VIEW 3: BENCHMARK & REPUTAÇÃO */}
                  {activeMainCard === "reputacao" && (
                    <div className="space-y-4">
                      {repSubTab === "candidato" ? (
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-pink-700 tracking-wider uppercase flex items-center gap-1.5">
                            <span className="text-pink-600 font-extrabold text-sm">🧠</span>
                            EFICIÊNCIA DE CAMPANHA: {selectedCandidate.nome_urna} ({selectedYear})
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Votos obtidos */}
                            <div className="p-3 border border-slate-200 bg-white rounded-xl shadow-2xs">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Votos Conquistados</span>
                              <span className="text-base font-black text-slate-900 mt-1 block">
                                {selectedCandidate.total_votos.toLocaleString("pt-BR")}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium leading-none block mt-1">
                                Votação total de urna
                              </span>
                            </div>

                            {/* Investment */}
                            <div className="p-3 border border-slate-200 bg-white rounded-xl shadow-2xs">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Gasto Contratado</span>
                              <span className="text-base font-black text-slate-900 mt-1 block">
                                R$ {selectedCandidate.despesas_contratadas.toLocaleString("pt-BR")}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium leading-none block mt-1">
                                Total investido na campanha
                              </span>
                            </div>

                            {/* Cost per vote */}
                            <div className="p-3 border border-slate-200 bg-white rounded-xl shadow-2xs bg-emerald-50/10 border-emerald-100">
                              <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block">Custo por Eleitor</span>
                              <span className="text-base font-black text-emerald-700 mt-1 block">
                                R$ {(selectedCandidate.total_votos > 0 ? selectedCandidate.despesas_contratadas / selectedCandidate.total_votos : 0).toFixed(2)}
                              </span>
                              <span className="text-[10px] text-emerald-600 font-medium leading-none block mt-1 font-mono">
                                Investimento / Voto
                              </span>
                            </div>
                          </div>

                          {/* Comparative Insights */}
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2.5 text-xs">
                            <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Considerações e Benchmark de Inteligência</h5>
                            {(() => {
                              const candCost = selectedCandidate.total_votos > 0 ? selectedCandidate.despesas_contratadas / selectedCandidate.total_votos : 0;
                              
                              const partyCandidates = candidates.filter(c => c.partido === selectedCandidate.partido);
                              const partyTotalVotes = partyCandidates.reduce((sum, c) => sum + (c.total_votos || 0), 0);
                              const partyTotalExpenses = partyCandidates.reduce((sum, c) => sum + (c.despesas_contratadas || 0), 0);
                              const partyAvgCost = partyTotalVotes > 0 ? partyTotalExpenses / partyTotalVotes : 0;

                              const cargoTotalVotes = candidates.reduce((sum, c) => sum + (c.total_votos || 0), 0);
                              const cargoTotalExpenses = candidates.reduce((sum, c) => sum + (c.despesas_contratadas || 0), 0);
                              const cargoAvgCost = cargoTotalVotes > 0 ? cargoTotalExpenses / cargoTotalVotes : 0;

                              const isMoreEfficientThanCargo = candCost < cargoAvgCost;
                              const isMoreEfficientThanParty = candCost < partyAvgCost;

                              return (
                                <div className="space-y-2 leading-relaxed text-slate-600">
                                  <p>
                                    O deputado <span className="font-bold text-slate-900">{selectedCandidate.nome_urna}</span> registrou um custo de <span className="font-bold text-pink-700">R$ {candCost.toFixed(2)}</span> por voto conquistado nesta eleição.
                                  </p>
                                  <div className="border-t border-slate-200/60 my-2 pt-2 space-y-1.5 font-mono text-[10px]">
                                    <div className="flex justify-between">
                                      <span>Custo Médio do Partido ({selectedCandidate.partido}):</span>
                                      <span className="font-bold text-slate-800">R$ {partyAvgCost.toFixed(2)} / voto</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Custo Médio do Cargo (Distrital):</span>
                                      <span className="font-bold text-slate-800">R$ {cargoAvgCost.toFixed(2)} / voto</span>
                                    </div>
                                  </div>
                                  <p className="bg-white border border-slate-150 p-2.5 rounded-lg text-slate-700 font-sans">
                                    💡 <span className="font-bold">Análise do Oráculo:</span> {selectedCandidate.nome_urna} foi{" "}
                                    <span className={`font-bold ${isMoreEfficientThanCargo ? "text-emerald-600" : "text-amber-600"}`}>
                                      {isMoreEfficientThanCargo ? "MAIS EFICIENTE" : "MENOS EFICIENTE"}
                                    </span>{" "}
                                    que a média do cargo. Se tivesse operado com a média geral de gastos por voto para obter seus {selectedCandidate.total_votos.toLocaleString("pt-BR")} votos, o investimento estimado teria sido de{" "}
                                    <span className="font-bold text-slate-900">R$ {(cargoAvgCost * selectedCandidate.total_votos).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>.
                                  </p>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Dynamic Simulator inside candidate view */}
                          <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-3">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Simulador Preditivo de Votos</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                                Projete a quantidade de eleitores com base na eficiência atual de R$ {(selectedCandidate.despesas_contratadas / selectedCandidate.total_votos).toFixed(2)} por voto:
                              </p>
                            </div>

                            <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-150">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-slate-600">Investimento Simulado:</span>
                                <span className="font-extrabold text-pink-700 font-mono text-sm">
                                  R$ {simulatedBudget.toLocaleString("pt-BR")}
                                </span>
                              </div>

                              <input
                                type="range"
                                min={10000}
                                max={500000}
                                step={5000}
                                value={simulatedBudget}
                                onChange={(e) => setSimulatedBudget(parseInt(e.target.value, 10))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-pink-600"
                              />

                              <div className="flex gap-1.5 mt-2">
                                {[50000, 100000, 150000, 250000].map((val) => (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => setSimulatedBudget(val)}
                                    className={`px-2 py-1 text-[9px] font-bold rounded border transition-colors cursor-pointer ${
                                      simulatedBudget === val
                                        ? "bg-pink-600 text-white border-pink-600"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    }`}
                                  >
                                    R$ {val / 1000}k
                                  </button>
                                ))}
                              </div>

                              <div className="border-t border-slate-200/70 mt-3 pt-3 flex justify-between items-center">
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 block uppercase leading-none font-sans">Votos Projetados</span>
                                  <span className="text-lg font-black text-slate-900 font-mono mt-1 block">
                                    {Math.round(simulatedBudget / (selectedCandidate.despesas_contratadas / selectedCandidate.total_votos || 1)).toLocaleString("pt-BR")}
                                  </span>
                                </div>

                                <div className="text-right">
                                  <span className="text-[10px] font-bold text-slate-400 block uppercase leading-none font-sans">Classificação Estimada</span>
                                  {(() => {
                                    const projVotes = simulatedBudget / (selectedCandidate.despesas_contratadas / selectedCandidate.total_votos || 1);
                                    if (projVotes >= 18000) {
                                      return <span className="text-[10px] font-black uppercase text-emerald-600 mt-1 block font-sans">Eleição Direta (Líder)</span>;
                                    } else if (projVotes >= 12000) {
                                      return <span className="text-[10px] font-black uppercase text-blue-600 mt-1 block font-sans">Competitivo (Eleito)</span>;
                                    } else {
                                      return <span className="text-[10px] font-black uppercase text-amber-600 mt-1 block font-sans">Suplente ou Alerta</span>;
                                    }
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-pink-700 tracking-wider uppercase flex items-center gap-1.5">
                            <span className="text-pink-600 font-extrabold text-sm">🧠</span>
                            BENCHMARK & REPUTAÇÃO ({selectedYear})
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Cost per vote */}
                            <div className="p-3 border border-slate-200 bg-white rounded-xl shadow-2xs">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Custo Unitário por Voto</span>
                              <span className="text-base font-black text-slate-900 mt-1 block">
                                R$ {(selectedCandidate.despesas_contratadas / selectedCandidate.total_votos).toFixed(2)}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium leading-none block mt-1">
                                Eficiência geral de campanha
                              </span>
                            </div>

                            {/* Audit status average check */}
                            {(() => {
                              const audit = getAuditStatus(selectedCandidate);
                              return (
                                <div className="p-3 border border-slate-200 bg-white rounded-xl shadow-2xs">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Status de Auditoria</span>
                                  {audit.isAbovePartyAverage || audit.isAboveCargoAverage ? (
                                    <span className="text-xs font-extrabold text-amber-600 mt-1.5 flex items-center gap-1">
                                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" /> Gasto acima da média
                                    </span>
                                  ) : (
                                    <span className="text-xs font-extrabold text-emerald-600 mt-1.5 flex items-center gap-1">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Gasto compatível
                                    </span>
                                  )}
                                  <span className="text-[9px] text-slate-400 block mt-1">
                                    Baseado em {audit.cargoCount} deputados
                                  </span>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Competitive comparison insights table */}
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2 text-xs">
                            <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Métricas Comparativas de Inteligência</h5>
                            {(() => {
                              const audit = getAuditStatus(selectedCandidate);
                              return (
                                <div className="space-y-1.5">
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Média de Despesas do Partido ({selectedCandidate.partido}):</span>
                                    <span className="font-bold text-slate-800">R$ {Math.round(audit.partyAverage).toLocaleString("pt-BR")}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Média Geral do Cargo (Distrital):</span>
                                    <span className="font-bold text-slate-800">R$ {Math.round(audit.cargoAverage).toLocaleString("pt-BR")}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* SWOT / Predictive matrix preview */}
                          <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SWOT & Alvos Preditivos</p>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Força na captação do Fundo Especial de {selectedCandidate.partido}. Oportunidade de otimização de custo por voto em mídias sociais digitais para a disputa subsequente.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                    </>
                  )}

                  {/* List of other campaigns disputed at the bottom */}
                  {selectedYear !== 2026 && dossierHistory.length > 1 && (
                    <div className="border-t border-slate-100 pt-3 mt-4">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Série Histórica Eleitoral</span>
                      <div className="flex flex-wrap gap-2">
                        {dossierHistory.map((hist, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedYear(hist.ano_eleicao)}
                            className="bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-lg py-1 px-2.5 text-[10px] flex items-center gap-1.5 font-medium transition-all cursor-pointer text-left"
                          >
                            <span className="font-bold text-slate-800">{hist.ano_eleicao}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500 font-bold">{hist.partido}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-600 font-bold">{hist.total_votos.toLocaleString("pt-BR")} votos</span>
                            <span className={`px-1 rounded-sm uppercase text-[8px] font-black ${
                              hist.situacao === "eleito" || hist.situacao?.toLowerCase() === "eleito" ? "bg-emerald-50 text-emerald-600" : "bg-slate-200 text-slate-600"
                            }`}>{hist.situacao}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

              </div>
            )}

          </section>

          {/* COLUMN 2: ASSISTENTE DE GABINETE INTELLIGENCE PANEL */}
          <section 
            id="assistant-panel" 
            className={`border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[500px] overflow-hidden ${
              isMobileAssistantOpen 
                ? "fixed inset-0 z-50 bg-[#16161a] p-4 animate-in fade-in slide-in-from-bottom duration-200" 
                : "hidden lg:flex lg:w-full"
            }`}
          >
            
            {/* Assistant Header & Sub-labels */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <div>
                    <h3 className="font-bold text-slate-950 text-sm sm:text-base">Assistente de Gabinete</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Painel Central de Inteligência</p>
                  </div>
                </div>
                {/* Close Button on Mobile */}
                <button
                  type="button"
                  onClick={() => setIsMobileAssistantOpen(false)}
                  className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors focus:outline-none"
                  style={{ minHeight: "48px", minWidth: "48px" }}
                  title="Fechar"
                >
                  <span className="text-xl font-bold">✕</span>
                </button>
              </div>

              {/* Tabs selector within assistant */}
              <div className="flex border border-slate-200 rounded-lg p-0.5 mt-3 bg-white">
                <button
                  id="tab-btn-oraculo"
                  onClick={() => setActiveTab("oraculo")}
                  className={`flex-1 py-1.5 text-center text-[10px] font-extrabold transition-all rounded-md flex items-center justify-center gap-1 ${
                    activeTab === "oraculo"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-55"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Oráculo Chat
                </button>
                <button
                  id="tab-btn-audit"
                  onClick={() => setActiveTab("audit")}
                  className={`flex-1 py-1.5 text-center text-[10px] font-extrabold transition-all rounded-md flex items-center justify-center gap-1 ${
                    activeTab === "audit"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-55"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auditoria IA
                </button>
                <button
                  id="tab-btn-conexoes"
                  onClick={() => setActiveTab("conexoes")}
                  className={`flex-1 py-1.5 text-center text-[10px] font-extrabold transition-all rounded-md flex items-center justify-center gap-1 ${
                    activeTab === "conexoes"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-55"
                  }`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Conexões
                </button>
              </div>
            </div>

            {/* TAB ASSISTANT PANEL CONTENTS */}
            <div className="flex-1 p-4 flex flex-col justify-between overflow-y-auto max-h-[580px] min-h-[380px]">
              <AnimatePresence mode="wait">
                
                {/* 1. CHAT ORÁCULO VIEW */}
                {activeTab === "oraculo" && (
                  <motion.div
                    key="oraculo-view"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col justify-between gap-3 h-full"
                  >
                    {/* Voice Preferences Bar */}
                    <div className="flex justify-between items-center bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-[10px]">
                      <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                        <Volume2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Respostas por Áudio</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSetAutoSpeak(!autoSpeakEnabled)}
                        className={`px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer ${
                          autoSpeakEnabled
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                        }`}
                      >
                        {autoSpeakEnabled ? "LIGADO (Auto-play)" : "DESLIGADO"}
                      </button>
                    </div>

                    {/* If chat has only welcome message and no query yet, show the screenshot-specific placeholder! */}
                    {oraculoChat.length <= 1 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-4 my-auto gap-4">
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl w-full">
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            Selecione uma opção para iniciar os cruzamentos estratégicos de dados.
                          </p>
                        </div>

                        {/* Interactive Suggestion Queries */}
                        <div className="w-full space-y-2 text-left mt-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Perguntas Recomendadas:</span>
                          {[
                            "Quem gastou mais em 2022 por voto?",
                            "Qual candidato teve mais despesas de campanha?",
                            "Qual o custo médio por voto na eleição de 2022?"
                          ].map((query, qIdx) => (
                            <button
                              key={qIdx}
                              type="button"
                              onClick={() => {
                                setOraculoInput(query);
                              }}
                              className="w-full p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl text-left text-[11px] font-bold text-slate-700 transition-all flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <span className="truncate">{query}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* Chat message list */
                      <div className="flex-1 overflow-y-auto space-y-3 max-h-[320px] pr-1 scroll-hide mb-2">
                        {oraculoChat.map((msg) => {
                          const isOraculo = msg.sender === "oraculo";
                          return (
                            <div
                              key={msg.id}
                              className={`flex ${isOraculo ? "justify-start" : "justify-end"} items-end gap-1.5`}
                            >
                              {isOraculo && (
                                <button
                                  type="button"
                                  onClick={() => speakMessage(msg.id, msg.text)}
                                  className={`p-1.5 rounded-lg border transition-all shrink-0 focus:outline-none cursor-pointer ${
                                    speakingMessageId === msg.id
                                      ? "bg-red-50 border-red-200 text-red-600 animate-pulse"
                                      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                  }`}
                                  title={speakingMessageId === msg.id ? "Parar de falar" : "Falar resposta"}
                                  style={{ minWidth: "28px", minHeight: "28px", display: "flex", alignItems: "center", justifyContent: "center" }}
                                >
                                  {speakingMessageId === msg.id ? (
                                    <VolumeX className="w-3.5 h-3.5 text-red-600" />
                                  ) : (
                                    <Volume2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                              <div
                                className={`p-3 rounded-2xl text-xs max-w-[85%] shadow-2xs leading-relaxed relative ${
                                  isOraculo
                                    ? "bg-slate-100 border border-slate-200 text-slate-800"
                                    : "bg-blue-600 text-white font-medium"
                                }`}
                              >
                                <p className="whitespace-pre-line">{msg.text}</p>
                                {speakingMessageId === msg.id && (
                                  <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-50">
                                    <span className="w-0.5 h-2 bg-red-600 rounded-full animate-bounce [animation-delay:0s]"></span>
                                    <span className="w-0.5 h-3 bg-red-600 rounded-full animate-bounce [animation-delay:0.15s]"></span>
                                    <span className="w-0.5 h-2 bg-red-600 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                                  </div>
                                )}
                              </div>
                              {!isOraculo && (
                                <button
                                  type="button"
                                  onClick={() => speakMessage(msg.id, msg.text)}
                                  className={`p-1.5 rounded-lg border transition-all shrink-0 focus:outline-none cursor-pointer ${
                                    speakingMessageId === msg.id
                                      ? "bg-red-50 border-red-200 text-red-600 animate-pulse"
                                      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                  }`}
                                  title={speakingMessageId === msg.id ? "Parar de falar" : "Falar mensagem"}
                                  style={{ minWidth: "28px", minHeight: "28px", display: "flex", alignItems: "center", justifyContent: "center" }}
                                >
                                  {speakingMessageId === msg.id ? (
                                    <VolumeX className="w-3.5 h-3.5 text-red-600" />
                                  ) : (
                                    <Volume2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {sendingOraculo && (
                          <div className="flex justify-start">
                            <div className="bg-slate-100 border border-slate-200 p-3 rounded-2xl text-xs text-slate-500 shadow-2xs flex items-center gap-2">
                              <span className="flex gap-1 shrink-0">
                                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-100"></span>
                                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-200"></span>
                              </span>
                              <span>Consultando base eleitoral...</span>
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                    )}

                    {/* Chat Input form styled with light theme */}
                    <form onSubmit={handleSendOraculo} className="flex gap-2 border-t border-slate-100 pt-2.5 items-center">
                      <input
                        id="oraculo-chat-input"
                        type="text"
                        placeholder="Ex: Quem gastou menos por voto?"
                        value={oraculoInput}
                        onChange={(e) => setOraculoInput(e.target.value)}
                        disabled={sendingOraculo}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold placeholder-slate-400 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={toggleRecording}
                        className={`p-2 rounded-xl border transition-all duration-150 shrink-0 cursor-pointer ${
                          isRecording
                            ? "bg-red-600 border-red-600 text-white animate-pulse"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        }`}
                        title={isRecording ? "Parar de gravar" : "Gravar áudio (Fala para texto)"}
                        style={{ minWidth: "32px", minHeight: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                      <button
                        id="btn-send-oraculo"
                        type="submit"
                        disabled={sendingOraculo || !oraculoInput.trim()}
                        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs shrink-0 transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer"
                        style={{ minWidth: "32px", minHeight: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* 2. AUDITORIA IA TAB */}
                {activeTab === "audit" && (
                  <motion.div
                    key="audit-view"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col gap-4"
                  >
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3">
                      <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-xs text-amber-800 uppercase">Auditor Financeiro IA</h4>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                          Gera análise em lote das despesas de campanha contratadas dos deputados em {selectedYear}, auditando custo por voto e eficiência.
                        </p>
                      </div>
                    </div>

                    <button
                      id="btn-run-audit"
                      onClick={runAiAudit}
                      disabled={loadingAudit}
                      className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-2 disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer"
                    >
                      {loadingAudit ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-white rounded-full animate-spin"></div>
                          Analizando Contas...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          Gerar Auditoria Geral {selectedYear}
                        </>
                      )}
                    </button>

                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[220px] max-h-[300px] overflow-y-auto text-slate-700">
                      {loadingAudit ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2">
                          <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                          <p className="text-[10px] text-slate-500 font-mono">O Gemini está processando...</p>
                        </div>
                      ) : aiAuditText ? (
                        <div id="ai-audit-output" className="prose prose-sm leading-relaxed text-xs space-y-3">
                          {aiAuditText.split("\n\n").map((para, pIdx) => {
                            if (para.startsWith("1.") || para.startsWith("2.") || para.startsWith("3.") || para.startsWith("4.")) {
                              return (
                                <div key={pIdx} className="bg-white border border-slate-200 rounded-xl p-3 mt-2 shadow-2xs">
                                  <p className="font-bold text-slate-900">{para}</p>
                                </div>
                              );
                            }
                            return <p key={pIdx} className="whitespace-pre-line text-slate-600 font-medium">{para.replace(/\*\*/g, "")}</p>;
                          })}
                        </div>
                      ) : (
                        <div className="py-12 text-center text-slate-400 text-xs">
                          <FileText className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                          Clique no botão acima para rodar a auditoria técnica por IA.
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 3. CONEXÕES DRIVE / GITHUB TAB */}
                {activeTab === "conexoes" && (
                  <motion.div
                    key="conexoes-view"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col gap-5"
                  >
                    {/* Google Drive panel */}
                    <div className="border border-slate-250 bg-white rounded-xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          Google Drive Planilhas
                        </span>
                        {googleUser ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full flex items-center gap-1">
                            Ativo
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full border border-slate-150">
                            Off
                          </span>
                        )}
                      </div>

                      {needsAuth ? (
                        <button
                          id="btn-google-auth"
                          onClick={handleGoogleSignInClick}
                          disabled={loadingGoogleAuth}
                          className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-250 hover:border-slate-300 rounded-lg text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          {loadingGoogleAuth ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                          ) : (
                            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                          )}
                          Conectar Google Drive
                        </button>
                      ) : (
                        <div className="space-y-3 text-xs">
                          <div className="flex justify-between items-center bg-slate-50 p-2 border border-slate-150 rounded-lg">
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 truncate">{googleUser.displayName}</p>
                              <p className="text-[10px] text-slate-400 truncate">{googleUser.email}</p>
                            </div>
                            <button
                              id="btn-google-logout"
                              onClick={handleGoogleSignOutClick}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Desconectar"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase block">Selecione Planilha do seu Drive:</label>
                            {loadingFiles ? (
                              <p className="text-[10px] text-slate-400 italic">Buscando arquivos...</p>
                            ) : driveFiles.length === 0 ? (
                              <p className="text-[10px] text-slate-400 italic">Nenhum arquivo encontrado.</p>
                            ) : (
                              <div className="max-h-24 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-slate-700">
                                {driveFiles.map((f) => (
                                  <button
                                    key={f.id}
                                    onClick={() => handleSelectFile(f)}
                                    className={`w-full text-left p-2 text-[11px] truncate hover:bg-slate-50 ${
                                      selectedFile?.id === f.id ? "bg-blue-50/50 font-bold text-blue-700" : ""
                                    }`}
                                  >
                                    {f.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Planilhas do Gabinete (Links Rápidos solicitados pelo usuário) */}
                          <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase block">Planilhas do Gabinete (Links Rápidos):</label>
                            <div className="grid grid-cols-1 gap-1.5">
                              {FIXED_SPREADSHEETS.map((item, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    handleSelectFile({
                                      id: item.id,
                                      name: item.name,
                                      mimeType: "application/vnd.google-apps.spreadsheet",
                                      modifiedTime: new Date().toISOString()
                                    });
                                  }}
                                  className={`w-full text-left p-2 border rounded-md text-[11px] transition-colors flex items-center justify-between ${
                                    selectedFile?.id === item.id 
                                      ? "border-emerald-200 bg-emerald-50/50 font-bold text-emerald-800" 
                                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                                  }`}
                                >
                                  <span className="truncate flex items-center gap-1.5">
                                    <FileSpreadsheet className={`w-3.5 h-3.5 shrink-0 ${selectedFile?.id === item.id ? 'text-emerald-600' : 'text-slate-400'}`} />
                                    {item.name}
                                  </span>
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Conexão via URL direta */}
                          <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase block">Conectar por URL da Planilha:</label>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                placeholder="Cole a URL da planilha aqui..."
                                value={customUrl}
                                onChange={(e) => setCustomUrl(e.target.value)}
                                className="flex-1 p-1.5 text-[11px] bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                              />
                              <button
                                onClick={handleConnectCustomUrl}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-[11px] font-bold transition-all cursor-pointer shrink-0"
                              >
                                Conectar
                              </button>
                            </div>
                            {customUrlError && (
                              <p className="text-[10px] text-rose-500 italic mt-0.5">{customUrlError}</p>
                            )}
                          </div>

                          {selectedFile && (
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2">
                              <p className="font-bold text-[10px] text-slate-800">Planilha Selecionada: {selectedFile.name}</p>
                              {sheetsList.length > 0 && (
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase block">Aba/Folha:</label>
                                  <select
                                    id="sheet-tabs-select"
                                    value={selectedSheetName}
                                    onChange={(e) => handleSheetTabChange(e.target.value)}
                                    className="w-full p-1.5 bg-white border border-slate-200 rounded-md text-[11px] font-medium"
                                  >
                                    <option value="">Selecione a aba...</option>
                                    {sheetsList.map((s, sIdx) => (
                                      <option key={sIdx} value={s}>{s}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              {selectedSheetName && (
                                <div className="space-y-1">
                                  {detectSheetType() === "geoelectoral" ? (
                                    <>
                                      <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-md text-[10px] text-emerald-800 font-semibold mb-2 space-y-1">
                                        <p className="font-bold flex items-center gap-1">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                          Planilha Geoeleitoral Detectada!
                                        </p>
                                        <p className="text-slate-500 font-medium">
                                          {parseGeoelectoralFromRows().length} registros de votação encontrados para {getGroupedGeoelectoralCandidates(parseGeoelectoralFromRows()).length} candidatos.
                                        </p>
                                      </div>
                                      <button
                                        id="btn-import-sheet-geo"
                                        onClick={handleImportGeoelectoral}
                                        disabled={isImportingGeo || loadingSheetContent || parseGeoelectoralFromRows().length === 0}
                                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold flex items-center justify-center gap-1 shadow-sm cursor-pointer transition-colors"
                                      >
                                        <CloudUpload className="w-3.5 h-3.5" />
                                        {isImportingGeo ? "Consolidando e Importando..." : "Processar e Consolidar Votação no SQLite"}
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <div className="bg-blue-50 border border-blue-100 p-2 rounded-md text-[10px] text-blue-800 font-semibold mb-2">
                                        {parseCandidatesFromRows().length} candidatos estruturados detectados na aba.
                                      </div>
                                      <button
                                        id="btn-import-sheet"
                                        onClick={handleImportCandidates}
                                        disabled={isImporting || loadingSheetContent || parseCandidatesFromRows().length === 0}
                                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-bold flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                                      >
                                        <CloudUpload className="w-3.5 h-3.5" />
                                        {isImporting ? "Importando dados..." : "Processar e Importar no SQLite"}
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* GitHub panel */}
                    <div className="border border-slate-250 bg-white rounded-xl p-3.5 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Github className="w-4 h-4" />
                          Exportar para GitHub
                        </span>
                        {githubUser ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full flex items-center gap-1">
                            Ativo
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full border border-slate-150">
                            Off
                          </span>
                        )}
                      </div>

                      {!githubUser ? (
                        <div className="space-y-2">
                          <input
                            id="github-token-input"
                            type="password"
                            placeholder="Insira seu GitHub Personal Access Token..."
                            value={githubToken}
                            onChange={(e) => setGithubToken(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold placeholder-slate-400 text-slate-800 focus:outline-none focus:border-blue-500"
                          />
                          <button
                            id="btn-github-save-token"
                            onClick={() => {
                              if (githubToken.trim()) {
                                localStorage.setItem("github_token", githubToken);
                                fetchGitHubProfile(githubToken);
                              }
                            }}
                            className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            Conectar com Token
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center bg-slate-50 p-2 border border-slate-150 rounded-lg">
                            <div className="flex items-center gap-2">
                              {githubUser.avatar_url ? (
                                <img src={githubUser.avatar_url} alt="GitHub Avatar" className="w-6 h-6 rounded-full" />
                              ) : (
                                <div className="w-6 h-6 bg-slate-300 rounded-full" />
                              )}
                              <p className="font-bold text-slate-800">{githubUser.login}</p>
                            </div>
                            <button
                              id="btn-github-logout"
                              onClick={() => {
                                setGithubUser(null);
                                setGithubToken("");
                                localStorage.removeItem("github_token");
                              }}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Desconectar"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="space-y-2 bg-slate-50 border border-slate-150 p-2.5 rounded-lg space-y-2 text-[11px]">
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Selecione Repositório:</label>
                              <select
                                id="github-repo-select"
                                value={selectedRepo}
                                onChange={(e) => setSelectedRepo(e.target.value)}
                                className="w-full p-1 bg-white border border-slate-200 rounded-md font-medium"
                              >
                                {githubRepos.map((repo) => (
                                  <option key={repo.id} value={repo.name}>{repo.name}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Caminho do Arquivo (.md):</label>
                              <input
                                id="github-path-input"
                                type="text"
                                value={exportPath}
                                onChange={(e) => setExportPath(e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md font-mono"
                              />
                            </div>

                            <button
                              id="btn-github-export"
                              onClick={handleExportToGitHubClick}
                              disabled={exportingGithub || !selectedRepo}
                              className="w-full py-1.5 bg-[#1e293b] hover:bg-slate-800 text-white font-bold rounded-md text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Github className="w-3.5 h-3.5" />
                              {exportingGithub ? "Gravando no GitHub..." : "Salvar no Repositório"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* feedback toasts inside connections tab */}
                      {importMessage && (
                        <div className={`p-2.5 rounded-lg text-[11px] leading-relaxed font-semibold border ${
                          importMessage.type === "success" 
                            ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                            : "bg-rose-50 border-rose-100 text-rose-700"
                        }`}>
                          {importMessage.text}
                        </div>
                      )}
                      {githubSuccess && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] rounded-lg break-all font-semibold">
                          {githubSuccess}
                        </div>
                      )}
                      {githubError && (
                        <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-[11px] rounded-lg font-semibold">
                          {githubError}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

          </section>

        </div>

      </main>

      {/* Floating Action Button for Mobile Chat Assistant */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <button
          id="mobile-chat-fab"
          type="button"
          onClick={() => setIsMobileAssistantOpen(true)}
          className="w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none cursor-pointer"
          style={{ minHeight: "48px", minWidth: "48px" }}
          title="Abrir Assistente"
        >
          <MessageSquare className="w-6 h-6 animate-pulse" />
        </button>
      </div>

      {/* Footer styled beautifully with slate light colors */}
      <footer id="footer-gabinete" className="bg-white border-t border-slate-200 py-6 mt-auto text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
            © 2026 Gabinete IA • CLDF Electoral Integrity Project
          </p>
          <div className="flex items-center gap-4 text-slate-400 font-medium">
            <span>Base de Dados: SQLite eleicoes.db</span>
            <span>•</span>
            <span>Auditor Oficial: Despesas Contratadas</span>
          </div>
        </div>
      </footer>

      {/* MODAL DE DOSSIÊ DE REPUTAÇÃO / INTELIGÊNCIA */}
      <AnimatePresence>
        {reputationModalOpen && reputationCandidate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-4xl bg-[#090d16] text-slate-100 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Top title bar */}
              <div className="px-6 py-4 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                    Gabinete IA • Monitoramento de Reputação e Inteligência
                  </h3>
                </div>
                <button
                  onClick={() => setReputationModalOpen(false)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* CABEÇALHO */}
                <div className="bg-slate-950/60 p-5 border border-slate-800/60 rounded-xl flex flex-col md:flex-row md:items-center gap-4">
                  <div className="w-20 h-20 rounded-full border-2 border-indigo-500/30 bg-slate-900 overflow-hidden shrink-0 mx-auto md:mx-0">
                    <CandidateAvatar candidatoId={reputationCandidate.id_candidato} nomeUrna={reputationCandidate.nome_urna} fotoUrl={reputationCandidate.foto_url} variant="large" />
                  </div>
                  <div className="text-center md:text-left flex-1 space-y-1">
                    <span className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md text-[10px] font-black uppercase tracking-wider">
                      {reputationCandidate.partido}
                    </span>
                    <h2 className="text-2xl font-black tracking-tight text-white uppercase mt-1">
                      {reputationCandidate.nome_urna}
                    </h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      {reputationCandidate.cargo || "DEPUTADO DISTRITAL"}
                    </p>
                  </div>
                </div>

                {loadingReputation ? (
                  <div className="py-24 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
                    <p className="text-xs text-slate-400 font-mono">
                      Consultando canais e banco de dados de inteligência de reputação...
                    </p>
                  </div>
                ) : reputationClippings.length === 0 ? (
                  /* STATE VAZIO ELEGANTE */
                  <div className="py-16 text-center bg-slate-950/40 border border-dashed border-slate-800 rounded-xl p-8 flex flex-col items-center max-w-lg mx-auto">
                    <div className="p-4 bg-slate-900 text-slate-400 rounded-full mb-3 border border-slate-800">
                      <ShieldAlert className="w-8 h-8 text-indigo-400" />
                    </div>
                    <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                      O Agente de Inteligência ainda não detectou movimentações de mídia relevantes para este perfil nas últimas 24h.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* TERMÔMETRO DE REPUTAÇÃO */}
                    {(() => {
                      // Calculate average impact score and aggregated sentiment
                      const totalImpact = reputationClippings.reduce((sum, item) => sum + (item.impacto_score || 0), 0);
                      const avgImpact = Math.round(totalImpact / reputationClippings.length);
                      
                      // Sentiment aggregation (most frequent or worst case)
                      const sentiments = reputationClippings.map(item => item.sentimento || "Neutro");
                      const sentimentCount = sentiments.reduce((acc, curr) => {
                        acc[curr] = (acc[curr] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>);
                      
                      // For testing/visualizing, we just take the first clipping's sentiment as a highlight
                      const primarySentiment = reputationClippings[0]?.sentimento || "Neutro";
                      
                      // Semantic colors
                      const isNegative = primarySentiment.toLowerCase().includes("negativ") || primarySentiment.toLowerCase().includes("crise");
                      const isPositive = primarySentiment.toLowerCase().includes("positiv") || primarySentiment.toLowerCase().includes("oportunidad");
                      
                      let sentimentBg = "bg-slate-900 border-slate-800 text-slate-400";
                      let sentimentDot = "bg-slate-400";
                      let sentimentBorder = "border-slate-800/60";
                      
                      if (isNegative) {
                        sentimentBg = "bg-rose-950/40 border-rose-900/40 text-rose-400";
                        sentimentDot = "bg-rose-500 animate-pulse";
                        sentimentBorder = "border-rose-900/40";
                      } else if (isPositive) {
                        sentimentBg = "bg-emerald-950/40 border-emerald-900/40 text-emerald-400";
                        sentimentDot = "bg-emerald-500 animate-pulse";
                        sentimentBorder = "border-emerald-900/40";
                      }

                      return (
                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-xl ${sentimentBorder} bg-slate-950/40`}>
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                              <Brain className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Sentimento Geral de Mídia</span>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={`w-2.5 h-2.5 rounded-full ${sentimentDot}`}></span>
                                <span className={`text-sm font-black uppercase tracking-tight ${isNegative ? "text-rose-400" : isPositive ? "text-emerald-400" : "text-slate-300"}`}>
                                  {primarySentiment}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                              <ShieldAlert className="w-6 h-6 text-amber-400" />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Índice de Impacto</span>
                                <span className="text-sm font-black text-amber-400 font-mono">{avgImpact}/100</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-900 border border-slate-800 rounded-full mt-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${avgImpact > 75 ? "bg-red-500" : avgImpact > 45 ? "bg-amber-500" : "bg-emerald-500"}`}
                                  style={{ width: `${avgImpact}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* RADAR DE CRISES E OPORTUNIDADES */}
                    {(() => {
                      // Aggregate all risks and opportunities from clips
                      const allRiscos = reputationClippings.flatMap(item => Array.isArray(item.riscos) ? item.riscos : []);
                      const allOportunidades = reputationClippings.flatMap(item => Array.isArray(item.oportunidades) ? item.oportunidades : []);

                      if (allRiscos.length === 0 && allOportunidades.length === 0) return null;

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Coluna Riscos */}
                          <div className="bg-slate-950/60 p-4 border border-rose-950/30 rounded-xl space-y-3">
                            <h4 className="text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                              <span>Radar de Crises (Riscos)</span>
                            </h4>
                            <ul className="space-y-2">
                              {allRiscos.map((risco, rIdx) => (
                                <li key={rIdx} className="text-xs text-slate-300 flex items-start gap-2 bg-slate-900/50 p-2.5 border border-slate-800/40 rounded-lg text-left">
                                  <span className="text-rose-500 shrink-0 font-bold mt-0.5">•</span>
                                  <span className="font-medium leading-relaxed">{risco}</span>
                                </li>
                              ))}
                              {allRiscos.length === 0 && (
                                <li className="text-xs text-slate-500 font-medium italic py-2 text-left">Nenhum fator crítico de risco identificado.</li>
                              )}
                            </ul>
                          </div>

                          {/* Coluna Oportunidades */}
                          <div className="bg-slate-950/60 p-4 border border-emerald-950/30 rounded-xl space-y-3">
                            <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                              <Target className="w-4 h-4 text-emerald-500 shrink-0" />
                              <span>Recomendações e Oportunidades</span>
                            </h4>
                            <ul className="space-y-2">
                              {allOportunidades.map((op, oIdx) => (
                                <li key={oIdx} className="text-xs text-slate-300 flex items-start gap-2 bg-slate-900/50 p-2.5 border border-slate-800/40 rounded-lg text-left">
                                  <span className="text-emerald-500 shrink-0 font-bold mt-0.5">•</span>
                                  <span className="font-medium leading-relaxed">{op}</span>
                                </li>
                              ))}
                              {allOportunidades.length === 0 && (
                                <li className="text-xs text-slate-500 font-medium italic py-2 text-left">Nenhuma recomendação preventiva extraída.</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      );
                    })()}

                    {/* CLIPPING (Linha do Tempo) */}
                    <div className="space-y-4">
                      <div className="border-b border-slate-800/60 pb-2">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-indigo-400" />
                          <span>Clipping de Mídia Recente ({reputationClippings.length})</span>
                        </h4>
                      </div>

                      <div className="space-y-3.5">
                        {reputationClippings.map((clip) => (
                          <div
                            key={clip.id_clipping}
                            className="bg-slate-950/80 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 transition-all space-y-3 text-left"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-slate-900 pb-2">
                              <div>
                                <h3 className="text-sm font-extrabold text-white leading-snug">
                                  {clip.titulo}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                  <span className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">
                                    {clip.fonte}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono font-medium">
                                    {clip.data_publicacao}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                    clip.sentimento.toLowerCase().includes("negativ") || clip.sentimento.toLowerCase().includes("crise")
                                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  }`}>
                                    {clip.sentimento}
                                  </span>
                                  {clip.tema_principal && (
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-md">
                                      {clip.tema_principal}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <p className="text-xs text-slate-300 font-medium leading-relaxed">
                              {clip.resumo_curto}
                            </p>

                            {clip.resumo_executivo && (
                              <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-lg">
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">Análise do Agente NLP (Resumo Executivo)</span>
                                <p className="text-[11px] text-slate-400 leading-relaxed font-medium mt-1">
                                  {clip.resumo_executivo}
                                </p>
                              </div>
                            )}

                            {/* Keywords and metadata tags */}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {Array.isArray(clip.palavras_chave) && clip.palavras_chave.map((kw: string, kwIdx: number) => (
                                <span key={kwIdx} className="text-[9px] font-mono font-bold text-slate-400 bg-slate-900 border border-slate-850 px-2 py-0.5 rounded">
                                  #{kw}
                                </span>
                              ))}
                            </div>

                            <div className="flex justify-end pt-2 border-t border-slate-900">
                              <a
                                href={clip.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                              >
                                <span>Ver Fonte Original</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Bottom footer action bar */}
              <div className="px-6 py-4 bg-slate-950 border-t border-slate-850 flex justify-end">
                <button
                  onClick={() => setReputationModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}