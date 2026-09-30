package com.cachex.loader;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * High-Throughput Write-Behind (Write-Back) Asynchronous Persistence Queue.
 *
 * Incoming write operations are staged into an in-memory concurrent buffer,
 * coalesced by key, and flushed in batches to the underlying CacheWriter
 * on a scheduled timer or when batch size threshold is reached.
 *
 * Guarantees ultra-low write latency for applications by decoupling disk/network I/O
 * from the hot path.
 *
 * @param <K> Key type
 * @param <V> Value type
 */
public class WriteBehindQueue<K, V> {

    private static final Logger log = LoggerFactory.getLogger(WriteBehindQueue.class);

    private final CacheWriter<K, V> writer;
    private final ConcurrentMap<K, V> pendingWrites;
    private final ScheduledExecutorService scheduler;
    private final int batchSizeThreshold;
    private final AtomicBoolean isFlushing;
    private final AtomicLong flushedCount;

    public WriteBehindQueue(CacheWriter<K, V> writer, int batchSizeThreshold, long flushIntervalMillis) {
        this.writer = writer;
        this.batchSizeThreshold = batchSizeThreshold;
        this.pendingWrites = new ConcurrentHashMap<>();
        this.isFlushing = new AtomicBoolean(false);
        this.flushedCount = new AtomicLong(0);

        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "CacheX-WriteBehind-Flusher");
            t.setDaemon(true);
            return t;
        });

        this.scheduler.scheduleWithFixedDelay(
            this::flush,
            flushIntervalMillis,
            flushIntervalMillis,
            TimeUnit.MILLISECONDS
        );
    }

    /**
     * Staging an entry for write-behind persistence.
     * Coalesces redundant updates on the same key.
     */
    public void stageWrite(K key, V value) {
        pendingWrites.put(key, value);
        if (pendingWrites.size() >= batchSizeThreshold) {
            scheduler.execute(this::flush);
        }
    }

    /**
     * Flushes buffered entries to the underlying CacheWriter.
     */
    public synchronized void flush() {
        if (pendingWrites.isEmpty()) {
            return;
        }

        if (!isFlushing.compareAndSet(false, true)) {
            return; // Flush already in progress
        }

        try {
            Map<K, V> snapshot = new HashMap<>(pendingWrites);
            if (!snapshot.isEmpty()) {
                writer.writeAll(snapshot);
                for (K key : snapshot.keySet()) {
                    pendingWrites.remove(key, snapshot.get(key));
                }
                flushedCount.addAndGet(snapshot.size());
                log.debug("WriteBehindQueue flushed {} entries to backing store", snapshot.size());
            }
        } catch (Exception e) {
            log.error("Failed flushing write-behind buffer", e);
        } finally {
            isFlushing.set(false);
        }
    }

    public int getPendingCount() {
        return pendingWrites.size();
    }

    public long getFlushedCount() {
        return flushedCount.get();
    }

    public void shutdown() {
        flush();
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(2, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
