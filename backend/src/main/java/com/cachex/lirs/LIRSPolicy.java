package com.cachex.lirs;

import com.cachex.core.EvictionPolicy;
import com.cachex.model.EvictionPolicyType;
import java.util.*;

/**
 * Low Inter-reference Recency Set (LIRS) Eviction Algorithm.
 * Invented by Song Jiang and Xiaodong Zhang.
 *
 * Provides superior scan resistance over LRU, 2Q, and ARC by tracking
 * Inter-Reference Recency (IRR) instead of simple recency.
 *
 * Data Structure Anatomy:
 * - Stack S: Tracks LIR blocks and resident/non-resident HIR blocks to evaluate IRR.
 * - Queue Q: FIFO queue containing only resident HIR blocks.
 * - Pruning: Whenever the bottom of Stack S is an HIR block, Stack S is pruned upwards
 *   until a LIR block is at the bottom, maintaining the dynamic invariant.
 *
 * @param <K> Key type
 */
public class LIRSPolicy<K> implements EvictionPolicy<K> {

    public enum BlockStatus {
        LIR,            // Low Inter-Reference Recency (High priority resident block)
        RESIDENT_HIR,   // High Inter-Reference Recency (Probationary resident block)
        NON_RESIDENT_HIR // Non-resident tracking block (retains IRR without payload)
    }

    public static class LIRSNode<K> {
        final K key;
        BlockStatus status;
        LIRSNode<K> prevS;
        LIRSNode<K> nextS;
        LIRSNode<K> prevQ;
        LIRSNode<K> nextQ;
        boolean inStackS;

        LIRSNode(K key, BlockStatus status) {
            this.key = key;
            this.status = status;
            this.inStackS = false;
        }
    }

    private final int totalCapacity;
    private final int lirCapacity;
    private final int hirCapacity;

    private final Map<K, LIRSNode<K>> nodeMap = new HashMap<>();

    // Stack S sentinels (top = head, bottom = tail)
    private final LIRSNode<K> headS = new LIRSNode<>(null, null);
    private final LIRSNode<K> tailS = new LIRSNode<>(null, null);

    // Queue Q sentinels (front = head, rear = tail)
    private final LIRSNode<K> headQ = new LIRSNode<>(null, null);
    private final LIRSNode<K> tailQ = new LIRSNode<>(null, null);

    private int currentLirCount = 0;
    private int currentHirCount = 0;

    public LIRSPolicy(int capacity) {
        this.totalCapacity = Math.max(4, capacity);
        // 80% LIR blocks, 20% HIR blocks (minimum 1)
        this.lirCapacity = Math.max(2, (int) Math.round(this.totalCapacity * 0.80));
        this.hirCapacity = Math.max(1, this.totalCapacity - this.lirCapacity);

        headS.nextS = tailS;
        tailS.prevS = headS;

        headQ.nextQ = tailQ;
        tailQ.prevQ = headQ;
    }

    @Override
    public EvictionPolicyType getType() {
        return EvictionPolicyType.LRU; // Fallback category or custom enum
    }

    @Override
    public synchronized void recordAccess(K key) {
        if (key == null) return;
        LIRSNode<K> node = nodeMap.get(key);

        if (node == null) {
            recordAdd(key);
            return;
        }

        if (node.status == BlockStatus.LIR) {
            // LIR hit: Move to top of Stack S. If it was at bottom of S, prune S.
            boolean wasAtBottom = (tailS.prevS == node);
            removeFromStackS(node);
            addToTopStackS(node);
            if (wasAtBottom) {
                pruneStackS();
            }
        } else if (node.status == BlockStatus.RESIDENT_HIR) {
            // Resident HIR hit
            if (node.inStackS) {
                // Was in Stack S -> Demonstrated low IRR! Promote to LIR
                removeFromStackS(node);
                removeFromQueueQ(node);
                node.status = BlockStatus.LIR;
                currentLirCount++;
                currentHirCount--;
                addToTopStackS(node);

                // Demote bottom LIR in Stack S to HIR and place in Queue Q
                demoteBottomLirToHir();
                pruneStackS();
            } else {
                // Not in Stack S -> Remain HIR, but move to top of S and end of Q
                addToTopStackS(node);
                removeFromQueueQ(node);
                addToRearQueueQ(node);
            }
        } else if (node.status == BlockStatus.NON_RESIDENT_HIR) {
            // Non-resident HIR hit (Metadata hit after eviction)
            removeFromStackS(node);
            node.status = BlockStatus.LIR;
            currentLirCount++;
            addToTopStackS(node);
            demoteBottomLirToHir();
            pruneStackS();
        }
    }

