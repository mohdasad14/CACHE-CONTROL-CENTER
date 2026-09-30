package com.cachex.dto;

import java.util.List;

public class SimulationResultDTO {
    private String patternName;
    private int totalOperations;
    private long hits;
    private long misses;
    private long evictions;
    private double hitRate;
    private List<String> operationLog;

    public SimulationResultDTO() {}

    public String getPatternName() { return patternName; }
    public void setPatternName(String patternName) { this.patternName = patternName; }

    public int getTotalOperations() { return totalOperations; }
    public void setTotalOperations(int totalOperations) { this.totalOperations = totalOperations; }

    public long getHits() { return hits; }
    public void setHits(long hits) { this.hits = hits; }

    public long getMisses() { return misses; }
    public void setMisses(long misses) { this.misses = misses; }

    public long getEvictions() { return evictions; }
    public void setEvictions(long evictions) { this.evictions = evictions; }

    public double getHitRate() { return hitRate; }
    public void setHitRate(double hitRate) { this.hitRate = hitRate; }

    public List<String> getOperationLog() { return operationLog; }
    public void setOperationLog(List<String> operationLog) { this.operationLog = operationLog; }
}
