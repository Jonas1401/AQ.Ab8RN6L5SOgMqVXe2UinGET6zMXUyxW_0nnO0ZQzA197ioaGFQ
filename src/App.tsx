/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';
import { 
  auth, 
  db, 
  onAuthStateChanged, 
  signOut, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot 
} from './lib/db';
import { Channel } from './types';
import LoginView from './components/LoginView';
import HomeView from './components/HomeView';
import TicketsView from './components/TicketsView';
import EmergencyView from './components/EmergencyView';
import OrganizerView from './components/OrganizerView';
import AppaView from './components/AppaView';
import FolguistasView from './components/FolguistasView';
import WeatherThemesDemo from './components/WeatherThemesDemo';

const INITIAL_CHANNELS: Channel[] = [
  {
    id: 'tickets',
    name: 'Cálculo de Tickets',
    description: 'Calculadora e leitor de tickets de carga',
    icon: 'calculator',
    color: '#00A2FF',
    unreadCount: 0,
  },
];

export default function App() {
  const isOnline = useOnlineStatus();
  const [user, setUser] = useState<{ uid: string; displayName: string; avatarUrl: string; role: 'driver' | 'admin' | 'operator'; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>(INITIAL_CHANNELS);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showThemesDemo, setShowThemesDemo] = useState(false);

  useEffect(() => {
    let activeUnsubscribe: (() => void) | null = null;
    let isMounted = true;

    async function initializeApp() {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const config = await res.json();
          // Config is now managed via Firebase directly
        }
      } catch (err) {
        console.warn('[App] Erro ao obter dados de config:', err);
      }

      if (!isMounted) return;

      // 2. Listen to Supabase Auth state
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            // Fetch driver profile from Supabase
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              const emailLower = (data.email || '').trim().toLowerCase();

              // Check if user is banned by email
              if (emailLower) {
                try {
                  const banDoc = await getDoc(doc(db, 'banned_emails', emailLower));
                  if (banDoc.exists()) {
                    console.warn('Sessão rejeitada: e-mail banido.');
                    await signOut(auth);
                    localStorage.removeItem('portoconecta_local_user');
                    setUser(null);
                    setLoading(false);
                    return;
                  }
                } catch (banErr) {
                  console.warn('Erro ao verificar banimentos na reconexão:', banErr);
                }
              }

              // Check if user is banned by UID
              try {
                const banUidDoc = await getDoc(doc(db, 'banned_uids', user.uid));
                if (banUidDoc.exists()) {
                  console.warn('Sessão rejeitada: UID banido.');
                  await signOut(auth);
                  localStorage.removeItem('portoconecta_local_user');
                  setUser(null);
                  setLoading(false);
                  return;
                }
              } catch (banUidErr) {
                console.warn('Erro ao verificar banimentos de UID na reconexão:', banUidErr);
              }

              const isJonas = emailLower === 'jonas1401@gmail.com';
              const userRole = isJonas ? 'admin' : (data.role || 'driver');

              const profile = {
                uid: user.uid,
                displayName: data.displayName || 'Motorista Anônimo',
                avatarUrl: data.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
                role: userRole as 'driver' | 'admin' | 'operator',
                email: emailLower,
              };
              setUser(profile);
              localStorage.setItem('portoconecta_local_user', JSON.stringify(profile));
            } else {
              // Fallback profile
              const profile = {
                uid: user.uid,
                displayName: 'Motorista',
                avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
                role: 'driver' as const,
                email: '',
              };
              setUser(profile);
              localStorage.setItem('portoconecta_local_user', JSON.stringify(profile));
            }
          } catch (err) {
            console.error('Error fetching user profile:', err);
          }
        } else {
          // If there's no active user but we didn't log in locally either, sign out
          if (!localUserLoaded) {
            setUser(null);
          }
        }
        setLoading(false);
      });

      if (isMounted) {
        activeUnsubscribe = unsubscribe;
      } else {
        unsubscribe();
      }
    }

    // 1. Try checking local storage first for instant loading/fallback
    const localUserStr = localStorage.getItem('portoconecta_local_user');
    let localUserLoaded = false;
    if (localUserStr) {
      try {
        const parsed = JSON.parse(localUserStr);
        if (parsed && parsed.uid) {
          const emailLower = (parsed.email || '').trim().toLowerCase();
          const isJonas = emailLower === 'jonas1401@gmail.com';
          setUser({
            uid: parsed.uid,
            displayName: parsed.displayName,
            avatarUrl: parsed.avatarUrl,
            role: isJonas ? 'admin' : (parsed.role || 'driver'),
            email: parsed.email,
          });
          localUserLoaded = true;
          setLoading(false);
        }
      } catch (err) {
        console.error('Error parsing local user:', err);
      }
    }

    initializeApp();

    return () => {
      isMounted = false;
      if (activeUnsubscribe) {
        activeUnsubscribe();
      }
    };
  }, []);

  const handleLoginComplete = (profile: { uid: string; displayName: string; avatarUrl: string; role: 'driver' | 'admin' | 'operator'; email?: string }) => {
    setUser(profile);
  };

  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
    // Mark channel as read
    setChannels((prev) =>
      prev.map((ch) => (ch.id === channelId ? { ...ch, unreadCount: 0 } : ch))
    );
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('portoconecta_local_user');
      await signOut(auth);
      setUser(null);
      setSelectedChannelId(null);
    } catch (err) {
      console.error('Logout error:', err);
      // Fallback clean up state
      setUser(null);
      setSelectedChannelId(null);
    }
  };

  const sessionStartTime = useRef<number>(Date.now());

  // 3. Real-time ban listener for active sessions
  useEffect(() => {
    if (!user) return;
    
    // Listen to banned_uids in real-time
    const unsubUid = onSnapshot(doc(db, 'banned_uids', user.uid), async (snap) => {
      if (snap.exists()) {
        alert('Este perfil foi banido permanentemente pelo administrador do Porto Fácil.');
        await signOut(auth);
        localStorage.removeItem('portoconecta_local_user');
        setUser(null);
      }
    });

    let unsubEmail = () => {};
    if (user.email) {
      const emailLower = user.email.trim().toLowerCase();
      unsubEmail = onSnapshot(doc(db, 'banned_emails', emailLower), async (snap) => {
        if (snap.exists()) {
          alert('Este e-mail foi banido permanentemente pelo administrador do Porto Fácil.');
          await signOut(auth);
          localStorage.removeItem('portoconecta_local_user');
          setUser(null);
        }
      });
    }

    return () => {
      unsubUid();
      unsubEmail();
    };
  }, [user?.uid, user?.email]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07111F] flex flex-col items-center justify-center text-white gap-4 font-sans">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-orange-500/20" />
        <p className="text-xs font-semibold tracking-widest uppercase text-gray-400">
          Carregando Porto Fácil...
        </p>
      </div>
    );
  }

  // Auth Guard
  if (!user) {
    return <LoginView onLoginComplete={handleLoginComplete} />;
  }

  // Active view layout with shared overlay for Offline Status Notification and Toast
  let activeContent;
  if (selectedChannelId) {
    if (selectedChannelId === 'emergencia') {
      activeContent = (
        <EmergencyView
          onBack={() => setSelectedChannelId(null)}
        />
      );
    } else if (selectedChannelId === 'tickets') {
      activeContent = (
        <TicketsView
          userId={user.uid}
          userName={user.displayName}
          userAvatar={user.avatarUrl}
          onBack={() => setSelectedChannelId(null)}
        />
      );
    } else if (selectedChannelId === 'organizador') {
      activeContent = (
        <OrganizerView
          userId={user.uid}
          userName={user.displayName}
          userAvatar={user.avatarUrl}
          onBack={() => setSelectedChannelId(null)}
        />
      );
    } else if (selectedChannelId === 'appa') {
      activeContent = (
        <AppaView
          onBack={() => setSelectedChannelId(null)}
        />
      );
    } else if (selectedChannelId === 'folguistas') {
      activeContent = (
        <FolguistasView
          userId={user.uid}
          userName={user.displayName}
          userRole={user.role}
          onBack={() => setSelectedChannelId(null)}
        />
      );
    }
  } else {
    activeContent = (
      <HomeView
        userId={user.uid}
        displayName={user.displayName}
        avatarUrl={user.avatarUrl}
        role={user.role}
        email={user.email}
        channels={channels}
        onSelectChannel={handleSelectChannel}
        onShowThemesDemo={() => setShowThemesDemo(true)}
        onLogout={handleLogout}
        onUpdateRole={(newRole) => {
          const updated = { ...user, role: newRole };
          setUser(updated);
          localStorage.setItem('portoconecta_local_user', JSON.stringify(updated));
        }}
        onUpdateAvatar={async (newAvatarUrl) => {
          const updated = { ...user, avatarUrl: newAvatarUrl };
          setUser(updated);
          localStorage.setItem('portoconecta_local_user', JSON.stringify(updated));
          try {
            await setDoc(doc(db, 'users', user.uid), { avatarUrl: newAvatarUrl }, { merge: true });
          } catch (err) {
            console.warn('Erro ao salvar novo avatar no Supabase:', err);
          }
        }}
      />
    );
  }

  return (
    <>
      {showThemesDemo && <WeatherThemesDemo onClose={() => setShowThemesDemo(false)} />}
      {activeContent}
      
      {/* Offline Status Overlay */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-[9999] bg-[#1c0d0f]/90 backdrop-blur-md border border-red-500/30 rounded-2xl p-4 shadow-2xl flex items-center gap-3 select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
              <WifiOff size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-bold leading-none">Modo Sem Conexão</p>
              <p className="text-gray-300 text-[10px] leading-relaxed mt-1">
                Porto Fácil está rodando offline. Seus dados e mensagens estão salvos localmente e serão sincronizados ao reestabelecer conexão!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
