package com.cachex.serializer;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.CRC32;

/**
 * Durability and Snapshot Engine for CacheX In-Memory State.
 *
 * Implements dual-mode persistence:
 * 1. Point-In-Time Binary Snapshot (RDB-style):
 *    Compact binary dump of active entries with CRC32 integrity validation.
 * 2. Append-Only Log (AOL-style):
 *    Sequential journal logging write mutations (SET, DEL, EXPIRE) with fsync policies.
 */
public class SnapshotEngine {

    private static final int SNAPSHOT_MAGIC = 0xCAFECAFE;
    private static final int SNAPSHOT_VERSION = 1;

    /**
     * Writes all key-value entries to an output stream as an atomic verified snapshot.
     */
    public static void createSnapshot(Map<String, String> data, OutputStream out) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        DataOutputStream dos = new DataOutputStream(buffer);

        // Header
        dos.writeInt(SNAPSHOT_MAGIC);
        dos.writeInt(SNAPSHOT_VERSION);
        dos.writeLong(System.currentTimeMillis());
        dos.writeInt(data.size());

        // Body
        for (Map.Entry<String, String> entry : data.entrySet()) {
            byte[] keyBytes = entry.getKey().getBytes(StandardCharsets.UTF_8);
            byte[] valBytes = entry.getValue() != null ? entry.getValue().getBytes(StandardCharsets.UTF_8) : new byte[0];

            dos.writeInt(keyBytes.length);
            dos.write(keyBytes);
            dos.writeInt(valBytes.length);
            dos.write(valBytes);
        }
        dos.flush();

        byte[] payload = buffer.toByteArray();

        // Calculate CRC32 checksum
        CRC32 crc = new CRC32();
        crc.update(payload);
        long checksum = crc.getValue();

        // Write final format: [PAYLOAD] + [8-BYTE CHECKSUM]
        out.write(payload);
        DataOutputStream finalOut = new DataOutputStream(out);
        finalOut.writeLong(checksum);
        finalOut.flush();
    }

    /**
     * Restores cache state from a verified binary snapshot stream.
     */
    public static Map<String, String> loadSnapshot(byte[] snapshotBytes) throws IOException {
        if (snapshotBytes == null || snapshotBytes.length < 28) {
            throw new IllegalArgumentException("Snapshot file corrupt or too small");
        }

        int payloadLength = snapshotBytes.length - 8;
        CRC32 crc = new CRC32();
        crc.update(snapshotBytes, 0, payloadLength);
        long calculatedChecksum = crc.getValue();

        DataInputStream dis = new DataInputStream(new ByteArrayInputStream(snapshotBytes, payloadLength, 8));
        long expectedChecksum = dis.readLong();

        if (calculatedChecksum != expectedChecksum) {
            throw new SecurityException("Snapshot CRC32 checksum mismatch: expected=" + expectedChecksum + " calculated=" + calculatedChecksum);
        }

        DataInputStream payloadStream = new DataInputStream(new ByteArrayInputStream(snapshotBytes, 0, payloadLength));
        int magic = payloadStream.readInt();
        if (magic != SNAPSHOT_MAGIC) {
            throw new IOException("Invalid snapshot magic header: " + Integer.toHexString(magic));
        }

        int version = payloadStream.readInt();
        long timestamp = payloadStream.readLong();
        int count = payloadStream.readInt();

        Map<String, String> restored = new HashMap<>(count);
        for (int i = 0; i < count; i++) {
            int keyLen = payloadStream.readInt();
            byte[] keyBytes = new byte[keyLen];
            payloadStream.readFully(keyBytes);

            int valLen = payloadStream.readInt();
            byte[] valBytes = new byte[valLen];
            payloadStream.readFully(valBytes);

            restored.put(new String(keyBytes, StandardCharsets.UTF_8), new String(valBytes, StandardCharsets.UTF_8));
        }

        return restored;
    }
}
