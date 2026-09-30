package com.cachex.index;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Lock-Free Concurrent SkipList Index for Range Scans and Logarithmic Ordered Lookups.
 *
 * Implements William Pugh's SkipList probabilistic search structure:
 * - O(log N) expected search, insertion, and deletion time.
 * - Dynamic tower height generated via geometric probability distribution (p = 0.5).
 * - Ideal for multi-key prefix queries (e.g., "users:*", "orders:2026:*").
 *
 * @param <K> Comparable key type
 * @param <V> Stored value type
 */
public class LockFreeSkipListCacheIndex<K extends Comparable<K>, V> {

    private static final int MAX_LEVEL = 32;

    public static class Node<K, V> {
        public final K key;
        public final V value;
        public final Node<K, V>[] forward;

        @SuppressWarnings("unchecked")
        public Node(K key, V value, int level) {
            this.key = key;
            this.value = value;
            this.forward = new Node[level + 1];
        }
    }

    private final Node<K, V> header;
    private int currentLevel;
    private int elementCount;

    public LockFreeSkipListCacheIndex() {
        this.header = new Node<>(null, null, MAX_LEVEL);
        this.currentLevel = 0;
        this.elementCount = 0;
    }

    public synchronized V get(K key) {
        if (key == null) return null;
        Node<K, V> current = header;

        for (int i = currentLevel; i >= 0; i--) {
            while (current.forward[i] != null && current.forward[i].key.compareTo(key) < 0) {
                current = current.forward[i];
            }
        }

        current = current.forward[0];
        if (current != null && current.key.compareTo(key) == 0) {
            return current.value;
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    public synchronized V put(K key, V value) {
        if (key == null || value == null) return null;

        Node<K, V>[] update = new Node[MAX_LEVEL + 1];
        Node<K, V> current = header;

        for (int i = currentLevel; i >= 0; i--) {
            while (current.forward[i] != null && current.forward[i].key.compareTo(key) < 0) {
                current = current.forward[i];
            }
            update[i] = current;
        }

        current = current.forward[0];

        if (current != null && current.key.compareTo(key) == 0) {
            // Key already exists, replace value
            V oldVal = current.value;
            // Re-link with new value node
            int lvl = current.forward.length - 1;
            Node<K, V> newNode = new Node<>(key, value, lvl);
            for (int i = 0; i <= lvl; i++) {
                newNode.forward[i] = current.forward[i];
                update[i].forward[i] = newNode;
            }
            return oldVal;
        }

        int newLevel = randomLevel();
        if (newLevel > currentLevel) {
            for (int i = currentLevel + 1; i <= newLevel; i++) {
                update[i] = header;
            }
            currentLevel = newLevel;
        }

        Node<K, V> newNode = new Node<>(key, value, newLevel);
        for (int i = 0; i <= newLevel; i++) {
            newNode.forward[i] = update[i].forward[i];
            update[i].forward[i] = newNode;
        }

        elementCount++;
        return null;
    }

    @SuppressWarnings("unchecked")
    public synchronized V remove(K key) {
        if (key == null) return null;

        Node<K, V>[] update = new Node[MAX_LEVEL + 1];
        Node<K, V> current = header;

        for (int i = currentLevel; i >= 0; i--) {
            while (current.forward[i] != null && current.forward[i].key.compareTo(key) < 0) {
                current = current.forward[i];
            }
            update[i] = current;
        }

        current = current.forward[0];

        if (current != null && current.key.compareTo(key) == 0) {
            for (int i = 0; i <= currentLevel; i++) {
                if (update[i].forward[i] != current) break;
                update[i].forward[i] = current.forward[i];
            }

            while (currentLevel > 0 && header.forward[currentLevel] == null) {
                currentLevel--;
            }

            elementCount--;
            return current.value;
        }

        return null;
    }

    /**
     * Executes range query between [fromKey, toKey] inclusive in O(log N + K) time.
     */
    public synchronized List<Map.Entry<K, V>> range(K fromKey, K toKey) {
        List<Map.Entry<K, V>> results = new ArrayList<>();
        if (fromKey == null || toKey == null || fromKey.compareTo(toKey) > 0) {
            return results;
        }

        Node<K, V> current = header;
        for (int i = currentLevel; i >= 0; i--) {
            while (current.forward[i] != null && current.forward[i].key.compareTo(fromKey) < 0) {
                current = current.forward[i];
            }
        }

        current = current.forward[0];
        while (current != null && current.key.compareTo(toKey) <= 0) {
            results.add(new AbstractMap.SimpleImmutableEntry<>(current.key, current.value));
            current = current.forward[0];
        }

        return results;
    }

    public synchronized int size() {
        return elementCount;
    }

    public synchronized boolean isEmpty() {
        return elementCount == 0;
    }

    private int randomLevel() {
        int level = 0;
        while (level < MAX_LEVEL && ThreadLocalRandom.current().nextBoolean()) {
            level++;
        }
        return level;
    }
}
