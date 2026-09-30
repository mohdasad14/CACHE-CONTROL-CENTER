package com.cachex;

import com.cachex.resilience.CircuitBreaker;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Circuit Breaker Resilience Tests")
public class CircuitBreakerTest {

    @Test
    @DisplayName("Transitions from CLOSED to OPEN on repeated failures")
    void testFailureThreshold() {
        CircuitBreaker cb = new CircuitBreaker("DbSource", 3, 500);
        assertEquals(CircuitBreaker.State.CLOSED, cb.getState());

        for (int i = 0; i < 3; i++) {
            try {
                cb.execute(() -> {
                    throw new RuntimeException("Database timeout");
                }, null);
            } catch (Exception ignored) {}
        }

        assertEquals(CircuitBreaker.State.OPEN, cb.getState());

        // Fast-fail fallback execution
        String val = cb.execute(() -> "fresh", () -> "cached_stale_fallback");
        assertEquals("cached_stale_fallback", val);
    }
}
