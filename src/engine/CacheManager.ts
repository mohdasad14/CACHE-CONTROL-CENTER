/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EvictionPolicy, LRUPolicy, LFUPolicy } from './EvictionPolicy';
import { CacheEntry, CacheEvent, CacheMetrics, OperationType, OperationResult, PolicyType, TimelinePoint } from '../types/cache';

export interface CacheManagerOptions {
  capacity?: number;
  defaultTtlSec?: number;
  policy?: PolicyType;
  enableActiveCleanup?: boolean;
}

export type CacheChangeListener = () => void;

/**
 * CacheManager implements a thread-safe, high-concurrency in-memory cache
 * modeled after enterprise Java caching libraries (Guava / Caffeine / Hazelcast).
 *
 * Highlights:
 * 1. Pluggable Eviction: LRU (Doubly-Linked List) vs LFU (Frequency Sets)
 * 2. Independent TTL: Expiration runs independently of eviction rules
 * 3. Concurrency Lock Simulation: ReentrantReadWriteLock telemetry & contention
 * 4. Microsecond Latency Tracking & Percentile calculation (P95, P99)
 */
export class CacheManager<K = string, V = unknown> {
  private capacity: number;
  private defaultTtlMs: number;
  private storage: Map<K, CacheEntry<K, V>> = new Map();
  private evictionPolicy: EvictionPolicy<K>;
  private lruPolicy: LRUPolicy<K>;
  private lfuPolicy: LFUPolicy<K>;

  // Metrics counters
  private totalRequests: number = 0;
  private hits: number = 0;
  private misses: number = 0;
  private puts: number = 0;
  private evictions: number = 0;
  private expirations: number = 0;
  private lruEvictions: number = 0;
  private lfuEvictions: number = 0;

  // Latency samples (rolling array of last 200 operations)
  private getLatencies: number[] = [];
  private putLatencies: number[] = [];

  // Lock telemetry simulation
  private readLockCount: number = 0;
  private writeLockCount: number = 0;
  private lockContentionCount: number = 0;

  // Event log ring buffer
  private eventLog: CacheEvent[] = [];
  private readonly MAX_EVENT_LOG = 100;

  // Timeline history
  private timeline: TimelinePoint[] = [];
  private readonly MAX_TIMELINE_POINTS = 50;

  // Subscriptions
  private listeners: Set<CacheChangeListener> = new Set();

  // Active TTL cleaner timer
  private cleanupTimerId: number | null = null;

  // Ops per second rate tracking
  private opsInWindow: number = 0;
  private lastRateCheckTime: number = Date.now();
  private currentOpsPerSec: number = 0;

  constructor(options: CacheManagerOptions = {}) {
    this.capacity = options.capacity ?? 10;
    this.defaultTtlMs = (options.defaultTtlSec ?? 60) * 1000;

    this.lruPolicy = new LRUPolicy<K>();
    this.lfuPolicy = new LFUPolicy<K>();

    const initialPolicy = options.policy ?? 'LRU';
    this.evictionPolicy = initialPolicy === 'LRU' ? this.lruPolicy : this.lfuPolicy;

    if (options.enableActiveCleanup !== false) {
      this.startActiveCleanup();
    }

    // Seed initial timeline point
    this.recordTimelineSlice();
  }

  // --- Core Cache Operations ---

  /**
   * Thread-safe GET operation.
   * Uses simulated ReadLock. If expired, performs lazy cleanup under WriteLock.
   */
  public get(key: K, threadId: string = 'Worker-01'): V | null {
    const startTime = performance.now();
    this.readLockCount++;
    this.opsInWindow++;

    // Simulated lock contention chance under concurrent access
    if (Math.random() < 0.04) {
      this.lockContentionCount++;
    }

    const entry = this.storage.get(key);

    // Case 1: Key not found
    if (!entry) {
      this.totalRequests++;
      this.misses++;
      const durationMs = performance.now() - startTime;
      this.recordGetLatency(durationMs);
      this.logEvent({
        op: 'GET',
        key: String(key),
        result: 'MISS',
        latencyMs: durationMs,
        threadId,
        details: 'Key not present in cache',
      });
      this.notifyListeners();
      return null;
    }

    // Case 2: Key expired (TTL check independent of eviction)
    const now = Date.now();
    if (now >= entry.expiresAt) {
      // Lazy expiration cleanup
      this.storage.delete(key);
      this.evictionPolicy.onRemove(key);
      this.totalRequests++;
      this.misses++;
      this.expirations++;
      const durationMs = performance.now() - startTime;
      this.recordGetLatency(durationMs);

      this.logEvent({
        op: 'EXPIRE',
        key: String(key),
        result: 'EXPIRED',
        latencyMs: durationMs,
        threadId,
        details: `Lazy TTL expiry triggered (${Math.round((now - entry.expiresAt) / 1000)}s overdue)`,
      });

      this.notifyListeners();
      return null;
    }

    // Case 3: Cache Hit
    this.totalRequests++;
    this.hits++;
    entry.accessCount++;
    entry.lastAccessTime = now;
    entry.frequency = (entry.frequency || 0) + 1;

    // Update eviction policy metadata (MRU position in LRU, or frequency bucket in LFU)
    this.evictionPolicy.recordAccess(key);

    const durationMs = performance.now() - startTime;
    this.recordGetLatency(durationMs);

    this.logEvent({
      op: 'GET',
      key: String(key),
      value: entry.value,
      result: 'HIT',
      latencyMs: durationMs,
      threadId,
      details: `Served from RAM (Freq: ${entry.frequency}, TTL: ${this.formatRemainingTtl(entry)})`,
    });

    this.notifyListeners();
    return entry.value;
  }

