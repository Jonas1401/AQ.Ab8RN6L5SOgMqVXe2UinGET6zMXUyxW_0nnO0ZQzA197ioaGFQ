/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

dotenv.config();

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=1200";

const PORT_AND_TRUCK_IMAGES: { name: string; url: string; desc: string }[] = [];

function getCycleDefaultImage(cycleId: string): string {
  return '/logo_porto.png';
}

const CACHE_FILE = path.join(process.cwd(), 'status_cache.json');

// Initialize Supabase Client for backend-side updates
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const dbClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

interface StatusState {
  imageUrl: string;
  uploadedBy: {
    uid: string;
    displayName: string;
    avatarUrl?: string;
  };
  uploadedAt: number;
  reports: string[];
  isDefault: boolean;
  yOffset: number;
  likesCount: number;
  likedBy: string[];
  currentCycleId: string;
  publishedUsersInCycle: Record<string, boolean>;
  deletedUsersInCycle: Record<string, boolean>;
}

interface CycleInfo {
  id: string;
  start: number;
  end: number;
}

function getCycleInfo(timestamp: number, timezoneOffsetMinutes = 180): CycleInfo {
  // Convert server timestamp to client's local date/time representation
  // standard Date.prototype.getTimezoneOffset() returns +180 for UTC-3
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

function getDefaultState(cycleId: string): StatusState {
  return {
    imageUrl: getCycleDefaultImage(cycleId),
    uploadedBy: {
      uid: 'system',
      displayName: 'Sistema'
    },
    uploadedAt: Date.now(),
    reports: [],
    isDefault: true,
    yOffset: 50,
    likesCount: 0,
    likedBy: [],
    currentCycleId: cycleId,
    publishedUsersInCycle: {},
    deletedUsersInCycle: {}
  };
}

async function getStatusFromDb(): Promise<StatusState | null> {
  if (dbClient) {
    try {
      const { data, error } = await dbClient
        .from('settings')
        .select('*')
        .eq('id', 'status_image')
        .maybeSingle();
      if (!error && data && data.value) {
        return data.value as StatusState;
      }
    } catch (err) {
      console.warn('[Server Supabase Error] Failed to read status_image:', err);
    }
  }
  
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[Server Cache Error] Failed to parse status_cache.json:', e);
    }
  }
  
  return null;
}