    @Override
    public synchronized void recordAdd(K key) {
        if (key == null) return;
        LIRSNode<K> existing = nodeMap.get(key);
        if (existing != null) {
            recordAccess(key);
            return;
        }

        if (currentLirCount < lirCapacity) {
            // Initial warm-up: Populate LIR blocks directly
            LIRSNode<K> newNode = new LIRSNode<>(key, BlockStatus.LIR);
            nodeMap.put(key, newNode);
            addToTopStackS(newNode);
            currentLirCount++;
        } else {
            // Cache full: New item enters as probationary RESIDENT_HIR
            LIRSNode<K> newNode = new LIRSNode<>(key, BlockStatus.RESIDENT_HIR);
            nodeMap.put(key, newNode);
            addToTopStackS(newNode);
            addToRearQueueQ(newNode);
            currentHirCount++;
        }
    }

    @Override
    public synchronized void recordRemove(K key) {
        if (key == null) return;
        LIRSNode<K> node = nodeMap.remove(key);
        if (node == null) return;

        if (node.status == BlockStatus.LIR) {
            currentLirCount--;
            removeFromStackS(node);
            pruneStackS();
            // Promote front of Queue Q to LIR if available
            promoteFrontQToLir();
        } else if (node.status == BlockStatus.RESIDENT_HIR) {
            currentHirCount--;
            removeFromStackS(node);
            removeFromQueueQ(node);
        } else {
            removeFromStackS(node);
        }
    }

    @Override
    public synchronized K getEvictionCandidate() {
        // Eviction candidate is always the front of Queue Q (oldest resident HIR)
        if (headQ.nextQ != tailQ) {
            return headQ.nextQ.key;
        }
        // Fallback to bottom of Stack S
        if (tailS.prevS != headS) {
            return tailS.prevS.key;
        }
        return null;
    }

    @Override
    public synchronized void clear() {
        nodeMap.clear();
        headS.nextS = tailS;
        tailS.prevS = headS;
        headQ.nextQ = tailQ;
        tailQ.prevQ = headQ;
        currentLirCount = 0;
        currentHirCount = 0;
    }

    @Override
    public synchronized List<K> getOrder() {
        List<K> list = new ArrayList<>();
        // In order of priority: Queue Q (HIR) followed by Stack S (LIR)
        LIRSNode<K> currQ = headQ.nextQ;
        while (currQ != tailQ) {
            list.add(currQ.key);
            currQ = currQ.nextQ;
        }
        LIRSNode<K> currS = tailS.prevS;
        while (currS != headS) {
            if (!list.contains(currS.key) && currS.status != BlockStatus.NON_RESIDENT_HIR) {
                list.add(currS.key);
            }
            currS = currS.prevS;
        }
        return Collections.unmodifiableList(list);
    }

    public synchronized int getLirCount() {
        return currentLirCount;
    }

    public synchronized int getHirCount() {
        return currentHirCount;
    }

    public synchronized int size() {
        return currentLirCount + currentHirCount;
    }

    // --- Internal Helpers ---

    private void addToTopStackS(LIRSNode<K> node) {
        node.nextS = headS.nextS;
        node.prevS = headS;
        headS.nextS.prevS = node;
        headS.nextS = node;
        node.inStackS = true;
    }

    private void removeFromStackS(LIRSNode<K> node) {
        if (!node.inStackS) return;
        node.prevS.nextS = node.nextS;
        node.nextS.prevS = node.prevS;
        node.inStackS = false;
        node.prevS = null;
        node.nextS = null;
    }

    private void addToRearQueueQ(LIRSNode<K> node) {
        node.prevQ = tailQ.prevQ;
        node.nextQ = tailQ;
        tailQ.prevQ.nextQ = node;
        tailQ.prevQ = node;
    }

    private void removeFromQueueQ(LIRSNode<K> node) {
        if (node.prevQ == null || node.nextQ == null) return;
        node.prevQ.nextQ = node.nextQ;
        node.nextQ.prevQ = node.prevQ;
        node.prevQ = null;
        node.nextQ = null;
    }

    private void pruneStackS() {
        while (tailS.prevS != headS) {
            LIRSNode<K> bottom = tailS.prevS;
            if (bottom.status == BlockStatus.LIR) {
                break; // Invariant satisfied: Bottom of S is LIR
            }
            // Remove HIR node from bottom of Stack S
            removeFromStackS(bottom);
            if (bottom.status == BlockStatus.NON_RESIDENT_HIR) {
                nodeMap.remove(bottom.key);
            }
        }
    }

    private void demoteBottomLirToHir() {
        LIRSNode<K> bottom = tailS.prevS;
        if (bottom != headS && bottom.status == BlockStatus.LIR) {
            bottom.status = BlockStatus.RESIDENT_HIR;
            currentLirCount--;
            currentHirCount++;
            addToRearQueueQ(bottom);
        }
    }

    private void promoteFrontQToLir() {
        if (headQ.nextQ != tailQ && currentLirCount < lirCapacity) {
            LIRSNode<K> front = headQ.nextQ;
            removeFromQueueQ(front);
            front.status = BlockStatus.LIR;
            currentHirCount--;
            currentLirCount++;
            removeFromStackS(front);
            addToTopStackS(front);
        }
    }
}
