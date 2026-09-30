package com.cachex.dto;

public class CacheEntryDTO {
    private String key;
    private String value;
    private long createdAt;
    private long expiresAt;
    private long ttlRemainingMillis;
    private long accessCount;
    private long lastAccessed;
    private boolean expired;
    private int evictionPriorityIndex; // 0 = next to evict, higher = safer

    public CacheEntryDTO() {}

    public CacheEntryDTO(String key, String value, long createdAt, long expiresAt,
                         long ttlRemainingMillis, long accessCount, long lastAccessed,
                         boolean expired, int evictionPriorityIndex) {
        this.key = key;
        this.value = value;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.ttlRemainingMillis = ttlRemainingMillis;
        this.accessCount = accessCount;
        this.lastAccessed = lastAccessed;
        this.expired = expired;
        this.evictionPriorityIndex = evictionPriorityIndex;
    }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }

    public long getExpiresAt() { return expiresAt; }
    public void setExpiresAt(long expiresAt) { this.expiresAt = expiresAt; }

    public long getTtlRemainingMillis() { return ttlRemainingMillis; }
    public void setTtlRemainingMillis(long ttlRemainingMillis) { this.ttlRemainingMillis = ttlRemainingMillis; }

    public long getAccessCount() { return accessCount; }
    public void setAccessCount(long accessCount) { this.accessCount = accessCount; }

    public long getLastAccessed() { return lastAccessed; }
    public void setLastAccessed(long lastAccessed) { this.lastAccessed = lastAccessed; }

    public boolean isExpired() { return expired; }
    public void setExpired(boolean expired) { this.expired = expired; }

    public int getEvictionPriorityIndex() { return evictionPriorityIndex; }
    public void setEvictionPriorityIndex(int evictionPriorityIndex) { this.evictionPriorityIndex = evictionPriorityIndex; }
}
