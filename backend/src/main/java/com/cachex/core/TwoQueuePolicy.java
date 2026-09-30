package com.cachex.core;

import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Two-Queue (2Q) Scan-Resistant Eviction Policy.
 *
 * Implements Theodore Johnson and Dennis Shasha's 2Q algorithm.
 * Standard LRU suffers from "cache pollution" when sequential table scans
 * flush out hot items that are frequently accessed.
 *
 * 2Q mitigates this by maintaining two distinct queues:
 * 1. A1 (Probationary FIFO Queue): Newly referenced keys enter here.
 *    If an item is only accessed once, it is quickly evicted without polluting the main cache.
 * 2. Am (Main LRU Queue): If a key in A1 is re-accessed, it is promoted to Am,
 *    identifying it as genuinely hot/persistent.
 *
 * Time Complexity: O(1) for all cache operations.
 *
 * @param <K> Key type
 */
public class TwoQueuePolicy<K> implements EvictionPolicy<K> {

    // Probationary FIFO queue for new entries
    private final Set<K> queueA1;
    // Main LRU doubly-linked list for hot entries
    private final Map<K, Node<K>> queueAm;
    private final Node<K> head;
    private final Node<K> tail;
    private final ReentrantLock lock;

    private static class Node<T> {
        T key;
        Node<T> prev;
        Node<T> next;

        Node(T key) {
            this.key = key;
        }
    }

    public TwoQueuePolicy() {
        this.queueA1 = new LinkedHashSet<>();
        this.queueAm = new HashMap<>();
        this.lock = new ReentrantLock();

        // Sentinel nodes for Am LRU
        this.head = new Node<>(null);
        this.tail = new Node<>(null);
        head.next = tail;
        tail.prev = head;
    }

    @Override
    public EvictionPolicyType getType() {
        return EvictionPolicyType.TWO_QUEUE;
    }

    @Override
    public List<K> getOrder() {
        lock.lock();
        try {
            List<K> order = new ArrayList<>();
            Node<K> curr = head.next;
            while (curr != tail && curr != null) {
                order.add(curr.key);
                curr = curr.next;
            }
            order.addAll(queueA1);
            return order;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordAccess(K key) {
        lock.lock();
        try {
            if (queueAm.containsKey(key)) {
                // Key is in main LRU queue: move to head (MRU)
                Node<K> node = queueAm.get(key);
                detach(node);
                attachToHead(node);
            } else if (queueA1.contains(key)) {
                // Key was in probationary A1: promote to Am!
                queueA1.remove(key);
                Node<K> newNode = new Node<>(key);
                queueAm.put(key, newNode);
                attachToHead(newNode);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordAdd(K key) {
        lock.lock();
        try {
            if (queueAm.containsKey(key)) {
                Node<K> node = queueAm.get(key);
                detach(node);
                attachToHead(node);
            } else if (!queueA1.contains(key)) {
                // Place into probationary queue A1
                queueA1.add(key);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordRemove(K key) {
        lock.lock();
        try {
            queueA1.remove(key);
            Node<K> node = queueAm.remove(key);
            if (node != null) {
                detach(node);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public K getEvictionCandidate() {
        lock.lock();
        try {
            // Evict from probationary A1 first to protect long-term hot items
            if (!queueA1.isEmpty()) {
                return queueA1.iterator().next();
            }
            // If A1 is empty, evict LRU item from Am (node right before tail)
            if (tail.prev != head) {
                return tail.prev.key;
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
            queueA1.clear();
            queueAm.clear();
            head.next = tail;
            tail.prev = head;
        } finally {
            lock.unlock();
        }
    }

    private void attachToHead(Node<K> node) {
        node.next = head.next;
        node.prev = head;
        head.next.prev = node;
        head.next = node;
    }

    private void detach(Node<K> node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }
}
