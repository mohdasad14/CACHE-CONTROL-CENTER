/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FileCode2, Copy, Check, Terminal, ExternalLink, Cpu, ShieldCheck } from 'lucide-react';

interface CodeSnippet {
  id: string;
  name: string;
  filename: string;
  description: string;
  code: string;
}

const JAVA_SNIPPETS: CodeSnippet[] = [
  {
    id: 'cache-manager',
    name: 'CacheManager.java',
    filename: 'src/main/java/cache/CacheManager.java',
    description: 'Thread-safe cache manager combining ConcurrentHashMap with ReentrantReadWriteLock and pluggable eviction.',
    code: `package com.cachex.core;

import java.util.concurrent.*;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.concurrent.atomic.AtomicLong;

/**
 * High-concurrency In-Memory Cache Manager.
 * Separates TTL expiration from eviction policies (LRU / LFU).
 */
public class CacheManager<K, V> {
    private final int capacity;
    private final ConcurrentMap<K, CacheEntry<K, V>> storage;
    private volatile EvictionPolicy<K> evictionPolicy;
    private final ReentrantReadWriteLock rwLock;
    private final MetricsCollector metrics;
    private final ScheduledExecutorService ttlCleanerService;

    public CacheManager(int capacity, EvictionPolicy<K> evictionPolicy, long defaultTtlMillis) {
        this.capacity = capacity;
        this.storage = new ConcurrentHashMap<>();
        this.evictionPolicy = evictionPolicy;
        this.rwLock = new ReentrantReadWriteLock();
        this.metrics = new MetricsCollector();

        // Active background TTL expiration cleaner (runs every second)
        this.ttlCleanerService = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "CacheX-TTL-Daemon");
            t.setDaemon(true);
            return t;
        });
        this.ttlCleanerService.scheduleAtFixedRate(this::cleanExpiredEntries, 1, 1, TimeUnit.SECONDS);
    }

    public V get(K key) {
        long startTime = System.nanoTime();

        // 1. Lock-free read lookup via ConcurrentHashMap
        CacheEntry<K, V> entry = storage.get(key);

        // 2. Lazy TTL expiration check
        if (entry == null || entry.isExpired()) {
            if (entry != null) {
                remove(key); // purge expired entry
                metrics.recordExpiration();
            }
            metrics.recordMiss();
            metrics.recordGetLatency(System.nanoTime() - startTime);
            return null;
        }

        // 3. Update recency/frequency under write lock
        rwLock.writeLock().lock();
        try {
            entry.incrementAccessCount();
            entry.setLastAccessTime(System.currentTimeMillis());
            evictionPolicy.recordAccess(key);
        } finally {
            rwLock.writeLock().unlock();
        }

        metrics.recordHit();
        metrics.recordGetLatency(System.nanoTime() - startTime);
        return entry.getValue();
    }

    public void put(K key, V value, long ttlMillis) {
        long startTime = System.nanoTime();
        rwLock.writeLock().lock();
        try {
            // Check capacity eviction if key is new
            if (!storage.containsKey(key) && storage.size() >= capacity) {
                K candidate = evictionPolicy.getEvictionCandidate();
                if (candidate != null) {
                    storage.remove(candidate);
                    evictionPolicy.onRemove(candidate);
                    metrics.recordEviction();
                }
            }

            CacheEntry<K, V> newEntry = new CacheEntry<>(key, value, ttlMillis);
            storage.put(key, newEntry);
            evictionPolicy.onInsert(key);
            metrics.recordPut();
        } finally {
            rwLock.writeLock().unlock();
        }
        metrics.recordPutLatency(System.nanoTime() - startTime);
    }

    public void remove(K key) {
        rwLock.writeLock().lock();
        try {
            storage.remove(key);
            evictionPolicy.onRemove(key);
        } finally {
            rwLock.writeLock().unlock();
        }
    }

    private void cleanExpiredEntries() {
        long now = System.currentTimeMillis();
        for (K key : storage.keySet()) {
            CacheEntry<K, V> entry = storage.get(key);
            if (entry != null && entry.isExpired()) {
                remove(key);
                metrics.recordExpiration();
            }
        }
    }
}`,
  },
  {
    id: 'lru-policy',
    name: 'LRUPolicy.java',
    filename: 'src/main/java/eviction/LRUPolicy.java',
    description: 'O(1) LRU eviction using a Doubly-Linked List and HashMap lookup.',
    code: `package com.cachex.eviction;

import java.util.HashMap;
import java.util.Map;

/**
 * Least Recently Used (LRU) Eviction Policy.
 * Implemented via HashMap + Custom Doubly-Linked List for O(1) performance.
 */
public class LRUPolicy<K> implements EvictionPolicy<K> {
    private static class Node<K> {
        K key;
        Node<K> prev;
        Node<K> next;
        Node(K key) { this.key = key; }
    }

    private final Map<K, Node<K>> map = new HashMap<>();
    private final Node<K> head = new Node<>(null); // Dummy sentinel head
    private final Node<K> tail = new Node<>(null); // Dummy sentinel tail

    public LRUPolicy() {
        head.next = tail;
        tail.prev = head;
    }

    @Override
    public synchronized void recordAccess(K key) {
        Node<K> node = map.get(key);
        if (node != null) {
            moveToHead(node);
        }
    }

    @Override
    public synchronized void onInsert(K key) {
        Node<K> existing = map.get(key);
        if (existing != null) {
            moveToHead(existing);
        } else {
            Node<K> newNode = new Node<>(key);
            map.put(key, newNode);
            addToHead(newNode);
        }
    }

    @Override
    public synchronized void onRemove(K key) {
        Node<K> node = map.remove(key);
        if (node != null) {
            removeNode(node);
        }
    }

    @Override
    public synchronized K getEvictionCandidate() {
        if (tail.prev == head) return null;
        return tail.prev.key; // Tail is the least recently accessed item
    }

    private void addToHead(Node<K> node) {
        node.next = head.next;
        node.prev = head;
        head.next.prev = node;
        head.next = node;
    }

    private void removeNode(Node<K> node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
        node.prev = null;
        node.next = null;
    }

    private void moveToHead(Node<K> node) {
        removeNode(node);
        addToHead(node);
    }
}`,
  },
  {
    id: 'lfu-policy',
    name: 'LFUPolicy.java',
    filename: 'src/main/java/eviction/LFUPolicy.java',
    description: 'O(1) LFU eviction policy with Frequency Hash Map and LinkedHashSet buckets.',
    code: `package com.cachex.eviction;

import java.util.*;

/**
 * Least Frequently Used (LFU) Eviction Policy.
 * Maintains minFrequency pointer and LinkedHashSet per frequency bucket
 * ensuring O(1) eviction and LRU tie-breaking for equal frequencies.
 */
public class LFUPolicy<K> implements EvictionPolicy<K> {
    private final Map<K, Integer> keyToFreq = new HashMap<>();
    private final Map<Integer, LinkedHashSet<K>> freqToKeys = new HashMap<>();
    private int minFrequency = 0;

    @Override
    public synchronized void recordAccess(K key) {
        Integer freq = keyToFreq.get(key);
        if (freq == null) return;

        // 1. Remove key from current frequency bucket
        LinkedHashSet<K> currentBucket = freqToKeys.get(freq);
        currentBucket.remove(key);

        if (freq == minFrequency && currentBucket.isEmpty()) {
            minFrequency++;
        }

        // 2. Increment and add to next frequency bucket
        int newFreq = freq + 1;
        keyToFreq.put(key, newFreq);
        freqToKeys.computeIfAbsent(newFreq, k -> new LinkedHashSet<>()).add(key);
    }

    @Override
    public synchronized void onInsert(K key) {
        if (keyToFreq.containsKey(key)) {
            recordAccess(key);
            return;
        }

        keyToFreq.put(key, 1);
        minFrequency = 1;
        freqToKeys.computeIfAbsent(1, k -> new LinkedHashSet<>()).add(key);
    }

    @Override
    public synchronized void onRemove(K key) {
        Integer freq = keyToFreq.remove(key);
        if (freq != null) {
            LinkedHashSet<K> bucket = freqToKeys.get(freq);
            if (bucket != null) {
                bucket.remove(key);
                if (bucket.isEmpty() && freq == minFrequency) {
                    minFrequency++;
                }
            }
        }
    }

    @Override
    public synchronized K getEvictionCandidate() {
        LinkedHashSet<K> minBucket = freqToKeys.get(minFrequency);
        if (minBucket == null || minBucket.isEmpty()) return null;

        // LinkedHashSet preserves insertion order (LRU tie-breaker)
        return minBucket.iterator().next();
    }
}`,
  },
  {
    id: 'cache-entry',
    name: 'CacheEntry.java',
    filename: 'src/main/java/cache/CacheEntry.java',
    description: 'Thread-safe cache entry with AtomicLong access count and volatile expiration metadata.',
    code: `package com.cachex.core;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Cache entry encapsulation with independent per-entry TTL.
 */
public class CacheEntry<K, V> {
    private final K key;
    private volatile V value;
    private final long createdAt;
    private final long expiresAt;
    private final AtomicLong accessCount;
    private volatile long lastAccessTime;

    public CacheEntry(K key, V value, long ttlMillis) {
        this.key = key;
        this.value = value;
        this.createdAt = System.currentTimeMillis();
        this.expiresAt = ttlMillis > 0 ? this.createdAt + ttlMillis : Long.MAX_VALUE;
        this.accessCount = new AtomicLong(1);
        this.lastAccessTime = this.createdAt;
    }

    public boolean isExpired() {
        return System.currentTimeMillis() >= expiresAt;
    }

    public K getKey() { return key; }
    public V getValue() { return value; }
    public void setValue(V val) { this.value = val; }
    public long getCreatedAt() { return createdAt; }
    public long getExpiresAt() { return expiresAt; }
    public long getAccessCount() { return accessCount.get(); }
    public void incrementAccessCount() { accessCount.incrementAndGet(); }
    public long getLastAccessTime() { return lastAccessTime; }
    public void setLastAccessTime(long time) { this.lastAccessTime = time; }
}`,
  },
];

