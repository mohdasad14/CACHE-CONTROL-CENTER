package com.cachex.distributed;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;

/**
 * Merkle Tree Anti-Entropy Replica Synchronizer.
 *
 * Generates a cryptographic binary hash tree over cache key-value partitions:
 * - Detects replica desynchronization by comparing root hashes in O(1) network roundtrip.
 * - Drills down tree branches to pinpoint exact divergent key buckets in O(log N) operations.
 */
public class MerkleTreeSync {

    public static class MerkleNode {
        public byte[] hash;
        public MerkleNode left;
        public MerkleNode right;
        public int bucketStart;
        public int bucketEnd;

        public MerkleNode(byte[] hash, int start, int end) {
            this.hash = hash;
            this.bucketStart = start;
            this.bucketEnd = end;
        }
    }

    private final int totalBuckets;
    private final List<StringBuilder> buckets;
    private MerkleNode root;

    public MerkleTreeSync(int totalBuckets) {
        this.totalBuckets = nextPowerOfTwo(totalBuckets);
        this.buckets = new ArrayList<>(this.totalBuckets);
        for (int i = 0; i < this.totalBuckets; i++) {
            buckets.add(new StringBuilder());
        }
    }

    /**
     * Adds an entry to its designated hash bucket.
     */
    public synchronized void addEntry(String key, String value) {
        if (key == null) return;
        int bucket = Math.abs(key.hashCode()) % totalBuckets;
        buckets.get(bucket).append(key).append("=").append(value != null ? value : "").append(";");
    }

    /**
     * Builds the complete Merkle binary tree up to the root hash.
     */
    public synchronized MerkleNode buildTree() {
        List<MerkleNode> leafNodes = new ArrayList<>(totalBuckets);
        for (int i = 0; i < totalBuckets; i++) {
            byte[] h = sha256(buckets.get(i).toString().getBytes(StandardCharsets.UTF_8));
            leafNodes.add(new MerkleNode(h, i, i));
        }

        List<MerkleNode> currentLevel = leafNodes;
        while (currentLevel.size() > 1) {
            List<MerkleNode> nextLevel = new ArrayList<>(currentLevel.size() / 2);
            for (int i = 0; i < currentLevel.size(); i += 2) {
                MerkleNode left = currentLevel.get(i);
                MerkleNode right = currentLevel.get(i + 1);

                byte[] combined = new byte[left.hash.length + right.hash.length];
                System.arraycopy(left.hash, 0, combined, 0, left.hash.length);
                System.arraycopy(right.hash, 0, combined, left.hash.length, right.hash.length);

                MerkleNode parent = new MerkleNode(sha256(combined), left.bucketStart, right.bucketEnd);
                parent.left = left;
                parent.right = right;
                nextLevel.add(parent);
            }
            currentLevel = nextLevel;
        }

        this.root = currentLevel.get(0);
        return this.root;
    }

    /**
     * Compares two Merkle trees and returns the list of desynchronized bucket indices.
     */
    public static List<Integer> findDifferences(MerkleNode nodeA, MerkleNode nodeB) {
        List<Integer> diffs = new ArrayList<>();
        compareNodes(nodeA, nodeB, diffs);
        return diffs;
    }

    private static void compareNodes(MerkleNode a, MerkleNode b, List<Integer> diffs) {
        if (a == null || b == null) return;

        if (Arrays.equals(a.hash, b.hash)) {
            return; // Subtrees are identical!
        }

        if (a.left == null && a.right == null) {
            // Leaf node difference found
            diffs.add(a.bucketStart);
            return;
        }

        compareNodes(a.left, b.left, diffs);
        compareNodes(a.right, b.right, diffs);
    }

    private static byte[] sha256(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return md.digest(data);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    private static int nextPowerOfTwo(int val) {
        int n = val - 1;
        n |= n >>> 1;
        n |= n >>> 2;
        n |= n >>> 4;
        n |= n >>> 8;
        n |= n >>> 16;
        return (n < 0) ? 1 : n + 1;
    }
}
