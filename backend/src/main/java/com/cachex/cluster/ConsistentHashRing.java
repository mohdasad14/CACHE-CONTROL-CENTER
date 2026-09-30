package com.cachex.cluster;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;

/**
 * Consistent Hash Ring with Virtual Nodes for Distributed Cache Sharding.
 *
 * Distributes cache keys uniformly across cluster nodes while minimizing key migration
 * when nodes join or leave the cluster (K/N keys move on average).
 *
 * Architecture:
 * - Uses 64-bit MD5 hashing on ring space [0, 2^64 - 1].
 * - Configurable virtual nodes per physical host (default 160) to eliminate hotspot skew.
 * - NavigableMap with ceilingEntry() logarithmic lookup O(log(V * N)).
 *
 * @param <T> Node descriptor type (e.g., HostAndPort string or ServerNode)
 */
public class ConsistentHashRing<T> {

    private final int numberOfReplicas;
    private final NavigableMap<Long, T> ring = new TreeMap<>();
    private final Set<T> physicalNodes = new HashSet<>();

    public ConsistentHashRing(int numberOfReplicas, Collection<T> initialNodes) {
        this.numberOfReplicas = Math.max(1, numberOfReplicas);
        if (initialNodes != null) {
            for (T node : initialNodes) {
                addNode(node);
            }
        }
    }

    public synchronized void addNode(T node) {
        if (node == null) return;
        physicalNodes.add(node);
        for (int i = 0; i < numberOfReplicas; i++) {
            long hash = hash(node.toString() + "##vnode" + i);
            ring.put(hash, node);
        }
    }

    public synchronized void removeNode(T node) {
        if (node == null) return;
        physicalNodes.remove(node);
        for (int i = 0; i < numberOfReplicas; i++) {
            long hash = hash(node.toString() + "##vnode" + i);
            ring.remove(hash);
        }
    }

    /**
     * Resolves the target node responsible for storing or querying the given key.
     */
    public synchronized T getNode(Object key) {
        if (ring.isEmpty() || key == null) {
            return null;
        }

        long hash = hash(key.toString());
        Map.Entry<Long, T> entry = ring.ceilingEntry(hash);
        if (entry == null) {
            // Wrap around clockwise to the start of the ring
            entry = ring.firstEntry();
        }
        return entry.getValue();
    }

    /**
     * Returns N distinct physical replica nodes for redundant write replication.
     */
    public synchronized List<T> getReplicationNodes(Object key, int count) {
        if (ring.isEmpty() || count <= 0) {
            return Collections.emptyList();
        }

        List<T> targets = new ArrayList<>(count);
        Set<T> seen = new HashSet<>();

        long hash = hash(key.toString());
        NavigableMap<Long, T> tail = ring.tailMap(hash, true);

        for (T node : tail.values()) {
            if (seen.add(node)) {
                targets.add(node);
                if (targets.size() == count) return targets;
            }
        }

        // Wrap around ring
        for (T node : ring.values()) {
            if (seen.add(node)) {
                targets.add(node);
                if (targets.size() == count) return targets;
            }
        }

        return targets;
    }

    public synchronized int getPhysicalNodeCount() {
        return physicalNodes.size();
    }

    public synchronized int getVirtualNodeCount() {
        return ring.size();
    }

    public synchronized Set<T> getPhysicalNodes() {
        return Collections.unmodifiableSet(new HashSet<>(physicalNodes));
    }

    private static long hash(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(value.getBytes(StandardCharsets.UTF_8));
            long h = 0;
            for (int i = 0; i < 8; i++) {
                h = (h << 8) | (digest[i] & 0xFF);
            }
            return h;
        } catch (NoSuchAlgorithmException e) {
            // Fallback 64-bit FNV-1a
            long h = 0xcbf29ce484222325L;
            for (byte b : value.getBytes(StandardCharsets.UTF_8)) {
                h ^= (b & 0xFF);
                h *= 0x100000001b3L;
            }
            return h;
        }
    }
}
