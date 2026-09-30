package com.cachex;

import com.cachex.core.CacheManager;
import com.cachex.model.EvictionPolicyType;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("CacheX High-Concurrency Multithreading Stress Test")
class ConcurrencyStressTest {

    @Test
    @DisplayName("Should sustain 64 threads hammering cache concurrently without data corruption or deadlocks")
    void testConcurrentHammering() throws InterruptedException {
        int threads = 64;
        int operationsPerThread = 500;
        int capacity = 50;

        CacheManager<String, String> cache = new CacheManager<>(capacity, EvictionPolicyType.LRU);
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch doneGate = new CountDownLatch(threads);
        AtomicInteger errorCount = new AtomicInteger(0);

        for (int t = 0; t < threads; t++) {
            final int threadId = t;
            executor.submit(() -> {
                try {
                    startGate.await(); // Synchronize all 64 threads to fire simultaneously
                    for (int i = 0; i < operationsPerThread; i++) {
                        String key = "key-" + (i % 80);
                        if (i % 3 == 0) {
                            cache.put(key, "val-" + threadId + "-" + i);
                        } else {
                            cache.get(key);
                        }
                    }
                } catch (Exception e) {
                    errorCount.incrementAndGet();
                } finally {
                    doneGate.countDown();
                }
            });
        }

        // Fire all threads!
        startGate.countDown();
        boolean completed = doneGate.await(15, TimeUnit.SECONDS);

        executor.shutdown();
        assertTrue(completed, "Stress test threads did not finish within timeout (possible deadlock)");
        assertEquals(0, errorCount.get(), "Concurrency test produced exceptions during execution");

        // Verify cache never exceeded maximum capacity
        assertTrue(cache.size() <= capacity, "Cache size exceeded configured capacity constraint: " + cache.size());
        assertTrue(cache.getMetrics().getTotalRequests() > 0, "Metrics were not updated during stress test");
    }
}
