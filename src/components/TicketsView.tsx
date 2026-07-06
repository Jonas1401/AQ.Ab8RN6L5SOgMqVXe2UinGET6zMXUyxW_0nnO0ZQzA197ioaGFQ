import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Calculator, 
  Camera, 
  Upload, 
  Share2, 
  History, 
  Search, 
  Trash2, 
  Plus, 
  Save, 
  Check, 
  TrendingUp, 
  Coins, 
  Package, 
  Info, 
  Sparkles,
  MapPin,
  Calendar,
  X,
  FileText
} from 'lucide-react';
import Tesseract from 'tesseract.js';

// Preprocess image to enhance contrast, sharpness, and correct legibility
const preprocessImageForOCR = (imageSrc: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageSrc);
        return;
      }

      // Scale to max width/height of 1200px for speed and accuracy balance
      const maxDim = 1200;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (maxDim / width) * height;
          width = maxDim;
        } else {
          width = (maxDim / height) * width;
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Enhance contrast and convert to grayscale for OCR optimization
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        // Contrast stretching
        let contrastGray = (gray - 60) * 1.6;
        if (contrastGray < 0) contrastGray = 0;
        if (contrastGray > 255) contrastGray = 255;

        data[i] = contrastGray;
        data[i + 1] = contrastGray;
        data[i + 2] = contrastGray;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      resolve(imageSrc);
    };
  });
};

interface TicketRow {
  quant: number;
  valor: number;
  subtotal: number;
  ponto: string;
}

interface ParsedTicket {
  ponto: string;
  rows: TicketRow[];
  grossTotal: number;
}

