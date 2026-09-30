package com.cachex;

import com.cachex.core.TwoQueuePolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("2Q (Two-Queue) Eviction Policy Tests")
class TwoQueuePolicyTest {

    private TwoQueuePolicy<String> policy;

    @BeforeEach
    void setUp() {
        policy = new TwoQueuePolicy<>();
    }

    @Test
    @DisplayName("Should evict from probationary queue A1 first on sequential scan")
    void testScanResistance() {
        // Step 1: Add initial items
        policy.recordAdd("A");
        policy.recordAdd("B");

        // Step 2: Access "A" so it promotes to main LRU queue Am
        policy.recordAccess("A");

        // Step 3: Candidate to evict should be "B" (still in A1), while "A" is protected in Am
        assertEquals("B", policy.getEvictionCandidate());
    }

    @Test
    @DisplayName("Should promote repeatedly accessed keys into Am queue")
    void testPromotionToAm() {
        policy.recordAdd("item1");
        policy.recordAccess("item1"); // Promoted to Am

        policy.recordAdd("item2"); // Only in A1

        // When requesting eviction, item2 must be chosen before item1
        assertEquals("item2", policy.getEvictionCandidate());
        policy.recordRemove("item2");

        // Once A1 is empty, item1 can be evicted
        assertEquals("item1", policy.getEvictionCandidate());
    }

    @Test
    @DisplayName("Should handle clear() cleanly")
    void testClear() {
        policy.recordAdd("k1");
        policy.recordAccess("k1");
        policy.recordAdd("k2");

        policy.clear();
        assertNull(policy.getEvictionCandidate());
    }
}
