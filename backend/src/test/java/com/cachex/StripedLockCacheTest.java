package com.cachex;

import com.cachex.concurrency.StripedLockCache;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Striped Lock Concurrency Tests")
public class StripedLockCacheTest {

    @Test
    @DisplayName("Should store and retrieve values with striped concurrency")
    void testBasicPutGet() {
        StripedLockCache<String, String> cache = new StripedLockCache<>(100, 16);
        cache.put("user:1", "Alice");
        cache.put("user:2", "Bob");

        assertEquals("Alice", cache.get("user:1"));
        assertEquals("Bob", cache.get("user:2"));
        assertNull(cache.get("user:999"));
        assertTrue(cache.containsKey("user:1"));
    }

    @Test
    @DisplayName("Heavy multi-threaded contention across 32 threads should produce zero data races")
    void testConcurrentWrites() throws InterruptedException {
        int threads = 32;
        int operationsPerThread = 500;
        StripedLockCache<String, Integer> cache = new StripedLockCache<>(20000, 64);
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);

        for (int t = 0; t < threads; t++) {
            final int threadId = t;
            pool.submit(() -> {
                try {
                    for (int i = 0; i < operationsPerThread; i++) {
                        String key = "item:" + (threadId * operationsPerThread + i);
                        cache.put(key, i);
                        Integer val = cache.get(key);
                        assertNotNull(val);
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(10, TimeUnit.SECONDS));
        pool.shutdown();
        assertEquals(threads * operationsPerThread, cache.size());
    }
}
