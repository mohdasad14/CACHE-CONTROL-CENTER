package com.cachex.core;

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
    private final long expiresAt; // Epoch ms; Long.MAX_VALUE represents infinity (no expiration)
    private final AtomicLong accessCount;
    private volatile long lastAccessedTime;

    /**
     * Constructs a new CacheEntry with specified TTL in milliseconds.
     *
     * @param key       The cache key
     * @param value     The cache value
     * @param ttlMillis Milliseconds until expiration (0 or negative means infinite TTL)
     */
    public CacheEntry(K key, V value, long ttlMillis) {
        this.key = key;
        this.value = value;
        this.createdAt = System.currentTimeMillis();
        this.expiresAt = (ttlMillis > 0) ? (this.createdAt + ttlMillis) : Long.MAX_VALUE;
        this.accessCount = new AtomicLong(1);
        this.lastAccessedTime = this.createdAt;
    }

    public K getKey() {
        return key;
    }

    public V getValue() {
        return value;
    }

    public void setValue(V value) {
        this.value = value;
    }

    public long getCreatedAt() {
        return createdAt;
    }

    public long getExpiresAt() {
        return expiresAt;
    }

    public long getAccessCount() {
        return accessCount.get();
    }

    public void incrementAccessCount() {
        this.accessCount.incrementAndGet();
    }

    public long getLastAccessedTime() {
        return lastAccessedTime;
    }

    public void setLastAccessedTime(long lastAccessedTime) {
        this.lastAccessedTime = lastAccessedTime;
    }

    /**
     * Determines whether this entry has exceeded its TTL deadline.
     */
    public boolean isExpired() {
        if (expiresAt == Long.MAX_VALUE) {
            return false;
        }
        return System.currentTimeMillis() >= expiresAt;
    }

    /**
     * Returns remaining TTL in milliseconds, or -1 if infinite, or 0 if expired.
     */
    public long getRemainingTtlMillis() {
        if (expiresAt == Long.MAX_VALUE) {
            return -1;
        }
        long remaining = expiresAt - System.currentTimeMillis();
        return Math.max(0, remaining);
    }

    @Override
    public String toString() {
        return "CacheEntry{" +
                "key=" + key +
                ", accessCount=" + accessCount +
                ", expired=" + isExpired() +
                ", remainingTtl=" + getRemainingTtlMillis() + "ms" +
                '}';
    }
}