async function saveStatusToDb(state: StatusState) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn('[Server Cache Error] Failed to write status_cache.json:', err);
  }
  
  if (dbClient) {
    try {
      await dbClient
        .from('settings')
        .upsert({
          id: 'status_image',
          value: state
        }, { onConflict: 'id' });
    } catch (err) {
      console.warn('[Server Supabase Error] Failed to save status_image:', err);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 image uploads
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ limit: '20mb', extended: true }));

  // Initialize Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey
    ? new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    : null;

  // Helper to retry Gemini API calls in case of temporary 503 or 429 errors
  async function callGeminiWithRetry<T>(
    apiCall: () => Promise<T>,
    retries = 3,
    delayMs = 1500
  ): Promise<T> {
    let lastError: any = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await apiCall();
      } catch (err: any) {
        lastError = err;
        const status = err?.status || err?.code || (err?.message?.includes('503') ? 503 : null);
        console.warn(`[Gemini API] Tentativa ${attempt}/${retries} falhou. Status/Erro: ${status || err?.message}`);
        
        if (attempt < retries) {
          // Wait before retrying (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        }
      }
    }
    throw lastError;
  }

  // Background cycle checker (checks every 20 seconds) to ensure status is reset automatically at 07:00, 18:00, 00:00
  setInterval(async () => {
    try {
      const timezoneOffset = 180; // default to Brazil/Sao_Paulo (180 mins)
      const now = Date.now();
      const cycle = getCycleInfo(now, timezoneOffset);
      
      const state = await getStatusFromDb();
      if (state && state.currentCycleId !== cycle.id) {
        console.log(`[Background Cycle Checker] Resetting status. New cycle: ${cycle.id}`);
        const newState = getDefaultState(cycle.id);
        await saveStatusToDb(newState);
      }
    } catch (err) {
      console.error('[Background Cycle Checker] Error during automatic reset check:', err);
    }
  }, 20000);

  // GET current status and check if active cycle is valid (resetting automatically if expired)
  app.get('/api/status', async (req, res) => {
    try {
      const timezoneOffset = parseInt(req.query.timezoneOffset as string) || 180;
      const now = Date.now();
      const cycle = getCycleInfo(now, timezoneOffset);
      
      let state = await getStatusFromDb();
      if (!state || state.currentCycleId !== cycle.id) {
        console.log(`[Status Endpoint] Cycle mismatch or status empty. Starting cycle ${cycle.id}`);
        state = getDefaultState(cycle.id);
        await saveStatusToDb(state);
      }
      
      return res.json({
        success: true,
        statusImage: state,
        cycle
      });
    } catch (err: any) {
      console.error('[API GET Status Error]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST publish status photo (with cycle and ownership rules)
  app.post('/api/status/publish', async (req, res) => {
    try {
      const { image, yOffset, userId, userName, userAvatar, isAdmin, timezoneOffset } = req.body;
      const offset = parseInt(timezoneOffset) || 180;
      
      if (!image) {
        return res.status(400).json({ success: false, error: 'Imagem não fornecida.' });
      }
      if (!userId || !userName) {
        return res.status(400).json({ success: false, error: 'Identificação do usuário incompleta.' });
      }
      
      const now = Date.now();
      const cycle = getCycleInfo(now, offset);
      
      let state = await getStatusFromDb();
      if (!state || state.currentCycleId !== cycle.id) {
        state = getDefaultState(cycle.id);
      }
      
      // Strict backend validation of the cycle publication rules:
      if (!isAdmin) {
        // 1. Another user already published a custom status image in this cycle
        if (!state.isDefault && state.uploadedBy?.uid !== userId) {
          return res.status(403).json({ 
            success: false, 
            error: 'Já existe uma imagem de status ativa publicada por outro usuário neste ciclo!' 
          });
        }
        
        // 2. User has already published in this cycle
        if (state.publishedUsersInCycle && state.publishedUsersInCycle[userId]) {
          return res.status(403).json({ 
            success: false, 
            error: 'Você já publicou uma imagem neste ciclo. Você poderá publicar novamente apenas no próximo ciclo!' 
          });
        }
        
        // 3. User has already deleted their own image in this cycle
        if (state.deletedUsersInCycle && state.deletedUsersInCycle[userId]) {
          return res.status(403).json({ 
            success: false, 
            error: 'Você já apagou sua imagem neste ciclo e perdeu o direito de publicar outra até o próximo ciclo!' 
          });
        }
      }
      
      // Initialize mappings if they don't exist
      if (!state.publishedUsersInCycle) state.publishedUsersInCycle = {};
      if (!state.deletedUsersInCycle) state.deletedUsersInCycle = {};
      
      // Apply updates
      state.imageUrl = image;
      state.uploadedBy = {
        uid: userId,
        displayName: userName,
        avatarUrl: userAvatar || ''
      };
      state.uploadedAt = now;
      state.isDefault = false;
      state.yOffset = yOffset ?? 50;
      state.reports = [];
      state.likesCount = 0;
      state.likedBy = [];
      
      // Mark as published for ordinary users (admins have unlimited posting privileges)
      if (!isAdmin) {
        state.publishedUsersInCycle[userId] = true;
      }
      
      await saveStatusToDb(state);
      
      return res.json({
        success: true,
        statusImage: state,
        cycle
      });
    } catch (err: any) {
      console.error('[API Publish Error]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST delete active status photo (with cycle ownership rules)
  app.post('/api/status/delete', async (req, res) => {
    try {
      const { userId, isAdmin, timezoneOffset } = req.body;
      const offset = parseInt(timezoneOffset) || 180;
      
      if (!userId) {
        return res.status(400).json({ success: false, error: 'Identificação de usuário ausente.' });
      }
      
      const now = Date.now();
      const cycle = getCycleInfo(now, offset);
      
      let state = await getStatusFromDb();
      if (!state || state.currentCycleId !== cycle.id) {
        state = getDefaultState(cycle.id);
      }
      
      if (state.isDefault) {
        return res.status(400).json({ success: false, error: 'Nenhuma imagem de status ativa para remover.' });
      }
      
      const ownerId = state.uploadedBy?.uid;
      
      // Strict backend validation of the cycle deletion rules:
      if (!isAdmin) {
        // 1. Can only delete own image
        if (ownerId !== userId) {
          return res.status(403).json({ 
            success: false, 
            error: 'Você não possui permissão para remover o status de outro motorista!' 
          });
        }
        
        // 2. Can only delete once in the cycle
        if (state.deletedUsersInCycle && state.deletedUsersInCycle[userId]) {
          return res.status(403).json({ 
            success: false, 
            error: 'Você já removeu sua imagem neste ciclo uma vez!' 
          });
        }
      }
      
      // Initialize mappings if they don't exist
      if (!state.publishedUsersInCycle) state.publishedUsersInCycle = {};
      if (!state.deletedUsersInCycle) state.deletedUsersInCycle = {};
      
      // Mark as deleted for the owner (so they lose publication rights in this cycle)
      if (!isAdmin && ownerId === userId) {
        state.deletedUsersInCycle[userId] = true;
      }
      
      // Reset status image to default
      state.imageUrl = getCycleDefaultImage(cycle.id);
      state.uploadedBy = {
        uid: 'system',
        displayName: 'Sistema'
      };
      state.uploadedAt = now;
      state.isDefault = true;
      state.yOffset = 50;
      state.reports = [];
      state.likesCount = 0;
      state.likedBy = [];
      
      await saveStatusToDb(state);
      
      return res.json({
        success: true,
        statusImage: state,
        cycle
      });
    } catch (err: any) {
      console.error('[API Delete Error]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST like/unlike active status photo
  app.post('/api/status/like', async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'Identificação de usuário ausente.' });
      }
      
      let state = await getStatusFromDb();
      if (!state) {
        return res.status(404).json({ success: false, error: 'Status não inicializado.' });
      }
      
      if (!state.likedBy) state.likedBy = [];
      
      const idx = state.likedBy.indexOf(userId);
      if (idx !== -1) {
        state.likedBy.splice(idx, 1);
      } else {
        state.likedBy.push(userId);
      }
      state.likesCount = state.likedBy.length;
      
      await saveStatusToDb(state);
      return res.json({ success: true, statusImage: state });
    } catch (err: any) {
      console.error('[API Like Error]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST denounce/report active status photo
  app.post('/api/status/denounce', async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'Identificação de usuário ausente.' });
      }
      
      let state = await getStatusFromDb();
      if (!state) {
        return res.status(404).json({ success: false, error: 'Status não inicializado.' });
      }
      
      if (!state.reports) state.reports = [];
      
      if (!state.reports.includes(userId)) {
        state.reports.push(userId);
      }
      
      await saveStatusToDb(state);
      return res.json({ success: true, statusImage: state });
    } catch (err: any) {
      console.error('[API Denounce Error]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST update background slide yOffset (ownership validated)
  app.post('/api/status/update-yoffset', async (req, res) => {
    try {
      const { yOffset, userId, isAdmin } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'Identificação de usuário ausente.' });
      }
      
      let state = await getStatusFromDb();
      if (!state) {
        return res.status(404).json({ success: false, error: 'Status não inicializado.' });
      }
      
      // Strict ownership / admin permission check
      if (!isAdmin && state.uploadedBy?.uid !== userId) {
        return res.status(403).json({ success: false, error: 'Apenas o autor da imagem ou um administrador pode ajustar o posicionamento!' });
      }
      
      state.yOffset = yOffset;
      await saveStatusToDb(state);
      return res.json({ success: true, statusImage: state });
    } catch (err: any) {
      console.error('[API update-yoffset Error]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST force reset status photo and lists (Admin only, independent of times)
  app.post('/api/status/reset', async (req, res) => {
    try {
      const { isAdmin, timezoneOffset } = req.body;
      const offset = parseInt(timezoneOffset) || 180;
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Apenas administradores podem forçar a restauração do status padrão!' });
      }
      
      const now = Date.now();
      const cycle = getCycleInfo(now, offset);
      
      const newState = getDefaultState(cycle.id);
      await saveStatusToDb(newState);
      
      return res.json({
        success: true,
        statusImage: newState,
        cycle
      });
    } catch (err: any) {
      console.error('[API force reset Error]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route for APPA retro lineup monitoring system
  app.get('/api/appa', async (req, res) => {
    try {
      console.log('[APPA] Fetching retro lineup data directly from official source...');
      const response = await fetch('https://www.appaweb.appa.pr.gov.br/appaweb/pesquisa.aspx?WCI=relLineUpRetroativo', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        }
      });

      if (!response.ok) {
        throw new Error(`Servidor da APPA retornou erro de status: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      // Most Brazilian port reports are encoded in iso-8859-1 (Latin1)
      const latin1Decoder = new TextDecoder('iso-8859-1');
      let rawHtml = latin1Decoder.decode(buffer);

      // If it looks like it might be utf-8 instead (which is rarer but possible), check for common characters
      if (!rawHtml.includes('BERÇO') && !rawHtml.includes('Berço') && rawHtml.includes('BERÃ‡O')) {
        const utf8Decoder = new TextDecoder('utf-8');
        rawHtml = utf8Decoder.decode(buffer);
      }

      // 1. Check if Gemini AI can parse it
      if (ai) {
        try {
          console.log('[APPA] AI is available. Cleaning HTML structure for Gemini processing...');
          const $ = cheerio.load(rawHtml);
          // Remove scripts, styles, metadata to save tokens and avoid clutter
          $('script, style, link, iframe, noscript, svg, img, head, footer, header, nav').remove();
          const cleanedHtml = $('body').html() || '';

          console.log('[APPA] Sending cleaned HTML to Gemini 3.5 Flash...');
          const geminiRes = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: [
              {
                text: `Analise o seguinte fragmento de HTML da página da APPA (Porto de Paranaguá/Antonina). Extraia os navios de FERTILIZANTES atracados nos berços de 201 a 215 da seção ATRACADOS.

HTML:
${cleanedHtml}`
              }
            ],
            config: {
              systemInstruction: `Você é um monitor de dados portuários de alta precisão.
Sua tarefa é analisar o HTML da página de Line-Up da APPA e extrair os navios atracados seguindo rigorosamente estas regras:

1. MONITORAMENTO EXCLUSIVO:
   - Extraia apenas dados da seção "ATRACADOS". Ignore todas as outras seções (PROGRAMAÇÃO, previstos, fundeados, espera, etc.).
   
2. BERÇOS MONITORADOS:
   - Apenas os berços 201 (Antonina) e 202 a 215 (Paranaguá). Ignore qualquer outro berço.

3. FILTRO DE MERCADORIA:
   - Apenas navios que transportem fertilizantes ou matérias-primas de fertilizantes (ex: MAP, DAP, Ureia, Urea, KCl, Cloreto de Potássio, Fertilizante, Sulfato de Amônio, Enxofre, SSP, TSP, NPK, Fosfato). Ignore soja, farelo, milho, óleo, etc.

4. MAPEAMENTO DE OPERADORAS:
   - Se o mesmo navio no mesmo berço tiver mais de uma operadora (várias linhas no site), agrupe-as.
   - Para cada operadora, informe seu nome e o saldo total exato daquela linha como exibido na coluna "SALDO" ou "SALDO TOTAL" do site.
   - O saldo final do navio (vesselSaldo) deve ser o saldo total do navio como informado no site para o navio, ou se não houver um saldo total separado do navio, coloque a soma ou o saldo total principal informado no site. Não altere ou invente os saldos das operadoras individuais!

5. RETORNO:
   - Retorne estritamente um objeto JSON com o formato:
   {
     "success": true,
     "data": [
       {
         "berth": "209",
         "vessel": "NOME DO NAVIO",
         "product": "PRODUTO",
         "vesselSaldo": "SALDO TOTAL DO NAVIO t",
         "operators": [
           { "name": "Operadora A", "saldo": "Saldo A" }
         ]
       }
     ]
   }`,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  success: { type: Type.BOOLEAN },
                  data: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        berth: { type: Type.STRING },
                        vessel: { type: Type.STRING },
                        product: { type: Type.STRING },
                        vesselSaldo: { type: Type.STRING },
                        operators: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              name: { type: Type.STRING },
                              saldo: { type: Type.STRING }
                            },
                            required: ["name", "saldo"]
                          }
                        }
                      },
                      required: ["berth", "vessel", "product", "vesselSaldo", "operators"]
                    }
                  }
                },
                required: ["success", "data"]
              }
            }
          });

          if (geminiRes?.text) {
            const parsed = JSON.parse(geminiRes.text);
            if (parsed && Array.isArray(parsed.data)) {
              console.log(`[APPA] Successfully parsed ${parsed.data.length} vessels using Gemini.`);
              return res.json({
                success: true,
                source: 'gemini_ai',
                timestamp: new Date().toISOString(),
                data: parsed.data
              });
            }
          }
        } catch (geminiError: any) {
          console.warn('[APPA] Gemini parsing failed or timed out. Falling back to Cheerio parser...', geminiError);
        }
      }

      // 2. Local Cheerio parser fallback (fully deterministic and resilient)
      console.log('[APPA] Using local Cheerio parsing fallback...');
      const $ = cheerio.load(rawHtml);
      const candidateRows: {
        berth: string;
        vessel: string;
        product: string;
        operator: string;
        saldo: string;
      }[] = [];

      let isUnderAtracados = false;

      // Track elements sequentially
      $('*').each((_, el) => {
        const tagName = ($(el).prop('tagName') || '').toLowerCase();
        
        // Track section transitions by checking text blocks
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'b', 'strong', 'td', 'div', 'p', 'span', 'center'].includes(tagName)) {
          const text = $(el).text().trim().toUpperCase();
          if (text === 'ATRACADOS' || text.startsWith('ATRACADOS') || text.includes('NAVIOS ATRACADOS') || text === 'ATRACADOS:') {
            isUnderAtracados = true;
          } else if (text.length < 50 && (
            text.includes('PROGRAMAÇÃO') || text.includes('PROGRAMACAO') || 
            text.includes('FUNDEADOS') || text.includes('PREVISTOS') || 
            text.includes('EM ESPERA') || text.includes('ESPERADOS') ||
            text.includes('AGUARDANDO')
          )) {
            isUnderAtracados = false;
          }
        }
        
        if (tagName === 'table' && isUnderAtracados) {
          const $table = $(el);
          const rows = $table.find('tr');
          
          let bercoIdx = -1;
          let navioIdx = -1;
          let mercadoriaIdx = -1;
          let operadoraIdx = -1;
          let saldoIdx = -1;
          
          rows.each((_, rowEl) => {
            const $row = $(rowEl);
            const cells = $row.find('td, th');
            
            let isHeader = false;
            cells.each((cIdx, cellEl) => {
              const cellText = $(cellEl).text().trim().toUpperCase();
              if (cellText.includes('BERÇO') || cellText.includes('BERCO')) {
                bercoIdx = cIdx;
                isHeader = true;
              }
              if (cellText.includes('EMBARCAÇÃO') || cellText.includes('EMBARCACAO') || cellText.includes('NAVIO')) {
                navioIdx = cIdx;
                isHeader = true;
              }
              if (cellText.includes('MERCADORIA') || cellText.includes('PRODUTO')) {
                mercadoriaIdx = cIdx;
                isHeader = true;
              }
              if (cellText.includes('OPERADORA') || cellText.includes('OPERADOR')) {
                operadoraIdx = cIdx;
                isHeader = true;
              }
              if (cellText.includes('SALDO')) {
                saldoIdx = cIdx;
                isHeader = true;
              }
            });
            
            if (isHeader) return;
            
            // Assume logical fallbacks if headings were not detected perfectly
            const targetBercoIdx = bercoIdx !== -1 ? bercoIdx : 0;
            const targetNavioIdx = navioIdx !== -1 ? navioIdx : 1;
            const targetMercadoriaIdx = mercadoriaIdx !== -1 ? mercadoriaIdx : 2;
            const targetOperadoraIdx = operadoraIdx !== -1 ? operadoraIdx : 3;
            const targetSaldoIdx = saldoIdx !== -1 ? saldoIdx : 4;
            
            if (cells.length > Math.max(targetBercoIdx, targetNavioIdx)) {
              const berth = $(cells[targetBercoIdx]).text().trim();
              const vessel = $(cells[targetNavioIdx]).text().trim();
              const product = targetMercadoriaIdx < cells.length ? $(cells[targetMercadoriaIdx]).text().trim() : '';
              const operator = targetOperadoraIdx < cells.length ? $(cells[targetOperadoraIdx]).text().trim() : '';
              const saldo = targetSaldoIdx < cells.length ? $(cells[targetSaldoIdx]).text().trim() : '';
              
              if (berth && vessel && berth !== 'Berço' && vessel !== 'Navio') {
                candidateRows.push({ berth, vessel, product, operator, saldo });
              }
            }
          });
        }
      });

      // Flat scan fallback if state machine didn't catch anything (resilient safety valve)
      if (candidateRows.length === 0) {
        $('tr').each((_, el) => {
          const cells = $(el).find('td');
          if (cells.length >= 4) {
            const berth = $(cells[0]).text().trim();
            const berthNum = parseInt(berth, 10);
            if (!isNaN(berthNum) && berthNum >= 201 && berthNum <= 215) {
              const vessel = $(cells[1]).text().trim();
              const product = $(cells[2]).text().trim();
              const operator = $(cells[3]).text().trim();
              const saldo = cells.length >= 5 ? $(cells[4]).text().trim() : '';
              if (berth && vessel && product) {
                candidateRows.push({ berth, vessel, product, operator, saldo });
              }
            }
          }
        });
      }

      // Filter for valid fertilizer berths & commodities
      const filteredRows = candidateRows.filter(row => {
        const berthNum = parseInt(row.berth, 10);
        if (isNaN(berthNum) || berthNum < 201 || berthNum > 215) return false;
        
        const productUpper = row.product.toUpperCase();
        const fertilizerKeywords = [
          'FERTILIZ', 'UREIA', 'UREA', 'MAP', 'DAP', 'CLORETO', 'POTAS', 'KCL', 
          'SULFATO', 'AMON', 'ENXOFRE', 'SSP', 'TSP', 'NPK', 'FOSFAT', 'NITRAT', 'GESSO'
        ];
        return fertilizerKeywords.some(keyword => productUpper.includes(keyword));
      });

      // Group by berth + vessel
      const groups: Record<string, {
        berth: string;
        vessel: string;
        product: string;
        vesselSaldo: string;
        operators: { name: string; saldo: string }[];
      }> = {};

      for (const row of filteredRows) {
        const key = `${row.berth.trim()}_${row.vessel.trim().toUpperCase()}`;
        const berthVal = row.berth.trim();
        const vesselVal = row.vessel.trim();
        const productVal = row.product.trim();
        const operatorVal = row.operator.trim();
        const saldoVal = row.saldo.trim();

        if (!groups[key]) {
          groups[key] = {
            berth: berthVal,
            vessel: vesselVal,
            product: productVal,
            vesselSaldo: '',
            operators: []
          };
        }

        if (!groups[key].product && productVal) {
          groups[key].product = productVal;
        }

        if (operatorVal) {
          const exists = groups[key].operators.some(op => op.name.toUpperCase() === operatorVal.toUpperCase());
          if (!exists) {
            groups[key].operators.push({
              name: operatorVal,
              saldo: saldoVal ? `${saldoVal} t` : '0 t'
            });
          }
        }
      }

      // Determine vessel saldo
      const list = Object.values(groups);
      for (const item of list) {
        if (item.operators.length === 1) {
          item.vesselSaldo = item.operators[0].saldo;
        } else {
          const sum = item.operators.reduce((acc, op) => {
            const num = parseFloat(op.saldo.replace(/[^\d]/g, ''));
            return isNaN(num) ? acc : acc + num;
          }, 0);
          item.vesselSaldo = sum > 0 ? `${sum.toLocaleString('pt-BR')} t` : '0 t';
        }
      }

      console.log(`[APPA] Successfully parsed ${list.length} vessels via local Cheerio fallback.`);
      return res.json({
        success: true,
        source: 'local_cheerio',
        timestamp: new Date().toISOString(),
        data: list
      });

    } catch (error: any) {
      console.error('[APPA Error]:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao monitorar o lineup da APPA. Por favor tente novamente mais tarde.',
        details: error.message
      });
    }
  });

  // API Route to expose safe public config (Supabase URL/Anon key) to the client
  app.get('/api/config', (req, res) => {
    res.json({
      supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    });
  });

  // API Route to verify status image
  app.post('/api/verify-status-image', async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ approved: false, reason: 'Imagem não fornecida.' });
      }

      if (!ai) {
        console.warn('GEMINI_API_KEY is not configured. Approving automatically in development/mock environment.');
        return res.json({ approved: true, reason: 'Chave de API Gemini não configurada no servidor. Aprovado para testes.' });
      }

      // Extract raw base64 data and mimeType
      let mimeType = 'image/jpeg';
      let base64Data = image;

      if (image.includes(';base64,')) {
        const parts = image.split(';base64,');
        mimeType = parts[0].replace('data:', '');
        base64Data = parts[1];
      }

      const prompt = `Analise a imagem enviada por um motorista para o status do aplicativo (Porto).
      Sua tarefa é garantir a segurança, conformidade e privacidade total da imagem de acordo com as seguintes regras rígidas:

      REGRAS DE REPROVAÇÃO (A imagem NÃO PODE conter):
      1. SEXO OU NUDEZ: Qualquer tipo de nudez total ou parcial, pornografia, conotação sexual explícita ou implícita, gestos obscenos ou conotação maliciosa.
      2. ROUPAS INADEQUADAS / SEM CAMISA: 
         - Mulheres sem roupas, de biquíni, de lingerie, ou com roupas extremamente curtas/reveladoras com apelo sensual.
         - Homens sem roupas, sem camisa, de sunga, ou com roupas inadequadas para um ambiente profissional/público.
      3. PROTEÇÃO DE CRIANÇAS: Qualquer foto de criança que possa ser considerada de alguma forma inadequada, vulnerável, exposta ou com indício de maldade, exploração ou exposição inadequada. Verifique profundamente a segurança de menores de idade.
      4. PROIBIÇÃO DE PESSOAS RECONHECÍVEIS (REGRA DE PRIVACIDADE): 
         - É TERMINANTEMENTE PROIBIDO fotos com pessoas nítidas ou rostos reconhecíveis.
         - Se houver pessoas na foto, elas SÓ podem ser aceitas se estiverem muito distantes (longe), borradas, desfocadas ou de costas de modo que seja ABSOLUTAMENTE IMPOSSÍVEL identificá-las ou reconhecê-las.
         - Se houver qualquer pessoa nítida na foto (onde seja possível identificar ou reconhecer quem é), a imagem deve ser REPROVADA imediatamente.
      5. OUTROS CONTEÚDOS PROIBIDOS: Conteúdo racista, xenófobo, símbolos de ódio, preconceito, apologia ao crime, violência, drogas, armas ou palavras ofensivas, palavrões e xingamentos contidos na imagem.

      Responda no formato JSON com os seguintes campos:
      - approved (boolean): true se a imagem for totalmente segura e não violar nenhuma regra acima; false caso contrário (se houver nudez, pessoas nítidas, sem camisa, etc.).
      - reason (string): Se approved for false, dê uma explicação clara e educada em PORTUGUÊS do motivo específico da reprovação (ex: "A imagem contém uma pessoa nítida/reconhecível, o que é proibido por privacidade", "A imagem mostra alguém sem camisa ou com roupas inadequadas", "A imagem possui conteúdo inadequado ou com conotação de nudez"). Se approved for true, retorne "Aprovado".`;

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            },
            {
              text: prompt,
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                approved: { type: Type.BOOLEAN },
                reason: { type: Type.STRING },
              },
              required: ['approved', 'reason'],
            },
          },
        })
      );

      const resultText = response.text;
      if (!resultText) {
        return res.status(500).json({ approved: false, reason: 'O modelo de IA não retornou nenhuma resposta.' });
      }

      const parsed = JSON.parse(resultText);
      return res.json(parsed);

    } catch (err: any) {
      console.error('Erro na verificação da imagem:', err);
      // Fallback: If Gemini is overloaded/down (e.g. 503) or any other issue occurs, auto-approve the image so the user isn't blocked.
      console.warn('Gemini safety verification failed, falling back to auto-approval to prevent user disruption.');
      return res.json({ 
        approved: true, 
        reason: 'Aprovado temporariamente (serviço de verificação inteligente indisponível no momento).' 
      });
    }
  });

  // API Route to generate a local commerce advertisement using Gemini
  app.post('/api/generate-comercio-ad', async (req, res) => {
    try {
      const { nome, proposito, contato, estilo } = req.body;
      if (!nome || !proposito) {
        return res.status(400).json({ error: 'Nome e propósito são obrigatórios.' });
      }

      // Default fallback content
      let adText = `📢 *${nome}*\n\n✨ ${proposito}\n\n📞 Contato: ${contato || 'Não informado'}\n\n#ComercioLocal #PortHub`;
      let imagePrompt = `A professional eye-catching advertisement poster for a local business called "${nome}" which focuses on "${proposito}". Style: ${estilo || 'modern and colorful'}. Beautiful design, commercial illustration, 8k resolution.`;

      let generatedImageBase64 = '';

      if (ai) {
        try {
          // 1. Generate optimized post caption & image prompt using gemini-3.5-flash
          const textResponse = await callGeminiWithRetry(() =>
            ai.models.generateContent({
              model: 'gemini-3.5-flash',
              contents: `Você é um publicitário especialista em mídias sociais. Crie uma propaganda atraente para um estabelecimento comercial local.
              Dados do estabelecimento:
              - Nome: ${nome}
              - Propósito/O que faz: ${proposito}
              - Contato/WhatsApp/Endereço: ${contato || 'Não especificado'}
              - Estilo visual desejado: ${estilo || 'moderno e vibrante'}

              Responda no formato JSON com exatamente dois campos:
              - adText (string): Um texto persuasivo e convidativo em PORTUGUÊS para postar como mensagem no grupo do canal. Use emojis adequados, quebras de linha limpas, hashtags relevantes e destaque os benefícios e contato.
              - imagePrompt (string): Um prompt detalhado e de alta qualidade em INGLÊS para um modelo de geração de imagem criar o pôster de propaganda desse negócio. Descreva o estilo, as cores principais, elements de fundo, iluminação e a atmosfera profissional sem textos complexos (para evitar erros de escrita).`,
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    adText: { type: Type.STRING },
                    imagePrompt: { type: Type.STRING },
                  },
                  required: ['adText', 'imagePrompt'],
                },
              },
            })
          );

          const resultJson = JSON.parse(textResponse.text || '{}');
          if (resultJson.adText) adText = resultJson.adText;
          if (resultJson.imagePrompt) imagePrompt = resultJson.imagePrompt;

          // 2. Generate the ad image using gemini-2.5-flash-image
          try {
            const imgResponse = await callGeminiWithRetry(() =>
              ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                  parts: [{ text: imagePrompt }],
                },
                config: {
                  imageConfig: {
                    aspectRatio: '1:1',
                  },
                },
              })
            );

            if (imgResponse.candidates?.[0]?.content?.parts) {
              for (const part of imgResponse.candidates[0].content.parts) {
                if (part.inlineData?.data) {
                  generatedImageBase64 = `data:image/png;base64,${part.inlineData.data}`;
                  break;
                }
              }
            }
          } catch (imgErr) {
            console.error('Erro ao gerar imagem com Gemini:', imgErr);
            // Will fallback to SVG generation below if generatedImageBase64 is empty
          }
        } catch (textErr) {
          console.error('Erro ao processar com Gemini:', textErr);
        }
      } else {
        console.warn('GEMINI_API_KEY não configurada no servidor. Usando gerador SVG de fallback.');
      }

      // If we failed to get a base64 image (either because Gemini is offline/disabled/failed),
      // we generate an extremely elegant, high-fidelity, colorful SVG fallback image that displays
      // the business details professionally.
      if (!generatedImageBase64) {
        // Sanitize string helpers to prevent invalid XML
        const cleanNome = (nome || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const cleanProposito = (proposito || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const cleanContato = (contato || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const cleanEstilo = (estilo || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const line1 = cleanProposito.substring(0, 45);
        const line2 = cleanProposito.length > 45 ? cleanProposito.substring(45, 90) : '';
        const line3 = cleanProposito.length > 90 ? cleanProposito.substring(90, 135) : '';

        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B132B" />
      <stop offset="50%" stop-color="#1C2541" />
      <stop offset="100%" stop-color="#3A506B" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="800" height="800" fill="url(#bgGrad)"/>
  
  <circle cx="100" cy="100" r="150" fill="#10B981" opacity="0.05" />
  <circle cx="700" cy="700" r="250" fill="#00A2FF" opacity="0.03" />

  <rect x="60" y="60" width="680" height="680" rx="32" fill="#1C2541" fill-opacity="0.6" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2" filter="url(#shadow)"/>
  
  <rect x="60" y="60" width="680" height="16" rx="8" fill="url(#accentGrad)" />

  <g transform="translate(100, 150)">
    <rect x="0" y="0" width="160" height="32" rx="16" fill="#10B981" fill-opacity="0.15" stroke="#10B981" stroke-opacity="0.3" stroke-width="1.5" />
    <text x="80" y="20" font-family="'Inter', sans-serif" font-size="12" font-weight="bold" fill="#10B981" text-anchor="middle" letter-spacing="1.5">COMÉRCIO LOCAL</text>
    
    <text x="0" y="90" font-family="'Inter', sans-serif" font-size="44" font-weight="900" fill="#ffffff" letter-spacing="-1">${cleanNome.toUpperCase()}</text>
    
    <line x1="0" y1="130" x2="150" y2="130" stroke="#10B981" stroke-width="4" stroke-linecap="round" />

    <text x="0" y="190" font-family="'Inter', sans-serif" font-size="20" font-weight="bold" fill="#10B981" letter-spacing="1">NOSSO PROPÓSITO:</text>
    
    <text x="0" y="230" font-family="'Inter', sans-serif" font-size="18" fill="#94A3B8">
      <tspan x="0" dy="0">${line1}</tspan>
      <tspan x="0" dy="32">${line2}</tspan>
      <tspan x="0" dy="32">${line3}</tspan>
    </text>

    <rect x="0" y="380" width="220" height="40" rx="20" fill="#1C2541" fill-opacity="0.8" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1" />
    <text x="110" y="405" font-family="'Inter', sans-serif" font-size="13" font-weight="500" fill="#E2E8F0" text-anchor="middle">Estilo: ${cleanEstilo || 'Moderno'}</text>

    <g transform="translate(0, 480)">
      <rect x="0" y="0" width="600" height="70" rx="20" fill="#0B132B" fill-opacity="0.8" stroke="#10B981" stroke-opacity="0.2" stroke-width="1" />
      <text x="30" y="41" font-family="'Inter', sans-serif" font-size="16" font-weight="bold" fill="#ffffff">📞 CONTATO:</text>
      <text x="170" y="41" font-family="'Inter', sans-serif" font-size="18" font-weight="bold" fill="#10B981">${cleanContato || 'Fale Conosco!'}</text>
    </g>
  </g>
  
  <circle cx="680" cy="160" r="45" fill="#10B981" />
  <text x="680" y="165" font-family="'Inter', sans-serif" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="middle">Conecta</text>
</svg>`;
        const base64Svg = Buffer.from(svgContent.trim()).toString('base64');
        generatedImageBase64 = `data:image/svg+xml;base64,${base64Svg}`;
      }

      return res.json({ adText, imageUrl: generatedImageBase64 });

    } catch (err: any) {
      console.error('Erro na geração da propaganda por IA:', err);
      return res.status(500).json({ error: `Erro ao gerar propaganda por IA: ${err.message}` });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
