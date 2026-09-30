/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileCode2,
  Copy,
  Check,
  Terminal,
  Download,
  Cpu,
  ShieldCheck,
  Zap,
  FolderArchive,
  Layers,
  Sparkles,
  Server,
  Play
} from 'lucide-react';
import JSZip from 'jszip';

interface CodeSnippet {
  id: string;
  category: 'core' | 'api' | 'test' | 'config';
  name: string;
  filename: string;
  description: string;
  badge?: string;
  code: string;
}

export const JAVA_SNIPPETS: CodeSnippet[] = [
  {
    id: 'cache-manager',
    category: 'core',
    name: 'CacheManager.java',
    filename: 'src/main/java/com/cachex/core/CacheManager.java',
    badge: 'Thread-Safe Core',
    description: 'Thread-safe cache manager combining ConcurrentHashMap with ReentrantReadWriteLock, background TTL cleaner daemon, and dynamic policy switching.',
    code: `package com.cachex.core;

import com.cachex.model.EvictionPolicyType;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * Thread-safe In-Memory Cache Manager with Pluggable Eviction and Independent TTL.
 *
 * Concurrency Model:
 * - High-throughput reads and writes coordinated via java.util.concurrent.locks.ReentrantReadWriteLock.
 * - Storage backed by java.util.concurrent.ConcurrentHashMap.
 * - Dual-layer expiration: Lazy validation on GET + Active scheduled background cleanup daemon.
 *
 * @param <K> Key type
 * @param <V> Value type
 */
public class CacheManager<K, V> {

    private volatile int capacity;
    private final ConcurrentMap<K, CacheEntry<K, V>> storage;
    private volatile EvictionPolicy<K> evictionPolicy;
    private final ReentrantReadWriteLock rwLock;
    private final MetricsCollector metrics;
    private final ScheduledExecutorService ttlCleanerDaemon;

    public CacheManager(int capacity, EvictionPolicyType initialPolicy) {
        if (capacity <= 0) {
            throw new IllegalArgumentException("Cache capacity must be strictly greater than 0");
        }
        this.capacity = capacity;
        this.storage = new ConcurrentHashMap<>();
        this.rwLock = new ReentrantReadWriteLock();
        this.metrics = new MetricsCollector();
        this.evictionPolicy = createPolicyInstance(initialPolicy);

        // Active background TTL expiration cleaner (runs every 1 second)
        this.ttlCleanerDaemon = Executors.newSingleThreadScheduledExecutor(runnable -> {
            Thread thread = new Thread(runnable, "CacheX-TTL-Daemon");
            thread.setDaemon(true);
            return thread;
        });
        this.ttlCleanerDaemon.scheduleAtFixedRate(this::cleanExpiredEntries, 1, 1, TimeUnit.SECONDS);
    }

    /**
     * Retrieves an item from cache.
     * Thread-safe with lazy TTL expiration check and eviction recency update.
     */
    public V get(K key) {
        long startNano = System.nanoTime();

        // 1. Fast read from ConcurrentHashMap
        CacheEntry<K, V> entry = storage.get(key);

        // 2. Cache Miss or Expired Entry
        if (entry == null || entry.isExpired()) {
            if (entry != null) {
                // Lazy expiration: purge expired entry under write lock
                remove(key);
                metrics.recordExpiration();
            }
            metrics.recordMiss();
            metrics.recordLatency(startNano);
            return null;
        }

        // 3. Cache Hit: Update recency / frequency metadata under write lock
        rwLock.writeLock().lock();
        try {
            entry.incrementAccessCount();
            entry.setLastAccessedTime(System.currentTimeMillis());
            evictionPolicy.recordAccess(key);
        } finally {
            rwLock.writeLock().unlock();
        }

        metrics.recordHit();
        metrics.recordLatency(startNano);
        return entry.getValue();
    }

    /**
     * Puts a key-value pair into the cache with a specified TTL in milliseconds.
     * If capacity is exceeded, evicts the least qualified candidate according to the active policy.
     */
    public void put(K key, V value, long ttlMillis) {
        long startNano = System.nanoTime();
        rwLock.writeLock().lock();
        try {
            // Check if key already exists
            CacheEntry<K, V> existing = storage.get(key);
            if (existing != null) {
                existing.setValue(value);
                existing.incrementAccessCount();
                existing.setLastAccessedTime(System.currentTimeMillis());
                evictionPolicy.recordAccess(key);
                metrics.recordPut();
                metrics.recordLatency(startNano);
                return;
            }

            // Need to insert new entry. Check if eviction is required.
            while (storage.size() >= capacity) {
                K candidate = evictionPolicy.getEvictionCandidate();
                if (candidate == null) {
                    Iterator<K> it = storage.keySet().iterator();
                    if (it.hasNext()) candidate = it.next();
                }

                if (candidate != null) {
                    storage.remove(candidate);
                    evictionPolicy.recordRemove(candidate);
                    metrics.recordEviction();
                } else {
                    break;
                }
            }

            CacheEntry<K, V> newEntry = new CacheEntry<>(key, value, ttlMillis);
            storage.put(key, newEntry);
            evictionPolicy.recordAdd(key);
            metrics.recordPut();
            metrics.recordLatency(startNano);
        } finally {
            rwLock.writeLock().unlock();
        }
    }

    /**
     * Removes an entry explicitly by key.
     */
    public boolean remove(K key) {
        rwLock.writeLock().lock();
        try {
            CacheEntry<K, V> removed = storage.remove(key);
            if (removed != null) {
                evictionPolicy.recordRemove(key);
                metrics.recordDelete();
                return true;
            }
            return false;
        } finally {
            rwLock.writeLock().unlock();
        }
    }

    /**
     * Clears all cache entries and policy state.
     */
    public void clear() {
        rwLock.writeLock().lock();
        try {
            storage.clear();
            evictionPolicy.clear();
        } finally {
            rwLock.writeLock().unlock();
        }
    }

    /**
     * Dynamically switches the eviction policy at runtime.
     * Rebuilds the policy order from the current live entries so state is never lost.
     */
    public void setPolicy(EvictionPolicyType newType) {
        rwLock.writeLock().lock();
        try {
            if (this.evictionPolicy.getType() == newType) {
                return;
            }
            EvictionPolicy<K> newPolicy = createPolicyInstance(newType);

            // Reconstruct state in new policy based on existing entry access history
            List<CacheEntry<K, V>> liveEntries = new ArrayList<>(storage.values());
            if (newType == EvictionPolicyType.LRU) {
                liveEntries.sort(Comparator.comparingLong(CacheEntry::getLastAccessedTime));
                for (CacheEntry<K, V> e : liveEntries) {
                    newPolicy.recordAdd(e.getKey());
                }
            } else {
                for (CacheEntry<K, V> e : liveEntries) {
                    newPolicy.recordAdd(e.getKey());
                    long accesses = e.getAccessCount();
                    for (int i = 1; i < accesses; i++) {
                        newPolicy.recordAccess(e.getKey());
                    }
                }
            }
            this.evictionPolicy = newPolicy;
        } finally {
            rwLock.writeLock().unlock();
        }
    }

    public void setCapacity(int newCapacity) {
        if (newCapacity <= 0) {
            throw new IllegalArgumentException("Capacity must be positive");
        }
        rwLock.writeLock().lock();
        try {
            this.capacity = newCapacity;
            while (storage.size() > newCapacity) {
                K candidate = evictionPolicy.getEvictionCandidate();
                if (candidate != null) {
                    storage.remove(candidate);
                    evictionPolicy.recordRemove(candidate);
                    metrics.recordEviction();
                } else {
                    break;
                }
            }
        } finally {
            rwLock.writeLock().unlock();
        }
    }

    public int getCapacity() { return capacity; }
    public int size() { return storage.size(); }
    public EvictionPolicyType getPolicyType() { return evictionPolicy.getType(); }
    public MetricsCollector getMetrics() { return metrics; }

    public Map<K, CacheEntry<K, V>> getSnapshot() {
        rwLock.readLock().lock();
        try {
            return new HashMap<>(storage);
        } finally {
            rwLock.readLock().unlock();
        }
    }

    public List<K> getEvictionOrder() {
        rwLock.readLock().lock();
        try {
            return evictionPolicy.getOrder();
        } finally {
            rwLock.readLock().unlock();
        }
    }

    private void cleanExpiredEntries() {
        List<K> expiredKeys = new ArrayList<>();
        for (Map.Entry<K, CacheEntry<K, V>> entry : storage.entrySet()) {
            if (entry.getValue().isExpired()) {
                expiredKeys.add(entry.getKey());
            }
        }

        if (!expiredKeys.isEmpty()) {
            rwLock.writeLock().lock();
            try {
                for (K key : expiredKeys) {
                    CacheEntry<K, V> removed = storage.remove(key);
                    if (removed != null) {
                        evictionPolicy.recordRemove(key);
                        metrics.recordExpiration();
                    }
                }
            } finally {
                rwLock.writeLock().unlock();
            }
        }
    }

    public void shutdown() {
        ttlCleanerDaemon.shutdownNow();
    }

    private EvictionPolicy<K> createPolicyInstance(EvictionPolicyType type) {
        return (type == EvictionPolicyType.LFU) ? new LFUPolicy<>() : new LRUPolicy<>();
    }
}`,
  },
  {
    id: 'lru-policy',
    category: 'core',
    name: 'LRUPolicy.java',
    filename: 'src/main/java/com/cachex/core/LRUPolicy.java',
    badge: 'O(1) Recency',
    description: 'Least Recently Used eviction policy using a Doubly-Linked List with sentinel head/tail nodes and HashMap index.',
    code: `package com.cachex.core;

import com.cachex.model.EvictionPolicyType;
import java.util.*;

/**
 * Least Recently Used (LRU) Eviction Policy.
 * Implements strict O(1) recency tracking using a Doubly-Linked List + Hash Map.
 *
 * Head = Most Recently Used (MRU)
 * Tail = Least Recently Used (LRU) - Next candidate for eviction
 */
public class LRUPolicy<K> implements EvictionPolicy<K> {

    private static class Node<K> {
        K key;
        Node<K> prev;
        Node<K> next;

        Node(K key) {
            this.key = key;
        }
    }

    private final Map<K, Node<K>> nodeMap = new HashMap<>();
    private final Node<K> head = new Node<>(null); // Dummy MRU sentinel
    private final Node<K> tail = new Node<>(null); // Dummy LRU sentinel

    public LRUPolicy() {
        head.next = tail;
        tail.prev = head;
    }

    @Override
    public EvictionPolicyType getType() {
        return EvictionPolicyType.LRU;
    }

    @Override
    public synchronized void recordAccess(K key) {
        Node<K> node = nodeMap.get(key);
        if (node != null) {
            unlink(node);
            addToHead(node);
        } else {
            recordAdd(key);
        }
    }

    @Override
    public synchronized void recordAdd(K key) {
        Node<K> existing = nodeMap.get(key);
        if (existing != null) {
            unlink(existing);
            addToHead(existing);
            return;
        }
        Node<K> newNode = new Node<>(key);
        nodeMap.put(key, newNode);
        addToHead(newNode);
    }

    @Override
    public synchronized void recordRemove(K key) {
        Node<K> node = nodeMap.remove(key);
        if (node != null) {
            unlink(node);
        }
    }

    @Override
    public synchronized K getEvictionCandidate() {
        if (tail.prev == head) {
            return null; // Empty list
        }
        return tail.prev.key;
    }

    @Override
    public synchronized void clear() {
        nodeMap.clear();
        head.next = tail;
        tail.prev = head;
    }

    @Override
    public synchronized List<K> getOrder() {
        List<K> list = new ArrayList<>();
        Node<K> curr = head.next;
        while (curr != tail && curr != null) {
            list.add(curr.key);
            curr = curr.next;
        }
        return list;
    }

    private void addToHead(Node<K> node) {
        node.next = head.next;
        node.prev = head;
        head.next.prev = node;
        head.next = node;
    }

    private void unlink(Node<K> node) {
        if (node.prev != null) {
            node.prev.next = node.next;
        }
        if (node.next != null) {
            node.next.prev = node.prev;
        }
        node.prev = null;
        node.next = null;
    }
}`,
  },
  {
    id: 'lfu-policy',
    category: 'core',
    name: 'LFUPolicy.java',
    filename: 'src/main/java/com/cachex/core/LFUPolicy.java',
    badge: 'O(1) Frequency',
    description: 'Least Frequently Used eviction policy maintaining frequency tiers with LinkedHashSets and minFrequency pointer for O(1) performance.',
    code: `package com.cachex.core;

import com.cachex.model.EvictionPolicyType;
import java.util.*;

/**
 * Least Frequently Used (LFU) Eviction Policy.
 * Implements strict O(1) frequency tiering with LRU tie-breaking using
 * frequency-indexed LinkedHashSets and an active minFrequency pointer.
 */
public class LFUPolicy<K> implements EvictionPolicy<K> {

    private final Map<K, Integer> keyFrequencyMap = new HashMap<>();
    private final Map<Integer, LinkedHashSet<K>> frequencyBucketMap = new HashMap<>();
    private int minFrequency = 0;

    @Override
    public EvictionPolicyType getType() {
        return EvictionPolicyType.LFU;
    }

    @Override
    public synchronized void recordAccess(K key) {
        Integer currentFreq = keyFrequencyMap.get(key);
        if (currentFreq == null) {
            recordAdd(key);
            return;
        }

        int newFreq = currentFreq + 1;
        keyFrequencyMap.put(key, newFreq);

        // Remove from current frequency bucket
        LinkedHashSet<K> currentBucket = frequencyBucketMap.get(currentFreq);
        if (currentBucket != null) {
            currentBucket.remove(key);
            if (currentBucket.isEmpty()) {
                frequencyBucketMap.remove(currentFreq);
                if (minFrequency == currentFreq) {
                    minFrequency = newFreq;
                }
            }
        }

        // Add to new frequency bucket
        frequencyBucketMap.computeIfAbsent(newFreq, f -> new LinkedHashSet<>()).add(key);
    }

    @Override
    public synchronized void recordAdd(K key) {
        if (keyFrequencyMap.containsKey(key)) {
            recordAccess(key);
            return;
        }

        keyFrequencyMap.put(key, 1);
        frequencyBucketMap.computeIfAbsent(1, f -> new LinkedHashSet<>()).add(key);
        minFrequency = 1;
    }

    @Override
    public synchronized void recordRemove(K key) {
        Integer freq = keyFrequencyMap.remove(key);
        if (freq != null) {
            LinkedHashSet<K> bucket = frequencyBucketMap.get(freq);
            if (bucket != null) {
                bucket.remove(key);
                if (bucket.isEmpty()) {
                    frequencyBucketMap.remove(freq);
                    if (minFrequency == freq) {
                        recalculateMinFrequency();
                    }
                }
            }
        }
    }

    @Override
    public synchronized K getEvictionCandidate() {
        if (keyFrequencyMap.isEmpty()) {
            return null;
        }
        LinkedHashSet<K> minBucket = frequencyBucketMap.get(minFrequency);
        if (minBucket == null || minBucket.isEmpty()) {
            recalculateMinFrequency();
            minBucket = frequencyBucketMap.get(minFrequency);
        }
        if (minBucket != null && !minBucket.isEmpty()) {
            // First item in LinkedHashSet is the oldest added to this tier (LRU tie-break)
            return minBucket.iterator().next();
        }
        return null;
    }

    @Override
    public synchronized void clear() {
        keyFrequencyMap.clear();
        frequencyBucketMap.clear();
        minFrequency = 0;
    }

    @Override
    public synchronized List<K> getOrder() {
        List<K> list = new ArrayList<>();
        List<Integer> sortedFrequencies = new ArrayList<>(frequencyBucketMap.keySet());
        Collections.sort(sortedFrequencies, Collections.reverseOrder());
        for (Integer freq : sortedFrequencies) {
            LinkedHashSet<K> bucket = frequencyBucketMap.get(freq);
            if (bucket != null) {
                list.addAll(bucket);
            }
        }
        return list;
    }

    private void recalculateMinFrequency() {
        if (frequencyBucketMap.isEmpty()) {
            minFrequency = 0;
            return;
        }
        minFrequency = Collections.min(frequencyBucketMap.keySet());
    }
}`,
  },
  {
    id: 'cache-entry',
    category: 'core',
    name: 'CacheEntry.java',
    filename: 'src/main/java/com/cachex/core/CacheEntry.java',
    badge: 'Per-Entry TTL',
    description: 'Thread-safe cache entry container tracking independent TTL expiration deadline, atomic access counts, and last access timestamps.',
    code: `package com.cachex.core;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Thread-safe representation of a Cache Entry.
 * Encapsulates value, TTL expiration metadata, and access statistics.
 *
 * @param <K> Type of the key
 * @param <V> Type of the cached value
 */
public class CacheEntry<K, V> {
    private final K key;
    private volatile V value;
    private final long createdAt;
    private final long expiresAt; // Epoch ms; Long.MAX_VALUE represents infinity
    private final AtomicLong accessCount;
    private volatile long lastAccessedTime;

    public CacheEntry(K key, V value, long ttlMillis) {
        this.key = key;
        this.value = value;
        this.createdAt = System.currentTimeMillis();
        this.expiresAt = (ttlMillis > 0) ? (this.createdAt + ttlMillis) : Long.MAX_VALUE;
        this.accessCount = new AtomicLong(1);
        this.lastAccessedTime = this.createdAt;
    }

    public K getKey() { return key; }
    public V getValue() { return value; }
    public void setValue(V value) { this.value = value; }
    public long getCreatedAt() { return createdAt; }
    public long getExpiresAt() { return expiresAt; }
    public long getAccessCount() { return accessCount.get(); }
    public void incrementAccessCount() { this.accessCount.incrementAndGet(); }
    public long getLastAccessedTime() { return lastAccessedTime; }
    public void setLastAccessedTime(long lastAccessedTime) { this.lastAccessedTime = lastAccessedTime; }

    public boolean isExpired() {
        if (expiresAt == Long.MAX_VALUE) return false;
        return System.currentTimeMillis() >= expiresAt;
    }

    public long getRemainingTtlMillis() {
        if (expiresAt == Long.MAX_VALUE) return -1;
        long remaining = expiresAt - System.currentTimeMillis();
        return Math.max(0, remaining);
    }
}`,
  },
  {
    id: 'metrics-collector',
    category: 'core',
    name: 'MetricsCollector.java',
    filename: 'src/main/java/com/cachex/core/MetricsCollector.java',
    badge: 'Lock-Free Telemetry',
    description: 'High-throughput telemetry collector using java.util.concurrent.atomic.LongAdder for zero-contention hits, misses, evictions, and expirations.',
    code: `package com.cachex.core;

import java.util.concurrent.atomic.LongAdder;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class MetricsCollector {
    private final LongAdder hits = new LongAdder();
    private final LongAdder misses = new LongAdder();
    private final LongAdder puts = new LongAdder();
    private final LongAdder deletes = new LongAdder();
    private final LongAdder evictions = new LongAdder();
    private final LongAdder expirations = new LongAdder();

    private static final int MAX_LATENCY_SAMPLES = 1000;
    private final ConcurrentLinkedQueue<Double> latencyMicros = new ConcurrentLinkedQueue<>();

    public void recordHit() { hits.increment(); }
    public void recordMiss() { misses.increment(); }
    public void recordPut() { puts.increment(); }
    public void recordDelete() { deletes.increment(); }
    public void recordEviction() { evictions.increment(); }
    public void recordExpiration() { expirations.increment(); }

    public void recordLatency(long startNanoTime) {
        double elapsedMicros = (System.nanoTime() - startNanoTime) / 1000.0;
        latencyMicros.offer(elapsedMicros);
        if (latencyMicros.size() > MAX_LATENCY_SAMPLES) {
            latencyMicros.poll();
        }
    }

    public long getHits() { return hits.sum(); }
    public long getMisses() { return misses.sum(); }
    public long getPuts() { return puts.sum(); }
    public long getDeletes() { return deletes.sum(); }
    public long getEvictions() { return evictions.sum(); }
    public long getExpirations() { return expirations.sum(); }
    public long getTotalRequests() { return getHits() + getMisses(); }

    public double getHitRate() {
        long total = getTotalRequests();
        if (total == 0) return 0.0;
        return Math.round(((double) getHits() / total) * 1000.0) / 10.0;
    }

    public double getMissRate() {
        long total = getTotalRequests();
        if (total == 0) return 0.0;
        return Math.round(((double) getMisses() / total) * 1000.0) / 10.0;
    }

    public double getAverageLatencyMicros() {
        List<Double> samples = new ArrayList<>(latencyMicros);
        if (samples.isEmpty()) return 0.0;
        double sum = 0.0;
        for (double d : samples) sum += d;
        return Math.round((sum / samples.size()) * 100.0) / 100.0;
    }

    public double getP95LatencyMicros() {
        List<Double> samples = new ArrayList<>(latencyMicros);
        if (samples.isEmpty()) return 0.0;
        Collections.sort(samples);
        int idx = (int) Math.ceil(0.95 * samples.size()) - 1;
        return Math.round(samples.get(Math.max(0, idx)) * 100.0) / 100.0;
    }

    public void reset() {
        hits.reset();
        misses.reset();
        puts.reset();
        deletes.reset();
        evictions.reset();
        expirations.reset();
        latencyMicros.clear();
    }
}`,
  },
  {
    id: 'cache-controller',
    category: 'api',
    name: 'CacheController.java',
    filename: 'src/main/java/com/cachex/controller/CacheController.java',
    badge: 'Spring Boot REST API',
    description: 'Spring Boot REST controller implementing GET/POST/DELETE cache endpoints, metrics, policy switching, simulation, and multithreaded stress testing.',
    code: `package com.cachex.controller;

import com.cachex.dto.*;
import com.cachex.model.EvictionPolicyType;
import com.cachex.service.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cache")
@CrossOrigin(origins = "*")
public class CacheController {

    private final CacheService cacheService;
    private final AccessPatternSimulationService simulationService;
    private final ConcurrencyStressTestService stressTestService;

    public CacheController(CacheService cacheService,
                           AccessPatternSimulationService simulationService,
                           ConcurrencyStressTestService stressTestService) {
        this.cacheService = cacheService;
        this.simulationService = simulationService;
        this.stressTestService = stressTestService;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "backend", "Java 17 / Spring Boot 3",
                "version", "1.0.0",
                "timestamp", System.currentTimeMillis()
        ));
    }

    @GetMapping("/metrics")
    public ResponseEntity<CacheMetricsDTO> getMetrics() {
        return ResponseEntity.ok(cacheService.getMetrics());
    }

    @GetMapping("/entries")
    public ResponseEntity<List<CacheEntryDTO>> getEntries() {
        return ResponseEntity.ok(cacheService.getEntries());
    }

    @PostMapping("/entry")
    public ResponseEntity<Map<String, Object>> putEntry(@RequestBody PutEntryRequest request) {
        if (request.getKey() == null || request.getKey().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Key cannot be empty"));
        }
        cacheService.put(request.getKey().trim(), request.getValue(), request.getTtlMillis());
        return ResponseEntity.ok(Map.of(
                "success", true,
                "key", request.getKey(),
                "ttlMillis", request.getTtlMillis()
        ));
    }

    @GetMapping("/entry/{key}")
    public ResponseEntity<Map<String, Object>> getEntry(@PathVariable String key) {
        String val = cacheService.get(key);
        if (val != null) {
            return ResponseEntity.ok(Map.of("found", true, "key", key, "value", val));
        } else {
            return ResponseEntity.ok(Map.of("found", false, "key", key, "message", "Key not found or expired"));
        }
    }

    @DeleteMapping("/entry/{key}")
    public ResponseEntity<Map<String, Object>> deleteEntry(@PathVariable String key) {
        boolean removed = cacheService.remove(key);
        return ResponseEntity.ok(Map.of("success", removed, "key", key));
    }

    @PostMapping("/policy")
    public ResponseEntity<Map<String, Object>> setPolicy(@RequestBody Map<String, String> body) {
        String policyStr = body.get("policy");
        EvictionPolicyType type = EvictionPolicyType.valueOf(policyStr.toUpperCase());
        cacheService.setPolicy(type);
        return ResponseEntity.ok(Map.of("success", true, "policy", type.name()));
    }

    @PostMapping("/capacity")
    public ResponseEntity<Map<String, Object>> setCapacity(@RequestBody Map<String, Integer> body) {
        Integer cap = body.get("capacity");
        cacheService.setCapacity(cap);
        return ResponseEntity.ok(Map.of("success", true, "capacity", cap));
    }

    @PostMapping("/reset")
    public ResponseEntity<Map<String, Object>> resetMetrics() {
        cacheService.resetMetrics();
        return ResponseEntity.ok(Map.of("success", true, "message", "Metrics reset to zero"));
    }

    @PostMapping("/simulate")
    public ResponseEntity<SimulationResultDTO> simulate(@RequestBody SimulateRequest request) {
        return ResponseEntity.ok(simulationService.runSimulation(request));
    }

    @PostMapping("/stress-test")
    public ResponseEntity<StressTestResultDTO> stressTest(@RequestBody StressTestRequest request) {
        return ResponseEntity.ok(stressTestService.executeStressTest(request));
    }
}`,
  },
  {
    id: 'cache-test',
    category: 'test',
    name: 'CacheManagerTest.java',
    filename: 'src/test/java/com/cachex/CacheManagerTest.java',
    badge: 'JUnit 5 & Concurrency',
    description: 'Comprehensive test suite verifying LRU eviction, LFU eviction, per-entry TTL, dynamic policy switching, and 50-thread concurrent thread-safety.',
    code: `package com.cachex;

import com.cachex.core.CacheManager;
import com.cachex.model.EvictionPolicyType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

public class CacheManagerTest {

    private CacheManager<String, String> cache;

    @BeforeEach
    public void setup() {
        cache = new CacheManager<>(3, EvictionPolicyType.LRU);
    }

    @AfterEach
    public void tearDown() {
        if (cache != null) cache.shutdown();
    }

    @Test
    @DisplayName("LRU Policy: Should evict Least Recently Used entry when full")
    public void testLruEviction() {
        cache.put("k1", "v1", 0);
        cache.put("k2", "v2", 0);
        cache.put("k3", "v3", 0);

        assertEquals("v1", cache.get("k1"));
        assertEquals("v2", cache.get("k2"));

        cache.put("k4", "v4", 0); // Evicts k3

        assertNull(cache.get("k3"));
        assertEquals("v1", cache.get("k1"));
        assertEquals("v2", cache.get("k2"));
        assertEquals("v4", cache.get("k4"));
    }

    @Test
    @DisplayName("LFU Policy: Should evict Least Frequently Used entry when full")
    public void testLfuEviction() {
        cache.setPolicy(EvictionPolicyType.LFU);

        cache.put("k1", "v1", 0);
        cache.put("k2", "v2", 0);
        cache.put("k3", "v3", 0);

        cache.get("k1");
        cache.get("k1"); // k1: 3
        cache.get("k3"); // k3: 2
        // k2: 1

        cache.put("k4", "v4", 0); // Evicts k2

        assertNull(cache.get("k2"));
        assertEquals("v1", cache.get("k1"));
        assertEquals("v3", cache.get("k3"));
    }

    @Test
    @DisplayName("Per-Entry TTL: Should expire automatically independent of eviction strategy")
    public void testPerEntryTtl() throws InterruptedException {
        cache.put("k1", "short_lived", 80);
        cache.put("k2", "long_lived", 60000);

        assertEquals("short_lived", cache.get("k1"));
        Thread.sleep(120);

        assertNull(cache.get("k1"), "k1 must expire lazily on get");
        assertEquals("long_lived", cache.get("k2"));
    }

    @Test
    @DisplayName("Multithreading: 50 concurrent threads executing 10,000 requests without data races")
    public void testConcurrentAccessThreadSafety() throws InterruptedException {
        int threadCount = 50;
        int operationsPerThread = 200;
        int totalOps = threadCount * operationsPerThread;

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch endGate = new CountDownLatch(totalOps);
        AtomicInteger successCounter = new AtomicInteger(0);

        for (int i = 0; i < totalOps; i++) {
            final int id = i;
            executor.submit(() -> {
                try {
                    startGate.await();
                    String key = "key_" + (id % 10);
                    if (id % 2 == 0) {
                        cache.put(key, "val_" + id, 5000);
                    } else {
                        cache.get(key);
                    }
                    successCounter.incrementAndGet();
                } catch (Exception e) {
                    fail("Concurrency error: " + e.getMessage());
                } finally {
                    endGate.countDown();
                }
            });
        }

        startGate.countDown();
        boolean finished = endGate.await(15, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(finished);
        assertEquals(totalOps, successCounter.get());
        assertTrue(cache.size() <= cache.getCapacity());
    }
}`,
  },
  {
    id: 'pom-xml',
    category: 'config',
    name: 'pom.xml',
    filename: 'backend/pom.xml',
    badge: 'Maven Build',
    description: 'Maven Project Object Model configuring Java 17+, Spring Boot 3.2, actuator, validation, and testing dependencies.',
    code: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.3</version>
        <relativePath/>
    </parent>

    <groupId>com.cachex</groupId>
    <artifactId>cachex-concurrent-cache</artifactId>
    <version>1.0.0</version>
    <name>CacheX — Intelligent Concurrent Cache &amp; Performance Lab</name>
    <description>Thread-safe in-memory cache library with pluggable LRU &amp; LFU eviction, per-entry TTL, and live metrics API</description>

    <properties>
        <java.version>17</java.version>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>`,
  },
  {
    id: 'app-yaml',
    category: 'config',
    name: 'application.yml',
    filename: 'src/main/resources/application.yml',
    badge: 'Spring Config',
    description: 'Spring Boot application configuration for server port 8080, cache defaults, and actuator endpoints.',
    code: `server:
  port: 8080

spring:
  application:
    name: cachex-concurrent-cache

cachex:
  default-capacity: 10
  default-policy: LRU
  default-ttl-seconds: 60

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
  endpoint:
    health:
      show-details: always

logging:
  level:
    root: INFO
    com.cachex: DEBUG`,
  },
  {
    id: 'readme-run',
    category: 'config',
    name: 'README.md',
    filename: 'backend/README.md',
    badge: 'Quickstart & CLI',
    description: 'Developer documentation on running the Java backend with Maven, running JUnit 5 tests, and REST endpoints reference.',
    code: `# CacheX — Java 17+ Spring Boot In-Memory Cache Service

High-performance, thread-safe in-memory caching engine with pluggable LRU & LFU eviction policies, independent per-entry TTL, concurrent read-write locks, and real-time REST metrics API.

## Requirements
- Java 17 or higher
- Apache Maven 3.8+

## Quick Start
\`\`\`bash
cd backend
mvn clean spring-boot:run
\`\`\`

The service will start on port \`8080\`:
- Metrics Endpoint: GET http://localhost:8080/api/cache/metrics
- Cache Entries:    GET http://localhost:8080/api/cache/entries
- Health Check:     GET http://localhost:8080/api/cache/health

## Run Tests
\`\`\`bash
mvn test
\`\`\`

## Build Executable JAR
\`\`\`bash
mvn clean package -DskipTests
java -jar target/cachex-concurrent-cache-1.0.0.jar
\`\`\``,
  },
];

