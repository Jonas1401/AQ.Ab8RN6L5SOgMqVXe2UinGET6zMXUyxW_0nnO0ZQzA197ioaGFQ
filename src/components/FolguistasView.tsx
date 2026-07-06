import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  User, 
  Trash2, 
  Upload, 
  Check, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  UserCheck,
  Search,
  MessageCircle,
  Shield,
  Briefcase
} from 'lucide-react';
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  collection, 
  db 
} from '../lib/supabase';

// SVG WhatsApp Icon for consistency
const WhatsAppIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    className={className} 
    fill="currentColor"
  >
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.968C16.34 1.97 13.87 1.01 11.24 1.01c-5.44 0-9.866 4.372-9.87 9.802 0 1.763.476 3.483 1.382 5.022l-.985 3.597 3.693-.957zm11.751-6.924c-.312-.154-1.846-.902-2.133-1.004-.287-.101-.497-.154-.707.154-.21.311-.815 1.004-.999 1.209-.184.205-.368.23-.68.077-.312-.154-1.316-.479-2.507-1.531-.926-.818-1.552-1.83-1.733-2.137-.184-.306-.02-.472.136-.624.14-.137.312-.359.468-.539.156-.179.208-.307.312-.512.104-.205.052-.384-.026-.539-.078-.154-.707-1.685-.969-2.3-.255-.607-.514-.523-.707-.533l-.604-.008c-.21 0-.552.078-.841.389-.29.311-1.103 1.066-1.103 2.6s1.121 3.018 1.278 3.223c.158.205 2.207 3.336 5.347 4.664.747.316 1.33.504 1.785.646.751.236 1.435.203 1.975.123.602-.09 1.846-.747 2.107-1.434.261-.687.261-1.277.184-1.401-.078-.124-.287-.205-.599-.359z" />
  </svg>
);

interface DriverProfile {
  id: string; // matches userId
  name: string;
  photoUrl: string;
  cnhCategory: string;
  phone: string;
  registeredAt: number;
  isActive: boolean;
}

interface FolguistasViewProps {
  userId: string;
  userName: string;
  userRole: 'driver' | 'admin' | 'operator';
  onBack: () => void;
}

