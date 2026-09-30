package com.cachex.car;

import com.cachex.core.EvictionPolicy;
import com.cachex.model.EvictionPolicyType;
import java.util.*;

/**
 * Clock with Adaptive Replacement (CAR) Eviction Algorithm.
 * Invented by Sorav Bansal and Dharmendra S. Modha (IBM Almaden Research).
 *
 * Features:
 * - Combines the scan-resistance and adaptive learning of ARC with the low-overhead,
 *   lock-free friendly page-replacement mechanism of CLOCK.
 * - Maintains 4 circular lists / queues:
 *     T1: Recent pages (CLOCK hand handT1)
 *     T2: Frequent pages (CLOCK hand handT2)
 *     B1: History of evicted recent pages
 *     B2: History of evicted frequent pages
 * - Self-tuning target parameter 'p' adapts to recency- vs frequency-dominated workloads.
 */
public class CARPolicy<K> implements EvictionPolicy<K> {

    private static class PageNode<K> {
        final K key;
        boolean referenceBit;

        PageNode(K key) {
            this.key = key;
            this.referenceBit = false;
        }
    }

    private final int capacity;
    private double targetP; // Self-tuning target size for T1

    private final List<PageNode<K>> listT1 = new ArrayList<>();
    private final List<PageNode<K>> listT2 = new ArrayList<>();
    private final LinkedHashSet<K> listB1 = new LinkedHashSet<>();
    private final LinkedHashSet<K> listB2 = new LinkedHashSet<>();

    private final Map<K, PageNode<K>> directory = new HashMap<>();

    private int handT1 = 0;
    private int handT2 = 0;

    public CARPolicy(int capacity) {
        this.capacity = Math.max(4, capacity);
        this.targetP = 0.0;
    }

    @Override
    public EvictionPolicyType getType() {
        return EvictionPolicyType.ARC; // ARC family
    }

    @Override
    public synchronized void recordAccess(K key) {
        if (key == null) return;
        PageNode<K> node = directory.get(key);
        if (node != null) {
            node.referenceBit = true; // Mark referenced
            return;
        }

        // Cache miss: adapt target parameter p based on ghost hits in B1/B2
        if (listB1.contains(key)) {
            listB1.remove(key);
            double delta = (listB1.size() >= listB2.size()) ? 1.0 : (double) listB2.size() / listB1.size();
            targetP = Math.min(capacity, targetP + Math.max(1.0, delta));
            // Promote directly to T2
            insertIntoT2(key);
        } else if (listB2.contains(key)) {
            listB2.remove(key);
            double delta = (listB2.size() >= listB1.size()) ? 1.0 : (double) listB1.size() / listB2.size();
            targetP = Math.max(0.0, targetP - Math.max(1.0, delta));
            // Promote directly to T2
            insertIntoT2(key);
        } else {
            // Brand new key -> enter T1
            insertIntoT1(key);
        }
    }

    @Override
    public synchronized void recordAdd(K key) {
        recordAccess(key);
    }

    @Override
    public synchronized void recordRemove(K key) {
        if (key == null) return;
        PageNode<K> node = directory.remove(key);
        if (node != null) {
            listT1.remove(node);
            listT2.remove(node);
        }
        listB1.remove(key);
        listB2.remove(key);
    }

    @Override
    public synchronized K getEvictionCandidate() {
        if (directory.isEmpty()) return null;

        // Choose candidate by clock hand sweeping between T1 and T2
        if (listT1.size() >= Math.max(1, (int) Math.round(targetP))) {
            return stepHand(listT1, true);
        } else if (!listT2.isEmpty()) {
            return stepHand(listT2, false);
        } else if (!listT1.isEmpty()) {
            return stepHand(listT1, true);
        }
        return null;
    }

    @Override
    public synchronized void clear() {
        directory.clear();
        listT1.clear();
        listT2.clear();
        listB1.clear();
        listB2.clear();
        handT1 = 0;
        handT2 = 0;
        targetP = 0.0;
    }

    @Override
    public synchronized List<K> getOrder() {
        List<K> list = new ArrayList<>();
        for (PageNode<K> n : listT1) list.add(n.key);
        for (PageNode<K> n : listT2) list.add(n.key);
        return Collections.unmodifiableList(list);
    }

    public synchronized double getTargetP() {
        return targetP;
    }

    public synchronized int getT1Size() {
        return listT1.size();
    }

    public synchronized int getT2Size() {
        return listT2.size();
    }

    public synchronized int size() {
        return directory.size();
    }

    private void insertIntoT1(K key) {
        PageNode<K> node = new PageNode<>(key);
        directory.put(key, node);
        listT1.add(node);
    }

    private void insertIntoT2(K key) {
        PageNode<K> node = new PageNode<>(key);
        directory.put(key, node);
        listT2.add(node);
    }

    private K stepHand(List<PageNode<K>> list, boolean isT1) {
        int sweeps = 0;
        int maxSweeps = list.size() * 2 + 1;
        int hand = isT1 ? handT1 : handT2;

        while (sweeps < maxSweeps && !list.isEmpty()) {
            if (hand >= list.size()) hand = 0;
            PageNode<K> node = list.get(hand);

            if (node.referenceBit) {
                node.referenceBit = false;
                hand++;
            } else {
                // Found victim
                list.remove(hand);
                directory.remove(node.key);
                if (isT1) {
                    listB1.add(node.key);
                    if (listB1.size() > capacity) {
                        removeOldest(listB1);
                    }
                    handT1 = hand;
                } else {
                    listB2.add(node.key);
                    if (listB2.size() > capacity) {
                        removeOldest(listB2);
                    }
                    handT2 = hand;
                }
                return node.key;
            }
            sweeps++;
        }

        if (!list.isEmpty()) {
            PageNode<K> fallback = list.remove(0);
            directory.remove(fallback.key);
            return fallback.key;
        }
        return null;
    }

    private void removeOldest(LinkedHashSet<K> set) {
        Iterator<K> it = set.iterator();
        if (it.hasNext()) {
            it.next();
            it.remove();
        }
    }
}
