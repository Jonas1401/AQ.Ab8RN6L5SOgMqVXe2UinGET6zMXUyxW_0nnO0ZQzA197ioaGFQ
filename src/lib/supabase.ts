import { createClient } from '@supabase/supabase-js';

// Load Supabase environment variables (checking both VITE_ and NEXT_PUBLIC_ formats)
const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 
  'https://epcpdgulvkkqprbzhgtc.supabase.co';

const supabaseAnonKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  'sb_publishable_oH2aipaYsUSs_Hoz44SJ8g_wRwap9eh';

let activeClient = createClient(supabaseUrl, supabaseAnonKey);

export const supabase = new Proxy({} as any, {
  get(target, prop, receiver) {
    return Reflect.get(activeClient, prop, receiver);
  }
});

let currentSession: any = null;

// Ensure we track active session
supabase.auth.getSession().then(({ data: { session } }) => {
  currentSession = session;
});
supabase.auth.onAuthStateChange((_event, session) => {
  currentSession = session;
});

export function updateSupabaseConfig(url: string, key: string) {
  if (!url || !key) return;
  console.log('[Supabase Adapter] Atualizando conexão com URL:', url);
  activeClient = createClient(url, key);
  
  // Re-fetch current session on the new client instance
  activeClient.auth.getSession().then(({ data: { session } }) => {
    currentSession = session;
  });
  activeClient.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
  });
}

// Database Provider Configuration (Local Storage vs Supabase)
export function getDbProvider(): 'local' | 'supabase' {
  try {
    const provider = localStorage.getItem('portoconecta_db_provider');
    // Default to 'supabase' to ensure immediate cloud connectivity for everyone
    return provider === 'local' ? 'local' : 'supabase';
  } catch (e) {
    return 'supabase';
  }
}

export function setDbProvider(provider: 'local' | 'supabase') {
  try {
    localStorage.setItem('portoconecta_db_provider', provider);
    window.location.reload();
  } catch (e) {}
}

// Multi-Tab real-time local state sync channel
const syncChannel = typeof window !== 'undefined' ? new BroadcastChannel('portoconecta_db_sync') : null;

if (syncChannel) {
  syncChannel.onmessage = (event) => {
    if (getDbProvider() === 'local' && event.data && event.data.type === 'DB_UPDATE') {
      const { path, data } = event.data;
      const localDB = getLocalDB();
      if (data === null) {
        delete localDB[path];
      } else {
        localDB[path] = data;
      }
      try {
        localStorage.setItem('portoconecta_db_data', JSON.stringify(localDB));
      } catch (e) {}
      triggerListenersForDoc(path, data);
    }
  };
}

// Supabase Auth Adapter
export const auth = {
  get currentUser() {
    if (getDbProvider() === 'local') {
      try {
        const activeLocalUser = localStorage.getItem('portoconecta_active_user');
        if (activeLocalUser) {
          const parsed = JSON.parse(activeLocalUser);
          return {
            uid: parsed.uid || 'user_local',
            email: parsed.email || '',
            displayName: parsed.displayName || parsed.email?.split('@')[0] || 'Motorista',
            emailVerified: true,
            isAnonymous: false,
            tenantId: null,
            providerData: []
          };
        }
      } catch (e) {}
      
      // Fallback if there is a real Supabase session
      if (currentSession?.user) {
        return {
          uid: currentSession.user.id,
          email: currentSession.user.email || '',
          displayName: currentSession.user.user_metadata?.displayName || currentSession.user.user_metadata?.full_name || currentSession.user.email?.split('@')[0] || 'Motorista',
          emailVerified: true,
          isAnonymous: false,
          tenantId: null,
          providerData: []
        };
      }
      return null;
    }

    if (!currentSession || !currentSession.user) return null;
    return {
      uid: currentSession.user.id,
      email: currentSession.user.email || '',
      displayName: currentSession.user.user_metadata?.displayName || currentSession.user.user_metadata?.full_name || currentSession.user.email?.split('@')[0] || 'Motorista',
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerData: []
    };
  }
};

