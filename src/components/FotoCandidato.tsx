import React, { useState, useEffect } from "react";

// ============================================================================
// Tipagem das Propriedades (Props)
// ============================================================================
interface FotoCandidatoProps {
  /** ID único do candidato no banco de dados para consulta no proxy */
  candidatoId: string;
  /** URL de compartilhamento do Google Drive vinda do banco de dados */
  urlOriginalDoDrive?: string;
  /** Nome do candidato (usado para o alt e para gerar iniciais de fallback) */
  nome: string;
  /** Classes extras do Tailwind (ex: tamanho w-12 h-12 personalizado) */
  className?: string;
}

// Estágios de resolução progressiva da imagem
type EstagioCarregamento = "proxy" | "drive-direto" | "fallback";

// ============================================================================
// Função Utilitária: Conversão de Link do Google Drive
// ============================================================================
/**
 * Converte uma URL de visualização/compartilhamento comum do Google Drive
 * para o endpoint lh3 de alta performance, permitindo renderização direta em tags <img>.
 * 
 * @param url URL original do Google Drive
 * @returns URL de renderização direta ou link de placeholder padrão
 */
export function getDirectDrivePhotoUrl(url?: string): string {
  // Se a URL estiver vazia, retorna um placeholder profissional de silhueta/perfil
  if (!url || url.trim() === "") {
    return "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80";
  }

  const trimmedUrl = url.trim();

  // Verifica se o link é do Google Drive
  if (trimmedUrl.includes("drive.google.com")) {
    // Regex para extrair o ID único do arquivo do Google Drive
    const match = trimmedUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || trimmedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    
    if (match && match[1]) {
      const fileId = match[1];
      // Converte para o servidor lh3 de alta performance do Google
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }

  // Se for uma URL comum (ex: HTTPS comum), retorna ela mesma
  return trimmedUrl;
}

// ============================================================================
// Componente de Avatar Resiliente: FotoCandidato
// ============================================================================
export const FotoCandidato: React.FC<FotoCandidatoProps> = ({
  candidatoId,
  urlOriginalDoDrive,
  nome,
  className = "w-10 h-10",
}) => {
  // Estágio atual do pipeline de renderização progressiva
  const [estagio, setEstagio] = useState<EstagioCarregamento>("proxy");
  // Fonte da imagem final que será inserida no atributo 'src'
  const [src, setSrc] = useState<string>("");

  // Sempre que as propriedades mudarem, reiniciamos o pipeline no estágio "proxy"
  useEffect(() => {
    setEstagio("proxy");
    setSrc(`/api/proxy-foto?nome=${encodeURIComponent(nome)}`);
  }, [candidatoId, urlOriginalDoDrive, nome]);

  // Executa a transição de estágio caso ocorra um erro de carregamento (onError)
  const handleImageError = () => {
    if (estagio === "proxy") {
      // Se falhar a rota do Express (Proxy Cache), tenta o Google Drive direto pelo frontend
      console.warn(`[FotoCandidato] Falha ao carregar do Proxy local para o candidato "${nome}". Tentando link direto do Drive.`);
      setEstagio("drive-direto");
      setSrc(getDirectDrivePhotoUrl(urlOriginalDoDrive));
    } else if (estagio === "drive-direto") {
      // Se falhar o link direto do Google Drive, usa o Unsplash/Silhouette de fallback final
      console.error(`[FotoCandidato] Falha crítica de carregamento no link direto do Drive para "${nome}". Ativando fallback final.`);
      setEstagio("fallback");
      setSrc("https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80");
    }
  };

  // Helper para obter iniciais elegantes caso caia no fallback e o usuário prefira um avatar de letras
  const getInitials = (fullName: string) => {
    if (!fullName) return "N";
    return fullName
      .split(" ")
      .filter((n) => n.length > 0)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div className={`relative flex items-center justify-center shrink-0 overflow-hidden rounded-full border-2 border-slate-100 shadow-sm bg-slate-50 ${className}`}>
      {/* Se cairmos no fallback final, mostramos opcionalmente iniciais de alta legibilidade,
          mas se a imagem de fallback carregar, ela se sobrepõe com elegância */}
      {estagio === "fallback" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-sm select-none">
          {getInitials(nome)}
        </div>
      )}

      <img
        src={src}
        alt={`Foto de ${nome}`}
        onError={handleImageError}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          estagio === "fallback" ? "opacity-0" : "opacity-100"
        }`}
        // Política de referenciador essencial para contornar restrições de domínios cruzados do Google
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

export default FotoCandidato;
