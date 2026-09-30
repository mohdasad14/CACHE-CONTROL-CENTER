package com.cachex.loader;

import java.util.Map;

/**
 * Interface for Write-Through and Write-Behind cache persistence.
 * Coordinates syncing updates to the underlying system of record.
 *
 * @param <K> Key type
 * @param <V> Value type
 */
public interface CacheWriter<K, V> {

    /**
     * Persist a single key-value update synchronously or asynchronously.
     */
    void write(K key, V value) throws Exception;

    /**
     * Persist a batch of key-value updates (used by WriteBehindQueue).
     */
    default void writeAll(Map<K, V> batch) throws Exception {
        for (Map.Entry<K, V> entry : batch.entrySet()) {
            write(entry.getKey(), entry.getValue());
        }
    }

    /**
     * Delete an entry from the underlying database or store.
     */
    void delete(K key) throws Exception;
}
