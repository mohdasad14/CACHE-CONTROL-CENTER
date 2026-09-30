package com.cachex.service;

import com.cachex.core.CacheEntry;
import com.cachex.core.CacheManager;
import com.cachex.dto.CacheEntryDTO;
import com.cachex.dto.CacheMetricsDTO;
import com.cachex.model.EvictionPolicyType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.*;

@Service
public class CacheService {

    @Value("${cachex.default-capacity:10}")
    private int initialCapacity;

    @Value("${cachex.default-policy:LRU}")
    private String initialPolicyStr;

    @Value("${cachex.default-ttl-seconds:60}")
    private long defaultTtlSeconds;

    private CacheManager<String, String> cacheManager;

    @PostConstruct
    public void init() {
        EvictionPolicyType policy = EvictionPolicyType.valueOf(initialPolicyStr.toUpperCase());
        this.cacheManager = new CacheManager<>(initialCapacity, policy);
        seedSampleData();
    }

    private void seedSampleData() {
        long defaultTtl = defaultTtlSeconds * 1000L;
        cacheManager.put("user:1", "Alice", defaultTtl);
        cacheManager.put("user:2", "Bob", defaultTtl + 30000L);
        cacheManager.put("session:token_99", "auth_jwt_valid", defaultTtl);
        cacheManager.put("config:rate_limit", "1000_rpm", 0); // infinite
        cacheManager.get("user:1");
        cacheManager.get("user:1");
        cacheManager.get("session:token_99");
    }

    public CacheManager<String, String> getCacheManager() {
        return cacheManager;
    }

    public CacheMetricsDTO getMetrics() {
        var metrics = cacheManager.getMetrics();
        CacheMetricsDTO dto = new CacheMetricsDTO();
        dto.setHitRate(metrics.getHitRate());
        dto.setMissRate(metrics.getMissRate());
        dto.setCurrentSize(cacheManager.size());
        dto.setCapacity(cacheManager.getCapacity());
        dto.setTotalRequests(metrics.getTotalRequests());
        dto.setHits(metrics.getHits());
        dto.setMisses(metrics.getMisses());
        dto.setPuts(metrics.getPuts());
        dto.setDeletes(metrics.getDeletes());
        dto.setEvictions(metrics.getEvictions());
        dto.setExpirations(metrics.getExpirations());
        dto.setAverageLatencyMicros(metrics.getAverageLatencyMicros());
        dto.setP95LatencyMicros(metrics.getP95LatencyMicros());
        dto.setPolicy(cacheManager.getPolicyType());
        return dto;
    }

    public List<CacheEntryDTO> getEntries() {
        Map<String, CacheEntry<String, String>> snapshot = cacheManager.getSnapshot();
        List<String> order = cacheManager.getEvictionOrder();
        Map<String, Integer> priorityMap = new HashMap<>();

        for (int i = 0; i < order.size(); i++) {
            priorityMap.put(order.get(i), i);
        }

        List<CacheEntryDTO> dtos = new ArrayList<>();
        for (CacheEntry<String, String> entry : snapshot.values()) {
            int priorityIndex = priorityMap.getOrDefault(entry.getKey(), 0);
            dtos.add(new CacheEntryDTO(
                    entry.getKey(),
                    entry.getValue(),
                    entry.getCreatedAt(),
                    entry.getExpiresAt(),
                    entry.getRemainingTtlMillis(),
                    entry.getAccessCount(),
                    entry.getLastAccessedTime(),
                    entry.isExpired(),
                    priorityIndex
            ));
        }

        // Sort: active first, then by priority
        dtos.sort(Comparator.comparingInt(CacheEntryDTO::getEvictionPriorityIndex));
        return dtos;
    }

    public void put(String key, String value, long ttlMillis) {
        if (ttlMillis <= 0 && defaultTtlSeconds > 0) {
            ttlMillis = defaultTtlSeconds * 1000L;
        }
        cacheManager.put(key, value, ttlMillis);
    }

    public String get(String key) {
        return cacheManager.get(key);
    }

    public boolean remove(String key) {
        return cacheManager.remove(key);
    }

    public void setPolicy(EvictionPolicyType policy) {
        cacheManager.setPolicy(policy);
    }

    public void setCapacity(int capacity) {
        cacheManager.setCapacity(capacity);
    }

    public void resetMetrics() {
        cacheManager.getMetrics().reset();
    }

    public void clear() {
        cacheManager.clear();
    }
}
