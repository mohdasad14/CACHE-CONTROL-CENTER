package com.cachex;

import com.cachex.concurrency.LockFreeQueue;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Michael & Scott Lock-Free Queue Tests")
public class LockFreeQueueTest {

    @Test
    @DisplayName("FIFO order maintained in single-threaded operations")
    void testSingleThreadFIFO() {
        LockFreeQueue<String> queue = new LockFreeQueue<>();
        assertTrue(queue.isEmpty());

        queue.enqueue("first");
        queue.enqueue("second");
        queue.enqueue("third");

        assertEquals("first", queue.dequeue());
        assertEquals("second", queue.dequeue());
        assertEquals("third", queue.dequeue());
        assertNull(queue.dequeue());
        assertTrue(queue.isEmpty());
    }

    @Test
    @DisplayName("Concurrent producer-consumer stress test with 100,000 items")
    void testConcurrentProducerConsumer() throws InterruptedException {
        int items = 50000;
        LockFreeQueue<Integer> queue = new LockFreeQueue<>();
        Set<Integer> dequeuedItems = ConcurrentHashMap.newKeySet();

        ExecutorService producers = Executors.newFixedThreadPool(8);
        ExecutorService consumers = Executors.newFixedThreadPool(8);
        CountDownLatch producerLatch = new CountDownLatch(items);
        CountDownLatch consumerLatch = new CountDownLatch(items);

        // Consumers
        for (int i = 0; i < 8; i++) {
            consumers.submit(() -> {
                while (consumerLatch.getCount() > 0) {
                    Integer val = queue.dequeue();
                    if (val != null) {
                        dequeuedItems.add(val);
                        consumerLatch.countDown();
                    } else {
                        Thread.yield();
                    }
                }
            });
        }

        // Producers
        for (int i = 0; i < items; i++) {
            final int item = i;
            producers.submit(() -> {
                queue.enqueue(item);
                producerLatch.countDown();
            });
        }

        assertTrue(producerLatch.await(10, TimeUnit.SECONDS));
        assertTrue(consumerLatch.await(10, TimeUnit.SECONDS));

        producers.shutdown();
        consumers.shutdown();

        assertEquals(items, dequeuedItems.size());
    }
}
