package com.cachex;

import com.cachex.concurrency.StampedLockCacheManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("StampedLock Optimistic Concurrency Tests")
public class StampedLockCacheManagerTest {

    @Test
    @DisplayName("Should validate optimistic reads without acquiring pessimistic locks")
    void testOptimisticReadFastPath() {
        StampedLockCacheManager<String, String> cache = new StampedLockCacheManager<>(100);
        cache.put("sensor:temp", "24.5C");

        // Read multiple times
        for (int i = 0; i < 100; i++) {
            assertEquals("24.5C", cache.get("sensor:temp"));
        }

        assertTrue(cache.getOptimisticHits() > 50, "Optimistic reads should dominate under uncontended read workload");
    }

    @Test
    @DisplayName("Compute-if-absent atomically inserts only once")
    void testComputeIfAbsent() throws InterruptedException {
        StampedLockCacheManager<String, String> cache = new StampedLockCacheManager<>(50);
        AtomicInteger invocationCount = new AtomicInteger(0);

        int threads = 16;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);

        for (int i = 0; i < threads; i++) {
            pool.submit(() -> {
                try {
                    cache.computeIfAbsent("sharedKey", k -> {
                        invocationCount.incrementAndGet();
                        return "calculated_result";
                    });
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(5, TimeUnit.SECONDS));
        pool.shutdown();

        assertEquals("calculated_result", cache.get("sharedKey"));
        assertEquals(1, invocationCount.get(), "Function should be called exactly once despite 16 concurrent callers");
    }
}
