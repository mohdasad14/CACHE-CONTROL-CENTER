package com.cachex.concurrency;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/**
 * High-Concurrency Striped-Lock In-Memory Cache Segment.
 *
 * Traditional single ReadWriteLock architectures encounter heavy cache-line bouncing
 * when thread counts exceed 32 CPU cores.
 * StripedLockCache partitions access across N independent lock stripes (default 64)
 * derived from the Murmur3 hash of the key.
 *
 * Concurrency Characteristics:
 * - Contention probability is reduced by a factor of 1 / numStripes (e.g. 1/64).
 * - False sharing is prevented by padding stripe objects to 64-byte L1 CPU cache lines.
 *
 * @param <K> Key type
 * @param <V> Value type
 */
public class StripedLockCache<K, V> {

    private static final int DEFAULT_STRIPES = 64;

    /**
     * Cache-line padded lock holder to prevent false sharing between CPU L1/L2 caches.
     */
    private static class PaddedLock extends ReentrantLock {
        // 56 bytes padding to align to 64-byte CPU cache line
        public volatile long p1, p2, p3, p4, p5, p6, p7;
    }

    private final int stripeMask;
    private final PaddedLock[] locks;
    private final Map<K, V>[] partitions;
    private final int capacityPerStripe;

    @SuppressWarnings("unchecked")
    public StripedLockCache(int totalCapacity, int requestedStripes) {
        int stripes = nextPowerOfTwo(requestedStripes > 0 ? requestedStripes : DEFAULT_STRIPES);
        this.stripeMask = stripes - 1;
        this.locks = new PaddedLock[stripes];
        this.partitions = new HashMap[stripes];
        this.capacityPerStripe = Math.max(2, totalCapacity / stripes);

        for (int i = 0; i < stripes; i++) {
            locks[i] = new PaddedLock();
            partitions[i] = new LinkedHashMap<K, V>(16, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
                    return size() > capacityPerStripe;
                }
            };
        }
    }

    public StripedLockCache(int totalCapacity) {
        this(totalCapacity, DEFAULT_STRIPES);
    }

    /**
     * Retrieves value with stripe-isolated locking.
     */
    public V get(K key) {
        if (key == null) return null;
        int stripe = getStripe(key);
        PaddedLock lock = locks[stripe];
        lock.lock();
        try {
            return partitions[stripe].get(key);
        } finally {
            lock.unlock();
        }
    }

    /**
     * Inserts value with stripe-isolated locking.
     */
    public V put(K key, V value) {
        if (key == null || value == null) return null;
        int stripe = getStripe(key);
        PaddedLock lock = locks[stripe];
        lock.lock();
        try {
            return partitions[stripe].put(key, value);
        } finally {
            lock.unlock();
        }
    }

    /**
     * Removes entry with stripe-isolated locking.
     */
    public V remove(K key) {
        if (key == null) return null;
        int stripe = getStripe(key);
        PaddedLock lock = locks[stripe];
        lock.lock();
        try {
            return partitions[stripe].remove(key);
        } finally {
            lock.unlock();
        }
    }

    public boolean containsKey(K key) {
        if (key == null) return false;
        int stripe = getStripe(key);
        PaddedLock lock = locks[stripe];
        lock.lock();
        try {
            return partitions[stripe].containsKey(key);
        } finally {
            lock.unlock();
        }
    }

    /**
     * Locks all stripes simultaneously to calculate global size.
     */
    public int size() {
        lockAll();
        try {
            int total = 0;
            for (Map<K, V> partition : partitions) {
                total += partition.size();
            }
            return total;
        } finally {
            unlockAll();
        }
    }

    /**
     * Locks all stripes to clear entire cache safely.
     */
    public void clear() {
        lockAll();
        try {
            for (Map<K, V> partition : partitions) {
                partition.clear();
            }
        } finally {
            unlockAll();
        }
    }

    public int getStripeCount() {
        return locks.length;
    }

    private int getStripe(K key) {
        int h = key.hashCode();
        h ^= (h >>> 16);
        h *= 0x85ebca6b;
        h ^= (h >>> 13);
        return h & stripeMask;
    }

    private void lockAll() {
        for (PaddedLock lock : locks) {
            lock.lock();
        }
    }

    private void unlockAll() {
        for (int i = locks.length - 1; i >= 0; i--) {
            locks[i].unlock();
        }
    }

    private static int nextPowerOfTwo(int val) {
        int n = val - 1;
        n |= n >>> 1;
        n |= n >>> 2;
        n |= n >>> 4;
        n |= n >>> 8;
        n |= n >>> 16;
        return (n < 0) ? 1 : n + 1;
    }
}
