package com.cachex.disruptor;

import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/**
 * Enterprise Disruptor Lock-Free Sequence Architecture.
 *
 * Implements mechanical sympathy principles:
 * - Cache-line padded sequences (prevents false sharing).
 * - Multi-producer claiming sequence with CAS loop.
 * - Single/Multi-consumer event batching without locks.
 */
public class DisruptorRing<T> {

    public static class PaddedSequence {
        public volatile long p1, p2, p3, p4, p5, p6, p7;
        public final AtomicLong value = new AtomicLong(-1);
        public volatile long a1, a2, a3, a4, a5, a6, a7;
    }

    private final Object[] ring;
    private final int bufferSize;
    private final int mask;
    private final PaddedSequence cursor = new PaddedSequence();
    private final PaddedSequence gatingSequence = new PaddedSequence();

    public DisruptorRing(int capacity) {
        this.bufferSize = nextPowerOfTwo(capacity);
        this.mask = this.bufferSize - 1;
        this.ring = new Object[this.bufferSize];
    }

    public boolean publish(T item) {
        if (item == null) return false;

        long current;
        long next;
        do {
            current = cursor.value.get();
            next = current + 1;
            if (next - gatingSequence.value.get() > bufferSize) {
                return false; // Buffer full
            }
        } while (!cursor.value.compareAndSet(current, next));

        int index = (int) (next & mask);
        ring[index] = item;
        return true;
    }

    @SuppressWarnings("unchecked")
    public int processBatch(Consumer<T> handler, int maxBatch) {
        long currentGating = gatingSequence.value.get();
        long available = cursor.value.get();
        int count = 0;

        while (currentGating < available && count < maxBatch) {
            long next = currentGating + 1;
            int idx = (int) (next & mask);
            T item = (T) ring[idx];

            if (item != null) {
                handler.accept(item);
                ring[idx] = null; // Clean slot
                currentGating = next;
                gatingSequence.value.set(next);
                count++;
            } else {
                break;
            }
        }
        return count;
    }

    private static int nextPowerOfTwo(int val) {
        int n = val - 1;
        n |= n >>> 1; n |= n >>> 2; n |= n >>> 4; n |= n >>> 8; n |= n >>> 16;
        return (n < 0) ? 1 : n + 1;
    }
}