// Highly optimized local parser of the OCR-extracted text
export function parseTicketOCR(text: string): ParsedTicket {
  const lines = text.split('\n');
  const rows: TicketRow[] = [];
  
  // Clean text and look for Point Code matches (e.g. A032, B123, C101)
  const pontoRegexGlobal = /\b[A-Za-z][0-9OIsSlZ]{3}\b/g;
  const allPontoMatches = text.match(pontoRegexGlobal) || [];
  
  const cleanedPontos = allPontoMatches.map(p => {
    return p.toUpperCase()
      .replace(/O/g, '0')
      .replace(/I/g, '1')
      .replace(/L/g, '1')
      .replace(/S/g, '5')
      .replace(/Z/g, '2');
  });

  // Find most frequent point code in the ticket
  let detectedPonto = 'Ponto não identificado';
  if (cleanedPontos.length > 0) {
    const counts: Record<string, number> = {};
    cleanedPontos.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    detectedPonto = sorted[0][0];
  }

  // Token parser for Brazilian decimal values
  const parseNumeric = (token: string): number | null => {
    // If the token contains letters that are not allowed OCR numeric misreads, reject it.
    // This perfectly filters out words like "KM", "FRETE", "ATE", "A032", dates with slashes, etc.
    const allowedLetters = /^[0-9.,oOilsSbBzZ\s()\-R$]+$/;
    if (!allowedLetters.test(token)) {
      return null;
    }

    let cleaned = token.replace(/[R$\s()]/g, '');
    
    // Skip if mostly letters
    const digitCount = (cleaned.match(/\d/g) || []).length;
    const letterCount = (cleaned.match(/[a-zA-Z]/g) || []).length;
    if (letterCount > digitCount && letterCount > 2) {
      return null;
    }

    // Common OCR letter misreads -> numbers
    cleaned = cleaned
      .replace(/O/g, '0')
      .replace(/o/g, '0')
      .replace(/I/g, '1')
      .replace(/l/g, '1')
      .replace(/S/g, '5')
      .replace(/s/g, '5')
      .replace(/B/g, '8')
      .replace(/Z/g, '2');

    cleaned = cleaned.replace(/[^0-9.,]/g, '');
    if (!cleaned) return null;

    cleaned = cleaned.replace(/,/g, '.');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      const last = parts.pop();
      cleaned = parts.join('') + '.' + last;
    }

    const val = parseFloat(cleaned);
    return isNaN(val) ? null : val;
  };

  lines.forEach(line => {
    const lowerLine = line.toLowerCase();
    // Ignore meta/administrative rows
    if (
      lowerLine.includes('emissão') ||
      lowerLine.includes('periodo') ||
      lowerLine.includes('período') ||
      lowerLine.includes('motorista') ||
      lowerLine.includes('total geral') ||
      lowerLine.includes('via de tickets') ||
      lowerLine.includes('serviço') ||
      lowerLine.includes('hora') ||
      lowerLine.includes('data') ||
      lowerLine.includes('total:')
    ) {
      return;
    }

    // Tokenize line
    const tokens = line.split(/\s+/).filter(t => t.trim().length > 0);
    // Ignore date/time tokens
    const filteredTokens = tokens.filter(t => !t.includes('/') && !t.includes(':'));

    // Check for row-level point
    let rowPonto = detectedPonto !== 'Ponto não identificado' ? detectedPonto : '';
    const pontoRegexRow = /[A-Za-z][0-9OIsSlZ]{3}/;
    
    const pontoTokenIdx = filteredTokens.findIndex(t => {
      return pontoRegexRow.test(t);
    });

    if (pontoTokenIdx !== -1) {
      const match = filteredTokens[pontoTokenIdx].match(pontoRegexRow);
      if (match) {
        rowPonto = match[0].toUpperCase()
          .replace(/O/g, '0')
          .replace(/I/g, '1')
          .replace(/L/g, '1')
          .replace(/S/g, '5')
          .replace(/Z/g, '2');
      }
      filteredTokens.splice(pontoTokenIdx, 1);
    }

    // Identify numerical columns
    const rowNumbers: number[] = [];
    filteredTokens.forEach(t => {
      const num = parseNumeric(t);
      if (num !== null && num > 0) {
        rowNumbers.push(num);
      }
    });

    // Need Quant and Valor
    if (rowNumbers.length >= 2) {
      let quant = rowNumbers[0];
      let valor = rowNumbers[1];

      // Smart conversion heuristics for weights (Tons) missing decimal dot
      if (quant >= 1000 && quant <= 100000) {
        quant = quant / 1000;
      }
      
      // Smart conversion heuristics for price value missing decimal point
      const valToken = tokens.find(t => t.includes(String(rowNumbers[1])) || t.includes(String(rowNumbers[1]).replace('.', ',')));
      if (valor >= 100 && valToken && !valToken.includes('.') && !valToken.includes(',')) {
        valor = valor / 100;
      }

      const subtotal = Number((quant * valor).toFixed(2));

      rows.push({
        quant,
        valor,
        subtotal,
        ponto: rowPonto || detectedPonto
      });
    }
  });

  const grossTotal = Number(rows.reduce((acc, row) => acc + row.subtotal, 0).toFixed(2));

  return {
    ponto: detectedPonto,
    rows,
    grossTotal
  };
}

interface HistoryItem {
  id: string;
  createdAt: string;
  ponto: string;
  grossTotal: number;
  percentage: number;
  driverGain: number;
  rows: TicketRow[];
}

interface TicketsViewProps {
  userId: string;
  userName: string;
  userAvatar: string;
  onBack: () => void;
}

