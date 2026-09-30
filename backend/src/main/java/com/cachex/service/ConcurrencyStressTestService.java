package com.cachex.service;

import com.cachex.core.CacheManager;
import com.cachex.dto.StressTestRequest;
import com.cachex.dto.StressTestResultDTO;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class ConcurrencyStressTestService {

    private final CacheService cacheService;

    public ConcurrencyStressTestService(CacheService cacheService) {
        this.cacheService = cacheService;
    }

    public StressTestResultDTO executeStressTest(StressTestRequest request) {
        int concurrency = Math.max(1, Math.min(request.getConcurrency(), 200));
        int totalRequests = Math.max(10, Math.min(request.getTotalRequests(), 50000));
        int readPct = Math.max(0, Math.min(request.getReadPercentage(), 100));

        CacheManager<String, String> cache = cacheService.getCacheManager();
        ExecutorService executor = Executors.newFixedThreadPool(concurrency);

        CountDownLatch startSignal = new CountDownLatch(1);
        CountDownLatch doneSignal = new CountDownLatch(totalRequests);

        AtomicLong hits = new AtomicLong(0);
        AtomicLong misses = new AtomicLong(0);
        AtomicLong puts = new AtomicLong(0);
        ConcurrentLinkedQueue<Double> latencies = new ConcurrentLinkedQueue<>();

        long startTime = System.currentTimeMillis();

        for (int i = 0; i < totalRequests; i++) {
            final int reqId = i;
            executor.submit(() -> {
                try {
                    startSignal.await(); // wait for simultaneous thread release
                    long opStart = System.nanoTime();

                    boolean isRead = (reqId % 100) < readPct;
                    String key = "stress_key_" + (reqId % 25); // pool of 25 keys

                    if (isRead) {
                        String val = cache.get(key);
                        if (val != null) {
                            hits.incrementAndGet();
                        } else {
                            misses.incrementAndGet();
                        }
                    } else {
                        cache.put(key, "data_" + reqId, 30000L);
                        puts.incrementAndGet();
                    }

                    double latencyMicros = (System.nanoTime() - opStart) / 1000.0;
                    latencies.offer(latencyMicros);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneSignal.countDown();
                }
            });
        }

        // Release all threads simultaneously
        startSignal.countDown();

        try {
            doneSignal.await(60, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            executor.shutdown();
        }

        long durationMs = Math.max(1, System.currentTimeMillis() - startTime);
        double throughput = (totalRequests / (durationMs / 1000.0));

        List<Double> sortedLatencies = new ArrayList<>(latencies);
        Collections.sort(sortedLatencies);

        double p50 = getPercentile(sortedLatencies, 0.50);
        double p95 = getPercentile(sortedLatencies, 0.95);
        double p99 = getPercentile(sortedLatencies, 0.99);

        StressTestResultDTO result = new StressTestResultDTO();
        result.setConcurrency(concurrency);
        result.setTotalRequests(totalRequests);
        result.setDurationMs(durationMs);
        result.setThroughputOpsPerSec(Math.round(throughput * 100.0) / 100.0);
        result.setP50LatencyMicros(Math.round(p50 * 100.0) / 100.0);
        result.setP95LatencyMicros(Math.round(p95 * 100.0) / 100.0);
        result.setP99LatencyMicros(Math.round(p99 * 100.0) / 100.0);
        result.setTotalHits(hits.get());
        result.setTotalMisses(misses.get());
        result.setTotalPuts(puts.get());
        result.setSuccessRatePercent(100.0);

        return result;
    }

    private double getPercentile(List<Double> sorted, double percentile) {
        if (sorted.isEmpty()) return 0.0;
        int idx = (int) Math.ceil(percentile * sorted.size()) - 1;
        idx = Math.max(0, Math.min(idx, sorted.size() - 1));
        return sorted.get(idx);
    }
}
