import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Health endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'clearcut-bg-remover' });
});

// Proxy Image endpoint for sample images to bypass browser CORS restrictions
app.get('/api/proxy-image', async (req: Request, res: Response) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Missing url query parameter' });
    }

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch remote image' });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('Proxy image error:', err);
    return res.status(500).json({ error: 'Could not proxy image', details: err.message });
  }
});

// Background Removal Endpoint with Multi-Tier Reliability
app.post('/api/remove-background', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file && !req.body.image) {
      return res.status(400).json({ error: 'No image file or data provided.' });
    }

    let fileBuffer: Buffer;
    let fileName: string = 'image.png';
    let mimeType: string = 'image/png';

    if (req.file) {
      fileBuffer = req.file.buffer;
      fileName = req.file.originalname || 'upload.png';
      mimeType = req.file.mimetype || 'image/png';
    } else {
      // Handle base64 payload
      const base64Data = req.body.image.replace(/^data:image\/\w+;base64,/, '');
      fileBuffer = Buffer.from(base64Data, 'base64');
      if (req.body.fileName) fileName = req.body.fileName;
      if (req.body.mimeType) mimeType = req.body.mimeType;
    }

    // TIER 1: Primary ClearCut API
    try {
      const endpoint = 'https://tabish1021-clearcut-api.hf.space/api/remove-background';
      const formData = new FormData();
      formData.append('format', 'png');

      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append('file', blob, fileName);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000); // 35 sec timeout

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', 'inline; filename="clearcut_nobg.png"');
        return res.send(buffer);
      }
      console.warn(`Primary ClearCut API returned status ${response.status}. Attempting fallback...`);
    } catch (primaryErr: any) {
      console.warn('Primary ClearCut API failed or timed out:', primaryErr.message);
    }

    // TIER 2: Gemini AI Background Isolation if GEMINI_API_KEY is available
    const gemini = getGeminiClient();
    if (gemini) {
      try {
        console.log('Attempting Gemini AI background removal...');
        const aiResponse = await gemini.models.generateContent({
          model: 'gemini-3.1-flash-image',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: 'Isolate and extract the main subject from this image with a completely transparent background (PNG alpha channel). Preserve the original subject cleanly with antialiased edges.',
                },
                {
                  inlineData: {
                    data: fileBuffer.toString('base64'),
                    mimeType: mimeType.startsWith('image/') ? mimeType : 'image/png',
                  },
                },
              ],
            },
          ],
        });

        for (const candidate of aiResponse.candidates || []) {
          for (const part of candidate.content?.parts || []) {
            if (part.inlineData?.data) {
              const resultBuf = Buffer.from(part.inlineData.data, 'base64');
              res.setHeader('Content-Type', 'image/png');
              res.setHeader('Content-Disposition', 'inline; filename="clearcut_nobg.png"');
              return res.send(resultBuf);
            }
          }
        }
      } catch (geminiErr: any) {
        console.warn('Gemini AI fallback failed:', geminiErr.message);
      }
    }

    // TIER 3: Tell client to run client-side background segmentation fallback
    return res.status(200).json({
      fallbackRequired: true,
      message: 'Processing with accelerated client-side neural matting.',
    });

  } catch (err: any) {
    console.error('Error removing background:', err);
    return res.status(500).json({
      error: 'Could not process background removal.',
      details: err.message,
    });
  }
});


// Setup Vite or static serving
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClearCut app running at http://0.0.0.0:${PORT}`);
  });
}

start();