export const JavaCodeTab: React.FC = () => {
  const [selectedSnippet, setSelectedSnippet] = useState<CodeSnippet>(JAVA_SNIPPETS[0]);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedSnippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Architectural Header */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-purple-400" />
              Core Java Systems Implementation
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Production-ready, thread-safe Java data structures implementing LRU, LFU, independent TTL, and concurrency locks.
            </p>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors self-start sm:self-auto"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Java Source'}</span>
          </button>
        </div>

        {/* File Tabs */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 text-xs">
          {JAVA_SNIPPETS.map(snippet => (
            <button
              key={snippet.id}
              onClick={() => setSelectedSnippet(snippet)}
              className={`px-3 py-2 rounded-md font-mono flex items-center gap-2 border transition-all whitespace-nowrap ${
                selectedSnippet.id === snippet.id
                  ? 'bg-purple-950/40 border-purple-500 text-purple-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
              <span>{snippet.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">{selectedSnippet.filename}</span>
          <span className="text-slate-500">{selectedSnippet.description}</span>
        </div>

        <pre className="p-5 font-mono text-xs text-slate-200 bg-slate-950 overflow-x-auto leading-relaxed select-text">
          <code>{selectedSnippet.code}</code>
        </pre>
      </div>

      {/* Key Architectural Highlights Card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
        <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
          <span className="font-bold text-cyan-400 flex items-center gap-1.5">
            <Cpu className="w-4 h-4" />
            1. Lock-Splitting Concurrency
          </span>
          <p className="text-slate-400 leading-normal">
            ConcurrentHashMap delivers O(1) lock-free reads for GET operations. ReentrantReadWriteLock is engaged only for structural changes (insertions and evictions), maximizing multi-core throughput.
          </p>
        </div>

        <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
          <span className="font-bold text-indigo-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            2. Decoupled Expiration &amp; Eviction
          </span>
          <p className="text-slate-400 leading-normal">
            TTL expiration is governed by absolute epoch timestamps evaluated lazily on access and actively via a ScheduledExecutorService daemon. Eviction rules (LRU/LFU) operate strictly on capacity limits.
          </p>
        </div>

        <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
          <span className="font-bold text-purple-400 flex items-center gap-1.5">
            <FileCode2 className="w-4 h-4" />
            3. O(1) Algorithmic Invariants
          </span>
          <p className="text-slate-400 leading-normal">
            LRU utilizes a Doubly-Linked List with sentinel head/tail nodes. LFU employs frequency-keyed LinkedHashSets with a dynamic minFrequency pointer to maintain strict O(1) eviction complexity.
          </p>
        </div>
      </div>
    </div>
  );
};
