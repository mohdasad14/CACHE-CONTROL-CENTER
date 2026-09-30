package com.cachex.dto;

public class StressTestResultDTO {
    private int concurrency;
    private int totalRequests;
    private long durationMs;
    private double throughputOpsPerSec;
    private double p50LatencyMicros;
    private double p95LatencyMicros;
    private double p99LatencyMicros;
    private long totalHits;
    private long totalMisses;
    private long totalPuts;
    private double successRatePercent;

    public StressTestResultDTO() {}

    public int getConcurrency() { return concurrency; }
    public void setConcurrency(int concurrency) { this.concurrency = concurrency; }

    public int getTotalRequests() { return totalRequests; }
    public void setTotalRequests(int totalRequests) { this.totalRequests = totalRequests; }

    public long getDurationMs() { return durationMs; }
    public void setDurationMs(long durationMs) { this.durationMs = durationMs; }

    public double getThroughputOpsPerSec() { return throughputOpsPerSec; }
    public void setThroughputOpsPerSec(double throughputOpsPerSec) { this.throughputOpsPerSec = throughputOpsPerSec; }

    public double getP50LatencyMicros() { return p50LatencyMicros; }
    public void setP50LatencyMicros(double p50LatencyMicros) { this.p50LatencyMicros = p50LatencyMicros; }

    public double getP95LatencyMicros() { return p95LatencyMicros; }
    public void setP95LatencyMicros(double p95LatencyMicros) { this.p95LatencyMicros = p95LatencyMicros; }

    public double getP99LatencyMicros() { return p99LatencyMicros; }
    public void setP99LatencyMicros(double p99LatencyMicros) { this.p99LatencyMicros = p99LatencyMicros; }

    public long getTotalHits() { return totalHits; }
    public void setTotalHits(long totalHits) { this.totalHits = totalHits; }

    public long getTotalMisses() { return totalMisses; }
    public void setTotalMisses(long totalMisses) { this.totalMisses = totalMisses; }

    public long getTotalPuts() { return totalPuts; }
    public void setTotalPuts(long totalPuts) { this.totalPuts = totalPuts; }

    public double getSuccessRatePercent() { return successRatePercent; }
    public void setSuccessRatePercent(double successRatePercent) { this.successRatePercent = successRatePercent; }
}
