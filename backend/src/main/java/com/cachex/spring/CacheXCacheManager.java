package com.cachex.spring;

import com.cachex.core.CacheManager;
import com.cachex.model.EvictionPolicyType;
import java.util.Collection;
import java.util.Collections;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.cache.Cache;

/**
 * Spring CacheManager implementation providing dynamic and pre-configured
 * CacheX instances for enterprise Spring Boot services.
 */
public class CacheXCacheManager implements org.springframework.cache.CacheManager {

    private final ConcurrentMap<String, Cache> caches;
    private final int defaultCapacity;
    private final EvictionPolicyType defaultPolicy;

    public CacheXCacheManager(int defaultCapacity, EvictionPolicyType defaultPolicy) {
        this.caches = new ConcurrentHashMap<>();
        this.defaultCapacity = defaultCapacity;
        this.defaultPolicy = defaultPolicy;
    }

    public CacheXCacheManager() {
        this(1000, EvictionPolicyType.LRU);
    }

    @Override
    public Cache getCache(String name) {
        return caches.computeIfAbsent(name, n -> {
            CacheManager<Object, Object> coreEngine = new CacheManager<>(defaultCapacity, defaultPolicy);
            return new CacheXCache(n, coreEngine);
        });
    }

    @Override
    public Collection<String> getCacheNames() {
        return Collections.unmodifiableSet(caches.keySet());
    }

    /**
     * Programmatically registers a customized cache instance with specific capacity and policy.
     */
    public void registerCache(String name, int capacity, EvictionPolicyType policy) {
        CacheManager<Object, Object> coreEngine = new CacheManager<>(capacity, policy);
        caches.put(name, new CacheXCache(name, coreEngine));
    }
}
