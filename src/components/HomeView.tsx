/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Ship, 
  Truck, 
  Calendar, 
  Store, 
  User, 
  LogOut, 
  ChevronRight,
  Camera,
  AlertTriangle,
  Trash2,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  X,
  ChevronDown,
  Shield,
  Bell,
  Settings,
  Anchor,
  MessageSquare
} from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Channel } from '../types';

interface HomeViewProps {
  userId: string;
  displayName: string;
  avatarUrl: string;
  role: 'driver' | 'admin' | 'operator';
  channels: Channel[];
  onSelectChannel: (channelId: string) => void;
  onLogout: () => void;
  onUpdateRole: (newRole: 'driver' | 'admin' | 'operator') => void;
}

interface StatusImageDoc {
  imageUrl: string;
  uploadedBy: {
    uid: string;
    displayName: string;
    avatarUrl?: string;
  };
  uploadedAt: number;
  reports?: string[];
  isDefault?: boolean;
}

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&q=80&w=1200";
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

// High-fidelity organically shaped wavy signal paths matching the ChannelView/Equalizer exactly
const wavePath = "M -400 50 L -370 50 Q -360 47, -350 50 T -330 50 Q -320 55, -310 50 Q -295 36, -280 50 Q -270 60, -260 50 L -220 50 Q -210 42, -200 50 T -180 50 Q -165 64, -150 50 Q -140 38, -130 50 L -80 50 Q -65 42, -50 50 Q -40 58, -30 50 L 0 50 L 30 50 Q 40 47, 50 50 T 70 50 Q 80 55, 90 50 Q 105 36, 120 50 Q 130 60, 140 50 L 180 50 Q 190 42, 200 50 T 220 50 Q 235 64, 250 50 Q 260 38, 270 50 L 320 50 Q 335 42, 350 50 Q 360 58, 370 50 L 400 50 L 430 50 Q 440 47, 450 50 T 470 50 Q 480 55, 490 50 Q 505 36, 520 50 Q 530 60, 540 50 L 580 50 Q 590 42, 600 50 T 620 50 Q 635 64, 650 50 Q 660 38, 670 50 L 720 50 Q 735 42, 750 50 Q 760 58, 770 50 L 800 50";
const curvyWavePath = "M -400 50 L -370 50 Q -360 32, -350 50 T -330 50 Q -320 68, -310 50 Q -295 18, -280 50 Q -270 82, -260 50 L -220 50 Q -210 28, -200 50 T -180 50 Q -165 85, -150 50 Q -140 15, -130 50 L -80 50 Q -65 24, -50 50 Q -40 76, -30 50 L 0 50 L 30 50 Q 40 32, 50 50 T 70 50 Q 80 68, 90 50 Q 105 18, 120 50 Q 130 82, 140 50 L 180 50 Q 190 28, 200 50 T 220 50 Q 235 85, 250 50 Q 260 15, 270 50 L 320 50 Q 335 24, 350 50 Q 360 76, 370 50 L 400 50 L 430 50 Q 440 32, 450 50 T 470 50 Q 480 68, 490 50 Q 505 18, 520 50 Q 530 82, 540 50 L 580 50 Q 590 28, 600 50 T 620 50 Q 635 85, 650 50 Q 660 15, 670 50 L 720 50 Q 735 24, 750 50 Q 760 76, 770 50 L 800 50";

