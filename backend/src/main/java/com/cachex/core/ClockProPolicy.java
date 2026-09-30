package com.cachex.core;

import com.cachex.model.EvictionPolicyType;
import java.util.*;

/**
 * CLOCK-Pro Eviction Policy.
 *
 * An approximation of LRU/2 (Johnson & Shasha) using circular CLOCK hands.
 * Distinguishes between:
 * - Hot items: Have demonstrated high reuse frequency.
 * - Cold items: Recently introduced items in a probationary state.
 *
 * Eliminates LRU scan-pollution without requiring expensive list reshuffling on read.
 *
 * @param <K> Key type
 */
public class ClockProPolicy<K> implements EvictionPolicy<K> {

    private static class EntryNode<K> {
        final K key;
        boolean hot;
        boolean referenceBit;

        EntryNode(K key) {
            this.key = key;
            this.hot = false;
            this.referenceBit = false;
        }
    }

    private final int capacity;
    private final int maxHotSize;
    private final Map<K, EntryNode<K>> directory;
    private final List<EntryNode<K>> circularBuffer;
    private int handHot;
    private int handCold;
    private int hotCount;

    public ClockProPolicy(int capacity) {
        this.capacity = Math.max(4, capacity);
        this.maxHotSize = Math.max(1, (int) Math.round(capacity * 0.70));
        this.directory = new HashMap<>();
        this.circularBuffer = new ArrayList<>();
        this.handHot = 0;
        this.handCold = 0;
        this.hotCount = 0;
    }

    @Override
    public EvictionPolicyType getType() {
        return EvictionPolicyType.CLOCK_PRO;
    }

    @Override
    public synchronized void recordAccess(K key) {
        if (key == null) return;
        EntryNode<K> node = directory.get(key);
        if (node != null) {
            node.referenceBit = true;
        } else {
            recordAdd(key);
        }
    }

    @Override
    public synchronized void recordAdd(K key) {
        if (key == null) return;
        EntryNode<K> node = directory.get(key);
        if (node != null) {
            node.referenceBit = true;
            return;
        }

        EntryNode<K> newNode = new EntryNode<>(key);
        directory.put(key, newNode);
        circularBuffer.add(newNode);
    }

    @Override
    public synchronized void recordRemove(K key) {
        if (key == null) return;
        EntryNode<K> node = directory.remove(key);
        if (node != null) {
            if (node.hot) hotCount--;
            circularBuffer.remove(node);
            adjustHands();
        }
    }

    @Override
    public synchronized K getEvictionCandidate() {
        if (directory.isEmpty()) return null;

        int sweeps = 0;
        int maxSweeps = circularBuffer.size() * 2 + 1;

        while (sweeps < maxSweeps && !circularBuffer.isEmpty()) {
            if (handCold >= circularBuffer.size()) {
                handCold = 0;
            }
            EntryNode<K> node = circularBuffer.get(handCold);
            if (!node.hot) {
                if (node.referenceBit) {
                    node.referenceBit = false;
                    node.hot = true;
                    hotCount++;
                    sweepHotHand();
                } else {
                    return node.key;
                }
            }
            handCold++;
            sweeps++;
        }

        if (!circularBuffer.isEmpty()) {
            return circularBuffer.get(0).key;
        }

        return null;
    }

    @Override
    public synchronized void clear() {
        directory.clear();
        circularBuffer.clear();
        handHot = 0;
        handCold = 0;
        hotCount = 0;
    }

    @Override
    public synchronized List<K> getOrder() {
        List<K> keys = new ArrayList<>();
        for (EntryNode<K> node : circularBuffer) {
            keys.add(node.key);
        }
        return Collections.unmodifiableList(keys);
    }

    public synchronized int size() {
        return directory.size();
    }

    public synchronized boolean contains(K key) {
        return directory.containsKey(key);
    }

    private void sweepHotHand() {
        while (hotCount > maxHotSize && !circularBuffer.isEmpty()) {
            if (handHot >= circularBuffer.size()) {
                handHot = 0;
            }
            EntryNode<K> node = circularBuffer.get(handHot);
            if (node.hot) {
                if (node.referenceBit) {
                    node.referenceBit = false;
                } else {
                    node.hot = false;
                    hotCount--;
                }
            }
            handHot++;
        }
    }

    private void adjustHands() {
        int n = circularBuffer.size();
        if (n == 0) {
            handHot = 0;
            handCold = 0;
        } else {
            handHot %= n;
            handCold %= n;
        }
    }
}