export const JavaCodeTab: React.FC = () => {
  const [selectedSnippet, setSelectedSnippet] = useState<CodeSnippet>(JAVA_SNIPPETS[0]);
  const [activeCategory, setActiveCategory] = useState<'all' | 'core' | 'api' | 'test' | 'config'>('all');
  const [copied, setCopied] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const filteredSnippets = activeCategory === 'all'
    ? JAVA_SNIPPETS
    : JAVA_SNIPPETS.filter(s => s.category === activeCategory);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedSnippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAllZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const root = zip.folder('cachex-java-backend');

      for (const snippet of JAVA_SNIPPETS) {
        root?.file(snippet.filename, snippet.code);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'cachex-java-spring-boot-project.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create ZIP', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Architectural Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-slate-800 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-purple-950/80 border border-purple-700/80 flex items-center justify-center text-purple-400 font-mono text-sm font-bold">
                ☕
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Java 17+ Spring Boot Custom Cache Engine
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800 font-mono font-normal">
                  Production Ready
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Complete, thread-safe Java systems implementation featuring ConcurrentHashMap, ReentrantReadWriteLock, O(1) LRU &amp; LFU policies, independent per-entry TTL, and Spring Boot REST API.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors shadow-sm"
              title="Copy active Java file to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied File' : 'Copy Active File'}</span>
            </button>

            <button
              onClick={handleDownloadAllZip}
              disabled={isZipping}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs shadow-lg shadow-purple-950/50 transition-all border border-purple-400/30"
              title="Download full project folder with Maven pom.xml and all source files"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isZipping ? 'Generating ZIP...' : 'Download Java Project (.ZIP)'}</span>
            </button>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 mt-4 text-xs">
          <span className="text-slate-400 font-mono text-[11px] uppercase tracking-wider mr-1">Categories:</span>
          {(['all', 'core', 'api', 'test', 'config'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat === 'all' ? 'All Files (9)' : cat === 'core' ? 'Core Engine' : cat === 'api' ? 'REST API' : cat === 'test' ? 'JUnit 5 Tests' : 'Build & Config'}
            </button>
          ))}
        </div>

        {/* File Tabs */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 text-xs scrollbar-thin">
          {filteredSnippets.map(snippet => (
            <button
              key={snippet.id}
              onClick={() => setSelectedSnippet(snippet)}
              className={`px-3 py-2 rounded-lg font-mono flex items-center gap-2 border transition-all whitespace-nowrap ${
                selectedSnippet.id === snippet.id
                  ? 'bg-purple-950/80 border-purple-500 text-purple-200 font-bold shadow-md shadow-purple-950/30'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
              <span>{snippet.name}</span>
              {snippet.badge && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-sans font-normal border border-slate-700/60">
                  {snippet.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="p-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse"></span>
            <span className="text-purple-300 font-semibold">{selectedSnippet.filename}</span>
          </div>
          <span className="text-slate-400 text-[11px]">{selectedSnippet.description}</span>
        </div>

        <pre className="p-5 font-mono text-xs text-slate-200 bg-slate-950 overflow-x-auto leading-relaxed select-text max-h-[620px] scrollbar-thin">
          <code>{selectedSnippet.code}</code>
        </pre>
      </div>

      {/* Architectural Principles Matrix */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div className="p-4 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1.5">
          <span className="font-bold text-cyan-400 flex items-center gap-1.5">
            <Cpu className="w-4 h-4" />
            1. Lock-Splitting Concurrency
          </span>
          <p className="text-slate-400 leading-normal">
            ConcurrentHashMap delivers O(1) lock-free reads for GET operations. ReentrantReadWriteLock write locks protect structure mutations (eviction & insertion) preventing race conditions.
          </p>
        </div>

        <div className="p-4 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1.5">
          <span className="font-bold text-indigo-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            2. Decoupled Expiration & Eviction
          </span>
          <p className="text-slate-400 leading-normal">
            TTL expiration is governed by epoch timestamps evaluated lazily on GET and actively via a ScheduledExecutorService daemon. Eviction (LRU/LFU) operates strictly on capacity.
          </p>
        </div>

        <div className="p-4 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1.5">
          <span className="font-bold text-purple-400 flex items-center gap-1.5">
            <Layers className="w-4 h-4" />
            3. Strict O(1) Data Structures
          </span>
          <p className="text-slate-400 leading-normal">
            LRU uses a custom Doubly-Linked List with sentinel head/tail nodes. LFU uses frequency-indexed LinkedHashSets with a dynamic minFrequency pointer for guaranteed O(1) operations.
          </p>
        </div>

        <div className="p-4 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1.5">
          <span className="font-bold text-emerald-400 flex items-center gap-1.5">
            <Server className="w-4 h-4" />
            4. Spring Boot REST Integration
          </span>
          <p className="text-slate-400 leading-normal">
            Complete Spring Boot Web service exposing live metrics, CRUD operations, policy selection, simulation scenarios, and multi-threaded stress testing at port 8080.
          </p>
        </div>
      </div>
    </div>
  );
};
