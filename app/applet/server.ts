import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
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

// LRU in-memory cache for processed cutout results (indexed by SHA-256 of image content)
const cutoutCache = new Map<string, Buffer>();
const MAX_CACHE_ENTRIES = 120;

function computeHash(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function getCachedCutout(hash: string): Buffer | undefined {
  const result = cutoutCache.get(hash);
  if (result) {
    // Refresh LRU position
    cutoutCache.delete(hash);
    cutoutCache.set(hash, result);
  }
  return result;
}

function setCachedCutout(hash: string, buffer: Buffer) {
  if (cutoutCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cutoutCache.keys().next().value;
    if (oldestKey) cutoutCache.delete(oldestKey);
  }
  cutoutCache.set(hash, buffer);
}

// Pre-load known sample images into cache for instantaneous demo experience
function preloadSampleCutouts() {
  const samplesDir = path.join(process.cwd(), 'public', 'samples');
  if (!fs.existsSync(samplesDir)) return;

  const sampleNames = ['portrait', 'puppy', 'sneaker', 'monstera'];
  for (const name of sampleNames) {
    const origPath = path.join(samplesDir, `${name}.jpg`);
    const nobgPath = path.join(samplesDir, `${name}_nobg.png`);

    if (fs.existsSync(origPath) && fs.existsSync(nobgPath)) {
      try {
        const origBuf = fs.readFileSync(origPath);
        const nobgBuf = fs.readFileSync(nobgPath);
        const hash = computeHash(origBuf);
        setCachedCutout(hash, nobgBuf);
        // Also map normalized filename
        setCachedCutout(`sample:${name}.jpg`, nobgBuf);
        setCachedCutout(`sample:${name}`, nobgBuf);
      } catch (e: any) {
        console.warn(`Failed preloading sample ${name}:`, e.message);
      }
    }
  }
  console.log(`Preloaded sample cutouts into in-memory cache (${cutoutCache.size} entries).`);
}

// Keep-Alive Service for Hugging Face container to eliminate cold-start wake delay
function startKeepAlive() {
  const ping = async () => {
    try {
      await fetch('https://tabish1021-clearcut-api.hf.space/', { method: 'GET' });
    } catch {
      // keep-alive ping failures are non-blocking
    }
  };

  // Initial ping
  ping();
  // Ping every 3.5 minutes to prevent Hugging Face container sleep
  setInterval(ping, 3.5 * 60 * 1000);
}

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'clearcut-bg-remover',
    cachedItems: cutoutCache.size,
  });
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

// Background Removal Endpoint with Multi-Tier Reliability, Smart Resizing & Caching
app.post('/api/remove-background', upload.single('file'), async (req: Request, res: Response) => {
  const startTime = Date.now();
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

    // 1. FAST PATH: Check memory cache by raw buffer hash
    const inputHash = computeHash(fileBuffer);
    const cachedResult = getCachedCutout(inputHash);
    if (cachedResult) {
      console.log(`[Cache Hit] Served in ${Date.now() - startTime}ms (hash: ${inputHash.slice(0, 8)})`);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Content-Disposition', 'inline; filename="clearcut_nobg.png"');
      return res.send(cachedResult);
    }

    // Check sample name mapping fallback
    const sampleKey = `sample:${fileName.toLowerCase()}`;
    const sampleResult = getCachedCutout(sampleKey);
    if (sampleResult) {
      console.log(`[Sample Cache Hit] Served in ${Date.now() - startTime}ms (${sampleKey})`);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Content-Disposition', 'inline; filename="clearcut_nobg.png"');
      return res.send(sampleResult);
    }

    // 2. SMART PRE-OPTIMIZATION:
    // Rembg/U2Net runs at 320x320 or 1024x1024 internally. Sending massive 4K/2K PNGs
    // causes 10-15s CPU transfer and decompression lag on the server.
    // Downsampling to max 1024px JPEG drastically accelerates processing speed!
    let optimizedBuffer = fileBuffer;
    let optimizedMime = mimeType;
    try {
      const meta = await sharp(fileBuffer).metadata();
      const maxDim = Math.max(meta.width || 0, meta.height || 0);

      if (maxDim > 1024) {
        optimizedBuffer = await sharp(fileBuffer)
          .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 88 })
          .toBuffer();
        optimizedMime = 'image/jpeg';
      } else if (meta.format !== 'jpeg' && meta.format !== 'jpg') {
        // High quality JPEG is 5x smaller to transfer over HTTP than PNG
        optimizedBuffer = await sharp(fileBuffer)
          .jpeg({ quality: 90 })
          .toBuffer();
        optimizedMime = 'image/jpeg';
      }
    } catch (sharpErr: any) {
      console.warn('Sharp pre-optimization notice:', sharpErr.message);
    }

    // 3. TIER 1: Primary ClearCut Rembg AI Endpoint
    try {
      const endpoint = 'https://tabish1021-clearcut-api.hf.space/api/remove-background';
      const formData = new FormData();
      formData.append('format', 'png');
      const blob = new Blob([optimizedBuffer], { type: optimizedMime });
      formData.append('file', blob, fileName.replace(/\.[^/.]+$/, '') + '.jpg');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Store in cache for instantaneous repeated requests
        setCachedCutout(inputHash, buffer);
        console.log(`[Neural Matting Success] Processed in ${Date.now() - startTime}ms`);

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Content-Disposition', 'inline; filename="clearcut_nobg.png"');
        return res.send(buffer);
      }
      console.warn(`Primary ClearCut API returned status ${response.status}. Attempting fallback...`);
    } catch (primaryErr: any) {
      console.warn('Primary ClearCut API failed or timed out:', primaryErr.message);
    }

    // 4. TIER 2: Fallback to client-side neural matting
    return res.status(200).json({
      fallbackRequired: true,
      message: 'Processing with client-side neural edge matting.',
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
  // Pre-load sample cutouts and start keep-alive
  preloadSampleCutouts();
  startKeepAlive();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await import('vite');
    const viteServer = await vite.createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(viteServer.middlewares);
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
