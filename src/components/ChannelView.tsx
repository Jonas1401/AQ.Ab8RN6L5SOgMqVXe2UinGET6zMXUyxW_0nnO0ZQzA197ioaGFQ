/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Ship,
  Truck,
  Calendar,
  Store,
  Bell,
  ChevronRight,
  Plus,
  Paperclip,
  Image as ImageIcon,
  Mic,
  Send,
  Play,
  Pause,
  X,
  CornerUpLeft,
  Edit3,
  Copy,
  Trash2,
  AlertTriangle,
  Users,
  Sparkles
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  doc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { Channel, Message } from '../types';
import AudioRecorder from './AudioRecorder';

interface ChannelViewProps {
  channel: Channel;
  userId: string;
  userName: string;
  userAvatar: string;
  onBack: () => void;
}

const PRESET_IMAGES = [
  'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&q=80&w=600', // Port crane
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=600', // Warehouse logistics
  'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=600', // Cargo truck
];

const PRESET_DRIVER_PHOTOS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200', // Male driver 1
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200', // Female driver 1
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200', // Male driver 2
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200', // Female driver 2
];

// High-fidelity organically shaped wavy signal paths matching the home page footer Equalizer exactly
const wavePath = "M -400 50 L -370 50 Q -360 47, -350 50 T -330 50 Q -320 55, -310 50 Q -295 36, -280 50 Q -270 60, -260 50 L -220 50 Q -210 42, -200 50 T -180 50 Q -165 64, -150 50 Q -140 38, -130 50 L -80 50 Q -65 42, -50 50 Q -40 58, -30 50 L 0 50 L 30 50 Q 40 47, 50 50 T 70 50 Q 80 55, 90 50 Q 105 36, 120 50 Q 130 60, 140 50 L 180 50 Q 190 42, 200 50 T 220 50 Q 235 64, 250 50 Q 260 38, 270 50 L 320 50 Q 335 42, 350 50 Q 360 58, 370 50 L 400 50 L 430 50 Q 440 47, 450 50 T 470 50 Q 480 55, 490 50 Q 505 36, 520 50 Q 530 60, 540 50 L 580 50 Q 590 42, 600 50 T 620 50 Q 635 64, 650 50 Q 660 38, 670 50 L 720 50 Q 735 42, 750 50 Q 760 58, 770 50 L 800 50";
const curvyWavePath = "M -400 50 L -370 50 Q -360 32, -350 50 T -330 50 Q -320 68, -310 50 Q -295 18, -280 50 Q -270 82, -260 50 L -220 50 Q -210 28, -200 50 T -180 50 Q -165 85, -150 50 Q -140 15, -130 50 L -80 50 Q -65 24, -50 50 Q -40 76, -30 50 L 0 50 L 30 50 Q 40 32, 50 50 T 70 50 Q 80 68, 90 50 Q 105 18, 120 50 Q 130 82, 140 50 L 180 50 Q 190 28, 200 50 T 220 50 Q 235 85, 250 50 Q 260 15, 270 50 L 320 50 Q 335 24, 350 50 Q 360 76, 370 50 L 400 50 L 430 50 Q 440 32, 450 50 T 470 50 Q 480 68, 490 50 Q 505 18, 520 50 Q 530 82, 540 50 L 580 50 Q 590 28, 600 50 T 620 50 Q 635 85, 650 50 Q 660 15, 670 50 L 720 50 Q 735 24, 750 50 Q 760 76, 770 50 L 800 50";

