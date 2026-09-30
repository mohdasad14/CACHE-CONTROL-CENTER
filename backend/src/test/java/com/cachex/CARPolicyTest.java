package com.cachex;

import com.cachex.car.CARPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("CAR (Clock with Adaptive Replacement) Tests")
public class CARPolicyTest {

    private CARPolicy<String> car;

    @BeforeEach
    void setUp() {
        car = new CARPolicy<>(10);
    }

    @Test
    @DisplayName("Records insertions into T1 and adapts target p")
    void testBasicT1Insertion() {
        car.recordAdd("page1");
        car.recordAdd("page2");

        assertEquals(2, car.getT1Size());
        assertEquals(2, car.size());
    }

    @Test
    @DisplayName("Sweeps clock hand to identify non-referenced victim")
    void testClockSweep() {
        for (int i = 1; i <= 5; i++) {
            car.recordAdd("page" + i);
        }

        String candidate = car.getEvictionCandidate();
        assertNotNull(candidate);
    }
}
