package com.cachex.dto;

public class StressTestRequest {
    private int concurrency; // e.g. 10, 50, 100 threads
    private int totalRequests; // e.g. 1000, 5000, 10000 requests
    private int readPercentage; // e.g. 80 (80% GET, 20% PUT)

    public StressTestRequest() {}

    public int getConcurrency() { return concurrency; }
    public void setConcurrency(int concurrency) { this.concurrency = concurrency; }

    public int getTotalRequests() { return totalRequests; }
    public void setTotalRequests(int totalRequests) { this.totalRequests = totalRequests; }

    public int getReadPercentage() { return readPercentage; }
    public void setReadPercentage(int readPercentage) { this.readPercentage = readPercentage; }
}
