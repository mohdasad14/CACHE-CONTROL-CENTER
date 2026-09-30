package com.cachex.concurrency;

import java.util.*;
import java.util.concurrent.locks.StampedLock;

/**
 * Ultra-Low-Latency Cache Manager utilizing Java StampedLock Optimistic Reads.
 *
 * Traditional ReentrantReadWriteLock writes to a shared cache-line atomic state
 * even during read operations (incrementing reader count).
 * StampedLock provides tryOptimisticRead() which involves ZERO lock acquisition overhead,
 * zero memory writes, and zero CPU cache-coherence bus traffic.
 *
 * Sequence:
 * 1. long stamp = stampedLock.tryOptimisticRead();
 * 2. Read state without acquiring lock.
 * 3. if (!stampedLock.validate(stamp)) -> Fallback to pessimistic readLock().
 * 4. Writes acquire stampedLock.writeLock().
 *
 * @param <K> Key type
 * @param <V> Value type
 */
public class StampedLockCacheManager<K, V> {

    private final int capacity;
    private final Map<K, V> map;
    private final StampedLock stampedLock;
    private long optimisticHits;
    private long optimisticRetries;
    private long pessimisticReads;

    public StampedLockCacheManager(int capacity) {
        this.capacity = Math.max(1, capacity);
        this.map = new LinkedHashMap<K, V>(16, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
                return size() > StampedLockCacheManager.this.capacity;
            }
        };
        this.stampedLock = new StampedLock();
        this.optimisticHits = 0;
        this.optimisticRetries = 0;
        this.pessimisticReads = 0;
    }

    /**
     * Optimistic fast-path read. Falls back to read lock if concurrent write occurs.
     */
    public V get(K key) {
        if (key == null) return null;

        // Fast-path: optimistic read stamp (zero memory write overhead)
        long stamp = stampedLock.tryOptimisticRead();
        V value = map.get(key);

        if (!stampedLock.validate(stamp)) {
            // Concurrent write occurred, fall back to pessimistic read lock
            stamp = stampedLock.readLock();
            try {
                pessimisticReads++;
                return map.get(key);
            } finally {
                stampedLock.unlockRead(stamp);
            }
        }

        optimisticHits++;
        return value;
    }

    /**
     * Thread-safe write lock operation.
     */
    public V put(K key, V value) {
        if (key == null || value == null) return null;

        long stamp = stampedLock.writeLock();
        try {
            return map.put(key, value);
        } finally {
            stampedLock.unlockWrite(stamp);
        }
    }

    /**
     * Upgrades an optimistic read to a write lock if key is missing (Compute-If-Absent).
     */
    public V computeIfAbsent(K key, java.util.function.Function<K, V> mappingFunction) {
        if (key == null || mappingFunction == null) return null;

        long stamp = stampedLock.readLock();
        try {
            while (map.get(key) == null) {
                long writeStamp = stampedLock.tryConvertToWriteLock(stamp);
                if (writeStamp != 0L) {
                    stamp = writeStamp;
                    V computed = mappingFunction.apply(key);
                    map.put(key, computed);
                    return computed;
                } else {
                    stampedLock.unlockRead(stamp);
                    stamp = stampedLock.writeLock();
                }
            }
            return map.get(key);
        } finally {
            stampedLock.unlock(stamp);
        }
    }

    public V remove(K key) {
        if (key == null) return null;
        long stamp = stampedLock.writeLock();
        try {
            return map.remove(key);
        } finally {
            stampedLock.unlockWrite(stamp);
        }
    }

    public int size() {
        long stamp = stampedLock.tryOptimisticRead();
        int sz = map.size();
        if (!stampedLock.validate(stamp)) {
            stamp = stampedLock.readLock();
            try {
                return map.size();
            } finally {
                stampedLock.unlockRead(stamp);
            }
        }
        return sz;
    }

    public void clear() {
        long stamp = stampedLock.writeLock();
        try {
            map.clear();
        } finally {
            stampedLock.unlockWrite(stamp);
        }
    }

    public long getOptimisticHits() {
        return optimisticHits;
    }

    public long getPessimisticReads() {
        return pessimisticReads;
    }
}
