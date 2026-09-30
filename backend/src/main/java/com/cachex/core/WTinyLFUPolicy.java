package com.cachex.core;

import com.cachex.model.EvictionPolicyType;
import java.util.*;

/**
 * Window TinyLFU (W-TinyLFU) Eviction Policy.
 * State-of-the-art caching algorithm introduced by Gil Einziger, Ohad Eytan, Roy Friedman, and Benjamin Manes.
 *
 * Structural Architecture:
 * 1. Window LRU (Eden space): absorbs bursts of new arrivals, preventing scan churn (20% of capacity).
 * 2. Main Space (80% capacity) split into:
 *    - Probationary LRU: New arrivals promoted from window start here.
 *    - Protected LRU: Frequently hit items, up to 80% of main cache.
 * 3. Count-Min Sketch: Compact 4-bit frequency estimator. When window overflows, candidate competes
 *    against probationary victim. The one with lower estimated frequency is evicted.
 *
 * @param <K> Key type
 */
public class WTinyLFUPolicy<K> implements EvictionPolicy<K> {

    private final int capacity;
    private final int maxWindowSize;
    private final int maxProtectedSize;

    // Window LRU (Eden space)
    private final LinkedHashSet<K> windowQueue;

    // Main Space: Probationary & Protected queues
    private final LinkedHashSet<K> probationaryQueue;
    private final LinkedHashSet<K> protectedQueue;

    // CountMinSketch frequency estimator
    private final CountMinSketch<K> sketch;

    public WTinyLFUPolicy(int capacity) {
        if (capacity < 4) {
            capacity = 4;
        }
        this.capacity = capacity;
        this.maxWindowSize = Math.max(1, (int) Math.round(capacity * 0.20));
        int mainCapacity = capacity - maxWindowSize;
        this.maxProtectedSize = Math.max(1, (int) Math.round(mainCapacity * 0.80));

        this.windowQueue = new LinkedHashSet<>();
        this.probationaryQueue = new LinkedHashSet<>();
        this.protectedQueue = new LinkedHashSet<>();
        this.sketch = new CountMinSketch<>(capacity);
    }

    @Override
    public EvictionPolicyType getType() {
        return EvictionPolicyType.W_TINY_LFU;
    }

    @Override
    public synchronized void recordAccess(K key) {
        if (key == null) return;
        sketch.increment(key);

        if (windowQueue.contains(key)) {
            windowQueue.remove(key);
            windowQueue.add(key);
            return;
        }

        if (protectedQueue.contains(key)) {
            protectedQueue.remove(key);
            protectedQueue.add(key);
            return;
        }

        if (probationaryQueue.contains(key)) {
            probationaryQueue.remove(key);
            demoteProtectedIfNecessary();
            protectedQueue.add(key);
        } else {
            recordAdd(key);
        }
    }

    @Override
    public synchronized void recordAdd(K key) {
        if (key == null) return;
        sketch.increment(key);

        if (contains(key)) {
            recordAccess(key);
            return;
        }

        windowQueue.add(key);
    }

    @Override
    public synchronized void recordRemove(K key) {
        if (key == null) return;
        windowQueue.remove(key);
        probationaryQueue.remove(key);
        protectedQueue.remove(key);
    }

    @Override
    public synchronized K getEvictionCandidate() {
        if (isEmpty()) {
            return null;
        }

        // If window has exceeded its quota, transfer candidate to main space
        if (windowQueue.size() > maxWindowSize) {
            K candidate = getOldest(windowQueue);
            if (probationaryQueue.isEmpty()) {
                if (!protectedQueue.isEmpty()) {
                    return getOldest(protectedQueue);
                }
                return candidate;
            } else {
                K victim = getOldest(probationaryQueue);
                int candidateFreq = sketch.estimate(candidate);
                int victimFreq = sketch.estimate(victim);
                return (candidateFreq >= victimFreq) ? victim : candidate;
            }
        }

        if (!probationaryQueue.isEmpty()) {
            return getOldest(probationaryQueue);
        }

        if (!windowQueue.isEmpty()) {
            return getOldest(windowQueue);
        }

        if (!protectedQueue.isEmpty()) {
            return getOldest(protectedQueue);
        }

        return null;
    }

    @Override
    public synchronized void clear() {
        windowQueue.clear();
        probationaryQueue.clear();
        protectedQueue.clear();
        sketch.clear();
    }

    @Override
    public synchronized List<K> getOrder() {
        List<K> list = new ArrayList<>();
        list.addAll(windowQueue);
        list.addAll(probationaryQueue);
        list.addAll(protectedQueue);
        return Collections.unmodifiableList(list);
    }

    public synchronized int getFrequency(K key) {
        return sketch.estimate(key);
    }

    public int getWindowSize() {
        return windowQueue.size();
    }

    public int getProbationarySize() {
        return probationaryQueue.size();
    }

    public int getProtectedSize() {
        return protectedQueue.size();
    }

    public synchronized boolean contains(K key) {
        return windowQueue.contains(key) || probationaryQueue.contains(key) || protectedQueue.contains(key);
    }

    public synchronized int size() {
        return windowQueue.size() + probationaryQueue.size() + protectedQueue.size();
    }

    private void demoteProtectedIfNecessary() {
        while (protectedQueue.size() >= maxProtectedSize) {
            K demoted = getOldest(protectedQueue);
            if (demoted != null) {
                protectedQueue.remove(demoted);
                probationaryQueue.add(demoted);
            } else {
                break;
            }
        }
    }

    private K getOldest(LinkedHashSet<K> set) {
        Iterator<K> it = set.iterator();
        return it.hasNext() ? it.next() : null;
    }

    private boolean isEmpty() {
        return windowQueue.isEmpty() && probationaryQueue.isEmpty() && protectedQueue.isEmpty();
    }
}
