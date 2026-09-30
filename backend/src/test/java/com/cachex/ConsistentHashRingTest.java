package com.cachex;

import com.cachex.cluster.ConsistentHashRing;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Consistent Hash Ring Clustering Tests")
public class ConsistentHashRingTest {

    @Test
    @DisplayName("Should distribute keys predictably to nodes")
    void testNodeResolution() {
        List<String> nodes = Arrays.asList("10.0.0.1:8080", "10.0.0.2:8080", "10.0.0.3:8080");
        ConsistentHashRing<String> ring = new ConsistentHashRing<>(100, nodes);

        assertEquals(3, ring.getPhysicalNodeCount());
        assertEquals(300, ring.getVirtualNodeCount());

        String target1 = ring.getNode("user:1001");
        String target2 = ring.getNode("user:1001");

        assertNotNull(target1);
        assertEquals(target1, target2, "Consistent hashing must return identical node for same key");
    }

    @Test
    @DisplayName("Should retrieve replication node quorum without duplicates")
    void testReplicationNodes() {
        List<String> nodes = Arrays.asList("nodeA", "nodeB", "nodeC", "nodeD");
        ConsistentHashRing<String> ring = new ConsistentHashRing<>(50, nodes);

        List<String> replicas = ring.getReplicationNodes("session:xyz", 3);
        assertEquals(3, replicas.size());
        assertEquals(3, new HashSet<>(replicas).size(), "Replica nodes must all be distinct physical hosts");
    }

    @Test
    @DisplayName("Adding node retains majority of key mappings")
    void testMinimalDisruption() {
        List<String> nodes = new ArrayList<>(Arrays.asList("nodeA", "nodeB", "nodeC"));
        ConsistentHashRing<String> ring = new ConsistentHashRing<>(100, nodes);

        Map<String, String> initialMapping = new HashMap<>();
        for (int i = 0; i < 1000; i++) {
            String key = "key_" + i;
            initialMapping.put(key, ring.getNode(key));
        }

        // Add 4th node
        ring.addNode("nodeD");

        int changed = 0;
        for (int i = 0; i < 1000; i++) {
            String key = "key_" + i;
            if (!initialMapping.get(key).equals(ring.getNode(key))) {
                changed++;
            }
        }

        // With 4 nodes, roughly 1/4 (25%) of keys should move, far less than 100%
        assertTrue(changed < 450, "Consistent hashing disruption exceeded expectation: changed=" + changed);
    }
}
