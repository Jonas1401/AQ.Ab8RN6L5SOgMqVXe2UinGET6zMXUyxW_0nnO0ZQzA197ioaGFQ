import React, { useEffect, useRef } from 'react';

interface EcgCanvasProps {
  isRecording?: boolean;
  volume?: number; // 0 to 255
  volumeRef?: React.RefObject<number>; // Optional Ref for ultra-high performance zero-render voice tracking
  accentColor?: string; // Default "#B7FF00"
  height?: number; // Canvas height, default 60
}

export default function EcgCanvas({
  isRecording = false,
  volume = 0,
  volumeRef,
  accentColor = '#B7FF00',
  height = 64
}: EcgCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Animation states preserved across frames
  const stateRef = useRef({
    sweepX: 0,
    yBuffer: [] as number[],
    framesSinceLastBeat: 0,
    activeBeatFrame: -1,
    heartRate: 110, // Increased default BPM for more frequent heartbeats
    amplitude: 1.0,
    noiseLevel: 0.2,
    prevVolume: 0,
    beatDirection: 1, // Always 1 for upwards peaks
    isNextBeatLow: false // Alternates between false (high beat) and true (low beat)
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle resizing responsively
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      // Support high-DPI displays for ultra-crisp premium lines
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      // Initialize or resize the y-buffer
      const width = rect.width;
      const currentBuffer = stateRef.current.yBuffer;
      if (currentBuffer.length !== Math.ceil(width)) {
        const newBuffer = new Array(Math.ceil(width));
        const baseline = rect.height / 2;
        for (let i = 0; i < newBuffer.length; i++) {
          newBuffer[i] = currentBuffer[i] !== undefined ? currentBuffer[i] : baseline;
        }
        stateRef.current.yBuffer = newBuffer;
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    resizeCanvas();

    // Mathematically accurate ECG generator with support for direction inversion (up and down peaks)
    const getEcgValue = (phase: number, amp: number, baseline: number, direction: number = 1) => {
      let offset = 0;
      if (phase < 0.08) {
        // P-wave: atrial depolarization (small upward hump)
        const pPhase = phase / 0.08;
        offset = -Math.sin(pPhase * Math.PI) * 4 * amp;
      } else if (phase < 0.15) {
        // PR segment: flat isoelectric line
        offset = 0;
      } else if (phase < 0.18) {
        // Q-wave: rapid initial downward dip
        const qPhase = (phase - 0.15) / 0.03;
        offset = Math.sin(qPhase * Math.PI) * 4 * amp;
      } else if (phase < 0.25) {
        // R-wave: major ventricular depolarization spike
        const rPhase = (phase - 0.18) / 0.07;
        if (rPhase < 0.4) {
          offset = -(rPhase / 0.4) * 36 * amp;
        } else {
          offset = -36 * amp + ((rPhase - 0.4) / 0.6) * (36 + 10) * amp;
        }
      } else if (phase < 0.29) {
        // S-wave: quick dip below baseline
        const sPhase = (phase - 0.25) / 0.04;
        offset = 10 * amp - Math.sin(sPhase * Math.PI) * 10 * amp;
      } else if (phase < 0.38) {
        // ST segment: flat interval
        offset = 0;
      } else if (phase < 0.52) {
        // T-wave: ventricular repolarization (medium upward hump)
        const tPhase = (phase - 0.38) / 0.14;
        offset = -Math.sin(tPhase * Math.PI) * 8 * amp;
      } else if (phase < 0.57) {
        // U-wave: small secondary repolarization hump
        const uPhase = (phase - 0.52) / 0.05;
        offset = -Math.sin(uPhase * Math.PI) * 1.2 * amp;
      }

      return baseline + offset * direction;
    };

    // Animation Loop
    const tick = () => {
      const rect = canvas.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      if (W === 0 || H === 0) {
        animationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      const state = stateRef.current;
      const baseline = H / 2;

      // Smoothly interpolate parameters based on audio volume
      // Map 0-255 volume to normalized range
      const activeVolume = volumeRef && volumeRef.current !== undefined ? volumeRef.current : volume;
      const normVolume = Math.min(1.0, activeVolume / 160);
      
      const targetHeartRate = isRecording ? (110 + normVolume * 80) : 110;
      const targetAmplitude = isRecording ? (1.0 + normVolume * 1.9) : 1.0;
      const targetNoise = isRecording ? (0.2 + normVolume * 1.6) : 0.15;

      state.heartRate += (targetHeartRate - state.heartRate) * 0.12;
      state.amplitude += (targetAmplitude - state.amplitude) * 0.12;
      state.noiseLevel += (targetNoise - state.noiseLevel) * 0.12;

      // Heartbeat trigger logic
      // Frames per beat at 60fps
      const framesPerBeat = Math.max(22, Math.floor(60 * (60 / state.heartRate)));
      state.framesSinceLastBeat++;

      // Trigger beat when interval reached, or randomly/erratically during loud voice inputs
      const voiceTriggerChance = isRecording ? (normVolume * 0.15) : 0;
      const shouldTriggerBeat = state.framesSinceLastBeat >= framesPerBeat || (Math.random() < voiceTriggerChance && state.activeBeatFrame === -1 && state.framesSinceLastBeat > 12);

      if (shouldTriggerBeat) {
        state.activeBeatFrame = 0;
        state.framesSinceLastBeat = 0;
        // Always point peaks upwards
        state.beatDirection = 1;
        // Alternate between low and high heartbeats
        state.isNextBeatLow = !state.isNextBeatLow;
      }

      // Calculate sweep step
      const step = 2.5; // Sweep speed (pixels per frame)
      const prevX = state.sweepX;
      state.sweepX = (state.sweepX + step) % W;

      // Wrap around buffer
      if (state.yBuffer.length !== Math.ceil(W)) {
        state.yBuffer = new Array(Math.ceil(W)).fill(baseline);
      }

      // Generate ECG value for the newly covered pixels in this frame
      let currentY = baseline;
      if (state.activeBeatFrame !== -1) {
        // Calculate phase
        // An active heartbeat lasts for a fixed duration of about 22 frames
        const beatDuration = 22;
        const phase = state.activeBeatFrame / beatDuration;
        // Apply alternating high / low amplitudes
        const currentAmplitude = state.isNextBeatLow ? (state.amplitude * 0.48) : (state.amplitude * 1.18);
        currentY = getEcgValue(phase, currentAmplitude, baseline, 1);

        state.activeBeatFrame++;
        if (state.activeBeatFrame >= beatDuration) {
          state.activeBeatFrame = -1;
        }
      } else {
        // Isoelectric baseline with slight random biological noise
        const noise = (Math.random() - 0.5) * state.noiseLevel * 4;
        currentY = baseline + noise;
      }

      // Fill current sweep line with generated Y values
      const startX = Math.floor(prevX);
      const endX = Math.floor(state.sweepX);
      
      if (endX > startX) {
        for (let x = startX; x <= endX; x++) {
          if (x < state.yBuffer.length) {
            state.yBuffer[x] = currentY;
          }
        }
      } else {
        // Wrapped around this frame
        for (let x = startX; x < state.yBuffer.length; x++) {
          state.yBuffer[x] = currentY;
        }
        for (let x = 0; x <= endX; x++) {
          if (x < state.yBuffer.length) {
            state.yBuffer[x] = currentY;
          }
        }
      }

      // Drawing Phase
      ctx.clearRect(0, 0, W, H);

      // We draw the wave as segments, calculating faded tail relative to sweepX
      const eraseGap = 22; // Pixels ahead of sweepX to erase for clean swept appearance

      ctx.beginPath();
      let isDrawing = false;

      for (let i = 0; i < Math.ceil(W); i++) {
        // Calculate distance behind sweepX
        let distanceBehind = 0;
        if (i <= state.sweepX) {
          distanceBehind = state.sweepX - i;
        } else {
          distanceBehind = W - (i - state.sweepX);
        }

        // Do not draw pixels within the erase gap directly ahead of the sweep tip
        const isAheadInGap = (i > state.sweepX && i < state.sweepX + eraseGap) || 
                             (state.sweepX + eraseGap > W && i < (state.sweepX + eraseGap) % W);

        if (isAheadInGap) {
          if (isDrawing) {
            ctx.stroke();
            isDrawing = false;
          }
          continue;
        }

        const y = state.yBuffer[i] !== undefined ? state.yBuffer[i] : baseline;

        if (!isDrawing) {
          ctx.beginPath();
          ctx.moveTo(i, y);
          isDrawing = true;
        } else {
          ctx.lineTo(i, y);
        }

        // Periodically flush path to apply smooth gradient fading
        // Or we can draw a beautiful neon glow
      }
      
      if (isDrawing) {
        ctx.stroke();
      }

      // Let's draw with premium visual style: Faded tail + Glow
      // To keep it highly performant, we draw two passes:
      // Pass 1: Draw the full buffer as a single path with a soft glow styling
      // To get fading tail, we can draw using ctx stroke with a gradient that follows the sweep!
      // A linear gradient from sweepX (bright lime) going backwards is incredibly gorgeous!
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      
      // Let's add multiple color stops relative to sweepX position
      // Normalizing sweepX to 0-1
      const normSweepX = state.sweepX / W;

      // Extract RGB values from accentColor prop for fully dynamic color matching
      let r = 183, g = 255, b = 0;
      if (accentColor) {
        const cleanColor = accentColor.trim();
        if (cleanColor.startsWith('#')) {
          const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
          const fullHex = cleanColor.replace(shorthandRegex, (m, rPart, gPart, bPart) => rPart + rPart + gPart + gPart + bPart + bPart);
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
          if (result) {
            r = parseInt(result[1], 16);
            g = parseInt(result[2], 16);
            b = parseInt(result[3], 16);
          }
        } else if (cleanColor.startsWith('rgb')) {
          const parts = cleanColor.match(/\d+/g);
          if (parts && parts.length >= 3) {
            r = parseInt(parts[0], 10);
            g = parseInt(parts[1], 10);
            b = parseInt(parts[2], 10);
          }
        }
      }
      
      // We want the theme color at sweepX, fading out behind it, and 0 opacity just ahead of it
      const cBright = `rgba(${r}, ${g}, ${b}, 0.95)`;
      const cMid = `rgba(${r}, ${g}, ${b}, 0.4)`;
      const cDim = `rgba(${r}, ${g}, ${b}, 0.15)`;
      const cFade = `rgba(${r}, ${g}, ${b}, 0.02)`;

      // Set up gradient stops based on sweepX
      if (normSweepX < 0.1) {
        grad.addColorStop(0, cBright);
        grad.addColorStop(normSweepX, cBright);
        grad.addColorStop(Math.min(1.0, normSweepX + 0.1), cFade);
        grad.addColorStop(1.0, cDim);
      } else {
        grad.addColorStop(0, cDim);
        grad.addColorStop(normSweepX - 0.1, cMid);
        grad.addColorStop(normSweepX, cBright);
        grad.addColorStop(Math.min(1.0, normSweepX + 0.02), cFade);
        grad.addColorStop(1.0, cDim);
      }

      // Draw Pass 1: Neon Glow Background Line
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Draw everything again with stroke
      isDrawing = false;
      for (let i = 0; i < Math.ceil(W); i++) {
        const isAheadInGap = (i > state.sweepX && i < state.sweepX + eraseGap) || 
                             (state.sweepX + eraseGap > W && i < (state.sweepX + eraseGap) % W);
        if (isAheadInGap) {
          if (isDrawing) { ctx.stroke(); isDrawing = false; }
          continue;
        }
        const y = state.yBuffer[i] !== undefined ? state.yBuffer[i] : baseline;
        if (!isDrawing) {
          ctx.beginPath();
          ctx.moveTo(i, y);
          isDrawing = true;
        } else {
          ctx.lineTo(i, y);
        }
      }
      if (isDrawing) ctx.stroke();

      // Draw Pass 2: Sharp Inner Bright Line
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'; // Pure white inner core for awesome realistic glowing HUD laser look
      isDrawing = false;
      for (let i = 0; i < Math.ceil(W); i++) {
        const isAheadInGap = (i > state.sweepX && i < state.sweepX + eraseGap) || 
                             (state.sweepX + eraseGap > W && i < (state.sweepX + eraseGap) % W);
        if (isAheadInGap) {
          if (isDrawing) { ctx.stroke(); isDrawing = false; }
          continue;
        }
        const y = state.yBuffer[i] !== undefined ? state.yBuffer[i] : baseline;
        if (!isDrawing) {
          ctx.beginPath();
          ctx.moveTo(i, y);
          isDrawing = true;
        } else {
          ctx.lineTo(i, y);
        }
      }
      if (isDrawing) ctx.stroke();

      // Draw the Glowing Energy Traveler Particle exactly at the sweep tip (sweepX, currentY)
      const tipY = state.yBuffer[Math.floor(state.sweepX)] || baseline;
      
      // Outer pulse aura
      const pulseSize = 13 + Math.sin(Date.now() * 0.015) * 2 + (normVolume * 8);
      const dotGrad = ctx.createRadialGradient(state.sweepX, tipY, 0, state.sweepX, tipY, pulseSize);
      dotGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      dotGrad.addColorStop(0.2, `rgb(${r}, ${g}, ${b})`);
      dotGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.45)`);
      dotGrad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0)`);
      
      ctx.fillStyle = dotGrad;
      ctx.beginPath();
      ctx.arc(state.sweepX, tipY, pulseSize, 0, Math.PI * 2);
      ctx.fill();

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [isRecording, volume, accentColor, height]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full block pointer-events-none select-none bg-transparent"
      style={{ mixBlendMode: 'screen', height: `${height}px` }}
    />
  );
}
