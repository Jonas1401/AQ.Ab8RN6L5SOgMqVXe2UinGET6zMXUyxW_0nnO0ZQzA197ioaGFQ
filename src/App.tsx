/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Channel } from './types';
import LoginView from './components/LoginView';
import HomeView from './components/HomeView';
import ChannelView from './components/ChannelView';

const INITIAL_CHANNELS: Channel[] = [
  {
    id: 'porto',
    name: 'Canal Porto',
    description: 'Avisos e informações oficiais',
    icon: 'ship',
    color: '#3b82f6',
    unreadCount: 12,
  },
  {
    id: 'motoristas',
    name: 'Motoristas',
    description: 'Comunicação entre motoristas',
    icon: 'truck',
    color: '#f97316',
    unreadCount: 8,
  },
  {
    id: 'folgas',
    name: 'Folgas',
    description: 'Troca de escalas e folgas',
    icon: 'calendar',
    color: '#a855f7',
    unreadCount: 5,
  },
  {
    id: 'comercio',
    name: 'Comércio Local',
    description: 'Serviços e produtos da região',
    icon: 'store',
    color: '#22c55e',
    unreadCount: 3,
  },
];

export default function App() {
  const [user, setUser] = useState<{ uid: string; displayName: string; avatarUrl: string; role: 'driver' | 'admin' | 'operator' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>(INITIAL_CHANNELS);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Try checking local storage first for instant loading/fallback
    const localUserStr = localStorage.getItem('portoconecta_local_user');
    let localUserLoaded = false;
    if (localUserStr) {
      try {
        const parsed = JSON.parse(localUserStr);
        if (parsed && parsed.uid) {
          setUser({
            uid: parsed.uid,
            displayName: parsed.displayName,
            avatarUrl: parsed.avatarUrl,
            role: parsed.role || 'driver',
          });
          localUserLoaded = true;
          setLoading(false);
        }
      } catch (err) {
        console.error('Error parsing local user:', err);
      }
    }

    // 2. Listen to Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch driver profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const profile = {
              uid: firebaseUser.uid,
              displayName: data.displayName || 'Motorista Anônimo',
              avatarUrl: data.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
              role: data.role || 'driver',
            };
            setUser(profile);
            localStorage.setItem('portoconecta_local_user', JSON.stringify(profile));
          } else {
            // Fallback profile
            const profile = {
              uid: firebaseUser.uid,
              displayName: 'Motorista',
              avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
              role: 'driver' as const,
            };
            setUser(profile);
            localStorage.setItem('portoconecta_local_user', JSON.stringify(profile));
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        // If there's no firebase user but we didn't log in locally either, sign out
        if (!localUserLoaded) {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLoginComplete = (profile: { uid: string; displayName: string; avatarUrl: string; role: 'driver' | 'admin' | 'operator' }) => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07111F] flex flex-col items-center justify-center text-white gap-4 font-sans">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-orange-500/20" />
        <p className="text-xs font-semibold tracking-widest uppercase text-gray-400">
          Carregando Porto Conecta...
        </p>
      </div>
    );
  }

  // Auth Guard
  if (!user) {
    return <LoginView onLoginComplete={handleLoginComplete} />;
  }

  // Selected Channel active view
  if (selectedChannelId) {
    const selectedChannel = channels.find((ch) => ch.id === selectedChannelId)!;
    return (
      <ChannelView
        channel={selectedChannel}
        userId={user.uid}
        userName={user.displayName}
        userAvatar={user.avatarUrl}
        onBack={() => setSelectedChannelId(null)}
      />
    );
  }

  // Active home screen
  return (
    <HomeView
      userId={user.uid}
      displayName={user.displayName}
      avatarUrl={user.avatarUrl}
      role={user.role}
      channels={channels}
      onSelectChannel={handleSelectChannel}
      onLogout={handleLogout}
      onUpdateRole={(newRole) => {
        const updated = { ...user, role: newRole };
        setUser(updated);
        localStorage.setItem('portoconecta_local_user', JSON.stringify(updated));
      }}
    />
  );
}
