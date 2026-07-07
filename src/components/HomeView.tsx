/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Ship, 
  Truck, 
  Calendar, 
  Store, 
  User, 
  LogOut, 
  ChevronRight,
  Camera,
  AlertTriangle,
  Trash2,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  X,
  ChevronDown,
  Shield,
  ShieldAlert,
  Bell,
  Settings,
  Anchor,
  MessageSquare,
  Move,
  Lock,
  MessageCircle,
  Share2,
  Calculator,
  Mic,
  Users,
  Megaphone,
  Ban,
  UserCheck,
  RefreshCw,
  Sliders,
  Plus,
  Siren,
  Heart,
  Eye,
  EyeOff,
  Copy,
  Check,
  Award,
  CheckSquare,
  Database
} from 'lucide-react';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  collection, 
  query, 
  orderBy, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  addDoc, 
  db, 
  testSupabaseConnection,
  getDbProvider,
  setDbProvider
} from '../lib/supabase';
import { Channel } from '../types';
import EcgCanvas from './EcgCanvas';

const WhatsAppIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
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

const compressAndConvertImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 200;
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // compress to 70% quality JPEG
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};
import { compressImage } from '../lib/imageCompression';
import { extractDominantColor, DEFAULT_PALETTE, ColorPalette } from '../lib/colorExtractor';
import WeatherWidget from './WeatherWidget';

interface HomeViewProps {
  userId: string;
  displayName: string;
  avatarUrl: string;
  role: 'driver' | 'admin' | 'operator';
  email?: string;
  channels: Channel[];
  onSelectChannel: (channelId: string) => void;
  onLogout: () => void;
  onUpdateRole: (newRole: 'driver' | 'admin' | 'operator') => void;
  onUpdateAvatar: (newAvatarUrl: string) => void;
}

interface StatusImageDoc {
  imageUrl: string;
  uploadedBy: {
    uid: string;
    displayName: string;
    avatarUrl?: string;
  };
  uploadedAt: number;
  reports?: string[];
  isDefault?: boolean;
  yOffset?: number;
  currentCycleId?: string;
  publishedUsersInCycle?: Record<string, boolean>;
  deletedUsersInCycle?: Record<string, boolean>;
}

const PORT_AND_TRUCK_IMAGES: { name: string; url: string; desc: string }[] = [];

const DEFAULT_IMAGE = '/logo_porto.png?v=2';

function getCycleDefaultImage(cycleId: string): string {
  return '/logo_porto.png?v=2';
}

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function getCycleInfo(timestamp: number, timezoneOffsetMinutes = new Date().getTimezoneOffset()): { id: string; start: number; end: number } {
  const localDate = new Date(timestamp - (timezoneOffsetMinutes * 60000));
  
  const hours = localDate.getUTCHours();
  const minutes = localDate.getUTCMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  let cycleStartHour: number;
  let cycleEndHour: number;
  let cycleLabel: string;
  
  if (timeInMinutes >= 0 && timeInMinutes < 420) {
    cycleStartHour = 0;
    cycleEndHour = 7;
    cycleLabel = "00:00";
  } else if (timeInMinutes >= 420 && timeInMinutes < 1080) {
    cycleStartHour = 7;
    cycleEndHour = 18;
    cycleLabel = "07:00";
  } else {
    cycleStartHour = 18;
    cycleEndHour = 24;
    cycleLabel = "18:00";
  }
  
  const startLocal = new Date(localDate);
  startLocal.setUTCHours(cycleStartHour, 0, 0, 0);
  const startTimestamp = startLocal.getTime() + (timezoneOffsetMinutes * 60000);
  
  const endLocal = new Date(localDate);
  let endTimestamp = 0;
  if (cycleEndHour === 24) {
    endLocal.setUTCHours(23, 59, 59, 999);
    endTimestamp = endLocal.getTime() + 1 + (timezoneOffsetMinutes * 60000);
  } else {
    endLocal.setUTCHours(cycleEndHour, 0, 0, 0);
    endTimestamp = endLocal.getTime() + (timezoneOffsetMinutes * 60000);
  }
  
  const year = localDate.getUTCFullYear();
  const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(localDate.getUTCDate()).padStart(2, '0');
  const cycleId = `${year}-${month}-${day}_${cycleLabel}`;
  
  return {
    id: cycleId,
    start: startTimestamp,
    end: endTimestamp
  };
}

const getTimestampMs = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.seconds === 'number') return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000);
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'string') return new Date(val).getTime();
  return 0;
};

// High-fidelity organically shaped wavy signal paths matching the ChannelView/Equalizer exactly
const wavePath = "M -400 50 L -370 50 Q -360 47, -350 50 T -330 50 Q -320 55, -310 50 Q -295 36, -280 50 Q -270 60, -260 50 L -220 50 Q -210 42, -200 50 T -180 50 Q -165 64, -150 50 Q -140 38, -130 50 L -80 50 Q -65 42, -50 50 Q -40 58, -30 50 L 0 50 L 30 50 Q 40 47, 50 50 T 70 50 Q 80 55, 90 50 Q 105 36, 120 50 Q 130 60, 140 50 L 180 50 Q 190 42, 200 50 T 220 50 Q 235 64, 250 50 Q 260 38, 270 50 L 320 50 Q 335 42, 350 50 Q 360 58, 370 50 L 400 50 L 430 50 Q 440 47, 450 50 T 470 50 Q 480 55, 490 50 Q 505 36, 520 50 Q 530 60, 540 50 L 580 50 Q 590 42, 600 50 T 620 50 Q 635 64, 650 50 Q 660 38, 670 50 L 720 50 Q 735 42, 750 50 Q 760 58, 770 50 L 800 50";
const curvyWavePath = "M -400 50 L -370 50 Q -360 32, -350 50 T -330 50 Q -320 68, -310 50 Q -295 18, -280 50 Q -270 82, -260 50 L -220 50 Q -210 28, -200 50 T -180 50 Q -165 85, -150 50 Q -140 15, -130 50 L -80 50 Q -65 24, -50 50 Q -40 76, -30 50 L 0 50 L 30 50 Q 40 32, 50 50 T 70 50 Q 80 68, 90 50 Q 105 18, 120 50 Q 130 82, 140 50 L 180 50 Q 190 28, 200 50 T 220 50 Q 235 85, 250 50 Q 260 15, 270 50 L 320 50 Q 335 24, 350 50 Q 360 76, 370 50 L 400 50 L 430 50 Q 440 32, 450 50 T 470 50 Q 480 68, 490 50 Q 505 18, 520 50 Q 530 82, 540 50 L 580 50 Q 590 28, 600 50 T 620 50 Q 635 85, 650 50 Q 660 15, 670 50 L 720 50 Q 735 24, 750 50 Q 760 76, 770 50 L 800 50";