export default function HomeView({
  userId,
  displayName,
  avatarUrl,
  role,
  channels,
  onSelectChannel,
  onLogout,
  onUpdateRole,
}: HomeViewProps) {
  const [statusImage, setStatusImage] = useState<StatusImageDoc | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const [showStatusDetails, setShowStatusDetails] = useState(false);
  const [showCameraPanel, setShowCameraPanel] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to real-time status image in Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'status_image'), (snapshot) => {
      if (snapshot.exists()) {
        setStatusImage(snapshot.data() as StatusImageDoc);
      } else {
        setStatusImage(null);
      }
    });

    return () => unsub();
  }, []);

  // Check if custom image is active and has not expired yet
  const getActiveImageInfo = () => {
    if (!statusImage || statusImage.isDefault) {
      return { isActive: false, imageUrl: DEFAULT_IMAGE, doc: null };
    }
    const elapsed = Date.now() - statusImage.uploadedAt;
    const isExpired = elapsed >= TWENTY_FOUR_HOURS;
    
    if (isExpired) {
      return { isActive: false, imageUrl: DEFAULT_IMAGE, doc: null };
    }
    return { isActive: true, imageUrl: statusImage.imageUrl, doc: statusImage };
  };

  const activeInfo = getActiveImageInfo();

  // Dynamic countdown string for 24-hour lock
  useEffect(() => {
    const updateCountdown = () => {
      if (!activeInfo.isActive || !activeInfo.doc) {
        setTimeLeftStr('');
        return;
      }
      const end = activeInfo.doc.uploadedAt + TWENTY_FOUR_HOURS;
      const diff = end - Date.now();
      if (diff <= 0) {
        setTimeLeftStr('');
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeftStr(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [activeInfo.isActive, activeInfo.doc]);

  // Greeting based on current hours
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) return 'Bom dia';
    if (hours >= 12 && hours < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setUploadError('A imagem é muito grande. Escolha uma imagem de até 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      await uploadAndVerifyImage(base64String);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const uploadAndVerifyImage = async (base64String: string) => {
    setIsAnalyzing(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const response = await fetch('/api/verify-status-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64String }),
      });

      if (!response.ok) {
        throw new Error('Falha na comunicação com o servidor de IA.');
      }

      const data = await response.json();

      if (data.approved) {
        const statusDocRef = doc(db, 'settings', 'status_image');
        await setDoc(statusDocRef, {
          imageUrl: base64String,
          uploadedBy: {
            uid: userId,
            displayName: displayName,
            avatarUrl: avatarUrl,
          },
          uploadedAt: Date.now(),
          reports: [],
          isDefault: false,
        });
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 5000);
      } else {
        setUploadError(data.reason || 'Sua imagem foi recusada pelos filtros de IA. Verifique se contém nudez, textos racistas ou ofensivos.');
      }
    } catch (err: any) {
      console.error('Error during safety verification:', err);
      setUploadError(err.message || 'Erro inesperado ao escanear imagem com IA.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDenounce = async () => {
    if (!statusImage) return;
    const currentReports = statusImage.reports || [];
    if (currentReports.includes(userId)) {
      alert('Você já denunciou esta imagem. O administrador foi alertado.');
      return;
    }

    const updatedReports = [...currentReports, userId];
    try {
      await setDoc(doc(db, 'settings', 'status_image'), {
        ...statusImage,
        reports: updatedReports,
      });
      alert('Imagem denunciada com sucesso. O administrador analisará a imagem para remoção.');
    } catch (err) {
      console.error('Error reporting status image:', err);
    }
  };

  const handleAdminReset = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza de que deseja remover esta imagem de status?')) return;
    try {
      await setDoc(doc(db, 'settings', 'status_image'), {
        imageUrl: DEFAULT_IMAGE,
        uploadedBy: {
          uid: 'system',
          displayName: 'Sistema',
        },
        uploadedAt: 0,
        reports: [],
        isDefault: true,
      });
      alert('Status do porto restaurado ao padrão com sucesso!');
    } catch (err) {
      console.error('Error resetting status image:', err);
    }
  };

  const handleTriggerUpload = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activeInfo.isActive && role !== 'admin') {
      alert(`Esta imagem foi colocada por ${activeInfo.doc?.uploadedBy.displayName} e está bloqueada por 24 horas. Apenas administradores podem alterá-la.`);
      return;
    }
    fileInputRef.current?.click();
  };

  const getChannelIconComponent = (icon: string, color: string) => {
    const props = { size: 22, style: { color: color } };
    switch (icon) {
      case 'ship': return <Ship {...props} />;
      case 'truck': return <Truck {...props} />;
      case 'calendar': return <Calendar {...props} />;
      case 'store': return <Store {...props} />;
      default: return <Ship {...props} />;
    }
  };

  return (
    <div className="h-screen sm:h-[100dvh] bg-[#030914] flex flex-col justify-between font-sans text-white relative overflow-hidden pb-4">
      
      {/* BACKGROUND IMAGE - Functions as the application status background */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-700"
        style={{ 
          backgroundImage: `url(${activeInfo.imageUrl})`,
        }}
      />
      {/* Ambient gradient fade overlays for maximum visual high-fidelity and legibility */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#030914]/90 via-[#030914]/65 to-[#030914] pointer-events-none" />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#030914] via-[#030914]/40 to-transparent pointer-events-none" />
      <div className="absolute inset-0 z-0 bg-black/45 backdrop-blur-[2.5px] pointer-events-none" />

      {/* Hidden File Input for uploading status photos */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="w-full max-w-[430px] mx-auto z-10 px-5 flex flex-col justify-between flex-1 gap-2.5 sm:gap-4 h-full py-1 sm:py-3 overflow-hidden">
        
        {/* 1. TOP HEADER (PORTO CONECTA LOGO & NOTIFICATION/SETTINGS) */}
        <header className="py-2.5 sm:py-4 flex items-center justify-between">
          {/* Logo Hexágono Porto Conecta */}
          <div className="flex items-center gap-3 select-none">
            <svg className="w-10 h-10 drop-shadow-[0_0_10px_rgba(255,122,0,0.5)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 5 L89 27.5 L89 72.5 L50 95 L11 72.5 L11 27.5 Z" fill="#FF7A00" />
              <text x="50" y="62" fill="white" fontSize="40" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">P</text>
            </svg>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-wider text-white leading-none">PORTO</span>
              <span className="text-[10px] font-bold tracking-[0.16em] text-[#FF7A00] leading-none mt-1">CONECTA</span>
            </div>
          </div>

          {/* Botões do Topo */}
          <div className="flex items-center gap-2">
            {/* Camera/Status Image Button */}
            <button
              onClick={() => setShowCameraPanel(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 transition relative cursor-pointer"
            >
              <Camera size={18} className="text-gray-300 hover:text-white" />
              {activeInfo.isActive && (
                <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-[#FF7A00] shadow-[0_0_8px_#FF7A00] animate-pulse" />
              )}
            </button>

            {/* Settings/Gear Button */}
            <button
              onClick={() => setShowStatusDetails(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 transition cursor-pointer"
            >
              <Settings size={18} className="text-gray-300 hover:text-white" />
            </button>
          </div>
        </header>

        {/* 2. GREETING & TITLE */}
        <div className="select-none py-1">
          <h2 className="text-[28px] font-sans font-light text-white tracking-tight leading-none">
            {getGreeting()}, <span className="font-bold text-[#FF7A00] drop-shadow-[0_0_12px_rgba(255,122,0,0.45)]">{displayName}</span>
          </h2>
          <p className="text-[12px] text-gray-400 mt-2 font-medium">
            Conecte, informe, mova o porto.
          </p>
        </div>

        {/* AI Camera Upload Loading/Success Overlay */}
        <AnimatePresence>
          {(isAnalyzing || uploadSuccess || uploadError) && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-[#0A1C30]/90 backdrop-blur-md border border-white/15 rounded-2xl p-3 shadow-xl"
            >
              {isAnalyzing && (
                <div className="flex items-center gap-3 justify-center py-1">
                  <span className="w-4 h-4 border-2 border-[#FF7A00] border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-bold text-orange-400 uppercase tracking-widest animate-pulse">
                    Verificando foto com IA Gemini...
                  </p>
                </div>
              )}
              {uploadSuccess && (
                <div className="flex items-center gap-2.5 justify-center py-1 text-green-400">
                  <CheckCircle2 size={16} />
                  <p className="text-xs font-bold uppercase tracking-wider">
                    Sucesso! Nova imagem de status publicada por 24h.
                  </p>
                </div>
              )}
              {uploadError && (
                <div className="flex flex-col gap-1 py-1">
                  <div className="flex items-center gap-2 text-red-400">
                    <XCircle size={15} />
                    <p className="text-xs font-bold uppercase tracking-wider">Foto Recusada por IA</p>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight pl-5">{uploadError}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. NEON 2X2 GRID OF CHANNELS (Identical to image) */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 my-1">
          {/* Card 1: CANAL PORTO */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectChannel('porto')}
            className="relative p-4 sm:p-5 h-[145px] sm:h-[180px] bg-[#030914]/40 backdrop-blur-lg border border-blue-500/40 rounded-[24px] sm:rounded-[28px] shadow-[0_0_15px_rgba(59,130,246,0.12)] flex flex-col justify-between cursor-pointer group overflow-hidden"
          >
            {/* Top info and icon */}
            <div className="flex flex-col gap-1 sm:gap-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.25)]">
                <Ship size={20} className="filter drop-shadow-[0_0_4px_#3b82f6] sm:scale-110" />
              </div>
              <div className="mt-1 sm:mt-2">
                <h4 className="text-[11px] sm:text-[13px] font-bold text-white tracking-wider uppercase leading-none">CANAL PORTO</h4>
                <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 sm:mt-1 leading-tight">Avisos e informações<br className="hidden sm:inline"/> oficiais</p>
              </div>
            </div>

            {/* Bottom arrow container */}
            <div className="flex items-center justify-between z-10">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-blue-500/40 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/15 transition-all">
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Watermark SVG vector */}
            <svg className="absolute bottom-2 right-2 w-20 sm:w-28 h-14 sm:h-20 text-blue-500/5 pointer-events-none select-none" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M10 80 H90 M15 80 V50 H30 V80 M40 80 V30 H60 V80 M70 80 V45 H85 V80" />
            </svg>
          </motion.div>

          {/* Card 2: MOTORISTAS */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectChannel('motoristas')}
            className="relative p-4 sm:p-5 h-[145px] sm:h-[180px] bg-[#030914]/40 backdrop-blur-lg border border-orange-500/40 rounded-[24px] sm:rounded-[28px] shadow-[0_0_15px_rgba(255,122,0,0.12)] flex flex-col justify-between cursor-pointer group overflow-hidden"
          >
            {/* Top info and icon */}
            <div className="flex flex-col gap-1 sm:gap-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-[0_0_10px_rgba(255,122,0,0.25)]">
                <Truck size={20} className="filter drop-shadow-[0_0_4px_#ff5100] sm:scale-110" />
              </div>
              <div className="mt-1 sm:mt-2">
                <h4 className="text-[11px] sm:text-[13px] font-bold text-white tracking-wider uppercase leading-none">MOTORISTAS</h4>
                <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 sm:mt-1 leading-tight">Comunicação entre<br className="hidden sm:inline"/> motoristas</p>
              </div>
            </div>

            {/* Bottom arrow container */}
            <div className="flex items-center justify-between z-10">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-orange-500/40 flex items-center justify-center text-orange-400 group-hover:bg-orange-500/15 transition-all">
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Watermark SVG Semi-truck */}
            <svg className="absolute bottom-2 right-2 w-20 sm:w-28 h-14 sm:h-20 text-orange-500/5 pointer-events-none select-none" viewBox="0 0 120 80" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M10 60 H110 M20 60 V45 H55 V60 M55 45 H80 L95 60 H110 V50 H95" />
              <circle cx="35" cy="60" r="6" />
              <circle cx="48" cy="60" r="6" />
              <circle cx="88" cy="60" r="6" />
            </svg>
          </motion.div>

          {/* Card 3: FOLGAS */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectChannel('folgas')}
            className="relative p-4 sm:p-5 h-[145px] sm:h-[180px] bg-[#030914]/40 backdrop-blur-lg border border-purple-500/40 rounded-[24px] sm:rounded-[28px] shadow-[0_0_15px_rgba(168,85,247,0.12)] flex flex-col justify-between cursor-pointer group overflow-hidden"
          >
            {/* Top info and icon */}
            <div className="flex flex-col gap-1 sm:gap-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.25)]">
                <Calendar size={20} className="filter drop-shadow-[0_0_4px_#a855f7] sm:scale-110" />
              </div>
              <div className="mt-1 sm:mt-2">
                <h4 className="text-[11px] sm:text-[13px] font-bold text-white tracking-wider uppercase leading-none">FOLGAS</h4>
                <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 sm:mt-1 leading-tight">Troca de escalas<br className="hidden sm:inline"/> e folgas</p>
              </div>
            </div>

            {/* Bottom notification badge "5" */}
            <div className="flex items-center justify-between z-10">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-[11px] sm:text-xs font-bold shadow-[0_0_8px_rgba(168,85,247,0.5)]">
                5
              </div>
            </div>

            {/* Watermark: Calendar wireframe */}
            <svg className="absolute bottom-2 right-2 w-20 sm:w-28 h-14 sm:h-20 text-purple-500/5 pointer-events-none select-none" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="20" y="30" width="60" height="50" rx="4" />
              <line x1="20" y1="45" x2="80" y2="45" />
              <circle cx="35" cy="60" r="3" />
              <circle cx="50" cy="60" r="3" />
              <circle cx="65" cy="60" r="3" />
            </svg>
          </motion.div>

          {/* Card 4: COMÉRCIO LOCAL */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectChannel('comercio')}
            className="relative p-4 sm:p-5 h-[145px] sm:h-[180px] bg-[#030914]/40 backdrop-blur-lg border border-green-500/40 rounded-[24px] sm:rounded-[28px] shadow-[0_0_15px_rgba(34,197,94,0.12)] flex flex-col justify-between cursor-pointer group overflow-hidden"
          >
            {/* Top info and icon */}
            <div className="flex flex-col gap-1 sm:gap-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.25)]">
                <Store size={20} className="filter drop-shadow-[0_0_4px_#22c55e] sm:scale-110" />
              </div>
              <div className="mt-1 sm:mt-2">
                <h4 className="text-[11px] sm:text-[13px] font-bold text-white tracking-wider uppercase leading-none">COMÉRCIO LOCAL</h4>
                <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 sm:mt-1 leading-tight">Serviços e produtos<br className="hidden sm:inline"/> da região</p>
              </div>
            </div>

            {/* Bottom notification badge "3" */}
            <div className="flex items-center justify-between z-10">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-[11px] sm:text-xs font-bold shadow-[0_0_8px_rgba(34,197,94,0.5)]">
                3
              </div>
            </div>

            {/* Watermark Store */}
            <svg className="absolute bottom-2 right-2 w-20 sm:w-28 h-14 sm:h-20 text-green-500/5 pointer-events-none select-none" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M20 75 V45 L50 25 L80 45 V75 Z M15 45 H85 M35 75 V55 H65 V75" />
            </svg>
          </motion.div>
        </div>

        {/* 5. BOTTOM NAVIGATION BAR WITH INTEGRATED PARALLAX RADIO WAVES & CIRCLE ICONS */}
        <nav className="bg-[#030914]/85 backdrop-blur-md border border-white/5 rounded-[28px] py-1 px-4 sm:py-2 sm:px-6 flex justify-around items-center shadow-2xl relative overflow-hidden h-[72px] sm:h-[80px]">
          
          {/* Parallax Radio waves moving behind/between the icons (Yellow glow matching ChannelView exactly) */}
          <div className="absolute inset-x-0 inset-y-0 flex items-center w-full px-0 select-none pointer-events-none z-0 opacity-40">
            <svg className="w-full h-10 text-[#FACC15]" viewBox="0 0 400 100" preserveAspectRatio="none">
              {/* Curvy Accent Wave Path (Ping-pong Left-to-Right - Dynamic Secondary Accent) */}
              <motion.path
                d={curvyWavePath}
                fill="none"
                stroke="#FACC15"
                strokeWidth="1.2"
                opacity="0.6"
                className="drop-shadow-[0_0_8px_rgba(250,204,21,0.65)]"
                animate={{ 
                  x: [-400, 0],
                  y: [2, -2, 2]
                }}
                transition={{
                  x: {
                    ease: "easeInOut",
                    duration: 7,
                    repeat: Infinity,
                    repeatType: "reverse",
                  },
                  y: {
                    ease: "easeInOut",
                    duration: 1.4,
                    repeat: Infinity,
                  }
                }}
              />

              {/* Standard Accent Opposite Wave Path (Ping-pong Right-to-Left, Vertically Inverted, Dynamic Secondary Accent) */}
              <motion.path
                d={wavePath}
                fill="none"
                stroke="#FACC15"
                strokeWidth="1.2"
                opacity="0.6"
                className="drop-shadow-[0_0_8px_rgba(250,204,21,0.65)]"
                style={{ transformOrigin: "center 50px" }}
                animate={{ 
                  x: [0, -400],
                  scaleY: -1,
                  y: [-2, 2, -2]
                }}
                transition={{
                  x: {
                    ease: "easeInOut",
                    duration: 7,
                    repeat: Infinity,
                    repeatType: "reverse",
                  },
                  y: {
                    ease: "easeInOut",
                    duration: 1.4,
                    repeat: Infinity,
                  }
                }}
              />

              {/* Continuous Unsynchronized Wave 1 (LTR) */}
              <motion.path
                d={wavePath}
                fill="none"
                stroke="#FACC15"
                strokeWidth="1.3"
                opacity="0.45"
                className="drop-shadow-[0_0_8px_rgba(250,204,21,0.65)]"
                animate={{ 
                  x: [-400, 0],
                  y: [1.5, -1.5, 1.5]
                }}
                transition={{
                  x: {
                    ease: "linear",
                    duration: 5.8,
                    repeat: Infinity,
                    repeatType: "reverse",
                  },
                  y: {
                    ease: "easeInOut",
                    duration: 1.3,
                    repeat: Infinity,
                  }
                }}
              />

              {/* Continuous Unsynchronized Wave 2 (RTL, Vertically Inverted) */}
              <motion.path
                d={curvyWavePath}
                fill="none"
                stroke="#FEF08A"
                strokeWidth="1.3"
                opacity="0.45"
                className="drop-shadow-[0_0_8px_rgba(254,240,138,0.65)]"
                style={{ transformOrigin: "center 50px" }}
                animate={{ 
                  x: [0, -400],
                  scaleY: -1,
                  y: [-1.5, 1.5, -1.5]
                }}
                transition={{
                  x: {
                    ease: "linear",
                    duration: 8.2,
                    repeat: Infinity,
                    repeatType: "reverse",
                  },
                  y: {
                    ease: "easeInOut",
                    duration: 2.1,
                    repeat: Infinity,
                  }
                }}
              />

              {/* Secondary Low-Opacity Parallax Wave Path (Slower Ping-pong LTR) */}
              <motion.path
                d={wavePath}
                fill="none"
                stroke="#EAB308"
                strokeWidth="0.9"
                opacity="0.3"
                className="drop-shadow-[0_0_8px_rgba(234,179,8,0.35)]"
                animate={{ 
                  x: [-400, 0],
                  y: [-0.8, 0.8, -0.8]
                }}
                transition={{
                  x: {
                    ease: "easeInOut",
                    duration: 9.5,
                    repeat: Infinity,
                    repeatType: "reverse",
                  },
                  y: {
                    ease: "easeInOut",
                    duration: 2.5,
                    repeat: Infinity,
                  }
                }}
              />

              {/* Secondary Low-Opacity Parallax Wave Path (Slower Ping-pong RTL, Vertically Inverted) */}
              <motion.path
                d={curvyWavePath}
                fill="none"
                stroke="#FACC15"
                strokeWidth="0.9"
                opacity="0.3"
                className="drop-shadow-[0_0_8px_rgba(250,204,21,0.35)]"
                style={{ transformOrigin: "center 50px" }}
                animate={{ 
                  x: [0, -400],
                  scaleY: -1,
                  y: [0.8, -0.8, 0.8]
                }}
                transition={{
                  x: {
                    ease: "easeInOut",
                    duration: 9.5,
                    repeat: Infinity,
                    repeatType: "reverse",
                  },
                  y: {
                    ease: "easeInOut",
                    duration: 2.5,
                    repeat: Infinity,
                  }
                }}
              />
            </svg>
          </div>

          {/* Canais Tab */}
          <button className="relative h-full flex items-center justify-center focus:outline-none group text-[#FACC15]/60 hover:text-[#FACC15] transition z-10 cursor-pointer w-20">
            <div className="w-12 h-12 rounded-full border border-[#FACC15]/20 bg-[#030914]/80 flex items-center justify-center text-[#FACC15]/60 group-hover:border-[#FACC15] group-hover:text-[#FACC15] group-hover:bg-[#FACC15]/15 transition-all duration-200 group-hover:scale-105 group-active:scale-95 shadow-[0_0_10px_rgba(250,204,21,0.08)] hover:shadow-[0_0_12px_rgba(250,204,21,0.3)]">
              <Anchor size={20} className="group-hover:filter group-hover:drop-shadow-[0_0_4px_rgba(250,204,21,0.6)]" />
            </div>
          </button>

          {/* Mensagens Tab (Active - Highlighted in the center) */}
          <button 
            onClick={() => onSelectChannel('motoristas')}
            className="relative h-full flex items-center justify-center focus:outline-none group z-10 cursor-pointer w-20 text-[#FACC15]"
          >
            <div className="w-12 h-12 rounded-full border border-[#FACC15] bg-[#FACC15]/15 flex items-center justify-center text-[#FACC15] shadow-[0_0_12px_rgba(250,204,21,0.35)] transition-all duration-200 group-hover:scale-105 group-active:scale-95">
              <MessageSquare size={20} className="filter drop-shadow-[0_0_4px_rgba(250,204,21,0.8)]" />
            </div>
          </button>

          {/* Perfil Tab */}
          <button 
            onClick={() => setShowStatusDetails(true)}
            className="relative h-full flex items-center justify-center focus:outline-none group text-[#FACC15]/60 hover:text-[#FACC15] transition z-10 cursor-pointer w-20"
          >
            <div className="w-12 h-12 rounded-full border border-[#FACC15]/20 bg-[#030914]/80 flex items-center justify-center text-[#FACC15]/60 group-hover:border-[#FACC15] group-hover:text-[#FACC15] group-hover:bg-[#FACC15]/15 transition-all duration-200 group-hover:scale-105 group-active:scale-95 shadow-[0_0_10px_rgba(250,204,21,0.08)] hover:shadow-[0_0_12px_rgba(250,204,21,0.3)]">
              <User size={20} className="group-hover:filter group-hover:drop-shadow-[0_0_4px_rgba(250,204,21,0.6)]" />
            </div>
          </button>
        </nav>

      </div>

      {/* 6. SETTINGS & PROFILE MODAL (Opened by gear or profile click) */}
      <AnimatePresence>
        {showStatusDetails && (
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
              className="bg-[#0A1C30] border border-white/10 rounded-[28px] w-full max-w-sm overflow-hidden shadow-2xl relative"
            >
              {/* Modal header */}
              <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-[#07111F]/50">
                <div className="flex items-center gap-2">
                  <User className="text-[#FF7A00]" size={16} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">Cadastro do Motorista</h3>
                </div>
                <button
                  onClick={() => setShowStatusDetails(false)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
                
                {/* 1. Profile information */}
                <div className="bg-[#07111F]/60 p-3.5 rounded-xl border border-white/5 flex items-center gap-3">
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-white">{displayName}</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-none">Usuário Autenticado</p>
                    <span className="inline-block text-[9px] bg-[#FF7A00]/15 text-[#FF7A00] font-bold tracking-wider uppercase px-2 py-0.5 rounded mt-1.5">
                      {role === 'driver' ? 'Motorista' : role === 'admin' ? 'Admin' : 'Operador'}
                    </span>
                  </div>
                </div>

                {/* 3. Mudar Função Picker */}
                <div className="flex flex-col gap-2 mt-1.5 pt-2 border-t border-white/5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Selecione Perfil de Teste</span>
                  <div className="grid grid-cols-3 gap-1 bg-[#07111F] p-1 rounded-xl border border-white/5">
                    <button
                      onClick={() => onUpdateRole('driver')}
                      className={`py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-center transition ${
                        role === 'driver' ? 'bg-[#FF7A00] text-white shadow' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Motorista
                    </button>
                    <button
                      onClick={() => onUpdateRole('operator')}
                      className={`py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-center transition ${
                        role === 'operator' ? 'bg-[#FF7A00] text-white shadow' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Operador
                    </button>
                    <button
                      onClick={() => onUpdateRole('admin')}
                      className={`py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-center transition ${
                        role === 'admin' ? 'bg-[#FF7A00] text-white shadow' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Admin
                    </button>
                  </div>
                </div>

                {/* 4. Logout trigger */}
                <button
                  onClick={onLogout}
                  className="w-full mt-2 py-2.5 bg-red-600/10 hover:bg-red-600/20 border border-red-600/20 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
                >
                  <LogOut size={13} />
                  <span>Sair da Conta</span>
                </button>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 8. STATUS PHOTO MODAL (Opened by camera click) */}
      <AnimatePresence>
        {showCameraPanel && (
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
              className="bg-[#0A1C30] border border-white/10 rounded-[28px] w-full max-w-sm overflow-hidden shadow-2xl relative"
            >
              {/* Modal header */}
              <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-[#07111F]/50">
                <div className="flex items-center gap-2">
                  <Camera className="text-[#FF7A00]" size={16} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white font-sans">Status do Porto</h3>
                </div>
                <button
                  onClick={() => setShowCameraPanel(false)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">FUNDO ATIVO NO APLICATIVO</span>
                  
                  {/* Image preview of current app background */}
                  <div className="relative h-44 rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-inner">
                    <img
                      src={activeInfo.imageUrl}
                      className="w-full h-full object-cover"
                      alt="Current background"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                    
                    {/* Top tag */}
                    <div className="absolute top-3 left-3">
                      <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                        activeInfo.isActive ? 'bg-[#FF7A00] text-white shadow-lg shadow-orange-500/20' : 'bg-green-500 text-white shadow-md shadow-green-500/10'
                      }`}>
                        {activeInfo.isActive ? 'Bloqueio Ativo' : 'Fundo Padrão'}
                      </span>
                    </div>

                    {/* Bottom details inside the card */}
                    <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                      <div className="text-[10px] text-gray-300">
                        {activeInfo.isActive && activeInfo.doc ? (
                          <>
                            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Enviado por</p>
                            <p className="font-bold text-white text-xs">{activeInfo.doc.uploadedBy.displayName}</p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-300 font-medium">Operação Normal</p>
                        )}
                      </div>

                      {activeInfo.isActive && (
                        <div className="text-right">
                          <p className="text-[9px] text-gray-400 uppercase tracking-wider">Tempo Restante</p>
                          <p className="font-mono text-[#FF7A00] font-bold text-xs">{timeLeftStr}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Upload action */}
                <div className="flex flex-col gap-2 mt-1">
                  <button
                    onClick={() => {
                      setShowCameraPanel(false); // Close modal before launching native camera upload
                      handleTriggerUpload();
                    }}
                    disabled={activeInfo.isActive && role !== 'admin'}
                    className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition duration-150 active:scale-[0.98] ${
                      activeInfo.isActive && role !== 'admin'
                        ? 'bg-gray-800 text-gray-500 border border-transparent cursor-not-allowed'
                        : 'bg-[#FF7A00] hover:bg-[#E06B00] text-white cursor-pointer shadow-lg shadow-orange-500/10'
                    }`}
                  >
                    <Camera size={14} />
                    <span>{activeInfo.isActive ? 'Mudar Foto do Fundo' : 'Enviar Nova Foto de Fundo'}</span>
                  </button>

                  {/* Secondary Actions (Denounce and Reset) */}
                  {activeInfo.isActive && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        onClick={() => {
                          setShowCameraPanel(false);
                          handleDenounce();
                        }}
                        className="py-2.5 bg-yellow-500/10 hover:bg-yellow-500/15 border border-yellow-500/20 rounded-lg text-[10px] font-bold text-yellow-400 uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <AlertTriangle size={11} />
                        <span>Denunciar</span>
                      </button>

                      {role === 'admin' ? (
                        <button
                          onClick={(e) => {
                            setShowCameraPanel(false);
                            handleAdminReset(e);
                          }}
                          className="py-2.5 bg-[#FF2D55]/10 hover:bg-[#FF2D55]/15 border border-[#FF2D55]/20 rounded-lg text-[10px] font-bold text-[#FF2D55] uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          <Trash2 size={11} />
                          <span>Limpar Foto</span>
                        </button>
                      ) : (
                        <div className="py-2.5 text-center text-[9px] text-gray-500 border border-dashed border-white/5 rounded-lg flex items-center justify-center">
                          Apenas Admin
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-gray-400 leading-normal text-center mt-1 px-1">
                  Fotos de incidentes, obstruções ou tráfego alteram o fundo do aplicativo de todos os usuários em tempo real por até 24 horas.
                </p>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7. NOTIFICATION SLIDE DRAWER (Avisos) */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end justify-center"
          >
            <div className="absolute inset-0" onClick={() => setShowNotifications(false)} />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-[#0A1C30] border-t border-white/10 rounded-t-[28px] w-full max-w-md overflow-hidden shadow-2xl relative z-10 p-5 pb-6"
            >
              {/* Drawer header */}
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Bell className="text-[#FF7A00]" size={16} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">Avisos Recentes do Porto</h3>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Alerts body list */}
              <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                {/* Alert 1 */}
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-2.5 items-start">
                  <AlertTriangle className="text-red-400 mt-0.5 shrink-0" size={14} />
                  <div>
                    <h4 className="text-[11px] font-bold text-red-400 uppercase tracking-wide">Terminal 2 Interditado</h4>
                    <p className="text-[10px] text-gray-300 mt-0.5 leading-normal">
                      Manutenção asfáltica próxima à pesagem norte. Desvio ativo para balança oeste.
                    </p>
                  </div>
                </div>

                {/* Alert 2 */}
                <div className="p-3.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex gap-2.5 items-start">
                  <Clock className="text-yellow-400 mt-0.5 shrink-0" size={14} />
                  <div>
                    <h4 className="text-[11px] font-bold text-yellow-400 uppercase tracking-wide">Fila de Triagem Elevada</h4>
                    <p className="text-[10px] text-gray-300 mt-0.5 leading-normal">
                      Pátio principal com alta taxa de ocupação. Tempo médio de espera estimado em 45 min.
                    </p>
                  </div>
                </div>

                {/* Alert 3 */}
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex gap-2.5 items-start">
                  <Sparkles className="text-blue-400 mt-0.5 shrink-0" size={14} />
                  <div>
                    <h4 className="text-[11px] font-bold text-blue-400 uppercase tracking-wide">Ventos Fortes em Canal</h4>
                    <p className="text-[10px] text-gray-300 mt-0.5 leading-normal">
                      Rajadas de até 26 nós. Redobre a atenção na movimentação e travessia de carga alta.
                    </p>
                  </div>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={() => setShowNotifications(false)}
                className="w-full mt-5 py-2.5 bg-[#FF7A00] hover:bg-[#E06B00] transition text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md cursor-pointer"
              >
                Entendido, Fechar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
