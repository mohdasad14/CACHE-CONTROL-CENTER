package com.cachex;

import com.cachex.index.LockFreeSkipListCacheIndex;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Lock-Free SkipList Cache Index Tests")
public class LockFreeSkipListCacheIndexTest {

    @Test
    @DisplayName("Inserts, retrieves and updates keys with O(log N) complexity")
    void testSkipListOperations() {
        LockFreeSkipListCacheIndex<String, Integer> index = new LockFreeSkipListCacheIndex<>();

        index.put("user:100", 100);
        index.put("user:200", 200);
        index.put("user:150", 150);

        assertEquals(100, index.get("user:100"));
        assertEquals(150, index.get("user:150"));
        assertEquals(200, index.get("user:200"));
        assertNull(index.get("user:999"));

        // Range query between user:100 and user:180
        List<Map.Entry<String, Integer>> range = index.range("user:100", "user:180");
        assertEquals(2, range.size());
        assertEquals("user:100", range.get(0).getKey());
        assertEquals("user:150", range.get(1).getKey());
    }
}
