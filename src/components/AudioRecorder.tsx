/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Square, Trash2, CheckCircle2 } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (audioBase64: string, durationSec: number) => void;
  onCancel: () => void;
}

export default function AudioRecorder({ onRecordingComplete, onCancel }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Web Audio API refs for real-time visualization
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasLeftRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRightRef = useRef<HTMLCanvasElement | null>(null);
  const volumeRef = useRef<number>(0); // Current immediate volume for pulsing button

  // Start recording immediately when mounted
  useEffect(() => {
    startRecordingFlow();
    return () => {
      cleanupAudio();
    };
  }, []);

  // Timer effect
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const cleanupAudio = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const startRecordingFlow = async () => {
    try {
      setPermissionError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Initialize Web Audio API
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Initialize MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert Blob to Base64 to store in Firestore
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          onRecordingComplete(base64Audio, recordingTime || 1);
        };
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start drawing the voice levels on the canvas
      drawWaveform();
    } catch (err: any) {
      console.error('Failed to access microphone', err);
      setPermissionError(
        'Permissão de microfone negada ou indisponível no navegador.'
      );
    }
  };

  // Real-time audio analyzer loop
  const drawWaveform = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      const drawWave = (canvas: HTMLCanvasElement, isLeft: boolean) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas with deep slate blue
        ctx.fillStyle = '#030914';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw horizontal baseline
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        const numRays = 16;
        const spacing = canvas.width / numRays;
        const time = Date.now() * 0.003;

        for (let i = 0; i < numRays; i++) {
          // Read value from frequency data
          // Left side canvas peaks near the right (the mic button)
          // Right side canvas peaks near the left (the mic button)
          let binIndex = Math.floor((i / numRays) * (bufferLength / 3.5));
          if (isLeft) {
            binIndex = Math.floor(((numRays - i) / numRays) * (bufferLength / 3.5));
          }

          let value = dataArray[binIndex] || 0;
          const pct = value / 255;

          // Add a persistent subtle vibration animation
          const vibration = Math.sin(time + i * 0.8) * 2;
          let height = pct * canvas.height * 0.8 + (pct > 0.05 ? vibration : vibration * 0.3);

          // Symmetrical fade edge so it looks naturally bounded
          const edgeFade = isLeft 
            ? Math.min(1, i / (numRays * 0.4)) 
            : Math.min(1, (numRays - i) / (numRays * 0.4));

          height = Math.max(1.5, height * edgeFade);

          const x = i * spacing + spacing / 2;
          const yHalf = canvas.height / 2;

          // Glowing blue gradient styling
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#00f0ff';
          
          const gradient = ctx.createLinearGradient(0, yHalf - height / 2, 0, yHalf + height / 2);
          gradient.addColorStop(0, '#60a5fa');
          gradient.addColorStop(0.5, '#00f0ff');
          gradient.addColorStop(1, '#1d4ed8');
          ctx.fillStyle = gradient;

          // Draw vertical ray
          ctx.fillRect(x - 1, yHalf - height / 2, 2.5, height);
        }
      };

      if (canvasLeftRef.current) drawWave(canvasLeftRef.current, true);
      if (canvasRightRef.current) drawWave(canvasRightRef.current, false);

      // Average volume calculation
      let totalVolume = 0;
      for (let i = 0; i < bufferLength; i++) {
        totalVolume += dataArray[i];
      }
      const avgVolume = totalVolume / bufferLength;
      const pct = avgVolume / 255;
      volumeRef.current = avgVolume;

      // Shape-shifting mic border representing "TOM DA VOZ" (BAIXO, MÉDIO, ALTO)
      const borderElement = document.getElementById('record-mic-glow-border');
      if (borderElement) {
        const scale = 1 + pct * 0.35;
        borderElement.style.transform = `scale(${scale})`;
        
        let borderRadius = '50%';
        let strokeColor = 'rgba(0, 240, 255, 0.8)';
        let shadowColor = 'rgba(0, 240, 255, 0.5)';
        
        if (pct < 0.15) {
          // TOM BAIXO: Circular glow
          borderRadius = '50%';
          strokeColor = '#00f0ff';
          shadowColor = 'rgba(0, 240, 255, 0.4)';
        } else if (pct < 0.45) {
          // TOM MÉDIO: Octagon-ish rounded polygon warp
          const t = Date.now() * 0.012;
          const r1 = 43 + Math.sin(t) * 6;
          const r2 = 57 - Math.sin(t) * 6;
          const r3 = 41 + Math.cos(t) * 6;
          const r4 = 59 - Math.cos(t) * 6;
          borderRadius = `${r1}% ${r2}% ${r3}% ${r4}% / ${r2}% ${r1}% ${r4}% ${r3}%`;
          strokeColor = '#3b82f6';
          shadowColor = 'rgba(59, 130, 246, 0.6)';
        } else {
          // TOM ALTO: Highly warped asymmetrical blob
          const t = Date.now() * 0.025;
          const r1 = 28 + Math.sin(t) * 15;
          const r2 = 72 - Math.sin(t) * 15;
          const r3 = 22 + Math.cos(t) * 15;
          const r4 = 78 - Math.cos(t) * 15;
          borderRadius = `${r1}% ${r2}% ${r3}% ${r4}% / ${r2}% ${r3}% ${r4}% ${r1}%`;
          strokeColor = '#ef4444';
          shadowColor = 'rgba(239, 68, 68, 0.7)';
        }
        
        borderElement.style.borderRadius = borderRadius;
        borderElement.style.borderColor = strokeColor;
        borderElement.style.boxShadow = `0 0 ${15 + pct * 55}px ${shadowColor}`;
      }

      // Voice tone classification label
      const toneLabelElement = document.getElementById('voice-tone-badge');
      if (toneLabelElement) {
        if (pct < 0.15) {
          toneLabelElement.innerText = 'TOM BAIXO';
          toneLabelElement.className = 'text-[9px] font-bold px-2 py-0.5 rounded bg-blue-950/80 border border-blue-500/30 text-blue-400 transition-colors duration-200';
        } else if (pct < 0.45) {
          toneLabelElement.innerText = 'TOM MÉDIO';
          toneLabelElement.className = 'text-[9px] font-bold px-2 py-0.5 rounded bg-sky-950/80 border border-sky-500/30 text-sky-400 transition-colors duration-200';
        } else {
          toneLabelElement.innerText = 'TOM ALTO';
          toneLabelElement.className = 'text-[9px] font-bold px-2 py-0.5 rounded bg-red-950/80 border border-red-500/30 text-red-400 transition-colors duration-200';
        }
      }
    };

    render();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      cleanupAudio();
    }
  };

  const cancelRecording = () => {
    cleanupAudio();
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="w-full flex flex-col relative"
    >
      {permissionError ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center glass-card rounded-2xl p-4 border-red-500/20">
          <p className="text-red-400 font-medium text-sm">{permissionError}</p>
          <button
            onClick={cancelRecording}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition"
          >
            Voltar
          </button>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center">
          {/* Main recording box styled exactly like the capsule image */}
          <div className="w-full bg-[#030914] border border-blue-500/20 rounded-[32px] px-6 py-2 flex items-center justify-between relative overflow-hidden h-24 shadow-[0_0_25px_rgba(59,130,246,0.03)]">
            
            {/* Ambient glowing wave effect */}
            {isRecording && (
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.02),transparent_70%)] pointer-events-none" />
            )}

            {/* Left text label */}
            <div className="flex items-center gap-2 select-none z-10 flex-shrink-0">
              <span className="text-white font-bold tracking-widest text-xs animate-pulse">GRAVANDO...</span>
            </div>

            {/* Left Canvas Wave */}
            <div className="flex-1 h-full mx-2 flex items-center relative min-w-[40px]">
              <canvas
                ref={canvasLeftRef}
                className="w-full h-12 block"
                width={160}
                height={48}
              />
            </div>

            {/* Central glowing/shape-shifting Mic Button */}
            <div className="relative flex items-center justify-center mx-3 z-10 flex-shrink-0">
              {/* Dynamic shape border */}
              <div
                id="record-mic-glow-border"
                className="absolute w-16 h-16 border-2 border-blue-400/80 rounded-full flex items-center justify-center transition-all duration-100 ease-out"
              />
              
              {/* Actual mic button trigger */}
              <div className="w-11 h-11 rounded-full bg-[#030914] border border-blue-400/40 flex items-center justify-center relative z-20 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
                <Mic className="text-blue-400 animate-pulse" size={20} />
              </div>
            </div>

            {/* Right Canvas Wave */}
            <div className="flex-1 h-full mx-2 flex items-center relative min-w-[40px]">
              <canvas
                ref={canvasRightRef}
                className="w-full h-12 block"
                width={160}
                height={48}
              />
            </div>

            {/* Digital Timer (Red) */}
            <div className="font-mono text-base font-bold text-red-500 min-w-[45px] text-center tracking-wider z-10 flex-shrink-0 select-none mr-3">
              {formatTime(recordingTime)}
            </div>

            {/* Cancel (Trash) Button */}
            <button
              onClick={cancelRecording}
              className="w-11 h-11 rounded-full border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 text-gray-400 hover:text-red-400 flex items-center justify-center transition duration-200 z-10 flex-shrink-0 cursor-pointer mr-2"
              title="Cancelar gravação"
            >
              <Trash2 size={16} />
            </button>

            {/* Stop / Send Button */}
            <button
              onClick={stopRecording}
              className="w-11 h-11 rounded-full border border-white/10 hover:border-white/20 hover:bg-white/5 flex items-center justify-center transition duration-200 z-10 flex-shrink-0 cursor-pointer"
              title="Parar e Enviar"
            >
              <div className="w-3.5 h-3.5 bg-white rounded-sm shadow-sm" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
