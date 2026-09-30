package com.cachex.distributed;

import java.io.Serializable;
import java.util.*;

/**
 * Distributed Vector Clock Causality Tracker for Multi-Master Cache Replication.
 *
 * Solves write-write conflicts across distributed cache partitions:
 * - Detects happened-before relations without clock skew vulnerability.
 * - Identifies concurrent divergent updates requiring domain-specific conflict resolution (CRDT).
 */
public class VectorClock implements Serializable, Comparable<VectorClock> {

    public enum Ordering {
        BEFORE,
        AFTER,
        EQUAL,
        CONCURRENT
    }

    private final Map<String, Long> clock = new HashMap<>();

    public VectorClock() {}

    public VectorClock(VectorClock other) {
        if (other != null) {
            this.clock.putAll(other.clock);
        }
    }

    /**
     * Increments the vector clock timestamp for the specified node actor.
     */
    public synchronized void tick(String nodeId) {
        if (nodeId == null) return;
        clock.put(nodeId, clock.getOrDefault(nodeId, 0L) + 1L);
    }

    /**
     * Merges this vector clock with another, calculating the pairwise supremum (max).
     */
    public synchronized void merge(VectorClock other) {
        if (other == null) return;
        for (Map.Entry<String, Long> entry : other.clock.entrySet()) {
            long local = clock.getOrDefault(entry.getKey(), 0L);
            clock.put(entry.getKey(), Math.max(local, entry.getValue()));
        }
    }

    /**
     * Determines the causal ordering between this clock and another.
     */
    public synchronized Ordering compareClock(VectorClock other) {
        if (other == null) return Ordering.AFTER;

        boolean hasGreater = false;
        boolean hasLesser = false;

        Set<String> allNodes = new HashSet<>(clock.keySet());
        allNodes.addAll(other.clock.keySet());

        for (String node : allNodes) {
            long v1 = clock.getOrDefault(node, 0L);
            long v2 = other.clock.getOrDefault(node, 0L);

            if (v1 > v2) hasGreater = true;
            if (v1 < v2) hasLesser = true;
        }

        if (hasGreater && hasLesser) return Ordering.CONCURRENT;
        if (hasGreater) return Ordering.AFTER;
        if (hasLesser) return Ordering.BEFORE;
        return Ordering.EQUAL;
    }

    public synchronized long getTimestamp(String nodeId) {
        return clock.getOrDefault(nodeId, 0L);
    }

    public synchronized Map<String, Long> getSnapshot() {
        return Collections.unmodifiableMap(new HashMap<>(clock));
    }

    @Override
    public int compareTo(VectorClock other) {
        Ordering ord = compareClock(other);
        if (ord == Ordering.BEFORE) return -1;
        if (ord == Ordering.AFTER) return 1;
        return 0;
    }

    @Override
    public String toString() {
        return clock.toString();
    }
}
