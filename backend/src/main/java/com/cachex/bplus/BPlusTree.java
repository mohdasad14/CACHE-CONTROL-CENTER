package com.cachex.bplus;

import java.util.*;

/**
 * Enterprise In-Memory B+ Tree for Ultra-High Speed Cache Indexing.
 *
 * Characteristics:
 * - Order M=32 branching factor.
 * - Internal nodes store routing keys.
 * - Leaf nodes store keys and values, doubly linked for O(K) sequential range scans.
 * - Automatic node split when leaf exceeds M keys.
 */
public class BPlusTree<K extends Comparable<K>, V> {

    public static final int DEFAULT_ORDER = 32;

    public abstract static class Node<K extends Comparable<K>, V> {
        protected int numKeys;
        protected boolean isLeaf;
        protected List<K> keys;

        protected Node(boolean isLeaf, int capacity) {
            this.isLeaf = isLeaf;
            this.numKeys = 0;
            this.keys = new ArrayList<>(capacity + 1);
        }

        public abstract Node<K, V> insert(K key, V value, int maxKeys);
        public abstract V search(K key);
        public boolean isFull(int maxKeys) { return keys.size() >= maxKeys; }
    }

    public static class InternalNode<K extends Comparable<K>, V> extends Node<K, V> {
        public final List<Node<K, V>> children;

        public InternalNode(int capacity) {
            super(false, capacity);
            this.children = new ArrayList<>(capacity + 2);
        }

        @Override
        public V search(K key) {
            int idx = findChildIndex(key);
            return children.get(idx).search(key);
        }

        @Override
        public Node<K, V> insert(K key, V value, int maxKeys) {
            int idx = findChildIndex(key);
            Node<K, V> child = children.get(idx);
            Node<K, V> splitChild = child.insert(key, value, maxKeys);

            if (splitChild != null) {
                K promotedKey = splitChild.keys.get(0);
                int insertPos = Collections.binarySearch(keys, promotedKey);
                if (insertPos < 0) insertPos = -(insertPos + 1);
                keys.add(insertPos, promotedKey);
                children.add(insertPos + 1, splitChild);

                if (isFull(maxKeys)) {
                    return split(maxKeys);
                }
            }
            return null;
        }

        private int findChildIndex(K key) {
            int low = 0, high = keys.size() - 1;
            while (low <= high) {
                int mid = (low + high) >>> 1;
                int cmp = key.compareTo(keys.get(mid));
                if (cmp < 0) high = mid - 1;
                else low = mid + 1;
            }
            return low;
        }

        private InternalNode<K, V> split(int maxKeys) {
            int mid = keys.size() / 2;
            InternalNode<K, V> sibling = new InternalNode<>(maxKeys);

            sibling.keys.addAll(keys.subList(mid + 1, keys.size()));
            sibling.children.addAll(children.subList(mid + 1, children.size()));

            keys.subList(mid, keys.size()).clear();
            children.subList(mid + 1, children.size()).clear();
            return sibling;
        }
    }

    public static class LeafNode<K extends Comparable<K>, V> extends Node<K, V> {
        public final List<V> values;
        public LeafNode<K, V> next;
        public LeafNode<K, V> prev;

        public LeafNode(int capacity) {
            super(true, capacity);
            this.values = new ArrayList<>(capacity + 1);
        }

        @Override
        public V search(K key) {
            int idx = Collections.binarySearch(keys, key);
            return (idx >= 0) ? values.get(idx) : null;
        }

        @Override
        public Node<K, V> insert(K key, V value, int maxKeys) {
            int idx = Collections.binarySearch(keys, key);
            if (idx >= 0) {
                values.set(idx, value);
                return null;
            }
            int insertPos = -(idx + 1);
            keys.add(insertPos, key);
            values.add(insertPos, value);

            if (isFull(maxKeys)) {
                return split(maxKeys);
            }
            return null;
        }

        private LeafNode<K, V> split(int maxKeys) {
            int mid = keys.size() / 2;
            LeafNode<K, V> sibling = new LeafNode<>(maxKeys);

            sibling.keys.addAll(keys.subList(mid, keys.size()));
            sibling.values.addAll(values.subList(mid, values.size()));

            keys.subList(mid, keys.size()).clear();
            values.subList(mid, values.size()).clear();

            sibling.next = this.next;
            sibling.prev = this;
            if (this.next != null) this.next.prev = sibling;
            this.next = sibling;

            return sibling;
        }
    }

    private Node<K, V> root;
    private final int order;
    private int size;

    public BPlusTree(int order) {
        this.order = Math.max(4, order);
        this.root = new LeafNode<>(this.order);
        this.size = 0;
    }

    public BPlusTree() {
        this(DEFAULT_ORDER);
    }

    public synchronized V get(K key) {
        if (key == null) return null;
        return root.search(key);
    }

    public synchronized void put(K key, V value) {
        if (key == null || value == null) return;
        Node<K, V> splitRoot = root.insert(key, value, order);
        if (splitRoot != null) {
            InternalNode<K, V> newRoot = new InternalNode<>(order);
            newRoot.keys.add(splitRoot.keys.get(0));
            newRoot.children.add(root);
            newRoot.children.add(splitRoot);
            root = newRoot;
        }
        size++;
    }

    /**
     * Performs sequential range query [fromKey, toKey] utilizing leaf linked list pointers.
     */
    public synchronized List<Map.Entry<K, V>> range(K fromKey, K toKey) {
        List<Map.Entry<K, V>> results = new ArrayList<>();
        if (fromKey == null || toKey == null || fromKey.compareTo(toKey) > 0) {
            return results;
        }

        LeafNode<K, V> leaf = findFirstLeaf(root, fromKey);
        while (leaf != null) {
            for (int i = 0; i < leaf.keys.size(); i++) {
                K k = leaf.keys.get(i);
                if (k.compareTo(fromKey) >= 0 && k.compareTo(toKey) <= 0) {
                    results.add(new AbstractMap.SimpleImmutableEntry<>(k, leaf.values.get(i)));
                } else if (k.compareTo(toKey) > 0) {
                    return results;
                }
            }
            leaf = leaf.next;
        }
        return results;
    }

    private LeafNode<K, V> findFirstLeaf(Node<K, V> current, K fromKey) {
        if (current.isLeaf) {
            return (LeafNode<K, V>) current;
        }
        InternalNode<K, V> internal = (InternalNode<K, V>) current;
        int idx = internal.findChildIndex(fromKey);
        return findFirstLeaf(internal.children.get(idx), fromKey);
    }

    public synchronized int size() { return size; }
}
