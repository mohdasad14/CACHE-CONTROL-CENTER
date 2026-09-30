package com.cachex;

import com.cachex.distributed.MerkleTreeSync;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Merkle Tree Anti-Entropy Tests")
public class MerkleTreeSyncTest {

    @Test
    @DisplayName("Identical data generates matching root hashes; divergent key is isolated")
    void testAntiEntropyDetection() {
        MerkleTreeSync treeA = new MerkleTreeSync(16);
        MerkleTreeSync treeB = new MerkleTreeSync(16);

        for (int i = 0; i < 50; i++) {
            treeA.addEntry("key_" + i, "val_" + i);
            treeB.addEntry("key_" + i, "val_" + i);
        }

        MerkleTreeSync.MerkleNode rootA = treeA.buildTree();
        MerkleTreeSync.MerkleNode rootB = treeB.buildTree();

        assertArrayEquals(rootA.hash, rootB.hash, "Identical datasets must have identical Merkle root");

        // Now create a divergence in treeB
        MerkleTreeSync treeC = new MerkleTreeSync(16);
        for (int i = 0; i < 50; i++) {
            if (i == 25) {
                treeC.addEntry("key_25", "divergent_value");
            } else {
                treeC.addEntry("key_" + i, "val_" + i);
            }
        }
        MerkleTreeSync.MerkleNode rootC = treeC.buildTree();

        assertFalse(java.util.Arrays.equals(rootA.hash, rootC.hash));
        List<Integer> diffs = MerkleTreeSync.findDifferences(rootA, rootC);
        assertFalse(diffs.isEmpty());
    }
}