  /**
   * Thread-safe PUT operation with per-entry TTL.
   * Uses simulated WriteLock. Evaluates capacity and evicts candidate if full.
   */
  public put(
    key: K,
    value: V,
    customTtlSec?: number,
    threadId: string = 'Worker-01'
  ): void {
    const startTime = performance.now();
    this.writeLockCount++;
    this.opsInWindow++;
    this.puts++;

    if (Math.random() < 0.08) {
      this.lockContentionCount++;
    }

    const now = Date.now();
    const ttlMs = customTtlSec !== undefined ? customTtlSec * 1000 : this.defaultTtlMs;
    const expiresAt = ttlMs > 0 ? now + ttlMs : Infinity;
    const isUpdate = this.storage.has(key);

    let evictedKey: K | null = null;

    // Capacity eviction check if new key and capacity reached
    if (!isUpdate && this.storage.size >= this.capacity) {
      evictedKey = this.evictionPolicy.getEvictionCandidate();
      if (evictedKey !== null) {
        this.storage.delete(evictedKey);
        this.evictionPolicy.onRemove(evictedKey);
        this.evictions++;
        if (this.evictionPolicy.type === 'LRU') {
          this.lruEvictions++;
        } else {
          this.lfuEvictions++;
        }

        this.logEvent({
          op: 'EVICT',
          key: String(evictedKey),
          result: 'EVICTED',
          latencyMs: 0.1,
          threadId,
          details: `Evicted under ${this.evictionPolicy.type} policy (Capacity limit: ${this.capacity})`,
        });
      }
    }

    // Insert or update cache entry
    const existing = this.storage.get(key);
    const newEntry: CacheEntry<K, V> = {
      key,
      value,
      createdAt: existing ? existing.createdAt : now,
      expiresAt,
      ttlMs,
      accessCount: existing ? existing.accessCount + 1 : 1,
      lastAccessTime: now,
      frequency: existing ? (existing.frequency || 1) + 1 : 1,
      sizeBytes: this.estimateSize(value),
    };

    this.storage.set(key, newEntry);
    this.evictionPolicy.onInsert(key);

    const durationMs = performance.now() - startTime;
    this.recordPutLatency(durationMs);

    this.logEvent({
      op: 'PUT',
      key: String(key),
      value,
      result: isUpdate ? 'UPDATE' : 'INSERT',
      latencyMs: durationMs,
      threadId,
      details: isUpdate
        ? `Updated value and refreshed TTL (${ttlMs > 0 ? ttlMs / 1000 + 's' : '∞'})`
        : `Inserted new entry with ${ttlMs > 0 ? ttlMs / 1000 + 's' : '∞'} TTL`,
    });

    this.notifyListeners();
  }

  /**
   * Remove an entry manually.
   */
  public remove(key: K, threadId: string = 'Worker-01'): boolean {
    const startTime = performance.now();
    this.writeLockCount++;
    const existed = this.storage.delete(key);
    if (existed) {
      this.evictionPolicy.onRemove(key);
      const durationMs = performance.now() - startTime;
      this.logEvent({
        op: 'DELETE',
        key: String(key),
        result: 'DELETED',
        latencyMs: durationMs,
        threadId,
        details: 'Explicit key removal',
      });
      this.notifyListeners();
    }
    return existed;
  }

  /**
   * Clear the entire cache.
   */
  public clear(): void {
    this.storage.clear();
    this.evictionPolicy.clear();
    this.logEvent({
      op: 'CLEAR',
      result: 'CLEARED',
      latencyMs: 0.1,
      details: 'Cache cleared',
    });
    this.notifyListeners();
  }

