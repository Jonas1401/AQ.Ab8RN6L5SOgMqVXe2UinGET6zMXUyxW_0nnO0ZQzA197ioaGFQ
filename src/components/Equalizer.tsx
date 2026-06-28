import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, CheckCircle } from 'lucide-react';

export default function Equalizer() {
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'recognized'>('idle');
  const [transcription, setTranscription] = useState('');

  useEffect(() => {
    if (voiceState === 'listening') {
      const timer = setTimeout(() => {
        setVoiceState('recognized');
        const commands = [
          'Solicitar folga para amanhã',
          'Verificar tráfego no Terminal Sul',
          'Enviar mensagem para Canal Porto',
          'Consultar escalas de Julho'
        ];
        const randomCommand = commands[Math.floor(Math.random() * commands.length)];
        setTranscription(randomCommand);
      }, 2500);
      return () => clearTimeout(timer);
    } else if (voiceState === 'recognized') {
      const timer = setTimeout(() => {
        setVoiceState('idle');
        setTranscription('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [voiceState]);

  // Symmetrical vocal equalizer bars heights/scales inside the orange circle
  const barVariants = {
    animate: (custom: number) => {
      const listeningSequence = [
        [0.5, 1.0, 0.7, 1.2, 0.9, 0.5],
        [0.7, 0.9, 1.2, 0.6, 1.0, 0.7],
        [0.4, 1.1, 0.6, 1.2, 0.8, 0.4]
      ];
      
      const sequence = [
        [0.3, 0.9, 0.4, 1.0, 0.6, 0.3],
        [0.4, 0.6, 1.0, 0.3, 0.8, 0.4],
        [0.2, 0.8, 0.3, 0.9, 0.5, 0.2],
        [0.5, 1.0, 0.4, 0.7, 0.3, 0.5]
      ];
      
      const heights = voiceState === 'listening' 
        ? listeningSequence[custom % listeningSequence.length]
        : sequence[custom % sequence.length];
      
      return {
        scaleY: heights,
        transition: {
          duration: (voiceState === 'listening' ? 0.6 : 1.2) + (custom * 0.1),
          repeat: Infinity,
          ease: "easeInOut",
        }
      };
    }
  };

  // High-fidelity organically shaped wavy signal path
  const wavePath = "M -400 50 L -370 50 Q -360 47, -350 50 T -330 50 Q -320 55, -310 50 Q -295 36, -280 50 Q -270 60, -260 50 L -220 50 Q -210 42, -200 50 T -180 50 Q -165 64, -150 50 Q -140 38, -130 50 L -80 50 Q -65 42, -50 50 Q -40 58, -30 50 L 0 50 L 30 50 Q 40 47, 50 50 T 70 50 Q 80 55, 90 50 Q 105 36, 120 50 Q 130 60, 140 50 L 180 50 Q 190 42, 200 50 T 220 50 Q 235 64, 250 50 Q 260 38, 270 50 L 320 50 Q 335 42, 350 50 Q 360 58, 370 50 L 400 50 L 430 50 Q 440 47, 450 50 T 470 50 Q 480 55, 490 50 Q 505 36, 520 50 Q 530 60, 540 50 L 580 50 Q 590 42, 600 50 T 620 50 Q 635 64, 650 50 Q 660 38, 670 50 L 720 50 Q 735 42, 750 50 Q 760 58, 770 50 L 800 50";
  const curvyWavePath = "M -400 50 L -370 50 Q -360 32, -350 50 T -330 50 Q -320 68, -310 50 Q -295 18, -280 50 Q -270 82, -260 50 L -220 50 Q -210 28, -200 50 T -180 50 Q -165 85, -150 50 Q -140 15, -130 50 L -80 50 Q -65 24, -50 50 Q -40 76, -30 50 L 0 50 L 30 50 Q 40 32, 50 50 T 70 50 Q 80 68, 90 50 Q 105 18, 120 50 Q 130 82, 140 50 L 180 50 Q 190 28, 200 50 T 220 50 Q 235 85, 250 50 Q 260 15, 270 50 L 320 50 Q 335 24, 350 50 Q 360 76, 370 50 L 400 50 L 430 50 Q 440 32, 450 50 T 470 50 Q 480 68, 490 50 Q 505 18, 520 50 Q 530 82, 540 50 L 580 50 Q 590 28, 600 50 T 620 50 Q 635 85, 650 50 Q 660 15, 670 50 L 720 50 Q 735 24, 750 50 Q 760 76, 770 50 L 800 50";

  return (
    <div className="w-full bg-[#030914]/40 border border-white/5 rounded-[24px] p-2 flex flex-col items-center justify-center relative overflow-hidden h-[95px] shadow-[0_0_20px_rgba(255,122,0,0.03)] transition-all duration-300">
      
      {/* 1. HIGH-FIDELITY 6-LAYER PARALLAX BACKGROUND SIGNAL WAVES (ORANGE GLOW) */}
      <div className="absolute inset-x-0 inset-y-0 flex items-center w-full px-0 select-none pointer-events-none z-0 opacity-45">
        <svg className="w-full h-12 text-[#FF7A00]" viewBox="0 0 400 100" preserveAspectRatio="none">
          {/* Wave 1: Curvy Accent Wave Path (Ping-pong LTR) */}
          <motion.path
            d={curvyWavePath}
            fill="none"
            stroke="#FF7A00"
            strokeWidth={voiceState === 'listening' ? "2.0" : "1.2"}
            opacity={voiceState === 'listening' ? "0.95" : "0.6"}
            className="drop-shadow-[0_0_8px_rgba(255,122,0,0.75)]"
            animate={{ 
              x: [-400, 0],
              y: voiceState === 'listening' ? [6, -6, 6] : [2, -2, 2]
            }}
            transition={{
              x: {
                ease: "easeInOut",
                duration: voiceState === 'listening' ? 3.0 : 7,
                repeat: Infinity,
                repeatType: "reverse",
              },
              y: {
                ease: "easeInOut",
                duration: voiceState === 'listening' ? 0.6 : 1.4,
                repeat: Infinity,
              }
            }}
          />

          {/* Wave 2: Standard Accent Opposite Wave Path (Ping-pong RTL, Vertically Inverted) */}
          <motion.path
            d={wavePath}
            fill="none"
            stroke="#FF7A00"
            strokeWidth={voiceState === 'listening' ? "2.0" : "1.2"}
            opacity={voiceState === 'listening' ? "0.9" : "0.6"}
            className="drop-shadow-[0_0_8px_rgba(255,122,0,0.75)]"
            style={{ transformOrigin: "center 50px" }}
            animate={{ 
              x: [0, -400],
              scaleY: -1,
              y: voiceState === 'listening' ? [-6, 6, -6] : [-2, 2, -2]
            }}
            transition={{
              x: {
                ease: "easeInOut",
                duration: voiceState === 'listening' ? 3.0 : 7,
                repeat: Infinity,
                repeatType: "reverse",
              },
              y: {
                ease: "easeInOut",
                duration: voiceState === 'listening' ? 0.6 : 1.4,
                repeat: Infinity,
              }
            }}
          />

          {/* Wave 3: Continuous Unsynchronized Wave 1 (LTR) */}
          <motion.path
            d={wavePath}
            fill="none"
            stroke="#FFA726"
            strokeWidth={voiceState === 'listening' ? "2.2" : "1.3"}
            opacity={voiceState === 'listening' ? "0.8" : "0.45"}
            className="drop-shadow-[0_0_8px_rgba(255,167,38,0.75)]"
            animate={{ 
              x: [-400, 0],
              y: voiceState === 'listening' ? [5, -5, 5] : [1.5, -1.5, 1.5]
            }}
            transition={{
              x: {
                ease: "linear",
                duration: voiceState === 'listening' ? 2.5 : 5.8,
                repeat: Infinity,
                repeatType: "reverse",
              },
              y: {
                ease: "easeInOut",
                duration: voiceState === 'listening' ? 0.5 : 1.3,
                repeat: Infinity,
              }
            }}
          />

          {/* Wave 4: Continuous Unsynchronized Wave 2 (RTL, Vertically Inverted) */}
          <motion.path
            d={curvyWavePath}
            fill="none"
            stroke="#FF7A00"
            strokeWidth={voiceState === 'listening' ? "2.2" : "1.3"}
            opacity={voiceState === 'listening' ? "0.8" : "0.45"}
            className="drop-shadow-[0_0_8px_rgba(255,122,0,0.75)]"
            style={{ transformOrigin: "center 50px" }}
            animate={{ 
              x: [0, -400],
              scaleY: -1,
              y: voiceState === 'listening' ? [-5, 5, -5] : [-1.5, 1.5, -1.5]
            }}
            transition={{
              x: {
                ease: "linear",
                duration: voiceState === 'listening' ? 3.5 : 8.2,
                repeat: Infinity,
                repeatType: "reverse",
              },
              y: {
                ease: "easeInOut",
                duration: voiceState === 'listening' ? 0.9 : 2.1,
                repeat: Infinity,
              }
            }}
          />

          {/* Wave 5: Secondary Low-Opacity Parallax Wave Path (Slower Ping-pong LTR) */}
          <motion.path
            d={wavePath}
            fill="none"
            stroke="#FFA726"
            strokeWidth="0.9"
            opacity="0.3"
            animate={{ 
              x: [-400, 0],
              y: voiceState === 'listening' ? [-3, 3, -3] : [-0.8, 0.8, -0.8]
            }}
            transition={{
              x: {
                ease: "easeInOut",
                duration: voiceState === 'listening' ? 4.0 : 9.5,
                repeat: Infinity,
                repeatType: "reverse",
              },
              y: {
                ease: "easeInOut",
                duration: voiceState === 'listening' ? 1.0 : 2.5,
                repeat: Infinity,
              }
            }}
          />

          {/* Wave 6: Secondary Low-Opacity Parallax Wave Path (Slower Ping-pong RTL, Vertically Inverted) */}
          <motion.path
            d={curvyWavePath}
            fill="none"
            stroke="#FF7A00"
            strokeWidth="0.9"
            opacity="0.3"
            style={{ transformOrigin: "center 50px" }}
            animate={{ 
              x: [0, -400],
              scaleY: -1,
              y: voiceState === 'listening' ? [3, -3, 3] : [0.8, -0.8, 0.8]
            }}
            transition={{
              x: {
                ease: "easeInOut",
                duration: voiceState === 'listening' ? 4.0 : 9.5,
                repeat: Infinity,
                repeatType: "reverse",
              },
              y: {
                ease: "easeInOut",
                duration: voiceState === 'listening' ? 1.0 : 2.5,
                repeat: Infinity,
              }
            }}
          />
        </svg>
      </div>

      {/* 2. TEXT CAPTION OVERLAY */}
      <div className="absolute top-2 z-10 text-center select-none pointer-events-none">
        <AnimatePresence mode="wait">
          {voiceState === 'idle' && (
            <motion.span 
              key="idle"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-[9px] font-bold text-orange-400/80 uppercase tracking-widest font-mono"
            >
              Comunicação de Voz Ativa
            </motion.span>
          )}
          {voiceState === 'listening' && (
            <motion.span 
              key="listening"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-[10px] font-bold text-orange-500 uppercase tracking-wider font-mono flex items-center gap-1.5 justify-center"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
              🎙️ ESCUTANDO... FALE AGORA
            </motion.span>
          )}
          {voiceState === 'recognized' && (
            <motion.span 
              key="recognized"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-[10px] font-bold text-[#FFA726] uppercase tracking-wider font-mono flex items-center gap-1 justify-center max-w-[280px] truncate"
            >
              <CheckCircle size={10} className="text-[#FFA726]" />
              {transcription}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* 3. CENTRAL VOICE BUTTON (ORANGE GLOW) */}
      <div className="mt-3.5 relative z-10">
        <motion.div 
          onClick={() => {
            if (voiceState === 'idle') {
              setVoiceState('listening');
            }
          }}
          className={`w-[54px] h-[54px] rounded-full flex items-center justify-center cursor-pointer border-2 transition-all duration-300 ${
            voiceState === 'listening'
              ? 'bg-[#FF7A00] border-[#FF9D00] shadow-[0_0_25px_rgba(255,122,0,0.7)]'
              : 'bg-[#030914] border-[#FF7A00] shadow-[0_0_15px_rgba(255,122,0,0.4)]'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {voiceState === 'listening' && (
            <span className="absolute inset-0 rounded-full bg-orange-500/35 animate-ping" />
          )}

          <div className="flex items-center gap-[3px] h-4">
            {voiceState === 'listening' ? (
              <Mic size={20} className="text-white" />
            ) : (
              [1, 2, 3, 4, 5].map((index) => (
                <motion.div
                  key={index}
                  className="w-[3px] bg-white rounded-full origin-center shadow-[0_0_3px_rgba(255,255,255,0.6)]"
                  custom={index}
                  variants={barVariants}
                  animate="animate"
                  style={{ height: '100%', minHeight: '3px' }}
                />
              ))
            )}
          </div>
        </motion.div>
      </div>

    </div>
  );
}

