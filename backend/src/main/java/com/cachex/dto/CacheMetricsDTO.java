package com.cachex.dto;

import com.cachex.model.EvictionPolicyType;

public class CacheMetricsDTO {
    private double hitRate;
    private double missRate;
    private int currentSize;
    private int capacity;
    private long totalRequests;
    private long hits;
    private long misses;
    private long puts;
    private long deletes;
    private long evictions;
    private long expirations;
    private double averageLatencyMicros;
    private double p95LatencyMicros;
    private EvictionPolicyType policy;

    public CacheMetricsDTO() {}

    public double getHitRate() { return hitRate; }
    public void setHitRate(double hitRate) { this.hitRate = hitRate; }

    public double getMissRate() { return missRate; }
    public void setMissRate(double missRate) { this.missRate = missRate; }

    public int getCurrentSize() { return currentSize; }
    public void setCurrentSize(int currentSize) { this.currentSize = currentSize; }

    public int getCapacity() { return capacity; }
    public void setCapacity(int capacity) { this.capacity = capacity; }

    public long getTotalRequests() { return totalRequests; }
    public void setTotalRequests(long totalRequests) { this.totalRequests = totalRequests; }

    public long getHits() { return hits; }
    public void setHits(long hits) { this.hits = hits; }

    public long getMisses() { return misses; }
    public void setMisses(long misses) { this.misses = misses; }

    public long getPuts() { return puts; }
    public void setPuts(long puts) { this.puts = puts; }

    public long getDeletes() { return deletes; }
    public void setDeletes(long deletes) { this.deletes = deletes; }

    public long getEvictions() { return evictions; }
    public void setEvictions(long evictions) { this.evictions = evictions; }

    public long getExpirations() { return expirations; }
    public void setExpirations(long expirations) { this.expirations = expirations; }

    public double getAverageLatencyMicros() { return averageLatencyMicros; }
    public void setAverageLatencyMicros(double averageLatencyMicros) { this.averageLatencyMicros = averageLatencyMicros; }

    public double getP95LatencyMicros() { return p95LatencyMicros; }
    public void setP95LatencyMicros(double p95LatencyMicros) { this.p95LatencyMicros = p95LatencyMicros; }

    public EvictionPolicyType getPolicy() { return policy; }
    public void setPolicy(EvictionPolicyType policy) { this.policy = policy; }
}
