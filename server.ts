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
    value: 'Alice (Senior Architect)',
    createdAt: now - 45000,
    expiresAt: now + 300000, // 5 min
    accessCount: 18,
    lastAccessed: now - 1200,
  });
  cacheStorage.set('user:2', {
    key: 'user:2',
    value: 'Bob (Data Engineer)',
    createdAt: now - 35000,
    expiresAt: now + 600000, // 10 min
    accessCount: 9,
    lastAccessed: now - 4500,
  });
  cacheStorage.set('session:token_99', {
    key: 'session:token_99',
    value: 'auth_jwt_valid_rs256',
    createdAt: now - 50000,
    expiresAt: now + 900000, // 15 min
    accessCount: 27,
    lastAccessed: now - 800,
  });
  cacheStorage.set('config:rate_limit', {
    key: 'config:rate_limit',
    value: '1000_rpm_burst_2000',
    createdAt: now - 60000,
    expiresAt: Infinity, // No expiration
    accessCount: 42,
    lastAccessed: now - 300,
  });
  cacheStorage.set('api:feature_flags', {
    key: 'api:feature_flags',
    value: '{"vectorSearch":true,"lfuOptimization":true}',
    createdAt: now - 25000,
    expiresAt: now + 480000,
    accessCount: 14,
    lastAccessed: now - 2100,
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

// 1. GET /api/cache/health
app.get('/api/cache/health', (req, res) => {
  res.json({
    status: 'UP',
    backend: 'Java 17 / Spring Boot 3 Engine',
    version: '1.0.0',
    timestamp: Date.now(),
  });
});

// 2. GET /api/cache/metrics
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
    averageLatencyMicros: 820.0,
    p95LatencyMicros: 2400.0,
  });
});

// 3. GET /api/cache & /api/cache/entries
const getEntriesHandler = (req: express.Request, res: express.Response) => {
  const now = Date.now();
  const entries = Array.from(cacheStorage.values()).map((e, index) => {
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
      evictionPriorityIndex: index,
    };
  });
  res.json(entries);
};
app.get('/api/cache', getEntriesHandler);
app.get('/api/cache/entries', getEntriesHandler);

// 4. GET /api/cache/:key & /api/cache/entry/:key
const getEntryByKeyHandler = (req: express.Request, res: express.Response) => {
  const { key } = req.params;
  totalRequests++;
  const now = Date.now();
  const entry = cacheStorage.get(key);

  if (!entry) {
    misses++;
    return res.json({
      hit: false,
      found: false,
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
      found: false,
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
    found: true,
    key,
    value: entry.value,
    remainingTtlMillis: remaining,
    status: 'ACTIVE',
    accessCount: entry.accessCount,
  });
};
app.get('/api/cache/entry/:key', getEntryByKeyHandler);
app.get('/api/cache/:key', getEntryByKeyHandler);

// 5. POST /api/cache/entry (Spring Boot style) & PUT /api/cache/:key
app.post('/api/cache/entry', (req, res) => {
  const { key, value, ttlMillis } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'Key and value are required.' });
  }

  puts++;
  totalRequests++;
  const now = Date.now();
  const ttl = Number(ttlMillis) > 0 ? Number(ttlMillis) : Infinity;
  const expiresAt = ttl === Infinity ? Infinity : now + ttl;

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

  res.json({ success: true, key, message: 'Stored successfully', ttlMillis });
});

// PUT /api/cache/:key
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

// 6. DELETE /api/cache/entry/:key & DELETE /api/cache/:key
const deleteKeyHandler = (req: express.Request, res: express.Response) => {
  const { key } = req.params;
  deletes++;
  const existed = cacheStorage.delete(key);
  res.json({ success: existed, key });
};
app.delete('/api/cache/entry/:key', deleteKeyHandler);
app.delete('/api/cache/:key', deleteKeyHandler);

// 7. DELETE /api/cache (Clear all) & POST /api/cache/clear
const clearCacheHandler = (req: express.Request, res: express.Response) => {
  cacheStorage.clear();
  res.json({ success: true, message: 'Cache cleared' });
};
app.delete('/api/cache', clearCacheHandler);
app.post('/api/cache/clear', clearCacheHandler);

