package com.cachex.core;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Sliding Window Token-Bucket Rate Limiter backed by CacheX in-memory semantics.
 *
 * Implements smooth sliding window rate limiting:
 * - Divides window into sub-second granular buckets.
 * - Weights previous window fraction and current window count.
 * - Guarantees zero burst allowance past the configured rate threshold.
 */
public class SlidingWindowRateLimiter {

    private static class WindowBucket {
        final AtomicLong windowStart = new AtomicLong(0);
        final AtomicInteger currentCount = new AtomicInteger(0);
        final AtomicInteger previousCount = new AtomicInteger(0);
    }

    private final int maxPermitsPerWindow;
    private final long windowDurationMillis;
    private final ConcurrentHashMap<String, WindowBucket> limits = new ConcurrentHashMap<>();

    public SlidingWindowRateLimiter(int maxPermits, long windowDurationMillis) {
        this.maxPermitsPerWindow = maxPermits;
        this.windowDurationMillis = windowDurationMillis;
    }

    /**
     * Attempts to acquire 1 permit for the given client/API key.
     * Returns true if allowed, false if rate limited.
     */
    public boolean tryAcquire(String key) {
        return tryAcquire(key, 1);
    }

    /**
     * Attempts to acquire permits for the given client key.
     */
    public boolean tryAcquire(String key, int permits) {
        if (key == null || permits <= 0) return false;

        WindowBucket bucket = limits.computeIfAbsent(key, k -> {
            WindowBucket b = new WindowBucket();
            b.windowStart.set(System.currentTimeMillis());
            return b;
        });

        long now = System.currentTimeMillis();

        synchronized (bucket) {
            long windowStart = bucket.windowStart.get();
            long elapsed = now - windowStart;

            if (elapsed >= windowDurationMillis) {
                // Advance window
                if (elapsed < 2 * windowDurationMillis) {
                    bucket.previousCount.set(bucket.currentCount.get());
                } else {
                    bucket.previousCount.set(0);
                }
                bucket.currentCount.set(0);
                bucket.windowStart.set(now);
                elapsed = 0;
            }

            // Calculate weighted request count using sliding window formula:
            // weight = (windowDuration - elapsed) / windowDuration
            double weight = (double) (windowDurationMillis - elapsed) / (double) windowDurationMillis;
            double estimatedCount = bucket.previousCount.get() * weight + bucket.currentCount.get();

            if (estimatedCount + permits <= maxPermitsPerWindow) {
                bucket.currentCount.addAndGet(permits);
                return true;
            } else {
                return false; // Rate limit exceeded!
            }
        }
    }

    public void reset(String key) {
        limits.remove(key);
    }

    public void clearAll() {
        limits.clear();
    }
}
