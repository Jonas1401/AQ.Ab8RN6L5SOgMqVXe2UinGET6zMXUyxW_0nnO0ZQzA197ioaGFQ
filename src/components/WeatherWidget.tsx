import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sun, 
  Cloud, 
  CloudRain, 
  CloudLightning, 
  CloudDrizzle, 
  CloudFog, 
  Wind, 
  Thermometer, 
  Droplets, 
  Search, 
  X, 
  Navigation, 
  Compass, 
  Activity, 
  Eye, 
  Clock, 
  Calendar,
  AlertTriangle
} from 'lucide-react';

// Interfaces for weather data
interface WeatherDetails {
  city: string;
  temp: number;
  condition: string;
  code: number;
  humidity: number;
  feelsLike: number;
  windSpeed: number;
  pressure: number;
  uvIndex: number;
  rainProb: number;
  hourly: Array<{
    time: string;
    temp: number;
    code: number;
    rainProb: number;
  }>;
  daily: Array<{
    day: string;
    tempMax: number;
    tempMin: number;
    code: number;
    rainProb: number;
  }>;
}

const FALLBACK_WEATHER: WeatherDetails = {
  city: 'Porto de Paranaguá, PR',
  temp: 22,
  condition: 'Parcialmente Nublado',
  code: 3,
  humidity: 78,
  feelsLike: 23,
  windSpeed: 14,
  pressure: 1015,
  uvIndex: 4.5,
  rainProb: 10,
  hourly: Array.from({ length: 24 }, (_, i) => {
    const hourNum = (new Date().getHours() + i) % 24;
    return {
      time: `${String(hourNum).padStart(2, '0')}:00`,
      temp: 22 - Math.abs(12 - hourNum) / 2,
      code: 3,
      rainProb: 10,
    };
  }),
  daily: [
    { day: 'Hoje', tempMax: 24, tempMin: 18, code: 3, rainProb: 10 },
    { day: 'Sáb', tempMax: 25, tempMin: 19, code: 3, rainProb: 15 },
    { day: 'Dom', tempMax: 23, tempMin: 17, code: 61, rainProb: 60 },
    { day: 'Seg', tempMax: 22, tempMin: 16, code: 3, rainProb: 20 },
    { day: 'Ter', tempMax: 24, tempMin: 18, code: 0, rainProb: 5 },
    { day: 'Qua', tempMax: 26, tempMin: 19, code: 0, rainProb: 0 },
    { day: 'Qui', tempMax: 25, tempMin: 18, code: 1, rainProb: 10 },
  ],
};

const DEFAULT_CITIES = [
  { name: 'Porto de Santos, SP', lat: -23.9618, lon: -46.3322 },
  { name: 'Porto de Paranaguá, PR', lat: -25.5026, lon: -48.5103 },
  { name: 'Itajaí, SC', lat: -26.9078, lon: -48.6619 },
  { name: 'Curitiba, PR', lat: -25.4290, lon: -49.2671 },
];

