package com.cachex.resilience;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

/**
 * Enterprise Circuit Breaker Pattern for Remote Cache Data Source Calls.
 *
 * Implements a finite state machine:
 * - CLOSED: Normal operation, routing calls to downstream database/API.
 * - OPEN: Downstream failure rate exceeded threshold, fails fast without remote latency.
 * - HALF_OPEN: Probe phase admitting limited trials to test downstream recovery.
 */
public class CircuitBreaker {

    public enum State {
        CLOSED,
        OPEN,
        HALF_OPEN
    }

    private final String name;
    private final int failureThreshold;
    private final long resetTimeoutMillis;
    private final AtomicReference<State> state = new AtomicReference<>(State.CLOSED);
    private final AtomicInteger failureCount = new AtomicInteger(0);
    private final AtomicInteger successCount = new AtomicInteger(0);
    private final AtomicLong lastStateChangeTimestamp = new AtomicLong(System.currentTimeMillis());

    public CircuitBreaker(String name, int failureThreshold, long resetTimeoutMillis) {
        this.name = name;
        this.failureThreshold = Math.max(1, failureThreshold);
        this.resetTimeoutMillis = Math.max(100, resetTimeoutMillis);
    }

    /**
     * Executes the supplier protected by the circuit breaker.
     * Throws IllegalStateException if circuit is currently OPEN.
     */
    public <T> T execute(Supplier<T> action, Supplier<T> fallback) {
        State current = checkAndTransition();

        if (current == State.OPEN) {
            if (fallback != null) {
                return fallback.get();
            }
            throw new IllegalStateException("Circuit breaker '" + name + "' is OPEN - remote downstream unavailable");
        }

        try {
            T result = action.get();
            onSuccess();
            return result;
        } catch (Throwable t) {
            onFailure();
            if (fallback != null) {
                return fallback.get();
            }
            throw t;
        }
    }

    private State checkAndTransition() {
        State current = state.get();
        if (current == State.OPEN) {
            long elapsed = System.currentTimeMillis() - lastStateChangeTimestamp.get();
            if (elapsed >= resetTimeoutMillis) {
                if (state.compareAndSet(State.OPEN, State.HALF_OPEN)) {
                    lastStateChangeTimestamp.set(System.currentTimeMillis());
                    failureCount.set(0);
                    successCount.set(0);
                    return State.HALF_OPEN;
                }
            }
        }
        return state.get();
    }

    private void onSuccess() {
        if (state.get() == State.HALF_OPEN) {
            if (successCount.incrementAndGet() >= 3) {
                state.set(State.CLOSED);
                failureCount.set(0);
                lastStateChangeTimestamp.set(System.currentTimeMillis());
            }
        } else {
            failureCount.set(0);
        }
    }

    private void onFailure() {
        if (state.get() == State.HALF_OPEN) {
            state.set(State.OPEN);
            lastStateChangeTimestamp.set(System.currentTimeMillis());
        } else {
            if (failureCount.incrementAndGet() >= failureThreshold) {
                state.set(State.OPEN);
                lastStateChangeTimestamp.set(System.currentTimeMillis());
            }
        }
    }

    public State getState() {
        checkAndTransition();
        return state.get();
    }

    public String getName() {
        return name;
    }
}
