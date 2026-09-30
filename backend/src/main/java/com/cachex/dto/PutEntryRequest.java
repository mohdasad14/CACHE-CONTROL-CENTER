package com.cachex.dto;

public class PutEntryRequest {
    private String key;
    private String value;
    private long ttlMillis; // 0 or negative means infinite

    public PutEntryRequest() {}

    public PutEntryRequest(String key, String value, long ttlMillis) {
        this.key = key;
        this.value = value;
        this.ttlMillis = ttlMillis;
    }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }

    public long getTtlMillis() { return ttlMillis; }
    public void setTtlMillis(long ttlMillis) { this.ttlMillis = ttlMillis; }
}
