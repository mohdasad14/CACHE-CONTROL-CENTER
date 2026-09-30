/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PolicyType = 'LRU' | 'LFU' | 'FIFO' | 'TWO_QUEUE' | 'ARC' | 'RANDOM';
export type EvictionPolicyType = PolicyType;

export interface CacheMetrics {
  totalRequests: number;
  hits: number;
  misses: number;
  hitRate: number;
  missRate: number;
  puts: number;
  deletes: number;
  evictions: number;
  expirations: number;
  currentSize: number;
  activeEntries: number;
  capacity: number;
  policy: EvictionPolicyType;
  avgGetLatencyMs: number;
  avgPutLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  opsPerSec: number;
  lruEvictions: number;
  lfuEvictions: number;
  readLockAcquisitions?: number;
  writeLockAcquisitions?: number;
  lockContentionEvents?: number;
}

export interface CacheEntry<K = string, V = unknown> {
  key: K;
  value: V;
  createdAt: number;
  expiresAt: number; // epoch ms; Infinity if no expiration
  ttlMs: number;
  accessCount: number;
  lastAccessTime: number;
  frequency: number;
  sizeBytes: number;
}

export interface CacheEntryItem {
  key: string;
  value: string;
  accessCount: number;
  remainingTtlMillis: number; // -1 if infinite
  lastAccessed: number;
  status: 'ACTIVE' | 'EXPIRED';
  createdAt?: number;
}

export interface GetEntryResponse {
  hit: boolean;
  key: string;
  value?: string | null;
  remainingTtlMillis?: number;
  status: 'HIT' | 'MISS' | 'EXPIRED';
  message?: string;
  accessCount?: number;
}

export interface PutEntryRequest {
  value: string;
  ttlMillis: number;
}

export type OperationType = 'GET' | 'PUT' | 'DELETE' | 'EXPIRE' | 'EVICT' | 'POLICY_CHANGE' | 'CLEAR';
export type OperationResult = 'HIT' | 'MISS' | 'INSERT' | 'UPDATE' | 'EXPIRED' | 'EVICTED' | 'DELETED' | 'SWITCHED' | 'CLEARED';

export interface CacheEvent {
  id: string;
  timestamp: number;
  op: OperationType;
  key?: string;
  value?: unknown;
  result: OperationResult;
  latencyNs: number;
  latencyMs: number;
  threadId?: string;
  details?: string;
  policy: PolicyType;
}

export interface TimelinePoint {
  timestamp: number;
  hitRate: number;
  missRate: number;
  requests: number;
  hits: number;
  misses: number;
  activeEntries: number;
}

export interface DemoOperationStep {
  step: number;
  op: 'PUT' | 'GET' | 'DELETE';
  key: string;
  result: 'HIT' | 'MISS' | 'STORED' | 'EVICTED' | 'EXPIRED';
  details: string;
}

export interface DemoResponse {
  policy: EvictionPolicyType;
  operations: DemoOperationStep[];
  evicted: string | null;
  finalEntries: string[];
  summary: {
    total: number;
    hits: number;
    misses: number;
    evictions: number;
  };
}

export interface ActivityEvent {
  id: string;
  timestamp: number;
  timeStr: string;
  type: 'GET' | 'PUT' | 'DELETE' | 'EVICTION' | 'TTL' | 'POLICY' | 'CLEAR' | 'RESET';
  key?: string;
  result?: string;
  latencyMs?: number;
}

export interface BackendStatus {
  online: boolean;
  latencyMs?: number;
  url: string;
  version?: string;
  error?: string;
}

export type WorkloadType = 'zipfian' | 'cyclic' | 'sequential' | 'random' | 'custom';

export interface BenchmarkConfig {
  workloadType: WorkloadType;
  requestCount: number;
  capacity: number;
  ttlSec: number;
  keyUniverseSize: number;
  customKeys?: string[];
}

export interface BenchmarkMetrics extends CacheMetrics {
  throughputReqSec: number;
  durationMs: number;
}

export interface BenchmarkResult {
  config: BenchmarkConfig;
  lru: BenchmarkMetrics;
  lfu: BenchmarkMetrics;
  workloadName: string;
  totalKeys: number;
  keyFrequencyDistribution: { key: string; count: number }[];
  analysis: string;
}

export interface ThreadActivity {
  threadId: string;
  name: string;
  status: 'IDLE' | 'READ_LOCK' | 'WRITE_LOCK' | 'PROCESSING';
  lastOperation: string;
  lastKey: string;
  completedOps: number;
  avgLatencyMs: number;
  contendedCount: number;
}