export default function ChannelView({
  channel,
  userId,
  userName,
  userAvatar,
  onBack,
}: ChannelViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [replyMessage, setReplyMessage] = useState<Message | null>(null);
  const [editMessage, setEditMessage] = useState<Message | null>(null);
  
  // Press & Hold (Long Press) states
  const [pressingMessageId, setPressingMessageId] = useState<string | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchMovedRef = useRef<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const startPress = (msg: Message) => {
    touchMovedRef.current = false;
    setPressingMessageId(msg.id);
    
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }
    
    longPressTimeoutRef.current = setTimeout(() => {
      // Long press triggers options menu
      setActiveMenuMessage(msg);
      setPressingMessageId(null);
      if (navigator.vibrate) {
        navigator.vibrate(40);
      }
    }, 650); // 650ms hold time
  };

  const endPress = (msg: Message, e: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    
    // If released before 650ms and they didn't scroll, activate menu immediately (as regular click)
    if (pressingMessageId === msg.id && !touchMovedRef.current) {
      setActiveMenuMessage(msg);
    }
    
    setPressingMessageId(null);
  };

  const cancelPress = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    setPressingMessageId(null);
  };

  const handleTouchMove = () => {
    touchMovedRef.current = true;
    cancelPress();
  };
  
  // Dialog / Action Menu states
  const [activeMenuMessage, setActiveMenuMessage] = useState<Message | null>(null);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

  // Folguista Candidate states
  const [showCandidatoModal, setShowCandidatoModal] = useState(false);
  const [folgasFormExpanded, setFolgasFormExpanded] = useState(false);
  const [candName, setCandName] = useState(userName || '');
  const [candPhone, setCandPhone] = useState('');
  const [candCnh, setCandCnh] = useState('AD');
  const [customPhotoSelected, setCustomPhotoSelected] = useState<string | null>(null);
  const candidatePhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Comercio IA Ad states
  const [comercioFormExpanded, setComercioFormExpanded] = useState(false);
  const [comercioNome, setComercioNome] = useState('');
  const [comercioProposito, setComercioProposito] = useState('');
  const [comercioContato, setComercioContato] = useState('');
  const [comercioEstilo, setComercioEstilo] = useState('Moderno e Vibrante');
  const [comercioIsGenerating, setComercioIsGenerating] = useState(false);
  const [comercioError, setComercioError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Firestore sync for messages
  useEffect(() => {
    const messagesRef = collection(db, 'channels', channel.id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(80));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList: Message[] = [];
      snapshot.forEach((docSnap) => {
        msgList.push({ id: docSnap.id, ...docSnap.data() } as Message);
      });
      setMessages(msgList);
      
      // Scroll to bottom on load/new messages
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `channels/${channel.id}/messages`);
    });

    return () => unsubscribe();
  }, [channel.id]);

  // Audio Playback Player controller helper
  const AudioPlayer = ({ src, duration }: { src: string; duration: number }) => {
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
      if (audioRef.current) {
        audioRef.current.onended = () => {
          setPlaying(false);
          setProgress(0);
        };
        audioRef.current.ontimeupdate = () => {
          if (audioRef.current) {
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
          }
        };
      }
    }, [src]);

    const togglePlay = () => {
      if (!audioRef.current) return;
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        audioRef.current.play();
        setPlaying(true);
      }
    };

    return (
      <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl w-full max-w-[280px]">
        <audio ref={audioRef} src={src} className="hidden" />
        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition shadow-md cursor-pointer"
        >
          {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} className="ml-0.5" fill="currentColor" />}
        </button>

        <div className="flex-1 flex flex-col gap-1.5">
          {/* Waveform Visualization mockup reacting to time update */}
          <div className="flex items-center gap-[3px] h-6 overflow-hidden">
            {Array.from({ length: 28 }).map((_, i) => {
              // Custom wave pattern heights
              const h = [10, 16, 22, 14, 8, 12, 18, 24, 16, 12, 20, 26, 14, 10, 16, 22, 12, 8, 18, 24, 14, 10, 20, 16, 12, 18, 14, 10][i];
              const isPast = progress > (i / 28) * 100;
              return (
                <div
                  key={i}
                  className={`w-[2.5px] rounded-full transition-colors duration-150`}
                  style={{
                    height: `${h}px`,
                    backgroundColor: isPast ? '#3b82f6' : 'rgba(255, 255, 255, 0.25)'
                  }}
                />
              );
            })}
          </div>

          <div className="flex justify-between items-center text-[10px] text-gray-500 font-semibold font-mono">
            <span>{playing && audioRef.current ? formatTime(audioRef.current.currentTime) : '0:00'}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    );
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Channel Specific Elements
  const getChannelIcon = () => {
    const props = { size: 24, className: 'text-white' };
    switch (channel.icon) {
      case 'ship':
        return <Ship {...props} />;
      case 'truck':
        return <Truck {...props} />;
      case 'calendar':
        return <Calendar {...props} />;
      case 'store':
        return <Store {...props} />;
      default:
        return <Ship {...props} />;
    }
  };

  const getPillColor = () => {
    switch (channel.id) {
      case 'porto':
        return 'bg-blue-600/30 text-blue-300 border-blue-500/20';
      case 'motoristas':
        return 'bg-orange-600/30 text-orange-300 border-orange-500/20';
      case 'folgas':
        return 'bg-purple-600/30 text-purple-300 border-purple-500/20';
      case 'comercio':
        return 'bg-green-600/30 text-green-300 border-green-500/20';
      default:
        return 'bg-blue-600/30 text-blue-300';
    }
  };

  // Send message
  const handleSendMessage = async (options?: { imageUrl?: string; audioUrl?: string; audioDuration?: number }) => {
    if (!inputText.trim() && !options?.imageUrl && !options?.audioUrl) return;

    const messagesRef = collection(db, 'channels', channel.id, 'messages');
    
    const messageData: any = {
      userId,
      userName,
      userAvatar,
      userRole: 'driver',
      text: inputText.trim(),
      createdAt: Date.now(),
    };

    if (options?.imageUrl) {
      messageData.imageUrl = options.imageUrl;
    }
    if (options?.audioUrl) {
      messageData.audioUrl = options.audioUrl;
      messageData.audioDuration = options.audioDuration;
    }

    if (replyMessage) {
      messageData.replyTo = {
        messageId: replyMessage.id,
        userName: replyMessage.userName,
        text: replyMessage.text,
      };
    } else {
      messageData.replyTo = null;
    }

    try {
      await addDoc(messagesRef, messageData);
      setInputText('');
      setReplyMessage(null);
      setShowAttachMenu(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `channels/${channel.id}/messages`);
    }
  };

  // Image attach file handler
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      handleSendMessage({ imageUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPresetImage = (url: string) => {
    handleSendMessage({ imageUrl: url });
  };

  // Audio recording handlers
  const handleAudioComplete = (audioBase64: string, durationSec: number) => {
    handleSendMessage({ audioUrl: audioBase64, audioDuration: durationSec });
    setIsRecordingAudio(false);
  };

  // Message Operations
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setActiveMenuMessage(null);
  };

  const handleStartEdit = (message: Message) => {
    setEditMessage(message);
    setInputText(message.text);
    setActiveMenuMessage(null);
  };

  const handleSaveEdit = async () => {
    if (!editMessage || !inputText.trim()) return;

    try {
      const docRef = doc(db, 'channels', channel.id, 'messages', editMessage.id);
      await updateDoc(docRef, {
        text: inputText.trim(),
        edited: true,
      });
      setInputText('');
      setEditMessage(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `channels/${channel.id}/messages/${editMessage.id}`);
    }
  };

  const handleDeleteMessage = async (allForEveryone: boolean) => {
    if (!activeMenuMessage) return;

    try {
      const docRef = doc(db, 'channels', channel.id, 'messages', activeMenuMessage.id);
      if (allForEveryone) {
        await deleteDoc(docRef);
      } else {
        // "Delete for me" simulation inside UI
        setMessages((prev) => prev.filter((m) => m.id !== activeMenuMessage.id));
      }
      setShowDeleteSheet(false);
      setActiveMenuMessage(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `channels/${channel.id}/messages/${activeMenuMessage.id}`);
    }
  };

  const handleQuickDeleteMessage = async (messageId: string) => {
    try {
      const docRef = doc(db, 'channels', channel.id, 'messages', messageId);
      await deleteDoc(docRef);
      triggerToast('Mensagem excluída com sucesso.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `channels/${channel.id}/messages/${messageId}`);
    }
  };

  const handleCandidatePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setCustomPhotoSelected(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmCandidatura = async () => {
    if (!candName.trim()) {
      triggerToast('Por favor, digite seu nome.');
      return;
    }

    if (!candPhone.trim()) {
      triggerToast('Por favor, digite seu número de telefone.');
      return;
    }

    if (!customPhotoSelected) {
      triggerToast('Por favor, envie uma foto do seu rosto da galeria.');
      return;
    }

    const messagesRef = collection(db, 'channels', channel.id, 'messages');
    
    const messageData = {
      userId,
      userName,
      userAvatar,
      userRole: 'driver',
      text: `Olá pessoal! Me cadastrei como folguista disponível para cobrir escalas. CNH Categoria ${candCnh}.`,
      createdAt: Date.now(),
      isFolguistaCandidate: true,
      candidateName: candName.trim(),
      candidateCnh: candCnh,
      candidatePhoto: customPhotoSelected,
      candidatePhone: candPhone.trim(),
      likes: []
    };

    try {
      await addDoc(messagesRef, messageData);
      setShowCandidatoModal(false);
      setFolgasFormExpanded(false);
      // Reset form states
      setCandName(userName || '');
      setCandPhone('');
      setCandCnh('AD');
      setCustomPhotoSelected(null);
      triggerToast('Candidatura enviada com sucesso! 🚍');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `channels/${channel.id}/messages`);
    }
  };

  const handleGenerateComercioAd = async () => {
    if (!comercioNome.trim()) {
      triggerToast('Por favor, insira o nome do estabelecimento.');
      return;
    }
    if (!comercioProposito.trim()) {
      triggerToast('Por favor, preencha o propósito ou descrição.');
      return;
    }

    setComercioIsGenerating(true);
    setComercioError('');

    try {
      const response = await fetch('/api/generate-comercio-ad', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: comercioNome.trim(),
          proposito: comercioProposito.trim(),
          contato: comercioContato.trim(),
          estilo: comercioEstilo,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao conectar com o servidor da IA.');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      // Add to Firestore messages
      const messagesRef = collection(db, 'channels', 'comercio', 'messages');
      await addDoc(messagesRef, {
        userId,
        userName,
        userAvatar,
        userRole: 'driver',
        text: data.adText,
        imageUrl: data.imageUrl,
        createdAt: Date.now(),
        isComercioAd: true,
        businessName: comercioNome.trim(),
        likes: []
      });

      // Reset form & states
      setComercioNome('');
      setComercioProposito('');
      setComercioContato('');
      setComercioFormExpanded(false);
      triggerToast('Propaganda gerada pela IA e enviada com sucesso! 🛍️✨');

    } catch (err: any) {
      console.error(err);
      setComercioError(err.message || 'Erro inesperado ao gerar a propaganda.');
      triggerToast('Ocorreu um erro ao gerar a propaganda.');
    } finally {
      setComercioIsGenerating(false);
    }
  };

  const handleLikeCandidate = async (messageId: string, currentLikes: string[] = []) => {
    const docRef = doc(db, 'channels', channel.id, 'messages', messageId);
    const hasLiked = currentLikes.includes(userId);
    const updatedLikes = hasLiked 
      ? currentLikes.filter(id => id !== userId)
      : [...currentLikes, userId];
    try {
      await updateDoc(docRef, { likes: updatedLikes });
      triggerToast(hasLiked ? 'Recomendação removida.' : 'Obrigado por recomendar! 👍');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `channels/${channel.id}/messages/${messageId}`);
    }
  };

  const getPinnedMessage = () => {
    switch (channel.id) {
      case 'porto':
        return 'Manutenção programada na rampa de triagem para amanhã às 22h.';
      case 'motoristas':
        return 'Pátio 3 operando com alta densidade de carretas. Prefira desvio.';
      case 'folgas':
        return 'Plantão de trocas aberto para o próximo feriado nacional.';
      case 'comercio':
        return 'Marmitaria Central oferece 15% de desconto para motoristas credenciados.';
      default:
        return 'Confira as regras e atualizações do canal fixadas.';
    }
  };

  return (
    <div className="min-h-screen bg-porto-dark text-white flex flex-col justify-between relative overflow-hidden font-sans">
      
      {/* Header bar */}
      <div className="px-4 py-4.5 bg-porto-blue/90 border-b border-white/5 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center transition cursor-pointer"
          >
            <ArrowLeft size={20} className="text-gray-400 hover:text-white" />
          </button>

          {/* Styled Avatar/Icon Box */}
          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md border border-white/10">
            {getChannelIcon()}
          </div>

          <div>
            <h1 className="text-sm font-bold font-display uppercase tracking-wider text-white">
              {channel.name}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                <Users size={10} />
                128 ONLINE
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main chat layout */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 relative" ref={messageListRef}>

        {/* Message List */}
        <div className="flex-1 flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-gray-500 gap-2">
              <span className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400">
                💬
              </span>
              <p className="text-xs font-semibold uppercase tracking-wider">Nenhuma mensagem neste canal</p>
              <p className="text-[11px] text-gray-600">Seja o primeiro a enviar uma mensagem!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.userId === userId;
              const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              if (msg.isFolguistaCandidate) {
                const currentLikes = msg.likes || [];
                const hasLiked = currentLikes.includes(userId);

                let whatsappUrl = '';
                if (msg.candidatePhone) {
                  const cleanNumber = msg.candidatePhone.replace(/\D/g, '');
                  let whatsappNumber = cleanNumber;
                  if (whatsappNumber.length === 10 || whatsappNumber.length === 11) {
                    whatsappNumber = '55' + whatsappNumber;
                  }
                  whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                    `Olá, ${msg.candidateName}! Vi seu cadastro de folguista (CNH Categoria ${msg.candidateCnh}) no PortoConecta e gostaria de falar sobre uma escala.`
                  )}`;
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 w-full max-w-[95%] sm:max-w-[85%] ${isOwn ? 'self-end flex-row-reverse' : 'self-start'}`}
                  >
                    {/* Sender Avatar */}
                    <img
                      src={msg.userAvatar}
                      alt={msg.userName}
                      className="w-9 h-9 rounded-full object-cover border border-white/10 self-end shrink-0"
                      referrerPolicy="no-referrer"
                    />

                    {/* Candidate Message Body */}
                    <div className="flex flex-col gap-1 w-full max-w-sm">
                      {/* Header: Name & Time */}
                      <div className={`flex items-center gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-[11px] font-bold tracking-wide uppercase ${isOwn ? 'text-orange-400' : 'text-blue-400'}`}>
                          {msg.userName} <span className="text-[9px] text-gray-500 font-normal normal-case">(Candidato)</span>
                        </span>
                        <span className="text-[9px] text-gray-500 font-semibold font-mono">{formattedTime}</span>
                      </div>

                      {/* Speech bubble/Card */}
                      <div className={`flex items-start gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} w-full`}>
                        <div
                          className={`flex-1 bg-gradient-to-br from-[#0B1E36]/90 to-[#030914]/95 border border-orange-500/30 rounded-[24px] p-4 shadow-[0_4px_20px_rgba(255,122,0,0.08)] flex flex-col gap-3.5 w-full ${
                            isOwn ? 'rounded-br-none' : 'rounded-bl-none'
                          }`}
                        >
                          {/* Top badge */}
                          <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-orange-500/10 text-[#FF7A00] border border-orange-500/20 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              Candidato a Folguista
                            </span>
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-sans">PortoConecta</span>
                          </div>

                          {/* Profile details */}
                          <div className="flex items-center gap-3.5">
                            {/* Face picture */}
                            <div className="relative shrink-0">
                              <img
                                src={msg.candidatePhoto || msg.userAvatar}
                                alt={msg.candidateName}
                                className="w-14 h-14 rounded-2xl object-cover border-2 border-orange-500/40 shadow-md bg-[#030914]"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#030914] border border-orange-500/20 flex items-center justify-center text-xs">
                                🚍
                              </div>
                            </div>

                            {/* Name and CNH */}
                            <div className="flex flex-col gap-1 min-w-0 animate-pulse-slow">
                              <h4 className="text-sm font-bold text-white truncate leading-tight font-sans">
                                {msg.candidateName}
                              </h4>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400 uppercase tracking-wider shrink-0">
                                  CNH Cat. {msg.candidateCnh}
                                </span>
                                {whatsappUrl && (
                                  <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-0.5 rounded bg-[#25D366]/10 border border-[#25D366]/30 text-[9px] font-bold text-[#25D366] flex items-center gap-1.5 hover:bg-[#25D366]/20 transition duration-150 cursor-pointer shrink-0"
                                    title="Chamar no WhatsApp"
                                  >
                                    <svg className="w-3 h-3 fill-current text-[#25D366]" viewBox="0 0 24 24">
                                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.864.002-2.637-1.017-5.114-2.871-6.973-1.854-1.859-4.331-2.88-6.967-2.881-5.441 0-9.865 4.42-9.869 9.864-.001 1.768.462 3.49 1.342 5.011l-.982 3.593 3.684-.966zm10.741-6.975c-.279-.14-1.651-.815-1.907-.907-.256-.092-.442-.14-.627.14-.185.28-.717.907-.88 1.092-.163.186-.326.208-.605.068-.279-.14-1.18-.435-2.247-1.388-.83-.74-1.39-1.653-1.553-1.933-.163-.28-.018-.431.122-.571.125-.125.279-.326.418-.489.14-.163.186-.28.279-.465.093-.186.046-.349-.023-.489-.069-.14-.627-1.511-.859-2.07-.227-.546-.456-.473-.627-.482-.162-.008-.349-.01-.535-.01-.186 0-.489.07-.745.349-.256.28-.977.954-.977 2.329 0 1.375 1.001 2.702 1.14 2.888.14.186 1.969 3.007 4.77 4.215.666.287 1.186.458 1.59.587.67.213 1.28.183 1.762.111.537-.08 1.651-.675 1.884-1.326.233-.651.233-1.209.163-1.326-.07-.116-.256-.208-.535-.349z"/>
                                    </svg>
                                    <span>WhatsApp</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Candidate introduction message */}
                          {msg.text && (
                            <p className="text-xs text-gray-300 leading-relaxed font-medium bg-black/25 px-3 py-2.5 rounded-xl border border-white/5 whitespace-pre-wrap">
                              {msg.text}
                            </p>
                          )}

                          {/* Like Button Row */}
                          <div className="flex items-center justify-between gap-3 pt-1">
                            <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">
                              👍 {currentLikes.length} {currentLikes.length === 1 ? 'voto' : 'votos'}
                            </span>

                            <button
                              onClick={() => handleLikeCandidate(msg.id, currentLikes)}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition duration-150 active:scale-95 border cursor-pointer ${
                                hasLiked
                                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/30 shadow-[0_0_10px_rgba(255,122,0,0.1)]'
                                  : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <span>👍</span>
                              <span>{hasLiked ? 'Gostei' : 'Bom Motorista'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Trash Delete Icon if owner */}
                        {isOwn && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickDeleteMessage(msg.id);
                            }}
                            className="p-2 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 active:scale-90 transition-all duration-150 cursor-pointer flex-shrink-0 flex items-center justify-center border border-white/5 bg-white/[0.01]"
                            title="Excluir candidatura"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-[85%] ${isOwn ? 'self-end flex-row-reverse' : 'self-start'}`}
                >
                  {/* Sender Avatar */}
                  <img
                    src={msg.userAvatar}
                    alt={msg.userName}
                    className="w-9 h-9 rounded-full object-cover border border-white/10 self-end"
                    referrerPolicy="no-referrer"
                  />

                  {/* Message Body */}
                  <div className="flex flex-col gap-1">
                    {/* Header: Name & Time */}
                    <div className={`flex items-center gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <span className={`text-[11px] font-bold tracking-wide uppercase ${isOwn ? 'text-orange-400' : 'text-blue-400'}`}>
                        {msg.userName}
                      </span>
                      <span className="text-[9px] text-gray-500 font-semibold font-mono">{formattedTime}</span>
                    </div>

                    {/* Speech bubble wrapped with immediate trash delete button */}
                    <div className={`flex items-center gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Speech card bubble with press & hold (long press) detection */}
                      <motion.div
                        onMouseDown={() => startPress(msg)}
                        onMouseUp={(e) => endPress(msg, e)}
                        onMouseLeave={cancelPress}
                        onTouchStart={() => startPress(msg)}
                        onTouchEnd={(e) => endPress(msg, e)}
                        onTouchMove={handleTouchMove}
                        animate={pressingMessageId === msg.id ? { 
                          scale: 0.95, 
                          borderColor: 'rgba(59, 130, 246, 0.5)',
                          boxShadow: '0 0 20px rgba(59, 130, 246, 0.35)' 
                        } : { 
                          scale: 1 
                        }}
                        transition={{ duration: 0.12, ease: "easeOut" }}
                        className={`glass-card rounded-[20px] p-3.5 shadow-md border cursor-pointer hover:border-white/15 transition-all duration-200 select-none relative ${
                          isOwn
                            ? 'bg-porto-blue border-orange-500/10 rounded-br-none'
                            : 'bg-white/[0.03] border-white/5 rounded-bl-none'
                        }`}
                      >
                        {/* Visual hold loading indicator */}
                        {pressingMessageId === msg.id && (
                          <motion.div 
                            className="absolute bottom-0 left-0 h-1 bg-cyan-400 rounded-b-full"
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 0.65, ease: "linear" }}
                          />
                        )}

                        {/* Replying Context Indicator */}
                        {msg.replyTo && (
                          <div 
                            className="mb-2 pl-2.5 border-l-2 border-orange-500 text-[10px] text-gray-400 bg-white/5 py-1 px-2 rounded-md flex flex-col"
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                          >
                            <span className="font-bold text-orange-400 uppercase tracking-wider">{msg.replyTo.userName}</span>
                            <span className="truncate mt-0.5">{msg.replyTo.text}</span>
                          </div>
                        )}

                        {/* Attached Image Content */}
                        {msg.imageUrl && (
                          <div 
                            className="rounded-xl overflow-hidden mb-2 max-w-[240px] border border-white/5 shadow-md"
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                          >
                            <img
                              src={msg.imageUrl}
                              alt="Attached file"
                              className="w-full h-auto object-cover max-h-48 hover:opacity-90 transition cursor-zoom-in"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowImageModal(true);
                              }}
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}

                        {/* Audio voice content player */}
                        {msg.audioUrl && (
                          <div 
                            className="mb-2" 
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                          >
                            <AudioPlayer src={msg.audioUrl} duration={msg.audioDuration || 5} />
                          </div>
                        )}

                        {/* Text content */}
                        {msg.text && (
                          <p className="text-xs text-gray-200 leading-relaxed break-words whitespace-pre-wrap font-medium">
                            {msg.text}
                          </p>
                        )}

                        {msg.edited && (
                          <span className="text-[9px] text-gray-600 font-bold uppercase tracking-wider mt-1 block text-right">
                            Editado
                          </span>
                        )}
                      </motion.div>

                      {/* Direct click to delete trash icon */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickDeleteMessage(msg.id);
                        }}
                        className="p-2 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 active:scale-90 transition-all duration-150 cursor-pointer flex-shrink-0 flex items-center justify-center border border-white/5 bg-white/[0.01]"
                        title="Excluir mensagem"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Reply indicator widget */}
      {replyMessage && (
        <div className="px-4 py-2 bg-porto-blue border-t border-white/5 flex items-center justify-between z-10 animate-slide-up">
          <div className="flex items-center gap-2 pl-2.5 border-l-2 border-orange-500">
            <CornerUpLeft size={14} className="text-orange-500" />
            <div className="flex flex-col text-xs">
              <span className="font-bold text-orange-400 uppercase tracking-wider">Respondendo a {replyMessage.userName}</span>
              <span className="text-gray-400 truncate max-w-[280px]">{replyMessage.text}</span>
            </div>
          </div>
          <button
            onClick={() => setReplyMessage(null)}
            className="w-6 h-6 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Edit indicator widget */}
      {editMessage && (
        <div className="px-4 py-2 bg-porto-blue border-t border-white/5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 pl-2.5 border-l-2 border-orange-500">
            <Edit3 size={14} className="text-orange-500" />
            <div className="flex flex-col text-xs">
              <span className="font-bold text-orange-400 uppercase tracking-wider">Editando Mensagem</span>
              <span className="text-gray-400 truncate max-w-[280px]">{editMessage.text}</span>
            </div>
          </div>
          <button
            onClick={() => {
              setEditMessage(null);
              setInputText('');
            }}
            className="w-6 h-6 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input controls bar */}
      <div className="p-3 sm:p-4 bg-porto-blue/90 border-t border-white/5 z-10 flex flex-col gap-3">
        {channel.id === 'folgas' ? (
          !folgasFormExpanded ? (
            <div className="w-full max-w-md mx-auto flex justify-center py-1">
              <button
                type="button"
                onClick={() => setFolgasFormExpanded(true)}
                className="w-full flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-orange-500/10 to-orange-600/10 hover:from-orange-500/15 hover:to-orange-600/15 border border-orange-500/20 hover:border-orange-500/40 rounded-2xl text-white text-xs font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-[0_4px_12px_rgba(255,122,0,0.04)] group font-sans"
              >
                <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[#FF7A00] group-hover:bg-orange-500/20 group-hover:scale-105 transition duration-150 shrink-0">
                  <Edit3 size={15} className="filter drop-shadow-[0_0_2px_rgba(255,122,0,0.5)]" />
                </div>
                <div className="flex-1 text-left">
                  <span className="block font-bold tracking-wider uppercase text-[10px]">Fazer cadastro para folguista</span>
                  <span className="block text-[9px] text-gray-400 font-normal mt-0.5">Cadastre sua CNH e WhatsApp para cobrir escalas</span>
                </div>
                <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:bg-white/10 transition shrink-0">
                  <ChevronRight size={14} />
                </div>
              </button>
            </div>
          ) : (
            <div className="w-full max-w-4xl mx-auto flex flex-col gap-3 py-1 font-sans">
              {/* Header / Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚍</span>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">Cadastre-se como Folguista</h3>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Preencha seus dados abaixo para se candidatar às escalas disponíveis</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-[#FF7A00] bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                    Painel do Motorista
                  </span>
                  <button
                    type="button"
                    onClick={() => setFolgasFormExpanded(false)}
                    className="p-1 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition"
                    title="Fechar Painel"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Form grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                {/* Nome */}
                <div className="flex flex-col gap-1 md:col-span-4">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={candName}
                    onChange={(e) => setCandName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full px-3.5 py-2.5 bg-[#030914] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 transition duration-200"
                  />
                </div>

                {/* Telefone */}
                <div className="flex flex-col gap-1 md:col-span-3">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                    WhatsApp (DDD + Número)
                  </label>
                  <input
                    type="tel"
                    value={candPhone}
                    onChange={(e) => setCandPhone(e.target.value)}
                    placeholder="Ex: 13999999999"
                    className="w-full px-3.5 py-2.5 bg-[#030914] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 transition duration-200"
                  />
                </div>

                {/* CNH Category */}
                <div className="flex flex-col gap-1 md:col-span-3">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                    Categoria da CNH
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {['AC', 'AD', 'AE'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCandCnh(cat)}
                        className={`py-2 rounded-lg text-[10px] font-bold transition duration-150 cursor-pointer border ${
                          candCnh === cat
                            ? 'bg-orange-500/10 border-orange-500 text-[#FF7A00] shadow-[0_0_10px_rgba(255,122,0,0.1)]'
                            : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Foto do Rosto */}
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                    Sua Foto de Rosto
                  </label>
                  <div>
                    <button
                      type="button"
                      onClick={() => candidatePhotoInputRef.current?.click()}
                      className={`w-full py-2 px-2.5 border border-dashed rounded-xl flex items-center justify-center gap-1.5 transition duration-150 cursor-pointer text-[10px] font-bold ${
                        customPhotoSelected
                          ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10'
                          : 'border-white/10 hover:border-orange-500/40 bg-white/[0.02] hover:bg-orange-500/[0.02] text-gray-400 hover:text-white'
                      }`}
                    >
                      {customPhotoSelected ? (
                        <>
                          <span className="text-emerald-400">✓</span>
                          <span className="truncate">Foto Carregada</span>
                        </>
                      ) : (
                        <>
                          <span>📷</span>
                          <span className="truncate">Selecionar</span>
                        </>
                      )}
                    </button>
                    <input
                      type="file"
                      ref={candidatePhotoInputRef}
                      accept="image/*"
                      onChange={handleCandidatePhotoChange}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Submit / Cancel Button */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFolgasFormExpanded(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition duration-150 cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCandidatura}
                  className="px-6 py-2 bg-gradient-to-r from-[#FF7A00] to-[#FF9E00] hover:from-[#E06B00] hover:to-[#E08B00] shadow-[0_4px_12px_rgba(255,122,0,0.15)] rounded-xl text-[10px] font-bold uppercase tracking-wider text-white hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-1.5 font-sans"
                >
                  <span>Enviar Candidatura</span>
                  <span>🚍</span>
                </button>
              </div>
            </div>
          )
        ) : channel.id === 'comercio' ? (
          !comercioFormExpanded ? (
            <div className="w-full max-w-md mx-auto flex flex-col gap-3 py-1">
              <button
                type="button"
                onClick={() => setComercioFormExpanded(true)}
                className="w-full flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 hover:from-emerald-500/15 hover:to-emerald-600/15 border border-emerald-500/20 hover:border-emerald-500/40 rounded-2xl text-white text-xs font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.04)] group font-sans animate-fade-in"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 group-hover:scale-105 transition duration-150 shrink-0">
                  <Sparkles size={15} className="filter drop-shadow-[0_0_2px_rgba(16,185,129,0.5)]" />
                </div>
                <div className="flex-1 text-left">
                  <span className="block font-bold tracking-wider uppercase text-[10px]">Anunciar Estabelecimento com IA</span>
                  <span className="block text-[9px] text-gray-400 font-normal mt-0.5">Crie um pôster profissional e uma copy de vendas automaticamente</span>
                </div>
                <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:bg-white/10 transition shrink-0">
                  <ChevronRight size={14} />
                </div>
              </button>

              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      editMessage ? handleSaveEdit() : handleSendMessage();
                    }
                  }}
                  placeholder="Ou digite uma mensagem para conversar..."
                  className="w-full px-4 py-2.5 bg-[#030914] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition duration-200"
                />
                {(inputText.trim().length > 0 || editMessage) && (
                  <button
                    onClick={editMessage ? handleSaveEdit : () => handleSendMessage()}
                    className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center cursor-pointer transition-all duration-150 shrink-0"
                  >
                    <Send size={14} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl mx-auto flex flex-col gap-3 py-1 font-sans">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✨</span>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">Anunciar Estabelecimento</h3>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Preencha os dados e a IA criará sua propaganda com pôster e texto</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                    Propaganda com IA
                  </span>
                  <button
                    type="button"
                    onClick={() => setComercioFormExpanded(false)}
                    className="p-1 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition"
                    title="Fechar Painel"
                    disabled={comercioIsGenerating}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="flex flex-col gap-1 md:col-span-4">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                    Nome do Estabelecimento
                  </label>
                  <input
                    type="text"
                    value={comercioNome}
                    onChange={(e) => setComercioNome(e.target.value)}
                    placeholder="Ex: Pastelaria do Porto, Borracharia Santista..."
                    className="w-full px-3.5 py-2.5 bg-[#030914] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition duration-200"
                    disabled={comercioIsGenerating}
                  />
                </div>

                <div className="flex flex-col gap-1 md:col-span-4">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                    O que vende / Seu propósito
                  </label>
                  <input
                    type="text"
                    value={comercioProposito}
                    onChange={(e) => setComercioProposito(e.target.value)}
                    placeholder="Ex: Pastéis fritos na hora com caldo de cana gelado"
                    className="w-full px-3.5 py-2.5 bg-[#030914] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition duration-200"
                    disabled={comercioIsGenerating}
                  />
                </div>

                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                    Contato / Endereço
                  </label>
                  <input
                    type="text"
                    value={comercioContato}
                    onChange={(e) => setComercioContato(e.target.value)}
                    placeholder="Ex: Whats: 13 9999-9999"
                    className="w-full px-3.5 py-2.5 bg-[#030914] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition duration-200"
                    disabled={comercioIsGenerating}
                  />
                </div>

                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                    Estilo do Pôster
                  </label>
                  <select
                    value={comercioEstilo}
                    onChange={(e) => setComercioEstilo(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#030914] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition duration-200"
                    disabled={comercioIsGenerating}
                  >
                    <option value="Moderno e Vibrante">⚡ Vibrante</option>
                    <option value="Elegante e Clássico">✨ Elegante</option>
                    <option value="Nostálgico/Retro">📻 Retrô</option>
                    <option value="Neon Futurista">🌌 Neon</option>
                    <option value="Rústico/Aconchegante">🪵 Rústico</option>
                  </select>
                </div>
              </div>

              {comercioError && (
                <div className="text-[10px] text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl flex items-center gap-1.5 animate-fade-in">
                  <AlertTriangle size={12} />
                  <span>{comercioError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setComercioFormExpanded(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition duration-150 cursor-pointer"
                  disabled={comercioIsGenerating}
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleGenerateComercioAd}
                  disabled={comercioIsGenerating}
                  className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-emerald-500/50 disabled:to-emerald-600/50 shadow-[0_4px_12px_rgba(16,185,129,0.15)] rounded-xl text-[10px] font-bold uppercase tracking-wider text-white hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-1.5 font-sans"
                >
                  {comercioIsGenerating ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Criando Propaganda...</span>
                    </>
                  ) : (
                    <>
                      <span>Criar com IA</span>
                      <Sparkles size={12} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        ) : (
          <AnimatePresence mode="wait">
            {isRecordingAudio ? (
              <AudioRecorder
                onRecordingComplete={handleAudioComplete}
                onCancel={() => setIsRecordingAudio(false)}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {/* Hidden file input for native gallery selection */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                {/* Main text box send bar */}
                <div className="flex items-center gap-3">

                  {/* Textarea Input Field */}
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          editMessage ? handleSaveEdit() : handleSendMessage();
                        }
                      }}
                      placeholder="Digite sua mensagem"
                      className="w-full pl-5 pr-14 py-4.5 bg-[#030914] border border-white/10 rounded-2xl text-lg sm:text-[19px] text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/40 transition duration-200 font-medium shadow-inner"
                    />
                    
                    {/* Send Button */}
                    {(inputText.trim().length > 0 || editMessage) && (
                      <button
                        onClick={editMessage ? handleSaveEdit : () => handleSendMessage()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-md cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 z-10"
                      >
                        <Send size={18} className="ml-0.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Secondary Media Controller bar with giant hexagonal Microphone Button and continuous glowing wave lines */}
                <div className="flex items-center justify-between w-full px-1 pt-3 border-t border-white/5 relative">
                  
                  {/* Left Attach/Paperclip button with glowing blue circle */}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-11 h-11 rounded-full border border-[#00A2FF] bg-[#030914]/85 hover:bg-blue-950/60 flex items-center justify-center text-[#00A2FF] hover:text-blue-200 transition duration-200 cursor-pointer relative z-10 drop-shadow-[0_0_6px_rgba(0,162,255,0.6)] active:scale-95 hover:scale-105"
                    title="Anexar arquivo"
                  >
                    <Paperclip size={18} className="drop-shadow-[0_0_4px_rgba(0,162,255,0.8)]" />
                  </button>

                  {/* Horizontal continuous wave container with central button */}
                  <div className="flex-1 flex items-center justify-center relative h-16 mx-1 overflow-hidden">
                    
                    {/* Background orange sliding waves spanning the entire width behind the button */}
                    <div className="absolute inset-x-0 inset-y-0 flex items-center select-none pointer-events-none z-0">
                      <svg className="w-full h-12 text-[#00A2FF]" viewBox="0 0 400 100" preserveAspectRatio="none">
                        {/* Curvy Accent Wave Path (Ping-pong Left-to-Right - Dynamic Secondary Accent) */}
                        <motion.path
                          d={curvyWavePath}
                          fill="none"
                          stroke="#00A2FF"
                          strokeWidth="1.2"
                          opacity="0.6"
                          className="drop-shadow-[0_0_8px_rgba(0,162,255,0.75)]"
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
                          stroke="#00A2FF"
                          strokeWidth="1.2"
                          opacity="0.6"
                          className="drop-shadow-[0_0_8px_rgba(0,162,255,0.75)]"
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
                          stroke="#00A2FF"
                          strokeWidth="1.3"
                          opacity="0.45"
                          className="drop-shadow-[0_0_8px_rgba(0,162,255,0.75)]"
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
                          stroke="#00A2FF"
                          strokeWidth="1.3"
                          opacity="0.45"
                          className="drop-shadow-[0_0_8px_rgba(0,162,255,0.75)]"
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
                          stroke="#00A2FF"
                          strokeWidth="0.9"
                          opacity="0.3"
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
                          stroke="#00A2FF"
                          strokeWidth="0.9"
                          opacity="0.3"
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

                    {/* Central Circular Badge trigger */}
                    <div className="relative w-16 h-16 flex items-center justify-center z-10 select-none">
                      {/* Pulsing neon glow behind the button */}
                      <motion.div
                        className="absolute w-14 h-14 bg-[#00A2FF]/10 rounded-full blur-md"
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 0.8, 0.5]
                        }}
                        transition={{
                          duration: 2.0,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />

                      {/* Pure Mic Action trigger (Circular) */}
                      <button
                        onClick={() => setIsRecordingAudio(true)}
                        className="w-13 h-13 rounded-full border border-[#00A2FF] bg-[#030914]/85 hover:bg-blue-950/60 flex items-center justify-center text-[#00A2FF] hover:text-blue-200 transition duration-200 cursor-pointer relative z-20 active:scale-95 hover:scale-105 drop-shadow-[0_0_8px_rgba(0,162,255,0.8)]"
                        title="Gravar áudio"
                      >
                        {/* Elegant glowing circle around the mic icon inside the button */}
                        <div className="absolute w-9 h-9 rounded-full border border-[#00A2FF]/40 bg-blue-950/20 shadow-[0_0_6px_rgba(0,162,255,0.5)] animate-pulse flex items-center justify-center pointer-events-none" />
                        <Mic size={18} className="relative z-10 drop-shadow-[0_0_6px_rgba(0,162,255,0.95)]" />
                      </button>
                    </div>

                  </div>

                  {/* Right Gallery button with glowing blue circle */}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-11 h-11 rounded-full border border-[#00A2FF] bg-[#030914]/85 hover:bg-blue-950/60 flex items-center justify-center text-[#00A2FF] hover:text-blue-200 transition duration-200 cursor-pointer relative z-10 drop-shadow-[0_0_6px_rgba(0,162,255,0.6)] active:scale-95 hover:scale-105"
                    title="Abrir galeria"
                  >
                    <ImageIcon size={18} className="drop-shadow-[0_0_4px_rgba(0,162,255,0.8)]" />
                  </button>

                </div>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Elegant Holding/Tap Message Context Actions Dialog */}
      <AnimatePresence>
        {activeMenuMessage && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm glass-card border-white/10 rounded-[24px] p-5 shadow-2xl relative"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2.5">
                  <img
                    src={activeMenuMessage.userAvatar}
                    alt={activeMenuMessage.userName}
                    className="w-9 h-9 rounded-full object-cover border border-white/10"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider">Opções da Mensagem</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5">Enviada por {activeMenuMessage.userName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveMenuMessage(null)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Message text snippet */}
              <div className="bg-white/[0.03] border border-white/5 p-3 rounded-xl text-xs text-gray-300 italic mb-5 leading-relaxed truncate max-h-16">
                {activeMenuMessage.text 
                  ? `"${activeMenuMessage.text}"` 
                  : activeMenuMessage.imageUrl 
                    ? "📁 [Mensagem de Imagem]" 
                    : activeMenuMessage.audioUrl 
                      ? "🎙️ [Mensagem de Voz]" 
                      : "Mensagem multimídia"}
              </div>

              {/* Menu items */}
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => {
                    setReplyMessage(activeMenuMessage);
                    setActiveMenuMessage(null);
                  }}
                  className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-left flex items-center gap-3 transition"
                >
                  <CornerUpLeft size={15} className="text-gray-400" />
                  Responder
                </button>

                {activeMenuMessage.userId === userId && activeMenuMessage.text && (
                  <button
                    onClick={() => handleStartEdit(activeMenuMessage)}
                    className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-left flex items-center gap-3 transition"
                  >
                    <Edit3 size={15} className="text-gray-400" />
                    Editar
                  </button>
                )}
                
                {activeMenuMessage.text && (
                  <button
                    onClick={() => handleCopyText(activeMenuMessage.text)}
                    className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-left flex items-center gap-3 transition"
                  >
                    <Copy size={15} className="text-gray-400" />
                    Copiar Conteúdo
                  </button>
                )}

                {/* Always allow deleting any text, image, or voice message */}
                <button
                  onClick={() => setShowDeleteSheet(true)}
                  className="w-full px-4 py-3 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-xs font-bold uppercase tracking-wider text-red-400 text-left flex items-center gap-3 border border-red-500/10 transition"
                >
                  <Trash2 size={15} className="text-red-400" />
                  Excluir Mensagem
                </button>

                {activeMenuMessage.userId !== userId && (
                  <button
                    onClick={() => {
                      triggerToast('Mensagem denunciada com sucesso para a equipe de moderação.');
                      setActiveMenuMessage(null);
                    }}
                    className="w-full px-4 py-3 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl text-xs font-bold uppercase tracking-wider text-amber-400 text-left flex items-center gap-3 border border-amber-500/10 transition"
                  >
                    <AlertTriangle size={15} className="text-amber-400" />
                    Denunciar Abuso
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deletion elegant bottom sheet dialog */}
      <AnimatePresence>
        {showDeleteSheet && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center">
            {/* Overlay click to cancel */}
            <div className="absolute inset-0" onClick={() => setShowDeleteSheet(false)} />
            
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-full max-w-md bg-porto-blue rounded-t-[32px] border-t border-white/10 p-6 z-10 relative flex flex-col gap-4 shadow-2xl"
            >
              {/* Top notch indicator bar */}
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-2" />

              <h4 className="text-sm font-bold uppercase tracking-wider text-white text-center">
                Excluir mensagem permanente?
              </h4>
              <p className="text-xs text-gray-400 text-center leading-relaxed">
                Essa ação é permanente e removerá o conteúdo dos servidores do porto.
              </p>

              <div className="flex flex-col gap-2.5 mt-2">
                <button
                  onClick={() => handleDeleteMessage(false)}
                  className="w-full py-3.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-white transition cursor-pointer"
                >
                  Excluir para mim
                </button>

                <button
                  onClick={() => handleDeleteMessage(true)}
                  className="w-full py-3.5 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-red-600/20 transition cursor-pointer"
                >
                  Excluir para todos
                </button>

                <button
                  onClick={() => setShowDeleteSheet(false)}
                  className="w-full py-3.5 bg-transparent text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-white transition cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom elegant toast feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-28 left-4 right-4 z-[100] flex justify-center pointer-events-none"
          >
            <div className="bg-[#030914]/95 border border-cyan-400/30 text-white rounded-[20px] px-5 py-3.5 shadow-[0_0_25px_rgba(0,240,255,0.2)] flex items-center gap-2.5 max-w-sm pointer-events-auto backdrop-blur-md">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
              <span className="text-xs font-bold tracking-wide text-gray-200">{toastMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Folguista Candidate Modal */}
      <AnimatePresence>
        {showCandidatoModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            {/* Click outside to cancel */}
            <div className="absolute inset-0" onClick={() => setShowCandidatoModal(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-md bg-gradient-to-b from-[#0B1E36] to-[#030914] border border-orange-500/30 rounded-[32px] p-6 shadow-2xl relative z-10 my-8 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[#FF7A00]">
                    🚍
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">Candidatura de Folguista</h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">Cadastre seus dados para cobrir escalas</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCandidatoModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Form Content */}
              <div className="flex flex-col gap-4">
                {/* Nome */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Nome do Motorista
                  </label>
                  <input
                    type="text"
                    value={candName}
                    onChange={(e) => setCandName(e.target.value)}
                    placeholder="Digite seu nome completo"
                    className="w-full px-4 py-3 bg-[#030914] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 transition duration-200"
                  />
                </div>

                {/* Telefone */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Número de Telefone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={candPhone}
                    onChange={(e) => setCandPhone(e.target.value)}
                    placeholder="Ex: (13) 99999-9999"
                    className="w-full px-4 py-3 bg-[#030914] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 transition duration-200"
                  />
                </div>

                {/* Categoria CNH */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Categoria da CNH
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['AC', 'AD', 'AE'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCandCnh(cat)}
                        className={`py-2.5 rounded-xl text-xs font-bold transition duration-150 cursor-pointer border ${
                          candCnh === cat
                            ? 'bg-orange-500/10 border-orange-500 text-[#FF7A00] shadow-[0_0_10px_rgba(255,122,0,0.1)]'
                            : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Foto do Rosto */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Foto do Rosto
                  </label>
                  
                  {/* Gallery photo uploader */}
                  <div className="flex flex-col items-center justify-center">
                    {customPhotoSelected ? (
                      <div className="relative w-32 h-32 rounded-2xl overflow-hidden border-2 border-orange-500/40 shadow-lg group bg-[#030914]">
                        <img 
                          src={customPhotoSelected} 
                          className="w-full h-full object-cover" 
                          alt="Sua foto" 
                          referrerPolicy="no-referrer" 
                        />
                        <button
                          type="button"
                          onClick={() => candidatePhotoInputRef.current?.click()}
                          className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition duration-150 text-white text-[10px] font-bold uppercase tracking-wider gap-1 cursor-pointer"
                        >
                          <span>📷</span>
                          <span>Alterar Foto</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => candidatePhotoInputRef.current?.click()}
                        className="w-full py-8 border-2 border-dashed border-white/10 hover:border-orange-500/40 rounded-2xl bg-white/[0.02] hover:bg-orange-500/[0.02] flex flex-col items-center justify-center gap-2 transition duration-150 cursor-pointer text-gray-400 hover:text-white"
                      >
                        <span className="text-2xl">🖼️</span>
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-300">Escolher da Galeria</span>
                          <span className="text-[10px] text-gray-500">Toque para selecionar sua foto</span>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Hidden Input file */}
                  <input
                    type="file"
                    ref={candidatePhotoInputRef}
                    accept="image/*"
                    onChange={handleCandidatePhotoChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2.5 border-t border-white/5 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCandidatoModal(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCandidatura}
                  className="flex-1 py-3 bg-gradient-to-r from-[#FF7A00] to-[#FF9E00] hover:from-[#E06B00] hover:to-[#E08B00] shadow-[0_4px_15px_rgba(255,122,0,0.15)] rounded-xl text-xs font-bold uppercase tracking-wider text-white hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
                >
                  Confirmar (OK)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
