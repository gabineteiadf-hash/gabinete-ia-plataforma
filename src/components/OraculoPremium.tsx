import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import { 
  MessageSquare, 
  Sparkles, 
  Mic, 
  MicOff, 
  Send, 
  Volume2, 
  VolumeX, 
  X, 
  ChevronDown, 
  Maximize2, 
  Minimize2, 
  Brain,
  HelpCircle,
  ArrowRight,
  RotateCcw,
  FileText,
  Download,
  Copy,
  Check
} from "lucide-react";

// Types for Chat Messages
interface ChatMessage {
  id: string;
  sender: "user" | "oraculo" | "system";
  text: string;
  timestamp: Date;
}

// Map for active sections human readable names & descriptions
const SCOPE_META = {
  gastos: {
    title: "Oráculo de Gastos",
    welcome: "Olá! Sou o Oráculo de Gastos. Posso analisar detalhadamente as despesas de campanha, identificar padrões de gastos por voto e cruzamentos de dados financeiros de mandatos passados.",
    color: "from-rose-500 to-red-600",
    shadow: "shadow-red-500/20",
    border: "border-red-500/30",
    suggestions: [
      "Quem gastou mais por voto nas últimas eleições?",
      "Qual o percentual médio de gastos com publicidade?",
      "Quais deputados tiveram as campanhas mais econômicas?"
    ]
  },
  geoeleitoral: {
    title: "Oráculo Geoeleitoral",
    welcome: "Olá! Sou o Oráculo Geoeleitoral. Estou pronto para analisar a distribuição geográfica de votos, principais colégios eleitorais e desempenho nas zonas.",
    color: "from-blue-500 to-indigo-600",
    shadow: "shadow-blue-500/20",
    border: "border-blue-500/30",
    suggestions: [
      "Qual a zona eleitoral mais densa do Distrito Federal?",
      "Como se deu o desempenho de votos por região administrativa?",
      "Onde se concentram as maiores forças eleitorais?"
    ]
  },
  reputacao: {
    title: "Oráculo de Eficiência",
    welcome: "Olá! Sou o Oráculo de Eficiência. Posso cruzar custos operacionais, menções de reputação e performance nas urnas para avaliar o benchmark de deputados.",
    color: "from-amber-500 to-orange-600",
    shadow: "shadow-amber-500/20",
    border: "border-amber-500/30",
    suggestions: [
      "Qual o benchmark de eficiência de custos por voto?",
      "Como cruzar a reputação da imprensa com o sucesso eleitoral?",
      "Quais deputados apresentaram o melhor índice de retorno de imagem?"
    ]
  },
  campanhas: {
    title: "Oráculo de Gestão",
    welcome: "Olá! Sou o Oráculo de Gestão Territorial. Vamos planejar, projetar e mapear as metas das Campanhas de 2026 com base na inteligência de dados.",
    color: "from-purple-500 to-violet-600",
    shadow: "shadow-purple-500/20",
    border: "border-purple-500/30",
    suggestions: [
      "Como projetar metas realistas de votos para 2026?",
      "Quais bairros ou cidades devem ser prioritários para expansão?",
      "Qual a estimativa de quociente partidário para o próximo pleito?"
    ]
  }
};

interface OraculoPremiumProps {
  activeGuide: "gastos" | "geoeleitoral" | "reputacao" | "campanhas";
  selectedCandidate?: any;
  selectedYear?: number;
}

