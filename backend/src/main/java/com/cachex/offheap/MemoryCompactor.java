package com.cachex.offheap;

import java.util.*;

/**
 * Free-List Memory Compactor and Defragmentation Engine.
 *
 * Manages reclaimed memory holes in off-heap slab blocks.
 * Implements a segregated free list with best-fit allocation search
 * to minimize fragmentation during continuous write/evict cycles.
 */
public class MemoryCompactor {

    public static class FreeBlock implements Comparable<FreeBlock> {
        public final int offset;
        public final int size;

        public FreeBlock(int offset, int size) {
            this.offset = offset;
            this.size = size;
        }

        @Override
        public int compareTo(FreeBlock other) {
            int cmp = Integer.compare(this.size, other.size);
            return (cmp != 0) ? cmp : Integer.compare(this.offset, other.offset);
        }
    }

    private final TreeSet<FreeBlock> freeBlocksBySize = new TreeSet<>();
    private final TreeMap<Integer, FreeBlock> freeBlocksByOffset = new TreeMap<>();
    private long totalFreeBytes = 0;

    /**
     * Releases an allocated block back into the free list, coalescing adjacent blocks.
     */
    public synchronized void free(int offset, int size) {
        if (size <= 0) return;

        int coalescedOffset = offset;
        int coalescedSize = size;

        // Check if there is an adjacent preceding free block to coalesce with
        Map.Entry<Integer, FreeBlock> floor = freeBlocksByOffset.floorEntry(offset);
        if (floor != null && floor.getKey() + floor.getValue().size == offset) {
            FreeBlock prev = floor.getValue();
            freeBlocksBySize.remove(prev);
            freeBlocksByOffset.remove(prev.offset);
            coalescedOffset = prev.offset;
            coalescedSize += prev.size;
            totalFreeBytes -= prev.size;
        }

        // Check if there is an adjacent following free block to coalesce with
        Map.Entry<Integer, FreeBlock> higher = freeBlocksByOffset.higherEntry(offset);
        if (higher != null && offset + size == higher.getKey()) {
            FreeBlock next = higher.getValue();
            freeBlocksBySize.remove(next);
            freeBlocksByOffset.remove(next.offset);
            coalescedSize += next.size;
            totalFreeBytes -= next.size;
        }

        FreeBlock merged = new FreeBlock(coalescedOffset, coalescedSize);
        freeBlocksBySize.add(merged);
        freeBlocksByOffset.put(coalescedOffset, merged);
        totalFreeBytes += coalescedSize;
    }

    /**
     * Allocates a contiguous block of memory using Best-Fit search.
     * Returns the memory offset or -1 if no suitable free block exists.
     */
    public synchronized int allocate(int requestedSize) {
        if (requestedSize <= 0) return -1;

        FreeBlock probe = new FreeBlock(0, requestedSize);
        FreeBlock bestFit = freeBlocksBySize.ceiling(probe);

        if (bestFit == null) {
            return -1; // No free block large enough
        }

        freeBlocksBySize.remove(bestFit);
        freeBlocksByOffset.remove(bestFit.offset);
        totalFreeBytes -= bestFit.size;

        int remaining = bestFit.size - requestedSize;
        if (remaining > 0) {
            FreeBlock remainder = new FreeBlock(bestFit.offset + requestedSize, remaining);
            freeBlocksBySize.add(remainder);
            freeBlocksByOffset.put(remainder.offset, remainder);
            totalFreeBytes += remaining;
        }

        return bestFit.offset;
    }

    public synchronized long getTotalFreeBytes() {
        return totalFreeBytes;
    }

    public synchronized int getFreeBlockCount() {
        return freeBlocksBySize.size();
    }
}
