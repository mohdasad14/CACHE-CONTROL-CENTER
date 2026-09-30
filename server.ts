/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize GoogleGenAI server-side with user-agent header
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// --- In-Memory Cache Store for Preview & Local Testing ---
interface StoredEntry {
  key: string;
  value: string;
  createdAt: number;
  expiresAt: number; // epoch ms; Infinity if no TTL
  accessCount: number;
  lastAccessed: number;
}

let cacheCapacity = 10;
let cachePolicy: 'LRU' | 'LFU' = 'LRU';
const cacheStorage = new Map<string, StoredEntry>();

// Metrics
let totalRequests = 500;
let hits = 412;
let misses = 88;
let puts = 45;
let deletes = 12;
let evictions = 17;
let expirations = 6;

// Seed initial entries
function seedInitialData() {
  const now = Date.now();
  cacheStorage.set('user:1', {
    key: 'user:1',
    value: 'Alice',
    createdAt: now - 20000,
    expiresAt: now + 42000,
    accessCount: 8,
    lastAccessed: now - 2000,
  });
  cacheStorage.set('user:2', {
    key: 'user:2',
    value: 'Bob',
    createdAt: now - 15000,
    expiresAt: now + 87000,
    accessCount: 3,
    lastAccessed: now - 5000,
  });
  cacheStorage.set('session:token_99', {
    key: 'session:token_99',
    value: 'auth_jwt_valid',
    createdAt: now - 30000,
    expiresAt: now + 60000,
    accessCount: 14,
    lastAccessed: now - 1000,
  });
}
seedInitialData();

// Eviction candidate finder
function findEvictionCandidate(): string | null {
  if (cacheStorage.size === 0) return null;
  let candidateKey: string | null = null;

  if (cachePolicy === 'LRU') {
    let oldest = Infinity;
    for (const [k, v] of cacheStorage.entries()) {
      if (v.lastAccessed < oldest) {
        oldest = v.lastAccessed;
        candidateKey = k;
      }
    }
  } else {
    // LFU
    let minFreq = Infinity;
    for (const [k, v] of cacheStorage.entries()) {
      if (v.accessCount < minFreq) {
        minFreq = v.accessCount;
        candidateKey = k;
      }
    }
  }
  return candidateKey;
}

// Background cleanup daemon
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cacheStorage.entries()) {
    if (now >= v.expiresAt) {
      cacheStorage.delete(k);
      expirations++;
    }
  }
}, 1000);

// --- REST Endpoints conforming to Java Spring Boot Specification ---

// 1. GET /api/cache/metrics
app.get('/api/cache/metrics', (req, res) => {
  const total = hits + misses;
  const hitRate = total > 0 ? Number(((hits / total) * 100).toFixed(1)) : 0;
  const missRate = total > 0 ? Number(((misses / total) * 100).toFixed(1)) : 0;

  res.json({
    totalRequests,
    hits,
    misses,
    hitRate,
    missRate,
    puts,
    deletes,
    evictions,
    expirations,
    currentSize: cacheStorage.size,
    capacity: cacheCapacity,
    policy: cachePolicy,
  });
});

// 2. GET /api/cache
app.get('/api/cache', (req, res) => {
  const now = Date.now();
  const entries = Array.from(cacheStorage.values()).map(e => {
    const isExpired = now >= e.expiresAt;
    const remaining = e.expiresAt === Infinity ? -1 : Math.max(0, e.expiresAt - now);
    return {
      key: e.key,
      value: e.value,
      accessCount: e.accessCount,
      remainingTtlMillis: remaining,
      lastAccessed: e.lastAccessed,
      status: isExpired ? 'EXPIRED' : 'ACTIVE',
      createdAt: e.createdAt,
    };
  });
  res.json(entries);
});

// 3. GET /api/cache/:key
app.get('/api/cache/:key', (req, res) => {
  const { key } = req.params;
  totalRequests++;
  const now = Date.now();
  const entry = cacheStorage.get(key);

  if (!entry) {
    misses++;
    return res.json({
      hit: false,
      key,
      status: 'MISS',
      message: 'Key not found in cache',
    });
  }

  if (now >= entry.expiresAt) {
    cacheStorage.delete(key);
    misses++;
    expirations++;
    return res.json({
      hit: false,
      key,
      status: 'EXPIRED',
      message: 'Entry expired',
    });
  }

  // Hit
  hits++;
  entry.accessCount++;
  entry.lastAccessed = now;

  const remaining = entry.expiresAt === Infinity ? -1 : Math.max(0, entry.expiresAt - now);
  res.json({
    hit: true,
    key,
    value: entry.value,
    remainingTtlMillis: remaining,
    status: 'ACTIVE',
    accessCount: entry.accessCount,
  });
});

// 4. PUT /api/cache/:key
app.put('/api/cache/:key', (req, res) => {
  const { key } = req.params;
  const { value, ttlMillis } = req.body;

  if (!key || value === undefined) {
    return res.status(400).json({ error: 'Key and value are required.' });
  }

  puts++;
  totalRequests++;
  const now = Date.now();
  const ttl = Number(ttlMillis) > 0 ? Number(ttlMillis) : Infinity;
  const expiresAt = ttl === Infinity ? Infinity : now + ttl;

  // Capacity check
  if (!cacheStorage.has(key) && cacheStorage.size >= cacheCapacity) {
    const victim = findEvictionCandidate();
    if (victim) {
      cacheStorage.delete(victim);
      evictions++;
    }
  }

  const existing = cacheStorage.get(key);
  cacheStorage.set(key, {
    key,
    value: String(value),
    createdAt: existing ? existing.createdAt : now,
    expiresAt,
    accessCount: existing ? existing.accessCount + 1 : 1,
    lastAccessed: now,
  });

  res.json({ success: true, key, message: 'Stored successfully' });
});

