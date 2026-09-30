package com.cachex.stats;

import java.util.Arrays;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * High-performance circular buffer sliding window metrics accumulator.
 * Tracks lock-free latency percentiles (P50, P90, P99) and moving throughput.
 */
public class SlidingWindowStats {

    private final int windowSize;
    private final long[] latencyNanosRing;
    private final AtomicInteger writeIndex;
    private final AtomicLong sampleCount;

    public SlidingWindowStats(int windowSize) {
        this.windowSize = windowSize;
        this.latencyNanosRing = new long[windowSize];
        this.writeIndex = new AtomicInteger(0);
        this.sampleCount = new AtomicLong(0);
    }

    public SlidingWindowStats() {
        this(2048);
    }

    /**
     * Records a latency measurement in nanoseconds.
     */
    public void recordLatencyNanos(long nanos) {
        int idx = Math.abs(writeIndex.getAndIncrement() % windowSize);
        latencyNanosRing[idx] = nanos;
        sampleCount.incrementAndGet();
    }

    /**
     * Computes snapshot percentiles without halting concurrent record calls.
     *
     * @return PercentileResult containing p50, p90, p99, min, max, avg in microseconds
     */
    public Snapshot computeSnapshot() {
        int count = (int) Math.min(sampleCount.get(), (long) windowSize);
        if (count == 0) {
            return new Snapshot(0, 0, 0, 0, 0, 0, 0);
        }

        long[] copy = new long[count];
        System.arraycopy(latencyNanosRing, 0, copy, 0, count);
        Arrays.sort(copy);

        long minNano = copy[0];
        long maxNano = copy[count - 1];
        long p50Nano = copy[(int) (count * 0.50)];
        long p90Nano = copy[(int) (count * 0.90)];
        long p99Nano = copy[Math.min(count - 1, (int) (count * 0.99))];

        double sum = 0;
        for (long v : copy) {
            sum += v;
        }
        double avgNano = sum / count;

        return new Snapshot(
            minNano / 1000.0,
            maxNano / 1000.0,
            avgNano / 1000.0,
            p50Nano / 1000.0,
            p90Nano / 1000.0,
            p99Nano / 1000.0,
            sampleCount.get()
        );
    }

    public static class Snapshot {
        public final double minMicros;
        public final double maxMicros;
        public final double avgMicros;
        public final double p50Micros;
        public final double p90Micros;
        public final double p99Micros;
        public final long totalSamples;

        public Snapshot(double minMicros, double maxMicros, double avgMicros,
                        double p50Micros, double p90Micros, double p99Micros, long totalSamples) {
            this.minMicros = minMicros;
            this.maxMicros = maxMicros;
            this.avgMicros = avgMicros;
            this.p50Micros = p50Micros;
            this.p90Micros = p90Micros;
            this.p99Micros = p99Micros;
            this.totalSamples = totalSamples;
        }
    }
}
