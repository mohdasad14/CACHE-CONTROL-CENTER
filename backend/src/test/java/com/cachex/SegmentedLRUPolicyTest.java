package com.cachex;

import com.cachex.core.SegmentedLRUPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Segmented LRU (SLRU) Policy Tests")
public class SegmentedLRUPolicyTest {

    private SegmentedLRUPolicy<String> slru;

    @BeforeEach
    void setUp() {
        slru = new SegmentedLRUPolicy<>(5);
    }

    @Test
    @DisplayName("New elements enter probationary segment first")
    void testInitialProbationary() {
        slru.recordAdd("key1");
        assertEquals(1, slru.getProbationarySize());
        assertEquals(0, slru.getProtectedSize());
    }

    @Test
    @DisplayName("Accessed element is promoted to protected segment")
    void testPromotionOnAccess() {
        slru.recordAdd("key1");
        slru.recordAccess("key1");

        assertEquals(0, slru.getProbationarySize());
        assertEquals(1, slru.getProtectedSize());
    }

    @Test
    @DisplayName("Eviction prioritizes probationary segment tail")
    void testProbationaryEviction() {
        slru.recordAdd("probationary1");
        slru.recordAdd("probationary2");

        String victim = slru.getEvictionCandidate();
        assertEquals("probationary1", victim);
    }
}