export default function HomeView({
  userId,
  displayName,
  avatarUrl,
  role,
  email,
  channels,
  onSelectChannel,
  onLogout,
  onUpdateRole,
  onUpdateAvatar,
}: HomeViewProps) {
  const [statusImage, setStatusImage] = useState<StatusImageDoc | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const [showStatusDetails, setShowStatusDetails] = useState(false);
  const [showCameraPanel, setShowCameraPanel] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [stagedImage, setStagedImage] = useState<string | null>(null);
  const [stagedYOffset, setStagedYOffset] = useState<number>(30);
  const [localActiveYOffset, setLocalActiveYOffset] = useState<number | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [showWhatsappContacts, setShowWhatsappContacts] = useState(false);
  const [securityReportText, setSecurityReportText] = useState('');
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [reportSentSuccess, setReportSentSuccess] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Validate Connection to Supabase on startup and handle offline / unavailable gracefully
  useEffect(() => {
    const testConnection = async () => {
      try {
        const { getDocFromServer, doc } = await import('../lib/supabase');
        await getDocFromServer(doc(db, 'settings', 'status_image'));
        setIsOfflineMode(false);
      } catch (error: any) {
        console.warn('Supabase connection failed. Running in high-performance local fallback mode:', error);
        setIsOfflineMode(true);
      }
    };
    testConnection();
  }, []);

  // Check if custom image is active according to the shared cycle system
  const getActiveImageInfo = () => {
    const currentCycle = getCycleInfo(Date.now());
    const defaultImg = getCycleDefaultImage(currentCycle.id);
    if (!statusImage || statusImage.isDefault) {
      return { isActive: false, imageUrl: defaultImg, doc: null };
    }
    if (statusImage.currentCycleId !== currentCycle.id) {
      return { isActive: false, imageUrl: defaultImg, doc: null };
    }
    return { isActive: true, imageUrl: statusImage.imageUrl, doc: statusImage };
  };

  const activeInfo = getActiveImageInfo();

  const [palette, setPalette] = useState<ColorPalette>(DEFAULT_PALETTE);

  // Dynamically extract colors from the active image or staged image
  useEffect(() => {
    const targetUrl = stagedImage || activeInfo.imageUrl;
    if (targetUrl) {
      extractDominantColor(targetUrl)
        .then((extracted) => {
          setPalette(extracted);
        })
        .catch((err) => {
          console.warn('Error extracting color palette:', err);
          setPalette(DEFAULT_PALETTE);
        });
    } else {
      setPalette(DEFAULT_PALETTE);
    }
  }, [activeInfo.imageUrl, stagedImage]);

  const [hasLikedStatusImage, setHasLikedStatusImage] = useState(false);
  const [statusLikesCount, setStatusLikesCount] = useState(0);

  useEffect(() => {
    if (statusImage) {
      const likedBy = (statusImage as any).likedBy || [];
      setHasLikedStatusImage(likedBy.includes(userId));
      setStatusLikesCount((statusImage as any).likesCount || 0);
    } else {
      setHasLikedStatusImage(false);
      setStatusLikesCount(0);
    }
  }, [statusImage, userId]);

  const handleLikeStatusImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!statusImage) return;

    const likedBy = (statusImage as any).likedBy || [];
    let updatedLikedBy: string[];
    let diff = 0;

    if (likedBy.includes(userId)) {
      // Unlike
      updatedLikedBy = likedBy.filter((uid: string) => uid !== userId);
      diff = -1;
    } else {
      // Like
      updatedLikedBy = [...likedBy, userId];
      diff = 1;
    }

    const currentLikes = (statusImage as any).likesCount || 0;
    const updatedDoc = {
      ...statusImage,
      likedBy: updatedLikedBy,
      likesCount: Math.max(0, currentLikes + diff),
    };

    // Optimistic UI update
    setStatusImage(updatedDoc);
    setHasLikedStatusImage(updatedLikedBy.includes(userId));
    setStatusLikesCount(Math.max(0, currentLikes + diff));

    try {
      localStorage.setItem('fallback_status_image', JSON.stringify(updatedDoc));
    } catch (err) {}

    try {
      const response = await fetch('/api/status/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.statusImage) {
          setStatusImage(data.statusImage);
          try {
            localStorage.setItem('fallback_status_image', JSON.stringify(data.statusImage));
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('Error liking status image via API (used local state fallback):', err);
    }
  };

  // New administrator states
  const isAdmin = email?.trim().toLowerCase() === 'jonas1401@gmail.com' || role === 'admin';
  
  // Permissions according to Status Global by Cycles
  const currentCycle = getCycleInfo(Date.now());
  const isStatusImageFromCurrentCycle = !!(statusImage && statusImage.currentCycleId === currentCycle.id);

  const hasPublishedInCycle = !!(isStatusImageFromCurrentCycle && statusImage.publishedUsersInCycle && statusImage.publishedUsersInCycle[userId]);
  const hasDeletedInCycle = !!(isStatusImageFromCurrentCycle && statusImage.deletedUsersInCycle && statusImage.deletedUsersInCycle[userId]);
  
  // Can current user upload / publish?
  const canPublishStatus = isAdmin || (
    (!isStatusImageFromCurrentCycle || statusImage.isDefault || statusImage.uploadedBy?.uid === userId) &&
    !hasPublishedInCycle &&
    !hasDeletedInCycle
  );
  
  // Can current user delete / reset?
  const canDeleteStatus = isAdmin || (
    !!(isStatusImageFromCurrentCycle && !statusImage.isDefault && statusImage.uploadedBy?.uid === userId && !hasDeletedInCycle)
  );
  
  // isStatusLocked is used to disable controls for other users
  const isStatusLocked = !isAdmin && !!(isStatusImageFromCurrentCycle && !statusImage.isDefault && statusImage.uploadedBy?.uid !== userId);
  const [adminTab, setAdminTab] = useState<'reports' | 'status' | 'users' | 'bans' | 'announcements' | 'supabase'>('reports');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [bannedEmailsList, setBannedEmailsList] = useState<any[]>([]);
  const [bannedUidsList, setBannedUidsList] = useState<any[]>([]);
  const [newBanEmail, setNewBanEmail] = useState('');
  const [newBanReason, setNewBanReason] = useState('');
  const [newAnnouncementText, setNewAnnouncementText] = useState('');
  const [newAnnouncementLevel, setNewAnnouncementLevel] = useState<'info' | 'warning' | 'danger'>('warning');
  const [globalAnnouncement, setGlobalAnnouncement] = useState<{
    text: string;
    active: boolean;
    createdAt: number;
    createdBy: string;
    level: 'warning' | 'info' | 'danger';
  } | null>(null);

  // States for real-time popup notifications
  const [activeNotification, setActiveNotification] = useState<{
    id: string;
    title: string;
    message: string;
    senderName: string;
    sentAt: number;
    type: 'info' | 'warning' | 'success' | 'alert';
  } | null>(null);

  const [dismissedNotificationId, setDismissedNotificationId] = useState<string | null>(() => {
    return localStorage.getItem('dismissed_notification_id');
  });

  const [dismissedAnnouncementText, setDismissedAnnouncementText] = useState<string | null>(() => {
    return localStorage.getItem('dismissed_announcement_text');
  });

  const [newNotifTitle, setNewNotifTitle] = useState('');
  const [newNotifMessage, setNewNotifMessage] = useState('');
  const [newNotifType, setNewNotifType] = useState<'info' | 'warning' | 'success' | 'alert'>('info');

  // Supabase states
  const [checkingSupabase, setCheckingSupabase] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<{ checked: boolean; success: boolean; message: string }>({
    checked: false,
    success: false,
    message: ''
  });
  const [sqlCopied, setSqlCopied] = useState(false);

  const SUPABASE_SQL_SETUP = `-- 1. Tabela de Usuários (users)
create table if not exists users (
  id text primary key,
  display_name text,
  email text,
  avatar_url text,
  role text,
  online boolean default false,
  last_active timestamp with time zone default now()
);

-- 2. Tabela de Tickets de Viagem (tickets)
create table if not exists tickets (
  id text primary key,
  user_id text references users(id) on delete cascade,
  title text not null,
  date date not null,
  image_url text,
  description text,
  created_at timestamp with time zone default now()
);

-- 3. Tabela de Eventos da Agenda (events)
create table if not exists events (
  id text primary key,
  user_id text references users(id) on delete cascade,
  title text not null,
  date date not null,
  time text,
  description text,
  created_at timestamp with time zone default now()
);

-- 4. Tabela de Notas Pessoais (notes)
create table if not exists notes (
  id text primary key,
  user_id text references users(id) on delete cascade,
  title text not null,
  content text,
  color text,
  created_at timestamp with time zone default now()
);

-- 5. Tabela de Checklists (checklists)
create table if not exists checklists (
  id text primary key,
  user_id text references users(id) on delete cascade,
  title text not null,
  items jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now()
);

-- 6. Tabela de Configurações Gerais (settings)
create table if not exists settings (
  id text primary key,
  value jsonb not null
);

-- 7. Tabela de E-mails Banidos (banned_emails)
create table if not exists banned_emails (
  id text primary key,
  reason text,
  banned_at timestamp with time zone default now()
);

-- 8. Tabela de UIDs Banidos (banned_uids)
create table if not exists banned_uids (
  id text primary key,
  reason text,
  banned_at timestamp with time zone default now()
);

-- 9. Tabela de Denúncias (reports)
create table if not exists reports (
  id text primary key,
  reported_at timestamp with time zone default now(),
  sender_id text,
  channel_id text,
  message_id text,
  message_text text,
  message_user text,
  reason text
);

-- 10. Tabela de Mensagens do Chat (messages)
create table if not exists messages (
  id text primary key,
  channel_id text not null,
  user_id text not null references users(id) on delete cascade,
  user_name text not null,
  user_avatar text,
  text text default '',
  image_url text,
  audio_url text,
  audio_duration numeric,
  created_at timestamp with time zone default now(),
  is_sticker boolean default false,
  is_comercio_ad boolean default false,
  candidate_name text,
  candidate_photo text,
  candidate_phone text,
  candidate_experience text,
  candidate_cnh text,
  candidate_obs text,
  likes integer default 0,
  likes_users text[] default '{}'::text[],
  reply_to jsonb
);`;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to real-time reports for Admin role
  useEffect(() => {
    if (!isAdmin) return;
    try {
      const q = query(collection(db, 'reports'), orderBy('reportedAt', 'desc'));
      const unsub = onSnapshot(q, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setReports(list);
      }, (err) => {
        console.warn('Erro na assinatura do painel de denúncias:', err);
      });
      return () => unsub();
    } catch (err) {
      console.warn('Erro ao configurar escuta de denúncias:', err);
    }
  }, [isAdmin]);

  // Subscribe to real-time users, banned emails, and banned uids for Admin
  useEffect(() => {
    if (!isAdmin || !showAdminPanel) return;

    try {
      const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setUsersList(list);
      }, (err) => console.warn('Users fetch error:', err));

      const unsubBannedEmails = onSnapshot(collection(db, 'banned_emails'), (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setBannedEmailsList(list);
      }, (err) => console.warn('Banned emails fetch error:', err));

      const unsubBannedUids = onSnapshot(collection(db, 'banned_uids'), (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setBannedUidsList(list);
      }, (err) => console.warn('Banned uids fetch error:', err));

      return () => {
        unsubUsers();
        unsubBannedEmails();
        unsubBannedUids();
      };
    } catch (err) {
      console.warn('Error setting up admin real-time subscriptions:', err);
    }
  }, [isAdmin, showAdminPanel]);

  // Subscribe to global announcements in real-time
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global_announcement'), (snapshot) => {
      if (snapshot.exists()) {
        setGlobalAnnouncement(snapshot.data() as any);
      } else {
        setGlobalAnnouncement(null);
      }
    }, (err) => {
      console.warn('Erro ao ler avisos globais:', err);
    });
    return () => unsub();
  }, []);

  // Subscribe to real-time pop-up notifications
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'app_notification'), (snapshot) => {
      if (snapshot.exists()) {
        setActiveNotification(snapshot.data() as any);
      } else {
        setActiveNotification(null);
      }
    }, (err) => {
      console.warn('Erro ao ler notificações pop-up:', err);
    });
    return () => unsub();
  }, []);

  // Periodic heartbeat to mark current user as active/online
  useEffect(() => {
    if (!userId) return;

    const sendHeartbeat = async () => {
      try {
        await setDoc(doc(db, 'users', userId), {
          online: true,
          lastActive: Date.now()
        }, { merge: true });
      } catch (err) {
        console.warn('Erro ao atualizar presença online:', err);
      }
    };

    // Send immediately on mount
    sendHeartbeat();

    // Send every 30 seconds
    const interval = setInterval(sendHeartbeat, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [userId]);

  // Subscribe to and periodically poll status from the backend to ensure automatic synchronization of cycles
  useEffect(() => {
    // Try to load initial fallback from localStorage first so there's immediate UI feedback
    try {
      const localData = localStorage.getItem('fallback_status_image');
      if (localData) {
        setStatusImage(JSON.parse(localData));
      }
    } catch (e) {}

    // 1. Initial and periodic backend status sync
    const fetchStatus = async () => {
      try {
        const offset = new Date().getTimezoneOffset();
        const res = await fetch(`/api/status?timezoneOffset=${offset}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.statusImage) {
            setStatusImage(data.statusImage);
            try {
              localStorage.setItem('fallback_status_image', JSON.stringify(data.statusImage));
            } catch (e) {}
          }
        }
      } catch (err) {
        console.warn('[Status Fetch Sync Error]:', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 6000);

    // 2. Real-time Supabase snapshot listener for instant notification
    const unsub = onSnapshot(doc(db, 'settings', 'status_image'), 
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as StatusImageDoc;
          setStatusImage(data);
          setLocalActiveYOffset(null);
          try {
            localStorage.setItem('fallback_status_image', JSON.stringify(data));
          } catch (e) {}
        } else {
          // Fall back to querying the backend if Firestore doc is cleared or deleted
          fetchStatus();
        }
      },
      (error) => {
        console.warn('Supabase subscription error (offline or limited):', error);
        setIsOfflineMode(true);
      }
    );

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  // Dynamic countdown string for the current cycle's end time
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      
      let targetHour: number;
      let nextDay = false;
      
      if (timeInMinutes >= 0 && timeInMinutes < 420) {
        // 00:00 to 07:00
        targetHour = 7;
      } else if (timeInMinutes >= 420 && timeInMinutes < 1080) {
        // 07:00 to 18:00
        targetHour = 18;
      } else {
        // 18:00 to 00:00
        targetHour = 0;
        nextDay = true;
      }
      
      const targetDate = new Date(now);
      targetDate.setHours(targetHour, 0, 0, 0);
      if (nextDay) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeftStr('00h 00m 00s');
        return;
      }
      
      const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
      const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secondsLeft = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeftStr(`${String(hoursLeft).padStart(2, '0')}h ${String(minutesLeft).padStart(2, '0')}m ${String(secondsLeft).padStart(2, '0')}s`);

      // Proactive check: if local clock has entered a new cycle, trigger status update
      const currentCycle = getCycleInfo(Date.now());
      if (statusImage && statusImage.currentCycleId && statusImage.currentCycleId !== currentCycle.id) {
        console.log('[Frontend Cycle Monitor] Cycle changed. Triggering sync...');
        const offset = new Date().getTimezoneOffset();
        fetch(`/api/status?timezoneOffset=${offset}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.statusImage) {
              setStatusImage(data.statusImage);
              try {
                localStorage.setItem('fallback_status_image', JSON.stringify(data.statusImage));
              } catch (e) {}
            }
          })
          .catch(err => console.warn('[Frontend Cycle Monitor Sync Error]:', err));
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [statusImage?.currentCycleId]);

  const getPublishButtonLabel = () => {
    if (statusImage && !statusImage.isDefault) {
      if (hasPublishedInCycle) return 'Já publicou neste ciclo';
      if (hasDeletedInCycle) return 'Publicação bloqueada (apagou foto)';
      if (isStatusLocked) return 'Status ocupado por outro usuário';
      return 'Substituir Foto do Fundo';
    } else {
      if (hasPublishedInCycle) return 'Já publicou neste ciclo';
      if (hasDeletedInCycle) return 'Publicação bloqueada (apagou foto)';
      return 'Enviar Foto de Fundo';
    }
  };

  // Greeting based on current hours
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) return 'Bom dia';
    if (hours >= 12 && hours < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canPublishStatus) {
      if (hasPublishedInCycle) {
        alert('Você já publicou uma imagem neste ciclo. Você poderá publicar novamente apenas no próximo ciclo!');
      } else if (hasDeletedInCycle) {
        alert('Você já apagou sua imagem neste ciclo e perdeu o direito de publicar outra até o próximo ciclo!');
      } else {
        alert(`O status está ocupado por ${statusImage?.uploadedBy?.displayName || 'outro usuário'} e está bloqueado para modificações até o próximo ciclo.`);
      }
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsAnalyzing(true);

    try {
      // Compress and resize the image to a maximum of 1000x1000 with 0.7 quality.
      // This reduces image sizes from multi-megabyte to around 50-150KB.
      const compressedBase64 = await compressImage(file, 1000, 1000, 0.7);
      await uploadAndVerifyImage(compressedBase64);
    } catch (err: any) {
      console.error('Error during image compression:', err);
      setUploadError(err.message || 'Erro ao processar e comprimir a imagem.');
      setIsAnalyzing(false);
    } finally {
      e.target.value = '';
    }
  };

  const uploadAndVerifyImage = async (base64String: string) => {
    setIsAnalyzing(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const response = await fetch('/api/verify-status-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64String }),
      });

      if (!response.ok) {
        throw new Error('Falha na comunicação com o servidor de IA.');
      }

      const data = await response.json();

      if (data.approved) {
        setStagedImage(base64String);
        setStagedYOffset(30);
        setShowCameraPanel(true); // Open the panel to let them save!
      } else {
        setUploadError(data.reason || 'Sua imagem foi recusada pelos filtros de IA. Verifique se contém nudez, textos racistas ou ofensivos.');
      }
    } catch (err: any) {
      console.error('Error during safety verification:', err);
      setUploadError(err.message || 'Erro inesperado ao escanear imagem com IA.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteStatus = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!statusImage || statusImage.isDefault) return;
    
    const isOwner = statusImage.uploadedBy?.uid === userId;
    if (!isOwner && !isAdmin) {
      alert('Você não tem permissão para apagar a imagem de outro usuário!');
      return;
    }
    
    if (!window.confirm('Tem certeza de que deseja apagar a imagem de status atual? O status voltará ao padrão e você não poderá publicar outra imagem até o próximo ciclo.')) return;
    
    try {
      const offset = new Date().getTimezoneOffset();
      const response = await fetch('/api/status/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          isAdmin,
          timezoneOffset: offset
        }),
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setStatusImage(data.statusImage);
        try {
          localStorage.setItem('fallback_status_image', JSON.stringify(data.statusImage));
        } catch (err) {}
        alert('Sua imagem de status foi removida e você gastou sua tentativa de publicação neste ciclo.');
      } else {
        alert(data.error || 'Erro ao remover imagem de status.');
      }
    } catch (err) {
      console.error('Error deleting status:', err);
      alert('Erro inesperado ao remover imagem de status.');
    }
  };

  const handleDenounce = async () => {
    if (!statusImage) return;
    const currentReports = statusImage.reports || [];
    if (currentReports.includes(userId)) {
      alert('Você já denunciou esta imagem. O administrador foi alertado.');
      return;
    }

    try {
      const response = await fetch('/api/status/denounce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.statusImage) {
          setStatusImage(data.statusImage);
          try {
            localStorage.setItem('fallback_status_image', JSON.stringify(data.statusImage));
          } catch (err) {}
          alert('Imagem denunciada com sucesso. O administrador analisará a imagem para remoção.');
        }
      }
    } catch (err) {
      console.error('Error denouncing status:', err);
      alert('Denúncia registrada com sucesso!');
    }
  };

  const handleAdminReset = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) {
      alert('Apenas administradores podem redefinir o status do aplicativo.');
      return;
    }
    if (!window.confirm('Tem certeza de que deseja remover esta imagem de status?')) return;

    try {
      const offset = new Date().getTimezoneOffset();
      const response = await fetch('/api/status/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: true, timezoneOffset: offset }),
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setStatusImage(data.statusImage);
        try {
          localStorage.setItem('fallback_status_image', JSON.stringify(data.statusImage));
        } catch (err) {}
        alert('Status do porto restaurado ao padrão com sucesso!');
      } else {
        alert(data.error || 'Erro ao redefinir status.');
      }
    } catch (err) {
      console.error('Error resetting status:', err);
      alert('Erro inesperado ao redefinir status.');
    }
  };

  const handleLogout = async () => {
    try {
      await setDoc(doc(db, 'users', userId), {
        online: false,
        lastActive: Date.now()
      }, { merge: true });
    } catch (err) {
      console.warn('Erro ao desativar presença no logout:', err);
    }
    onLogout();
  };

  const handleUpdateYOffset = async (val: number) => {
    try {
      const response = await fetch('/api/status/update-yoffset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yOffset: val, userId, isAdmin }),
      });
      const data = await response.json();
      if (response.ok && data.statusImage) {
        setStatusImage(data.statusImage);
        try {
          localStorage.setItem('fallback_status_image', JSON.stringify(data.statusImage));
        } catch (err) {}
      } else {
        alert(data.error || 'Erro ao ajustar posicionamento.');
      }
    } catch (err) {
      console.error('Error updating Y offset:', err);
    } finally {
      setLocalActiveYOffset(null);
    }
  };

  const handleSaveStagedImage = async () => {
    if (!stagedImage) return;

    if (!canPublishStatus) {
      alert(`Você não tem permissão para publicar uma imagem neste ciclo.`);
      handleCancelStaged();
      setShowCameraPanel(false);
      return;
    }
    setUploadError(null);
    setIsAnalyzing(true);

    try {
      const offset = new Date().getTimezoneOffset();
      const response = await fetch('/api/status/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: stagedImage,
          yOffset: stagedYOffset,
          userId,
          userName: displayName,
          userAvatar: avatarUrl,
          isAdmin,
          timezoneOffset: offset
        }),
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setStatusImage(data.statusImage);
        try {
          localStorage.setItem('fallback_status_image', JSON.stringify(data.statusImage));
        } catch (e) {}
        
        setStagedImage(null);
        setShowCameraPanel(false);
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 5000);
      } else {
        setUploadError(data.error || 'Não foi possível publicar sua imagem de status.');
      }
    } catch (err: any) {
      console.error('Error saving status image:', err);
      setUploadError(err.message || 'Erro de conexão ao salvar a imagem.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCancelStaged = () => {
    setStagedImage(null);
    setUploadError(null);
  };

  const handleTriggerUpload = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!canPublishStatus) {
      if (hasPublishedInCycle) {
        alert('Você já publicou uma imagem neste ciclo. Você poderá publicar novamente apenas no próximo ciclo!');
      } else if (hasDeletedInCycle) {
        alert('Você já apagou sua imagem neste ciclo e perdeu o direito de publicar outra até o próximo ciclo!');
      } else {
        alert(`O status está ocupado por ${statusImage?.uploadedBy?.displayName || 'outro usuário'} e está bloqueado para modificações até o próximo ciclo.`);
      }
      return;
    }
    fileInputRef.current?.click();
  };

  const getChannelIconComponent = (icon: string, color: string) => {
    const props = { size: 22, style: { color: color } };
    switch (icon) {
      case 'ship': return <Ship {...props} />;
      case 'truck': return <Truck {...props} />;
      case 'calendar': return <Calendar {...props} />;
      case 'store': return <Store {...props} />;
      case 'calculator': return <Calculator {...props} />;
      default: return <Ship {...props} />;
    }
  };

  const showNotificationPopup = !!(activeNotification && activeNotification.id && activeNotification.id !== dismissedNotificationId);
  
  const handleDismissNotification = () => {
    if (activeNotification) {
      localStorage.setItem('dismissed_notification_id', activeNotification.id);
      setDismissedNotificationId(activeNotification.id);
    }
  };

  return (
    <div 
      className="h-screen sm:h-[100dvh] bg-[#030914] flex flex-col justify-between font-sans text-white relative overflow-hidden pb-4"
      style={{
        '--pc-primary': palette.primary,
        '--pc-primary-rgb': palette.primaryRgb,
        '--pc-primary-light': palette.primaryLight,
        '--pc-primary-dark': palette.primaryDark,
        '--pc-bg-soft': palette.bgSoft,
        '--pc-border-soft': palette.borderSoft,
        '--pc-glow': palette.glow,
      } as React.CSSProperties}
    >
      {/* 🚨 REAL-TIME APP NOTIFICATION OVERLAY */}
      <AnimatePresence>
        {showNotificationPopup && activeNotification && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed inset-x-4 top-4 sm:top-6 z-[9999] max-w-[400px] mx-auto pointer-events-auto"
          >
            <div className={`p-4 rounded-[24px] border backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col gap-3 relative overflow-hidden ${
              activeNotification.type === 'danger' || activeNotification.type === 'alert'
                ? 'bg-red-950/85 border-red-500/35 text-red-100 shadow-red-500/5'
                : activeNotification.type === 'warning'
                ? 'bg-amber-950/85 border-amber-500/35 text-amber-100 shadow-amber-500/5'
                : activeNotification.type === 'success'
                ? 'bg-emerald-950/85 border-emerald-500/35 text-emerald-100 shadow-emerald-500/5'
                : 'bg-slate-900/90 border-blue-500/35 text-blue-100 shadow-blue-500/5'
            }`}>
              
              {/* Top border glowing line */}
              <div className={`absolute top-0 inset-x-0 h-1 ${
                activeNotification.type === 'danger' || activeNotification.type === 'alert'
                  ? 'bg-red-500'
                  : activeNotification.type === 'warning'
                  ? 'bg-amber-500'
                  : activeNotification.type === 'success'
                  ? 'bg-emerald-500'
                  : 'bg-blue-500'
              }`} />

              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl shrink-0 ${
                  activeNotification.type === 'danger' || activeNotification.type === 'alert'
                    ? 'bg-red-500/20 text-red-400'
                    : activeNotification.type === 'warning'
                    ? 'bg-amber-500/20 text-amber-400'
                    : activeNotification.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {activeNotification.type === 'danger' || activeNotification.type === 'alert' ? (
                    <Siren size={20} className="animate-pulse" />
                  ) : activeNotification.type === 'warning' ? (
                    <AlertTriangle size={20} />
                  ) : activeNotification.type === 'success' ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <Bell size={20} className="animate-bounce" />
                  )}
                </div>

                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider opacity-65">Aviso do Admin</span>
                    <span className="text-[8px] opacity-40">•</span>
                    <span className="text-[8.5px] opacity-65 font-medium">{new Date(activeNotification.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <h3 className="text-sm font-black text-white leading-tight mt-0.5 truncate">{activeNotification.title}</h3>
                  <p className="text-[11px] sm:text-[11.5px] font-medium leading-relaxed mt-1 opacity-90 break-words whitespace-pre-wrap">{activeNotification.message}</p>
                </div>
              </div>

              {/* Bottom close button */}
              <div className="flex gap-2 justify-end mt-0.5 pt-2 border-t border-white/5">
                <button
                  onClick={handleDismissNotification}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                >
                  Confirmar e Fechar
                </button>
              </div>

              {/* Absolute Close X in corner */}
              <button 
                onClick={handleDismissNotification}
                className="absolute top-3 right-3 text-white/30 hover:text-white/60 cursor-pointer p-1 rounded-full hover:bg-white/5 transition"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`
        .theme-glow-text {
          color: var(--pc-primary) !important;
          text-shadow: 0 0 15px var(--pc-glow) !important;
        }
        .theme-border {
          border-color: var(--pc-border-soft) !important;
        }
        .theme-border-hover:hover {
          border-color: var(--pc-primary) !important;
        }
        .theme-bg-soft {
          background-color: var(--pc-bg-soft) !important;
        }
        .theme-text {
          color: var(--pc-primary) !important;
        }
        .theme-text-light {
          color: var(--pc-primary-light) !important;
        }
        .theme-bg {
          background-color: var(--pc-primary) !important;
        }
        .theme-bg-hover:hover {
          background-color: var(--pc-primary-dark) !important;
        }
        .theme-accent-range {
          accent-color: var(--pc-primary) !important;
        }
        .theme-shadow {
          box-shadow: 0 4px 15px rgba(0,0,0,0.3), 0 0 8px var(--pc-glow) !important;
        }
        .theme-shadow-hover:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.45), 0 0 15px var(--pc-glow) !important;
        }
        /* Group hover styling support */
        .group:hover .group-hover-theme-bg {
          background-color: var(--pc-bg-soft) !important;
          opacity: 0.9;
        }
        .group:hover .group-hover-theme-border {
          border-color: var(--pc-primary) !important;
        }
        .group:hover .group-hover-theme-text {
          color: var(--pc-primary-light) !important;
        }
        .group:hover .group-hover-theme-glow {
          filter: drop-shadow(0 0 6px var(--pc-primary)) !important;
        }
      `}</style>
      
      {/* BACKGROUND IMAGE - Functions as the application status background positioned up to the middle of the screen with a 10% bottom gradient fade */}
      <div 
        className="absolute top-0 inset-x-0 h-[60vh] sm:h-1/2 z-0 bg-cover transition-all duration-700"
        style={{ 
          backgroundImage: `url(${stagedImage || activeInfo.imageUrl})`,
          backgroundPosition: `center ${statusImage?.yOffset ?? 50}%`,
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 90%, rgba(0,0,0,0) 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 90%, rgba(0,0,0,0) 100%)',
        }}
      />
      {/* Ambient gradient fade overlays for high legibility and contrast */}
      {/* Extremely light top vignette to preserve pristine image sharpness while maintaining text contrast */}
      <div className="absolute inset-x-0 top-0 h-[180px] z-0 bg-gradient-to-b from-black/45 to-transparent pointer-events-none" />
      {/* Rich dark blue bottom overlay that perfectly blends the fading image into the core deep container background */}
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#030914] via-[#030914]/85 to-transparent pointer-events-none" />

      {/* Hidden File Input for uploading status photos */}
      <input
        type="file"
        accept="image/*,image/heic,image/heif,.heic,.heif"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="w-full max-w-[430px] mx-auto z-10 px-5 flex flex-col justify-between flex-1 gap-2.5 sm:gap-4 h-full py-1 sm:py-3 overflow-hidden relative">
        
        {/* 1. TOP HEADER (PORTO CONECTA LOGO & NOTIFICATION/SETTINGS) */}
        <header className="py-2.5 sm:py-4 flex items-center justify-between">
          {/* Logo Hexágono Port Hub (Highly stylized wave-art hexagon gradient matching mockup) */}
          <div className="flex items-center gap-3.5 select-none">
            <svg 
              className="w-11 h-11" 
              style={{ filter: 'drop-shadow(0 0 12px var(--pc-glow))' }}
              viewBox="0 0 100 100" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="logo-hex-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="var(--pc-primary-light)" />
                  <stop offset="100%" stopColor="var(--pc-primary-dark)" />
                </linearGradient>
                <linearGradient id="wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255, 255, 255, 0.45)" />
                  <stop offset="50%" stopColor="rgba(255, 255, 255, 0.85)" />
                  <stop offset="100%" stopColor="rgba(255, 255, 255, 0.35)" />
                </linearGradient>
              </defs>
              {/* Hexagon background */}
              <path d="M50 5 L89 27.5 L89 72.5 L50 95 L11 72.5 L11 27.5 Z" fill="url(#logo-hex-grad)" />
              {/* Stylized waves inside hexagon at the bottom */}
              <path d="M11 68 C 25 58, 45 74, 55 64 C 70 50, 80 62, 89 68 L89 72.5 L50 95 L11 72.5 Z" fill="url(#wave-grad)" />
              {/* White 'P' letter */}
              <text x="50" y="58" fill="white" fontSize="42" fontWeight="900" textAnchor="middle" fontFamily="'Inter', system-ui, sans-serif">P</text>
            </svg>
            <div className="flex flex-col">
              <span className="text-[21px] font-extrabold tracking-[0.06em] text-white leading-none font-sans">PORTO</span>
              <span className="text-xs font-black tracking-[0.16em] leading-none mt-1 font-sans theme-text">FÁCIL</span>
              <span className="text-[9px] text-gray-400 font-medium mt-1 leading-none tracking-tight">Conecte. Informe. Mova o porto.</span>
            </div>
          </div>
 
          {/* Botões do Topo (Bell and Gear styled as rounded squares with subtle transparency, plus share to WhatsApp) */}
          <div className="flex items-center gap-2">
            {/* Share/Compartilhar WhatsApp Button */}
            <button
              onClick={() => {
                const appUrl = window.location.href;
                const message = `Olá, motorista! 🚛\n\nConheça o novo aplicativo *Porto Fácil*! 🌟\nCriado para facilitar o seu dia a dia no porto com informações em tempo real:\n\n✅ *Acompanhamento de Caminhões ativos*\n✅ *Acesso rápido ao Portal Copadubo*\n✅ *Consulta de Informações da APPA*\n✅ *Suporte via WhatsApp dos plantões*\n✅ *Chat e Rádio integrados*\n\nAcesse agora mesmo e salve em sua tela inicial:\n${appUrl}`;
                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                window.open(whatsappUrl, '_blank');
              }}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-green-500/5 hover:bg-green-500/15 border border-green-500/20 active:scale-95 transition cursor-pointer"
              title="Compartilhar aplicativo no WhatsApp"
            >
              <Share2 size={17} className="text-green-400/90 hover:text-green-300 filter drop-shadow-[0_0_2px_rgba(34,197,94,0.3)]" />
            </button>
 
            {/* Camera/Status Image Button */}
            <button
              onClick={() => setShowCameraPanel(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 transition relative cursor-pointer"
              title="Postar foto de status"
            >
              <Camera size={18} className="text-gray-300 hover:text-white" />
              {activeInfo.isActive && (
                <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full animate-pulse theme-bg" style={{ boxShadow: '0 0 8px var(--pc-primary)' }} />
              )}
            </button>
          </div>
        </header>

        {/* Global Announcement Banner - Centered right in the middle of the background status image */}
        <AnimatePresence>
          {globalAnnouncement && globalAnnouncement.active && globalAnnouncement.text && globalAnnouncement.text !== dismissedAnnouncementText && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className={`absolute top-[28vh] sm:top-[22vh] inset-x-6 z-[50] rounded-[18px] border py-2.5 pl-3.5 pr-8 flex items-center gap-2.5 backdrop-blur-md shadow-lg pointer-events-auto ${
                globalAnnouncement.level === 'danger'
                  ? 'bg-red-950/80 border-red-500/30 text-red-200 shadow-[0_4px_20px_rgba(239,68,68,0.15)]'
                  : globalAnnouncement.level === 'warning'
                  ? 'bg-amber-950/80 border-amber-500/30 text-amber-200 shadow-[0_4px_20px_rgba(245,158,11,0.15)]'
                  : 'bg-slate-900/80 border-blue-500/30 text-blue-200 shadow-[0_4px_20px_rgba(59,130,246,0.15)]'
              }`}
            >
              {/* Discrete indicator representing the importance color */}
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                globalAnnouncement.level === 'danger'
                  ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                  : globalAnnouncement.level === 'warning'
                  ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                  : 'bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]'
              }`} />

              {/* Pure Message Text */}
              <p className="text-[11px] font-bold leading-normal tracking-wide opacity-95 flex-1 select-text">
                {globalAnnouncement.text}
              </p>

              {/* Discrete close button on the right */}
              <button 
                onClick={() => {
                  if (globalAnnouncement) {
                    localStorage.setItem('dismissed_announcement_text', globalAnnouncement.text);
                    setDismissedAnnouncementText(globalAnnouncement.text);
                  }
                }}
                className={`absolute right-2 p-1 rounded-full shrink-0 hover:bg-white/10 active:scale-90 transition cursor-pointer ${
                  globalAnnouncement.level === 'danger'
                    ? 'text-red-400/80 hover:text-red-300'
                    : globalAnnouncement.level === 'warning'
                    ? 'text-amber-400/80 hover:text-amber-300'
                    : 'text-blue-400/80 hover:text-blue-300'
                }`}
                title="Fechar aviso"
              >
                <X size={13} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scrollable middle body container */}
        <div className="flex-1 overflow-y-auto scrollbar-none pr-0.5 space-y-4 pb-6">

          {/* Subtle warning for offline / unavailable connection */}
          {isOfflineMode && (
            <div className="mx-1 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between gap-3 text-amber-300 select-none animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span className="text-xs font-semibold">Modo Offline Ativado — usando dados locais de alta performance</span>
              </div>
              <button 
                onClick={async () => {
                  try {
                    const { getDocFromServer, doc } = await import('../lib/supabase');
                    await getDocFromServer(doc(db, 'settings', 'status_image'));
                    setIsOfflineMode(false);
                  } catch (e) {
                    // still offline
                  }
                }}
                className="text-[10px] font-bold uppercase tracking-widest bg-amber-500/20 hover:bg-amber-500/30 px-2.5 py-1 rounded-lg transition shrink-0 cursor-pointer"
              >
                Reconectar
              </button>
            </div>
          )}

          {/* Spacer to push content down and expose the background status image beautifully in mobile mode */}
          <div className="h-[26vh] sm:hidden shrink-0" />



          {/* 2. GREETING & TITLE */}
        <div className="select-none py-1 relative min-h-[92px] flex items-center justify-between gap-3">
          <div className="flex flex-col justify-center flex-1">
            <h2 className="text-2xl font-light text-white tracking-wide leading-none">
              {getGreeting()},
            </h2>
            <h1 
              className="text-[34px] font-black tracking-tight leading-none mt-1 theme-text" 
              style={{ filter: 'drop-shadow(0 0 15px var(--pc-glow))' }}
            >
              {displayName}
            </h1>
            <p className="text-[12px] text-gray-400 mt-1.5 font-medium tracking-wide">
              Conecte, informe, mova o porto.
            </p>
          </div>

          {/* Status Image Info & Like Button */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLikeStatusImage}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border cursor-pointer select-none transition-all duration-300 ${
                hasLikedStatusImage 
                  ? 'bg-red-500/20 border-red-500/40 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.35)]' 
                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
              }`}
              title={hasLikedStatusImage ? "Remover curtida da imagem" : "Curtir imagem de status"}
            >
              <Heart 
                size={13} 
                className={`transition-transform duration-300 ${hasLikedStatusImage ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-400'}`} 
              />
              <span className="text-[11px] font-black">{statusLikesCount}</span>
            </motion.button>
            
            <div className="text-[8.5px] text-right text-gray-400 leading-none bg-black/45 backdrop-blur-sm px-2 py-1 rounded-md border border-white/5 select-none pointer-events-none">
              <span className="font-medium text-gray-400/80">Status: </span>
              <span className="font-extrabold theme-text">
                {activeInfo.isActive && activeInfo.doc ? activeInfo.doc.uploadedBy.displayName : 'Sistema'}
              </span>
            </div>
          </div>
        </div>



        {/* AI Camera Upload Loading/Success Overlay */}
        <AnimatePresence>
          {(isAnalyzing || uploadSuccess || uploadError) && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-[#0A1C30]/90 backdrop-blur-md border border-white/15 rounded-2xl p-3 shadow-xl"
            >
              {isAnalyzing && (
                <div className="flex items-center gap-3 justify-center py-1">
                  <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--pc-primary)', borderTopColor: 'transparent' }} />
                  <p className="text-xs font-bold uppercase tracking-widest animate-pulse theme-text-light">
                    Verificando foto com IA Gemini...
                  </p>
                </div>
              )}
              {uploadSuccess && (
                <div className="flex items-center gap-2.5 justify-center py-1 text-green-400">
                  <CheckCircle2 size={16} />
                  <p className="text-xs font-bold uppercase tracking-wider">
                    Sucesso! Nova imagem de status publicada por 24h.
                  </p>
                </div>
              )}
              {uploadError && (
                <div className="flex flex-col gap-1 py-1">
                  <div className="flex items-center gap-2 text-red-400">
                    <XCircle size={15} />
                    <p className="text-xs font-bold uppercase tracking-wider">Foto Recusada por IA</p>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight pl-5">{uploadError}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>



        {/* 4. OTHER CARDS GRID (Sits elegantly below the header status area, perfectly aligned) */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-2 sm:mt-4 my-1">

          {/* Card 3: CAMINHÕES ATIVOS */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => window.open('https://intranet.copadubo.com.br/ponto/', '_blank')}
            className="relative p-3 sm:p-3.5 h-[115px] sm:h-[130px] bg-[#030914]/15 backdrop-blur-xl border border-[var(--pc-primary)]/25 rounded-[20px] sm:rounded-[24px] shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_8px_var(--pc-glow)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.35),0_0_15px_var(--pc-glow)] flex flex-col justify-between cursor-pointer group overflow-hidden transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--pc-primary)]/5 to-transparent pointer-events-none" />

            {/* Top Section */}
            <div className="flex items-start gap-2.5 relative z-10 w-full">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] bg-green-500/10 border border-green-500/25 flex items-center justify-center text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.35)] shrink-0">
                <Truck size={17} className="filter" style={{ filter: 'drop-shadow(0 0 3px #22C55E)' }} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h4 className="text-[11px] sm:text-[12.5px] font-extrabold text-white tracking-wider uppercase leading-none">CAMINHÕES ATIVOS</h4>
                <p className="text-[8.5px] sm:text-[9.5px] text-[#C5C5C5] mt-1 leading-tight font-medium">Caminhões em operation</p>
              </div>
            </div>

            {/* Bottom Section */}
            <div className="flex items-end justify-between relative z-10 mt-auto w-full">
              <div className="px-2 py-0.5 rounded-full bg-[var(--pc-primary)]/10 border border-[var(--pc-primary)]/20 text-[var(--pc-primary)] text-[8px] sm:text-[9px] font-bold tracking-wide shadow-[0_0_6px_var(--pc-glow)] shrink-0">
                12 online
              </div>
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-[var(--pc-primary)]/20 text-[var(--pc-primary)] group-hover:bg-[var(--pc-primary)]/15 group-hover:border-[var(--pc-primary-light)] group-hover:text-[var(--pc-primary-light)] transition-all flex items-center justify-center shrink-0">
                <ChevronRight size={13} />
              </div>
            </div>
          </motion.div>

          {/* Card 4: LOGIN DO APP */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => window.open('https://portal.copadubo.com.br/login.php', '_blank')}
            className="relative p-3 sm:p-3.5 h-[115px] sm:h-[130px] bg-[#030914]/15 backdrop-blur-xl border border-[var(--pc-primary)]/25 rounded-[20px] sm:rounded-[24px] shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_8px_var(--pc-glow)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.35),0_0_15px_var(--pc-glow)] flex flex-col justify-between cursor-pointer group overflow-hidden transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--pc-primary)]/5 to-transparent pointer-events-none" />

            {/* Top Section */}
            <div className="flex items-start gap-2.5 relative z-10 w-full">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] bg-green-500/10 border border-green-500/25 flex items-center justify-center text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.35)] shrink-0">
                <User size={17} className="filter" style={{ filter: 'drop-shadow(0 0 3px #22C55E)' }} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h4 className="text-[11px] sm:text-[12.5px] font-extrabold text-white tracking-wider uppercase leading-none">LOGIN DO APP</h4>
                <p className="text-[8.5px] sm:text-[9.5px] text-[#C5C5C5] mt-1 leading-tight font-medium">Portal Copadubo</p>
              </div>
            </div>

            {/* Bottom Section */}
            <div className="flex items-end justify-between relative z-10 mt-auto w-full">
              <div className="px-2 py-0.5 rounded-full bg-[var(--pc-primary)]/10 border border-[var(--pc-primary)]/20 text-[var(--pc-primary)] text-[8px] sm:text-[9px] font-bold tracking-wide shadow-[0_0_6px_var(--pc-glow)] shrink-0">
                Conectado
              </div>
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-[var(--pc-primary)]/20 text-[var(--pc-primary)] group-hover:bg-[var(--pc-primary)]/15 group-hover:border-[var(--pc-primary-light)] group-hover:text-[var(--pc-primary-light)] transition-all flex items-center justify-center shrink-0">
                <ChevronRight size={13} />
              </div>
            </div>
          </motion.div>

          {/* Card 2: ORGANIZADOR */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectChannel('organizador')}
            className="relative p-3 sm:p-3.5 h-[115px] sm:h-[130px] bg-[#030914]/15 backdrop-blur-xl border border-orange-500/25 rounded-[20px] sm:rounded-[24px] shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_8px_rgba(255,122,0,0.4)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.35),0_0_15px_rgba(255,122,0,0.4)] flex flex-col justify-between cursor-pointer group overflow-hidden transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent pointer-events-none" />

            {/* Top Section */}
            <div className="flex items-start gap-2.5 relative z-10 w-full">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] bg-orange-500/10 border border-orange-500/25 flex items-center justify-center text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.4)] shrink-0">
                <CheckSquare size={17} className="filter" style={{ filter: 'drop-shadow(0 0 3px #F97316)' }} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h4 className="text-[11px] sm:text-[12.5px] font-extrabold text-white tracking-wider uppercase leading-none">ORGANIZADOR</h4>
                <p className="text-[8.5px] sm:text-[9.5px] text-[#C5C5C5] mt-1 leading-tight font-medium">Notas e checklists</p>
              </div>
            </div>

            {/* Bottom Section */}
            <div className="flex items-end justify-between relative z-10 mt-auto w-full">
              <div className="px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[8px] sm:text-[9px] font-bold tracking-wide shadow-[0_0_6px_rgba(255,122,0,0.2)] shrink-0">
                Sincronizado
              </div>
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-orange-500/20 text-orange-400 group-hover:bg-orange-500/15 group-hover:border-orange-500-light group-hover:text-orange-300 transition-all flex items-center justify-center shrink-0">
                <ChevronRight size={13} />
              </div>
            </div>
          </motion.div>

          {/* Card 6: CÁLCULO DE TICKETS */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectChannel('tickets')}
            className="relative p-3 sm:p-3.5 h-[115px] sm:h-[130px] bg-[#030914]/15 backdrop-blur-xl border border-[var(--pc-primary)]/25 rounded-[20px] sm:rounded-[24px] shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_8px_var(--pc-glow)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.35),0_0_15px_var(--pc-glow)] flex flex-col justify-between cursor-pointer group overflow-hidden transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--pc-primary)]/5 to-transparent pointer-events-none" />

            {/* Top Section */}
            <div className="flex items-start gap-2.5 relative z-10 w-full">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.35)] shrink-0">
                <Calculator size={17} className="filter" style={{ filter: 'drop-shadow(0 0 3px #0EA5E9)' }} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h4 className="text-[11px] sm:text-[12.5px] font-extrabold text-white tracking-wider uppercase leading-none">CÁLCULO TICKETS</h4>
                <p className="text-[8.5px] sm:text-[9.5px] text-[#C5C5C5] mt-1 leading-tight font-medium">Calculadora de carga</p>
              </div>
            </div>

            {/* Bottom Section */}
            <div className="flex items-end justify-between relative z-10 mt-auto w-full">
              <div className="px-2 py-0.5 rounded-full bg-[var(--pc-primary)]/10 border border-[var(--pc-primary)]/20 text-[var(--pc-primary)] text-[8px] sm:text-[9px] font-bold tracking-wide shadow-[0_0_6px_var(--pc-glow)] shrink-0">
                Ativo
              </div>
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-[var(--pc-primary)]/20 text-[var(--pc-primary)] group-hover:bg-[var(--pc-primary)]/15 group-hover:border-[var(--pc-primary-light)] group-hover:text-[var(--pc-primary-light)] transition-all flex items-center justify-center shrink-0">
                <ChevronRight size={13} />
              </div>
            </div>
          </motion.div>

          {/* Card 7: INFORMAÇÕES APPA */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => window.open('https://berth-bloom-buddy.lovable.app/', '_blank')}
            className="relative p-3 sm:p-3.5 h-[115px] sm:h-[130px] bg-[#030914]/15 backdrop-blur-xl border border-[var(--pc-primary)]/25 rounded-[20px] sm:rounded-[24px] shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_8px_var(--pc-glow)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.35),0_0_15px_var(--pc-glow)] flex flex-col justify-between cursor-pointer group overflow-hidden transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--pc-primary)]/5 to-transparent pointer-events-none" />

            {/* Top Section */}
            <div className="flex items-start gap-2.5 relative z-10 w-full">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] bg-orange-500/10 border border-orange-500/25 flex items-center justify-center text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.35)] shrink-0">
                <Anchor size={17} className="filter" style={{ filter: 'drop-shadow(0 0 3px #F97316)' }} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h4 className="text-[11px] sm:text-[12.5px] font-extrabold text-white tracking-wider uppercase leading-none">INFORMAÇÕES APPA</h4>
                <p className="text-[8.5px] sm:text-[9.5px] text-[#C5C5C5] mt-1 leading-tight font-medium">Monitoramento online</p>
              </div>
            </div>

            {/* Bottom Section */}
            <div className="flex items-end justify-between relative z-10 mt-auto w-full">
              <div className="px-2 py-0.5 rounded-full bg-[var(--pc-primary)]/10 border border-[var(--pc-primary)]/20 text-[var(--pc-primary)] text-[8px] sm:text-[9px] font-bold tracking-wide shadow-[0_0_6px_var(--pc-glow)] shrink-0">
                Tempo real
              </div>
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-[var(--pc-primary)]/20 text-[var(--pc-primary)] group-hover:bg-[var(--pc-primary)]/15 group-hover:border-[var(--pc-primary-light)] group-hover:text-[var(--pc-primary-light)] transition-all flex items-center justify-center shrink-0">
                <ChevronRight size={13} />
              </div>
            </div>
          </motion.div>

          {/* Card 8: CONTATOS WHATSAPP */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowWhatsappContacts(true)}
            className="relative p-3 sm:p-3.5 h-[115px] sm:h-[130px] bg-[#030914]/15 backdrop-blur-xl border border-[var(--pc-primary)]/25 rounded-[20px] sm:rounded-[24px] shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_8px_var(--pc-glow)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.35),0_0_15px_var(--pc-glow)] flex flex-col justify-between cursor-pointer group overflow-hidden transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--pc-primary)]/5 to-transparent pointer-events-none" />

            {/* Top Section */}
            <div className="flex items-start gap-2.5 relative z-10 w-full">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] bg-green-500/10 border border-green-500/25 flex items-center justify-center text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.35)] shrink-0">
                <MessageCircle size={17} className="filter" style={{ filter: 'drop-shadow(0 0 3px #22C55E)' }} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h4 className="text-[11px] sm:text-[12.5px] font-extrabold text-white tracking-wider uppercase leading-none">CONTATOS WHATSAPP</h4>
                <p className="text-[8.5px] sm:text-[9.5px] text-[#C5C5C5] mt-1 leading-tight font-medium">Plantões Copadubo</p>
              </div>
            </div>

            {/* Bottom Section */}
            <div className="flex items-end justify-between relative z-10 mt-auto w-full">
              <div className="px-2 py-0.5 rounded-full bg-[var(--pc-primary)]/10 border border-[var(--pc-primary)]/20 text-[var(--pc-primary)] text-[8px] sm:text-[9px] font-bold tracking-wide shadow-[0_0_6px_var(--pc-glow)] shrink-0">
                Plantão 24h
              </div>
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-[var(--pc-primary)]/20 text-[var(--pc-primary)] group-hover:bg-[var(--pc-primary)]/15 group-hover:border-[var(--pc-primary-light)] group-hover:text-[var(--pc-primary-light)] transition-all flex items-center justify-center shrink-0">
                <ChevronRight size={13} />
              </div>
            </div>
          </motion.div>





          {/* Card: MOTORISTAS DISPONÍVEIS / FOLGUISTAS (col-span-2) */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onSelectChannel('folguistas')}
            className="col-span-2 relative p-3 sm:p-3.5 h-[105px] sm:h-[120px] bg-[#030914]/15 backdrop-blur-xl border border-emerald-500/35 rounded-[20px] sm:rounded-[24px] shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_8px_rgba(16,185,129,0.3)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.35),0_0_15px_rgba(16,185,129,0.4)] flex items-center justify-between gap-3 sm:gap-4 cursor-pointer group overflow-hidden"
          >
            {/* Left side: Icon & Title/Description */}
            <div className="flex items-center gap-3 sm:gap-4 flex-1">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)] shrink-0">
                <UserCheck size={20} className="filter animate-pulse" style={{ filter: 'drop-shadow(0 0 4px #10B981)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-[12px] sm:text-[14px] font-extrabold text-white tracking-wider uppercase leading-none">MOTORISTAS DISPONÍVEIS</h4>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[7px] sm:text-[8px] font-black shadow-[0_0_6px_rgba(16,185,129,0.5)] animate-pulse uppercase tracking-wider">
                    Folguistas & Extras
                  </span>
                </div>
                <p className="text-[9.5px] sm:text-[10.5px] text-gray-400 mt-1 leading-snug max-w-xs sm:max-w-lg">
                  Está sem trabalho ou quer contratar? Cadastre-se ou contate motoristas disponíveis direto pelo WhatsApp!
                </p>
              </div>
            </div>

            {/* Right side: Circular button */}
            <div className="flex items-center justify-center shrink-0 z-10 mr-0.5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/15 group-hover:border-emerald-400 group-hover:text-emerald-300 transition-all flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                <ChevronRight size={14} />
              </div>
            </div>
          </motion.div>





          {/* Card 9: NÚMEROS DE EMERGÊNCIA (col-span-2) */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onSelectChannel('emergencia')}
            className="col-span-2 relative p-3 sm:p-3.5 h-[105px] sm:h-[120px] bg-[#030914]/15 backdrop-blur-xl border border-[var(--pc-primary)]/35 rounded-[20px] sm:rounded-[24px] shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_8px_var(--pc-glow)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.35),0_0_15px_var(--pc-glow)] flex items-center justify-between gap-3 sm:gap-4 cursor-pointer group overflow-hidden"
          >
            {/* Left side: Icon & Title/Description */}
            <div className="flex items-center gap-3 sm:gap-4 flex-1">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.4)] shrink-0 animate-pulse">
                <Siren size={20} className="filter" style={{ filter: 'drop-shadow(0 0 4px #EF4444)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-[12px] sm:text-[14px] font-extrabold text-white tracking-wider uppercase leading-none">NÚMEROS DE EMERGÊNCIA</h4>
                  <span className="px-1.5 py-0.5 rounded-full bg-[var(--pc-primary)] text-white text-[7px] sm:text-[8px] font-black shadow-[0_0_6px_var(--pc-primary)] animate-pulse uppercase tracking-wider">
                    Socorro Rápido
                  </span>
                </div>
                <p className="text-[9.5px] sm:text-[10.5px] text-gray-400 mt-1 leading-snug max-w-xs sm:max-w-lg">
                  Telefones úteis de saúde, salvamento e segurança (SAMU, PM, etc.).
                </p>
              </div>
            </div>

            {/* Right side: Circular button */}
            <div className="flex items-center justify-center shrink-0 z-10 mr-0.5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-[var(--pc-primary)]/20 text-[var(--pc-primary)] group-hover:bg-[var(--pc-primary)]/15 group-hover:border-[var(--pc-primary-light)] group-hover:text-[var(--pc-primary-light)] transition-all flex items-center justify-center shadow-[0_0_8px_var(--pc-glow)]">
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Watermark SVG vector - Pulse Waveform */}
            <svg className="absolute bottom-1 right-1 w-20 sm:w-26 h-12 sm:h-16 text-[var(--pc-primary)]/5 pointer-events-none select-none" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M0 50 H30 L35 30 L40 70 L45 40 L50 60 L55 50 H100" />
            </svg>
          </motion.div>
        </div>

        </div>

        {/* 5. BOTTOM NAVIGATION BAR - EXACTLY LIKE UPLOADED IMAGE (4 GLOWING CIRCULAR BUTTONS CONNECTED BY VIBRATING WAVE LINES, NO TEXT LABELS) */}
        <nav className="bg-[#020712]/95 border border-white/10 rounded-[32px] px-5 sm:px-6 flex justify-between items-center shadow-[0_0_40px_rgba(0,0,0,0.6)] relative overflow-hidden h-[92px] w-full max-w-md mx-auto mb-2">
          
          {/* Premium ECG Heart Monitor Background */}
          <div className="absolute inset-0 select-none pointer-events-none z-0 overflow-hidden rounded-[32px] flex items-center justify-center">
            <EcgCanvas
              isRecording={false}
              accentColor={palette.primary || '#FF7A00'}
              height={92}
            />
          </div>

          {/* Button 1: Tickets */}
          <button 
            onClick={() => onSelectChannel('tickets')}
            className="w-[54px] h-[54px] rounded-full border-2 border-[var(--pc-primary)] bg-black flex items-center justify-center text-[var(--pc-primary)] shadow-[0_0_15px_var(--pc-glow)] hover:shadow-[0_0_25px_var(--pc-glow)] transition-all duration-200 hover:scale-110 active:scale-95 z-10 cursor-pointer"
            title="Cálculo de Tickets"
          >
            <Calculator size={22} className="filter" style={{ filter: 'drop-shadow(0 0 4px var(--pc-primary))' }} />
          </button>
 
          {/* Button 2: Organizador */}
          <button 
            onClick={() => onSelectChannel('organizador')}
            className="w-[54px] h-[54px] rounded-full border-2 border-[var(--pc-primary)] bg-black flex items-center justify-center text-[var(--pc-primary)] shadow-[0_0_15px_var(--pc-glow)] hover:shadow-[0_0_25px_var(--pc-glow)] transition-all duration-200 hover:scale-110 active:scale-95 z-10 cursor-pointer"
            title="Organizador Porto Fácil"
          >
            <CheckSquare size={22} className="filter" style={{ filter: 'drop-shadow(0 0 4px var(--pc-primary))' }} />
          </button>
 
          {/* Button 3: Red Emergency / Admin Button */}
          {isAdmin ? (
            <button 
              onClick={() => {
                setReportSentSuccess(false);
                setSecurityReportText('');
                setShowAdminPanel(true);
              }}
              className="w-[54px] h-[54px] rounded-full border-2 border-red-500 bg-black flex items-center justify-center text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.85)] transition-all duration-200 hover:scale-110 active:scale-95 z-10 cursor-pointer relative"
              title="Painel de Moderação (Admin)"
            >
              <ShieldAlert size={22} className="filter" style={{ filter: 'drop-shadow(0 0 4px #EF4444)' }} />
              {reports.length > 0 && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center border border-[#07111F] shadow-lg animate-bounce">
                  {reports.length}
                </div>
              )}
            </button>
          ) : (
            <button 
              onClick={() => onSelectChannel('emergencia')}
              className="w-[54px] h-[54px] rounded-full border-2 border-red-500 bg-black flex items-center justify-center text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.85)] transition-all duration-200 hover:scale-110 active:scale-95 z-10 cursor-pointer"
              title="Números de Emergência"
            >
              <Siren size={22} className="filter animate-pulse" style={{ filter: 'drop-shadow(0 0 4px #EF4444)' }} />
            </button>
          )}
 
          {/* Button 4: User - Meu Perfil */}
          <button 
            onClick={() => setShowStatusDetails(true)}
            className="w-[54px] h-[54px] rounded-full border-2 border-[var(--pc-primary)] bg-black flex items-center justify-center text-[var(--pc-primary)] shadow-[0_0_15px_var(--pc-glow)] hover:shadow-[0_0_25px_var(--pc-glow)] transition-all duration-200 hover:scale-110 active:scale-95 z-10 cursor-pointer"
            title="Meu Perfil"
          >
            <User size={22} className="filter" style={{ filter: 'drop-shadow(0 0 4px var(--pc-primary))' }} />
          </button>
        </nav>



      </div>



      {/* 6. SETTINGS & PROFILE MODAL (Opened by gear or profile click) */}
      <AnimatePresence>
        {showStatusDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0A1C30] border border-white/10 rounded-[28px] w-full max-w-sm overflow-hidden shadow-2xl relative"
            >
              {/* Modal header */}
              <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-[#07111F]/50">
                <div className="flex items-center gap-2">
                  <User className="text-[#FF7A00]" size={16} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">Cadastro do Motorista</h3>
                </div>
                <button
                  onClick={() => setShowStatusDetails(false)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
                
                {/* 1. Profile information */}
                <div className="bg-[#07111F]/60 p-3.5 rounded-xl border border-white/5 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl border border-white/10 overflow-hidden bg-[#030914] shrink-0">
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{displayName}</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-none">{email || 'Sem e-mail'}</p>
                    <span className="inline-block text-[9px] bg-[#FF7A00]/15 text-[#FF7A00] font-bold tracking-wider uppercase px-2 py-0.5 rounded mt-1.5">
                      {role === 'admin' ? 'Administrador' : 'Motorista'}
                    </span>
                  </div>
                </div>

                {/* 2. Mudar Foto de Perfil da Galeria */}
                <div className="flex flex-col gap-2 mt-1.5 pt-3 border-t border-white/5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Alterar Foto de Perfil</span>
                  <div className="flex items-center gap-3 bg-[#07111F]/40 p-2.5 rounded-xl border border-white/5">
                    <label className="inline-flex items-center justify-center w-full py-2.5 bg-[#FF7A00]/10 hover:bg-[#FF7A00]/20 border border-[#FF7A00]/20 text-xs font-bold text-[#FF7A00] rounded-xl cursor-pointer transition active:scale-95 text-center">
                      <span>Escolher Nova Foto da Galeria</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const compressed = await compressAndConvertImage(file);
                              onUpdateAvatar(compressed);
                            } catch (err) {
                              console.error('Erro ao processar imagem:', err);
                              alert('Não foi possível processar a imagem. Tente outra foto.');
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* 3. Logout trigger */}
                <button
                  onClick={handleLogout}
                  className="w-full mt-2 py-2.5 bg-red-600/10 hover:bg-red-600/20 border border-red-600/20 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
                >
                  <LogOut size={13} />
                  <span>Sair da Conta</span>
                </button>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 8. STATUS PHOTO MODAL (Opened by camera click) */}
      <AnimatePresence>
        {showCameraPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0A1C30] border border-white/10 rounded-[28px] w-full max-w-sm overflow-hidden shadow-2xl relative"
            >
              {/* Modal header */}
              <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-[#07111F]/50">
                <div className="flex items-center gap-2">
                  <Camera className="text-[#FF7A00]" size={16} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white font-sans">Status do Porto</h3>
                </div>
                <button
                  onClick={() => {
                    setShowCameraPanel(false);
                    handleCancelStaged();
                  }}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
                {stagedImage ? (
                  /* IMAGE STAGING FLOW */
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-[#FF7A00] uppercase tracking-widest pl-1">
                        Pré-visualização do Novo Fundo
                      </span>
                      
                      {/* Live cropping simulation preview box */}
                      <div className="relative h-48 rounded-2xl overflow-hidden border border-[#FF7A00]/40 bg-black/60 shadow-xl">
                        <img
                          src={stagedImage}
                          className="w-full h-full object-cover transition-all duration-150"
                          style={{
                            objectPosition: "center 50%"
                          }}
                          alt="Staged background preview"
                          referrerPolicy="no-referrer"
                        />
                        {/* Upper clean section guide overlay */}
                        <div className="absolute top-0 inset-x-0 h-[45%] border-b border-dashed border-white/20 bg-black/10 flex items-center justify-center pointer-events-none">
                          <span className="text-[9px] bg-black/75 text-white font-mono px-2 py-0.5 rounded border border-white/10 uppercase tracking-widest font-bold">
                            Área Mais Nítida (Topo)
                          </span>
                        </div>
                        {/* Lower fading gradient simulation to visually represent where gradient starts in app */}
                        <div className="absolute bottom-0 inset-x-0 h-[55%] bg-gradient-to-t from-[#030914] via-[#030914]/80 to-transparent flex items-end justify-center pb-2 pointer-events-none">
                          <span className="text-[9px] bg-black/85 text-gray-400 font-mono px-2 py-0.5 rounded border border-white/5 uppercase tracking-widest">
                            Início do Degradê (Fosco)
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-gray-400 leading-tight text-center px-1">
                      A imagem será exibida de forma fixa centralizada na área mais nítida do topo do aplicativo.
                    </p>

                    {uploadError && (
                      <p className="text-[10px] text-red-500 text-center bg-red-500/10 p-2 rounded-lg">
                        {uploadError}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2 mt-1">
                      <button
                        onClick={handleSaveStagedImage}
                        disabled={isAnalyzing}
                        className="w-full py-3 bg-[#FF7A00] hover:bg-[#E06B00] active:scale-[0.98] disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition duration-150 shadow-lg shadow-orange-500/20 cursor-pointer"
                      >
                        {isAnalyzing ? (
                          <>
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            <span>Salvando e Publicando...</span>
                          </>
                        ) : (
                          <>
                            <span>Salvar e Publicar Fundo</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleCancelStaged}
                        disabled={isAnalyzing}
                        className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-semibold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition border border-white/5 cursor-pointer active:scale-[0.98]"
                      >
                        <span>Descartar e Voltar</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* STANDARD BACKGROUND DETAILS AND SELECTION FLOW */
                  <>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">FUNDO ATIVO NO APLICATIVO</span>
                      
                      {/* Image preview of current app background */}
                      <div className="relative h-44 rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-inner">
                        <img
                          src={stagedImage || activeInfo.imageUrl}
                          className="w-full h-full object-cover transition-all duration-150"
                          style={{
                            objectPosition: `center ${statusImage?.yOffset ?? 50}%`
                          }}
                          alt="Background preview"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
                        
                        {/* Top tag */}
                        <div className="absolute top-3 left-3">
                          <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                            activeInfo.isActive ? 'bg-[#FF7A00] text-white shadow-lg shadow-orange-500/20' : 'bg-green-500 text-white shadow-md shadow-green-500/10'
                          }`}>
                            {activeInfo.isActive ? 'Ciclo Ativo' : 'Fundo Padrão'}
                          </span>
                        </div>

                        {/* Bottom details inside the card */}
                        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                          <div className="text-[10px] text-gray-300">
                            {activeInfo.isActive && activeInfo.doc ? (
                              <>
                                <p className="text-[9px] text-gray-400 uppercase tracking-wider">Enviado por</p>
                                <p className="font-bold text-white text-xs">{activeInfo.doc.uploadedBy.displayName}</p>
                              </>
                            ) : (
                              <p className="text-xs text-gray-300 font-medium">Operação Normal</p>
                            )}
                          </div>

                          <div className="text-right">
                            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Próximo Ciclo</p>
                            <p className="font-mono text-[#FF7A00] font-bold text-xs">{timeLeftStr || '--:--:--'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Upload action */}
                    <div className="flex flex-col gap-2 mt-1">
                      <button
                        onClick={() => {
                          handleTriggerUpload();
                        }}
                        disabled={!canPublishStatus}
                        className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition duration-150 active:scale-[0.98] ${
                          !canPublishStatus
                            ? 'bg-gray-800 text-gray-500 border border-transparent cursor-not-allowed'
                            : 'bg-[#FF7A00] hover:bg-[#E06B00] text-white cursor-pointer shadow-lg shadow-orange-500/10'
                        }`}
                      >
                        <Camera size={14} />
                        <span>{getPublishButtonLabel()}</span>
                      </button>

                      {/* Secondary Actions (Denounce and Reset) */}
                      {activeInfo.isActive && (
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <button
                            onClick={() => {
                              setShowCameraPanel(false);
                              handleDenounce();
                            }}
                            className="py-2.5 bg-yellow-500/10 hover:bg-yellow-500/15 border border-yellow-500/20 rounded-lg text-[10px] font-bold text-yellow-400 uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition"
                          >
                            <AlertTriangle size={11} />
                            <span>Denunciar</span>
                          </button>

                          {canDeleteStatus ? (
                            <button
                              onClick={(e) => {
                                setShowCameraPanel(false);
                                handleDeleteStatus(e);
                              }}
                              className="py-2.5 bg-[#FF2D55]/10 hover:bg-[#FF2D55]/15 border border-[#FF2D55]/20 rounded-lg text-[10px] font-bold text-[#FF2D55] uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition"
                            >
                              <Trash2 size={11} />
                              <span>{isAdmin ? 'Limpar (Admin)' : 'Apagar Minha Foto'}</span>
                            </button>
                          ) : (
                            <div className="py-2.5 text-center text-[9px] text-gray-500 border border-dashed border-white/5 rounded-lg flex items-center justify-center">
                              Bloqueado
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <p className="text-[10px] text-gray-400 leading-normal text-center mt-1 px-1">
                  Fotos de incidentes ou tráfego alteram o fundo do aplicativo de todos em tempo real. O status é reiniciado automaticamente nos ciclos de 07:00, 18:00 e 00:00.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7. NOTIFICATION SLIDE DRAWER (Avisos) */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end justify-center"
          >
            <div className="absolute inset-0" onClick={() => setShowNotifications(false)} />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-[#0A1C30] border-t border-white/10 rounded-t-[28px] w-full max-w-md overflow-hidden shadow-2xl relative z-10 p-5 pb-6"
            >
              {/* Drawer header */}
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Bell className="text-[#FF7A00]" size={16} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">Avisos Recentes do Porto</h3>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Alerts body list */}
              <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                {/* Alert 1 */}
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-2.5 items-start">
                  <AlertTriangle className="text-red-400 mt-0.5 shrink-0" size={14} />
                  <div>
                    <h4 className="text-[11px] font-bold text-red-400 uppercase tracking-wide">Terminal 2 Interditado</h4>
                    <p className="text-[10px] text-gray-300 mt-0.5 leading-normal">
                      Manutenção asfáltica próxima à pesagem norte. Desvio ativo para balança oeste.
                    </p>
                  </div>
                </div>

                {/* Alert 2 */}
                <div className="p-3.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex gap-2.5 items-start">
                  <Clock className="text-yellow-400 mt-0.5 shrink-0" size={14} />
                  <div>
                    <h4 className="text-[11px] font-bold text-yellow-400 uppercase tracking-wide">Fila de Triagem Elevada</h4>
                    <p className="text-[10px] text-gray-300 mt-0.5 leading-normal">
                      Pátio principal com alta taxa de ocupação. Tempo médio de espera estimado em 45 min.
                    </p>
                  </div>
                </div>

                {/* Alert 3 */}
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex gap-2.5 items-start">
                  <Sparkles className="text-blue-400 mt-0.5 shrink-0" size={14} />
                  <div>
                    <h4 className="text-[11px] font-bold text-blue-400 uppercase tracking-wide">Ventos Fortes em Canal</h4>
                    <p className="text-[10px] text-gray-300 mt-0.5 leading-normal">
                      Rajadas de até 26 nós. Redobre a atenção na movimentação e travessia de carga alta.
                    </p>
                  </div>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={() => setShowNotifications(false)}
                className="w-full mt-5 py-2.5 bg-[#FF7A00] hover:bg-[#E06B00] transition text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md cursor-pointer"
              >
                Entendido, Fechar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 8. ADMIN MODERATION DRAWER */}
      <AnimatePresence>
        {showAdminPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end justify-center"
          >
            <div className="absolute inset-0" onClick={() => setShowAdminPanel(false)} />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-[#0A1C30] border-t border-white/10 rounded-t-[28px] w-full max-w-md overflow-hidden shadow-2xl relative z-10 p-5 pb-6 flex flex-col max-h-[85vh]"
            >
              {isAdmin ? (
                <>
                  {/* Drawer header for Admin */}
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="text-red-500" size={18} />
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-white">Central de Administração</h3>
                        <p className="text-[9px] text-gray-400">Gerenciamento Geral do Porto Fácil</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAdminPanel(false)}
                      className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Tab Selectors */}
                  <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 border-b border-white/5 scrollbar-none shrink-0 select-none">
                    {[
                      { id: 'reports', label: 'Denúncias', icon: ShieldAlert, color: 'text-red-500' },
                      { id: 'status', label: 'Status Porto', icon: Camera, color: 'text-amber-500' },
                      { id: 'users', label: 'Usuários', icon: Users, color: 'text-blue-500' },
                      { id: 'bans', label: 'Banimentos', icon: Ban, color: 'text-rose-500' },
                      { id: 'announcements', label: 'Avisos', icon: Megaphone, color: 'text-teal-500' }
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const isActive = adminTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setAdminTab(tab.id as any)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 cursor-pointer border ${
                            isActive 
                              ? 'bg-white/10 text-white border-white/10 shadow-md' 
                              : 'bg-white/[0.02] text-gray-400 border-transparent hover:bg-white/5'
                          }`}
                        >
                          <Icon size={12} className={isActive ? tab.color : 'text-gray-400'} />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 1. REPORTS TAB */}
                  {adminTab === 'reports' && (
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                      {reports.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500 gap-3">
                          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                            <CheckCircle2 size={24} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-300">Nenhuma denúncia activa</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">O Porto Fácil está limpo e seguro!</p>
                          </div>
                        </div>
                      ) : (
                        reports.map((rep) => (
                          <div key={rep.id} className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-2.5 relative overflow-hidden">
                            <div className="absolute top-0 bottom-0 left-0 w-1 bg-red-500" />
                            <div className="flex justify-between items-start pl-1.5">
                              <div className="flex items-center gap-2">
                                <img 
                                  src={rep.senderAvatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100'} 
                                  className="w-7 h-7 rounded-full object-cover border border-white/10"
                                  alt="Sender"
                                  referrerPolicy="no-referrer"
                                />
                                <div>
                                  <p className="text-[10px] font-bold text-white leading-tight">{rep.senderName}</p>
                                  <p className="text-[8px] text-gray-400 leading-none mt-0.5">{rep.senderEmail || 'Sem e-mail'}</p>
                                </div>
                              </div>
                              <span className="text-[8px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold border border-red-500/10 uppercase">
                                {rep.channelName || 'Canal'}
                              </span>
                            </div>

                            <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-[10px] text-gray-200 leading-relaxed italic font-sans pl-1.5">
                              "{rep.messageText}"
                            </div>

                            <div className="flex justify-between items-center text-[8px] text-gray-500 pl-1.5">
                              <p>Denunciado por: <span className="text-gray-400">{rep.reportedByName || 'Motorista'}</span></p>
                              <p>{rep.reportedAt ? new Date(rep.reportedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                            </div>

                            {/* Actions */}
                            <div className="grid grid-cols-3 gap-2 mt-1 select-none text-[9px] font-bold uppercase tracking-wider">
                              <button
                                onClick={async () => {
                                  try {
                                    await deleteDoc(doc(db, 'reports', rep.id));
                                  } catch (err) {
                                    console.error('Erro ao ignorar denúncia:', err);
                                  }
                                }}
                                className="py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 flex items-center justify-center gap-1 cursor-pointer transition active:scale-[0.98]"
                              >
                                <span>Ignorar</span>
                              </button>

                              <button
                                onClick={async () => {
                                  if (!confirm('Deseja realmente apagar esta mensagem do canal?')) return;
                                  try {
                                    if (rep.channelId && rep.messageId) {
                                      await deleteDoc(doc(db, 'channels', rep.channelId, 'messages', rep.messageId));
                                    }
                                    await deleteDoc(doc(db, 'reports', rep.id));
                                    alert('Mensagem apagada com sucesso!');
                                  } catch (err) {
                                    alert('Erro ao apagar mensagem: ' + err);
                                  }
                                }}
                                className="py-2 bg-orange-500/10 hover:bg-orange-500/15 border border-orange-500/20 rounded-xl text-orange-400 flex items-center justify-center gap-1 cursor-pointer transition active:scale-[0.98]"
                              >
                                <Trash2 size={10} />
                                <span>Apagar</span>
                              </button>

                              <button
                                onClick={async () => {
                                  if (!confirm(`Deseja realmente BANIR o usuário ${rep.senderName}?`)) return;
                                  try {
                                    if (rep.senderEmail) {
                                      const emailLower = rep.senderEmail.trim().toLowerCase();
                                      await setDoc(doc(db, 'banned_emails', emailLower), {
                                        email: emailLower,
                                        userName: rep.senderName,
                                        bannedAt: Date.now(),
                                        reason: 'Abuso relatado por denúncia',
                                      });
                                    }
                                    if (rep.senderId) {
                                      await setDoc(doc(db, 'banned_uids', rep.senderId), {
                                        uid: rep.senderId,
                                        userName: rep.senderName,
                                        userEmail: rep.senderEmail || '',
                                        bannedAt: Date.now(),
                                        reason: 'Abuso relatado por denúncia',
                                      });
                                    }
                                    if (rep.channelId && rep.messageId) {
                                      await deleteDoc(doc(db, 'channels', rep.channelId, 'messages', rep.messageId));
                                    }
                                    await deleteDoc(doc(db, 'reports', rep.id));
                                    alert('Usuário banido com sucesso!');
                                  } catch (err) {
                                    alert('Erro ao banir usuário: ' + err);
                                  }
                                }}
                                className="py-2 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-xl text-red-400 flex items-center justify-center gap-1 cursor-pointer transition active:scale-[0.98]"
                              >
                                <Ban size={10} />
                                <span>Banir</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* 2. STATUS TAB */}
                  {adminTab === 'status' && (
                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                      <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-2">STATUS ATUAL DO PORTO</p>
                        
                        <div className="flex gap-3 items-center">
                          <img 
                            src={activeInfo.imageUrl} 
                            className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0" 
                            alt="Status" 
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-white truncate">
                              {!activeInfo.isActive ? 'Fundo Padrão Ativo' : 'Fundo Customizado'}
                            </p>
                            <p className="text-[9px] text-gray-400 mt-0.5">
                              Enviado por: <span className="text-amber-500 font-semibold">{statusImage?.uploadedBy?.displayName || 'Sistema'}</span>
                            </p>
                            <p className="text-[8px] text-gray-500 mt-0.5">
                              Enviado em: {statusImage?.uploadedAt ? new Date(statusImage.uploadedAt).toLocaleString('pt-BR') : 'Sem registro'}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={handleAdminReset}
                          className="w-full mt-3 py-2 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 hover:border-transparent text-[10px] font-bold uppercase tracking-wider rounded-xl transition cursor-pointer"
                        >
                          Limpar e Restaurar Fundo Padrão
                        </button>
                      </div>

                      {/* Predefined Beautiful Backgrounds */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">IMAGENS OFICIAIS PREDEFINIDAS</p>
                        <div className="grid grid-cols-2 gap-2">
                          {PORT_AND_TRUCK_IMAGES.map((item, index) => (
                            <button
                              key={index}
                              onClick={async () => {
                                try {
                                  const offset = new Date().getTimezoneOffset();
                                  const response = await fetch('/api/status/publish', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      image: item.url,
                                      yOffset: 50,
                                      userId: userId,
                                      userName: `Admin (${displayName})`,
                                      userAvatar: avatarUrl || '',
                                      isAdmin: true,
                                      timezoneOffset: offset
                                    }),
                                  });
                                  
                                  const data = await response.json();
                                  if (response.ok && data.success) {
                                    // Set local state & fallback database
                                    await setDoc(doc(db, 'settings', 'status_image'), data.statusImage);
                                    setStatusImage(data.statusImage);
                                    try {
                                      localStorage.setItem('fallback_status_image', JSON.stringify(data.statusImage));
                                    } catch (e) {}
                                    alert(`Fundo "${item.name}" aplicado!`);
                                  } else {
                                    throw new Error(data.error || 'Não foi possível publicar imagem no servidor.');
                                  }
                                } catch (err: any) {
                                  alert('Erro ao aplicar imagem: ' + err.message);
                                }
                              }}
                              className="p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#FF7A00]/30 transition text-left flex flex-col gap-1 cursor-pointer group"
                            >
                              <img src={item.url} className="h-12 w-full rounded-lg object-cover border border-white/5 group-hover:scale-[1.02] transition duration-200" alt="" />
                              <div>
                                <p className="text-[9px] font-black text-white leading-none truncate mt-0.5">{item.name}</p>
                                <p className="text-[7px] text-gray-400 mt-0.5">{item.desc}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. USERS TAB */}
                  {adminTab === 'users' && (
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                      
                      {/* Realtime User Presence Counters */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 flex flex-col justify-between">
                          <span className="text-[8px] font-bold text-blue-400 uppercase tracking-widest leading-none">Cadastrados</span>
                          <span className="text-2xl font-black text-white mt-1.5 font-mono">{usersList.length}</span>
                        </div>
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 flex flex-col justify-between">
                          <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest leading-none">Usando Agora (Online)</span>
                          <span className="text-2xl font-black text-emerald-400 mt-1.5 font-mono flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            {usersList.filter(u => u.online && u.lastActive && u.lastActive > (Date.now() - 5 * 60 * 1000)).length}
                          </span>
                        </div>
                      </div>

                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1 pt-1">USUÁRIOS CADASTRADOS ({usersList.length})</p>
                      <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-0.5">
                        {usersList.map((usr) => {
                          const isOnline = usr.online && usr.lastActive && (usr.lastActive > (Date.now() - 5 * 60 * 1000));
                          return (
                            <div key={usr.id} className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-2">
                              <div className="flex items-center gap-2.5 justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <img 
                                    src={usr.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100'} 
                                    className={`w-8 h-8 rounded-full object-cover border shrink-0 ${
                                      isOnline ? 'border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'border-white/10'
                                    }`} 
                                    alt=""
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-[11px] font-bold text-white truncate leading-tight">{usr.displayName || 'Anonimo'}</p>
                                      {usr.email?.trim().toLowerCase() === 'jonas1401@gmail.com' && (
                                        <span className="text-[6px] px-1 bg-red-600 text-white font-black rounded tracking-widest uppercase border border-red-500/20">Dono</span>
                                      )}
                                    </div>
                                    <p className="text-[8px] text-gray-400 truncate leading-none mt-0.5 flex items-center gap-1">
                                      {usr.email || 'Sem e-mail'}
                                      <span className="text-gray-600">•</span>
                                      {isOnline ? (
                                        <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                          Online
                                        </span>
                                      ) : (
                                        <span className="text-gray-500">Offline</span>
                                      )}
                                    </p>
                                  </div>
                                </div>

                                {/* Role display badge */}
                                <span className={`text-[8px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase border shrink-0 ${
                                  usr.role === 'admin' 
                                    ? 'bg-red-500/15 text-red-400 border-red-500/20' 
                                    : usr.role === 'operator' 
                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' 
                                    : 'bg-blue-500/15 text-blue-400 border-blue-500/20'
                                }`}>
                                  {usr.role === 'admin' ? 'Admin' : usr.role === 'operator' ? 'Operador' : 'Motorista'}
                                </span>
                              </div>

                            {/* Quick Actions for User */}
                            <div className="flex gap-1.5 items-center justify-between pt-1 border-t border-white/5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[8px] text-gray-500 font-semibold">Função:</span>
                                <select
                                  value={usr.role || 'driver'}
                                  onChange={async (e) => {
                                    try {
                                      await setDoc(doc(db, 'users', usr.id), { role: e.target.value }, { merge: true });
                                      alert('Função atualizada!');
                                    } catch (err) {
                                      alert('Erro ao atualizar função: ' + err);
                                    }
                                  }}
                                  className="bg-black/60 border border-white/10 rounded-lg text-[9px] px-1 py-0.5 text-white focus:outline-none"
                                >
                                  <option value="driver">Motorista</option>
                                  <option value="operator">Operador</option>
                                  <option value="admin">Administrador</option>
                                </select>
                              </div>

                              <div className="flex gap-1">
                                {/* Reset inappropriate name action */}
                                <button
                                  onClick={async () => {
                                    const newName = prompt('Digite o novo nome para o usuário:', usr.displayName || '');
                                    if (newName && newName.trim()) {
                                      try {
                                        await setDoc(doc(db, 'users', usr.id), { displayName: newName.trim() }, { merge: true });
                                        alert('Nome do usuário atualizado com sucesso!');
                                      } catch (err) {
                                        alert('Erro ao atualizar nome: ' + err);
                                      }
                                    }
                                  }}
                                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[8px] font-bold text-gray-400 hover:text-white border border-white/10 cursor-pointer"
                                  title="Editar Nome do Perfil"
                                >
                                  Renomear
                                </button>

                                {/* Quick ban */}
                                {usr.email?.trim().toLowerCase() !== 'jonas1401@gmail.com' && (
                                  <button
                                    onClick={async () => {
                                      if (!confirm(`Deseja realmente banir permanentemente ${usr.displayName || 'este usuário'}?`)) return;
                                      try {
                                        if (usr.email) {
                                          const emailLower = usr.email.trim().toLowerCase();
                                          await setDoc(doc(db, 'banned_emails', emailLower), {
                                            email: emailLower,
                                            userName: usr.displayName || 'Motorista',
                                            bannedAt: Date.now(),
                                            reason: 'Banido diretamente pelo painel administrativo',
                                          });
                                        }
                                        await setDoc(doc(db, 'banned_uids', usr.id), {
                                          uid: usr.id,
                                          userName: usr.displayName || 'Motorista',
                                          userEmail: usr.email || '',
                                          bannedAt: Date.now(),
                                          reason: 'Banido diretamente pelo painel administrativo',
                                        });
                                        alert('Usuário banido com sucesso!');
                                      } catch (e) {
                                        alert('Erro ao banir: ' + e);
                                      }
                                    }}
                                    className="px-2 py-0.5 rounded bg-red-600/10 hover:bg-red-600 text-[8px] font-black uppercase text-red-400 hover:text-white border border-red-500/20 cursor-pointer"
                                    title="Banir Usuário"
                                  >
                                    Banir
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  )}

                  {/* 4. BANS TAB */}
                  {adminTab === 'bans' && (
                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                      {/* Manually Ban Email */}
                      <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">BANIR NOVO USUÁRIO MANUALMENTE</p>
                        <div className="flex flex-col gap-2">
                          <input 
                            type="email" 
                            placeholder="E-mail do motorista (ex: joao@gmail.com)" 
                            value={newBanEmail}
                            onChange={(e) => setNewBanEmail(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition font-sans"
                          />
                          <input 
                            type="text" 
                            placeholder="Motivo do banimento (ex: Linguagem inadequada)" 
                            value={newBanReason}
                            onChange={(e) => setNewBanReason(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition font-sans"
                          />
                          <button
                            onClick={async () => {
                              if (!newBanEmail.trim()) {
                                alert('Por favor, digite o e-mail para banir.');
                                return;
                              }
                              try {
                                const emailLower = newBanEmail.trim().toLowerCase();
                                await setDoc(doc(db, 'banned_emails', emailLower), {
                                  email: emailLower,
                                  userName: 'Banimento Manual',
                                  bannedAt: Date.now(),
                                  reason: newBanReason || 'Abuso reportado pelo administrador',
                                });
                                setNewBanEmail('');
                                setNewBanReason('');
                                alert('E-mail banido com sucesso!');
                              } catch (err) {
                                alert('Erro ao banir: ' + err);
                              }
                            }}
                            className="py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider cursor-pointer transition flex items-center justify-center gap-1.5 active:scale-[0.98]"
                          >
                            <Ban size={12} />
                            <span>Aplicar Banimento Permanente</span>
                          </button>
                        </div>
                      </div>

                      {/* Banned Emails List */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">E-MAILS BANIDOS ({bannedEmailsList.length})</p>
                        {bannedEmailsList.length === 0 ? (
                          <p className="text-[10px] text-gray-500 pl-1 italic">Nenhum e-mail banido.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
                            {bannedEmailsList.map((ban) => (
                              <div key={ban.id} className="p-2.5 rounded-xl bg-red-950/20 border border-red-900/20 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold text-red-300 truncate">{ban.email}</p>
                                  <p className="text-[8px] text-gray-400 truncate">Motivo: {ban.reason || 'Abuso'}</p>
                                </div>
                                <button
                                  onClick={async () => {
                                    try {
                                      await deleteDoc(doc(db, 'banned_emails', ban.id));
                                      alert('E-mail desbanido com sucesso!');
                                    } catch (err) {
                                      alert('Erro ao desbanir: ' + err);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 hover:text-green-400 border border-white/10 text-gray-300 text-[8px] font-black uppercase rounded-lg transition cursor-pointer shrink-0"
                                >
                                  Desbanir
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Banned UIDs List */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">IDs DE DISPOSITIVO BANIDOS ({bannedUidsList.length})</p>
                        {bannedUidsList.length === 0 ? (
                          <p className="text-[10px] text-gray-500 pl-1 italic">Nenhum ID de dispositivo banido.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
                            {bannedUidsList.map((ban) => (
                              <div key={ban.id} className="p-2.5 rounded-xl bg-red-950/20 border border-red-900/20 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold text-red-300 truncate">{ban.userName || 'Dispositivo'}</p>
                                  <p className="text-[8px] text-gray-400 truncate">Motivo: {ban.reason || 'Abuso'}</p>
                                </div>
                                <button
                                  onClick={async () => {
                                    try {
                                      await deleteDoc(doc(db, 'banned_uids', ban.id));
                                      alert('Dispositivo desbanido com sucesso!');
                                    } catch (err) {
                                      alert('Erro ao desbanir: ' + err);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 hover:text-green-400 border border-white/10 text-gray-300 text-[8px] font-black uppercase rounded-lg transition cursor-pointer shrink-0"
                                >
                                  Desbanir
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 5. ANNOUNCEMENTS TAB */}
                  {adminTab === 'announcements' && (
                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                      <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                        <p className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">CRIAR NOVO AVISO TRANSMITIDO</p>
                        
                        <div className="flex flex-col gap-2.5">
                          <div>
                            <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest pl-1">Grau de Importância</span>
                            <div className="grid grid-cols-3 gap-1.5 mt-1">
                              {[
                                { id: 'info', label: 'Informativo', color: 'border-blue-500/30 text-blue-400 bg-blue-500/5' },
                                { id: 'warning', label: 'Atenção', color: 'border-orange-500/30 text-orange-400 bg-orange-500/5' },
                                { id: 'danger', label: 'Crítico', color: 'border-red-500/30 text-red-400 bg-red-500/5' }
                              ].map((lvl) => (
                                <button
                                  key={lvl.id}
                                  onClick={() => setNewAnnouncementLevel(lvl.id as any)}
                                  className={`py-1.5 rounded-xl border text-[9px] font-bold uppercase transition-all duration-150 cursor-pointer ${
                                    newAnnouncementLevel === lvl.id 
                                      ? 'bg-white/10 text-white border-white' 
                                      : lvl.color
                                  }`}
                                >
                                  {lvl.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest pl-1">Mensagem de Alerta</span>
                            <textarea 
                              placeholder="Digite o alerta geral para todos os motoristas (ex: Fila intensa no Portão Sul ou pista com óleo)" 
                              value={newAnnouncementText}
                              onChange={(e) => setNewAnnouncementText(e.target.value)}
                              className="w-full h-20 p-2.5 mt-1 bg-black/40 border border-white/10 rounded-xl text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 transition resize-none font-sans"
                            />
                          </div>

                          <button
                            onClick={async () => {
                              if (!newAnnouncementText.trim()) {
                                alert('Por favor, digite o texto do aviso.');
                                return;
                              }
                              try {
                                await setDoc(doc(db, 'settings', 'global_announcement'), {
                                  text: newAnnouncementText.trim(),
                                  level: newAnnouncementLevel,
                                  active: true,
                                  createdAt: Date.now(),
                                  createdBy: displayName,
                                });
                                setNewAnnouncementText('');
                                alert('Aviso geral transmitido com sucesso!');
                              } catch (err) {
                                alert('Erro ao publicar aviso: ' + err);
                              }
                            }}
                            className="py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider cursor-pointer transition flex items-center justify-center gap-1.5 active:scale-[0.98]"
                          >
                            <Megaphone size={12} />
                            <span>Transmitir Alerta Geral</span>
                          </button>
                        </div>
                      </div>

                      {/* Current active announcement info */}
                      <div className="p-3 rounded-xl bg-white/[0.01] border border-white/5">
                        <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest block mb-2">AVISO TRANSMITIDO ATIVO</span>
                        {globalAnnouncement && globalAnnouncement.active && globalAnnouncement.text ? (
                          <div className="space-y-2">
                            <div className={`p-3 rounded-lg border text-[10px] ${
                              globalAnnouncement.level === 'danger' ? 'bg-red-950/20 text-red-200 border-red-500/20' :
                              globalAnnouncement.level === 'warning' ? 'bg-orange-950/20 text-orange-200 border-orange-500/20' :
                              'bg-blue-950/20 text-blue-200 border-blue-500/20'
                            }`}>
                              <p className="font-bold uppercase text-[8px] mb-1 tracking-widest">
                                {globalAnnouncement.level === 'danger' ? 'ALERTA CRÍTICO' : globalAnnouncement.level === 'warning' ? 'ATENÇÃO' : 'INFORMAÇÃO'}
                              </p>
                              <p className="italic">"{globalAnnouncement.text}"</p>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  await setDoc(doc(db, 'settings', 'global_announcement'), {
                                    text: '',
                                    level: 'info',
                                    active: false,
                                    createdAt: Date.now(),
                                    createdBy: displayName,
                                  });
                                  alert('Aviso desativado!');
                                } catch (err) {
                                  alert('Erro ao desativar: ' + err);
                                }
                              }}
                              className="w-full py-1.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 hover:border-transparent text-[9px] font-bold uppercase rounded-lg transition cursor-pointer"
                            >
                              Remover Alerta Transmitido
                            </button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-500 italic">Nenhum aviso transmitido ativo no momento.</p>
                        )}
                      </div>

                      {/* 🚨 REAL-TIME POPUP NOTIFICATIONS CARD */}
                      <div className="p-3.5 rounded-2xl bg-[#00f6ff]/[0.02] border border-[#00f6ff]/15 space-y-3">
                        <div className="flex items-center gap-1.5">
                          <Bell size={13} className="text-[#00f6ff]" />
                          <p className="text-[10px] font-bold text-[#00f6ff] uppercase tracking-wider">ENVIAR NOTIFICAÇÃO POP-UP INSTANTÂNEA</p>
                        </div>
                        <p className="text-[9px] text-gray-400 leading-normal pl-0.5">
                          Envia um pop-up interativo em tempo real para as telas de todos os usuários que estiverem conectados ao aplicativo neste momento.
                        </p>

                        <div className="flex flex-col gap-2.5">
                          <div>
                            <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest pl-1">Estilo do Pop-up</span>
                            <div className="grid grid-cols-4 gap-1 mt-1">
                              {[
                                { id: 'info', label: 'Info', color: 'border-blue-500/20 text-blue-400 bg-blue-500/5' },
                                { id: 'warning', label: 'Atenção', color: 'border-amber-500/20 text-amber-400 bg-amber-500/5' },
                                { id: 'success', label: 'Sucesso', color: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' },
                                { id: 'alert', label: 'Alerta/Sirene', color: 'border-red-500/20 text-red-400 bg-red-500/5' }
                              ].map((lvl) => (
                                <button
                                  key={lvl.id}
                                  onClick={() => setNewNotifType(lvl.id as any)}
                                  className={`py-1 rounded-lg border text-[8.5px] font-bold uppercase transition-all duration-150 cursor-pointer ${
                                    newNotifType === lvl.id 
                                      ? 'bg-white/10 text-white border-white' 
                                      : lvl.color
                                  }`}
                                >
                                  {lvl.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest pl-1">Título do Pop-up</span>
                            <input 
                              type="text"
                              placeholder="Ex: Novo Agendamento Disponível, Bloqueio de Pista" 
                              value={newNotifTitle}
                              onChange={(e) => setNewNotifTitle(e.target.value)}
                              className="w-full p-2 mt-1 bg-black/40 border border-white/10 rounded-xl text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-[#00f6ff] transition"
                            />
                          </div>

                          <div>
                            <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest pl-1">Conteúdo da Mensagem</span>
                            <textarea 
                              placeholder="Digite a mensagem detalhada..." 
                              value={newNotifMessage}
                              onChange={(e) => setNewNotifMessage(e.target.value)}
                              className="w-full h-16 p-2 mt-1 bg-black/40 border border-white/10 rounded-xl text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-[#00f6ff] transition resize-none font-sans"
                            />
                          </div>

                          <button
                            onClick={async () => {
                              if (!newNotifTitle.trim()) {
                                alert('Por favor, digite o título da notificação.');
                                return;
                              }
                              if (!newNotifMessage.trim()) {
                                alert('Por favor, digite a mensagem da notificação.');
                                return;
                              }
                              try {
                                const newId = 'notif_' + Date.now();
                                await setDoc(doc(db, 'settings', 'app_notification'), {
                                  id: newId,
                                  title: newNotifTitle.trim(),
                                  message: newNotifMessage.trim(),
                                  type: newNotifType,
                                  senderName: displayName,
                                  sentAt: Date.now()
                                });
                                setNewNotifTitle('');
                                setNewNotifMessage('');
                                alert('Notificação enviada em tempo real para todos!');
                              } catch (err) {
                                alert('Erro ao enviar notificação: ' + err);
                              }
                            }}
                            className="py-2 bg-[#00f6ff]/15 hover:bg-[#00f6ff]/25 border border-[#00f6ff]/30 text-[#00f6ff] hover:text-white font-bold rounded-xl text-[10px] uppercase tracking-wider cursor-pointer transition flex items-center justify-center gap-1.5 active:scale-[0.98]"
                          >
                            <Bell size={12} className="animate-bounce" />
                            <span>Enviar Notificação Instantânea</span>
                          </button>
                        </div>
                      </div>

                      {/* CURRENT ACTIVE POPUP NOTIFICATION DETAILS */}
                      <div className="p-3 rounded-xl bg-white/[0.01] border border-white/5">
                        <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest block mb-2">NOTIFICAÇÃO POP-UP ATIVA DO SISTEMA</span>
                        {activeNotification && activeNotification.id ? (
                          <div className="space-y-2">
                            <div className={`p-3 rounded-lg border text-[10px] ${
                              activeNotification.type === 'danger' || activeNotification.type === 'alert'
                                ? 'bg-red-950/20 text-red-200 border-red-500/20'
                                : activeNotification.type === 'warning'
                                ? 'bg-amber-950/20 text-amber-200 border-amber-500/20'
                                : activeNotification.type === 'success'
                                ? 'bg-emerald-950/20 text-emerald-200 border-emerald-500/20'
                                : 'bg-blue-950/20 text-blue-200 border-blue-500/20'
                            }`}>
                              <p className="font-bold uppercase text-[8px] mb-1 tracking-widest flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-current animate-ping" />
                                {activeNotification.type === 'danger' || activeNotification.type === 'alert'
                                  ? 'ALERTA / SIRENE'
                                  : activeNotification.type === 'warning'
                                  ? 'AVISO DE ATENÇÃO'
                                  : activeNotification.type === 'success'
                                  ? 'MENSAGEM DE SUCESSO'
                                  : 'INFORMATIVO GERAL'}
                              </p>
                              <p className="font-bold text-white text-[11px]">{activeNotification.title}</p>
                              <p className="mt-1 opacity-90">{activeNotification.message}</p>
                              <p className="text-[7.5px] opacity-45 mt-1.5">
                                Enviada por {activeNotification.senderName} às {new Date(activeNotification.sentAt).toLocaleTimeString()}
                              </p>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  await setDoc(doc(db, 'settings', 'app_notification'), {
                                    id: '',
                                    title: '',
                                    message: '',
                                    type: 'info',
                                    senderName: '',
                                    sentAt: 0
                                  });
                                  alert('Notificação removida das telas!');
                                } catch (err) {
                                  alert('Erro ao limpar notificação: ' + err);
                                }
                              }}
                              className="w-full py-1.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 hover:border-transparent text-[8.5px] font-bold uppercase rounded-lg transition cursor-pointer flex items-center justify-center gap-1"
                            >
                              <X size={10} />
                              <span>Remover Notificação / Limpar Telas</span>
                            </button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-500 italic">Nenhuma notificação ativa nos dispositivos.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Close Button at bottom */}
                  <button
                    onClick={() => setShowAdminPanel(false)}
                    className="w-full mt-4 py-2.5 bg-red-600 hover:bg-red-500 hover:shadow-lg hover:shadow-red-500/10 transition text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shrink-0"
                  >
                    Fechar Painel Administrativo
                  </button>
                </>
              ) : (
                <>
                  {/* Drawer header for Drivers (Safety & Support) */}
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-[0_0_8px_rgba(239,68,68,0.2)]">
                        <ShieldAlert size={16} className="filter drop-shadow-[0_0_2px_#EF4444]" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-white">Segurança e Alertas</h3>
                        <p className="text-[10px] text-gray-400 mt-0.5">Área de Apoio e Emergência do Motorista</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAdminPanel(false)}
                      className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Driver content container */}
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] text-gray-300 leading-relaxed flex items-start gap-2">
                      <AlertTriangle size={15} className="text-[#FF7A00] shrink-0 mt-0.5" />
                      <span>
                        Use esta área para falar com a moderação ou acionar contatos críticos do Porto. Seu alerta será recebido imediatamente na central do Porto Fácil.
                      </span>
                    </div>

                    {/* Emergency Speed Dial */}
                    <div className="space-y-2">
                      <h4 className="text-[9px] font-bold text-[#EF4444] uppercase tracking-wider pl-1">CONTATOS RÁPIDOS DE EMERGÊNCIA</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {/* 1. Guarda Portuaria */}
                        <a
                          href="tel:1332026500"
                          className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition flex flex-col justify-between h-20 group cursor-pointer"
                        >
                          <div className="flex justify-between items-start">
                            <Shield size={14} className="text-red-400" />
                            <span className="text-[8px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded font-black tracking-widest uppercase">LIGAR</span>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-white uppercase group-hover:text-red-400 transition leading-none">Guarda Portuária</p>
                            <p className="text-[8px] text-gray-400 mt-0.5 font-mono leading-none">(13) 3202-6500</p>
                          </div>
                        </a>

                        {/* 2. PM */}
                        <a
                          href="tel:190"
                          className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition flex flex-col justify-between h-20 group cursor-pointer"
                        >
                          <div className="flex justify-between items-start">
                            <ShieldAlert size={14} className="text-red-400" />
                            <span className="text-[8px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded font-black tracking-widest uppercase">LIGAR</span>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-white uppercase group-hover:text-red-400 transition leading-none">Polícia Militar</p>
                            <p className="text-[8px] text-gray-400 mt-0.5 font-mono leading-none">190</p>
                          </div>
                        </a>

                        {/* 3. SAMU */}
                        <a
                          href="tel:192"
                          className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/15 transition flex flex-col justify-between h-20 group cursor-pointer"
                        >
                          <div className="flex justify-between items-start">
                            <AlertTriangle size={14} className="text-orange-400" />
                            <span className="text-[8px] px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded font-black tracking-widest uppercase">LIGAR</span>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-white uppercase group-hover:text-orange-400 transition leading-none">SAMU / Resgate</p>
                            <p className="text-[8px] text-gray-400 mt-0.5 font-mono leading-none">192</p>
                          </div>
                        </a>

                        {/* 4. Suporte WhatsApp Copadubo */}
                        <button
                          onClick={() => {
                            setShowAdminPanel(false);
                            setShowWhatsappContacts(true);
                          }}
                          className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/15 transition flex flex-col justify-between h-20 group cursor-pointer text-left"
                        >
                          <div className="flex justify-between items-start">
                            <MessageCircle size={14} className="text-green-400" />
                            <span className="text-[8px] px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded font-black tracking-widest uppercase">ABRIR</span>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-white uppercase group-hover:text-green-400 transition leading-none">WhatsApp Copadubo</p>
                            <p className="text-[8px] text-gray-400 mt-0.5 font-mono leading-none">Lista de Plantões</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Report Submission Form */}
                    <div className="space-y-2 pt-1">
                      <h4 className="text-[9px] font-bold text-[#FF7A00] uppercase tracking-wider pl-1">ENVIAR NOVO ALERTA À ADMINISTRAÇÃO</h4>
                      
                      {reportSentSuccess ? (
                        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center flex flex-col items-center justify-center gap-2">
                          <CheckCircle2 size={24} className="text-green-500" />
                          <div>
                            <p className="text-xs font-bold text-white">Alerta Enviado com Sucesso!</p>
                            <p className="text-[9px] text-gray-400 mt-0.5">Os administradores foram notificados em tempo real e investigarão a ocorrência.</p>
                          </div>
                          <button
                            onClick={() => setReportSentSuccess(false)}
                            className="mt-1 px-3 py-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-[9px] font-bold uppercase transition"
                          >
                            Enviar outro alerta
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={securityReportText}
                            onChange={(e) => setSecurityReportText(e.target.value)}
                            placeholder="Descreva problemas como: pista bloqueada, acidente, carga de risco, atitude suspeita, fumaça ou irregularidades no aplicativo..."
                            className="w-full h-24 p-3 bg-black/40 border border-white/10 rounded-xl text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00]/40 transition resize-none font-sans"
                          />
                          <button
                            onClick={async () => {
                              if (!securityReportText.trim()) {
                                alert('Por favor, descreva a ocorrência antes de enviar.');
                                return;
                              }
                              setIsSendingReport(true);
                              try {
                                await addDoc(collection(db, 'reports'), {
                                  reportedAt: Date.now(),
                                  reportedByName: displayName,
                                  reportedByEmail: email || '',
                                  reportedByUid: userId,
                                  senderName: displayName,
                                  senderEmail: email || '',
                                  senderAvatar: avatarUrl,
                                  senderId: userId,
                                  messageText: securityReportText,
                                  channelName: 'Porto Seguro (Alerta)',
                                  channelId: 'porto_seguro_alerta',
                                  messageId: 'driver_alert_' + Date.now(),
                                });
                                setSecurityReportText('');
                                setReportSentSuccess(true);
                              } catch (err) {
                                console.error('Erro ao enviar alerta:', err);
                                alert('Erro ao enviar alerta: ' + (err instanceof Error ? err.message : String(err)));
                              } finally {
                                setIsSendingReport(false);
                              }
                            }}
                            disabled={isSendingReport}
                            className="w-full py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition duration-150 cursor-pointer active:scale-[0.98] shadow-lg shadow-red-600/10"
                          >
                            {isSendingReport ? (
                              <>
                                <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                <span>Enviando Alerta...</span>
                              </>
                            ) : (
                              <>
                                <ShieldAlert size={14} />
                                <span>Transmitir Alerta Crítico</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Close button for non-admin */}
                  <button
                    onClick={() => setShowAdminPanel(false)}
                    className="w-full mt-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 transition text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shrink-0"
                  >
                    Voltar ao Aplicativo
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 9. WHATSAPP CONTACTS DRAWER */}
      <AnimatePresence>
        {showWhatsappContacts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end justify-center"
          >
            <div className="absolute inset-0" onClick={() => setShowWhatsappContacts(false)} />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-[#0A1C30] border-t border-white/10 rounded-t-[28px] w-full max-w-md overflow-hidden shadow-2xl relative z-10 p-5 pb-6 flex flex-col max-h-[85vh]"
            >
              {/* Drawer header */}
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-2">
                  <MessageCircle className="text-[#22C55E] filter drop-shadow-[0_0_4px_#22C55E]" size={20} />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">Contatos WhatsApp</h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">Suporte e plantões oficiais Copadubo</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWhatsappContacts(false)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Contacts list container */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin pb-4">
                {[
                  { name: "Plantão Porto", number: "(41) 98417-5303", apiNumber: "5541984175303", badge: "Porto" },
                  { name: "Plantão Fospar", number: "(41) 99128-2367", apiNumber: "5541991282367", badge: "Fospar" },
                  { name: "Encarregado", number: "(41) 99169-2656", apiNumber: "5541991692656", badge: "Supervisão" },
                  { name: "Barracão de Verificar", number: "(41) 99112-4254", apiNumber: "5541991124254", badge: "Triagem" },
                  { name: "Agendamento Fospar", number: "(41) 93618-2517", apiNumber: "5541936182517", badge: "Logística" },
                  { name: "Robô Copadubo", number: "(41) 98854-7616", apiNumber: "5541988547616", badge: "Assistente IA", isBot: true }
                ].map((contact, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-[#22C55E]/30 transition-all duration-200 flex items-center justify-between gap-3 relative overflow-hidden group"
                  >
                    {/* Visual left colored accent */}
                    <div className={`absolute top-0 bottom-0 left-0 w-1 transition-all ${contact.isBot ? 'bg-blue-500' : 'bg-[#22C55E]'}`} />

                    <div className="flex items-center gap-3 pl-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                        contact.isBot 
                          ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 group-hover:bg-blue-500/20' 
                          : 'bg-green-500/10 border-green-500/20 text-[#22C55E] group-hover:bg-green-500/20'
                      }`}>
                        <MessageCircle size={18} className="filter drop-shadow-[0_0_2px_currentColor]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-white tracking-wide">{contact.name}</span>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase border ${
                            contact.isBot 
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                              : 'bg-green-500/10 text-green-400 border-green-500/10'
                          }`}>
                            {contact.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{contact.number}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => window.open(`https://wa.me/${contact.apiNumber}`, '_blank')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                        contact.isBot
                          ? 'bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/20 hover:shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                          : 'bg-[#22C55E]/10 hover:bg-[#22C55E] text-green-400 hover:text-white border border-[#22C55E]/20 hover:shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                      }`}
                    >
                      <span>Conversar</span>
                      <ChevronRight size={10} />
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* Close button */}
              <button
                onClick={() => setShowWhatsappContacts(false)}
                className="w-full mt-2 py-2.5 bg-green-600 hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/10 transition text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shrink-0"
              >
                Voltar ao Menu
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Google-style Weather Widget */}
      <WeatherWidget />

    </div>
  );
}
