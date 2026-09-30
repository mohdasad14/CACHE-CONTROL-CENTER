/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DoublyLinkedList, DLLNode } from './DoublyLinkedList';
import { PolicyType } from '../types/cache';

export interface EvictionPolicy<K> {
  readonly type: PolicyType;
  recordAccess(key: K): void;
  onInsert(key: K): void;
  onRemove(key: K): void;
  getEvictionCandidate(): K | null;
  getOrder(): K[]; // Ordered representation for visualization (MRU -> LRU or High Freq -> Low Freq)
  getFrequencies(): Map<K, number>;
  clear(): void;
  syncFromEntries(entries: Array<{ key: K; accessCount: number; lastAccessTime: number }>): void;
}

/**
 * LRU (Least Recently Used) Policy implementation.
 * Uses HashMap<K, DLLNode<K>> + DoublyLinkedList for O(1) access, insertion, and eviction.
 */
export class LRUPolicy<K = string> implements EvictionPolicy<K> {
  public readonly type: PolicyType = 'LRU';
  private nodeMap: Map<K, DLLNode<K>> = new Map();
  private list: DoublyLinkedList<K> = new DoublyLinkedList();
  private frequencies: Map<K, number> = new Map();

  public recordAccess(key: K): void {
    const node = this.nodeMap.get(key);
    if (node) {
      this.list.moveToHead(node);
      const currentFreq = this.frequencies.get(key) || 1;
      this.frequencies.set(key, currentFreq + 1);
    }
  }

  public onInsert(key: K): void {
    // If existing, move to head
    let node = this.nodeMap.get(key);
    if (node) {
      this.list.moveToHead(node);
      const currentFreq = this.frequencies.get(key) || 1;
      this.frequencies.set(key, currentFreq + 1);
    } else {
      node = new DLLNode(key);
      this.nodeMap.set(key, node);
      this.list.addToHead(node);
      this.frequencies.set(key, 1);
    }
  }

  public onRemove(key: K): void {
    const node = this.nodeMap.get(key);
    if (node) {
      this.list.removeNode(node);
      this.nodeMap.delete(key);
      this.frequencies.delete(key);
    }
  }

  public getEvictionCandidate(): K | null {
    const tailNode = this.list.getTail();
    return tailNode ? tailNode.key : null;
  }

  public getOrder(): K[] {
    return this.list.toArray(); // Head (MRU) to Tail (LRU)
  }

  public getFrequencies(): Map<K, number> {
    return new Map(this.frequencies);
  }

  public clear(): void {
    this.list.clear();
    this.nodeMap.clear();
    this.frequencies.clear();
  }

  public syncFromEntries(entries: Array<{ key: K; accessCount: number; lastAccessTime: number }>): void {
    this.clear();
    // Sort by lastAccessTime descending (most recent first)
    const sorted = [...entries].sort((a, b) => b.lastAccessTime - a.lastAccessTime);
    // Add in reverse so most recent ends at head
    for (let i = sorted.length - 1; i >= 0; i--) {
      const e = sorted[i];
      const node = new DLLNode(e.key);
      this.nodeMap.set(e.key, node);
      this.list.addToHead(node);
      this.frequencies.set(e.key, e.accessCount);
    }
  }
}

/**
 * LFU (Least Frequently Used) Policy implementation.
 * Key -> Frequency Map
 * Frequency -> Set<Key> (preserves LRU insertion order within same frequency bucket for tie-breaking)
 * minFrequency pointer
 * Achieves O(1) operations.
 */
export class LFUPolicy<K = string> implements EvictionPolicy<K> {
  public readonly type: PolicyType = 'LFU';
  private keyToFreq: Map<K, number> = new Map();
  private freqToKeys: Map<number, Set<K>> = new Map();
  private minFrequency: number = 0;

