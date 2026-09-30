package com.cachex;

import com.cachex.serializer.SnapshotEngine;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Snapshot Engine & Durability Tests")
public class SnapshotEngineTest {

    @Test
    @DisplayName("Should successfully serialize, verify checksum, and restore state")
    void testSnapshotLifecycle() throws IOException {
        Map<String, String> original = new HashMap<>();
        for (int i = 0; i < 50; i++) {
            original.put("user:profile:" + i, "{\"name\":\"User" + i + "\",\"role\":\"ENGINEER\"}");
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        SnapshotEngine.createSnapshot(original, baos);
        byte[] bytes = baos.toByteArray();

        assertTrue(bytes.length > 0);

        Map<String, String> restored = SnapshotEngine.loadSnapshot(bytes);
        assertEquals(50, restored.size());
        assertEquals(original, restored);
    }

    @Test
    @DisplayName("Corrupting snapshot bytes triggers CRC32 validation failure")
    void testCorruptionDetection() throws IOException {
        Map<String, String> data = Collections.singletonMap("key", "val");
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        SnapshotEngine.createSnapshot(data, baos);
        byte[] bytes = baos.toByteArray();

        // Corrupt byte in payload
        bytes[10] ^= 0xFF;

        assertThrows(SecurityException.class, () -> {
            SnapshotEngine.loadSnapshot(bytes);
        });
    }
}
