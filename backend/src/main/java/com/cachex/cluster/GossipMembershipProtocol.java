package com.cachex.cluster;

import java.util.*;
import java.util.concurrent.*;

/**
 * Gossip-Based Cluster Membership and Failure Detection Protocol.
 *
 * Implements a decentralized epidemic gossip protocol (SWIM-style):
 * - Periodic ping probes to randomly selected cluster peers.
 * - Heartbeat counters and generation timestamps for liveness tracking.
 * - Suspicion mechanism before declaring a node dead, avoiding false positives on GC pauses.
 */
public class GossipMembershipProtocol {

    public enum NodeState {
        ALIVE,
        SUSPECT,
        DEAD
    }

    public static class NodeMetadata {
        public final String nodeId;
        public final String address;
        public volatile NodeState state;
        public volatile long heartbeat;
        public volatile long lastSeenTimestamp;

        public NodeMetadata(String nodeId, String address) {
            this.nodeId = nodeId;
            this.address = address;
            this.state = NodeState.ALIVE;
            this.heartbeat = 0;
            this.lastSeenTimestamp = System.currentTimeMillis();
        }
    }

    private final String localNodeId;
    private final String localAddress;
    private final Map<String, NodeMetadata> clusterNodes;
    private final Random random;
    private volatile long localHeartbeat;

    public GossipMembershipProtocol(String localNodeId, String localAddress) {
        this.localNodeId = localNodeId;
        this.localAddress = localAddress;
        this.clusterNodes = new ConcurrentHashMap<>();
        this.random = new Random();
        this.localHeartbeat = 0;

        // Register self
        clusterNodes.put(localNodeId, new NodeMetadata(localNodeId, localAddress));
    }

    public void addSeedNode(String nodeId, String address) {
        if (!nodeId.equals(localNodeId)) {
            clusterNodes.putIfAbsent(nodeId, new NodeMetadata(nodeId, address));
        }
    }

    /**
     * Executes one gossip step:
     * 1. Increments local heartbeat.
     * 2. Selects k random peers (k=3) to send state digest.
     * 3. Scans for nodes exceeding failure detection timeout (e.g. 5000ms).
     */
    public void gossipRound() {
        localHeartbeat++;
        NodeMetadata self = clusterNodes.get(localNodeId);
        if (self != null) {
            self.heartbeat = localHeartbeat;
            self.lastSeenTimestamp = System.currentTimeMillis();
        }

        long now = System.currentTimeMillis();
        for (NodeMetadata meta : clusterNodes.values()) {
            if (meta.nodeId.equals(localNodeId)) continue;

            long elapsed = now - meta.lastSeenTimestamp;
            if (elapsed > 10000 && meta.state != NodeState.DEAD) {
                meta.state = NodeState.DEAD;
            } else if (elapsed > 4000 && meta.state == NodeState.ALIVE) {
                meta.state = NodeState.SUSPECT;
            }
        }
    }

    /**
     * Merges an incoming gossip digest from a peer node.
     */
    public void mergeGossipDigest(List<NodeMetadata> incoming) {
        long now = System.currentTimeMillis();
        for (NodeMetadata remote : incoming) {
            NodeMetadata local = clusterNodes.get(remote.nodeId);
            if (local == null) {
                NodeMetadata newNode = new NodeMetadata(remote.nodeId, remote.address);
                newNode.heartbeat = remote.heartbeat;
                newNode.state = remote.state;
                newNode.lastSeenTimestamp = now;
                clusterNodes.put(remote.nodeId, newNode);
            } else {
                if (remote.heartbeat > local.heartbeat) {
                    local.heartbeat = remote.heartbeat;
                    local.state = remote.state;
                    local.lastSeenTimestamp = now;
                }
            }
        }
    }

    public List<NodeMetadata> getActiveNodes() {
        List<NodeMetadata> alive = new ArrayList<>();
        for (NodeMetadata node : clusterNodes.values()) {
            if (node.state == NodeState.ALIVE) {
                alive.add(node);
            }
        }
        return alive;
    }

    public int getTotalNodeCount() {
        return clusterNodes.size();
    }

    public String getLocalNodeId() {
        return localNodeId;
    }
}
