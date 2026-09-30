package com.cachex;

import com.cachex.core.CacheManager;
import com.cachex.model.EvictionPolicyType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

public class CacheManagerTest {

    private CacheManager<String, String> cache;

    @BeforeEach
    public void setup() {
        cache = new CacheManager<>(3, EvictionPolicyType.LRU);
    }

    @AfterEach
    public void tearDown() {
        if (cache != null) {
            cache.shutdown();
        }
    }

    @Test
    @DisplayName("LRU Policy: Should evict Least Recently Used entry when full")
    public void testLruEviction() {
        cache.put("k1", "v1", 0);
        cache.put("k2", "v2", 0);
        cache.put("k3", "v3", 0);

        // Access k1 and k2 to make k3 the least recently used
        assertEquals("v1", cache.get("k1"));
        assertEquals("v2", cache.get("k2"));

        // Put k4 -> k3 should be evicted
        cache.put("k4", "v4", 0);

        assertNull(cache.get("k3"), "k3 must be evicted as it was the least recently used");
        assertEquals("v1", cache.get("k1"));
        assertEquals("v2", cache.get("k2"));
        assertEquals("v4", cache.get("k4"));
        assertEquals(1, cache.getMetrics().getEvictions());
    }

    @Test
    @DisplayName("LFU Policy: Should evict Least Frequently Used entry when full")
    public void testLfuEviction() {
        cache.setPolicy(EvictionPolicyType.LFU);

        cache.put("k1", "v1", 0);
        cache.put("k2", "v2", 0);
        cache.put("k3", "v3", 0);

        // k1 accessed 3 times
        cache.get("k1");
        cache.get("k1");

        // k3 accessed 2 times
        cache.get("k3");

        // k2 accessed only 1 time (upon creation)
        // Put k4 -> k2 should be evicted due to lowest frequency
        cache.put("k4", "v4", 0);

        assertNull(cache.get("k2"), "k2 must be evicted as its frequency count was lowest");
        assertEquals("v1", cache.get("k1"));
        assertEquals("v3", cache.get("k3"));
        assertEquals("v4", cache.get("k4"));
    }

    @Test
    @DisplayName("Per-Entry TTL: Should expire automatically after deadline, independent of policy")
    public void testPerEntryTtl() throws InterruptedException {
        // Put k1 with short 80ms TTL
        cache.put("k1", "short_lived", 80);
        // Put k2 with long TTL
        cache.put("k2", "long_lived", 60000);

        assertEquals("short_lived", cache.get("k1"));

        // Wait for k1 to expire
        Thread.sleep(120);

        assertNull(cache.get("k1"), "k1 must be expired lazily on get");
        assertEquals("long_lived", cache.get("k2"), "k2 must remain valid");
        assertTrue(cache.getMetrics().getExpirations() >= 1, "Expirations counter must increment");
    }

    @Test
    @DisplayName("Multithreading: High-concurrency GET and PUT with 50 threads and 10,000 requests")
    public void testConcurrentAccessThreadSafety() throws InterruptedException {
        int threadCount = 50;
        int operationsPerThread = 200;
        int totalOps = threadCount * operationsPerThread;

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch endGate = new CountDownLatch(totalOps);

        AtomicInteger successCounter = new AtomicInteger(0);

        for (int i = 0; i < totalOps; i++) {
            final int id = i;
            executor.submit(() -> {
                try {
                    startGate.await();
                    String key = "key_" + (id % 10);
                    if (id % 2 == 0) {
                        cache.put(key, "val_" + id, 5000);
                    } else {
                        cache.get(key);
                    }
                    successCounter.incrementAndGet();
                } catch (Exception e) {
                    fail("Concurrency exception encountered: " + e.getMessage());
                } finally {
                    endGate.countDown();
                }
            });
        }

        startGate.countDown(); // release all threads
        boolean finished = endGate.await(15, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(finished, "All concurrent operations must complete in time");
        assertEquals(totalOps, successCounter.get(), "All operations must succeed without deadlocks or race conditions");
        assertTrue(cache.size() <= cache.getCapacity(), "Cache size must strictly never exceed capacity");
    }
}
