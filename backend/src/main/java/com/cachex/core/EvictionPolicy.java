package com.cachex.core;

import com.cachex.model.EvictionPolicyType;
import java.util.List;

/**
 * Strategy interface defining cache eviction behavior.
 * Implementations manage order and candidate selection in O(1) time.
 *
 * @param <K> Type of the cache key
 */
public interface EvictionPolicy<K> {

    /**
     * Identifies the policy type (LRU or LFU).
     */
    EvictionPolicyType getType();

    /**
     * Called whenever a key is accessed (read or overwritten).
     */
    void recordAccess(K key);

    /**
     * Called whenever a new key is inserted into cache.
     */
    void recordAdd(K key);

    /**
     * Called whenever a key is removed or evicted.
     */
    void recordRemove(K key);

    /**
     * Retrieves the key chosen for eviction without necessarily removing it,
     * or returns null if the cache is empty.
     */
    K getEvictionCandidate();

    /**
     * Clears all internal tracking state.
     */
    void clear();

    /**
     * Returns an ordered snapshot of keys from least eligible for eviction to most eligible.
     * Useful for telemetry and visual debugging.
     */
    List<K> getOrder();
}
