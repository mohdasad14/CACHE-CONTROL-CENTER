package com.cachex.loader;

/**
 * Functional interface for Read-Through cache loading.
 * When a requested key is absent or expired, the CacheLoader is invoked
 * to retrieve or compute the value from the underlying system of record (DB, API, disk).
 *
 * @param <K> Key type
 * @param <V> Value type
 */
@FunctionalInterface
public interface CacheLoader<K, V> {

    /**
     * Loads the value for the given key.
     *
     * @param key Key to fetch
     * @return Loaded value or null if not found
     * @throws Exception if external data source lookup fails
     */
    V load(K key) throws Exception;
}