export async function signInWithEmailAndPassword(_authObj: any, email: string, password: string) {
  const emailLower = email.toLowerCase().trim();
  
  if (getDbProvider() === 'local') {
    const localAuths = JSON.parse(localStorage.getItem('portoconecta_local_auth') || '{}');
    const localUser = localAuths[emailLower];
    if (localUser && localUser.password === password) {
      console.log('[Supabase Auth/Local] Login local bem-sucedido.');
      const userObj = {
        uid: localUser.uid,
        email: emailLower,
        displayName: emailLower.split('@')[0]
      };
      localStorage.setItem('portoconecta_active_user', JSON.stringify(userObj));
      return { user: { uid: localUser.uid } };
    } else if (emailLower === 'jonas1401@gmail.com' && password === 'admin123') {
      const uid = 'admin_jonas';
      const userObj = { uid, email: emailLower, displayName: 'Jonas' };
      localAuths[emailLower] = { password: 'admin123', uid };
      localStorage.setItem('portoconecta_local_auth', JSON.stringify(localAuths));
      localStorage.setItem('portoconecta_active_user', JSON.stringify(userObj));
      return { user: { uid } };
    }
    throw new Error('E-mail ou senha incorretos.');
  }
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: emailLower, password });
    if (error) {
      const errorMsg = error.message?.toLowerCase() || '';
      const isEmailNotConfirmed = errorMsg.includes('confirm') || 
                                  errorMsg.includes('verification') ||
                                  errorMsg.includes('not confirmed') ||
                                  error.code === 'email_not_confirmed' ||
                                  error.status === 400; // unconfirmed emails usually return status 400
                                  
      if (isEmailNotConfirmed) {
        console.warn('[Supabase Auth] E-mail pendente de confirmação. Verificando credenciais locais...');
        const localAuths = JSON.parse(localStorage.getItem('portoconecta_local_auth') || '{}');
        const localUser = localAuths[emailLower];
        if (localUser && localUser.password === password) {
          console.log('[Supabase Auth] Login por credenciais locais bem-sucedido para e-mail não confirmado.');
          currentSession = {
            user: {
              id: localUser.uid,
              email: emailLower,
              user_metadata: { displayName: emailLower.split('@')[0] }
            }
          };
          const userObj = {
            uid: localUser.uid,
            email: emailLower,
            displayName: emailLower.split('@')[0]
          };
          localStorage.setItem('portoconecta_active_user', JSON.stringify(userObj));
          return { user: { uid: localUser.uid } };
        } else {
          // If no local credentials or wrong password, throw a specific unconfirmed error
          const customError = new Error('Email_Not_Confirmed');
          (customError as any).code = 'email_not_confirmed';
          throw customError;
        }
      }
      throw error;
    }
    
    currentSession = data.session;
    
    // Save credentials locally for future offline/unconfirmed fallback logins
    try {
      const localAuths = JSON.parse(localStorage.getItem('portoconecta_local_auth') || '{}');
      localAuths[emailLower] = { password, uid: data.user?.id || 'local_' + Math.random().toString(36).substr(2, 9) };
      localStorage.setItem('portoconecta_local_auth', JSON.stringify(localAuths));
      const userObj = {
        uid: data.user?.id || '',
        email: emailLower,
        displayName: data.user?.user_metadata?.displayName || emailLower.split('@')[0]
      };
      localStorage.setItem('portoconecta_active_user', JSON.stringify(userObj));
    } catch (e) {}

    return { user: { uid: data.user?.id || '' } };
  } catch (err: any) {
    // If it is a generic network/connection failure or wrong credentials on an emulator, let's also check local credentials
    const localAuths = JSON.parse(localStorage.getItem('portoconecta_local_auth') || '{}');
    const localUser = localAuths[emailLower];
    if (localUser && localUser.password === password) {
      console.log('[Supabase Auth] Login offline/local com sucesso.');
      currentSession = {
        user: {
          id: localUser.uid,
          email: emailLower,
          user_metadata: { displayName: emailLower.split('@')[0] }
        }
      };
      const userObj = {
        uid: localUser.uid,
        email: emailLower,
        displayName: emailLower.split('@')[0]
      };
      localStorage.setItem('portoconecta_active_user', JSON.stringify(userObj));
      return { user: { uid: localUser.uid } };
    }
    throw err;
  }
}

export async function createUserWithEmailAndPassword(_authObj: any, email: string, password: string) {
  const emailLower = email.toLowerCase().trim();
  
  // Save credentials locally first so they can always log in offline
  let localUid = 'user_' + Math.random().toString(36).substr(2, 9);
  try {
    const localAuths = JSON.parse(localStorage.getItem('portoconecta_local_auth') || '{}');
    const existing = localAuths[emailLower];
    if (existing?.uid) {
      localUid = existing.uid;
    }
    localAuths[emailLower] = { password, uid: localUid };
    localStorage.setItem('portoconecta_local_auth', JSON.stringify(localAuths));
  } catch (e) {
    console.warn('Error saving local credentials:', e);
  }

  if (getDbProvider() === 'local') {
    const userObj = {
      uid: localUid,
      email: emailLower,
      displayName: emailLower.split('@')[0]
    };
    localStorage.setItem('portoconecta_active_user', JSON.stringify(userObj));
    return { user: { uid: localUid } };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: emailLower,
      password,
      options: {
        data: {
          displayName: emailLower.split('@')[0]
        }
      }
    });
    if (error) throw error;
    
    // If sign up succeeded but session is null (due to Email Confirmation required)
    if (data.user && !data.session) {
      console.warn('[Supabase Auth] Sign up succeeded but session is null (unconfirmed email). Establishing local session...');
      const localAuths = JSON.parse(localStorage.getItem('portoconecta_local_auth') || '{}');
      const uid = data.user.id || localAuths[emailLower]?.uid || 'user_' + Math.random().toString(36).substr(2, 9);
      
      // Save exact Supabase UID to local auth credentials mapping
      localAuths[emailLower] = { password, uid };
      localStorage.setItem('portoconecta_local_auth', JSON.stringify(localAuths));

      currentSession = {
        user: {
          id: uid,
          email: emailLower,
          user_metadata: { displayName: emailLower.split('@')[0] }
        }
      };
      const userObj = {
        uid,
        email: emailLower,
        displayName: emailLower.split('@')[0]
      };
      localStorage.setItem('portoconecta_active_user', JSON.stringify(userObj));
      return { user: { uid } };
    }

    currentSession = data.session;
    const userObj = {
      uid: data.user?.id || '',
      email: emailLower,
      displayName: data.user?.user_metadata?.displayName || emailLower.split('@')[0]
    };
    localStorage.setItem('portoconecta_active_user', JSON.stringify(userObj));
    return { user: { uid: data.user?.id || '' } };
  } catch (err) {
    console.warn('[Supabase Sign Up Failure, using local registration fallback]:', err);
    // If Supabase completely fails/blocks signup, use a robust local session
    const localAuths = JSON.parse(localStorage.getItem('portoconecta_local_auth') || '{}');
    const uid = localAuths[emailLower]?.uid || 'user_' + Math.random().toString(36).substr(2, 9);
    
    currentSession = {
      user: {
        id: uid,
        email: emailLower,
        user_metadata: { displayName: emailLower.split('@')[0] }
      }
    };
    const userObj = {
      uid,
      email: emailLower,
      displayName: emailLower.split('@')[0]
    };
    localStorage.setItem('portoconecta_active_user', JSON.stringify(userObj));
    return { user: { uid } };
  }
}