export default function TicketsView({ userId, userName, userAvatar, onBack }: TicketsViewProps) {
  // Saved states
  const [percentage, setPercentage] = useState<number>(19);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Processing states
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrStatusText, setOcrStatusText] = useState('');
  
  // Active calculation results
  const [activeCalculation, setActiveCalculation] = useState<ParsedTicket | null>(null);
  const [pontoOverride, setPontoOverride] = useState<string>('');
  
  // Custom manual entry inputs
  const [manualQuant, setManualQuant] = useState('');
  const [manualValor, setManualValor] = useState('');
  const [manualPonto, setManualPonto] = useState('');

  // Modals / Details views
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load percentage & history on mount
  useEffect(() => {
    // 1. Percentage
    const savedPct = localStorage.getItem('motorista-percentage-v1');
    if (savedPct) {
      setPercentage(parseFloat(savedPct));
    }

    // 2. History
    const savedHist = localStorage.getItem('ganho-motorista-historico-v1');
    if (savedHist) {
      try {
        setHistory(JSON.parse(savedHist));
      } catch (err) {
        console.error('Erro ao decodificar histórico:', err);
      }
    }
  }, []);

  // Sync percentage updates
  const handleUpdatePercentage = (newVal: number) => {
    setPercentage(newVal);
    localStorage.setItem('motorista-percentage-v1', String(newVal));
  };

  // Toast notifier
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Preprocess image and run local Tesseract OCR
  const handleImageOCR = async (file: File) => {
    setIsProcessing(true);
    setOcrProgress(0);
    setOcrStatusText('Aprimorando nitidez e contraste...');
    setActiveCalculation(null);

    try {
      const base64Img = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
      });

      setImage(base64Img);

      // Enhance the image using HTML5 Canvas
      const optimizedImg = await preprocessImageForOCR(base64Img);

      setOcrStatusText('Carregando OCR local de alta precisão...');
      
      // Execute local Tesseract OCR
      const result = await Tesseract.recognize(
        optimizedImg,
        'por',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100));
              setOcrStatusText(`Buscando colunas: Quant, Valor, Ponto... (${Math.round(m.progress * 100)}%)`);
            }
          }
        }
      );

      const ocrText = result.data.text;
      console.log('--- OCR OUTPUT ---');
      console.log(ocrText);

      // Parse text to extract columns
      const parsed = parseTicketOCR(ocrText);

      if (parsed.rows.length === 0) {
        setOcrStatusText('Nenhuma linha de ticket localizada. Tente enviar outra foto.');
        setIsProcessing(false);
        showToast('Nenhuma carga identificada. Você pode adicionar manualmente!');
        // Initialize an empty parsed ticket to allow manual edits
        setActiveCalculation({
          ponto: 'Ponto não identificado',
          rows: [],
          grossTotal: 0
        });
        setPontoOverride('Ponto não identificado');
        return;
      }

      setActiveCalculation(parsed);
      setPontoOverride(parsed.ponto);
      
      // Auto-save this calculation to local history
      const driverGain = Number((parsed.grossTotal * (percentage / 100)).toFixed(2));
      const newItem: HistoryItem = {
        id: `calc-${Date.now()}`,
        createdAt: new Date().toLocaleString('pt-BR'),
        ponto: parsed.ponto,
        grossTotal: parsed.grossTotal,
        percentage,
        driverGain,
        rows: parsed.rows
      };

      const updatedHistory = [newItem, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('ganho-motorista-historico-v1', JSON.stringify(updatedHistory));

      setIsProcessing(false);
      showToast('Cargas e ponto identificados com sucesso! Salvo no histórico.');

    } catch (err) {
      console.error('Erro no processamento do OCR:', err);
      setIsProcessing(false);
      showToast('Erro ao ler imagem. Adicione as cargas manualmente abaixo.');
      
      // Fallback empty calculation so user isn't stuck
      setActiveCalculation({
        ponto: 'Ponto não identificado',
        rows: [],
        grossTotal: 0
      });
      setPontoOverride('Ponto não identificado');
    }
  };

  // Add a manual charge row
  const handleAddManualRow = () => {
    const q = parseFloat(manualQuant.replace(',', '.'));
    const v = parseFloat(manualValor.replace(',', '.'));
    if (isNaN(q) || isNaN(v)) {
      showToast('Por favor, informe valores válidos para Quantidade e Valor.');
      return;
    }

    const rowPonto = manualPonto.trim().toUpperCase() || pontoOverride || 'Ponto não identificado';
    const subtotal = Number((q * v).toFixed(2));
    const newRow: TicketRow = {
      quant: q,
      valor: v,
      subtotal,
      ponto: rowPonto
    };

    let updatedCalc: ParsedTicket;
    if (activeCalculation) {
      const updatedRows = [...activeCalculation.rows, newRow];
      const updatedGross = Number(updatedRows.reduce((acc, r) => acc + r.subtotal, 0).toFixed(2));
      
      updatedCalc = {
        ponto: pontoOverride || rowPonto,
        rows: updatedRows,
        grossTotal: updatedGross
      };
    } else {
      updatedCalc = {
        ponto: rowPonto,
        rows: [newRow],
        grossTotal: subtotal
      };
      setPontoOverride(rowPonto);
    }

    setActiveCalculation(updatedCalc);
    setManualQuant('');
    setManualValor('');
    setManualPonto('');

    // Update history auto-save or prepare for save
    saveCalculationToHistory(updatedCalc);
    showToast('Carga adicionada com sucesso!');
  };

  // Helper to re-save current active calculation to history
  const saveCalculationToHistory = (calc: ParsedTicket) => {
    const driverGain = Number((calc.grossTotal * (percentage / 100)).toFixed(2));
    
    // Check if there is already an item in history with the exact same row structure or timestamp
    // Since we auto-saved on OCR start, we can update the last item if it's within 1 minute,
    // or simply create/append a new history record to prevent data loss.
    const newItem: HistoryItem = {
      id: `calc-${Date.now()}`,
      createdAt: new Date().toLocaleString('pt-BR'),
      ponto: pontoOverride || calc.ponto,
      grossTotal: calc.grossTotal,
      percentage,
      driverGain,
      rows: calc.rows
    };

    const updatedHistory = [newItem, ...history.filter(item => {
      // Deduplicate ultra-recent same-value entries to prevent cluttering
      const diffMs = Date.now() - parseInt(item.id.replace('calc-', ''));
      return !(diffMs < 30000 && item.grossTotal === calc.grossTotal);
    })];

    setHistory(updatedHistory);
    localStorage.setItem('ganho-motorista-historico-v1', JSON.stringify(updatedHistory));
  };

  // Remove individual row from active calculation
  const handleRemoveRow = (index: number) => {
    if (!activeCalculation) return;

    const updatedRows = activeCalculation.rows.filter((_, idx) => idx !== index);
    const updatedGross = Number(updatedRows.reduce((acc, r) => acc + r.subtotal, 0).toFixed(2));
    
    const updatedCalc = {
      ...activeCalculation,
      rows: updatedRows,
      grossTotal: updatedGross
    };

    setActiveCalculation(updatedCalc);
    saveCalculationToHistory(updatedCalc);
    showToast('Carga removida.');
  };

  // Format Helper: Real BRL
  const formatBRL = (val: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  // Format Helper: Tons Number
  const formatTons = (val: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(val);
  };

  // Generate shareable message text
  const generateShareMessage = (pontoCode: string, gross: number, pct: number, net: number, rowsCount: number) => {
    return `🚛 *Frete Fácil*
📍 *Ponto:* ${pontoCode}
📦 *Frete Bruto:* ${formatBRL(gross)}
📈 *Comissão:* ${pct}%
💰 *Ganho Líquido:* ${formatBRL(net)}
⏱️ _Calculado automaticamente de ${rowsCount} cargas._`;
  };

  // Share action
  const handleShare = (pontoCode: string, gross: number, pct: number, net: number, rowsCount: number) => {
    const text = generateShareMessage(pontoCode, gross, pct, net, rowsCount);
    
    if (navigator.share) {
      navigator.share({
        title: 'Cálculo de Frete - Porto Fácil',
        text: text,
      }).catch(err => {
        console.warn('Erro ao compartilhar:', err);
        // Fallback to clipboard
        navigator.clipboard.writeText(text);
        showToast('Texto copiado para a área de transferência!');
      });
    } else {
      navigator.clipboard.writeText(text);
      showToast('Mensagem de compartilhamento copiada!');
    }
  };

  // Delete from history
  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = history.filter(item => item.id !== id);
    setHistory(filtered);
    localStorage.setItem('ganho-motorista-historico-v1', JSON.stringify(filtered));
    showToast('Cálculo apagado do histórico.');
    if (selectedHistoryItem?.id === id) {
      setSelectedHistoryItem(null);
    }
  };

  // Search logic
  const filteredHistory = history.filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      item.ponto.toLowerCase().includes(query) ||
      item.createdAt.toLowerCase().includes(query) ||
      formatBRL(item.driverGain).toLowerCase().includes(query) ||
      formatBRL(item.grossTotal).toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-[#030914] text-gray-200 font-sans pb-16 relative">
      
      {/* GLOWING BACKGROUND AMBIENCE */}
      <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-[#00A2FF]/10 to-transparent pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-[#00A2FF]/5 rounded-full filter blur-[100px] pointer-events-none" />

      {/* TOP BAR */}
      <header className="sticky top-0 bg-[#020712]/90 backdrop-blur-md border-b border-white/10 px-4 py-4.5 flex items-center gap-3 z-30">
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-base font-bold text-white flex items-center gap-2 tracking-wide">
            <Calculator size={18} className="text-[#00A2FF] filter drop-shadow-[0_0_6px_#00A2FF]" />
            Cálculo de Tickets
          </h1>
          <p className="text-[10px] text-gray-400">Leitor OCR inteligente de cargas e frete</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 bg-[#00A2FF]/10 px-2.5 py-1 rounded-full border border-[#00A2FF]/20">
          <Sparkles size={11} className="text-[#00A2FF] animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#00A2FF]">Local AI</span>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-md mx-auto p-4 flex flex-col gap-5 relative z-10">

        {/* DRIVER COMMISSION CONFIGURATION */}
        <section className="bg-[#051124]/15 backdrop-blur-xl border border-[#00A2FF]/20 rounded-2xl p-4 shadow-[0_0_15px_rgba(0,162,255,0.05)] relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#00A2FF]/5 rounded-full filter blur-xl pointer-events-none" />
          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#00A2FF]/10 border border-[#00A2FF]/30 flex items-center justify-center text-[#00A2FF] shadow-[0_0_10px_rgba(0,162,255,0.2)]">
                <TrendingUp size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Porcentagem do Motorista</h3>
                <p className="text-[10px] text-gray-400">Salvo automaticamente no celular</p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-[#020712] border border-white/10 rounded-xl px-2 py-1">
              <input 
                type="number"
                value={percentage}
                onChange={(e) => handleUpdatePercentage(Number(e.target.value))}
                className="w-10 text-right bg-transparent text-sm font-bold text-white focus:outline-none"
                placeholder="19"
                min="0"
                max="100"
              />
              <span className="text-xs font-bold text-gray-400">%</span>
            </div>
          </div>
        </section>

        {/* SCAN / CAPTURE CONTAINER */}
        <section className="bg-[#051124]/15 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex flex-col gap-4 text-center relative overflow-hidden shadow-lg">
          <div className="flex flex-col items-center justify-center py-3">
            <div className="w-16 h-16 rounded-2xl bg-[#00A2FF]/5 border border-[#00A2FF]/20 flex items-center justify-center text-[#00A2FF] mb-3 relative group-hover:scale-110 transition">
              <FileText size={28} className="filter drop-shadow-[0_0_8px_rgba(0,162,255,0.4)]" />
              <div className="absolute inset-0 rounded-2xl border border-[#00A2FF]/20 animate-ping pointer-events-none opacity-40" />
            </div>
            <h2 className="text-sm font-bold text-white">Importar Ticket de Cargas</h2>
            <p className="text-xs text-gray-400 mt-1 max-w-[280px]">Envie uma imagem do ticket impresso da sua galeria para ler os dados na hora.</p>
          </div>

          <div className="flex flex-col">
            {/* Escolher Galeria */}
            <label className="flex flex-col items-center gap-1.5 p-4 bg-gradient-to-b from-[#00A2FF]/10 to-[#00A2FF]/5 hover:from-[#00A2FF]/15 hover:to-[#00A2FF]/10 border border-[#00A2FF]/30 hover:border-[#00A2FF]/50 active:scale-95 transition rounded-2xl cursor-pointer text-[#00A2FF]">
              <Upload size={22} className="filter drop-shadow-[0_0_4px_#00A2FF]" />
              <span className="text-xs font-extrabold tracking-wide uppercase">Escolher da Galeria</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageOCR(file);
                }}
              />
            </label>
          </div>
        </section>

        {/* OCR PROCESSING LOADING ANIMATION */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-[#051124]/15 backdrop-blur-xl border border-[#00A2FF]/30 rounded-2xl p-5 overflow-hidden flex flex-col gap-3 relative shadow-2xl"
            >
              {/* Fake Scan Laser Line Effect */}
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#00A2FF] to-transparent animate-pulse filter blur-[1px]" style={{
                animation: 'scan 2s ease-in-out infinite'
              }} />

              <style>{`
                @keyframes scan {
                  0% { top: 10%; opacity: 0.2; }
                  50% { top: 90%; opacity: 1; }
                  100% { top: 10%; opacity: 0.2; }
                }
              `}</style>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[#00A2FF] border-t-transparent animate-spin shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider animate-pulse">Lendo Ticket...</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{ocrStatusText}</p>
                </div>
                <span className="text-xs font-mono font-bold text-[#00A2FF]">{ocrProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-[#00A2FF] transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ACTIVE CALCULATION / OCR RESULT */}
        {activeCalculation && (
          <motion.section 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#051124]/15 backdrop-blur-xl border border-[#00A2FF]/30 rounded-3xl p-5 flex flex-col gap-5 relative overflow-hidden shadow-[0_0_25px_rgba(0,162,255,0.1)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#00A2FF]/10 border border-[#00A2FF]/30 flex items-center justify-center text-[#00A2FF]">
                  <MapPin size={14} />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Código do Ponto</label>
                  <input 
                    type="text"
                    value={pontoOverride}
                    onChange={(e) => {
                      setPontoOverride(e.target.value);
                      const updated = { ...activeCalculation, ponto: e.target.value };
                      setActiveCalculation(updated);
                      saveCalculationToHistory(updated);
                    }}
                    className="bg-transparent text-sm font-extrabold text-white focus:outline-none border-b border-dashed border-white/20 focus:border-[#00A2FF] py-0.5 w-32 uppercase"
                    placeholder="Ex: A032"
                  />
                </div>
              </div>
              
              <button
                onClick={() => {
                  setActiveCalculation(null);
                  setImage(null);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Core Stats Bento-style */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#030914]/80 p-3 rounded-2xl border border-white/5 flex flex-col justify-between">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Frete Bruto</span>
                <span className="text-xs font-black text-white mt-1">{formatBRL(activeCalculation.grossTotal)}</span>
              </div>
              <div className="bg-[#030914]/80 p-3 rounded-2xl border border-white/5 flex flex-col justify-between">
                <span className="text-[8px] font-bold text-[#00A2FF] uppercase tracking-wider block">Comissão ({percentage}%)</span>
                <span className="text-xs font-black text-[#00A2FF] mt-1">{formatBRL(activeCalculation.grossTotal * (percentage / 100))}</span>
              </div>
              <div className="bg-[#030914]/80 p-3 rounded-2xl border border-[#00A2FF]/30 flex flex-col justify-between shadow-[0_0_10px_rgba(0,162,255,0.05)]">
                <span className="text-[8px] font-bold text-green-400 uppercase tracking-wider block">Líquido</span>
                <span className="text-xs font-black text-green-400 mt-1">{formatBRL(activeCalculation.grossTotal * (percentage / 100))}</span>
              </div>
            </div>

            {/* TABLE OF CARGO ROWS */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Package size={12} className="text-[#00A2FF]" />
                  Cargas Identificadas ({activeCalculation.rows.length})
                </h4>
              </div>
              
              <div className="bg-[#030914]/50 rounded-2xl border border-white/5 overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-[8px] font-bold text-gray-400 uppercase tracking-wider bg-[#020712]/50">
                      <th className="py-2.5 px-3">Quant (Tons)</th>
                      <th className="py-2.5 px-3">Valor (R$)</th>
                      <th className="py-2.5 px-3">Subtotal</th>
                      <th className="py-2.5 px-3">Ganho Ind. ({percentage}%)</th>
                      <th className="py-2.5 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCalculation.rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-white/5 text-xs hover:bg-white/5 transition">
                        <td className="py-2.5 px-3 font-mono font-medium text-white">{formatTons(row.quant)}</td>
                        <td className="py-2.5 px-3 font-mono text-gray-300">{formatBRL(row.valor)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#00A2FF]">{formatBRL(row.subtotal)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-green-400">{formatBRL(row.subtotal * (percentage / 100))}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button 
                            onClick={() => handleRemoveRow(idx)}
                            className="w-6 h-6 inline-flex items-center justify-center rounded-lg bg-red-600/10 border border-red-600/20 text-red-400 hover:bg-red-600/20 active:scale-95 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {activeCalculation.rows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-[10px] text-gray-500 italic">
                          Nenhuma carga na lista. Adicione abaixo!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MANUAL ENTRY ROW CREATOR */}
            <div className="bg-[#030914]/80 p-3.5 rounded-2xl border border-white/5 flex flex-col gap-2.5">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Adicionar Nova Carga</span>
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="text"
                  value={manualQuant}
                  onChange={(e) => setManualQuant(e.target.value)}
                  placeholder="Quant (Ex: 34.58)"
                  className="bg-[#020712] border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white placeholder-gray-600 focus:outline-none focus:border-[#00A2FF] transition"
                />
                <input 
                  type="text"
                  value={manualValor}
                  onChange={(e) => setManualValor(e.target.value)}
                  placeholder="Preço (Ex: 17.93)"
                  className="bg-[#020712] border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white placeholder-gray-600 focus:outline-none focus:border-[#00A2FF] transition"
                />
              </div>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={manualPonto}
                  onChange={(e) => setManualPonto(e.target.value)}
                  placeholder="Ponto Opcional (Ex: A032)"
                  className="flex-1 bg-[#020712] border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white placeholder-gray-600 focus:outline-none focus:border-[#00A2FF] transition uppercase"
                />
                <button
                  onClick={handleAddManualRow}
                  className="px-4 bg-[#00A2FF] hover:bg-[#008fe0] active:scale-95 transition text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer shadow-lg shadow-[#00A2FF]/20 shrink-0"
                >
                  <Plus size={14} />
                  Incluir
                </button>
              </div>
            </div>

            {/* Action buttons (Share & Recalculate) */}
            <div className="grid grid-cols-1 gap-2 pt-2 border-t border-white/5">
              <button
                onClick={() => handleShare(
                  pontoOverride || activeCalculation.ponto,
                  activeCalculation.grossTotal,
                  percentage,
                  activeCalculation.grossTotal * (percentage / 100),
                  activeCalculation.rows.length
                )}
                className="w-full py-3 bg-[#00A2FF] hover:bg-[#008fe0] text-black font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer shadow-lg shadow-[#00A2FF]/15 uppercase tracking-wide"
              >
                <Share2 size={15} />
                Compartilhar Resultado
              </button>
            </div>
          </motion.section>
        )}

        {/* LOGS & HISTORY LIST WITH SEARCH */}
        <section className="bg-[#051124]/15 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-white flex items-center gap-2">
              <History size={14} className="text-[#00A2FF]" />
              Histórico de Cálculos
            </h3>
            <span className="text-[10px] bg-white/5 border border-white/10 text-gray-400 font-bold px-2 py-0.5 rounded-md">
              {history.length} salvos
            </span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por ponto, data ou valor..."
              className="w-full bg-[#020712] border border-white/5 focus:border-[#00A2FF]/40 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none transition"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto pr-1">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedHistoryItem(item)}
                className="bg-[#030914]/15 backdrop-blur-xl hover:bg-[#051124]/15 border border-white/5 hover:border-[#00A2FF]/30 p-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-white px-1.5 py-0.5 bg-[#00A2FF]/15 text-[#00A2FF] rounded">
                      {item.ponto}
                    </span>
                    <span className="text-[9px] text-gray-500 truncate">{item.createdAt.split(' ')[0]}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div>
                      <span className="text-[8px] text-gray-500 block uppercase font-bold">Total Bruto</span>
                      <span className="text-xs font-semibold text-gray-300">{formatBRL(item.grossTotal)}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-green-500/80 block uppercase font-bold">Líquido ({item.percentage}%)</span>
                      <span className="text-xs font-bold text-green-400">{formatBRL(item.driverGain)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-bold bg-[#020712] px-2 py-1 rounded-lg border border-white/5">
                    {item.rows.length} {item.rows.length === 1 ? 'carga' : 'cargas'}
                  </span>
                  
                  <button
                    onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-600/5 hover:bg-red-600/15 border border-red-600/10 text-red-500/70 hover:text-red-400 transition cursor-pointer"
                    title="Excluir"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}

            {filteredHistory.length === 0 && (
              <div className="py-10 text-center flex flex-col items-center justify-center gap-2">
                <FileText size={24} className="text-gray-700" />
                <p className="text-xs text-gray-500 italic">Nenhum cálculo registrado.</p>
              </div>
            )}
          </div>
        </section>

      </main>

      {/* DETAILED SUMMARY MODAL (RESUMO DETALHADO) */}
      <AnimatePresence>
        {selectedHistoryItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#051124] border border-[#00A2FF]/30 rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl relative shadow-[#00A2FF]/10"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-[#020712]/80">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                    <Info size={14} className="text-[#00A2FF]" />
                    Resumo Detalhado
                  </h3>
                  <p className="text-[9px] text-gray-500 mt-0.5">{selectedHistoryItem.createdAt}</p>
                </div>
                <button
                  onClick={() => setSelectedHistoryItem(null)}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 flex flex-col gap-4">
                
                {/* Visual grid metrics */}
                <div className="grid grid-cols-2 gap-2 bg-[#020712] p-3.5 rounded-2xl border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest">📍 Ponto</span>
                    <span className="text-sm font-bold text-white mt-0.5">{selectedHistoryItem.ponto}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest">⏱️ Viagens</span>
                    <span className="text-sm font-bold text-[#00A2FF] mt-0.5">{selectedHistoryItem.rows.length} cargas</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-[#030914] px-4 py-2.5 rounded-xl border border-white/5">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">📦 Frete Bruto</span>
                    <span className="text-xs font-bold text-white">{formatBRL(selectedHistoryItem.grossTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-[#030914] px-4 py-2.5 rounded-xl border border-white/5">
                    <span className="text-xs text-[#00A2FF] font-bold uppercase tracking-wider">📈 Comissão ({selectedHistoryItem.percentage}%)</span>
                    <span className="text-xs font-extrabold text-[#00A2FF]">{formatBRL(selectedHistoryItem.grossTotal * (selectedHistoryItem.percentage / 100))}</span>
                  </div>
                  <div className="flex justify-between items-center bg-[#00A2FF]/10 px-4 py-3 rounded-xl border border-[#00A2FF]/30">
                    <span className="text-xs text-green-400 font-black uppercase tracking-wider">💰 Ganho Líquido</span>
                    <span className="text-sm font-black text-green-400">{formatBRL(selectedHistoryItem.driverGain)}</span>
                  </div>
                </div>

                {/* Sublist of rows */}
                <div>
                  <span className="text-[10px] font-extrabold text-white uppercase tracking-widest block mb-2">Lista de Carga</span>
                  <div className="bg-[#020712] rounded-2xl border border-white/5 overflow-hidden max-h-40 overflow-y-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-[#030914] text-[8px] font-bold text-gray-500 uppercase tracking-wider border-b border-white/5">
                          <th className="py-2 px-3">Quant</th>
                          <th className="py-2 px-3">Preço</th>
                          <th className="py-2 px-3">Subtotal</th>
                          <th className="py-2 px-3 text-right">Ganho Ind.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedHistoryItem.rows.map((r, i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition">
                            <td className="py-2 px-3 font-mono text-white">{formatTons(r.quant)} t</td>
                            <td className="py-2 px-3 font-mono text-gray-400">{formatBRL(r.valor)}</td>
                            <td className="py-2 px-3 font-mono font-bold text-[#00A2FF]">{formatBRL(r.subtotal)}</td>
                            <td className="py-2 px-3 font-mono text-right font-bold text-green-400">{formatBRL(r.subtotal * (selectedHistoryItem.percentage / 100))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Share within detail */}
                <button
                  onClick={() => handleShare(
                    selectedHistoryItem.ponto,
                    selectedHistoryItem.grossTotal,
                    selectedHistoryItem.percentage,
                    selectedHistoryItem.driverGain,
                    selectedHistoryItem.rows.length
                  )}
                  className="w-full mt-2 py-3 bg-[#00A2FF] hover:bg-[#008fe0] text-black font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-lg shadow-[#00A2FF]/20 uppercase tracking-widest"
                >
                  <Share2 size={14} />
                  Compartilhar Resumo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOAST NOTIFIER */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 inset-x-4 max-w-sm mx-auto bg-[#020712] border border-[#00A2FF]/50 text-white font-semibold text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-50 shadow-[#00A2FF]/10"
          >
            <div className="w-2 h-2 rounded-full bg-[#00A2FF] animate-ping" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
