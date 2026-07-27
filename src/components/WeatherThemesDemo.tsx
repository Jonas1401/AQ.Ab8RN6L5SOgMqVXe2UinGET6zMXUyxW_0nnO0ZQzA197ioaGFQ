import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';

const themes = [
  { id: 'nascer', title: 'NASCER DO SOL', subtitle: 'Início de um novo dia', bg: 'bg-gradient-to-br from-[#FF9D4E] to-[#FFF2B0]' },
  { id: 'dia', title: 'DIA ENSOLARADO', subtitle: 'Clareza e produtividade', bg: 'bg-gradient-to-br from-[#3B82F6] to-[#7DD3FC]' },
  { id: 'nublado', title: 'TEMPO NUBLADO', subtitle: 'Conforto visual', bg: 'bg-gradient-to-br from-[#64748B] to-[#CBD5E1]' },
  { id: 'chuva', title: 'CHUVA', subtitle: 'Calma e concentração', bg: 'bg-gradient-to-br from-[#1E293B] to-[#475569]' },
  { id: 'tempestade', title: 'TEMPESTADE', subtitle: 'Força e impacto', bg: 'bg-gradient-to-br from-[#0F172A] to-[#334155]' },
  { id: 'neblina', title: 'NEBLINA', subtitle: 'Sofisticação e profundidade', bg: 'bg-gradient-to-br from-[#E2E8F0] to-[#94A3B8]' },
  { id: 'entardecer', title: 'ENTARDECER', subtitle: 'O tema mais cinematográfico', bg: 'bg-gradient-to-br from-[#7E22CE] via-[#F97316] to-[#1E3A8A]' },
  { id: 'noite', title: 'NOITE LIMPA', subtitle: 'Elegância e tranquilidade', bg: 'bg-gradient-to-br from-[#020617] to-[#172554]' },
];

export default function WeatherThemesDemo({ onClose }: { onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % themes.length);
      }, 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying]);

  const nextTheme = () => {
    setIsPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % themes.length);
  };

  const prevTheme = () => {
    setIsPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + themes.length) % themes.length);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={themes[currentIndex].id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className={`absolute inset-0 ${themes[currentIndex].bg} flex flex-col items-center justify-center text-white`}
        >
          <h1 className="text-5xl font-black tracking-tighter mb-4">{themes[currentIndex].title}</h1>
          <p className="text-xl font-light opacity-90">{themes[currentIndex].subtitle}</p>
        </motion.div>
      </AnimatePresence>

      <div className="absolute top-6 left-6 z-10">
        <button onClick={onClose} className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white">
          <X size={24} />
        </button>
      </div>

      <div className="absolute bottom-10 z-10 flex gap-4">
        <button onClick={prevTheme} className="p-4 bg-white/20 backdrop-blur-md rounded-full text-white">
          <ChevronLeft size={28} />
        </button>
        <button onClick={() => setIsPlaying(!isPlaying)} className={`p-4 ${isPlaying ? 'bg-orange-500' : 'bg-white/20'} backdrop-blur-md rounded-full text-white`}>
          <Play size={28} />
        </button>
        <button onClick={nextTheme} className="p-4 bg-white/20 backdrop-blur-md rounded-full text-white">
          <ChevronRight size={28} />
        </button>
      </div>
    </div>
  );
}