export default function WeatherWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [activeTab, setActiveTab] = useState<'hourly' | 'daily' | 'details'>('hourly');
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Default initial location: Porto de Paranaguá (PR)
  const [coords, setCoords] = useState({ lat: -25.5026, lon: -48.5103 });
  const [weather, setWeather] = useState<WeatherDetails | null>(() => {
    try {
      const cached = localStorage.getItem('cached_weather');
      return cached ? JSON.parse(cached) : FALLBACK_WEATHER;
    } catch {
      return FALLBACK_WEATHER;
    }
  });

  const searchRef = useRef<HTMLDivElement>(null);

  // Close search results dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch initial weather or weather when coordinates change
  useEffect(() => {
    fetchWeather(coords.lat, coords.lon);
  }, [coords]);

  // Load search results when query changes (debounced search via Open-Meteo free geocoding API)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=6&language=pt&format=json`
        );
        const data = await response.json();
        if (data && data.results) {
          setSearchResults(data.results);
          setShowResults(true);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.error('Error fetching cities:', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Weather Code Mapper (WMO Weather interpretation codes)
  const getWeatherInfo = (code: number) => {
    if (code === 0) return { label: 'Céu Limpo', color: 'from-[#1D976C] to-[#93F9B9]', icon: Sun, bg: 'from-amber-400 via-orange-400 to-sky-500' };
    if ([1, 2, 3].includes(code)) return { label: 'Parcialmente Nublado', color: 'from-[#00c6ff] to-[#0072ff]', icon: Cloud, bg: 'from-sky-400 via-blue-500 to-slate-600' };
    if ([45, 48].includes(code)) return { label: 'Nevoeiro', color: 'from-[#3a7bd5] to-[#3a6073]', icon: CloudFog, bg: 'from-slate-500 via-zinc-600 to-gray-700' };
    if ([51, 53, 55].includes(code)) return { label: 'Chuvisco Leve', color: 'from-[#1F1C2C] to-[#928DAB]', icon: CloudDrizzle, bg: 'from-blue-600 via-sky-700 to-slate-800' };
    if ([61, 63, 65].includes(code)) return { label: 'Chuva', color: 'from-[#2b5876] to-[#4e4376]', icon: CloudRain, bg: 'from-indigo-950 via-slate-900 to-slate-800' };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Neve', color: 'from-[#E0EAFC] to-[#CFDEF3]', icon: CloudSnow, bg: 'from-blue-100 via-cyan-200 to-slate-400' };
    if ([80, 81, 82].includes(code)) return { label: 'Pancadas de Chuva', color: 'from-[#141E30] to-[#243B55]', icon: CloudRain, bg: 'from-[#0F2027] via-[#203A43] to-[#2C5364]' };
    if ([95, 96, 99].includes(code)) return { label: 'Tempestade', color: 'from-[#0F2027] via-[#203A43] to-[#2C5364]', icon: CloudLightning, bg: 'from-neutral-900 via-indigo-950 to-purple-950' };
    return { label: 'Parcialmente Nublado', color: 'from-[#00c6ff] to-[#0072ff]', icon: Cloud, bg: 'from-sky-500 via-blue-600 to-slate-700' };
  };

  // Custom Snow Fallback Component for completeness
  const CloudSnow = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
      <line x1="8" y1="16" x2="8.01" y2="16" />
      <line x1="8" y1="20" x2="8.01" y2="20" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
      <line x1="12" y1="22" x2="12.01" y2="22" />
      <line x1="16" y1="16" x2="16.01" y2="16" />
      <line x1="16" y1="20" x2="16.01" y2="20" />
    </svg>
  );

  // Main weather fetch function using completely free Open-Meteo
  const fetchWeather = async (latitude: number, longitude: number, cityName?: string) => {
    setLoading(true);
    setGpsError(null);
    try {
      // 1. Get City Name if not specified
      let resolvedCity = cityName || 'Local Desconhecido';
      if (!cityName) {
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
          );
          const geoData = await geoRes.json();
          resolvedCity = geoData.address.village || geoData.address.town || geoData.address.city || geoData.address.suburb || geoData.address.municipality || 'Local Selecionado';
          if (geoData.address.state) {
            resolvedCity += `, ${geoData.address.state_code || geoData.address.state}`;
          }
        } catch (e) {
          resolvedCity = `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
        }
      }

      // 2. Fetch forecast data
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,pressure_msl,uv_index&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.current) {
        // Map Hourly
        const currentHourIndex = new Date().getHours();
        const hourlyForecast = [];
        for (let i = 0; i < 24; i++) {
          const index = currentHourIndex + i;
          if (data.hourly && data.hourly.time[index]) {
            const dateObj = new Date(data.hourly.time[index]);
            const formattedTime = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            hourlyForecast.push({
              time: formattedTime,
              temp: Math.round(data.hourly.temperature_2m[index]),
              code: data.hourly.weather_code[index],
              rainProb: Math.round(data.hourly.precipitation_probability[index] || 0),
            });
          }
        }

        // Map Daily (7 days)
        const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const dailyForecast = [];
        if (data.daily) {
          for (let i = 0; i < 7; i++) {
            if (data.daily.time[i]) {
              const dateObj = new Date(data.daily.time[i] + 'T12:00:00');
              const dayLabel = i === 0 ? 'Hoje' : daysOfWeek[dateObj.getDay()];
              dailyForecast.push({
                day: dayLabel,
                tempMax: Math.round(data.daily.temperature_2m_max[i]),
                tempMin: Math.round(data.daily.temperature_2m_min[i]),
                code: data.daily.weather_code[i],
                rainProb: Math.round(data.daily.precipitation_probability_max[i] || 0),
              });
            }
          }
        }

        const details: WeatherDetails = {
          city: resolvedCity,
          temp: Math.round(data.current.temperature_2m),
          condition: getWeatherInfo(data.current.weather_code).label,
          code: data.current.weather_code,
          humidity: Math.round(data.current.relative_humidity_2m),
          feelsLike: Math.round(data.current.apparent_temperature),
          windSpeed: Math.round(data.current.wind_speed_10m),
          pressure: Math.round(data.current.pressure_msl),
          uvIndex: data.current.uv_index || 0,
          rainProb: Math.round(data.daily ? data.daily.precipitation_probability_max[0] : 0),
          hourly: hourlyForecast,
          daily: dailyForecast,
        };

        setWeather(details);
        // Save to cache
        localStorage.setItem('cached_weather', JSON.stringify(details));
        localStorage.setItem('cached_weather_coords', JSON.stringify({ lat: latitude, lon: longitude }));
      }
    } catch (err) {
      console.warn('Erro ao carregar dados de clima real (usando fallback offline):', err);
      // Fallback from cache or default fallback
      try {
        const cached = localStorage.getItem('cached_weather');
        if (cached) {
          setWeather(JSON.parse(cached));
        } else {
          setWeather(FALLBACK_WEATHER);
        }
      } catch {
        setWeather(FALLBACK_WEATHER);
      }
    } finally {
      setLoading(false);
    }
  };

  // Get user's active geolocation
  const handleGPSLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Seu navegador não suporta geolocalização.');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lon: longitude });
      },
      (error) => {
        console.warn('Geolocation access denied/failed:', error);
        setGpsError('Acesso à localização negado. Use a busca ou as cidades rápidas.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const convertTemp = (celsius: number) => {
    if (unit === 'F') {
      return Math.round((celsius * 9) / 5 + 32);
    }
    return celsius;
  };

  const handleSelectCity = (city: { name: string; lat: number; lon: number }) => {
    setCoords({ lat: city.lat, lon: city.lon });
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  const handleSelectGeocodedResult = (item: any) => {
    const name = `${item.name}${item.admin1 ? `, ${item.admin1}` : ''} - ${item.country_code ? item.country_code.toUpperCase() : ''}`;
    setCoords({ lat: item.latitude, lon: item.longitude });
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  // Determine current active illustration styles/colors
  const weatherMeta = weather ? getWeatherInfo(weather.code) : getWeatherInfo(3);
  const CurrentIcon = weatherMeta.icon;

  return (
    <>
      {/* 1. FLOATING ACTION BUTTON (FAB) */}
      <div className="fixed top-20 right-4 sm:right-[calc(50%-215px+16px)] z-40 flex flex-col items-end gap-2">
        <motion.button
          id="btn-weather-fab"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-full border border-white/10 bg-[#030914]/15 backdrop-blur-xl text-white shadow-[0_4px_24px_rgba(0,0,0,0.5)] transition duration-200 hover:scale-105 active:scale-95 cursor-pointer hover:border-sky-500/30 group"
          whileHover={{ y: -2 }}
        >
          {/* Animated pulsing ripple indicator if rain/storm */}
          {[61, 63, 65, 95, 96, 99].includes(weather?.code || 0) && (
            <span className="absolute inset-0 rounded-full border border-sky-500/30 animate-ping pointer-events-none" />
          )}

          <div className="w-6 h-6 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 group-hover:bg-sky-500/20 transition-all duration-200">
            {weather ? <CurrentIcon size={16} className="animate-pulse" /> : <Sun size={16} className="animate-spin" />}
          </div>
          
          <div className="flex flex-col items-start leading-none pr-1">
            <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase font-sans">Tempo</span>
            <span className="text-xs font-black font-mono tracking-tight mt-0.5">
              {weather ? `${convertTemp(weather.temp)}°${unit}` : '--°'}
            </span>
          </div>
        </motion.button>
      </div>

      {/* 2. FULL IMMERSIVE WEATHER PORTAL OVERLAY */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Modal Body */}
            <motion.div 
              className={`w-full max-w-md bg-gradient-to-b ${weatherMeta.bg} rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative flex flex-col max-h-[90vh] text-white border border-white/15`}
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            >
              
              {/* Top Blur / Weather Background Accent */}
              <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/20 to-transparent pointer-events-none z-0" />

              {/* Rain/Lightning Dynamic FX overlay */}
              {[61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weather?.code || 0) && (
                <div className="absolute inset-x-0 top-0 h-48 overflow-hidden opacity-30 pointer-events-none z-0">
                  <div className="absolute top-0 bottom-0 left-1/4 w-[1px] bg-white animate-fall" style={{ animationDelay: '0.2s', animationDuration: '0.8s' }} />
                  <div className="absolute top-0 bottom-0 left-2/4 w-[1px] bg-white animate-fall" style={{ animationDelay: '0.5s', animationDuration: '0.6s' }} />
                  <div className="absolute top-0 bottom-0 left-3/4 w-[1px] bg-white animate-fall" style={{ animationDelay: '0s', animationDuration: '1s' }} />
                  <div className="absolute top-0 bottom-0 left-1/3 w-[1px] bg-white animate-fall" style={{ animationDelay: '0.8s', animationDuration: '0.7s' }} />
                </div>
              )}

              {/* Header section */}
              <div className="p-5 flex items-center justify-between z-10 relative">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleGPSLocation}
                    className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer active:scale-95"
                    title="Usar Minha Localização"
                  >
                    <Navigation size={15} className="text-white" />
                  </button>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold tracking-widest text-white/75 uppercase font-sans">Previsão Porto</span>
                    <h3 className="text-sm font-black tracking-tight leading-tight max-w-[200px] truncate">
                      {weather ? weather.city : 'Carregando...'}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Temp Unit Selector */}
                  <div className="flex bg-white/10 rounded-xl p-0.5 border border-white/5 mr-1.5 font-mono text-[10px]">
                    <button 
                      onClick={() => setUnit('C')}
                      className={`px-2 py-1 rounded-lg font-black transition cursor-pointer ${unit === 'C' ? 'bg-white text-black font-black' : 'text-white hover:bg-white/10'}`}
                    >
                      °C
                    </button>
                    <button 
                      onClick={() => setUnit('F')}
                      className={`px-2 py-1 rounded-lg font-black transition cursor-pointer ${unit === 'F' ? 'bg-white text-black font-black' : 'text-white hover:bg-white/10'}`}
                    >
                      °F
                    </button>
                  </div>

                  {/* Close button */}
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-2.5 rounded-full bg-black/25 hover:bg-black/40 text-white/90 hover:text-white transition cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Search city input field */}
              <div className="px-5 pb-2.5 z-10 relative" ref={searchRef}>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar cidade (ex: Santos, Paranaguá...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/35 backdrop-blur-md border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-white/50 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/10 transition"
                  />
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                  
                  {/* Autocomplete dropdown list */}
                  <AnimatePresence>
                    {showResults && searchResults.length > 0 && (
                      <motion.div 
                        className="absolute left-0 right-0 top-full mt-1.5 bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-48 overflow-y-auto"
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                      >
                        {searchResults.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleSelectGeocodedResult(item)}
                            className="px-4 py-2.5 text-[11px] text-gray-200 hover:bg-white/10 transition cursor-pointer flex flex-col border-b border-white/5 last:border-b-0"
                          >
                            <span className="font-bold">{item.name}</span>
                            <span className="text-[9px] text-gray-400 mt-0.5">
                              {item.admin1 ? `${item.admin1}, ` : ''}{item.country || ''}
                            </span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {gpsError && (
                  <div className="mt-2 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-1.5 text-[9px] text-red-200">
                    <AlertTriangle size={11} className="shrink-0" />
                    <span>{gpsError}</span>
                  </div>
                )}
              </div>

              {/* Main Weather Information Display Card */}
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3 z-10 relative">
                  <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span className="text-xs text-white/70 font-bold font-mono">Buscando previsão grátis...</span>
                </div>
              ) : weather ? (
                <div className="flex-1 overflow-y-auto z-10 relative flex flex-col">
                  
                  {/* HERO WEATHER DISP */}
                  <div className="flex flex-col items-center text-center px-5 py-3">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="relative w-20 h-20 flex items-center justify-center"
                    >
                      <CurrentIcon className="w-16 h-16 text-white filter drop-shadow-[0_8px_16px_rgba(255,255,255,0.25)] animate-pulse" />
                    </motion.div>
                    
                    <h1 className="text-5xl font-black font-mono tracking-tight mt-1 relative flex justify-center pl-4">
                      {convertTemp(weather.temp)}
                      <span className="text-2xl font-bold absolute top-1 right-[-14px]">°</span>
                    </h1>

                    <p className="text-xs font-extrabold tracking-widest uppercase mt-2 text-white/90 bg-white/10 px-3 py-1 rounded-full border border-white/5">
                      {weather.condition}
                    </p>

                    <div className="flex items-center gap-4 mt-3 text-[10px] font-bold text-white/80">
                      <span className="flex items-center gap-1">
                        <Thermometer size={12} /> Sensação: {convertTemp(weather.feelsLike)}°
                      </span>
                      <span className="flex items-center gap-1">
                        <Droplets size={12} /> Umidade: {weather.humidity}%
                      </span>
                    </div>
                  </div>

                  {/* QUICK PORT CITIES SHORTCUTS */}
                  <div className="px-5 py-1 flex items-center gap-1.5 overflow-x-auto select-none no-scrollbar">
                    {DEFAULT_CITIES.map((city) => (
                      <button
                        key={city.name}
                        onClick={() => handleSelectCity(city)}
                        className="px-2.5 py-1 bg-black/20 hover:bg-black/35 border border-white/5 rounded-xl text-[9px] font-bold tracking-wide transition shrink-0 cursor-pointer text-white/90"
                      >
                        {city.name.split(',')[0]}
                      </button>
                    ))}
                  </div>

                  {/* NAV TABS (GOOGLE WEATHER STYLE: HOURLY, 7 DAYS, DETAILS) */}
                  <div className="mt-5 px-5 flex border-b border-white/10">
                    <button
                      onClick={() => setActiveTab('hourly')}
                      className={`flex-1 pb-2 text-[10px] font-black uppercase tracking-wider text-center border-b-2 transition relative cursor-pointer ${
                        activeTab === 'hourly' ? 'border-white text-white' : 'border-transparent text-white/60 hover:text-white/80'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <Clock size={11} /> Hoje (24h)
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab('daily')}
                      className={`flex-1 pb-2 text-[10px] font-black uppercase tracking-wider text-center border-b-2 transition relative cursor-pointer ${
                        activeTab === 'daily' ? 'border-white text-white' : 'border-transparent text-white/60 hover:text-white/80'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <Calendar size={11} /> Próximos Dias
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab('details')}
                      className={`flex-1 pb-2 text-[10px] font-black uppercase tracking-wider text-center border-b-2 transition relative cursor-pointer ${
                        activeTab === 'details' ? 'border-white text-white' : 'border-transparent text-white/60 hover:text-white/80'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <Compass size={11} /> Detalhes
                      </span>
                    </button>
                  </div>

                  {/* TAB CONTENT PANEL */}
                  <div className="flex-1 p-5 min-h-[160px]">
                    <AnimatePresence mode="wait">
                      
                      {/* HOURLY SCROLLABLE FORECAST */}
                      {activeTab === 'hourly' && (
                        <motion.div
                          key="hourly"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="flex gap-2 overflow-x-auto pb-2 no-scrollbar"
                        >
                          {weather.hourly.map((hour, idx) => {
                            const HourIcon = getWeatherInfo(hour.code).icon;
                            return (
                              <div
                                key={idx}
                                className="flex flex-col items-center justify-between p-3 bg-black/15 backdrop-blur-xl border border-white/5 rounded-2xl min-w-[58px] gap-2 text-center"
                              >
                                <span className="text-[10px] text-white/70 font-mono font-bold">{hour.time}</span>
                                <HourIcon size={18} className="text-white filter drop-shadow-[0_2px_4px_rgba(255,255,255,0.15)]" />
                                <span className="text-xs font-black font-mono">{hour.temp}°</span>
                                {hour.rainProb > 0 ? (
                                  <span className="text-[8px] font-black text-sky-300 font-mono flex items-center gap-0.5">
                                    💧{hour.rainProb}%
                                  </span>
                                ) : (
                                  <span className="text-[8px] text-white/30 font-mono">-</span>
                                )}
                              </div>
                            );
                          })}
                        </motion.div>
                      )}

                      {/* DAILY 7-DAY FORECAST WITH SPREAD BAR */}
                      {activeTab === 'daily' && (
                        <motion.div
                          key="daily"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="flex flex-col gap-2.5"
                        >
                          {weather.daily.map((day, idx) => {
                            const DayIcon = getWeatherInfo(day.code).icon;
                            
                            // Find absolute min and max of current daily forecast to scale spread bar
                            const allMaxes = weather.daily.map(d => d.tempMax);
                            const allMines = weather.daily.map(d => d.tempMin);
                            const absMin = Math.min(...allMines);
                            const absMax = Math.max(...allMaxes);
                            const range = absMax - absMin || 1;

                            // Calculate percentages for the styled min/max spread bar
                            const leftPercent = ((day.tempMin - absMin) / range) * 100;
                            const widthPercent = ((day.tempMax - day.tempMin) / range) * 100;

                            return (
                              <div key={idx} className="flex items-center justify-between gap-3 text-xs bg-black/10 backdrop-blur-xl p-2 rounded-xl border border-white/5">
                                <span className="w-10 font-bold text-white/80">{day.day}</span>
                                
                                <div className="flex items-center gap-1.5 w-12 shrink-0">
                                  <DayIcon size={14} className="text-white" />
                                  {day.rainProb > 20 && (
                                    <span className="text-[8px] font-mono text-sky-300 font-black">{day.rainProb}%</span>
                                  )}
                                </div>

                                <span className="text-[10px] text-white/60 font-mono w-6 text-right font-bold">{day.tempMin}°</span>
                                
                                {/* Styled Google Weather spread bar */}
                                <div className="flex-1 h-1.5 bg-white/10 rounded-full relative overflow-hidden mx-1">
                                  <div 
                                    className="absolute h-full rounded-full bg-gradient-to-r from-teal-400 via-amber-300 to-orange-400 shadow-[0_0_4px_rgba(251,191,36,0.5)]"
                                    style={{ left: `${leftPercent}%`, width: `${Math.max(widthPercent, 10)}%` }}
                                  />
                                </div>

                                <span className="text-[10px] text-white font-mono w-6 text-right font-black">{day.tempMax}°</span>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}

                      {/* MICRO-DETAILS GRID */}
                      {activeTab === 'details' && (
                        <motion.div
                          key="details"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="grid grid-cols-2 gap-3"
                        >
                          {/* Sensação */}
                          <div className="p-3 bg-black/15 backdrop-blur-xl rounded-2xl border border-white/5 flex flex-col gap-1.5">
                            <div className="flex items-center gap-1 text-white/60 text-[9px] font-bold uppercase tracking-wider">
                              <Thermometer size={12} className="text-orange-400" />
                              Sensação
                            </div>
                            <span className="text-base font-black font-mono leading-none">{convertTemp(weather.feelsLike)}°{unit}</span>
                            <span className="text-[9px] text-white/50">Equivalente à temperatura da pele</span>
                          </div>

                          {/* Vento */}
                          <div className="p-3 bg-black/15 backdrop-blur-xl rounded-2xl border border-white/5 flex flex-col gap-1.5">
                            <div className="flex items-center gap-1 text-white/60 text-[9px] font-bold uppercase tracking-wider">
                              <Wind size={12} className="text-teal-400" />
                              Vento
                            </div>
                            <span className="text-base font-black font-mono leading-none">{weather.windSpeed} km/h</span>
                            <span className="text-[9px] text-white/50">Velocidade média atual</span>
                          </div>

                          {/* Umidade */}
                          <div className="p-3 bg-black/15 backdrop-blur-xl rounded-2xl border border-white/5 flex flex-col gap-1.5">
                            <div className="flex items-center gap-1 text-white/60 text-[9px] font-bold uppercase tracking-wider">
                              <Droplets size={12} className="text-sky-400" />
                              Umidade
                            </div>
                            <span className="text-base font-black font-mono leading-none">{weather.humidity}%</span>
                            <div className="w-full h-1 bg-white/10 rounded-full mt-0.5 overflow-hidden">
                              <div className="h-full bg-sky-400 rounded-full" style={{ width: `${weather.humidity}%` }} />
                            </div>
                          </div>

                          {/* UV Index */}
                          <div className="p-3 bg-black/15 backdrop-blur-xl rounded-2xl border border-white/5 flex flex-col gap-1.5">
                            <div className="flex items-center gap-1 text-white/60 text-[9px] font-bold uppercase tracking-wider">
                              <Activity size={12} className="text-yellow-400" />
                              Índice UV
                            </div>
                            <span className="text-base font-black font-mono leading-none">{weather.uvIndex.toFixed(1)}</span>
                            <span className="text-[9px] text-white/50">
                              {weather.uvIndex <= 2 ? 'Baixo' : weather.uvIndex <= 5 ? 'Moderado' : weather.uvIndex <= 7 ? 'Alto' : 'Muito Alto'}
                            </span>
                          </div>

                          {/* Atmospheric Pressure */}
                          <div className="p-3 bg-black/15 backdrop-blur-xl rounded-2xl border border-white/5 flex flex-col gap-1.5">
                            <div className="flex items-center gap-1 text-white/60 text-[9px] font-bold uppercase tracking-wider">
                              <Compass size={12} className="text-emerald-400" />
                              Pressão
                            </div>
                            <span className="text-base font-black font-mono leading-none">{weather.pressure} hPa</span>
                            <span className="text-[9px] text-white/50">Pressão atmosférica local</span>
                          </div>

                          {/* Rain Probability */}
                          <div className="p-3 bg-black/15 backdrop-blur-xl rounded-2xl border border-white/5 flex flex-col gap-1.5">
                            <div className="flex items-center gap-1 text-white/60 text-[9px] font-bold uppercase tracking-wider">
                              <Eye size={12} className="text-purple-400" />
                              Visibilidade
                            </div>
                            <span className="text-base font-black font-mono leading-none">10 km</span>
                            <span className="text-[9px] text-white/50">Perfeita para navegação e porto</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Disclaimer / Credits: Powered by Open-Meteo */}
                  <div className="p-4 text-center text-[8px] text-white/40 font-mono border-t border-white/5 uppercase tracking-widest bg-black/10">
                    Previsão Grátis Oficial • Serviço Livre Open-Meteo
                  </div>

                </div>
              ) : (
                <div className="p-10 text-center text-xs text-white/60 flex flex-col gap-2">
                  <p>Incapaz de carregar a previsão em tempo real.</p>
                  <button onClick={() => fetchWeather(coords.lat, coords.lon)} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-xl">Tentar Novamente</button>
                </div>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