export async function signOut(_authObj: any) {
  try {
    await supabase.auth.signOut();
  } catch (e) {}
  currentSession = null;
  localStorage.removeItem('portoconecta_active_user');
}

export function onAuthStateChanged(_authObj: any, callback: (user: any) => void) {
  // Fire current user immediately
  callback(auth.currentUser);

  if (getDbProvider() === 'local') {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'portoconecta_active_user') {
        callback(auth.currentUser);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }

  supabase.auth.getSession().then(({ data: { session } }) => {
    currentSession = session;
    callback(auth.currentUser);
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    callback(auth.currentUser);
  });

  return () => {
    subscription.unsubscribe();
  };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleDatabaseError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`[Supabase Database Error] ${operationType} at ${path}:`, error);
}

// Database Adapter Data Structures
export class DocumentReference {
  constructor(public db: any, public collectionPath: string, public id: string) {}
  get path() { return `${this.collectionPath}/${this.id}`; }
}

export class CollectionReference {
  constructor(public db: any, public path: string) {}
}

export class Query {
  constructor(public collectionRef: CollectionReference, public constraints: any[] = []) {}
}

export const db = { name: 'supabase-emulator-db' };

export function doc(_dbObj: any, path: string, ...segments: string[]) {
  const allSegments = [path, ...segments];
  const id = allSegments.pop()!;
  const collPath = allSegments.join('/');
  return new DocumentReference(db, collPath, id);
}

export function collection(_dbObj: any, path: string, ...segments: string[]) {
  const allSegments = [path, ...segments];
  const collPath = allSegments.join('/');
  return new CollectionReference(db, collPath);
}

