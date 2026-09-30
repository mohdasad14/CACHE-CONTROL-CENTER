package com.cachex;

import com.cachex.core.WTinyLFUPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Window TinyLFU (W-TinyLFU) Policy Tests")
public class WTinyLFUPolicyTest {

    private WTinyLFUPolicy<String> policy;

    @BeforeEach
    void setUp() {
        policy = new WTinyLFUPolicy<>(10);
    }

    @Test
    @DisplayName("Should admit elements into window and track sizes correctly")
    void testBasicAdmissions() {
        policy.recordAdd("key1");
        policy.recordAdd("key2");

        assertTrue(policy.contains("key1"));
        assertTrue(policy.contains("key2"));
        assertEquals(2, policy.size());
    }

    @Test
    @DisplayName("Frequency sketch should retain hot keys against cold scans")
    void testScanResistance() {
        // Build up high frequency for hot keys
        for (int i = 0; i < 15; i++) {
            policy.recordAccess("hotKey1");
            policy.recordAccess("hotKey2");
        }

        assertTrue(policy.getFrequency("hotKey1") > 0);
        assertTrue(policy.getFrequency("hotKey2") > 0);

        // Fill cache with keys
        for (int i = 1; i <= 8; i++) {
            policy.recordAdd("normal" + i);
        }

        // Simulate single-use burst scan
        for (int i = 100; i < 120; i++) {
            policy.recordAdd("scan" + i);
            String candidate = policy.getEvictionCandidate();
            if (candidate != null) {
                policy.recordRemove(candidate);
            }
        }

        assertTrue(policy.getFrequency("hotKey1") > policy.getFrequency("scan110"));
    }

    @Test
    @DisplayName("Should successfully clear all structures")
    void testClear() {
        policy.recordAdd("a");
        policy.recordAdd("b");
        policy.clear();

        assertEquals(0, policy.size());
        assertFalse(policy.contains("a"));
    }
}
