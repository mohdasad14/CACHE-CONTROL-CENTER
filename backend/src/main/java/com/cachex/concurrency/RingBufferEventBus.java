package com.cachex.concurrency;

import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/**
 * High-Throughput Lock-Free Ring Buffer Event Bus.
 * Inspired by the LMAX Disruptor mechanical sympathy design principles.
 *
 * Used to publish cache events (PUT, GET, EVICT, EXPIRE) asynchronously to
 * metrics collectors, replication listeners, and write-behind workers without
 * taking locks on the main request execution path.
 */
public class RingBufferEventBus<E> {

    private final Object[] ring;
    private final int bufferSize;
    private final int indexMask;

    // Cache-line padded sequence pointers to avoid false sharing
    private final AtomicLong cursor = new AtomicLong(-1);
    private final AtomicLong consumed = new AtomicLong(-1);

    public RingBufferEventBus(int capacity) {
        this.bufferSize = nextPowerOfTwo(capacity);
        this.indexMask = bufferSize - 1;
        this.ring = new Object[bufferSize];
    }

    /**
     * Publishes an event to the ring buffer.
     * Returns true if successfully published, false if ring buffer is full.
     */
    public boolean publish(E event) {
        if (event == null) return false;

        long currentCursor;
        long nextSequence;

        do {
            currentCursor = cursor.get();
            nextSequence = currentCursor + 1;
            // Check if buffer is full
            if (nextSequence - consumed.get() > bufferSize) {
                return false; // Ring buffer full, backpressure
            }
        } while (!cursor.compareAndSet(currentCursor, nextSequence));

        int index = (int) (nextSequence & indexMask);
        ring[index] = event;
        return true;
    }

    /**
     * Polls and processes all available pending events using the consumer.
     * Returns number of events processed.
     */
    @SuppressWarnings("unchecked")
    public int drainTo(Consumer<E> consumer) {
        int count = 0;
        long head = consumed.get();
        long tail = cursor.get();

        while (head < tail) {
            long next = head + 1;
            int index = (int) (next & indexMask);
            E event = (E) ring[index];
            if (event != null) {
                ring[index] = null; // Help GC
                consumer.accept(event);
                consumed.set(next);
                head = next;
                count++;
            } else {
                break;
            }
        }
        return count;
    }

    public int getCapacity() {
        return bufferSize;
    }

    public long getPublishedCount() {
        return cursor.get() + 1;
    }

    public long getConsumedCount() {
        return consumed.get() + 1;
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
