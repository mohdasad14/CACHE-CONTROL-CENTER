/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CacheManager } from './CacheManager';
import { ThreadActivity } from '../types/cache';

export interface StressTestProgress {
  completedRequests: number;
  totalRequests: number;
  currentThroughput: number;
  activeThreads: number;
  isFinished: boolean;
}

export interface StressTestSummary {
  threads: number;
  totalRequests: number;
  successfulOps: number;
  failedOps: number;
  durationMs: number;
  throughputReqSec: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p90LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  lockContentionRate: number;
}

export class ConcurrentWorkerPool {
  private cache: CacheManager;
  private workerCount: number;
  private workers: ThreadActivity[] = [];
  private isRunningContinuous: boolean = false;
  private intervalId: number | null = null;
  private onThreadUpdate?: (workers: ThreadActivity[]) => void;

  constructor(cache: CacheManager, workerCount: number = 8) {
    this.cache = cache;
    this.workerCount = workerCount;
    this.initWorkers();
  }

  private initWorkers(): void {
    this.workers = [];
    for (let i = 1; i <= this.workerCount; i++) {
      const id = i < 10 ? `0${i}` : `${i}`;
      this.workers.push({
        threadId: `th-${id}`,
        name: `Worker-${id}`,
        status: 'IDLE',
        lastOperation: 'READY',
        lastKey: '—',
        completedOps: 0,
        avgLatencyMs: 0.8,
        contendedCount: 0,
      });
    }
  }

  public setWorkerCount(count: number): void {
    this.workerCount = Math.max(1, Math.min(64, count));
    this.initWorkers();
    if (this.onThreadUpdate) {
      this.onThreadUpdate([...this.workers]);
    }
  }

  public getWorkers(): ThreadActivity[] {
    return [...this.workers];
  }

  public setUpdateCallback(callback: (workers: ThreadActivity[]) => void): void {
    this.onThreadUpdate = callback;
  }

  /**
   * Starts background thread simulation dispatching asynchronous concurrent tasks.
   */
  public startBackgroundTraffic(rateOpsPerSec: number = 20): void {
    if (this.isRunningContinuous) return;
    this.isRunningContinuous = true;

    const interval = Math.max(20, Math.floor(1000 / rateOpsPerSec));
    const sampleKeys = ['user:101', 'user:102', 'user:205', 'user:302', 'order:88', 'product:14', 'session:99', 'config:theme'];

    this.intervalId = window.setInterval(() => {
      // Pick random worker
      const workerIndex = Math.floor(Math.random() * this.workers.length);
      const worker = this.workers[workerIndex];
      if (!worker) return;

      const isRead = Math.random() < 0.75;
      const key = sampleKeys[Math.floor(Math.random() * sampleKeys.length)];

      if (isRead) {
        worker.status = 'READ_LOCK';
        worker.lastOperation = `GET ${key}`;
        worker.lastKey = key;
        const res = this.cache.get(key, worker.name);
        if (res === null && Math.random() < 0.4) {
          // Cache miss simulated lazy load
          this.cache.put(key, { data: `cached_${key}`, loadedAt: Date.now() }, 45, worker.name);
        }
      } else {
        worker.status = 'WRITE_LOCK';
        worker.lastOperation = `PUT ${key}`;
        worker.lastKey = key;
        this.cache.put(key, { data: `val_${Date.now()}` }, 60, worker.name);
      }

      worker.completedOps++;
      setTimeout(() => {
        worker.status = 'IDLE';
        if (this.onThreadUpdate) {
          this.onThreadUpdate([...this.workers]);
        }
      }, 50);

      if (this.onThreadUpdate) {
        this.onThreadUpdate([...this.workers]);
      }
    }, interval);
  }

  public stopBackgroundTraffic(): void {
    this.isRunningContinuous = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    for (const w of this.workers) {
      w.status = 'IDLE';
    }
    if (this.onThreadUpdate) {
      this.onThreadUpdate([...this.workers]);
    }
  }

  public isTrafficRunning(): boolean {
    return this.isRunningContinuous;
  }

  /**
   * High-intensity concurrent stress test across multiple simulated Java threads.
   */
  public async runStressTest(
    threads: number,
    requests: number,
    onProgress?: (progress: StressTestProgress) => void
  ): Promise<StressTestSummary> {
    const startTime = performance.now();
    const latencies: number[] = [];
    const keys = Array.from({ length: Math.max(20, Math.floor(requests * 0.1)) }, (_, i) => `k_${i}`);

    let completed = 0;
    let successful = 0;
    let failed = 0;
    let contentions = 0;

    // Batch execution to keep UI responsive at 60 FPS
    const batchSize = Math.max(10, Math.floor(requests / 50));
    let cursor = 0;

    while (cursor < requests) {
      const currentBatch = Math.min(batchSize, requests - cursor);
      const batchStart = performance.now();

      for (let i = 0; i < currentBatch; i++) {
        const threadIndex = (cursor + i) % threads;
        const threadName = `Worker-${String((threadIndex % 32) + 1).padStart(2, '0')}`;
        const key = keys[Math.floor(Math.random() * keys.length)];
        const isRead = Math.random() < 0.8;

        const opStart = performance.now();
        try {
          if (isRead) {
            const val = this.cache.get(key, threadName);
            if (val === null) {
              // Read-through fallback
              this.cache.put(key, `loaded_${key}`, 30, threadName);
            }
          } else {
            this.cache.put(key, `updated_${Date.now()}`, 30, threadName);
          }
          successful++;
          if (Math.random() < 0.05) contentions++;
        } catch {
          failed++;
        }

        const opDuration = performance.now() - opStart;
        latencies.push(opDuration);
      }

      cursor += currentBatch;
      completed = cursor;

      const elapsedMs = performance.now() - startTime;
      const throughput = elapsedMs > 0 ? Math.round((completed / elapsedMs) * 1000) : 0;

      if (onProgress) {
        onProgress({
          completedRequests: completed,
          totalRequests: requests,
          currentThroughput: throughput,
          activeThreads: threads,
          isFinished: completed >= requests,
        });
      }

      // Yield control briefly to animation frame
      await new Promise(resolve => setTimeout(resolve, 8));
    }

    const totalDuration = performance.now() - startTime;
    latencies.sort((a, b) => a - b);

    const avgLat = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p90 = latencies[Math.floor(latencies.length * 0.9)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

    return {
      threads,
      totalRequests: requests,
      successfulOps: successful,
      failedOps: failed,
      durationMs: Number(totalDuration.toFixed(1)),
      throughputReqSec: Math.round((requests / totalDuration) * 1000),
      avgLatencyMs: Number(avgLat.toFixed(3)),
      p50LatencyMs: Number(p50.toFixed(3)),
      p90LatencyMs: Number(p90.toFixed(3)),
      p95LatencyMs: Number(p95.toFixed(3)),
      p99LatencyMs: Number(p99.toFixed(3)),
      lockContentionRate: Number(((contentions / requests) * 100).toFixed(2)),
    };
  }
}
