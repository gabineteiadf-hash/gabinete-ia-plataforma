import React, { useState, useEffect } from "react";
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
  AlertCircle 
} from "lucide-react";

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

interface DossieInteligenciaProps {
  candidatoId: number;
  candidatoName: string;
}

export const DossieInteligencia: React.FC<DossieInteligenciaProps> = ({ candidatoId, candidatoName }) => {
  const [clippings, setClippings] = useState<ClippingItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/reputacao/${candidatoId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Não foi possível carregar as informações de reputação.");
        }
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setClippings(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Erro ao buscar reputação:", err);
        if (isMounted) {
          setError(err.message || "Erro de conexão ao carregar dossiê.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [candidatoId]);

  if (loading) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 text-center min-h-[300px]">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
        <div>
          <h4 className="text-sm font-bold text-slate-200">Consultando Banco de Inteligência</h4>
          <p className="text-xs text-slate-500 mt-1">Varrendo clipping, mídias digitais e redes de influência em tempo real...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center text-rose-400 min-h-[250px]">
        <AlertCircle className="w-10 h-10 text-rose-500" />
        <div>
          <h4 className="text-sm font-bold">Falha no Carregamento</h4>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (clippings.length === 0) {
    return (
      <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center max-w-xl mx-auto my-8">
        <div className="p-4 bg-slate-900/80 text-slate-400 rounded-full mb-4 border border-slate-800">
          <ShieldAlert className="w-8 h-8 text-indigo-400" />
        </div>
        <h4 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider">Ausência de Menções Críticas</h4>
        <p className="text-xs text-slate-400 leading-relaxed mt-2">
          O Agente NLP não identificou menções de mídia de alto impacto ou alertas reputacionais para <span className="font-bold text-indigo-400">{candidatoName}</span> nas últimas 24h. O perfil permanece em estabilidade de monitoramento.
        </p>
      </div>
    );
  }

  // Calculate average impact score and main sentiment
  const totalImpact = clippings.reduce((sum, item) => sum + (item.impacto_score || 0), 0);
  const avgImpact = Math.round(totalImpact / clippings.length);
  const primarySentiment = clippings[0]?.sentimento || "Neutro";

  // Semantic styling based on sentiment
  const sentimentLower = primarySentiment.toLowerCase();
  const isNegative = sentimentLower.includes("negativ") || sentimentLower.includes("crise");
  const isPositive = sentimentLower.includes("positiv") || sentimentLower.includes("oportunidad");

  let sentimentColorClass = "text-slate-400";
  let sentimentBgClass = "bg-slate-950/60 border-slate-800";
  let indicatorDotClass = "bg-slate-400";

  if (isNegative) {
    sentimentColorClass = "text-rose-400";
    sentimentBgClass = "bg-rose-950/20 border-rose-900/30";
    indicatorDotClass = "bg-rose-500 animate-pulse";
  } else if (isPositive) {
    sentimentColorClass = "text-emerald-400";
    sentimentBgClass = "bg-emerald-950/20 border-emerald-900/30";
    indicatorDotClass = "bg-emerald-500 animate-pulse";
  } else if (sentimentLower.includes("alerta") || sentimentLower.includes("atenc")) {
    sentimentColorClass = "text-amber-400";
    sentimentBgClass = "bg-amber-950/20 border-amber-900/30";
    indicatorDotClass = "bg-amber-500 animate-pulse";
  }

  // Aggregate risks and opportunities across all clips
  const allRisks = clippings.flatMap(item => {
    if (Array.isArray(item.riscos)) return item.riscos;
    try {
      return item.riscos ? JSON.parse(item.riscos as string) : [];
    } catch {
      return [];
    }
  });

  const allOpportunities = clippings.flatMap(item => {
    if (Array.isArray(item.oportunidades)) return item.oportunidades;
    try {
      return item.oportunidades ? JSON.parse(item.oportunidades as string) : [];
    } catch {
      return [];
    }
  });

  return (
    <div className="space-y-6 text-slate-200">
      
      {/* SEÇÃO INFORMATIVA DE HEADER */}
      <div className="flex items-center gap-2 pb-2 border-b border-slate-850">
        <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
        <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">
          Dossiê Inteligente de Reputação & Crises
        </h3>
      </div>

      {/* GRID DO TERMÔMETRO DE MÍDIA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* SENTIMENTO GERAL */}
        <div className={`p-4 border rounded-xl flex items-center gap-3.5 transition-all ${sentimentBgClass}`}>
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl shrink-0">
            <Brain className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Sentimento Geral de Mídia</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${indicatorDotClass}`}></span>
              <span className={`text-base font-black uppercase tracking-tight ${sentimentColorClass}`}>
                {primarySentiment}
              </span>
            </div>
          </div>
        </div>

        {/* ÍNDICE DE IMPACTO */}
        <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center gap-3.5">
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl shrink-0">
            <ShieldAlert className="w-6 h-6 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Índice de Impacto Agregado</span>
              <span className="text-sm font-black text-amber-400 font-mono">{avgImpact}/100</span>
            </div>
            <div className="w-full h-2 bg-slate-900 border border-slate-800 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  avgImpact > 75 ? "bg-rose-500" : avgImpact > 45 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${avgImpact}%` }}
              ></div>
            </div>
          </div>
        </div>

      </div>

      {/* RADAR DE RISCOS E OPORTUNIDADES */}
      {(allRisks.length > 0 || allOpportunities.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* COLUNA: RISCOS (CRISES) */}
          <div className="bg-slate-950/60 p-5 border border-rose-950/30 rounded-xl space-y-3.5">
            <div className="flex items-center gap-1.5 border-b border-rose-950/20 pb-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <h4 className="text-xs font-black text-rose-400 uppercase tracking-widest">
                Fatores de Risco & Alertas
              </h4>
            </div>
            <ul className="space-y-2">
              {allRisks.map((risco, idx) => (
                <li 
                  key={idx} 
                  className="text-xs text-slate-300 flex items-start gap-2 bg-slate-900/40 p-2.5 border border-rose-950/10 rounded-lg text-left hover:border-rose-900/20 transition-all"
                >
                  <span className="text-rose-500 shrink-0 font-bold mt-0.5">•</span>
                  <span className="font-semibold leading-relaxed text-[11px]">{risco}</span>
                </li>
              ))}
              {allRisks.length === 0 && (
                <li className="text-xs text-slate-500 italic py-2 text-left">Nenhum fator crítico de risco mapeado.</li>
              )}
            </ul>
          </div>

          {/* COLUNA: OPORTUNIDADES (RECOMENDAÇÕES) */}
          <div className="bg-slate-950/60 p-5 border border-emerald-950/30 rounded-xl space-y-3.5">
            <div className="flex items-center gap-1.5 border-b border-emerald-950/20 pb-2">
              <Target className="w-4 h-4 text-emerald-400 shrink-0" />
              <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                Recomendações e Plano de Ação
              </h4>
            </div>
            <ul className="space-y-2">
              {allOpportunities.map((op, idx) => (
                <li 
                  key={idx} 
                  className="text-xs text-slate-300 flex items-start gap-2 bg-slate-900/40 p-2.5 border border-emerald-950/10 rounded-lg text-left hover:border-emerald-900/20 transition-all"
                >
                  <span className="text-emerald-400 shrink-0 font-bold mt-0.5">•</span>
                  <span className="font-semibold leading-relaxed text-[11px]">{op}</span>
                </li>
              ))}
              {allOpportunities.length === 0 && (
                <li className="text-xs text-slate-500 italic py-2 text-left">Nenhuma recomendação de mitigação extraída.</li>
              )}
            </ul>
          </div>

        </div>
      )}

      {/* LINHA DO TEMPO (CLIPPING) */}
      <div className="space-y-4">
        <div className="border-b border-slate-800/60 pb-2">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Linha do Tempo: Clipping Recente ({clippings.length})</span>
          </h4>
        </div>

        <div className="space-y-4">
          {clippings.map((clip) => {
            const keywords = Array.isArray(clip.palavras_chave) 
              ? clip.palavras_chave 
              : (() => {
                  try {
                    return clip.palavras_chave ? JSON.parse(clip.palavras_chave as string) : [];
                  } catch {
                    return [];
                  }
                })();

            const isClipNegative = clip.sentimento.toLowerCase().includes("negativ") || clip.sentimento.toLowerCase().includes("crise");

            return (
              <div 
                key={clip.id_clipping}
                className="bg-slate-950/70 border border-slate-800 hover:border-indigo-900/40 rounded-xl p-5 transition-all space-y-3.5 text-left shadow-lg"
              >
                {/* Header info */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-slate-900 pb-3">
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-black text-white leading-snug hover:text-indigo-300 transition-colors">
                      {clip.titulo}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-[10px] font-black text-slate-300 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">
                        {clip.fonte}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {clip.data_publicacao}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                        isClipNegative 
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

                {/* Content */}
                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                  {clip.resumo_curto}
                </p>

                {/* Resumo Executivo / NLP Analysis */}
                {clip.resumo_executivo && (
                  <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-lg">
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">
                      Análise do Agente NLP (Resumo Executivo)
                    </span>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-semibold mt-1">
                      {clip.resumo_executivo}
                    </p>
                  </div>
                )}

                {/* Tags / Keywords */}
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {keywords.map((tag: string, idx: number) => (
                      <span 
                        key={idx} 
                        className="text-[9px] font-mono font-bold text-indigo-400 bg-indigo-950/30 border border-indigo-950/60 px-2 py-0.5 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Source link */}
                <div className="flex justify-end pt-2.5 border-t border-slate-900/60">
                  <a
                    href={clip.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <span>Acessar Portal da Notícia</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
