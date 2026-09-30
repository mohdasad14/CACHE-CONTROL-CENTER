package com.cachex.core;

import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Adaptive Replacement Cache (ARC) Eviction Policy.
 *
 * Invented by Nimrod Megiddo and Dharmendra S. Modha (IBM Almaden Research).
 * ARC dynamically and self-tuningly adjusts between recency and frequency
 * depending on observed workload characteristics without requiring manual configuration.
 *
 * Maintains two double-ended queues:
 * - L1: Captures recency (split into T1 top and B1 bottom ghost cache)
 * - L2: Captures frequency (split into T2 top and B2 bottom ghost cache)
 *
 * A learning parameter 'p' adapts toward recency when hits occur in B1,
 * and toward frequency when hits occur in B2.
 *
 * @param <K> Key type
 */
public class ARCPolicy<K> implements EvictionPolicy<K> {

    private final Set<K> t1; // Recent cache entries
    private final Set<K> t2; // Frequent cache entries
    private final Set<K> b1; // Recent ghost cache (keys only)
    private final Set<K> b2; // Frequent ghost cache (keys only)
    private int p;           // Adaptive target size for T1
    private final ReentrantLock lock;

    public ARCPolicy() {
        this.t1 = new LinkedHashSet<>();
        this.t2 = new LinkedHashSet<>();
        this.b1 = new LinkedHashSet<>();
        this.b2 = new LinkedHashSet<>();
        this.p = 0;
        this.lock = new ReentrantLock();
    }

    @Override
    public EvictionPolicyType getType() {
        return EvictionPolicyType.ARC;
    }

    @Override
    public List<K> getOrder() {
        lock.lock();
        try {
            List<K> order = new ArrayList<>(t2);
            order.addAll(t1);
            return order;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordAccess(K key) {
        lock.lock();
        try {
            // Case 1: Key is already in T1 -> Promote to T2 (frequent)
            if (t1.remove(key)) {
                t2.add(key);
                return;
            }

            // Case 2: Key is already in T2 -> Move to most recent position in T2
            if (t2.remove(key)) {
                t2.add(key);
                return;
            }

            // Case 3: Key in ghost cache B1 (recency was pruned too aggressively)
            if (b1.remove(key)) {
                int delta = b1.size() >= b2.size() ? 1 : b2.size() / Math.max(1, b1.size());
                p = Math.min(p + delta, t1.size() + t2.size() + 1);
                t2.add(key);
                return;
            }

            // Case 4: Key in ghost cache B2 (frequency was pruned too aggressively)
            if (b2.remove(key)) {
                int delta = b2.size() >= b1.size() ? 1 : b1.size() / Math.max(1, b2.size());
                p = Math.max(p - delta, 0);
                t2.add(key);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordAdd(K key) {
        lock.lock();
        try {
            if (t1.contains(key) || t2.contains(key)) {
                recordAccess(key);
                return;
            }

            // Check if key was in history ghost lists
            if (b1.contains(key) || b2.contains(key)) {
                recordAccess(key);
            } else {
                // Completely new key enters T1
                t1.add(key);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void recordRemove(K key) {
        lock.lock();
        try {
            t1.remove(key);
            t2.remove(key);
            b1.remove(key);
            b2.remove(key);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public K getEvictionCandidate() {
        lock.lock();
        try {
            boolean evictFromT1 = !t1.isEmpty() && (t1.size() > p || (t2.isEmpty() && t1.size() == p));
            if (evictFromT1) {
                Iterator<K> it = t1.iterator();
                if (it.hasNext()) {
                    K victim = it.next();
                    it.remove();
                    b1.add(victim); // Keep in ghost cache for adaptive learning
                    return victim;
                }
            } else if (!t2.isEmpty()) {
                Iterator<K> it = t2.iterator();
                if (it.hasNext()) {
                    K victim = it.next();
                    it.remove();
                    b2.add(victim); // Keep in ghost cache for adaptive learning
                    return victim;
                }
            } else if (!t1.isEmpty()) {
                Iterator<K> it = t1.iterator();
                if (it.hasNext()) {
                    K victim = it.next();
                    it.remove();
                    b1.add(victim);
                    return victim;
                }
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
            t1.clear();
            t2.clear();
            b1.clear();
            b2.clear();
            p = 0;
        } finally {
            lock.unlock();
        }
    }

    public int getTuningParameterP() {
        return p;
    }
}
