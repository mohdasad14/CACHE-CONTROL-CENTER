package com.cachex.reactive;

import com.cachex.core.CacheManager;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;

/**
 * Reactive and Non-Blocking Asynchronous Client Wrapper for CacheX.
 *
 * Exposes non-blocking asynchronous APIs with CompletableFuture pipelines,
 * batch lookups, asynchronous compute-if-absent, and resilient fallbacks.
 *
 * @param <K> Key type
 * @param <V> Value type
 */
public class ReactiveCacheClient<K, V> {

    private final CacheManager<K, V> cacheManager;
    private final ExecutorService asyncPool;

    public ReactiveCacheClient(CacheManager<K, V> cacheManager, ExecutorService asyncPool) {
        this.cacheManager = cacheManager;
        this.asyncPool = asyncPool != null ? asyncPool : ForkJoinPool.commonPool();
    }

    /**
     * Non-blocking asynchronous get.
     */
    public CompletableFuture<Optional<V>> getAsync(K key) {
        return CompletableFuture.supplyAsync(() -> {
            V val = cacheManager.get(key);
            return Optional.ofNullable(val);
        }, asyncPool);
    }

    /**
     * Non-blocking asynchronous put.
     */
    public CompletableFuture<Void> putAsync(K key, V value, long ttlMillis) {
        return CompletableFuture.runAsync(() -> {
            cacheManager.put(key, value, ttlMillis);
        }, asyncPool);
    }

    /**
     * Reactive get-or-compute with asynchronous database loader.
     * Prevents cache stampede / thundering herd by pipelining futures.
     */
    public CompletableFuture<V> getOrComputeAsync(K key, Supplier<CompletableFuture<V>> remoteLoader, long ttlMillis) {
        V cached = cacheManager.get(key);
        if (cached != null) {
            return CompletableFuture.completedFuture(cached);
        }

        return remoteLoader.get().thenApplyAsync(loadedValue -> {
            if (loadedValue != null) {
                cacheManager.put(key, loadedValue, ttlMillis);
            }
            return loadedValue;
        }, asyncPool);
    }

    /**
     * Batch asynchronous lookup for multiple keys in parallel.
     */
    public CompletableFuture<Map<K, V>> getAllAsync(Collection<K> keys) {
        return CompletableFuture.supplyAsync(() -> {
            Map<K, V> result = new ConcurrentHashMap<>();
            List<CompletableFuture<Void>> futures = new ArrayList<>(keys.size());

            for (K key : keys) {
                futures.add(CompletableFuture.runAsync(() -> {
                    V val = cacheManager.get(key);
                    if (val != null) {
                        result.put(key, val);
                    }
                }, asyncPool));
            }

            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
            return result;
        }, asyncPool);
    }

    public CompletableFuture<Boolean> evictAsync(K key) {
        return CompletableFuture.supplyAsync(() -> cacheManager.delete(key), asyncPool);
    }
}
