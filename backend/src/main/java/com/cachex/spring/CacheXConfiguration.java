package com.cachex.spring;

import com.cachex.model.EvictionPolicyType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Spring Boot Auto-Configuration for CacheX.
 * Automatically injects CacheXCacheManager as the primary cache provider
 * across the Spring application context when @EnableCaching is active.
 */
@Configuration
@EnableCaching
public class CacheXConfiguration {

    @Value("${cachex.default-capacity:1000}")
    private int defaultCapacity;

    @Value("${cachex.default-policy:LRU}")
    private String defaultPolicy;

    @Bean
    @Primary
    public org.springframework.cache.CacheManager cacheManager() {
        EvictionPolicyType policyType;
        try {
            policyType = EvictionPolicyType.valueOf(defaultPolicy.toUpperCase());
        } catch (IllegalArgumentException e) {
            policyType = EvictionPolicyType.LRU;
        }

        CacheXCacheManager manager = new CacheXCacheManager(defaultCapacity, policyType);
        // Pre-configure common caches
        manager.registerCache("users", 500, EvictionPolicyType.LRU);
        manager.registerCache("products", 2000, EvictionPolicyType.TWO_QUEUE);
        manager.registerCache("sessions", 1000, EvictionPolicyType.ARC);

        return manager;
    }
}
