package com.cachex;

import com.cachex.lirs.LIRSPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("LIRS (Low Inter-Reference Recency Set) Policy Tests")
public class LIRSPolicyTest {

    private LIRSPolicy<String> lirs;

    @BeforeEach
    void setUp() {
        // Total capacity 10: LIR ~8, HIR ~2
        lirs = new LIRSPolicy<>(10);
    }

    @Test
    @DisplayName("Initial warm-up entries enter as LIR blocks")
    void testWarmUpLir() {
        for (int i = 1; i <= 5; i++) {
            lirs.recordAdd("key" + i);
        }
        assertEquals(5, lirs.getLirCount());
        assertEquals(0, lirs.getHirCount());
    }

    @Test
    @DisplayName("Candidate for eviction is chosen from HIR blocks (Queue Q)")
    void testEvictionCandidateSelection() {
        for (int i = 1; i <= 10; i++) {
            lirs.recordAdd("k" + i);
        }
        String candidate = lirs.getEvictionCandidate();
        assertNotNull(candidate);
    }

    @Test
    @DisplayName("Re-accessing resident HIR block promotes it to LIR")
    void testHirPromotion() {
        // Fill LIR quota
        for (int i = 1; i <= 8; i++) {
            lirs.recordAdd("lir" + i);
        }
        // Add HIR block
        lirs.recordAdd("hir1");
        assertEquals(1, lirs.getHirCount());

        // Re-access hir1 while in Stack S -> promotes to LIR!
        lirs.recordAccess("hir1");
        assertEquals(8, lirs.getLirCount());
    }
}
