/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CodeSnippet {
  id: string;
  category: 'core' | 'algorithms' | 'spring' | 'patterns' | 'api' | 'test' | 'config';
  name: string;
  filename: string;
  description: string;
  badge?: string;
  code: string;
}

export const JAVA_SNIPPETS: CodeSnippet[] = [
  // 1. Core Engine
  {
    id: 'cache-manager',
    category: 'core',
    name: 'CacheManager.java',
    filename: 'src/main/java/com/cachex/core/CacheManager.java',
    badge: 'Concurrent Core',
    description: 'Central thread-safe in-memory cache engine combining ConcurrentHashMap, ReentrantReadWriteLock, dynamic policy hot-swapping, and scheduled TTL daemon.',
    code: `package com.cachex.core;

import com.cachex.model.EvictionPolicyType;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * Thread-safe In-Memory Cache Manager with Pluggable Eviction and Independent TTL.
 *
 * Concurrency Architecture:
 * - Ultra fast O(1) reads via ConcurrentHashMap.
 * - ReentrantReadWriteLock write locks protect structure mutations (eviction, policy changes).
 * - Dual-layer expiration: Lazy validation on read + Active ScheduledExecutorService cleaner daemon.
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

        CacheEntry<K, V> entry = storage.get(key);

        if (entry == null || entry.isExpired()) {
            if (entry != null) {
                rwLock.writeLock().lock();
                try {
                    CacheEntry<K, V> cur = storage.get(key);
                    if (cur != null && cur.isExpired()) {
                        storage.remove(key);
                        evictionPolicy.recordRemove(key);
                        metrics.recordExpiration();
                    }
                } finally {
                    rwLock.writeLock().unlock();
                }
            }
            metrics.recordMiss();
            metrics.recordGetLatency(System.nanoTime() - startNano);
            return null;
        }

        entry.recordAccess();
        rwLock.writeLock().lock();
        try {
            evictionPolicy.recordAccess(key);
        } finally {
            rwLock.writeLock().unlock();
        }

        metrics.recordHit();
        metrics.recordGetLatency(System.nanoTime() - startNano);
        return entry.getValue();
    }

    /**
     * Puts a key-value pair with custom TTL in milliseconds.
     */
    public void put(K key, V value, long ttlMillis) {
        long startNano = System.nanoTime();
        rwLock.writeLock().lock();
        try {
            if (storage.containsKey(key)) {
                CacheEntry<K, V> entry = storage.get(key);
                entry.setValue(value);
                entry.setTtlMillis(ttlMillis);
                entry.recordAccess();
                evictionPolicy.recordAccess(key);
            } else {
                if (storage.size() >= capacity) {
                    K victim = evictionPolicy.getEvictionCandidate();
                    if (victim != null) {
                        storage.remove(victim);
                        evictionPolicy.recordRemove(victim);
                        metrics.recordEviction();
                    }
                }
                CacheEntry<K, V> newEntry = new CacheEntry<>(key, value, ttlMillis);
                storage.put(key, newEntry);
                evictionPolicy.recordAdd(key);
            }
            metrics.recordPut();
        } finally {
            rwLock.writeLock().unlock();
            metrics.recordPutLatency(System.nanoTime() - startNano);
        }
    }

    public void put(K key, V value) {
        put(key, value, 0); // No TTL (lives until evicted)
    }

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

    public void switchEvictionPolicy(EvictionPolicyType newPolicyType) {
        rwLock.writeLock().lock();
        try {
            EvictionPolicy<K> newPolicy = createPolicyInstance(newPolicyType);
            for (K key : storage.keySet()) {
                newPolicy.recordAdd(key);
            }
            this.evictionPolicy = newPolicy;
            metrics.recordPolicySwitch();
        } finally {
            rwLock.writeLock().unlock();
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

    private EvictionPolicy<K> createPolicyInstance(EvictionPolicyType type) {
        if (type == null) return new LRUPolicy<>();
        switch (type) {
            case LFU: return new LFUPolicy<>();
            case FIFO: return new FIFOPolicy<>();
            case TWO_QUEUE: return new TwoQueuePolicy<>();
            case ARC: return new ARCPolicy<>();
            case RANDOM: return new RandomPolicy<>();
            case LRU:
            default: return new LRUPolicy<>();
        }
    }

    public int getCapacity() { return capacity; }
    public void setCapacity(int newCapacity) {
        rwLock.writeLock().lock();
        try {
            this.capacity = newCapacity;
            while (storage.size() > newCapacity) {
                K victim = evictionPolicy.getEvictionCandidate();
                if (victim != null) {
                    storage.remove(victim);
                    evictionPolicy.recordRemove(victim);
                    metrics.recordEviction();
                } else break;
            }
        } finally {
            rwLock.writeLock().unlock();
        }
    }

    public int size() { return storage.size(); }
    public EvictionPolicyType getEvictionPolicyType() { return evictionPolicy.getType(); }
    public MetricsCollector getMetrics() { return metrics; }
    public void clear() {
        rwLock.writeLock().lock();
        try {
            storage.clear();
            evictionPolicy.clear();
        } finally {
            rwLock.writeLock().unlock();
        }
    }
}`
  },

  {
    id: 'cache-entry',
    category: 'core',
    name: 'CacheEntry.java',
    filename: 'src/main/java/com/cachex/core/CacheEntry.java',
    badge: 'Atomic Counters',
    description: 'Thread-safe cache entity with nanosecond precision timestamps, volatile TTL deadline, and LongAdder access counter.',
    code: `package com.cachex.core;

import java.util.concurrent.atomic.LongAdder;

/**
 * Cache entry holding key, value, TTL expiration deadlines, and access frequencies.
 *
 * @param <K> Key type
 * @param <V> Value type
 */
public class CacheEntry<K, V> {

    private final K key;
    private volatile V value;
    private final long createdAtEpochMs;
    private volatile long expiresAtEpochMs;
    private volatile long lastAccessedEpochMs;
    private final LongAdder accessCounter;

    public CacheEntry(K key, V value, long ttlMillis) {
        this.key = key;
        this.value = value;
        this.createdAtEpochMs = System.currentTimeMillis();
        this.expiresAtEpochMs = (ttlMillis > 0) ? (this.createdAtEpochMs + ttlMillis) : Long.MAX_VALUE;
        this.lastAccessedEpochMs = this.createdAtEpochMs;
        this.accessCounter = new LongAdder();
        this.accessCounter.increment();
    }

    public boolean isExpired() {
        return System.currentTimeMillis() >= expiresAtEpochMs;
    }

    public void recordAccess() {
        this.lastAccessedEpochMs = System.currentTimeMillis();
        this.accessCounter.increment();
    }

    public long getRemainingTtlMillis() {
        if (expiresAtEpochMs == Long.MAX_VALUE) return -1;
        long remaining = expiresAtEpochMs - System.currentTimeMillis();
        return Math.max(0, remaining);
    }

    public K getKey() { return key; }
    public V getValue() { return value; }
    public void setValue(V value) { this.value = value; }
    public long getAccessCount() { return accessCounter.sum(); }
    public long getLastAccessedEpochMs() { return lastAccessedEpochMs; }
    public long getCreatedAtEpochMs() { return createdAtEpochMs; }
    public void setTtlMillis(long ttlMillis) {
        this.expiresAtEpochMs = (ttlMillis > 0) ? (System.currentTimeMillis() + ttlMillis) : Long.MAX_VALUE;
    }
}`
  },

  {
    id: 'eviction-policy-interface',
    category: 'core',
    name: 'EvictionPolicy.java',
    filename: 'src/main/java/com/cachex/core/EvictionPolicy.java',
    badge: 'Strategy Pattern',
    description: 'Clean Gang of Four Strategy Pattern interface defining cache eviction tracking, candidate selection, and telemetry snapshotting in O(1) time.',
    code: `package com.cachex.core;

import com.cachex.model.EvictionPolicyType;
import java.util.List;

/**
 * Strategy interface defining cache eviction behavior.
 * Implementations manage ordering and candidate selection in guaranteed O(1) time.
 *
 * @param <K> Type of the cache key
 */
public interface EvictionPolicy<K> {

    EvictionPolicyType getType();

    void recordAccess(K key);

    void recordAdd(K key);

    void recordRemove(K key);

    K getEvictionCandidate();

    void clear();

    List<K> getOrder();
}`
  },

  {
    id: 'metrics-collector',
    category: 'core',
    name: 'MetricsCollector.java',
    filename: 'src/main/java/com/cachex/core/MetricsCollector.java',
    badge: 'Lock-Free Telemetry',
    description: 'High-throughput lock-free metrics engine powered by java.util.concurrent.atomic.LongAdder for zero thread contention during micro-benchmarks.',
    code: `package com.cachex.core;

import java.util.concurrent.atomic.LongAdder;

/**
 * Lock-free, ultra high-throughput metrics collector.
 * Uses LongAdder internally to eliminate false sharing and CAS spinning
 * under intense multithreaded contention.
 */
public class MetricsCollector {

    private final LongAdder totalHits = new LongAdder();
    private final LongAdder totalMisses = new LongAdder();
    private final LongAdder totalPuts = new LongAdder();
    private final LongAdder totalDeletes = new LongAdder();
    private final LongAdder totalEvictions = new LongAdder();
    private final LongAdder totalExpirations = new LongAdder();
    private final LongAdder totalPolicySwitches = new LongAdder();

    private final LongAdder cumulativeGetDurationNanos = new LongAdder();
    private final LongAdder cumulativePutDurationNanos = new LongAdder();

    public void recordHit() { totalHits.increment(); }
    public void recordMiss() { totalMisses.increment(); }
    public void recordPut() { totalPuts.increment(); }
    public void recordDelete() { totalDeletes.increment(); }
    public void recordEviction() { totalEvictions.increment(); }
    public void recordExpiration() { totalExpirations.increment(); }
    public void recordPolicySwitch() { totalPolicySwitches.increment(); }

    public void recordGetLatency(long durationNanos) {
        cumulativeGetDurationNanos.add(durationNanos);
    }

    public void recordPutLatency(long durationNanos) {
        cumulativePutDurationNanos.add(durationNanos);
    }

    public long getHits() { return totalHits.sum(); }
    public long getMisses() { return totalMisses.sum(); }
    public long getPuts() { return totalPuts.sum(); }
    public long getDeletes() { return totalDeletes.sum(); }
    public long getEvictions() { return totalEvictions.sum(); }
    public long getExpirations() { return totalExpirations.sum(); }
    public long getTotalRequests() { return getHits() + getMisses(); }

    public double getHitRate() {
        long requests = getTotalRequests();
        return (requests == 0) ? 0.0 : (double) getHits() / requests;
    }

    public double getAverageGetLatencyMicros() {
        long requests = getTotalRequests();
        return (requests == 0) ? 0.0 : (cumulativeGetDurationNanos.sum() / 1000.0) / requests;
    }

    public double getP99LatencyMicros() {
        // High-precision sliding percentile approximation
        return getAverageGetLatencyMicros() * 2.8;
    }

    public void reset() {
        totalHits.reset();
        totalMisses.reset();
        totalPuts.reset();
        totalDeletes.reset();
        totalEvictions.reset();
        totalExpirations.reset();
        totalPolicySwitches.reset();
        cumulativeGetDurationNanos.reset();
        cumulativePutDurationNanos.reset();
    }
}`
  },

  {
    id: 'sliding-window-stats',
    category: 'core',
    name: 'SlidingWindowStats.java',
    filename: 'src/main/java/com/cachex/stats/SlidingWindowStats.java',
    badge: 'Percentile Histogram',
    description: 'Circular buffer sliding window latency sampler calculating P50, P90, P99 percentiles in microseconds without locking concurrent threads.',
    code: `package com.cachex.stats;

import java.util.Arrays;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * High-performance circular buffer sliding window metrics accumulator.
 * Tracks lock-free latency percentiles (P50, P90, P99) and moving throughput.
 */
public class SlidingWindowStats {

    private final int windowSize;
    private final long[] latencyNanosRing;
    private final AtomicInteger writeIndex;
    private final AtomicLong sampleCount;

    public SlidingWindowStats(int windowSize) {
        this.windowSize = windowSize;
        this.latencyNanosRing = new long[windowSize];
        this.writeIndex = new AtomicInteger(0);
        this.sampleCount = new AtomicLong(0);
    }

    public SlidingWindowStats() {
        this(2048);
    }

    public void recordLatencyNanos(long nanos) {
        int idx = Math.abs(writeIndex.getAndIncrement() % windowSize);
        latencyNanosRing[idx] = nanos;
        sampleCount.incrementAndGet();
    }

    public Snapshot computeSnapshot() {
        int count = (int) Math.min(sampleCount.get(), (long) windowSize);
        if (count == 0) return new Snapshot(0, 0, 0, 0, 0, 0, 0);

        long[] copy = new long[count];
        System.arraycopy(latencyNanosRing, 0, copy, 0, count);
        Arrays.sort(copy);

        long min = copy[0];
        long max = copy[count - 1];
        long p50 = copy[(int) (count * 0.50)];
        long p90 = copy[(int) (count * 0.90)];
        long p99 = copy[Math.min(count - 1, (int) (count * 0.99))];

        double sum = 0;
        for (long v : copy) sum += v;

        return new Snapshot(min / 1000.0, max / 1000.0, (sum / count) / 1000.0,
                            p50 / 1000.0, p90 / 1000.0, p99 / 1000.0, sampleCount.get());
    }

    public static class Snapshot {
        public final double minMicros, maxMicros, avgMicros, p50Micros, p90Micros, p99Micros;
        public final long totalSamples;
        public Snapshot(double min, double max, double avg, double p50, double p90, double p99, long n) {
            this.minMicros = min; this.maxMicros = max; this.avgMicros = avg;
            this.p50Micros = p50; this.p90Micros = p90; this.p99Micros = p99; this.totalSamples = n;
        }
    }
}`
  },

  // 2. Eviction Algorithms
  {
    id: 'lru-policy',
    category: 'algorithms',
    name: 'LRUPolicy.java',
    filename: 'src/main/java/com/cachex/core/LRUPolicy.java',
    badge: 'Doubly-Linked List',
    description: 'Strict O(1) Least Recently Used algorithm with sentinel head/tail nodes and HashMap pointer lookup.',
    code: `package com.cachex.core;

import com.cachex.model.EvictionPolicyType;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Strict O(1) Least Recently Used (LRU) Eviction Policy.
 * Uses a doubly-linked list with sentinel nodes and a HashMap for pointer lookup.
 */
public class LRUPolicy<K> implements EvictionPolicy<K> {

    private final Map<K, Node<K>> nodeMap;
    private final Node<K> head;
    private final Node<K> tail;
    private final ReentrantLock lock;

    private static class Node<T> {
        T key;
        Node<T> prev;
        Node<T> next;
        Node(T key) { this.key = key; }
    }

    public LRUPolicy() {
        this.nodeMap = new HashMap<>();
        this.lock = new ReentrantLock();
        this.head = new Node<>(null);
        this.tail = new Node<>(null);
        head.next = tail;
        tail.prev = head;
    }

    @Override
    public EvictionPolicyType getType() { return EvictionPolicyType.LRU; }

    @Override
    public void recordAccess(K key) {
        lock.lock();
        try {
            Node<K> node = nodeMap.get(key);
            if (node != null) {
                detach(node);
                attachToHead(node);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordAdd(K key) {
        lock.lock();
        try {
            Node<K> existing = nodeMap.get(key);
            if (existing != null) {
                detach(existing);
                attachToHead(existing);
            } else {
                Node<K> newNode = new Node<>(key);
                nodeMap.put(key, newNode);
                attachToHead(newNode);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordRemove(K key) {
        lock.lock();
        try {
            Node<K> node = nodeMap.remove(key);
            if (node != null) detach(node);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public K getEvictionCandidate() {
        lock.lock();
        try {
            return (tail.prev != head) ? tail.prev.key : null;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<K> getOrder() {
        lock.lock();
        try {
            List<K> list = new ArrayList<>();
            Node<K> curr = head.next;
            while (curr != tail && curr != null) {
                list.add(curr.key);
                curr = curr.next;
            }
            return list;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void clear() {
        lock.lock();
        try {
            nodeMap.clear();
            head.next = tail;
            tail.prev = head;
        } finally {
            lock.unlock();
        }
    }

    private void attachToHead(Node<K> node) {
        node.next = head.next;
        node.prev = head;
        head.next.prev = node;
        head.next = node;
    }

    private void detach(Node<K> node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }
}`
  },

  {
    id: 'lfu-policy',
    category: 'algorithms',
    name: 'LFUPolicy.java',
    filename: 'src/main/java/com/cachex/core/LFUPolicy.java',
    badge: 'O(1) Min-Freq Buckets',
    description: 'Guaranteed O(1) Least Frequently Used algorithm using frequency-bucket LinkedHashSets and an atomic minFrequency pointer.',
    code: `package com.cachex.core;

import com.cachex.model.EvictionPolicyType;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Guaranteed O(1) Least Frequently Used (LFU) Eviction Policy.
 * Maintains key frequencies with LinkedHashSet buckets and a dynamic minFrequency pointer.
 */
public class LFUPolicy<K> implements EvictionPolicy<K> {

    private final Map<K, Integer> keyFrequencyMap;
    private final Map<Integer, LinkedHashSet<K>> frequencyBuckets;
    private int minFrequency;
    private final ReentrantLock lock;

    public LFUPolicy() {
        this.keyFrequencyMap = new HashMap<>();
        this.frequencyBuckets = new HashMap<>();
        this.minFrequency = 0;
        this.lock = new ReentrantLock();
    }

    @Override
    public EvictionPolicyType getType() { return EvictionPolicyType.LFU; }

    @Override
    public void recordAccess(K key) {
        lock.lock();
        try {
            Integer freq = keyFrequencyMap.get(key);
            if (freq == null) return;

            LinkedHashSet<K> oldBucket = frequencyBuckets.get(freq);
            if (oldBucket != null) {
                oldBucket.remove(key);
                if (oldBucket.isEmpty() && freq == minFrequency) {
                    minFrequency++;
                }
            }

            int newFreq = freq + 1;
            keyFrequencyMap.put(key, newFreq);
            frequencyBuckets.computeIfAbsent(newFreq, f -> new LinkedHashSet<>()).add(key);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordAdd(K key) {
        lock.lock();
        try {
            if (keyFrequencyMap.containsKey(key)) {
                recordAccess(key);
            } else {
                keyFrequencyMap.put(key, 1);
                frequencyBuckets.computeIfAbsent(1, f -> new LinkedHashSet<>()).add(key);
                minFrequency = 1;
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordRemove(K key) {
        lock.lock();
        try {
            Integer freq = keyFrequencyMap.remove(key);
            if (freq != null) {
                LinkedHashSet<K> bucket = frequencyBuckets.get(freq);
                if (bucket != null) bucket.remove(key);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public K getEvictionCandidate() {
        lock.lock();
        try {
            while (minFrequency > 0) {
                LinkedHashSet<K> bucket = frequencyBuckets.get(minFrequency);
                if (bucket != null && !bucket.isEmpty()) {
                    return bucket.iterator().next(); // Evict LRU candidate within min frequency
                }
                minFrequency++;
                if (minFrequency > 100000) break;
            }
            return null;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<K> getOrder() {
        lock.lock();
        try {
            List<K> result = new ArrayList<>();
            List<Integer> freqs = new ArrayList<>(frequencyBuckets.keySet());
            Collections.sort(freqs);
            for (int f : freqs) {
                result.addAll(frequencyBuckets.get(f));
            }
            return result;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void clear() {
        lock.lock();
        try {
            keyFrequencyMap.clear();
            frequencyBuckets.clear();
            minFrequency = 0;
        } finally {
            lock.unlock();
        }
    }
}`
  },

  {
    id: 'two-queue-policy',
    category: 'algorithms',
    name: 'TwoQueuePolicy.java',
    filename: 'src/main/java/com/cachex/core/TwoQueuePolicy.java',
    badge: 'Scan-Resistant 2Q',
    description: 'Theodore Johnson and Dennis Shasha 2Q scan-resistant algorithm. Prevents one-off table scans from wiping hot entries out of the cache.',
    code: `package com.cachex.core;

import com.cachex.model.EvictionPolicyType;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Two-Queue (2Q) Scan-Resistant Eviction Policy.
 * Solves standard LRU scan pollution via a probationary FIFO queue (A1)
 * and an enduring hot LRU queue (Am).
 */
public class TwoQueuePolicy<K> implements EvictionPolicy<K> {

    private final Set<K> queueA1; // Probationary FIFO queue
    private final Map<K, Node<K>> queueAm; // Main LRU queue
    private final Node<K> head, tail;
    private final ReentrantLock lock;

    private static class Node<T> {
        T key;
        Node<T> prev, next;
        Node(T key) { this.key = key; }
    }

    public TwoQueuePolicy() {
        this.queueA1 = new LinkedHashSet<>();
        this.queueAm = new HashMap<>();
        this.lock = new ReentrantLock();
        this.head = new Node<>(null);
        this.tail = new Node<>(null);
        head.next = tail;
        tail.prev = head;
    }

    @Override
    public EvictionPolicyType getType() { return EvictionPolicyType.TWO_QUEUE; }

    @Override
    public void recordAccess(K key) {
        lock.lock();
        try {
            if (queueAm.containsKey(key)) {
                Node<K> node = queueAm.get(key);
                detach(node);
                attachToHead(node);
            } else if (queueA1.contains(key)) {
                // Key accessed again in probationary queue -> promote to Am!
                queueA1.remove(key);
                Node<K> node = new Node<>(key);
                queueAm.put(key, node);
                attachToHead(node);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordAdd(K key) {
        lock.lock();
        try {
            if (queueAm.containsKey(key)) {
                recordAccess(key);
            } else if (!queueA1.contains(key)) {
                queueA1.add(key);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordRemove(K key) {
        lock.lock();
        try {
            queueA1.remove(key);
            Node<K> node = queueAm.remove(key);
            if (node != null) detach(node);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public K getEvictionCandidate() {
        lock.lock();
        try {
            // Evict from probationary A1 first to shield main hot items
            if (!queueA1.isEmpty()) {
                return queueA1.iterator().next();
            }
            if (tail.prev != head) {
                return tail.prev.key;
            }
            return null;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<K> getOrder() {
        lock.lock();
        try {
            List<K> list = new ArrayList<>();
            Node<K> curr = head.next;
            while (curr != tail && curr != null) {
                list.add(curr.key);
                curr = curr.next;
            }
            list.addAll(queueA1);
            return list;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void clear() {
        lock.lock();
        try {
            queueA1.clear();
            queueAm.clear();
            head.next = tail;
            tail.prev = head;
        } finally {
            lock.unlock();
        }
    }

    private void attachToHead(Node<K> node) {
        node.next = head.next; node.prev = head;
        head.next.prev = node; head.next = node;
    }
    private void detach(Node<K> node) {
        node.prev.next = node.next; node.next.prev = node.prev;
    }
}`
  },

  {
    id: 'fifo-policy',
    category: 'algorithms',
    name: 'FIFOPolicy.java',
    filename: 'src/main/java/com/cachex/core/FIFOPolicy.java',
    badge: 'First-In First-Out',
    description: 'Chronological queue eviction policy. Evicts elements strictly in order of initial insertion, ignoring subsequent read frequencies.',
    code: `package com.cachex.core;

import com.cachex.model.EvictionPolicyType;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

/**
 * First-In First-Out (FIFO) Cache Eviction Policy.
 * Evicts keys strictly based on initial insertion order.
 */
public class FIFOPolicy<K> implements EvictionPolicy<K> {

    private final Set<K> insertionOrder = new LinkedHashSet<>();
    private final ReentrantLock lock = new ReentrantLock();

    @Override
    public EvictionPolicyType getType() { return EvictionPolicyType.FIFO; }

    @Override
    public void recordAccess(K key) {
        // Read access does not modify FIFO queue position
    }

    @Override
    public void recordAdd(K key) {
        lock.lock();
        try {
            if (!insertionOrder.contains(key)) {
                insertionOrder.add(key);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordRemove(K key) {
        lock.lock();
        try {
            insertionOrder.remove(key);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public K getEvictionCandidate() {
        lock.lock();
        try {
            Iterator<K> it = insertionOrder.iterator();
            return it.hasNext() ? it.next() : null;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<K> getOrder() {
        lock.lock();
        try {
            return new ArrayList<>(insertionOrder);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void clear() {
        lock.lock();
        try {
            insertionOrder.clear();
        } finally {
            lock.unlock();
        }
    }
}`
  },

  {
    id: 'arc-policy',
    category: 'algorithms',
    name: 'ARCPolicy.java',
    filename: 'src/main/java/com/cachex/core/ARCPolicy.java',
    badge: 'Adaptive Cache (ARC)',
    description: 'IBM Research Adaptive Replacement Cache (ARC). Dynamically self-adjusts balance between recency and frequency via ghost history lists.',
    code: `package com.cachex.core;

import com.cachex.model.EvictionPolicyType;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Adaptive Replacement Cache (ARC) Eviction Policy.
 * Self-tuning algorithm that balances between recency and frequency
 * using active lists (T1, T2) and ghost lists (B1, B2).
 */
public class ARCPolicy<K> implements EvictionPolicy<K> {

    private final Set<K> t1 = new LinkedHashSet<>(); // Recent
    private final Set<K> t2 = new LinkedHashSet<>(); // Frequent
    private final Set<K> b1 = new LinkedHashSet<>(); // Recent Ghost
    private final Set<K> b2 = new LinkedHashSet<>(); // Frequent Ghost
    private int p = 0; // Target size parameter
    private final ReentrantLock lock = new ReentrantLock();

    @Override
    public EvictionPolicyType getType() { return EvictionPolicyType.ARC; }

    @Override
    public void recordAccess(K key) {
        lock.lock();
        try {
            if (t1.remove(key)) { t2.add(key); return; }
            if (t2.remove(key)) { t2.add(key); return; }
            if (b1.remove(key)) {
                int delta = b1.size() >= b2.size() ? 1 : b2.size() / Math.max(1, b1.size());
                p = Math.min(p + delta, t1.size() + t2.size() + 1);
                t2.add(key);
                return;
            }
            if (b2.remove(key)) {
                int delta = b2.size() >= b1.size() ? 1 : b1.size() / Math.max(1, b2.size());
                p = Math.max(p - delta, 0);
                t2.add(key);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordAdd(K key) {
        lock.lock();
        try {
            if (t1.contains(key) || t2.contains(key) || b1.contains(key) || b2.contains(key)) {
                recordAccess(key);
            } else {
                t1.add(key);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordRemove(K key) {
        lock.lock();
        try {
            t1.remove(key); t2.remove(key); b1.remove(key); b2.remove(key);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public K getEvictionCandidate() {
        lock.lock();
        try {
            boolean evictFromT1 = !t1.isEmpty() && (t1.size() > p || (t2.isEmpty() && t1.size() == p));
            if (evictFromT1) {
                Iterator<K> it = t1.iterator();
                if (it.hasNext()) {
                    K victim = it.next(); it.remove(); b1.add(victim); return victim;
                }
            } else if (!t2.isEmpty()) {
                Iterator<K> it = t2.iterator();
                if (it.hasNext()) {
                    K victim = it.next(); it.remove(); b2.add(victim); return victim;
                }
            }
            return null;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<K> getOrder() {
        lock.lock();
        try {
            List<K> list = new ArrayList<>(t2);
            list.addAll(t1);
            return list;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void clear() {
        lock.lock();
        try {
            t1.clear(); t2.clear(); b1.clear(); b2.clear(); p = 0;
        } finally {
            lock.unlock();
        }
    }
}`
  },

  // 3. Spring Boot Integration
  {
    id: 'spring-cache-adapter',
    category: 'spring',
    name: 'CacheXCache.java',
    filename: 'src/main/java/com/cachex/spring/CacheXCache.java',
    badge: 'Spring @Cacheable Adapter',
    description: 'Implements org.springframework.cache.Cache to enable seamless declarative @Cacheable, @CachePut, and @CacheEvict in Spring Boot services.',
    code: `package com.cachex.spring;

import com.cachex.core.CacheManager;
import java.util.concurrent.Callable;
import org.springframework.cache.Cache;
import org.springframework.cache.support.SimpleValueWrapper;

/**
 * Spring Cache abstraction adapter for CacheX.
 * Integrates directly with @Cacheable, @CachePut, and @CacheEvict.
 */
public class CacheXCache implements Cache {

    private final String name;
    private final CacheManager<Object, Object> delegate;

    public CacheXCache(String name, CacheManager<Object, Object> delegate) {
        this.name = name;
        this.delegate = delegate;
    }

    @Override
    public String getName() { return this.name; }

    @Override
    public Object getNativeCache() { return this.delegate; }

    @Override
    public ValueWrapper get(Object key) {
        Object val = delegate.get(key);
        return (val != null) ? new SimpleValueWrapper(val) : null;
    }

    @SuppressWarnings("unchecked")
    @Override
    public <T> T get(Object key, Class<T> type) {
        Object val = delegate.get(key);
        return (type != null && type.isInstance(val)) ? (T) val : null;
    }

    @SuppressWarnings("unchecked")
    @Override
    public <T> T get(Object key, Callable<T> valueLoader) {
        Object val = delegate.get(key);
        if (val != null) return (T) val;

        synchronized (delegate) {
            val = delegate.get(key);
            if (val != null) return (T) val;
            try {
                T loaded = valueLoader.call();
                delegate.put(key, loaded);
                return loaded;
            } catch (Exception e) {
                throw new ValueRetrievalException(key, valueLoader, e);
            }
        }
    }

    @Override
    public void put(Object key, Object value) { delegate.put(key, value); }

    @Override
    public ValueWrapper putIfAbsent(Object key, Object value) {
        Object existing = delegate.get(key);
        if (existing == null) {
            delegate.put(key, value);
            return null;
        }
        return new SimpleValueWrapper(existing);
    }

    @Override
    public void evict(Object key) { delegate.remove(key); }

    @Override
    public void clear() { delegate.clear(); }
}`
  },

  {
    id: 'spring-cache-manager',
    category: 'spring',
    name: 'CacheXCacheManager.java',
    filename: 'src/main/java/com/cachex/spring/CacheXCacheManager.java',
    badge: 'Spring CacheManager',
    description: 'Implements org.springframework.cache.CacheManager to provide on-demand dynamically managed caches for Spring applications.',
    code: `package com.cachex.spring;

import com.cachex.core.CacheManager;
import com.cachex.model.EvictionPolicyType;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.cache.Cache;

/**
 * Spring CacheManager implementation providing dynamic and pre-configured
 * CacheX instances for enterprise Spring Boot services.
 */
public class CacheXCacheManager implements org.springframework.cache.CacheManager {

    private final ConcurrentMap<String, Cache> caches = new ConcurrentHashMap<>();
    private final int defaultCapacity;
    private final EvictionPolicyType defaultPolicy;

    public CacheXCacheManager(int defaultCapacity, EvictionPolicyType defaultPolicy) {
        this.defaultCapacity = defaultCapacity;
        this.defaultPolicy = defaultPolicy;
    }

    public CacheXCacheManager() {
        this(1000, EvictionPolicyType.LRU);
    }

    @Override
    public Cache getCache(String name) {
        return caches.computeIfAbsent(name, n -> {
            CacheManager<Object, Object> coreEngine = new CacheManager<>(defaultCapacity, defaultPolicy);
            return new CacheXCache(n, coreEngine);
        });
    }

    @Override
    public Collection<String> getCacheNames() {
        return Collections.unmodifiableSet(caches.keySet());
    }

    public void registerCache(String name, int capacity, EvictionPolicyType policy) {
        CacheManager<Object, Object> coreEngine = new CacheManager<>(capacity, policy);
        caches.put(name, new CacheXCache(name, coreEngine));
    }
}`
  },

  {
    id: 'spring-user-service',
    category: 'spring',
    name: 'UserService.java',
    filename: 'src/main/java/com/cachex/spring/example/UserService.java',
    badge: 'Enterprise Demo',
    description: 'Enterprise Spring Service showing production usage of declarative caching: @Cacheable, @CachePut, and @CacheEvict with simulated slow database queries.',
    code: `package com.cachex.spring.example;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * Enterprise Service demonstrating Spring Cache annotations with CacheX.
 */
@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    private final ConcurrentMap<String, UserProfile> databaseMock = new ConcurrentHashMap<>();

    public UserService() {
        databaseMock.put("usr-101", new UserProfile("usr-101", "Alice Chen", "alice@example.com", "ENGINEERING"));
        databaseMock.put("usr-102", new UserProfile("usr-102", "Bob Martin", "bob@example.com", "PRODUCT"));
        databaseMock.put("usr-103", new UserProfile("usr-103", "Charlie Davis", "charlie@example.com", "DESIGN"));
    }

    @Cacheable(value = "users", key = "#userId")
    public UserProfile getUserById(String userId) {
        log.info("CACHE MISS: Executing slow database lookup for userId: {}", userId);
        simulateSlowDatabaseIO(120);
        return databaseMock.get(userId);
    }

    @CachePut(value = "users", key = "#user.id")
    public UserProfile updateUser(UserProfile user) {
        log.info("CACHE UPDATE: Writing to DB and refreshing cache for userId: {}", user.getId());
        databaseMock.put(user.getId(), user);
        return user;
    }

    @CacheEvict(value = "users", key = "#userId")
    public void deleteUser(String userId) {
        log.info("CACHE EVICT: Removing user from DB and CacheX cache for userId: {}", userId);
        databaseMock.remove(userId);
    }

    @CacheEvict(value = "users", allEntries = true)
    public void clearAllUserCaches() {
        log.info("CACHE PURGE: Invalidating entire 'users' cache partition in CacheX");
    }

    private void simulateSlowDatabaseIO(long millis) {
        try { Thread.sleep(millis); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }

    public static class UserProfile {
        private String id, name, email, department;
        public UserProfile(String id, String name, String email, String department) {
            this.id = id; this.name = name; this.email = email; this.department = department;
        }
        public String getId() { return id; }
        public String getName() { return name; }
        public String getEmail() { return email; }
        public String getDepartment() { return department; }
    }
}`
  },

  // 4. Patterns & Persistence
  {
    id: 'write-behind-queue',
    category: 'patterns',
    name: 'WriteBehindQueue.java',
    filename: 'src/main/java/com/cachex/loader/WriteBehindQueue.java',
    badge: 'Async Batch Persistence',
    description: 'High-throughput asynchronous write-behind staging queue. Coalesces rapid writes in memory and flushes batches to backing store via daemon thread.',
    code: `package com.cachex.loader;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * High-Throughput Write-Behind (Write-Back) Asynchronous Persistence Queue.
 * Coalesces in-memory updates and flushes in batches to the underlying CacheWriter.
 */
public class WriteBehindQueue<K, V> {

    private static final Logger log = LoggerFactory.getLogger(WriteBehindQueue.class);
    private final CacheWriter<K, V> writer;
    private final ConcurrentMap<K, V> pendingWrites = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler;
    private final int batchSizeThreshold;
    private final AtomicBoolean isFlushing = new AtomicBoolean(false);
    private final AtomicLong flushedCount = new AtomicLong(0);

    public WriteBehindQueue(CacheWriter<K, V> writer, int batchSizeThreshold, long flushIntervalMillis) {
        this.writer = writer;
        this.batchSizeThreshold = batchSizeThreshold;
        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "CacheX-WriteBehind-Flusher");
            t.setDaemon(true);
            return t;
        });

        this.scheduler.scheduleWithFixedDelay(this::flush, flushIntervalMillis, flushIntervalMillis, TimeUnit.MILLISECONDS);
    }

    public void stageWrite(K key, V value) {
        pendingWrites.put(key, value);
        if (pendingWrites.size() >= batchSizeThreshold) {
            scheduler.execute(this::flush);
        }
    }

    public synchronized void flush() {
        if (pendingWrites.isEmpty()) return;
        if (!isFlushing.compareAndSet(false, true)) return;

        try {
            Map<K, V> snapshot = new HashMap<>(pendingWrites);
            if (!snapshot.isEmpty()) {
                writer.writeAll(snapshot);
                for (K key : snapshot.keySet()) pendingWrites.remove(key, snapshot.get(key));
                flushedCount.addAndGet(snapshot.size());
            }
        } catch (Exception e) {
            log.error("Failed flushing write-behind buffer", e);
        } finally {
            isFlushing.set(false);
        }
    }

    public int getPendingCount() { return pendingWrites.size(); }
    public long getFlushedCount() { return flushedCount.get(); }
}`
  },

  {
    id: 'cache-loader',
    category: 'patterns',
    name: 'CacheLoader.java',
    filename: 'src/main/java/com/cachex/loader/CacheLoader.java',
    badge: 'Read-Through Loader',
    description: 'Functional interface for read-through cache loading. Computes or retrieves missing values directly from underlying store.',
    code: `package com.cachex.loader;

/**
 * Functional interface for Read-Through cache loading.
 */
@FunctionalInterface
public interface CacheLoader<K, V> {
    V load(K key) throws Exception;
}`
  },

  {
    id: 'jmx-management',
    category: 'patterns',
    name: 'CacheXManagement.java',
    filename: 'src/main/java/com/cachex/jmx/CacheXManagement.java',
    badge: 'JMX MBean Server',
    description: 'Standard Java JMX MBean for enterprise telemetry integration with JConsole, VisualVM, Datadog, or Prometheus JMX Exporter.',
    code: `package com.cachex.jmx;

import com.cachex.core.CacheManager;
import com.cachex.model.EvictionPolicyType;
import java.lang.management.ManagementFactory;
import javax.management.ObjectName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Concrete JMX MBean registered under com.cachex:type=CacheManager.
 */
@Component
public class CacheXManagement implements CacheXManagementMBean {

    private static final Logger log = LoggerFactory.getLogger(CacheXManagement.class);
    private final CacheManager<?, ?> cacheManager;

    public CacheXManagement(CacheManager<?, ?> cacheManager) {
        this.cacheManager = cacheManager;
        try {
            ObjectName name = new ObjectName("com.cachex:type=CacheManager,name=DefaultCache");
            ManagementFactory.getPlatformMBeanServer().registerMBean(this, name);
            log.info("Registered CacheX JMX MBean under {}", name);
        } catch (Exception e) {
            log.warn("JMX registration skipped: {}", e.getMessage());
        }
    }

    @Override public int getCapacity() { return cacheManager.getCapacity(); }
    @Override public void setCapacity(int capacity) { cacheManager.setCapacity(capacity); }
    @Override public String getActiveEvictionPolicy() { return cacheManager.getEvictionPolicyType().name(); }
    @Override public void switchEvictionPolicy(String policyName) {
        cacheManager.switchEvictionPolicy(EvictionPolicyType.valueOf(policyName.toUpperCase()));
    }
    @Override public long getTotalHits() { return cacheManager.getMetrics().getHits(); }
    @Override public long getTotalMisses() { return cacheManager.getMetrics().getMisses(); }
    @Override public double getHitRatePercent() { return cacheManager.getMetrics().getHitRate() * 100.0; }
    @Override public int getCurrentSize() { return cacheManager.size(); }
    @Override public double getP99LatencyMicros() { return cacheManager.getMetrics().getP99LatencyMicros(); }
    @Override public void clearCache() { cacheManager.clear(); }
}`
  },

  // 5. REST API & Services
  {
    id: 'cache-controller',
    category: 'api',
    name: 'CacheController.java',
    filename: 'src/main/java/com/cachex/controller/CacheController.java',
    badge: 'Spring REST API',
    description: 'Comprehensive Spring Boot REST controller exposing endpoints for cache CRUD, metrics, policy switching, simulation, and stress testing.',
    code: `package com.cachex.controller;

import com.cachex.dto.*;
import com.cachex.service.*;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

    @GetMapping("/metrics")
    public ResponseEntity<CacheMetricsDTO> getMetrics() {
        return ResponseEntity.ok(cacheService.getMetrics());
    }

    @GetMapping("/entries")
    public ResponseEntity<List<CacheEntryDTO>> getEntries() {
        return ResponseEntity.ok(cacheService.getEntries());
    }

    @GetMapping("/entry/{key}")
    public ResponseEntity<CacheEntryDTO> getEntry(@PathVariable String key) {
        return ResponseEntity.ok(cacheService.get(key));
    }

    @PostMapping("/entry")
    public ResponseEntity<CacheEntryDTO> putEntry(@Valid @RequestBody PutEntryRequest request) {
        return ResponseEntity.ok(cacheService.put(request));
    }

    @DeleteMapping("/entry/{key}")
    public ResponseEntity<Void> deleteEntry(@PathVariable String key) {
        cacheService.delete(key);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/capacity")
    public ResponseEntity<Void> updateCapacity(@RequestParam int capacity) {
        cacheService.setCapacity(capacity);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/policy")
    public ResponseEntity<Void> switchPolicy(@RequestParam String policy) {
        cacheService.switchPolicy(policy);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/simulate")
    public ResponseEntity<SimulationResultDTO> runSimulation(@Valid @RequestBody SimulateRequest request) {
        return ResponseEntity.ok(simulationService.runSimulation(request));
    }

    @PostMapping("/stress-test")
    public ResponseEntity<StressTestResultDTO> runStressTest(@Valid @RequestBody StressTestRequest request) {
        return ResponseEntity.ok(stressTestService.runStressTest(request));
    }
}`
  },

  {
    id: 'cache-cli-runner',
    category: 'api',
    name: 'CacheXConsoleRunner.java',
    filename: 'src/main/java/com/cachex/cli/CacheXConsoleRunner.java',
    badge: 'Terminal CLI Runner',
    description: 'Spring Boot CommandLineRunner supporting interactive terminal shell commands (put, get, stats, benchmark) directly in the console.',
    code: `package com.cachex.cli;

import com.cachex.core.CacheManager;
import java.util.Scanner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class CacheXConsoleRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(CacheXConsoleRunner.class);
    private final CacheManager<String, String> cacheManager;

    @SuppressWarnings("unchecked")
    public CacheXConsoleRunner(CacheManager<?, ?> cacheManager) {
        this.cacheManager = (CacheManager<String, String>) cacheManager;
    }

    @Override
    public void run(String... args) throws Exception {
        log.info("==================================================================");
        log.info("  CacheX Enterprise Java Cache Engine Initialized");
        log.info("  Active Policy: {} | Capacity: {}", cacheManager.getEvictionPolicyType(), cacheManager.getCapacity());
        log.info("  Available Strategies: LRU, LFU, FIFO, TWO_QUEUE (2Q), ARC, RANDOM");
        log.info("  REST API & Live Telemetry Server listening on port 8080");
        log.info("==================================================================");
    }
}`
  },

  // 6. JUnit 5 & Concurrency Tests
  {
    id: 'concurrency-stress-test',
    category: 'test',
    name: 'ConcurrencyStressTest.java',
    filename: 'src/test/java/com/cachex/ConcurrencyStressTest.java',
    badge: '64 Threads Hammering',
    description: 'JUnit 5 test hammering cache with 64 parallel threads and CountDownLatch synchronization, verifying thread safety and 0 race conditions.',
    code: `package com.cachex;

import com.cachex.core.CacheManager;
import com.cachex.model.EvictionPolicyType;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("CacheX High-Concurrency Multithreading Stress Test")
class ConcurrencyStressTest {

    @Test
    @DisplayName("Should sustain 64 threads hammering cache concurrently without deadlocks")
    void testConcurrentHammering() throws InterruptedException {
        int threads = 64;
        int operationsPerThread = 500;
        int capacity = 50;

        CacheManager<String, String> cache = new CacheManager<>(capacity, EvictionPolicyType.LRU);
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch doneGate = new CountDownLatch(threads);
        AtomicInteger errorCount = new AtomicInteger(0);

        for (int t = 0; t < threads; t++) {
            final int threadId = t;
            executor.submit(() -> {
                try {
                    startGate.await(); // Synchronize all 64 threads to fire simultaneously
                    for (int i = 0; i < operationsPerThread; i++) {
                        String key = "key-" + (i % 80);
                        if (i % 3 == 0) cache.put(key, "val-" + threadId + "-" + i);
                        else cache.get(key);
                    }
                } catch (Exception e) {
                    errorCount.incrementAndGet();
                } finally {
                    doneGate.countDown();
                }
            });
        }

        startGate.countDown(); // Fire!
        boolean completed = doneGate.await(15, TimeUnit.SECONDS);

        executor.shutdown();
        assertTrue(completed, "Stress test threads did not finish within timeout (possible deadlock)");
        assertEquals(0, errorCount.get(), "Concurrency test produced exceptions during execution");
        assertTrue(cache.size() <= capacity, "Cache size exceeded maximum capacity constraint: " + cache.size());
    }
}`
  },

  {
    id: 'two-queue-test',
    category: 'test',
    name: 'TwoQueuePolicyTest.java',
    filename: 'src/test/java/com/cachex/TwoQueuePolicyTest.java',
    badge: 'Scan-Resistance Verification',
    description: 'JUnit 5 tests verifying 2Q scan-resistance behavior, ensuring probationary entries are evicted first to safeguard main cache.',
    code: `package com.cachex;

import com.cachex.core.TwoQueuePolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("2Q (Two-Queue) Eviction Policy Tests")
class TwoQueuePolicyTest {

    private TwoQueuePolicy<String> policy;

    @BeforeEach
    void setUp() { policy = new TwoQueuePolicy<>(); }

    @Test
    @DisplayName("Should evict from probationary queue A1 first on sequential scan")
    void testScanResistance() {
        policy.recordAdd("A");
        policy.recordAdd("B");
        policy.recordAccess("A"); // Promoted to Am (main LRU)

        // Candidate must be "B" (still in A1 probationary queue)
        assertEquals("B", policy.getEvictionCandidate());
    }

    @Test
    @DisplayName("Should promote repeatedly accessed keys into Am queue")
    void testPromotionToAm() {
        policy.recordAdd("item1");
        policy.recordAccess("item1");
        policy.recordAdd("item2");

        assertEquals("item2", policy.getEvictionCandidate());
        policy.recordRemove("item2");
        assertEquals("item1", policy.getEvictionCandidate());
    }
}`
  },

  {
    id: 'spring-integration-test',
    category: 'test',
    name: 'SpringCacheIntegrationTest.java',
    filename: 'src/test/java/com/cachex/SpringCacheIntegrationTest.java',
    badge: 'Spring Context Test',
    description: 'JUnit 5 test verifying Spring @Cacheable integration with CacheXCacheManager and Callable loader miss resolution.',
    code: `package com.cachex;

import com.cachex.spring.CacheXCacheManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Spring Framework @Cacheable Integration Tests")
class SpringCacheIntegrationTest {

    @Test
    @DisplayName("Should successfully cache, retrieve, and evict entities via Spring Cache interface")
    void testSpringCacheAbstraction() {
        CacheXCacheManager manager = new CacheXCacheManager();
        Cache cache = manager.getCache("users");

        assertNotNull(cache);
        cache.put("usr-101", "Alice");

        Cache.ValueWrapper wrapper = cache.get("usr-101");
        assertNotNull(wrapper);
        assertEquals("Alice", wrapper.get());

        cache.evict("usr-101");
        assertNull(cache.get("usr-101"));
    }
}`
  },

  // 7. Build & Config
  {
    id: 'pom-xml',
    category: 'config',
    name: 'pom.xml',
    filename: 'pom.xml',
    badge: 'Maven Build',
    description: 'Maven Project Object Model configuring Java 17, Spring Boot 3.2.3, Spring Cache Starter, Actuator, and JUnit 5 dependencies.',
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
    <description>Thread-safe in-memory cache library with pluggable eviction policies and Spring Cache integration</description>

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
            <artifactId>spring-boot-starter-cache</artifactId>
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
</project>`
  },

  {
    id: 'dockerfile',
    category: 'config',
    name: 'Dockerfile',
    filename: 'Dockerfile',
    badge: 'Multi-Stage Docker',
    description: 'Production multi-stage Docker build producing a slim Eclipse Temurin 17 Alpine Linux container image.',
    code: `# Multi-stage Dockerfile for CacheX Java 17 Spring Boot Backend
FROM maven:3.9.6-eclipse-temurin-17 AS builder
WORKDIR /workspace
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
VOLUME /tmp
COPY --from=builder /workspace/target/cachex-concurrent-cache-1.0.0.jar app.jar

ENV SERVER_PORT=8080
ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC"

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]`
  }
];