  // --- Active Background TTL Cleaner ---

  public startActiveCleanup(intervalMs: number = 1000): void {
    if (this.cleanupTimerId !== null) return;
    this.cleanupTimerId = window.setInterval(() => {
      this.cleanExpiredEntries();
      this.updateThroughputRate();
      this.recordTimelineSlice();
    }, intervalMs);
  }

  public stopActiveCleanup(): void {
    if (this.cleanupTimerId !== null) {
      clearInterval(this.cleanupTimerId);
      this.cleanupTimerId = null;
    }
  }

  /**
   * Active TTL expiration routine (simulates Java ScheduledExecutorService thread).
   */
  public cleanExpiredEntries(): number {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.storage.entries()) {
      if (now >= entry.expiresAt) {
        this.storage.delete(key);
        this.evictionPolicy.onRemove(key);
        this.expirations++;
        expiredCount++;

        this.logEvent({
          op: 'EXPIRE',
          key: String(key),
          result: 'EXPIRED',
          latencyMs: 0.05,
          threadId: 'TTL-Daemon',
          details: `Active daemon cleanup expired entry`,
        });
      }
    }

    if (expiredCount > 0) {
      this.notifyListeners();
    }
    return expiredCount;
  }

  // --- Configuration Mutators ---

  public setCapacity(newCapacity: number): void {
    const clamped = Math.max(1, Math.floor(newCapacity));
    this.capacity = clamped;

    // If new capacity is lower than current size, evict excess entries
    while (this.storage.size > this.capacity) {
      const candidate = this.evictionPolicy.getEvictionCandidate();
      if (!candidate) break;
      this.storage.delete(candidate);
      this.evictionPolicy.onRemove(candidate);
      this.evictions++;
      if (this.evictionPolicy.type === 'LRU') {
        this.lruEvictions++;
      } else {
        this.lfuEvictions++;
      }
    }

    this.notifyListeners();
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public setDefaultTtlSec(seconds: number): void {
    this.defaultTtlMs = Math.max(0, seconds) * 1000;
  }

  public getDefaultTtlSec(): number {
    return this.defaultTtlMs / 1000;
  }

  /**
   * Seamlessly switches eviction policy between LRU and LFU
   * while preserving all cached keys and re-indexing them!
   */
  public setPolicy(type: PolicyType): void {
    if (this.evictionPolicy.type === type) return;

    const entriesSnapshot = Array.from(this.storage.values()).map(e => ({
      key: e.key,
      accessCount: e.accessCount,
      lastAccessTime: e.lastAccessTime,
    }));

    if (type === 'LRU') {
      this.evictionPolicy = this.lruPolicy;
      this.lruPolicy.syncFromEntries(entriesSnapshot);
    } else {
      this.evictionPolicy = this.lfuPolicy;
      this.lfuPolicy.syncFromEntries(entriesSnapshot);
    }

    this.logEvent({
      op: 'POLICY_CHANGE',
      result: 'SWITCHED',
      latencyMs: 0.2,
      details: `Switched eviction algorithm to ${type}`,
    });

    this.notifyListeners();
  }

  public getPolicyType(): PolicyType {
    return this.evictionPolicy.type;
  }

  public getEvictionPolicy(): EvictionPolicy<K> {
    return this.evictionPolicy;
  }

  // --- State & Inspectability ---

  public getAllEntries(): Array<CacheEntry<K, V>> {
    return Array.from(this.storage.values());
  }

  public getEntry(key: K): CacheEntry<K, V> | undefined {
    return this.storage.get(key);
  }

  public size(): number {
    return this.storage.size;
  }

  public getEvictionCandidate(): K | null {
    return this.evictionPolicy.getEvictionCandidate();
  }

  public getPolicyOrder(): K[] {
    return this.evictionPolicy.getOrder();
  }

  // --- Metrics & Telemetry ---

  public getMetrics(): CacheMetrics {
    const total = this.totalRequests;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;
    const missRate = total > 0 ? (this.misses / total) * 100 : 0;

    const avgGet = this.getLatencies.length > 0
      ? this.getLatencies.reduce((a, b) => a + b, 0) / this.getLatencies.length
      : 0;

    const avgPut = this.putLatencies.length > 0
      ? this.putLatencies.reduce((a, b) => a + b, 0) / this.putLatencies.length
      : 0;

    const allLatencies = [...this.getLatencies, ...this.putLatencies].sort((a, b) => a - b);
    const p95 = allLatencies.length > 0
      ? allLatencies[Math.floor(allLatencies.length * 0.95)]
      : 0;
    const p99 = allLatencies.length > 0
      ? allLatencies[Math.floor(allLatencies.length * 0.99)]
      : 0;

    return {
      totalRequests: this.totalRequests,
      hits: this.hits,
      misses: this.misses,
      hitRate: Number(hitRate.toFixed(2)),
      missRate: Number(missRate.toFixed(2)),
      puts: this.puts,
      deletes: 0,
      evictions: this.evictions,
      expirations: this.expirations,
      currentSize: this.storage.size,
      activeEntries: this.storage.size,
      capacity: this.capacity,
      policy: this.evictionPolicy.type,
      avgGetLatencyMs: Number(avgGet.toFixed(3)),
      avgPutLatencyMs: Number(avgPut.toFixed(3)),
      p95LatencyMs: Number(p95.toFixed(3)),
      p99LatencyMs: Number(p99.toFixed(3)),
      opsPerSec: this.currentOpsPerSec,
      lruEvictions: this.lruEvictions,
      lfuEvictions: this.lfuEvictions,
      readLockAcquisitions: this.readLockCount,
      writeLockAcquisitions: this.writeLockCount,
      lockContentionEvents: this.lockContentionCount,
    };
  }

  public getEventLog(): CacheEvent[] {
    return [...this.eventLog];
  }

  public getTimeline(): TimelinePoint[] {
    return [...this.timeline];
  }

  public resetMetrics(): void {
    this.totalRequests = 0;
    this.hits = 0;
    this.misses = 0;
    this.puts = 0;
    this.evictions = 0;
    this.expirations = 0;
    this.lruEvictions = 0;
    this.lfuEvictions = 0;
    this.getLatencies = [];
    this.putLatencies = [];
    this.readLockCount = 0;
    this.writeLockCount = 0;
    this.lockContentionCount = 0;
    this.timeline = [];
    this.eventLog = [];
    this.recordTimelineSlice();
    this.notifyListeners();
  }

  // --- Subscriptions ---

  public subscribe(listener: CacheChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('Error in CacheManager listener:', err);
      }
    }
  }

  // --- Internal Helpers ---

  private recordGetLatency(ms: number): void {
    this.getLatencies.push(ms);
    if (this.getLatencies.length > 200) {
      this.getLatencies.shift();
    }
  }

  private recordPutLatency(ms: number): void {
    this.putLatencies.push(ms);
    if (this.putLatencies.length > 200) {
      this.putLatencies.shift();
    }
  }

  private logEvent(params: {
    op: OperationType;
    key?: string;
    value?: unknown;
    result: OperationResult;
    latencyMs: number;
    threadId?: string;
    details?: string;
  }): void {
    const event: CacheEvent = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      op: params.op,
      key: params.key,
      value: params.value,
      result: params.result,
      latencyMs: Number(params.latencyMs.toFixed(3)),
      latencyNs: Math.round(params.latencyMs * 1_000_000),
      threadId: params.threadId || 'Worker-01',
      details: params.details,
      policy: this.evictionPolicy.type,
    };

    this.eventLog.unshift(event);
    if (this.eventLog.length > this.MAX_EVENT_LOG) {
      this.eventLog.pop();
    }
  }

  private recordTimelineSlice(): void {
    const metrics = this.getMetrics();
    const point: TimelinePoint = {
      timestamp: Date.now(),
      hitRate: metrics.hitRate,
      missRate: metrics.missRate,
      requests: metrics.totalRequests,
      hits: metrics.hits,
      misses: metrics.misses,
      activeEntries: metrics.activeEntries,
    };

    this.timeline.push(point);
    if (this.timeline.length > this.MAX_TIMELINE_POINTS) {
      this.timeline.shift();
    }
  }

  private updateThroughputRate(): void {
    const now = Date.now();
    const elapsedSec = (now - this.lastRateCheckTime) / 1000;
    if (elapsedSec >= 0.5) {
      this.currentOpsPerSec = Math.round(this.opsInWindow / elapsedSec);
      this.opsInWindow = 0;
      this.lastRateCheckTime = now;
    }
  }

  private estimateSize(value: unknown): number {
    try {
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      return str ? str.length * 2 + 64 : 64; // ~UTF-16 bytes + object overhead
    } catch {
      return 128;
    }
  }

  private formatRemainingTtl(entry: CacheEntry<K, V>): string {
    if (entry.expiresAt === Infinity) return '∞';
    const remainingSec = Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
    return `${remainingSec}s`;
  }
}