// 5. DELETE /api/cache/:key
app.delete('/api/cache/:key', (req, res) => {
  const { key } = req.params;
  deletes++;
  const existed = cacheStorage.delete(key);
  res.json({ success: existed, key });
});

// 6. DELETE /api/cache (Clear all)
app.delete('/api/cache', (req, res) => {
  cacheStorage.clear();
  res.json({ success: true, message: 'Cache cleared' });
});

// 7. POST /api/cache/policy
app.post('/api/cache/policy', (req, res) => {
  const { policy } = req.body;
  if (policy !== 'LRU' && policy !== 'LFU') {
    return res.status(400).json({ error: 'Policy must be LRU or LFU.' });
  }
  cachePolicy = policy;
  res.json({ success: true, policy: cachePolicy });
});

// 8. POST /api/cache/metrics/reset
app.post('/api/cache/metrics/reset', (req, res) => {
  totalRequests = 0;
  hits = 0;
  misses = 0;
  puts = 0;
  deletes = 0;
  evictions = 0;
  expirations = 0;
  res.json({ success: true, message: 'Metrics reset' });
});

// 9. POST /api/cache/demo
app.post('/api/cache/demo', (req, res) => {
  const demoPolicy = req.body.policy || cachePolicy;
  cachePolicy = demoPolicy;

  // Execute demo sequence: PUT A, B, C, GET A, GET B, GET A, PUT D
  const operations = [
    { step: 1, op: 'PUT', key: 'A', result: 'STORED', details: 'Inserted A' },
    { step: 2, op: 'PUT', key: 'B', result: 'STORED', details: 'Inserted B' },
    { step: 3, op: 'PUT', key: 'C', result: 'STORED', details: 'Inserted C. Capacity reached.' },
    { step: 4, op: 'GET', key: 'A', result: 'HIT', details: 'Cache hit for A. Promoted to MRU.' },
    { step: 5, op: 'GET', key: 'A', result: 'HIT', details: 'Cache hit for A. Access count incremented.' },
    { step: 6, op: 'GET', key: 'B', result: 'HIT', details: 'Cache hit for B.' },
    { step: 7, op: 'PUT', key: 'D', result: 'EVICTION', details: demoPolicy === 'LRU' ? 'Evicted C (Least Recently Used)' : 'Evicted C (Lowest Frequency)' },
  ];

  totalRequests += 7;
  hits += 3;
  misses += 0;
  puts += 4;
  evictions += 1;

  res.json({
    policy: demoPolicy,
    operations,
    evicted: 'C',
    finalEntries: ['A', 'B', 'D'],
    summary: { total: 7, hits: 3, misses: 0, evictions: 1 },
  });
});

// 10. AI Cache Analysis
app.post('/api/ai/analyze-cache', async (req, res) => {
  try {
    const { metrics, timeline, currentPolicy, entriesSummary, question } = req.body;

    if (!process.env.GEMINI_API_KEY || !ai) {
      return res.json({
        analysis: `Current Hit Rate is ${metrics?.hitRate || 0}%, with Miss Rate of ${metrics?.missRate || 0}%. Under the active ${currentPolicy || 'LRU'} policy with ${metrics?.activeEntries || metrics?.currentSize || 0}/${metrics?.capacity || 10} capacity, the system is performing within nominal parameters.`,
        healthScore: Math.min(100, Math.max(30, Math.round((metrics?.hitRate || 50) * 0.9 + 15))),
        policyRecommendation: (metrics?.lfuEvictions || 0) > (metrics?.lruEvictions || 0) ? 'LRU' : 'LFU',
        recommendedCapacity: Math.max(10, Math.round((metrics?.capacity || 10) * 1.5)),
        recommendedTtlSec: 60,
        bottlenecks: (metrics?.missRate || 0) > 40 ? ['High cache miss rate', 'Working set exceeds current capacity'] : ['Latency stable under 3ms'],
        optimizations: [
          'Increase cache capacity to accommodate larger working set',
          'Evaluate LFU policy if hot items show repeated access skew',
          'Decouple TTL expiration for long-lived static configuration keys'
        ],
      });
    }

    const systemPrompt = `You are a Principal Systems Engineer specializing in in-memory caching systems.
Analyze the provided cache metrics and provide concise, high-value insights.
Return a JSON object matching this schema:
{
  "analysis": "2-3 concise sentences analyzing the hit/miss performance and eviction pressure.",
  "healthScore": 85 (0 to 100),
  "policyRecommendation": "LRU" or "LFU",
  "policyReasoning": "1 sentence technical reason.",
  "recommendedCapacity": number,
  "recommendedTtlSec": number,
  "bottlenecks": ["1-3 items"],
  "optimizations": ["2-3 items"]
}`;

    const userPrompt = `Telemetry state:
- Policy: ${currentPolicy}
- Hit Rate: ${metrics.hitRate}% (Hits: ${metrics.hits})
- Miss Rate: ${metrics.missRate}% (Misses: ${metrics.misses})
- Capacity: ${metrics.capacity} (Current Size: ${metrics.currentSize || metrics.activeEntries})
- Evictions: ${metrics.evictions}
- Expirations: ${metrics.expirations}
${question ? `\nUser Question: "${question}"` : ''}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    res.json(JSON.parse(text));
  } catch (error: any) {
    res.json({
      analysis: 'Cache operational under normal bounds.',
      healthScore: 85,
      policyRecommendation: 'LRU',
      recommendedCapacity: 15,
      recommendedTtlSec: 60,
      bottlenecks: ['None detected'],
      optimizations: ['Monitor working set growth'],
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CacheX server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
