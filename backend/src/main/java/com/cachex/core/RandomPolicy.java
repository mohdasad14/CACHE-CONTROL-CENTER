package com.cachex.core;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Random Replacement Eviction Policy.
 * Randomly picks a victim candidate from the current active key set.
 *
 * Frequently used in academic benchmarking and low-overhead micro-caching
 * where memory or CPU overhead of tracking linked list pointers is strictly constrained.
 *
 * @param <K> Key type
 */
public class RandomPolicy<K> implements EvictionPolicy<K> {

    private final List<K> keys;
    private final Map<K, Integer> keyToIndex;
    private final ReentrantLock lock;

    public RandomPolicy() {
        this.keys = new ArrayList<>();
        this.keyToIndex = new HashMap<>();
        this.lock = new ReentrantLock();
    }

    @Override
    public EvictionPolicyType getType() {
        return EvictionPolicyType.RANDOM;
    }

    @Override
    public List<K> getOrder() {
        lock.lock();
        try {
            return new ArrayList<>(keys);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordAccess(K key) {
        // Random policy does not update order on access
    }

    @Override
    public void recordAdd(K key) {
        lock.lock();
        try {
            if (!keyToIndex.containsKey(key)) {
                keyToIndex.put(key, keys.size());
                keys.add(key);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordRemove(K key) {
        lock.lock();
        try {
            Integer idx = keyToIndex.remove(key);
            if (idx != null) {
                int lastIdx = keys.size() - 1;
                K lastKey = keys.get(lastIdx);
                keys.set(idx, lastKey);
                keyToIndex.put(lastKey, idx);
                keys.remove(lastIdx);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public K getEvictionCandidate() {
        lock.lock();
        try {
            if (keys.isEmpty()) {
                return null;
            }
            int randomIndex = ThreadLocalRandom.current().nextInt(keys.size());
            return keys.get(randomIndex);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void clear() {
        lock.lock();
        try {
            keys.clear();
            keyToIndex.clear();
        } finally {
            lock.unlock();
        }
    }
}
