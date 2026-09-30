package com.cachex.bloom;

import java.util.Arrays;

/**
 * Counting Bloom Filter with 4-bit Saturating Counters.
 *
 * Extends standard Bloom filter with deletion support:
 * - 4-bit nibble counters permit up to 15 increments before saturation.
 * - Key removal decrements counters, eliminating false negative risks from deletions.
 */
public class CountingBloomFilter<K> {

    private final long[] table;
    private final int bitCount;
    private final int numHashes;

    public CountingBloomFilter(int expectedElements, double falsePositiveRate) {
        int bits = (int) Math.ceil(-(expectedElements * Math.log(falsePositiveRate)) / (Math.log(2) * Math.log(2)));
        this.bitCount = Math.max(64, nextPowerOfTwo(bits));
        this.numHashes = Math.max(1, (int) Math.round((bitCount / (double) expectedElements) * Math.log(2)));
        this.table = new long[bitCount >>> 4]; // 16 4-bit counters per long
    }

    public synchronized void add(K key) {
        if (key == null) return;
        int[] hashes = getHashes(key);
        for (int h : hashes) {
            int idx = h & (bitCount - 1);
            increment(idx);
        }
    }

    public synchronized boolean mightContain(K key) {
        if (key == null) return false;
        int[] hashes = getHashes(key);
        for (int h : hashes) {
            int idx = h & (bitCount - 1);
            if (getCount(idx) == 0) return false;
        }
        return true;
    }

    public synchronized boolean remove(K key) {
        if (!mightContain(key)) return false;
        int[] hashes = getHashes(key);
        for (int h : hashes) {
            int idx = h & (bitCount - 1);
            decrement(idx);
        }
        return true;
    }

    private int getCount(int idx) {
        int word = idx >>> 4;
        int offset = (idx & 15) << 2;
        return (int) ((table[word] >>> offset) & 0xfL);
    }

    private void increment(int idx) {
        int word = idx >>> 4;
        int offset = (idx & 15) << 2;
        long current = (table[word] >>> offset) & 0xfL;
        if (current < 15L) {
            long mask = 0xfL << offset;
            table[word] = (table[word] & ~mask) | ((current + 1L) << offset);
        }
    }

    private void decrement(int idx) {
        int word = idx >>> 4;
        int offset = (idx & 15) << 2;
        long current = (table[word] >>> offset) & 0xfL;
        if (current > 0L) {
            long mask = 0xfL << offset;
            table[word] = (table[word] & ~mask) | ((current - 1L) << offset);
        }
    }

    private int[] getHashes(K key) {
        int h = key.hashCode();
        int[] result = new int[numHashes];
        int h1 = h;
        int h2 = (h ^ (h >>> 16)) * 0x85ebca6b;
        for (int i = 0; i < numHashes; i++) {
            result[i] = Math.abs(h1 + i * h2);
        }
        return result;
    }

    private static int nextPowerOfTwo(int val) {
        int n = val - 1;
        n |= n >>> 1; n |= n >>> 2; n |= n >>> 4; n |= n >>> 8; n |= n >>> 16;
        return (n < 0) ? 1 : n + 1;
    }
}
