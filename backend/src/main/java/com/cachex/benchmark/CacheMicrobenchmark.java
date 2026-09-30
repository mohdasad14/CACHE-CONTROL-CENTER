package com.cachex.benchmark;

import com.cachex.core.*;
import com.cachex.model.EvictionPolicyType;
import java.util.*;
import java.util.concurrent.*;

/**
 * JMH-Style Nanosecond Precision In-Memory Benchmark Runner for CacheX.
 *
 * Measures:
 * - Operations per second (Throughput).
 * - P50, P90, P99 latency percentiles in nanoseconds.
 * - Compares LRU, LFU, 2Q, ARC, LIRS, W-TinyLFU, CAR, SLRU policies under identical workloads.
 */
public class CacheMicrobenchmark {

    public static class BenchmarkResult {
        public final String policyName;
        public final int totalOperations;
        public final double operationsPerSecond;
        public final double p50Nano;
        public final double p99Nano;
        public final double hitRatePercent;

        public BenchmarkResult(String policy, int ops, double opsSec, double p50, double p99, double hitRate) {
            this.policyName = policy;
            this.totalOperations = ops;
            this.operationsPerSecond = opsSec;
            this.p50Nano = p50;
            this.p99Nano = p99;
            this.hitRatePercent = hitRate;
        }
    }

    public static BenchmarkResult runBenchmark(EvictionPolicyType policyType, int capacity, int operations) {
        CacheManager<String, String> cache = new CacheManager<>(capacity, policyType);
        long[] latencies = new long[operations];
        Random rand = new Random(42);

        long startTotal = System.nanoTime();
        int hits = 0;

        for (int i = 0; i < operations; i++) {
            String key = "key_" + (rand.nextInt(capacity * 2));
            long t0 = System.nanoTime();

            if (rand.nextDouble() < 0.70) {
                // 70% Reads
                String val = cache.get(key);
                if (val != null) hits++;
            } else {
                // 30% Writes
                cache.put(key, "val_" + i, 0);
            }

            latencies[i] = System.nanoTime() - t0;
        }

        long elapsedTotal = System.nanoTime() - startTotal;
        cache.shutdown();

        Arrays.sort(latencies);
        double opsSec = (operations / (double) elapsedTotal) * 1_000_000_000.0;
        double p50 = latencies[(int) (operations * 0.50)];
        double p99 = latencies[(int) (operations * 0.99)];
        double hitRate = (hits / (double) (operations * 0.70)) * 100.0;

        return new BenchmarkResult(policyType.name(), operations, opsSec, p50, p99, hitRate);
    }
}
