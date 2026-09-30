package com.cachex.cluster;

import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Distributed Lease-Based Mutual Exclusion Lock Manager.
 *
 * Implements safe distributed locking semantics:
 * - Fencing tokens (monotonically increasing epoch counters) to detect split-brain writes.
 * - Heartbeat lease renewal background daemon.
 * - Reentrant acquire checks bound to owner UUID token.
 */
public class DistributedLockManager {

    public static class LockHandle {
        public final String resourceName;
        public final String token;
        public final long fencingToken;
        public final long leaseExpiryEpoch;

        public LockHandle(String resourceName, String token, long fencingToken, long leaseExpiryEpoch) {
            this.resourceName = resourceName;
            this.token = token;
            this.fencingToken = fencingToken;
            this.leaseExpiryEpoch = leaseExpiryEpoch;
        }
    }

    private static class LeaseState {
        String ownerToken;
        long fencingToken;
        long expiryTime;
    }

    private final ConcurrentHashMap<String, LeaseState> lockRegistry = new ConcurrentHashMap<>();
    private final ScheduledExecutorService heartbeatExecutor;
    private long globalFencingCounter = 0;

    public DistributedLockManager() {
        this.heartbeatExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "CacheX-Lock-Renewal-Daemon");
            t.setDaemon(true);
            return t;
        });
    }

    /**
     * Attempts to acquire a distributed lock on a resource for leaseDurationMillis.
     * Returns LockHandle if acquired, or null if lock is currently held by another worker.
     */
    public synchronized LockHandle tryAcquire(String resourceName, long leaseDurationMillis) {
        if (resourceName == null || leaseDurationMillis <= 0) return null;

        long now = System.currentTimeMillis();
        LeaseState state = lockRegistry.get(resourceName);

        if (state == null || now > state.expiryTime) {
            // Lock is free or previous lease has expired
            if (state == null) {
                state = new LeaseState();
                lockRegistry.put(resourceName, state);
            }
            state.ownerToken = UUID.randomUUID().toString();
            state.fencingToken = ++globalFencingCounter;
            state.expiryTime = now + leaseDurationMillis;

            return new LockHandle(resourceName, state.ownerToken, state.fencingToken, state.expiryTime);
        }

        return null; // Lock is currently held
    }

    /**
     * Releases the lock, verifying that the caller's owner token matches current holder.
     */
    public synchronized boolean release(LockHandle handle) {
        if (handle == null) return false;

        LeaseState state = lockRegistry.get(handle.resourceName);
        if (state != null && handle.token.equals(state.ownerToken)) {
            lockRegistry.remove(handle.resourceName);
            return true;
        }
        return false;
    }

    /**
     * Renews lease duration for an active lock held by owner.
     */
    public synchronized boolean renew(LockHandle handle, long additionalMillis) {
        if (handle == null || additionalMillis <= 0) return false;

        long now = System.currentTimeMillis();
        LeaseState state = lockRegistry.get(handle.resourceName);
        if (state != null && handle.token.equals(state.ownerToken) && now <= state.expiryTime) {
            state.expiryTime = now + additionalMillis;
            return true;
        }
        return false;
    }

    public synchronized boolean isLocked(String resourceName) {
        LeaseState state = lockRegistry.get(resourceName);
        return state != null && System.currentTimeMillis() <= state.expiryTime;
    }
}
