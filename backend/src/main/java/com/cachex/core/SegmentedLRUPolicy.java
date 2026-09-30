package com.cachex.core;

import com.cachex.model.EvictionPolicyType;
import java.util.*;

/**
 * Segmented LRU (SLRU) Cache Eviction Policy.
 *
 * Divides the cache into two fixed segments:
 * 1. Probationary Segment (A1): New items enter here.
 * 2. Protected Segment (A2): Accessed items from probationary segment get promoted here.
 *
 * When protected segment reaches its capacity, oldest items in protected segment are demoted
 * back to the probationary segment.
 * Evictions always occur from the tail of the probationary segment.
 *
 * @param <K> Key type
 */
public class SegmentedLRUPolicy<K> implements EvictionPolicy<K> {

    private final int totalCapacity;
    private final int protectedCapacity;
    private final int probationaryCapacity;

    private final LinkedHashSet<K> probationarySegment;
    private final LinkedHashSet<K> protectedSegment;

    public SegmentedLRUPolicy(int capacity) {
        if (capacity < 2) {
            capacity = 2;
        }
        this.totalCapacity = capacity;
        this.protectedCapacity = Math.max(1, (int) Math.round(capacity * 0.80));
        this.probationaryCapacity = Math.max(1, capacity - protectedCapacity);

        this.probationarySegment = new LinkedHashSet<>();
        this.protectedSegment = new LinkedHashSet<>();
    }

    @Override
    public EvictionPolicyType getType() {
        return EvictionPolicyType.SLRU;
    }

    @Override
    public synchronized void recordAccess(K key) {
        if (key == null) return;

        if (protectedSegment.contains(key)) {
            protectedSegment.remove(key);
            protectedSegment.add(key);
            return;
        }

        if (probationarySegment.contains(key)) {
            probationarySegment.remove(key);
            if (protectedSegment.size() >= protectedCapacity) {
                K demoted = getOldest(protectedSegment);
                if (demoted != null) {
                    protectedSegment.remove(demoted);
                    probationarySegment.add(demoted);
                }
            }
            protectedSegment.add(key);
        } else {
            recordAdd(key);
        }
    }

    @Override
    public synchronized void recordAdd(K key) {
        if (key == null) return;
        if (contains(key)) {
            recordAccess(key);
            return;
        }
        probationarySegment.add(key);
    }

    @Override
    public synchronized void recordRemove(K key) {
        if (key == null) return;
        probationarySegment.remove(key);
        protectedSegment.remove(key);
    }

    @Override
    public synchronized K getEvictionCandidate() {
        if (!probationarySegment.isEmpty()) {
            return getOldest(probationarySegment);
        }
        if (!protectedSegment.isEmpty()) {
            return getOldest(protectedSegment);
        }
        return null;
    }

    @Override
    public synchronized void clear() {
        probationarySegment.clear();
        protectedSegment.clear();
    }

    @Override
    public synchronized List<K> getOrder() {
        List<K> list = new ArrayList<>();
        list.addAll(probationarySegment);
        list.addAll(protectedSegment);
        return Collections.unmodifiableList(list);
    }

    public int getProtectedSize() {
        return protectedSegment.size();
    }

    public int getProbationarySize() {
        return probationarySegment.size();
    }

    public synchronized boolean contains(K key) {
        return probationarySegment.contains(key) || protectedSegment.contains(key);
    }

    public synchronized int size() {
        return probationarySegment.size() + protectedSegment.size();
    }

    private K getOldest(LinkedHashSet<K> set) {
        Iterator<K> it = set.iterator();
        return it.hasNext() ? it.next() : null;
    }
}