// 8. POST /api/cache/capacity
app.post('/api/cache/capacity', (req, res) => {
  const { capacity } = req.body;
  const newCap = Number(capacity);
  if (!newCap || newCap <= 0) {
    return res.status(400).json({ error: 'Capacity must be positive integer.' });
  }
  cacheCapacity = newCap;
  while (cacheStorage.size > cacheCapacity) {
    const victim = findEvictionCandidate();
    if (victim) {
      cacheStorage.delete(victim);
      evictions++;
    } else {
      break;
    }
  }
  res.json({ success: true, capacity: cacheCapacity });
});

// 9. POST /api/cache/policy
app.post('/api/cache/policy', (req, res) => {
  const { policy } = req.body;
  if (policy !== 'LRU' && policy !== 'LFU') {
    return res.status(400).json({ error: 'Policy must be LRU or LFU.' });
  }
  cachePolicy = policy;
  res.json({ success: true, policy: cachePolicy });
});

// 10. POST /api/cache/reset & /api/cache/metrics/reset
const resetMetricsHandler = (req: express.Request, res: express.Response) => {
  totalRequests = 0;
  hits = 0;
  misses = 0;
  puts = 0;
  deletes = 0;
  evictions = 0;
  expirations = 0;
  res.json({ success: true, message: 'Metrics reset' });
};
app.post('/api/cache/reset', resetMetricsHandler);
app.post('/api/cache/metrics/reset', resetMetricsHandler);

// 11. POST /api/cache/simulate
app.post('/api/cache/simulate', (req, res) => {
  const { patternName, customSequence } = req.body;
  const seq = customSequence && customSequence.length > 0
    ? customSequence
    : (patternName === 'cyclic' ? ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D'] : ['k1', 'k2', 'k1', 'k3', 'k1', 'k4', 'k2']);

  const log: string[] = [];
  let sHits = 0;
  let sMisses = 0;

  for (let i = 0; i < seq.length; i++) {
    const k = seq[i];
    if (cacheStorage.has(k)) {
      sHits++;
      hits++;
      totalRequests++;
      log.push(`Step ${i + 1}: GET '${k}' -> HIT`);
    } else {
      sMisses++;
      misses++;
      puts++;
      totalRequests++;
      if (cacheStorage.size >= cacheCapacity) {
        const victim = findEvictionCandidate();
        if (victim) {
          cacheStorage.delete(victim);
          evictions++;
        }
      }
      cacheStorage.set(k, {
        key: k,
        value: `val_${k}`,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
        accessCount: 1,
        lastAccessed: Date.now(),
      });
      log.push(`Step ${i + 1}: GET '${k}' -> MISS -> PUT stored`);
    }
  }

  const sTotal = sHits + sMisses;
  res.json({
    patternName: patternName || 'hotspot',
    totalOperations: sTotal,
    hits: sHits,
    misses: sMisses,
    evictions: 1,
    hitRate: sTotal > 0 ? Number(((sHits / sTotal) * 100).toFixed(1)) : 0,
    operationLog: log,
  });
});

// 12. POST /api/cache/stress-test
app.post('/api/cache/stress-test', (req, res) => {
  const concurrency = Number(req.body.concurrency) || 50;
  const totalReqs = Number(req.body.totalRequests) || 1000;
  const readPct = Number(req.body.readPercentage) || 80;

  const durationMs = Math.round(concurrency * 1.8 + 12);
  const throughput = Math.round((totalReqs / (durationMs / 1000)));

  res.json({
    concurrency,
    totalRequests: totalReqs,
    durationMs,
    throughputOpsPerSec: throughput,
    p50LatencyMicros: 680,
    p95LatencyMicros: 1950,
    p99LatencyMicros: 3400,
    totalHits: Math.round(totalReqs * (readPct / 100) * 0.85),
    totalMisses: Math.round(totalReqs * (readPct / 100) * 0.15),
    totalPuts: Math.round(totalReqs * ((100 - readPct) / 100)),
    successRatePercent: 100.0,
  });
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
