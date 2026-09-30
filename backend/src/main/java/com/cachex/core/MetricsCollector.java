package com.cachex.core;

import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.LongAdder;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Thread-safe Metrics Collector for CacheX.
 * Uses lock-free LongAdder counters and a bounded circular buffer for latency percentiles.
 */
public class MetricsCollector {

    private final LongAdder hits = new LongAdder();
    private final LongAdder misses = new LongAdder();
    private final LongAdder puts = new LongAdder();
    private final LongAdder deletes = new LongAdder();
    private final LongAdder evictions = new LongAdder();
    private final LongAdder expirations = new LongAdder();

    private static final int MAX_LATENCY_SAMPLES = 1000;
    private final ConcurrentLinkedQueue<Double> latencyMicros = new ConcurrentLinkedQueue<>();

    public void recordHit() {
        hits.increment();
    }

    public void recordMiss() {
        misses.increment();
    }

    public void recordPut() {
        puts.increment();
    }

    public void recordDelete() {
        deletes.increment();
    }

    public void recordEviction() {
        evictions.increment();
    }

    public void recordExpiration() {
        expirations.increment();
    }

    public void recordLatency(long startNanoTime) {
        double elapsedMicros = (System.nanoTime() - startNanoTime) / 1000.0;
        latencyMicros.offer(elapsedMicros);
        if (latencyMicros.size() > MAX_LATENCY_SAMPLES) {
            latencyMicros.poll();
        }
    }

    public long getHits() {
        return hits.sum();
    }

    public long getMisses() {
        return misses.sum();
    }

    public long getPuts() {
        return puts.sum();
    }

    public long getDeletes() {
        return deletes.sum();
    }

    public long getEvictions() {
        return evictions.sum();
    }

    public long getExpirations() {
        return expirations.sum();
    }

    public long getTotalRequests() {
        return getHits() + getMisses();
    }

    public double getHitRate() {
        long total = getTotalRequests();
        if (total == 0) return 0.0;
        double rate = ((double) getHits() / total) * 100.0;
        return Math.round(rate * 10.0) / 10.0;
    }

    public double getMissRate() {
        long total = getTotalRequests();
        if (total == 0) return 0.0;
        double rate = ((double) getMisses() / total) * 100.0;
        return Math.round(rate * 10.0) / 10.0;
    }

    public double getAverageLatencyMicros() {
        List<Double> samples = new ArrayList<>(latencyMicros);
        if (samples.isEmpty()) return 0.0;
        double sum = 0.0;
        for (double d : samples) {
            sum += d;
        }
        return Math.round((sum / samples.size()) * 100.0) / 100.0;
    }

    public double getP95LatencyMicros() {
        List<Double> samples = new ArrayList<>(latencyMicros);
        if (samples.isEmpty()) return 0.0;
        Collections.sort(samples);
        int idx = (int) Math.ceil(0.95 * samples.size()) - 1;
        idx = Math.max(0, Math.min(idx, samples.size() - 1));
        return Math.round(samples.get(idx) * 100.0) / 100.0;
    }

    public void reset() {
        hits.reset();
        misses.reset();
        puts.reset();
        deletes.reset();
        evictions.reset();
        expirations.reset();
        latencyMicros.clear();
    }
}
