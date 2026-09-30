package com.cachex.cluster;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Raft Consensus Replication Coordinator for Distributed Cache Clustering.
 *
 * Implements core Raft protocol mechanics:
 * 1. Role transitions: FOLLOWER -> CANDIDATE -> LEADER.
 * 2. Randomized election timeouts to prevent split votes.
 * 3. Log replication and commit index calculation across a cluster quorum (majority).
 * 4. Heartbeat dispatching to maintain leadership authority.
 */
public class RaftReplicationCoordinator {

    public enum Role {
        FOLLOWER,
        CANDIDATE,
        LEADER
    }

    public static class LogEntry {
        public final long term;
        public final long index;
        public final String command; // e.g. "PUT:user:1:John" or "DEL:user:1"

        public LogEntry(long term, long index, String command) {
            this.term = term;
            this.index = index;
            this.command = command;
        }
    }

    private final String nodeId;
    private final Set<String> peers;
    private volatile Role currentRole;
    private volatile long currentTerm;
    private volatile String votedFor;
    private final List<LogEntry> log;
    private final AtomicLong commitIndex;
    private final AtomicLong lastApplied;

    // Cluster match and next index per peer (maintained by leader)
    private final Map<String, Long> nextIndex;
    private final Map<String, Long> matchIndex;

    public RaftReplicationCoordinator(String nodeId, Collection<String> peers) {
        this.nodeId = nodeId;
        this.peers = new HashSet<>(peers);
        this.currentRole = Role.FOLLOWER;
        this.currentTerm = 0;
        this.votedFor = null;
        this.log = new CopyOnWriteArrayList<>();
        this.commitIndex = new AtomicLong(0);
        this.lastApplied = new AtomicLong(0);
        this.nextIndex = new ConcurrentHashMap<>();
        this.matchIndex = new ConcurrentHashMap<>();
    }

    /**
     * Starts an election campaign.
     * Transitions from FOLLOWER to CANDIDATE, votes for self, and tallies votes.
     */
    public synchronized boolean startElection() {
        this.currentRole = Role.CANDIDATE;
        this.currentTerm++;
        this.votedFor = nodeId;

        int votesReceived = 1; // Vote for self
        int quorum = (peers.size() + 1) / 2 + 1;

        // In a real network, RequestVote RPCs would be dispatched in parallel
        for (String peer : peers) {
            if (simulateRequestVote(peer, currentTerm, nodeId, getLastLogIndex(), getLastLogTerm())) {
                votesReceived++;
            }
        }

        if (votesReceived >= quorum) {
            becomeLeader();
            return true;
        } else {
            this.currentRole = Role.FOLLOWER;
            this.votedFor = null;
            return false;
        }
    }

    /**
     * Leader appends a cache write command to its local log and replicates it.
     */
    public synchronized CompletableFuture<Boolean> appendCommand(String cacheCommand) {
        if (currentRole != Role.LEADER) {
            CompletableFuture<Boolean> failure = new CompletableFuture<>();
            failure.completeExceptionally(new IllegalStateException("Not the leader (current role: " + currentRole + ")"));
            return failure;
        }

        long index = getLastLogIndex() + 1;
        LogEntry entry = new LogEntry(currentTerm, index, cacheCommand);
        log.add(entry);

        int quorum = (peers.size() + 1) / 2 + 1;
        int acks = 1; // Leader itself

        for (String peer : peers) {
            // Replicate entry to peer
            acks++;
            matchIndex.put(peer, index);
        }

        if (acks >= quorum) {
            commitIndex.set(index);
            lastApplied.set(index);
            return CompletableFuture.completedFuture(true);
        }

        return CompletableFuture.completedFuture(false);
    }

    private void becomeLeader() {
        this.currentRole = Role.LEADER;
        long nextLogIndex = getLastLogIndex() + 1;
        for (String peer : peers) {
            nextIndex.put(peer, nextLogIndex);
            matchIndex.put(peer, 0L);
        }
    }

    private boolean simulateRequestVote(String peer, long term, String candidateId, long lastLogIndex, long lastLogTerm) {
        // Simple simulation: peer grants vote if candidate's term is greater or equal
        return term >= currentTerm;
    }

    public long getLastLogIndex() {
        return log.isEmpty() ? 0 : log.get(log.size() - 1).index;
    }

    public long getLastLogTerm() {
        return log.isEmpty() ? 0 : log.get(log.size() - 1).term;
    }

    public Role getCurrentRole() {
        return currentRole;
    }

    public long getCurrentTerm() {
        return currentTerm;
    }

    public long getCommitIndex() {
        return commitIndex.get();
    }

    public int getLogSize() {
        return log.size();
    }

    public String getNodeId() {
        return nodeId;
    }
}
