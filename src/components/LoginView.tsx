/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Truck, Anchor, Shield, ArrowRight } from 'lucide-react';

interface LoginViewProps {
  onLoginComplete: (user: { uid: string; displayName: string; avatarUrl: string; role: 'driver' | 'admin' | 'operator' }) => void;
}

const AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200', // Woman 1
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200', // Man 1
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200', // Man 2
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200', // Woman 2
];

export default function LoginView({ onLoginComplete }: LoginViewProps) {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[1]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      let uid: string;
      try {
        // Authenticate with Firebase Auth Anonymously
        const userCredential = await signInAnonymously(auth);
        uid = userCredential.user.uid;
      } catch (authErr: any) {
        console.warn('Firebase Auth failed (possibly restricted or disabled), falling back to local persistent UID:', authErr);
        let localUid = localStorage.getItem('portoconecta_local_uid');
        if (!localUid) {
          localUid = 'local_drv_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
          localStorage.setItem('portoconecta_local_uid', localUid);
        }
        uid = localUid;
      }

      const profileData = {
        uid: uid,
        displayName: name.trim(),
        avatarUrl: selectedAvatar,
        role: 'driver',
        online: true,
        lastActive: Date.now(),
      };

      // Save driver profile in Firestore - rules allow unauthenticated write
      try {
        await setDoc(doc(db, 'users', uid), profileData);
      } catch (dbErr) {
        console.warn('Firestore user profile save failed (it is okay, we will continue with local state):', dbErr);
        handleFirestoreError(dbErr, OperationType.WRITE, `users/${uid}`);
      }

      // Save local user profile to localStorage for session persistence
      localStorage.setItem('portoconecta_local_user', JSON.stringify(profileData));

      // Callback to root state
      onLoginComplete({
        uid: uid,
        displayName: profileData.displayName,
        avatarUrl: profileData.avatarUrl,
        role: profileData.role as 'driver' | 'admin' | 'operator',
      });
    } catch (err: any) {
      console.error(err);
      setError('Ocorreu um erro ao conectar ao Porto Conecta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-porto-dark flex flex-col justify-center items-center px-4 relative overflow-hidden font-sans">
      {/* Absolute background visual details */}
      <div className="absolute inset-0 z-0 opacity-15">
        <img
          src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&q=80&w=1200"
          alt="Port"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-porto-dark via-porto-dark/90 to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="w-full max-w-md z-10"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 border border-orange-400/30 mb-4 transform rotate-12">
            <Anchor className="text-white transform -rotate-12" size={32} />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-white flex items-center gap-2">
            PORTO <span className="text-orange-500">CONECTA</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Comunicação instantânea para motoristas portuários
          </p>
        </div>

        {/* Form Container */}
        <div className="glass-card border-white/10 rounded-[24px] p-6 shadow-2xl relative">
          <div className="absolute -top-3 -right-3 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center gap-1.5">
            <Shield className="text-amber-500" size={12} />
            <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Acesso Seguro</span>
          </div>

          <form onSubmit={handleConnect} className="flex flex-col gap-6">
            {/* Input Name */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Seu Nome de Motorista
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  required
                  className="w-full px-4 py-3 bg-porto-dark border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 transition duration-200 font-medium"
                />
                <Truck className="absolute right-4 top-3.5 text-gray-500" size={18} />
              </div>
            </div>

            {/* Select Avatar */}
            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Selecione seu Avatar
              </label>
              <div className="flex justify-between gap-2">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar)}
                    className={`relative w-14 h-14 rounded-xl overflow-hidden transition-all duration-300 border-2 ${
                      selectedAvatar === avatar
                        ? 'border-orange-500 scale-105 shadow-lg shadow-orange-500/20'
                        : 'border-transparent hover:border-white/20'
                    }`}
                  >
                    <img
                      src={avatar}
                      alt="Avatar option"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {selectedAvatar === avatar && (
                      <div className="absolute inset-0 bg-orange-500/10 flex items-center justify-center" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-xs font-medium text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20 animate-pulse">
                {error}
              </p>
            )}

            {/* Connect Button */}
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition duration-200"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Entrar no Porto Conecta
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Quick footer notice */}
        <div className="text-center mt-6 text-gray-500 text-xs">
          Porto Conecta Operações © 2026. Todos os direitos reservados.
        </div>
      </motion.div>
    </div>
  );
}
