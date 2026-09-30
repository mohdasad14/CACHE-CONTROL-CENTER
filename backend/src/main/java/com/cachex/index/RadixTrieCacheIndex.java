package com.cachex.index;

import java.util.*;

/**
 * Compact Radix Trie (Patricia Trie) Index for Hierarchical String Keys.
 *
 * Optimizes hierarchical key namespaces (e.g., "catalog:electronics:phones:apple").
 * Provides instant prefix searches ("catalog:electronics:*") with compressed single-child paths.
 */
public class RadixTrieCacheIndex<V> {

    public static class TrieNode<V> {
        String edgeLabel;
        V value;
        boolean isTerminal;
        final Map<Character, TrieNode<V>> children;

        TrieNode(String edgeLabel) {
            this.edgeLabel = edgeLabel;
            this.value = null;
            this.isTerminal = false;
            this.children = new TreeMap<>();
        }
    }

    private final TrieNode<V> root = new TrieNode<>("");
    private int size = 0;

    public synchronized V get(String key) {
        if (key == null || key.isEmpty()) return null;
        TrieNode<V> curr = root;
        int i = 0;

        while (i < key.length()) {
            char ch = key.charAt(i);
            TrieNode<V> child = curr.children.get(ch);
            if (child == null) return null;

            String edge = child.edgeLabel;
            int common = commonPrefix(key.substring(i), edge);
            if (common < edge.length()) return null;

            i += edge.length();
            curr = child;
        }

        return curr.isTerminal ? curr.value : null;
    }

    public synchronized void put(String key, V value) {
        if (key == null || key.isEmpty() || value == null) return;
        TrieNode<V> curr = root;
        int i = 0;

        while (i < key.length()) {
            char ch = key.charAt(i);
            TrieNode<V> child = curr.children.get(ch);

            if (child == null) {
                TrieNode<V> newNode = new TrieNode<>(key.substring(i));
                newNode.value = value;
                newNode.isTerminal = true;
                curr.children.put(ch, newNode);
                size++;
                return;
            }

            int common = commonPrefix(key.substring(i), child.edgeLabel);

            if (common < child.edgeLabel.length()) {
                // Split edge
                String commonStr = child.edgeLabel.substring(0, common);
                String childRemain = child.edgeLabel.substring(common);

                TrieNode<V> splitNode = new TrieNode<>(commonStr);
                curr.children.put(ch, splitNode);

                child.edgeLabel = childRemain;
                splitNode.children.put(childRemain.charAt(0), child);

                if (i + common < key.length()) {
                    String keyRemain = key.substring(i + common);
                    TrieNode<V> newLeaf = new TrieNode<>(keyRemain);
                    newLeaf.value = value;
                    newLeaf.isTerminal = true;
                    splitNode.children.put(keyRemain.charAt(0), newLeaf);
                    size++;
                } else {
                    splitNode.value = value;
                    splitNode.isTerminal = true;
                    size++;
                }
                return;
            }

            i += child.edgeLabel.length();
            curr = child;
        }

        if (!curr.isTerminal) {
            size++;
        }
        curr.value = value;
        curr.isTerminal = true;
    }

    /**
     * Finds all cached entries matching prefix (e.g., "orders:2026:").
     */
    public synchronized Map<String, V> findByPrefix(String prefix) {
        Map<String, V> results = new HashMap<>();
        if (prefix == null) return results;

        TrieNode<V> curr = root;
        int i = 0;

        while (i < prefix.length()) {
            char ch = prefix.charAt(i);
            TrieNode<V> child = curr.children.get(ch);
            if (child == null) return results;

            int common = commonPrefix(prefix.substring(i), child.edgeLabel);
            if (common < child.edgeLabel.length() && i + common < prefix.length()) {
                return results;
            }
            i += common;
            curr = child;
        }

        collectLeaves(curr, prefix, results);
        return results;
    }

    private void collectLeaves(TrieNode<V> node, String currentPath, Map<String, V> results) {
        if (node.isTerminal) {
            results.put(currentPath, node.value);
        }
        for (TrieNode<V> child : node.children.values()) {
            collectLeaves(child, currentPath + child.edgeLabel, results);
        }
    }

    public synchronized int size() {
        return size;
    }

    private static int commonPrefix(String a, String b) {
        int min = Math.min(a.length(), b.length());
        for (int i = 0; i < min; i++) {
            if (a.charAt(i) != b.charAt(i)) return i;
        }
        return min;
    }
}