  public recordAccess(key: K): void {
    const freq = this.keyToFreq.get(key);
    if (freq === undefined) return;

    // Remove from current frequency bucket
    const currentBucket = this.freqToKeys.get(freq);
    if (currentBucket) {
      currentBucket.delete(key);
      if (currentBucket.size === 0) {
        this.freqToKeys.delete(freq);
        if (this.minFrequency === freq) {
          this.minFrequency = freq + 1;
        }
      }
    }

    // Increment frequency
    const newFreq = freq + 1;
    this.keyToFreq.set(key, newFreq);

    // Add to new frequency bucket
    if (!this.freqToKeys.has(newFreq)) {
      this.freqToKeys.set(newFreq, new Set());
    }
    this.freqToKeys.get(newFreq)!.add(key);
  }

  public onInsert(key: K): void {
    if (this.keyToFreq.has(key)) {
      this.recordAccess(key);
      return;
    }

    // Fresh key starts with frequency = 1
    this.keyToFreq.set(key, 1);
    this.minFrequency = 1;

    if (!this.freqToKeys.has(1)) {
      this.freqToKeys.set(1, new Set());
    }
    this.freqToKeys.get(1)!.add(key);
  }

  public onRemove(key: K): void {
    const freq = this.keyToFreq.get(key);
    if (freq === undefined) return;

    this.keyToFreq.delete(key);
    const bucket = this.freqToKeys.get(freq);
    if (bucket) {
      bucket.delete(key);
      if (bucket.size === 0) {
        this.freqToKeys.delete(freq);
        // Recalculate minFrequency if needed
        if (this.minFrequency === freq) {
          let nextMin = Infinity;
          for (const f of this.freqToKeys.keys()) {
            if (f < nextMin) nextMin = f;
          }
          this.minFrequency = nextMin === Infinity ? 0 : nextMin;
        }
      }
    }
  }

  public getEvictionCandidate(): K | null {
    if (this.keyToFreq.size === 0) return null;

    let bucket = this.freqToKeys.get(this.minFrequency);
    if (!bucket || bucket.size === 0) {
      // Find lowest existing frequency
      let minF = Infinity;
      for (const f of this.freqToKeys.keys()) {
        if (f < minF && this.freqToKeys.get(f)!.size > 0) {
          minF = f;
        }
      }
      if (minF === Infinity) return null;
      this.minFrequency = minF;
      bucket = this.freqToKeys.get(minF);
    }

    if (!bucket || bucket.size === 0) return null;

    // Return the oldest accessed key at minFrequency (LRU tie-breaker)
    const iterator = bucket.values();
    const first = iterator.next();
    return first.done ? null : first.value;
  }

  public getOrder(): K[] {
    // Return items sorted by frequency ascending (least frequent first for visualization)
    const result: K[] = [];
    const freqs = Array.from(this.freqToKeys.keys()).sort((a, b) => a - b);
    for (const f of freqs) {
      const keys = this.freqToKeys.get(f);
      if (keys) {
        for (const k of keys) {
          result.push(k);
        }
      }
    }
    return result;
  }

  public getFrequencies(): Map<K, number> {
    return new Map(this.keyToFreq);
  }

  public getFrequencyBuckets(): Map<number, K[]> {
    const copy = new Map<number, K[]>();
    for (const [freq, set] of this.freqToKeys.entries()) {
      copy.set(freq, Array.from(set));
    }
    return copy;
  }

  public getMinFrequency(): number {
    return this.minFrequency;
  }

  public clear(): void {
    this.keyToFreq.clear();
    this.freqToKeys.clear();
    this.minFrequency = 0;
  }

  public syncFromEntries(entries: Array<{ key: K; accessCount: number; lastAccessTime: number }>): void {
    this.clear();
    if (entries.length === 0) return;

    let minF = Infinity;
    // Group by access count
    for (const e of entries) {
      const freq = Math.max(1, e.accessCount);
      this.keyToFreq.set(e.key, freq);
      if (!this.freqToKeys.has(freq)) {
        this.freqToKeys.set(freq, new Set());
      }
      this.freqToKeys.get(freq)!.add(e.key);
      if (freq < minF) minF = freq;
    }
    this.minFrequency = minF === Infinity ? 0 : minF;
  }
}
