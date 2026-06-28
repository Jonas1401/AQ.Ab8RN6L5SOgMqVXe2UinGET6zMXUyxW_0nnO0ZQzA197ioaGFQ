/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

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

      const prompt = `Analise a imagem enviada por um motorista para o status do porto.
      Sua tarefa é garantir a segurança e conformidade da imagem.
      A imagem NÃO PODE conter:
      1. Nudez, pornografia, conotação sexual ou qualquer conteúdo sexual explícito ou implícito (sexo).
      2. Conteúdo racista, xenófobo, símbolos de ódio, preconceito ou apologia ao racismo/discriminação (racismo).
      3. Palavras ofensivas, palavrões, xingamentos, calúnias ou textos racistas/sexuais contidos na imagem (palavras ofensivas/inadequadas).

      Responda no formato JSON com os seguintes campos:
      - approved (boolean): true se a imagem for totalmente segura e não violar nenhuma regra acima; false caso contrário.
      - reason (string): Se approved for false, dê uma breve explicação em PORTUGUÊS do motivo da reprovação (ex: "A imagem contém nudez", "A imagem possui símbolos ou textos de cunho racista", "A imagem apresenta palavrões/linguagem ofensiva"). Se approved for true, pode ficar vazio ou ser "Aprovado".`;

      const response = await ai.models.generateContent({
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
      });

      const resultText = response.text;
      if (!resultText) {
        return res.status(500).json({ approved: false, reason: 'O modelo de IA não retornou nenhuma resposta.' });
      }

      const parsed = JSON.parse(resultText);
      return res.json(parsed);

    } catch (err: any) {
      console.error('Erro na verificação da imagem:', err);
      return res.status(500).json({ approved: false, reason: `Erro ao processar imagem pela IA: ${err.message}` });
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
      let adText = `📢 *${nome}*\n\n✨ ${proposito}\n\n📞 Contato: ${contato || 'Não informado'}\n\n#ComercioLocal #PortoConecta`;
      let imagePrompt = `A professional eye-catching advertisement poster for a local business called "${nome}" which focuses on "${proposito}". Style: ${estilo || 'modern and colorful'}. Beautiful design, commercial illustration, 8k resolution.`;

      let generatedImageBase64 = '';

      if (ai) {
        try {
          // 1. Generate optimized post caption & image prompt using gemini-3.5-flash
          const textResponse = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: `Você é um publicitário especialista em mídias sociais. Crie uma propaganda atraente para um estabelecimento comercial local.
            Dados do estabelecimento:
            - Nome: ${nome}
            - Propósito/O que faz: ${proposito}
            - Contato/WhatsApp/Endereço: ${contato || 'Não especificado'}
            - Estilo visual desejado: ${estilo || 'moderno e vibrante'}

            Responda no formato JSON com exatamente dois campos:
            - adText (string): Um texto persuasivo e convidativo em PORTUGUÊS para postar como mensagem no grupo do canal. Use emojis adequados, quebras de linha limpas, hashtags relevantes e destaque os benefícios e contato.
            - imagePrompt (string): Um prompt detalhado e de alta qualidade em INGLÊS para um modelo de geração de imagem criar o pôster de propaganda desse negócio. Descreva o estilo, as cores principais, elementos de fundo, iluminação e a atmosfera profissional sem textos complexos (para evitar erros de escrita).`,
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
          });

          const resultJson = JSON.parse(textResponse.text || '{}');
          if (resultJson.adText) adText = resultJson.adText;
          if (resultJson.imagePrompt) imagePrompt = resultJson.imagePrompt;

          // 2. Generate the ad image using gemini-2.5-flash-image
          try {
            const imgResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: {
                parts: [{ text: imagePrompt }],
              },
              config: {
                imageConfig: {
                  aspectRatio: '1:1',
                },
              },
            });

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
