import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Anchor, 
  ArrowLeft, 
  RefreshCw, 
  TrendingDown, 
  Layers, 
  HelpCircle, 
  Database, 
  AlertTriangle, 
  CheckCircle2, 
  Compass, 
  Clock,
  Info
} from 'lucide-react';

interface Operator {
  name: string;
  saldo: string;
}

interface VesselData {
  berth: string;
  vessel: string;
  product: string;
  vesselSaldo: string;
  operators: Operator[];
}

interface AppaViewProps {
  onBack: () => void;
}

export default function AppaView({ onBack }: AppaViewProps) {
  const [data, setData] = useState<VesselData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [source, setSource] = useState<string>('local_cheerio');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/appa');
      if (!res.ok) {
        throw new Error('Não foi possível conectar ao servidor de monitoramento.');
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        // Sort by berth number ascending
        const sorted = [...json.data].sort((a, b) => {
          const numA = parseInt(a.berth, 10);
          const numB = parseInt(b.berth, 10);
          if (isNaN(numA)) return 1;
          if (isNaN(numB)) return -1;
          return numA - numB;
        });
        setData(sorted);
        setSource(json.source || 'local_cheerio');
        setLastUpdated(new Date().toLocaleTimeString('pt-BR'));
      } else {
        throw new Error(json.error || 'Erro ao processar lineup portuário.');
      }
    } catch (err: any) {
      console.error('[AppaView Error]:', err);
      setError(err.message || 'Erro inesperado ao buscar dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getBerthLocation = (berthStr: string) => {
    const num = parseInt(berthStr, 10);
    if (num === 201) return 'Antonina';
    if (num >= 202 && num <= 215) return 'Paranaguá';
    return 'Desconhecido';
  };

  return (
    <div className="min-h-screen bg-[#07111F] text-white font-sans relative overflow-hidden pb-12">
      {/* Background decorations */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-sky-500/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-orange-500/5 rounded-full filter blur-[100px] pointer-events-none" />

      {/* Header Bar */}
      <header className="sticky top-0 z-50 bg-[#07111F]/80 backdrop-blur-md border-b border-white/5 px-4 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              id="appa-back-btn"
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white transition-all flex items-center justify-center shrink-0"
              title="Voltar ao Painel"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h1 className="text-sm sm:text-base font-extrabold tracking-wider text-white uppercase">
                  MONITORAMENTO APPA
                </h1>
              </div>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
                Navios de Fertilizantes Atracados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastUpdated && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 text-[10px] font-medium">
                <Clock size={12} />
                <span>Atualizado: {lastUpdated}</span>
              </div>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              id="appa-refresh-btn"
              className="px-3 py-1.5 sm:py-2 rounded-xl bg-[var(--pc-primary)]/10 hover:bg-[var(--pc-primary)]/20 border border-[var(--pc-primary)]/30 hover:border-[var(--pc-primary)] text-[var(--pc-primary)] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-[0_0_10px_var(--pc-glow)] cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span className="hidden xs:inline">Atualizar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 mt-6">
        
        {/* Source and constraints Banner */}
        <div className="bg-[#0b1c30]/95 border border-sky-500/20 rounded-2xl p-4 mb-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-1 bg-sky-500/10 text-sky-400 text-[9px] font-bold uppercase tracking-wider rounded-bl-xl border-l border-b border-sky-500/15">
            Canal Direto
          </div>
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Database size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">FONTE DE DADOS OFICIAL</h3>
              <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
                Dados coletados diretamente em tempo real do Line-Up Retroativo da APPA (<span className="text-sky-400 font-mono text-[10px] select-all">https://www.appaweb.appa.pr.gov.br</span>).
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5 pt-2 border-t border-white/5">
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <span className="text-orange-400 font-bold">•</span> Seção: <strong className="text-gray-200">ATRACADOS</strong>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <span className="text-orange-400 font-bold">•</span> Berços: <strong className="text-gray-200">201 a 215</strong>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <span className="text-orange-400 font-bold">•</span> Carga: <strong className="text-gray-200">Fertilizantes</strong>
                </div>
                {source && (
                  <div className="flex items-center gap-1 text-[10px] text-sky-400 font-mono ml-auto">
                    [Extrator: {source === 'gemini_ai' ? 'IA Gemini 3.5' : 'Filtro Local'}]
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-16 flex flex-col items-center justify-center text-center"
            >
              <div className="relative flex items-center justify-center mb-4">
                <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
                <Anchor size={24} className="absolute text-orange-400 animate-pulse" />
              </div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider animate-pulse">
                Consultando Line-Up Retroativo
              </h4>
              <p className="text-xs text-gray-400 mt-2 max-w-xs leading-relaxed">
                Acessando diretamente o site oficial da APPA e processando os navios de fertilizantes. Por favor, aguarde...
              </p>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center my-8 flex flex-col items-center justify-center gap-3"
            >
              <AlertTriangle size={32} className="text-red-400" />
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Falha de Conexão</h4>
                <p className="text-xs text-red-300 mt-1.5 max-w-md mx-auto leading-relaxed">
                  {error}
                </p>
              </div>
              <button
                onClick={fetchData}
                className="mt-2 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw size={13} />
                Tentar Novamente
              </button>
            </motion.div>
          ) : data.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 px-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center flex flex-col items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-gray-400 mb-4">
                <Compass size={24} className="animate-spin" style={{ animationDuration: '20s' }} />
              </div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Nenhum Navio Encontrado</h4>
              <p className="text-xs text-gray-400 mt-2 max-w-md leading-relaxed">
                Não há navios da cadeia de fertilizantes atracados nos berços monitorados (201 a 215) no momento da consulta.
              </p>
              <button
                onClick={fetchData}
                className="mt-4 px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw size={12} />
                Checar Novamente
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  Navios Monitorados ({data.length})
                </p>
                <span className="text-[9px] text-gray-500 font-mono uppercase">
                  Filtro Ativo: Berços 201-215
                </span>
              </div>

              {data.map((vessel, idx) => (
                <motion.div
                  key={`${vessel.berth}-${vessel.vessel}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-[#030914]/15 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 shadow-lg hover:border-orange-500/30 transition-all flex flex-col gap-4 overflow-hidden relative group"
                >
                  {/* Decorative border accent */}
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-orange-500 to-amber-500 opacity-70" />

                  {/* Top line: Berth Badge & Vessel Name */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 pl-2">
                    <div className="flex items-center gap-2.5">
                      <div className="px-3 py-1 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-extrabold tracking-wider shadow-[0_0_8px_rgba(249,115,22,0.15)] flex flex-col items-center justify-center min-w-[70px]">
                        <span className="text-[9px] font-semibold text-orange-500/75 uppercase tracking-normal">Berço</span>
                        <span className="text-sm font-black leading-none mt-0.5">{vessel.berth}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm sm:text-base font-black text-white uppercase tracking-wider group-hover:text-orange-400 transition-colors">
                            {vessel.vessel}
                          </h4>
                        </div>
                        <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                          Terminal: {getBerthLocation(vessel.berth)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <div className="px-2.5 py-1 rounded-lg bg-sky-500/5 border border-sky-500/20 text-sky-400 text-[10px] font-bold uppercase tracking-wider">
                        {vessel.product}
                      </div>
                    </div>
                  </div>

                  {/* Middle Line: Total Balance info */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3 border-t border-white/5 pl-2">
                    <div className="sm:col-span-4 bg-white/[0.02] border border-white/5 rounded-xl p-2.5 flex flex-col justify-center">
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider leading-none">
                        Saldo Final do Navio
                      </span>
                      <span className="text-sm font-extrabold text-white mt-1 font-mono tracking-tight">
                        {vessel.vesselSaldo || 'N/A'}
                      </span>
                    </div>

                    {/* Operators sub-list */}
                    <div className="sm:col-span-8 bg-white/[0.01] border border-white/5 rounded-xl p-2.5">
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider leading-none flex items-center gap-1">
                        <Layers size={10} /> Operadoras Associadas
                      </span>
                      <div className="mt-2 space-y-1.5">
                        {vessel.operators.length === 0 ? (
                          <p className="text-[10px] text-gray-500 italic">Nenhuma operadora listada no momento.</p>
                        ) : (
                          vessel.operators.map((op, opIdx) => (
                            <div 
                              key={`${op.name}-${opIdx}`}
                              className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all"
                            >
                              <span className="font-bold text-gray-200">{op.name}</span>
                              <span className="font-semibold text-amber-400 font-mono">{op.saldo}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                </motion.div>
              ))}

              {/* Informative footer note */}
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex gap-2.5 items-start mt-6">
                <Info size={14} className="text-gray-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  As informações exibidas neste painel representam os navios atracados operando fertilizantes. Os saldos e operadoras são obtidos diretamente da APPA, atualizando o saldo final conforme a operação se desenrola no porto. O sistema de monitoramento não armazena em cache dados antigos, garantindo a visualização da realidade operacional do porto.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
