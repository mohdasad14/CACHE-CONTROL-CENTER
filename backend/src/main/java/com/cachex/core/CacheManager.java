package com.cachex.core;

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
                    // Fallback in case of discrepancy
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
                // Sort by last accessed time ascending (oldest first)
                liveEntries.sort(Comparator.comparingLong(CacheEntry::getLastAccessedTime));
                for (CacheEntry<K, V> e : liveEntries) {
                    newPolicy.recordAdd(e.getKey());
                }
            } else {
                // LFU: replay access counts
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

    /**
     * Updates cache capacity. If new capacity is smaller, performs evictions immediately.
     */
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

    public int getCapacity() {
        return capacity;
    }

    public int size() {
        return storage.size();
    }

    public boolean containsKey(K key) {
        CacheEntry<K, V> entry = storage.get(key);
        return entry != null && !entry.isExpired();
    }

    public EvictionPolicyType getPolicyType() {
        return evictionPolicy.getType();
    }

    public MetricsCollector getMetrics() {
        return metrics;
    }

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

    /**
     * Active background cleaner: purges all expired entries periodically.
     */
    private void cleanExpiredEntries() {
        List<K> expiredKeys = new ArrayList<>();
        long now = System.currentTimeMillis();

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
        switch (type) {
            case LFU:
                return new LFUPolicy<>();
            case LRU:
            default:
                return new LRUPolicy<>();
        }
    }
}