export default function FolguistasView({ userId, userName, userRole, onBack }: FolguistasViewProps) {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Form states
  const [name, setName] = useState(userName || '');
  const [cnhCategory, setCnhCategory] = useState('E');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Active view tab: 'list' or 'register'
  const [activeTab, setActiveTab] = useState<'list' | 'register'>('list');

  // User's own registered driver profile if it exists
  const [myProfile, setMyProfile] = useState<DriverProfile | null>(null);

  // Subscribe to drivers collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'folguistas'), (snapshot) => {
      const list: DriverProfile[] = [];
      let foundOwn = null;
      snapshot.forEach((doc) => {
        const data = doc.data() as DriverProfile;
        const profile = { ...data, id: doc.id };
        list.push(profile);
        if (doc.id === userId) {
          foundOwn = profile;
        }
      });
      // Sort: most recent first
      list.sort((a, b) => b.registeredAt - a.registeredAt);
      setDrivers(list);
      setMyProfile(foundOwn);
      
      // Prefill fields if user has an existing profile and tab is register
      if (foundOwn) {
        setName(foundOwn.name);
        setCnhCategory(foundOwn.cnhCategory);
        setPhone(foundOwn.phone);
        setPhoto(foundOwn.photoUrl);
      }
    }, (err) => {
      console.error('Erro ao ler motoristas:', err);
    });

    return () => unsub();
  }, [userId]);

  // Handle phone masking
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val.length <= 11) {
      let formatted = val;
      if (val.length > 2) {
        formatted = `(${val.slice(0, 2)}) ${val.slice(2)}`;
      }
      if (val.length > 7) {
        formatted = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7, 11)}`;
      }
      setPhone(formatted);
    }
  };

  // Profile picture compressor & base64 converter
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    setFormError('');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 180;
          const MAX_HEIGHT = 180;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65); // high compression, perfect for storage/sync
          setPhoto(compressedBase64);
          setIsCompressing(false);
        };
        img.onerror = () => {
          setFormError('Erro ao processar imagem.');
          setIsCompressing(false);
        };
      };
    } catch (err) {
      setFormError('Falha no upload da foto.');
      setIsCompressing(false);
    }
  };

  // Submit profile to database
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!name.trim()) {
      setFormError('O nome é obrigatório.');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setFormError('Por favor, informe um número de telefone válido com DDD.');
      return;
    }
    if (!photo) {
      setFormError('Por favor, tire ou envie uma foto do seu rosto.');
      return;
    }

    setIsSubmitting(true);
    try {
      await setDoc(doc(db, 'folguistas', userId), {
        name: name.trim(),
        photoUrl: photo,
        cnhCategory,
        phone: phone.replace(/\D/g, ''),
        registeredAt: Date.now(),
        isActive: true
      });

      setFormSuccess(myProfile ? 'Cadastro atualizado com sucesso!' : 'Cadastro publicado com sucesso!');
      setTimeout(() => {
        setActiveTab('list');
        setFormSuccess('');
      }, 1500);
    } catch (err) {
      setFormError('Erro ao salvar os dados na nuvem.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete profile
  const handleDeleteProfile = async () => {
    if (!window.confirm('Tem certeza que deseja remover seu cadastro de motorista disponível?')) return;
    try {
      await deleteDoc(doc(db, 'folguistas', userId));
      setPhoto('');
      setPhone('');
      setName(userName || '');
      setFormSuccess('Seu cadastro foi removido.');
      setTimeout(() => setFormSuccess(''), 2000);
    } catch (err) {
      alert('Erro ao remover cadastro.');
    }
  };

  // Admin delete moderation
  const handleAdminDelete = async (driverId: string, driverName: string) => {
    if (!window.confirm(`Admin: Deseja remover o cadastro de "${driverName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'folguistas', driverId));
    } catch (err) {
      alert('Erro ao deletar.');
    }
  };

  // Filtered drivers based on Search and CNH selection
  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch = driver.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || driver.cnhCategory === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#030914] flex flex-col justify-between font-sans text-white relative pb-8">
      {/* Background Gradient Ornaments */}
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-[#00f6ff]/[0.03] to-transparent pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-md mx-auto w-full px-4 pt-4 relative z-10 flex-1 flex flex-col gap-4">
        
        {/* Header Bar */}
        <header className="flex items-center justify-between">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 active:scale-90 flex items-center justify-center border border-white/10 transition cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="text-center">
            <div className="flex items-center gap-1.5 justify-center">
              <Briefcase size={14} className="text-[#00f6ff]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[#00f6ff]">Quadro de Oportunidades</span>
            </div>
            <h1 className="text-sm font-extrabold text-white uppercase tracking-wider mt-0.5">Motoristas Folguistas</h1>
          </div>
          <div className="w-10 h-10" /> {/* Spacer */}
        </header>

        {/* Info Banner */}
        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/25 text-orange-400 shrink-0">
            <UserCheck size={16} />
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Está sem viagem ou quer fazer extra?</h4>
            <p className="text-[9.5px] text-gray-400 leading-relaxed mt-0.5">
              Cadastre seu contato e categoria de CNH para que transportadoras e operadores possam falar direto no seu WhatsApp!
            </p>
          </div>
        </div>

        {/* Tab Selectors */}
        <div className="grid grid-cols-2 p-1 bg-black/40 border border-white/5 rounded-2xl">
          <button
            onClick={() => setActiveTab('list')}
            className={`py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'list' 
                ? 'bg-[#00f6ff]/15 text-white shadow-inner border border-[#00f6ff]/25' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>Disponíveis ({filteredDrivers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'register' 
                ? 'bg-[#00f6ff]/15 text-white shadow-inner border border-[#00f6ff]/25' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>{myProfile ? 'Meu Cadastro' : 'Quero me Cadastrar'}</span>
            {myProfile && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
          </button>
        </div>

        {/* CONTENT SWITCHER */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {activeTab === 'list' ? (
              <motion.div
                key="list-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Search & Filters */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3.5 top-3 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="Pesquisar por nome..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-2xl text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-[#00f6ff] transition"
                    />
                  </div>

                  {/* CNH Filters Row */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <span className="text-[8px] font-black uppercase text-gray-500 tracking-widest pl-1">CNH:</span>
                    {['ALL', 'C', 'D', 'E', 'AB', 'AD', 'AE'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg border text-[9px] font-extrabold uppercase transition cursor-pointer shrink-0 ${
                          selectedCategory === cat 
                            ? 'bg-white text-black border-white shadow-md' 
                            : 'bg-black/30 text-gray-400 border-white/5 hover:border-white/20'
                        }`}
                      >
                        {cat === 'ALL' ? 'Todas' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DRIVERS GRID LIST */}
                <div className="space-y-3">
                  {filteredDrivers.length > 0 ? (
                    filteredDrivers.map((driver) => {
                      const whatsappText = `Olá ${driver.name}, vi seu cadastro de Motorista Disponível no Porto Fácil. Gostaria de conversar sobre uma oportunidade de frete/serviço.`;
                      const whatsappUrl = `https://wa.me/55${driver.phone}?text=${encodeURIComponent(whatsappText)}`;

                      return (
                        <motion.div
                          key={driver.id}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-3 bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-[22px] flex items-center justify-between gap-3 shadow-md relative group hover:border-[#00f6ff]/25 transition"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Avatar Headshot */}
                            <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 bg-black/40 shrink-0 relative">
                              {driver.photoUrl ? (
                                <img 
                                  src={driver.photoUrl} 
                                  alt={driver.name} 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500">
                                  <User size={18} />
                                </div>
                              )}
                              
                              {/* CNH badge on picture overlay */}
                              <div className="absolute bottom-0 right-0 left-0 bg-black/80 py-0.5 text-center">
                                <span className="text-[7.5px] font-black text-[#00f6ff]">{driver.cnhCategory}</span>
                              </div>
                            </div>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <h3 className="text-xs font-extrabold text-white truncate leading-tight">{driver.name}</h3>
                              <div className="flex items-center gap-1 mt-1">
                                <span className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[8px] font-bold text-gray-300">
                                  CNH Cat. {driver.cnhCategory}
                                </span>
                                <span className="text-gray-600 text-[8px]">•</span>
                                <span className="text-[8px] text-gray-400 font-medium">
                                  {new Date(driver.registeredAt).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Direct WhatsApp Action Button (Safe, hides raw number) */}
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Admin Trash Icon for moderation */}
                            {(userRole === 'admin' || driver.id === userId) && (
                              <button
                                onClick={() => {
                                  if (driver.id === userId) {
                                    handleDeleteProfile();
                                  } else {
                                    handleAdminDelete(driver.id, driver.name);
                                  }
                                }}
                                className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 text-red-400 flex items-center justify-center cursor-pointer transition mr-1"
                                title="Remover cadastro"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}

                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-[0_4px_10px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_15px_rgba(16,185,129,0.4)] transition cursor-pointer"
                            >
                              <WhatsAppIcon size={12} className="filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]" />
                              <span>WhatsApp</span>
                            </a>
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="text-center py-12 rounded-3xl border border-dashed border-white/10 bg-white/[0.01]">
                      <User size={24} className="text-gray-600 mx-auto mb-2 animate-pulse" />
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nenhum motorista</p>
                      <p className="text-[10px] text-gray-500 mt-1">Nenhum motorista disponível atende a esse filtro.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="register-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* MY PROFILE DETAILS AND CREATE FORM */}
                {myProfile ? (
                  <div className="space-y-4">
                    {/* Already Registered Card */}
                    <div className="p-4 rounded-3xl bg-emerald-950/20 border border-emerald-500/20 shadow-md">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-emerald-500/30 bg-black/40 shrink-0">
                          {myProfile.photoUrl && (
                            <img 
                              src={myProfile.photoUrl} 
                              alt={myProfile.name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">VOCÊ ESTÁ ATIVO COMO FOLGUISTA</p>
                          <h3 className="text-sm font-black text-white truncate">{myProfile.name}</h3>
                          <p className="text-[9.5px] text-gray-400 mt-0.5">CNH Categoria: {myProfile.cnhCategory}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5">
                        <button
                          onClick={() => {
                            // Already prefilled, just let them edit below
                            setActiveTab('register');
                            // We scroll to or focus edit form, we will just show it below
                          }}
                          className="py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider border border-white/10 transition cursor-pointer text-center"
                        >
                          Alterar Dados
                        </button>
                        <button
                          onClick={handleDeleteProfile}
                          className="py-2 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white font-bold rounded-xl text-[10px] uppercase tracking-wider border border-red-500/20 hover:border-transparent transition cursor-pointer text-center flex items-center justify-center gap-1"
                        >
                          <Trash2 size={11} />
                          <span>Remover Cadastro</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* REGISTRATION FORM */}
                <form onSubmit={handleRegister} className="mt-4 p-4 rounded-3xl bg-slate-900/40 border border-white/10 space-y-4">
                  <h3 className="text-xs font-extrabold uppercase text-[#00f6ff] tracking-widest mb-1">
                    {myProfile ? 'Atualizar meus dados' : 'Fazer Meu Cadastro de Disponível'}
                  </h3>

                  {/* Form Feedback */}
                  {formError && (
                    <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-[10px] font-bold flex items-center gap-2">
                      <AlertTriangle size={13} className="shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {formSuccess && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-[10px] font-bold flex items-center gap-2">
                      <CheckCircle2 size={13} className="shrink-0" />
                      <span>{formSuccess}</span>
                    </div>
                  )}

                  {/* Photo Upload face snap */}
                  <div>
                    <span className="text-[8.5px] text-gray-500 uppercase font-black tracking-widest block mb-1">Sua Foto de Rosto (Identificação)</span>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/15 bg-black/40 flex items-center justify-center overflow-hidden shrink-0 relative">
                        {photo ? (
                          <img 
                            src={photo} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <User size={22} className="text-gray-600" />
                        )}
                        {isCompressing && (
                          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                            <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 space-y-1.5">
                        <label className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 rounded-xl text-[10px] font-bold uppercase cursor-pointer transition">
                          <Upload size={12} />
                          <span>{photo ? 'Trocar Foto' : 'Enviar Foto'}</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handlePhotoUpload} 
                            className="hidden" 
                          />
                        </label>
                        <p className="text-[8.5px] text-gray-400 leading-tight">
                          Tire uma foto nítida do seu rosto para identificação profissional.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Name field */}
                  <div>
                    <span className="text-[8.5px] text-gray-500 uppercase font-black tracking-widest block mb-1">Nome Completo</span>
                    <input 
                      type="text"
                      placeholder="Seu nome completo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full p-2.5 bg-black/40 border border-white/10 rounded-xl text-[11px] text-white focus:outline-none focus:border-[#00f6ff] transition"
                    />
                  </div>

                  {/* CNH Select */}
                  <div>
                    <span className="text-[8.5px] text-gray-500 uppercase font-black tracking-widest block mb-1">Categoria CNH</span>
                    <select
                      value={cnhCategory}
                      onChange={(e) => setCnhCategory(e.target.value)}
                      className="w-full p-2.5 bg-black/40 border border-white/10 rounded-xl text-[11px] text-white focus:outline-none focus:border-[#00f6ff] transition cursor-pointer"
                    >
                      <option value="C" className="bg-slate-900">Categoria C (Caminhão leve/médio)</option>
                      <option value="D" className="bg-slate-900">Categoria D (Ônibus / Microônibus)</option>
                      <option value="E" className="bg-slate-900">Categoria E (Carreta / Articulado)</option>
                      <option value="AB" className="bg-slate-900">Categoria AB (Moto & Carro)</option>
                      <option value="AD" className="bg-slate-900">Categoria AD (Moto & Ônibus)</option>
                      <option value="AE" className="bg-slate-900">Categoria AE (Moto & Carreta)</option>
                    </select>
                  </div>

                  {/* Phone Input with mask */}
                  <div>
                    <span className="text-[8.5px] text-gray-500 uppercase font-black tracking-widest block mb-1">WhatsApp (Celular com DDD)</span>
                    <input 
                      type="text"
                      placeholder="Ex: (41) 99999-9999"
                      value={phone}
                      onChange={handlePhoneChange}
                      className="w-full p-2.5 bg-black/40 border border-white/10 rounded-xl text-[11px] text-white focus:outline-none focus:border-[#00f6ff] transition font-mono"
                    />
                    <p className="text-[8px] text-gray-500 mt-1 pl-1">
                      Nota: O número NÃO ficará exposto diretamente. As pessoas falarão com você via botão seguro.
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || isCompressing}
                    className="w-full py-2.5 bg-gradient-to-r from-[#00f6ff]/20 to-[#00f6ff]/5 hover:from-[#00f6ff]/30 hover:to-[#00f6ff]/10 border border-[#00f6ff]/30 text-white font-extrabold rounded-xl text-[11px] uppercase tracking-wider cursor-pointer active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check size={13} />
                        <span>{myProfile ? 'Salvar Alterações' : 'Publicar Disponibilidade'}</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
