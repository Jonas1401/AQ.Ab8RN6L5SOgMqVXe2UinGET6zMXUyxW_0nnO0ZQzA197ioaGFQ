import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Phone, 
  Search, 
  Copy, 
  Check, 
  Shield, 
  Flame, 
  HeartPulse, 
  Skull, 
  AlertTriangle, 
  EyeOff, 
  UserCheck, 
  MapPin, 
  Info,
  HelpCircle,
  Siren
} from 'lucide-react';

interface EmergencyContact {
  id: string;
  name: string;
  number: string;
  description: string;
  examples: string[];
  color: string;
  glowColor: string;
  bgGradient: string;
  borderColor: string;
  icon: React.ElementType;
  tags: string[];
}

interface EmergencyViewProps {
  onBack: () => void;
}

const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    id: 'samu',
    name: 'SAMU',
    number: '192',
    description: 'Urgências e emergências médicas com risco de vida.',
    examples: ['Infartos', 'Derrame (AVC)', 'Acidentes graves', 'Crises convulsivas', 'Falta de ar grave'],
    color: '#EF4444', // Red
    glowColor: 'rgba(239, 68, 68, 0.4)',
    bgGradient: 'from-red-500/10 to-transparent',
    borderColor: 'border-red-500/30 hover:border-red-500/60',
    icon: HeartPulse,
    tags: ['médico', 'saúde', 'hospital', 'infarto', 'ambulância', 'dor', 'acidente', 'desmaio', 'médica']
  },
  {
    id: 'pm',
    name: 'Polícia Militar',
    number: '190',
    description: 'Emergências policiais, crimes ocorrendo agora ou risco iminente.',
    examples: ['Assaltos em andamento', 'Agressões', 'Invasões', 'Disparos de arma', 'Briga de trânsito violenta'],
    color: '#3B82F6', // Blue
    glowColor: 'rgba(59, 130, 246, 0.4)',
    bgGradient: 'from-blue-500/10 to-transparent',
    borderColor: 'border-blue-500/30 hover:border-blue-500/60',
    icon: Shield,
    tags: ['policia', 'militar', 'crime', 'roubo', 'furto', 'briga', 'violência', 'ameaça', 'segurança']
  },
  {
    id: 'bombeiros',
    name: 'Corpo de Bombeiros',
    number: '193',
    description: 'Combate a incêndios, salvamentos, resgastes e acidentes graves.',
    examples: ['Incêndios', 'Vítimas presas em ferragens', 'Afogamentos', 'Vazamento de gás/químicos', 'Soterramentos'],
    color: '#F97316', // Orange/Red-orange
    glowColor: 'rgba(249, 115, 22, 0.4)',
    bgGradient: 'from-orange-500/10 to-transparent',
    borderColor: 'border-orange-500/30 hover:border-orange-500/60',
    icon: Flame,
    tags: ['fogo', 'incêndio', 'bombeiro', 'salvamento', 'afogamento', 'resgate', 'vazamento', 'gás', 'ferragens']
  },
  {
    id: 'gcm',
    name: 'Guarda Civil Municipal',
    number: '153',
    description: 'Proteção do patrimônio público e apoio na segurança local da cidade.',
    examples: ['Vandalismo público', 'Perturbação do sossego', 'Apoio à segurança', 'Atitude suspeita em prédios públicos'],
    color: '#06B6D4', // Cyan
    glowColor: 'rgba(6, 182, 212, 0.4)',
    bgGradient: 'from-cyan-500/10 to-transparent',
    borderColor: 'border-cyan-500/30 hover:border-cyan-500/60',
    icon: Siren,
    tags: ['guarda', 'municipal', 'gcm', 'segurança', 'local', 'patrimônio', 'vandalismo', 'prefeitura']
  },
  {
    id: 'prf',
    name: 'Polícia Rodoviária Federal',
    number: '191',
    description: 'Ocorrências, acidentes e crimes acontecendo em rodovias federais (BRs).',
    examples: ['Acidentes nas rodovias federais de acesso', 'Carga perigosa caída na pista', 'Roubo de carga na BR', 'Animais soltos na pista'],
    color: '#EAB308', // Yellow
    glowColor: 'rgba(234, 179, 8, 0.4)',
    bgGradient: 'from-yellow-500/10 to-transparent',
    borderColor: 'border-yellow-500/30 hover:border-yellow-500/60',
    icon: Shield,
    tags: ['prf', 'rodovia', 'federal', 'estrada', 'pista', 'caminhão', 'acidente', 'carga', 'br-277', 'br']
  },
  {
    id: 'defesa_civil',
    name: 'Defesa Civil',
    number: '199',
    description: 'Ações preventivas, de socorro e assistência em desastres e sinistros naturais.',
    examples: ['Alagamentos e inundações', 'Deslizamentos de terra', 'Estruturas ameaçando cair', 'Chuvas extremas / Vendavais'],
    color: '#F97316', // Orange
    glowColor: 'rgba(249, 115, 22, 0.4)',
    bgGradient: 'from-orange-500/10 to-transparent',
    borderColor: 'border-orange-500/30 hover:border-orange-500/60',
    icon: AlertTriangle,
    tags: ['defesa', 'civil', 'enchente', 'chuva', 'alagamento', 'desabamento', 'desastre', 'sinistro', 'temporal']
  },
  {
    id: 'disque_denuncia',
    name: 'Disque Denúncia',
    number: '181',
    description: 'Canal totalmente anônimo e seguro para denunciar atividades ilícitas e suspeitas.',
    examples: ['Tráfico de drogas', 'Receptação de carga roubada', 'Localização de foragidos', 'Esquemas de contrabando'],
    color: '#A855F7', // Purple
    glowColor: 'rgba(168, 85, 247, 0.4)',
    bgGradient: 'from-purple-500/10 to-transparent',
    borderColor: 'border-purple-500/30 hover:border-purple-500/60',
    icon: EyeOff,
    tags: ['denúncia', 'anônimo', 'segredo', 'droga', 'tráfico', 'contrabando', 'suspeito', 'crime', 'escondido']
  },
  {
    id: 'mulher',
    name: 'Central da Mulher',
    number: '180',
    description: 'Atendimento, orientação e registro de denúncias de violência doméstica ou assédio.',
    examples: ['Agressão doméstica', 'Ameaça de parceiro', 'Assédio no local de trabalho', 'Orientação jurídica emergencial'],
    color: '#EC4899', // Pink
    glowColor: 'rgba(236, 72, 153, 0.4)',
    bgGradient: 'from-pink-500/10 to-transparent',
    borderColor: 'border-pink-500/30 hover:border-pink-500/60',
    icon: UserCheck,
    tags: ['mulher', 'violência', 'doméstica', 'assédio', 'agressão', 'lei maria da penha', 'família', 'feminino']
  }
];

