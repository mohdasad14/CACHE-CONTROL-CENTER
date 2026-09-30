package com.cachex.core;

import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;

/**
 * Spatial Locality Prefetching Engine and Stride Detector.
 *
 * Automatically detects sequential access patterns (e.g. key_1, key_2, key_3 or block_100, block_104)
 * and asynchronously prefetches anticipated subsequent keys ahead of time to eliminate read latency.
 */
public class SpatialLocalityPrefetcher<K, V> {

    private final CacheManager<K, V> cacheManager;
    private final Function<K, V> loaderFunction;
    private final ExecutorService prefetchExecutor;
    private final Map<String, Long> accessHistory = new ConcurrentHashMap<>();
    private final Set<K> pendingPrefetches = ConcurrentHashMap.newKeySet();

    public SpatialLocalityPrefetcher(CacheManager<K, V> cacheManager, Function<K, V> loaderFunction) {
        this.cacheManager = cacheManager;
        this.loaderFunction = loaderFunction;
        this.prefetchExecutor = Executors.newFixedThreadPool(2, runnable -> {
            Thread t = new Thread(runnable, "CacheX-Prefetch-Worker");
            t.setDaemon(true);
            return t;
        });
    }

    /**
     * Inspects key access and dispatches predictive prefetches if sequential pattern is recognized.
     */
    public void recordAccess(K key) {
        if (key == null) return;
        String keyStr = key.toString();

        // Extract trailing numeric index (e.g., "user:105" -> prefix "user:", id 105)
        int lastColon = keyStr.lastIndexOf(':');
        if (lastColon >= 0 && lastColon < keyStr.length() - 1) {
            String prefix = keyStr.substring(0, lastColon);
            String suffix = keyStr.substring(lastColon + 1);

            try {
                long currentId = Long.parseLong(suffix);
                Long prevId = accessHistory.put(prefix, currentId);

                if (prevId != null && currentId == prevId + 1) {
                    // Sequential stride detected! Prefetch next 2 sequential keys
                    for (long stride = 1; stride <= 2; stride++) {
                        String anticipatedKeyStr = prefix + ":" + (currentId + stride);
                        @SuppressWarnings("unchecked")
                        K anticipatedKey = (K) anticipatedKeyStr;
                        triggerPrefetch(anticipatedKey);
                    }
                }
            } catch (NumberFormatException ignored) {
                // Non-numeric suffix, stride detection skipped
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void triggerPrefetch(K key) {
        if (cacheManager.get(key) != null || !pendingPrefetches.add(key)) {
            return;
        }

        prefetchExecutor.submit(() -> {
            try {
                if (loaderFunction != null) {
                    V value = loaderFunction.apply(key);
                    if (value != null) {
                        cacheManager.put(key, value, 60000);
                    }
                }
            } finally {
                pendingPrefetches.remove(key);
            }
        });
    }

    public void shutdown() {
        prefetchExecutor.shutdownNow();
    }
}
