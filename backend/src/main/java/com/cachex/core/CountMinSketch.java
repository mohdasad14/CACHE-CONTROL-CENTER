package com.cachex.core;

import java.util.Random;

/**
 * High-performance 4-bit Count-Min Sketch frequency estimator.
 * Used by Window TinyLFU (W-TinyLFU) to estimate access frequency of keys
 * in O(1) time and constant memory footprint.
 *
 * Architecture:
 * - 4 hash functions generated via 64-bit Murmur3-like seed mixing.
 * - 4-bit saturating counters packed into 64-bit long words (16 counters per long).
 * - Periodic halving (aging) resets counts when total items reach a reset threshold,
 *   preventing historical access counts from permanently dominating recent trends.
 */
public class CountMinSketch<K> {

    private static final long[] SEED = {
        0xc3a5c85c97cb3127L,
        0xb492b66fbe98f273L,
        0x9ae16a3b2f90404fL,
        0xcbf29ce484222325L
    };

    private final long[] table;
    private final int tableMask;
    private final int sampleSize;
    private int size;

    /**
     * Initializes a CountMinSketch with table size rounded up to next power of two.
     *
     * @param maximumCapacity Maximum expected unique elements in cache
     */
    public CountMinSketch(int maximumCapacity) {
        int capacity = Math.max(16, nextPowerOfTwo(maximumCapacity));
        this.sampleSize = (maximumCapacity == 0) ? 10 : 10 * maximumCapacity;
        this.table = new long[capacity >>> 4]; // 16 4-bit counters per 64-bit word
        this.tableMask = Math.max(0, capacity - 1);
        this.size = 0;
    }

    /**
     * Returns the estimated frequency of the key (0 to 15).
     */
    public int estimate(K key) {
        if (key == null) return 0;
        int hash = spread(key.hashCode());
        int min = 15;

        for (int i = 0; i < 4; i++) {
            int h = hash(hash, i);
            int index = h & tableMask;
            int count = getCounter(index);
            if (count < min) {
                min = count;
            }
        }
        return min;
    }

    /**
     * Increments the frequency counter for the key across all 4 hash positions.
     * Automatically triggers periodic halving when sample size threshold is met.
     */
    public void increment(K key) {
        if (key == null) return;
        int hash = spread(key.hashCode());
        boolean modified = false;

        for (int i = 0; i < 4; i++) {
            int h = hash(hash, i);
            int index = h & tableMask;
            if (incrementCounter(index)) {
                modified = true;
            }
        }

        if (modified && (++size >= sampleSize)) {
            reset();
        }
    }

    /**
     * Halves all 4-bit counters in the sketch table to age old entries.
     */
    public void reset() {
        int count = 0;
        for (int i = 0; i < table.length; i++) {
            long word = table[i];
            // Halve each 4-bit nibble: (word >>> 1) & 0x7777777777777777L
            long halved = (word >>> 1) & 0x7777777777777777L;
            table[i] = halved;
            count += Long.bitCount(halved & 0x1111111111111111L);
        }
        this.size = (size >>> 1) - (count >>> 2);
    }

    public void clear() {
        java.util.Arrays.fill(table, 0L);
        this.size = 0;
    }

    public int getSampleSize() {
        return sampleSize;
    }

    public int getSize() {
        return size;
    }

    // --- Internal Bit Manipulation Helpers ---

    private int getCounter(int index) {
        int wordIndex = index >>> 4;
        int offset = (index & 15) << 2;
        return (int) ((table[wordIndex] >>> offset) & 0xfL);
    }

    private boolean incrementCounter(int index) {
        int wordIndex = index >>> 4;
        int offset = (index & 15) << 2;
        long mask = 0xfL << offset;
        long current = (table[wordIndex] >>> offset) & 0xfL;
        if (current < 15L) {
            table[wordIndex] = (table[wordIndex] & ~mask) | ((current + 1L) << offset);
            return true;
        }
        return false;
    }

    private static int hash(int itemHash, int seedIndex) {
        long h = (itemHash ^ SEED[seedIndex]) * 0x517cc1b727220a95L;
        return (int) (h ^ (h >>> 32));
    }

    private static int spread(int h) {
        return (h ^ (h >>> 16)) * 0x45d9f3b;
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
