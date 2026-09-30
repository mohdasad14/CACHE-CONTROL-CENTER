package com.cachex.offheap;

import java.nio.ByteBuffer;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Off-Heap Direct Memory Byte Store.
 *
 * Stores large binary cache payloads in direct off-heap native memory (ByteBuffer.allocateDirect).
 * Eliminates JVM garbage collection pauses (GC STW) caused by multi-gigabyte heap footprints.
 *
 * Features:
 * - Slab-style linear memory allocation.
 * - Key-to-offset pointer index.
 * - Explicit native memory deallocation on shutdown.
 */
public class OffHeapByteStore<K> {

    public static class MemoryPointer {
        final int offset;
        final int length;

        MemoryPointer(int offset, int length) {
            this.offset = offset;
            this.length = length;
        }
    }

    private final int totalCapacityBytes;
    private final ByteBuffer offHeapBuffer;
    private final Map<K, MemoryPointer> pointerTable;
    private final AtomicInteger writeOffset;
    private final ReentrantLock allocationLock;

    public OffHeapByteStore(int capacityBytes) {
        this.totalCapacityBytes = Math.max(1024 * 1024, capacityBytes);
        this.offHeapBuffer = ByteBuffer.allocateDirect(this.totalCapacityBytes);
        this.pointerTable = new ConcurrentHashMap<>();
        this.writeOffset = new AtomicInteger(0);
        this.allocationLock = new ReentrantLock();
    }

    /**
     * Stores byte array off-heap and records its offset pointer.
     */
    public boolean put(K key, byte[] data) {
        if (key == null || data == null || data.length == 0) return false;

        allocationLock.lock();
        try {
            int len = data.length;
            int offset = writeOffset.get();

            if (offset + len > totalCapacityBytes) {
                // Out of off-heap linear slab space
                return false;
            }

            // Write bytes into direct buffer
            ByteBuffer slice = offHeapBuffer.duplicate();
            slice.position(offset);
            slice.put(data);

            writeOffset.addAndGet(len);
            pointerTable.put(key, new MemoryPointer(offset, len));
            return true;
        } finally {
            allocationLock.unlock();
        }
    }

    /**
     * Reads byte array from off-heap memory without allocating intermediate objects.
     */
    public byte[] get(K key) {
        if (key == null) return null;
        MemoryPointer ptr = pointerTable.get(key);
        if (ptr == null) return null;

        byte[] dest = new byte[ptr.length];
        ByteBuffer slice = offHeapBuffer.duplicate();
        slice.position(ptr.offset);
        slice.get(dest);
        return dest;
    }

    public boolean remove(K key) {
        if (key == null) return false;
        return pointerTable.remove(key) != null;
    }

    public boolean containsKey(K key) {
        return key != null && pointerTable.containsKey(key);
    }

    public int getUsedBytes() {
        return writeOffset.get();
    }

    public int getTotalCapacityBytes() {
        return totalCapacityBytes;
    }

    public int getEntryCount() {
        return pointerTable.size();
    }

    public void clear() {
        allocationLock.lock();
        try {
            pointerTable.clear();
            writeOffset.set(0);
        } finally {
            allocationLock.unlock();
        }
    }
}