export default function EmergencyView({ onBack }: EmergencyViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, number: string) => {
    navigator.clipboard.writeText(number);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredContacts = EMERGENCY_CONTACTS.filter(contact => {
    const search = searchTerm.toLowerCase();
    return (
      contact.name.toLowerCase().includes(search) ||
      contact.number.includes(search) ||
      contact.description.toLowerCase().includes(search) ||
      contact.examples.some(ex => ex.toLowerCase().includes(search)) ||
      contact.tags.some(tag => tag.toLowerCase().includes(search))
    );
  });

  return (
    <div className="min-h-screen bg-[#07111F] text-white flex flex-col font-sans select-none overflow-x-hidden">
      
      {/* Dynamic Background Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-60" />

      {/* Header section with back navigation */}
      <header className="sticky top-0 bg-[#07111F]/90 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-gray-300 hover:text-white transition cursor-pointer"
            id="emergency-back-button"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-base font-extrabold tracking-wider text-white uppercase leading-none">NÚMEROS DE EMERGÊNCIA</h1>
            <p className="text-[10px] text-red-400 font-bold tracking-widest uppercase mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
              Canais diretos de socorro
            </p>
          </div>
        </div>
      </header>

      {/* Main Body container */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 max-w-md mx-auto w-full pb-24 z-10">
        
        {/* Quick Instructions Banner */}
        <div className="bg-red-500/10 border border-red-500/25 p-4 rounded-3xl flex items-start gap-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-red-500" />
          <HelpCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-black uppercase text-red-200 tracking-wider">COMO PROCEDER EM UMA EMERGÊNCIA?</h3>
            <ul className="text-[11px] text-gray-300 mt-1.5 space-y-1 list-disc list-inside leading-relaxed">
              <li>Mantenha a calma para explicar o ocorrido.</li>
              <li>Informe a sua <span className="text-white font-bold underline">localização exata</span> ou ponto de referência.</li>
              <li>Diga se há feridos ou pessoas presas.</li>
              <li>Não desligue até que o atendente autorize.</li>
            </ul>
          </div>
        </div>

        {/* Tactical Search Filter */}
        <div className="relative">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-500">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Digite para filtrar... (ex: policia, samu, fogo, 192)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/10 rounded-2xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 transition font-sans"
            id="emergency-search-input"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-3.5 flex items-center text-[10px] text-gray-400 hover:text-white"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Contacts Grid */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredContacts.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="py-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2"
              >
                <Info size={24} />
                <p className="text-xs font-bold text-gray-300">Nenhum canal de emergência encontrado</p>
                <p className="text-[10px] text-gray-500">Tente buscar por termos mais genéricos.</p>
              </motion.div>
            ) : (
              filteredContacts.map((contact, index) => {
                const IconComponent = contact.icon;
                const isCopied = copiedId === contact.id;
                
                return (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.18, delay: Math.min(index * 0.04, 0.2) }}
                    className="relative"
                  >
                    {/* The entire card is an active link for immediate dial */}
                    <a
                      href={`tel:${contact.number}`}
                      className={`flex items-center justify-between p-3.5 rounded-[20px] bg-gradient-to-r ${contact.bgGradient} bg-[#0A1625]/15 backdrop-blur-xl border ${contact.borderColor} hover:bg-white/[0.04] active:scale-[0.99] transition-all duration-200 group relative overflow-hidden`}
                      style={{
                        boxShadow: `0 4px 12px -3px rgba(0,0,0,0.4), 0 0 8px -2px ${contact.glowColor}`
                      }}
                      id={`btn-call-${contact.id}`}
                    >
                      {/* Left Side: Icon & Info Column */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Compact Icon Badge */}
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${contact.color}12`,
                            border: `1px solid ${contact.color}30`,
                            color: contact.color,
                          }}
                        >
                          <IconComponent size={18} className="filter drop-shadow-[0_0_2px_currentColor]" />
                        </div>
                        
                        {/* Info Column */}
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] font-black tracking-wide text-white uppercase leading-none">
                              {contact.name}
                            </span>
                            <span 
                              className="text-[13px] font-black leading-none px-2 py-0.5 rounded-md bg-white/5 border border-white/5"
                              style={{ color: contact.color }}
                            >
                              {contact.number}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">
                            {contact.description}
                          </p>
                        </div>
                      </div>

                      {/* Right Side: Copy Action and Glowing Call Button */}
                      <div className="flex items-center gap-2 shrink-0 relative z-20">
                        {/* Copy Button */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCopy(contact.id, contact.number);
                          }}
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer border border-white/5"
                          title="Copiar número"
                          id={`btn-copy-${contact.id}`}
                        >
                          {isCopied ? <Check size={13} className="text-green-400" /> : <Copy size={12} />}
                        </button>

                        {/* Interactive Call Button indicator */}
                        <div 
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-105 active:scale-95 shadow-md shrink-0"
                          style={{
                            backgroundColor: contact.color,
                            boxShadow: `0 3px 8px ${contact.color}40`
                          }}
                        >
                          <Phone size={13} className="animate-pulse" />
                        </div>
                      </div>
                    </a>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Quick Location helper so they know what to tell dispatcher */}
        <div className="bg-[#0A1422]/15 backdrop-blur-xl border border-white/5 p-4 rounded-3xl space-y-2">
          <div className="flex items-center gap-2">
            <MapPin size={15} className="text-[#00A2FF]" />
            <h4 className="text-[11px] font-black uppercase text-white tracking-wider">SUA LOCALIZAÇÃO EM CASO DE SOCORRO</h4>
          </div>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Ao ligar para qualquer canal de socorro, informe com precisão a sua <span className="text-white font-bold">cidade, bairro, rua e número</span> atual. Caso não saiba o endereço exato, indique pontos de referência visualmente evidentes ao seu redor (estabelecimentos comerciais, praças, cruzamentos ou edifícios altos) para acelerar a chegada do resgate.
          </p>
        </div>

      </div>
    </div>
  );
}