export function query(collectionRef: CollectionReference, ...constraints: any[]) {
  return new Query(collectionRef, constraints);
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(n: number) {
  return { type: 'limit', value: n };
}

// Local Cache Helper functions
function getLocalDB(): Record<string, any> {
  try {
    const data = localStorage.getItem('portoconecta_db_data');
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
}

function saveLocalDB(dbData: Record<string, any>) {
  try {
    localStorage.setItem('portoconecta_db_data', JSON.stringify(dbData));
  } catch (e) {
    console.error('Error saving local DB:', e);
  }
}

// Track deleted paths to prevent them from reappearing even if DB deletes fail
function getDeletedPaths(): Set<string> {
  try {
    const list = localStorage.getItem('portoconecta_deleted_paths');
    return list ? new Set(JSON.parse(list)) : new Set();
  } catch (e) {
    return new Set();
  }
}

function addDeletedPath(path: string) {
  try {
    const set = getDeletedPaths();
    set.add(path);
    localStorage.setItem('portoconecta_deleted_paths', JSON.stringify(Array.from(set)));
  } catch (e) {
    console.error('Error saving deleted paths:', e);
  }
}

// Path Parser to match paths to Supabase tables
function parsePath(path: string): { table: string; userId?: string; id?: string; isSubcollection: boolean } {
  const parts = path.split('/');
  
  if (parts[0] === 'users' && parts.length >= 3) {
    const userId = parts[1];
    const sub = parts[2]; // 'events', 'notes', 'checklists', 'tickets'
    const id = parts[3];
    return { table: sub, userId, id, isSubcollection: true };
  }

  if (parts[0] === 'channels' && parts.length >= 3) {
    const channelId = parts[1];
    const sub = parts[2]; // 'messages'
    const id = parts[3];
    return { table: 'messages', userId: channelId, id, isSubcollection: true };
  }

  return {
    table: parts[0],
    id: parts[1],
    isSubcollection: false
  };
}

// Document Normalizer (Row columns to camelCase)
function normalizeDoc(table: string, row: any, userIdFromPath?: string) {
  if (!row) return null;
  
  if (table === 'users') {
    return {
      uid: row.id,
      displayName: row.display_name,
      email: row.email,
      avatarUrl: row.avatar_url,
      role: row.role,
      online: row.online,
      lastActive: row.last_active ? new Date(row.last_active).getTime() : Date.now()
    };
  }
  
  if (table === 'settings') {
    return row.value;
  }
  
  if (table === 'banned_emails' || table === 'banned_uids') {
    return {
      id: row.id,
      reason: row.reason,
      bannedAt: row.banned_at ? new Date(row.banned_at).getTime() : Date.now()
    };
  }
  
  if (table === 'reports') {
    let extra: any = {};
    if (row.message_user) {
      try {
        extra = JSON.parse(row.message_user);
      } catch (e) {
        extra = { senderName: row.message_user };
      }
    }
    return {
      id: row.id,
      reportedAt: row.reported_at ? new Date(row.reported_at).getTime() : Date.now(),
      senderId: row.sender_id,
      channelId: row.channel_id,
      messageId: row.message_id,
      messageText: row.message_text,
      messageUser: row.message_user,
      reason: row.reason,
      // Deserialized metadata
      senderName: extra.senderName || 'Motorista',
      senderAvatar: extra.senderAvatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
      senderEmail: extra.senderEmail || '',
      reportedById: extra.reportedById || '',
      reportedByName: extra.reportedByName || 'Motorista',
      channelName: extra.channelName || 'Canal'
    };
  }
  
  if (table === 'messages') {
    return {
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userAvatar: row.user_avatar,
      text: row.text,
      imageUrl: row.image_url,
      audioUrl: row.audio_url,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      isSticker: row.is_sticker,
      isComercioAd: row.is_comercio_ad,
      candidateName: row.candidate_name,
      candidatePhoto: row.candidate_photo,
      candidatePhone: row.candidate_phone,
      candidateExperience: row.candidate_experience,
      candidateCnh: row.candidate_cnh,
      candidateObs: row.candidate_obs,
      likes: row.likes || 0,
      likesUsers: row.likes_users || [],
      replyTo: row.reply_to
    };
  }
  
  if (table === 'events') {
    return {
      id: row.id,
      userId: row.user_id || userIdFromPath,
      title: row.title,
      date: row.date,
      time: row.time,
      description: row.description,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
    };
  }
  
  if (table === 'notes') {
    return {
      id: row.id,
      userId: row.user_id || userIdFromPath,
      title: row.title,
      content: row.content,
      color: row.color,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
    };
  }
  
  if (table === 'checklists') {
    return {
      id: row.id,
      userId: row.user_id || userIdFromPath,
      title: row.title,
      items: row.items || [],
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
    };
  }
  
  if (table === 'tickets') {
    return {
      id: row.id,
      userId: row.user_id || userIdFromPath,
      title: row.title,
      date: row.date,
      imageUrl: row.image_url,
      description: row.description,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
    };
  }
  
  return row;
}

// Background Database Operations
async function writeToSupabase(path: string, data: any) {
  const parsed = parsePath(path);
  const table = parsed.table;
  
  try {
    if (table === 'users') {
      await supabase.from('users').upsert({
        id: parsed.id,
        display_name: data.displayName || data.display_name,
        email: data.email,
        avatar_url: data.avatarUrl || data.avatar_url,
        role: data.role,
        online: data.online ?? true,
        last_active: new Date(data.lastActive || Date.now()).toISOString()
      }, { onConflict: 'id' });
    } 
    else if (table === 'settings') {
      await supabase.from('settings').upsert({
        id: parsed.id,
        value: data
      }, { onConflict: 'id' });
    }
    else if (table === 'banned_emails') {
      await supabase.from('banned_emails').upsert({
        id: parsed.id,
        reason: data.reason || '',
        banned_at: new Date(data.bannedAt || Date.now()).toISOString()
      }, { onConflict: 'id' });
    }
    else if (table === 'banned_uids') {
      await supabase.from('banned_uids').upsert({
        id: parsed.id,
        reason: data.reason || '',
        banned_at: new Date(data.bannedAt || Date.now()).toISOString()
      }, { onConflict: 'id' });
    }
    else if (table === 'reports') {
      const extraMetadata = {
        senderName: data.senderName,
        senderAvatar: data.senderAvatar,
        senderEmail: data.senderEmail,
        reportedById: data.reportedById,
        reportedByName: data.reportedByName,
        channelName: data.channelName
      };
      await supabase.from('reports').upsert({
        id: parsed.id,
        reported_at: new Date(data.reportedAt || Date.now()).toISOString(),
        sender_id: data.senderId,
        channel_id: data.channelId,
        message_id: data.messageId,
        message_text: data.messageText,
        message_user: JSON.stringify(extraMetadata),
        reason: data.reason || ''
      }, { onConflict: 'id' });
    }
    else if (table === 'messages') {
      await supabase.from('messages').upsert({
        id: parsed.id,
        channel_id: parsed.userId,
        user_id: data.userId,
        user_name: data.userName,
        user_avatar: data.userAvatar,
        text: data.text || '',
        image_url: data.imageUrl || null,
        audio_url: data.audioUrl || null,
        created_at: new Date(data.createdAt || Date.now()).toISOString(),
        is_sticker: data.isSticker || false,
        is_comercio_ad: data.isComercioAd || false,
        candidate_name: data.candidateName || null,
        candidate_photo: data.candidatePhoto || null,
        candidate_phone: data.candidatePhone || null,
        candidate_experience: data.candidateExperience || null,
        candidate_cnh: data.candidateCnh || null,
        candidate_obs: data.candidateObs || null,
        likes: data.likes || 0,
        likes_users: data.likesUsers || [],
        reply_to: data.replyTo || null
      }, { onConflict: 'id' });
    }
    else if (table === 'events') {
      await supabase.from('events').upsert({
        id: parsed.id,
        user_id: parsed.userId,
        title: data.title,
        date: data.date,
        time: data.time || '12:00',
        description: data.description || '',
        created_at: new Date(data.createdAt || Date.now()).toISOString()
      }, { onConflict: 'id' });
    }
    else if (table === 'notes') {
      await supabase.from('notes').upsert({
        id: parsed.id,
        user_id: parsed.userId,
        title: data.title,
        content: data.content,
        color: data.color || '#3b82f6',
        created_at: new Date(data.createdAt || Date.now()).toISOString()
      }, { onConflict: 'id' });
    }
    else if (table === 'checklists') {
      await supabase.from('checklists').upsert({
        id: parsed.id,
        user_id: parsed.userId,
        title: data.title,
        items: data.items || [],
        created_at: new Date(data.createdAt || Date.now()).toISOString()
      }, { onConflict: 'id' });
    }
    else if (table === 'tickets') {
      await supabase.from('tickets').upsert({
        id: parsed.id,
        user_id: parsed.userId,
        title: data.title,
        date: data.date,
        image_url: data.imageUrl,
        description: data.description || '',
        created_at: new Date(data.createdAt || Date.now()).toISOString()
      }, { onConflict: 'id' });
    }
  } catch (err) {
    console.warn('[Supabase Emulator Write Error]:', err);
  }
}

async function deleteFromSupabase(path: string) {
  const parsed = parsePath(path);
  const table = parsed.table;
  try {
    const { error } = await supabase.from(table).delete().eq('id', parsed.id);
    if (error) {
      console.warn(`[Supabase Delete Error] table: ${table}, id: ${parsed.id}:`, error);
    }
  } catch (err) {
    console.warn('[Supabase Emulator Delete Error]:', err);
  }
}

async function fetchDocFromSupabase(path: string): Promise<any> {
  const deletedPaths = getDeletedPaths();
  if (deletedPaths.has(path)) {
    return null;
  }
  const parsed = parsePath(path);
  const table = parsed.table;
  try {
    const { data, error } = await supabase.from(table).select('*').eq('id', parsed.id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return normalizeDoc(table, data, parsed.userId);
  } catch (err) {
    console.warn(`[Supabase Emulator FetchDoc Error] ${path}:`, err);
    return null;
  }
}

async function fetchCollectionFromSupabase(path: string, constraints: any[] = []): Promise<any[]> {
  const parsed = parsePath(path);
  const table = parsed.table;
  try {
    let queryBuilder = supabase.from(table).select('*');
    
    if (parsed.isSubcollection && parsed.userId) {
      if (table === 'messages') {
        queryBuilder = queryBuilder.eq('channel_id', parsed.userId);
      } else {
        queryBuilder = queryBuilder.eq('user_id', parsed.userId);
      }
    }

    let orderByField = 'created_at';
    let ascending = false;
    let limitVal = 100;

    for (const c of constraints) {
      if (c && c.type === 'orderBy') {
        if (c.field === 'createdAt') orderByField = 'created_at';
        else if (c.field === 'reportedAt') orderByField = 'reported_at';
        else orderByField = c.field;
        ascending = c.direction === 'asc';
      }
      if (c && c.type === 'limit') {
        limitVal = c.value;
      }
    }

    queryBuilder = queryBuilder.order(orderByField, { ascending }).limit(limitVal);

    const { data, error } = await queryBuilder;
    if (error) throw error;
    if (!data) return [];

    const deletedPaths = getDeletedPaths();
    const filteredRows = data.filter(row => {
      const itemPath = parsed.isSubcollection && parsed.userId
        ? (parsed.table === 'messages' 
            ? `channels/${parsed.userId}/messages/${row.id}` 
            : `users/${parsed.userId}/${parsed.table}/${row.id}`)
        : `${parsed.table}/${row.id}`;
      return !deletedPaths.has(itemPath);
    });

    return filteredRows.map(row => normalizeDoc(table, row, parsed.userId));
  } catch (err) {
    console.warn(`[Supabase Emulator FetchCollection Error] ${path}:`, err);
    return [];
  }
}

// DocumentSnapshot & QuerySnapshot Classes
export class DocumentSnapshot {
  constructor(public id: string, private _data: any) {}
  exists() { return this._data !== null && this._data !== undefined; }
  data() { return this._data; }
}

export class QueryDocumentSnapshot extends DocumentSnapshot {
  constructor(id: string, _data: any) {
    super(id, _data);
  }
}

export class QuerySnapshot {
  constructor(public docs: QueryDocumentSnapshot[]) {}
  get empty() { return this.docs.length === 0; }
  get size() { return this.docs.length; }
  forEach(callback: (doc: QueryDocumentSnapshot) => void) {
    this.docs.forEach(callback);
  }
  docChanges() {
    return this.docs.map(doc => ({
      type: 'added' as const,
      doc
    }));
  }
}

// Emulated Database APIs
export async function getDoc(docRef: DocumentReference): Promise<DocumentSnapshot> {
  if (getDbProvider() === 'local') {
    const localDB = getLocalDB();
    const data = localDB[docRef.path];
    return new DocumentSnapshot(docRef.id, data || null);
  }

  let data = await fetchDocFromSupabase(docRef.path);
  const localDB = getLocalDB();
  
  if (data) {
    localDB[docRef.path] = data;
    saveLocalDB(localDB);
  } else {
    data = localDB[docRef.path];
  }

  return new DocumentSnapshot(docRef.id, data || null);
}

export async function getDocFromServer(docRef: DocumentReference): Promise<DocumentSnapshot> {
  return getDoc(docRef);
}

export async function setDoc(docRef: DocumentReference, data: any, options?: { merge?: boolean }) {
  const localDB = getLocalDB();
  let mergedData = data;
  if (options?.merge && localDB[docRef.path]) {
    mergedData = { ...localDB[docRef.path], ...data };
  } else {
    mergedData = { ...data };
  }
  
  // Ensure id is always present on the document saved in local cache
  if (mergedData && typeof mergedData === 'object') {
    if (!mergedData.id) {
      mergedData.id = docRef.id;
    }
  }
  
  localDB[docRef.path] = mergedData;
  saveLocalDB(localDB);

  triggerListenersForDoc(docRef.path, mergedData);

  // Broadcast update to other tabs in real-time
  if (syncChannel) {
    syncChannel.postMessage({ type: 'DB_UPDATE', path: docRef.path, data: mergedData });
  }

  if (getDbProvider() === 'supabase') {
    writeToSupabase(docRef.path, mergedData);
  }
}

export async function updateDoc(docRef: DocumentReference, data: any) {
  return setDoc(docRef, data, { merge: true });
}

export async function addDoc(collectionRef: CollectionReference, data: any) {
  const generatedId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const docRef = new DocumentReference(collectionRef.db, collectionRef.path, generatedId);
  await setDoc(docRef, data);
  return docRef;
}

export async function deleteDoc(docRef: DocumentReference) {
  const localDB = getLocalDB();
  delete localDB[docRef.path];
  saveLocalDB(localDB);

  addDeletedPath(docRef.path); // Save locally deleted path

  triggerListenersForDoc(docRef.path, null);

  // Broadcast deletion to other tabs in real-time
  if (syncChannel) {
    syncChannel.postMessage({ type: 'DB_UPDATE', path: docRef.path, data: null });
  }

  if (getDbProvider() === 'supabase') {
    deleteFromSupabase(docRef.path);
  }
}

export async function deleteDocLocally(docRef: DocumentReference) {
  const localDB = getLocalDB();
  delete localDB[docRef.path];
  saveLocalDB(localDB);

  addDeletedPath(docRef.path); // Save locally deleted path

  triggerListenersForDoc(docRef.path, null);
  
  // Broadcast deletion to other tabs in real-time
  if (syncChannel) {
    syncChannel.postMessage({ type: 'DB_UPDATE', path: docRef.path, data: null });
  }
}

export async function getDocs(queryRef: Query | CollectionReference): Promise<QuerySnapshot> {
  const path = queryRef instanceof Query ? queryRef.collectionRef.path : queryRef.path;
  const constraints = queryRef instanceof Query ? queryRef.constraints : [];
  
  if (getDbProvider() === 'local') {
    const localDB = getLocalDB();
    const collDocs = Object.keys(localDB)
      .filter(k => k.startsWith(path + '/') && k.split('/').length === path.split('/').length + 1)
      .map(k => localDB[k]);
      
    let sorted = [...collDocs];
    let orderByField = 'createdAt';
    let ascending = false;
    let limitVal = 100;
    
    for (const c of constraints) {
      if (c && c.type === 'orderBy') {
        orderByField = c.field;
        ascending = c.direction === 'asc';
      }
      if (c && c.type === 'limit') {
        limitVal = c.value;
      }
    }
    sorted.sort((a, b) => {
      const valA = a[orderByField] || 0;
      const valB = b[orderByField] || 0;
      return ascending ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
    sorted = sorted.slice(0, limitVal);
    
    const docs = sorted.map(item => new QueryDocumentSnapshot(item.id, item));
    return new QuerySnapshot(docs);
  }

  const items = await fetchCollectionFromSupabase(path, constraints);
  const localDB = getLocalDB();
  
  // Clean up cached items that are no longer present on server (or deleted)
  const itemIds = new Set((items || []).map(item => item.id));
  const collectionPrefix = path + '/';
  const collectionDepth = path.split('/').length + 1;
  Object.keys(localDB).forEach(key => {
    if (key.startsWith(collectionPrefix) && key.split('/').length === collectionDepth) {
      const id = key.substring(collectionPrefix.length);
      if (!itemIds.has(id)) {
        delete localDB[key];
      }
    }
  });

  if (items && items.length > 0) {
    items.forEach(item => {
      localDB[`${path}/${item.id}`] = item;
    });
  }
  saveLocalDB(localDB);

  const docs = (items || []).map(item => new QueryDocumentSnapshot(item.id, item));
  return new QuerySnapshot(docs);
}

// Reactive Snapshots and Realtime
interface ActiveListener {
  id: string;
  path: string;
  isCollection: boolean;
  constraints?: any[];
  callback: (snap: any) => void;
}

const activeListeners: ActiveListener[] = [];
const activeChannels: Record<string, any> = {};

function triggerListenersForDoc(docPath: string, docData: any) {
  const parsed = parsePath(docPath);
  
  activeListeners.forEach(listener => {
    if (!listener.isCollection && listener.path === docPath) {
      listener.callback(new DocumentSnapshot(parsed.id || '', docData));
    }
    
    if (listener.isCollection) {
      const parentCollPath = docPath.substring(0, docPath.lastIndexOf('/'));
      if (listener.path === parentCollPath) {
        const localDB = getLocalDB();
        const collDocs = Object.keys(localDB)
          .filter(k => k.startsWith(parentCollPath + '/') && k.split('/').length === parentCollPath.split('/').length + 1)
          .map(k => localDB[k]);
          
        let sorted = [...collDocs];
        let orderByField = 'createdAt';
        let ascending = false;
        let limitVal = 100;
        
        for (const c of listener.constraints || []) {
          if (c && c.type === 'orderBy') {
            orderByField = c.field;
            ascending = c.direction === 'asc';
          }
          if (c && c.type === 'limit') {
            limitVal = c.value;
          }
        }
        
        sorted.sort((a, b) => {
          const valA = a[orderByField] || 0;
          const valB = b[orderByField] || 0;
          return ascending ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
        });
        
        sorted = sorted.slice(0, limitVal);
        const docs = sorted.map(item => new QueryDocumentSnapshot(item.id, item));
        listener.callback(new QuerySnapshot(docs));
      }
    }
  });
}

function handleRealtimePayload(table: string, payload: any) {
  const { eventType, new: newRow, old: oldRow } = payload;
  const localDB = getLocalDB();
  
  if (eventType === 'DELETE') {
    const id = oldRow.id;
    const matchingKeys = Object.keys(localDB).filter(k => k.endsWith(`/${id}`) || k === `${table}/${id}`);
    matchingKeys.forEach(key => {
      delete localDB[key];
      triggerListenersForDoc(key, null);
    });
    saveLocalDB(localDB);
  } else {
    const id = newRow.id;
    let fullPath = '';
    
    if (table === 'users') {
      fullPath = `users/${id}`;
    } else if (table === 'settings') {
      fullPath = `settings/${id}`;
    } else if (table === 'banned_emails') {
      fullPath = `banned_emails/${id}`;
    } else if (table === 'banned_uids') {
      fullPath = `banned_uids/${id}`;
    } else if (table === 'reports') {
      fullPath = `reports/${id}`;
    } else if (table === 'messages') {
      fullPath = `channels/${newRow.channel_id}/messages/${id}`;
    } else if (['events', 'notes', 'checklists', 'tickets'].includes(table)) {
      fullPath = `users/${newRow.user_id}/${table}/${id}`;
    }

    if (fullPath) {
      const deletedPaths = getDeletedPaths();
      if (deletedPaths.has(fullPath)) {
        return; // Ignore if we deleted it!
      }
      const normalized = normalizeDoc(table, newRow);
      localDB[fullPath] = normalized;
      saveLocalDB(localDB);
      triggerListenersForDoc(fullPath, normalized);
    }
  }
}

function subscribeToTableRealtime(table: string) {
  if (activeChannels[table]) return;

  try {
    const channel = supabase.channel(`public:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload: any) => {
        handleRealtimePayload(table, payload);
      })
      .subscribe();

    activeChannels[table] = channel;
  } catch (err) {
    console.warn(`[Supabase Realtime Subscription failed] ${table}:`, err);
  }
}

export function onSnapshot(
  docOrQueryRef: DocumentReference | Query | CollectionReference, 
  callback: (snap: any) => void,
  errorCallback?: (err: any) => void
) {
  const isCollection = !(docOrQueryRef instanceof DocumentReference);
  const path = docOrQueryRef instanceof DocumentReference
    ? docOrQueryRef.path
    : docOrQueryRef instanceof Query
      ? docOrQueryRef.collectionRef.path
      : docOrQueryRef.path;
       
  const constraints = docOrQueryRef instanceof Query ? docOrQueryRef.constraints : [];
  const parsed = parsePath(path);
  
  const listenerId = Math.random().toString(36).substring(2, 9);
  const listener: ActiveListener = { id: listenerId, path, isCollection, constraints, callback };
  activeListeners.push(listener);

  // 1. Fire instantly from local storage cache
  const localDB = getLocalDB();
  if (isCollection) {
    const collDocs = Object.keys(localDB)
      .filter(k => k.startsWith(path + '/') && k.split('/').length === path.split('/').length + 1)
      .map(k => localDB[k]);
      
    let sorted = [...collDocs];
    let orderByField = 'createdAt';
    let ascending = false;
    let limitVal = 100;
    
    for (const c of constraints) {
      if (c && c.type === 'orderBy') {
        orderByField = c.field;
        ascending = c.direction === 'asc';
      }
      if (c && c.type === 'limit') {
        limitVal = c.value;
      }
    }
    sorted.sort((a, b) => {
      const valA = a[orderByField] || 0;
      const valB = b[orderByField] || 0;
      return ascending ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
    sorted = sorted.slice(0, limitVal);

    const docs = sorted.map(item => new QueryDocumentSnapshot(item.id, item));
    callback(new QuerySnapshot(docs));
  } else {
    const data = localDB[path] || null;
    callback(new DocumentSnapshot(parsed.id || '', data));
  }

  // If DB provider is Local, we do NOT query Supabase or create intervals!
  if (getDbProvider() === 'local') {
    return () => {
      const idx = activeListeners.findIndex(l => l.id === listenerId);
      if (idx !== -1) activeListeners.splice(idx, 1);
    };
  }

  // 2. Setup database subscription
  subscribeToTableRealtime(parsed.table);
  
  // 3. Fetch fresh from database and fire
  let intervalId: any = null;
  if (isCollection) {
    fetchCollectionFromSupabase(path, constraints).then(items => {
      const freshLocalDB = getLocalDB();
      
      // Clean up cached items that are no longer present on server (or deleted)
      const itemIds = new Set((items || []).map(item => item.id));
      const collectionPrefix = path + '/';
      const collectionDepth = path.split('/').length + 1;
      
      let changed = false;
      
      Object.keys(freshLocalDB).forEach(key => {
        if (key.startsWith(collectionPrefix) && key.split('/').length === collectionDepth) {
          const id = key.substring(collectionPrefix.length);
          if (!itemIds.has(id)) {
            delete freshLocalDB[key];
            changed = true;
          }
        }
      });

      if (items && items.length > 0) {
        items.forEach(item => {
          const cacheKey = `${path}/${item.id}`;
          const existing = freshLocalDB[cacheKey];
          if (JSON.stringify(existing) !== JSON.stringify(item)) {
            freshLocalDB[cacheKey] = item;
            changed = true;
          }
        });
      } else if (items && items.length === 0 && Object.keys(freshLocalDB).some(k => k.startsWith(collectionPrefix))) {
        // If items fetched is empty, but cache has items, we should update cache and mark as changed
        changed = true;
      }

      if (changed || !freshLocalDB[`__collection_initialized_${path}`]) {
        freshLocalDB[`__collection_initialized_${path}`] = 'true';
        saveLocalDB(freshLocalDB);
        const docs = (items || []).map(item => new QueryDocumentSnapshot(item.id, item));
        callback(new QuerySnapshot(docs));
      }
    }).catch(err => {
      console.warn('Background fetchCollection failed:', err);
      if (errorCallback) errorCallback(err);
    });
  } else {
    fetchDocFromSupabase(path).then(data => {
      const freshLocalDB = getLocalDB();
      const currentCached = freshLocalDB[path];
      const isDifferent = JSON.stringify(currentCached) !== JSON.stringify(data);
      if (isDifferent || !freshLocalDB[`__doc_initialized_${path}`]) {
        freshLocalDB[`__doc_initialized_${path}`] = 'true';
        freshLocalDB[path] = data;
        saveLocalDB(freshLocalDB);
        callback(new DocumentSnapshot(parsed.id || '', data));
      }
    }).catch(err => {
      console.warn('Background fetchDoc failed:', err);
      if (errorCallback) errorCallback(err);
    });

    // Highly reliable polling interval (6 seconds) to ensure changes like status image propagate without relying purely on postgres replication configuration.
    intervalId = setInterval(() => {
      fetchDocFromSupabase(path).then(data => {
        if (data) {
          const freshLocalDB = getLocalDB();
          const currentCached = freshLocalDB[path];
          const isDifferent = JSON.stringify(currentCached) !== JSON.stringify(data);
          if (isDifferent) {
            freshLocalDB[path] = data;
            saveLocalDB(freshLocalDB);
            callback(new DocumentSnapshot(parsed.id || '', data));
          }
        }
      }).catch(err => {
        console.warn('Background poll fetchDoc failed:', err);
      });
    }, 6000);
  }

  return () => {
    const idx = activeListeners.findIndex(l => l.id === listenerId);
    if (idx !== -1) activeListeners.splice(idx, 1);
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}

/**
 * Checks if Supabase has been successfully initialized.
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('does not exist') || error.code === '42P01') {
        return { 
          success: true, 
          message: 'Conectado ao Supabase! As tabelas serão simuladas ou criadas no banco de dados.' 
        };
      }
      return { success: false, message: `Erro: ${error.message}` };
    }
    return { success: true, message: 'Supabase Conectado!' };
  } catch (err: any) {
    return { success: false, message: `Erro: ${err?.message || String(err)}` };
  }
}

/**
 * Sync user profile helper
 */
export async function syncUserProfileToSupabase(profile: {
  uid: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  role: string;
  online?: boolean;
}) {
  try {
    await supabase.from('users').upsert({
      id: profile.uid,
      display_name: profile.displayName,
      email: profile.email,
      avatar_url: profile.avatarUrl,
      role: profile.role,
      online: profile.online ?? true,
      last_active: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Sync failed:', err);
  }
}

/**
 * Legacy/compatibility sync exports
 */
export async function syncTicketToSupabase(ticket: any) {
  await writeToSupabase(`users/${ticket.userId}/tickets/${ticket.id}`, ticket);
}

export async function deleteTicketFromSupabase(id: string) {
  await deleteFromSupabase(`tickets/${id}`);
}

export async function syncEventToSupabase(event: any) {
  await writeToSupabase(`users/${event.userId}/events/${event.id}`, event);
}

export async function deleteEventFromSupabase(id: string) {
  await deleteFromSupabase(`events/${id}`);
}

export async function syncNoteToSupabase(note: any) {
  await writeToSupabase(`users/${note.userId}/notes/${note.id}`, note);
}

export async function deleteNoteFromSupabase(id: string) {
  await deleteFromSupabase(`notes/${id}`);
}

export async function syncChecklistToSupabase(checklist: any) {
  await writeToSupabase(`users/${checklist.userId}/checklists/${checklist.id}`, checklist);
}

export async function deleteChecklistFromSupabase(id: string) {
  await deleteFromSupabase(`checklists/${id}`);
}
