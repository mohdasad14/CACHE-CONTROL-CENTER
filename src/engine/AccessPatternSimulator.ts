/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LRUPolicy, LFUPolicy } from './EvictionPolicy';
import { PolicyType } from '../types/cache';

export interface SimulatorSnapshot {
  stepIndex: number;
  totalSteps: number;
  requestKey: string;
  result: 'HIT' | 'MISS';
  evictedKey: string | null;
  cacheKeys: string[]; // Current cache keys in display order
  lruOrder: string[]; // MRU (head) to LRU (tail)
  frequencies: Record<string, number>;
  minFrequency: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  explanation: string;
  pipelineStage: 'REQUEST' | 'LOCK' | 'LOOKUP' | 'RESULT' | 'POLICY_UPDATE' | 'COMPLETED';
}

/**
 * AccessPatternSimulator provides deterministic, step-by-step or automated
 * execution of cache access patterns for interactive demonstration of LRU/LFU.
 */
export class AccessPatternSimulator {
  private pattern: string[] = [];
  private capacity: number = 3;
  private policyType: PolicyType = 'LRU';
  private defaultTtlSec: number = 30;

  // Internal states
  private currentStepIndex: number = -1;
  private history: SimulatorSnapshot[] = [];

  constructor(patternStr: string = 'A, B, C, A, D, B, A, E, C', capacity: number = 3, policy: PolicyType = 'LRU') {
    this.capacity = capacity;
    this.policyType = policy;
    this.setPattern(patternStr);
  }

  public setPattern(patternStr: string): void {
    this.pattern = patternStr
      .split(/[,;\s]+/)
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0);
    this.reset();
  }

  public getPattern(): string[] {
    return [...this.pattern];
  }

  public setCapacity(c: number): void {
    this.capacity = Math.max(1, Math.min(20, c));
    this.reset();
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public setPolicy(p: PolicyType): void {
    this.policyType = p;
    this.reset();
  }

  public getPolicy(): PolicyType {
    return this.policyType;
  }

  public reset(): void {
    this.currentStepIndex = -1;
    this.history = [];
    this.computeAllSnapshots();
  }

  public getCurrentSnapshot(): SimulatorSnapshot | null {
    if (this.currentStepIndex < 0) return null;
    return this.history[this.currentStepIndex] || null;
  }

  public getAllSnapshots(): SimulatorSnapshot[] {
    return this.history;
  }

  public getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  public getTotalSteps(): number {
    return this.pattern.length;
  }

  public stepForward(): SimulatorSnapshot | null {
    if (this.currentStepIndex < this.pattern.length - 1) {
      this.currentStepIndex++;
      return this.history[this.currentStepIndex];
    }
    return null;
  }

  public stepBackward(): SimulatorSnapshot | null {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      return this.history[this.currentStepIndex];
    } else if (this.currentStepIndex === 0) {
      this.currentStepIndex = -1;
      return null;
    }
    return null;
  }

  public jumpToStep(index: number): SimulatorSnapshot | null {
    if (index >= -1 && index < this.pattern.length) {
      this.currentStepIndex = index;
      return index >= 0 ? this.history[index] : null;
    }
    return null;
  }

  public isFinished(): boolean {
    return this.currentStepIndex >= this.pattern.length - 1;
  }

  /**
   * Pre-computes all simulation steps with full algorithmic integrity
   * so the user can freely scrub backwards and forwards.
   */
  private computeAllSnapshots(): void {
    this.history = [];
    if (this.pattern.length === 0) return;

    // Simulation state tracking
    const cacheMap = new Map<string, { value: string; accessCount: number; lastAccess: number }>();
    const lru = new LRUPolicy<string>();
    const lfu = new LFUPolicy<string>();

    let cumulativeHits = 0;
    let cumulativeMisses = 0;
    let cumulativeEvictions = 0;

    for (let i = 0; i < this.pattern.length; i++) {
      const key = this.pattern[i];
      let result: 'HIT' | 'MISS' = 'MISS';
      let evictedKey: string | null = null;
      let explanation = '';

      const isHit = cacheMap.has(key);

      if (isHit) {
        // HIT
        result = 'HIT';
        cumulativeHits++;
        const entry = cacheMap.get(key)!;
        entry.accessCount++;
        entry.lastAccess = i;

        if (this.policyType === 'LRU') {
          lru.recordAccess(key);
          explanation = `Cache HIT! Key '${key}' found in memory. Moved to MRU (Head) position. Access count: ${entry.accessCount}.`;
        } else {
          lfu.recordAccess(key);
          explanation = `Cache HIT! Key '${key}' found in memory. Frequency incremented to ${entry.accessCount}.`;
        }
      } else {
        // MISS
        result = 'MISS';
        cumulativeMisses++;

        // Capacity check
        if (cacheMap.size >= this.capacity) {
          if (this.policyType === 'LRU') {
            evictedKey = lru.getEvictionCandidate();
            if (evictedKey) {
              cacheMap.delete(evictedKey);
              lru.onRemove(evictedKey);
              cumulativeEvictions++;
              explanation = `Cache MISS for '${key}'. Cache full (${this.capacity}/${this.capacity}). Evicted '${evictedKey}' (Least Recently Used at tail of doubly-linked list). Inserted '${key}' at MRU head.`;
            }
          } else {
            evictedKey = lfu.getEvictionCandidate();
            if (evictedKey) {
              cacheMap.delete(evictedKey);
              lfu.onRemove(evictedKey);
              cumulativeEvictions++;
              explanation = `Cache MISS for '${key}'. Cache full (${this.capacity}/${this.capacity}). Evicted '${evictedKey}' (Lowest frequency bucket / oldest insertion). Inserted '${key}' with frequency 1.`;
            }
          }
        } else {
          explanation = `Cache MISS for '${key}'. Loaded into cache (Slots: ${cacheMap.size + 1}/${this.capacity}).`;
        }

        // Insert new key
        cacheMap.set(key, { value: `val_${key}`, accessCount: 1, lastAccess: i });
        if (this.policyType === 'LRU') {
          lru.onInsert(key);
        } else {
          lfu.onInsert(key);
        }
      }

      // Collect frequencies & orders
      const freqObj: Record<string, number> = {};
      for (const [k, v] of cacheMap.entries()) {
        freqObj[k] = v.accessCount;
      }

      const totalReq = cumulativeHits + cumulativeMisses;
      const hitRate = totalReq > 0 ? Number(((cumulativeHits / totalReq) * 100).toFixed(1)) : 0;

      const orderKeys = this.policyType === 'LRU' ? lru.getOrder() : lfu.getOrder();

      this.history.push({
        stepIndex: i,
        totalSteps: this.pattern.length,
        requestKey: key,
        result,
        evictedKey,
        cacheKeys: Array.from(cacheMap.keys()),
        lruOrder: orderKeys,
        frequencies: freqObj,
        minFrequency: this.policyType === 'LFU' ? (lfu as any).getMinFrequency?.() || 1 : 1,
        hits: cumulativeHits,
        misses: cumulativeMisses,
        hitRate,
        evictions: cumulativeEvictions,
        explanation,
        pipelineStage: 'COMPLETED',
      });
    }
  }
}