export const OraculoPremium: React.FC<OraculoPremiumProps> = ({ 
  activeGuide,
  selectedCandidate,
  selectedYear
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  
  // Speech Recognition States
  const [isListening, setIsListening] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const handleSendRef = useRef<any>(null);

  const meta = SCOPE_META[activeGuide] || SCOPE_META.gastos;

  // Export functions
  const handleCopyText = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleExportPDF = (text: string) => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // A4: 210mm
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2); // 170mm

      // Title header
      doc.setFillColor(30, 41, 59); // Slate-800
      doc.rect(margin, 20, contentWidth, 16, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("GABINETE IA - RELATÓRIO DE ANÁLISE DO ORÁCULO", margin + 6, 30);

      doc.setTextColor(100, 116, 139); // Slate-500
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Relatório gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, 42);
      
      if (selectedCandidate) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(229, 9, 20); // Red-600
        doc.text(`Foco de Contexto Ativo: ${selectedCandidate.nome_urna} (${selectedCandidate.partido})`, margin, 48);
      }

      // Divider line
      doc.setDrawColor(226, 232, 240); // Slate-200
      doc.setLineWidth(0.5);
      doc.line(margin, 52, margin + contentWidth, 52);

      // Simple Markdown Cleaner
      const cleanText = text.replace(/[*_#`]/g, "");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85); // Slate-700
      
      const splitText = doc.splitTextToSize(cleanText, contentWidth);
      
      let y = 60;
      for (let i = 0; i < splitText.length; i++) {
        if (y > 275) {
          doc.addPage();
          y = 25;
        }
        doc.text(splitText[i], margin, y);
        y += 5.5; // Line spacing
      }

      doc.save(`Relatorio_Oraculo_${selectedCandidate ? selectedCandidate.nome_urna.replace(/\s+/g, "_") : "Analise"}.pdf`);
    } catch (err) {
      console.error("Erro ao exportar PDF:", err);
    }
  };

  const handleExportCSV = (text: string) => {
    try {
      const lines = text.split("\n");
      const tableRows = lines.filter(line => line.trim().startsWith("|") && line.trim().endsWith("|"));
      
      let csvContent = "";
      
      if (tableRows.length > 1) {
        // Table detected! Format dynamically
        const formattedRows = tableRows
          .filter(row => !row.includes("---"))
          .map(row => {
            const cols = row.split("|").slice(1, -1).map(c => c.trim().replace(/"/g, '""'));
            return cols.map(c => `"${c}"`).join(";");
          });
        csvContent = formattedRows.join("\n");
      } else {
        // Default text paragraph lines to rows
        const cleanLines = lines
          .map(line => line.trim().replace(/^[-*+]\s+/, ""))
          .filter(line => line.length > 0)
          .map(line => `"${line.replace(/"/g, '""')}"`);
        csvContent = `Gabinete IA - Relatorio do Oraculo\n\nConteudo da Analise:\n${cleanLines.join("\n")}`;
      }

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Dados_Oraculo_${selectedCandidate ? selectedCandidate.nome_urna.replace(/\s+/g, "_") : "Export"}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Erro ao exportar CSV:", err);
    }
  };

  // Initialize Web Speech API for Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "pt-BR";

      rec.onstart = () => {
        setIsListening(true);
        setMicError(null);
      };

      rec.onresult = (event: any) => {
        let fullTranscript = "";
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript;
        }
        if (fullTranscript) {
          setInputMessage(fullTranscript);
        }
      };

      rec.onerror = (event: any) => {
        console.error("Erro no reconhecimento de voz:", event.error);
        if (event.error !== "no-speech" && event.error !== "aborted") {
          setMicError(`Erro: ${event.error}`);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Initialize/Reset chat with Welcome message based on activeGuide
  useEffect(() => {
    const initialWelcome: ChatMessage = {
      id: "welcome-" + activeGuide,
      sender: "oraculo",
      text: meta.welcome,
      timestamp: new Date()
    };
    
    // Add a system update message if history already exists
    if (chatHistory.length > 0) {
      const systemMessage: ChatMessage = {
        id: "sys-" + Date.now(),
        sender: "system",
        text: `Foco de inteligência alterado para: ${meta.title}`,
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, systemMessage, initialWelcome]);
    } else {
      setChatHistory([initialWelcome]);
    }
  }, [activeGuide]);

  // Scroll to bottom whenever messages list updates or expands
  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    }
  }, [chatHistory, isExpanded, loading]);

  // Stop current text synthesis on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const handleToggleMic = () => {
    if (!recognitionRef.current) {
      setMicError("Seu navegador não suporta digitação por voz.");
      setTimeout(() => setMicError(null), 4000);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        window.speechSynthesis?.cancel();
        setSpeakingMsgId(null);
        recognitionRef.current.start();
      } catch (err) {
        console.error("Falha ao iniciar microfone:", err);
      }
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    setInputMessage("");
    window.speechSynthesis?.cancel();
    setSpeakingMsgId(null);

    // Add user message
    const userMsg: ChatMessage = {
      id: "msg-user-" + Date.now(),
      sender: "user",
      text: text,
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      let response;
      let retries = 3;
      while (retries > 0) {
        response = await fetch("/api/oraculo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            question: text,
            selectedCandidate: selectedCandidate ? selectedCandidate.nome_urna : "",
            selectedYear: selectedYear || 2022,
            historico: chatHistory.map(h => ({ sender: h.sender, text: h.text }))
          })
        });
        if (response.ok || response.status !== 503) break;
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const data = await response.json();
      const answerText = data.answer || data.message || "Não consegui obter uma resposta agora. Por favor, tente novamente.";
      const responseId = "msg-oraculo-" + Date.now();

      const aiMsg: ChatMessage = {
        id: responseId,
        sender: "oraculo",
        text: answerText,
        timestamp: new Date()
      };

      setChatHistory(prev => [...prev, aiMsg]);

      if (autoSpeak) {
        handleSpeak(responseId, answerText);
      }
    } catch (err) {
      console.error("Erro ao chamar Oráculo API:", err);
      const errorMsg: ChatMessage = {
        id: "msg-error-" + Date.now(),
        sender: "oraculo",
        text: "Ocorreu uma instabilidade na conexão com a inteligência do Oráculo. Por favor, reformule ou tente novamente.",
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const handleSpeak = (msgId: string, text: string) => {
    if (!window.speechSynthesis) return;

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    
    // Clean text from markdown bold/italic tags
    const cleanText = text.replace(/[*#_`]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "pt-BR";
    
    utterance.onend = () => {
      setSpeakingMsgId(null);
    };

    utterance.onerror = () => {
      setSpeakingMsgId(null);
    };

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleClearChat = () => {
    window.speechSynthesis?.cancel();
    setSpeakingMsgId(null);
    const initialWelcome: ChatMessage = {
      id: "welcome-reset-" + Date.now(),
      sender: "oraculo",
      text: meta.welcome,
      timestamp: new Date()
    };
    setChatHistory([initialWelcome]);
  };

  return (
    <div id="oraculo-premium-widget" className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans">
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          /* COLLAPSED FLOATING TRIGGER BUTTON */
          <motion.button
            key="collapsed"
            id="oraculo-trigger"
            layoutId="oraculo-container"
            onClick={() => setIsExpanded(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`relative flex items-center gap-3.5 px-5 py-4 bg-slate-950/90 text-white rounded-full border border-slate-800 shadow-2xl backdrop-blur-md cursor-pointer group hover:border-slate-700`}
            style={{
              boxShadow: "0 10px 40px -10px rgba(229, 9, 20, 0.15), inset 0 1px 0 0 rgba(255,255,255,0.05)"
            }}
          >
            {/* Animated Pulsing Sphere */}
            <div className="relative w-4 h-4 flex items-center justify-center">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </div>
            
            <div className="flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-amber-400 group-hover:rotate-12 transition-transform duration-300" />
              <span className="text-xs font-black tracking-wider uppercase text-slate-100">
                Oráculo IA
              </span>
            </div>

            {/* Micro pill indicator showing current scope focus */}
            <span className="text-[9px] px-2 py-0.5 bg-slate-800 border border-slate-700/80 rounded-md text-slate-400 font-extrabold max-w-[80px] truncate">
              {meta.title.split(" ").pop()}
            </span>
          </motion.button>
        ) : (
          /* EXPANDED RICH PREMIUM CHAT WINDOW */
          <motion.div
            key="expanded"
            layoutId="oraculo-container"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="w-[360px] sm:w-[420px] max-w-[calc(100vw-2rem)] bg-slate-950/95 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl"
            style={{
              height: "540px",
              boxShadow: "0 20px 50px -12px rgba(0,0,0,0.5), 0 0 40px 2px rgba(229, 9, 20, 0.05)"
            }}
          >
            {/* Header Area */}
            <div className={`p-4 bg-gradient-to-r ${meta.color} flex items-center justify-between border-b border-white/5`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-black/20 flex items-center justify-center border border-white/10">
                  <Brain className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="text-left">
                  <h4 className="text-xs font-black tracking-wider uppercase text-white flex items-center gap-1.5">
                    {meta.title}
                    <span className="text-[8px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-bold">
                      Premium
                    </span>
                  </h4>
                  <p className="text-[10px] text-white/80 font-bold">
                    Assistente Legislativo Inteligente
                  </p>
                </div>
              </div>

              {/* Window Controls */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  title="Limpar Histórico"
                  onClick={handleClearChat}
                  className="p-1.5 bg-black/10 hover:bg-black/20 rounded-lg text-white/80 hover:text-white transition-all cursor-pointer border border-white/5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 bg-black/10 hover:bg-black/20 rounded-lg text-white/80 hover:text-white transition-all cursor-pointer border border-white/5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Scope Tracker Badge at Top of Chat Content */}
            <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-[10px]">
              <span className="text-slate-400 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Foco de Análise: <strong className="text-slate-200 font-black">{meta.title}</strong>
              </span>
              
              {/* TTS Voice Toggle */}
              <button
                type="button"
                onClick={() => {
                  setAutoSpeak(!autoSpeak);
                  if (autoSpeak) {
                    window.speechSynthesis?.cancel();
                    setSpeakingMsgId(null);
                  }
                }}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-black transition-all cursor-pointer ${
                  autoSpeak 
                    ? "bg-red-950/40 text-red-400 border-red-500/20" 
                    : "bg-slate-800/50 text-slate-400 border-transparent hover:text-slate-300"
                }`}
              >
                {autoSpeak ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                <span>{autoSpeak ? "Auto-voz Ativo" : "Auto-voz Inativo"}</span>
              </button>
            </div>

            {/* Candidate Contextual Active Badge */}
            {selectedCandidate && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="px-4 py-2 bg-red-950/20 border-b border-red-900/30 flex items-center justify-between text-[10px]"
              >
                <span className="text-red-400 font-extrabold flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Contexto Ativo: <strong className="text-white font-black truncate">{selectedCandidate.nome_urna} ({selectedCandidate.partido})</strong>
                </span>
                <span className="text-[8px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-black uppercase tracking-wider shrink-0">
                  Pleito {selectedYear || '2022'}
                </span>
              </motion.div>
            )}

            {/* Chat Messages Timeline */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 text-left bg-[#090a0f]">
              <AnimatePresence initial={false}>
                {chatHistory.map((msg) => {
                  if (msg.sender === "system") {
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-center my-1.5"
                      >
                        <span className="text-[9px] px-3 py-1 bg-slate-900 border border-slate-800/80 rounded-full text-slate-500 font-bold uppercase tracking-wider">
                          {msg.text}
                        </span>
                      </motion.div>
                    );
                  }

                  const isAI = msg.sender === "oraculo";
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isAI ? "justify-start" : "justify-end"} items-start gap-2.5`}
                    >
                      {isAI && (
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${meta.color} flex items-center justify-center shrink-0 border border-white/10 shadow-lg ${meta.shadow}`}>
                          <Brain className="w-4 h-4 text-white" />
                        </div>
                      )}

                      <div className="flex flex-col gap-1 max-w-[80%]">
                        <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          isAI 
                            ? "bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none font-medium" 
                            : "bg-[#e50914] text-white font-extrabold shadow-md rounded-tr-none"
                        }`}>
                          <p className="whitespace-pre-line break-words">{msg.text}</p>
                          
                          {/* Action row with Export options */}
                          {isAI && (
                            <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-wrap gap-1.5 justify-end">
                              {/* Speech toggle */}
                              <button
                                type="button"
                                onClick={() => handleSpeak(msg.id, msg.text)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                  speakingMsgId === msg.id
                                    ? "bg-red-950/40 border border-red-500/30 text-red-400 animate-pulse"
                                    : "bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-white"
                                }`}
                              >
                                {speakingMsgId === msg.id ? (
                                  <>
                                    <VolumeX className="w-2.5 h-2.5 text-red-400" />
                                    <span>Parar Áudio</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="w-2.5 h-2.5 text-slate-400" />
                                    <span>Ouvir</span>
                                  </>
                                )}
                              </button>

                              {/* Copy Text button */}
                              <button
                                type="button"
                                onClick={() => handleCopyText(msg.id, msg.text)}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-white"
                              >
                                {copiedMsgId === msg.id ? (
                                  <>
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                    <span className="text-emerald-400">Copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-2.5 h-2.5" />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>

                              {/* Export PDF button */}
                              <button
                                type="button"
                                onClick={() => handleExportPDF(msg.text)}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-white"
                                title="Exportar Resposta para PDF"
                              >
                                <FileText className="w-2.5 h-2.5 text-red-400" />
                                <span>PDF</span>
                              </button>

                              {/* Export CSV button */}
                              <button
                                type="button"
                                onClick={() => handleExportCSV(msg.text)}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-white"
                                title="Exportar Tabelas ou Dados para Excel/CSV"
                              >
                                <Download className="w-2.5 h-2.5 text-blue-400" />
                                <span>CSV</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <span className={`text-[9px] text-slate-600 font-bold px-1 ${!isAI && "text-right"}`}>
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Loading Indicator */}
              {loading && (
                <div className="flex justify-start items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${meta.color} flex items-center justify-center shrink-0 animate-pulse`}>
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl rounded-tl-none text-xs text-slate-400 flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-[#e50914] rounded-full animate-spin shrink-0" />
                    <span className="font-semibold">O Oráculo está cruzando dados...</span>
                  </div>
                </div>
              )}

              {/* Microphone Listening State Animation Overlaid/Inserted */}
              {isListening && (
                <div className="flex justify-start items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 animate-pulse">
                    <Mic className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-blue-950/40 border border-blue-900/40 p-4 rounded-2xl rounded-tl-none text-xs text-blue-300 flex flex-col gap-2.5 w-72">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                      <span className="font-black text-blue-200 tracking-wider uppercase text-[10px]">IA Ouvindo...</span>
                    </div>
                    <p className="text-blue-400/95 italic">Fale sua pergunta agora...</p>
                    
                    {/* Visual Soundwave Animation */}
                    <div className="flex items-end justify-center gap-1.5 h-8 mt-1">
                      {[1, 2, 3, 4, 5, 6, 7].map((bar) => (
                        <motion.div
                          key={bar}
                          animate={{
                            height: ["20%", "100%", "20%"]
                          }}
                          transition={{
                            duration: 0.6 + bar * 0.1,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                          className="w-1 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-full"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Mic Error Alert */}
            {micError && (
              <div className="px-4 py-1.5 bg-red-950/60 border-t border-red-900/30 text-[10px] text-red-400 font-bold text-center">
                {micError}
              </div>
            )}

            {/* Suggested prompts footer chips */}
            <div className="p-3 bg-slate-900/30 border-t border-slate-800/40 flex flex-col gap-2.5">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block text-left">
                Sugestões inteligentes:
              </span>
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
                {meta.suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(suggestion)}
                    className="whitespace-nowrap px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-[10.5px] font-semibold transition-all duration-200 shrink-0 cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Submission Container */}
            <div className="p-3 bg-slate-950 border-t border-slate-850 flex items-center gap-2">
              {/* Voice recognition mic button */}
              <button
                type="button"
                onClick={handleToggleMic}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer relative shrink-0 ${
                  isListening
                    ? "bg-blue-600 border-blue-500 text-white animate-pulse"
                    : "bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white"
                }`}
                title="Digitar por Voz"
              >
                {isListening ? <Mic className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Text input field */}
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) {
                    handleSend();
                  }
                }}
                disabled={isListening}
                placeholder={isListening ? "Ouvindo sua voz..." : "Pergunte ao Oráculo..."}
                className="flex-1 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-[#e50914] focus:bg-[#141417] transition-all disabled:opacity-50"
              />

              {/* Send message button */}
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={loading || !inputMessage.trim() || isListening}
                className={`p-3.5 bg-[#e50914] hover:bg-[#b8070f] text-white rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
