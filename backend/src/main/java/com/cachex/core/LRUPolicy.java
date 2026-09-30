package com.cachex.core;

import com.cachex.model.EvictionPolicyType;
import java.util.*;

/**
 * Least Recently Used (LRU) Eviction Policy.
 * Implements strict O(1) recency tracking using a Doubly-Linked List + Hash Map.
 *
 * Head = Most Recently Used (MRU)
 * Tail = Least Recently Used (LRU) - Next candidate for eviction
 */
public class LRUPolicy<K> implements EvictionPolicy<K> {

    private static class Node<K> {
        K key;
        Node<K> prev;
        Node<K> next;

        Node(K key) {
            this.key = key;
        }
    }

    private final Map<K, Node<K>> nodeMap = new HashMap<>();
    private final Node<K> head = new Node<>(null); // Dummy MRU sentinel
    private final Node<K> tail = new Node<>(null); // Dummy LRU sentinel

    public LRUPolicy() {
        head.next = tail;
        tail.prev = head;
    }

    @Override
    public EvictionPolicyType getType() {
        return EvictionPolicyType.LRU;
    }

    @Override
    public synchronized void recordAccess(K key) {
        Node<K> node = nodeMap.get(key);
        if (node != null) {
            unlink(node);
            addToHead(node);
        } else {
            recordAdd(key);
        }
    }

    @Override
    public synchronized void recordAdd(K key) {
        Node<K> existing = nodeMap.get(key);
        if (existing != null) {
            unlink(existing);
            addToHead(existing);
            return;
        }
        Node<K> newNode = new Node<>(key);
        nodeMap.put(key, newNode);
        addToHead(newNode);
    }

    @Override
    public synchronized void recordRemove(K key) {
        Node<K> node = nodeMap.remove(key);
        if (node != null) {
            unlink(node);
        }
    }

    @Override
    public synchronized K getEvictionCandidate() {
        if (tail.prev == head) {
            return null; // Empty list
        }
        return tail.prev.key;
    }

    @Override
    public synchronized void clear() {
        nodeMap.clear();
        head.next = tail;
        tail.prev = head;
    }

    @Override
    public synchronized List<K> getOrder() {
        List<K> list = new ArrayList<>();
        Node<K> curr = head.next;
        while (curr != tail && curr != null) {
            list.add(curr.key);
            curr = curr.next;
        }
        return list;
    }

    private void addToHead(Node<K> node) {
        node.next = head.next;
        node.prev = head;
        head.next.prev = node;
        head.next = node;
    }

    private void unlink(Node<K> node) {
        if (node.prev != null) {
            node.prev.next = node.next;
        }
        if (node.next != null) {
            node.next.prev = node.prev;
        }
        node.prev = null;
        node.next = null;
    }
}
