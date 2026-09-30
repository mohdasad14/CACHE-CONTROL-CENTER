package com.cachex.core;

import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.locks.ReentrantLock;

/**
 * First-In First-Out (FIFO) Cache Eviction Policy.
 * Evicts keys in the exact chronological order in which they were first inserted,
 * irrespective of subsequent read or write access frequencies.
 *
 * All operations run with guaranteed O(1) time complexity.
 *
 * @param <K> Key type
 */
public class FIFOPolicy<K> implements EvictionPolicy<K> {

    private final Set<K> insertionOrder;
    private final ReentrantLock lock;

    public FIFOPolicy() {
        this.insertionOrder = new LinkedHashSet<>();
        this.lock = new ReentrantLock();
    }

    @Override
    public EvictionPolicyType getType() {
        return EvictionPolicyType.FIFO;
    }

    @Override
    public List<K> getOrder() {
        lock.lock();
        try {
            return new ArrayList<>(insertionOrder);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordAccess(K key) {
        // In pure FIFO, read access does NOT change eviction queue position.
    }

    @Override
    public void recordAdd(K key) {
        lock.lock();
        try {
            // Only add if not present, retaining initial entry timestamp/order
            if (!insertionOrder.contains(key)) {
                insertionOrder.add(key);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordRemove(K key) {
        lock.lock();
        try {
            insertionOrder.remove(key);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public K getEvictionCandidate() {
        lock.lock();
        try {
            Iterator<K> iterator = insertionOrder.iterator();
            if (iterator.hasNext()) {
                return iterator.next();
            }
            return null;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void clear() {
        lock.lock();
        try {
            insertionOrder.clear();
        } finally {
            lock.unlock();
        }
    }
}
