package com.cachex.concurrency;

import java.util.concurrent.atomic.AtomicReference;

/**
 * Lock-Free Concurrent Queue implementing the Michael & Scott Non-Blocking Algorithm.
 *
 * Utilized by CacheX for wait-free eviction buffering and asynchronous event dispatching.
 * Guarantees system-wide progress (lock-free) without thread suspension, OS context switches,
 * or priority inversion risks.
 *
 * @param <E> Element type
 */
public class LockFreeQueue<E> {

    private static class Node<E> {
        final E item;
        final AtomicReference<Node<E>> next;

        Node(E item) {
            this.item = item;
            this.next = new AtomicReference<>(null);
        }
    }

    private final Node<E> dummy;
    private final AtomicReference<Node<E>> head;
    private final AtomicReference<Node<E>> tail;

    public LockFreeQueue() {
        this.dummy = new Node<>(null);
        this.head = new AtomicReference<>(dummy);
        this.tail = new AtomicReference<>(dummy);
    }

    /**
     * Enqueues an item lock-free using CAS loop.
     */
    public void enqueue(E item) {
        if (item == null) throw new NullPointerException("Null elements prohibited");
        Node<E> newNode = new Node<>(item);

        while (true) {
            Node<E> curTail = tail.get();
            Node<E> tailNext = curTail.next.get();

            if (curTail == tail.get()) {
                if (tailNext != null) {
                    // Tail is falling behind, assist by advancing tail
                    tail.compareAndSet(curTail, tailNext);
                } else {
                    // Attempt to link newNode to curTail's next
                    if (curTail.next.compareAndSet(null, newNode)) {
                        // Success! Advance tail pointer
                        tail.compareAndSet(curTail, newNode);
                        return;
                    }
                }
            }
        }
    }

    /**
     * Dequeues an item lock-free using CAS loop.
     * Returns null if queue is currently empty.
     */
    public E dequeue() {
        while (true) {
            Node<E> curHead = head.get();
            Node<E> curTail = tail.get();
            Node<E> headNext = curHead.next.get();

            if (curHead == head.get()) {
                if (curHead == curTail) {
                    if (headNext == null) {
                        return null; // Queue is empty
                    }
                    // Tail falling behind, assist
                    tail.compareAndSet(curTail, headNext);
                } else {
                    if (headNext == null) {
                        return null;
                    }
                    E value = headNext.item;
                    if (head.compareAndSet(curHead, headNext)) {
                        return value;
                    }
                }
            }
        }
    }

    public boolean isEmpty() {
        return head.get().next.get() == null;
    }
}
