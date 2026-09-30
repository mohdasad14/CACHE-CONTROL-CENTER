package com.cachex.jmx;

import com.cachex.core.CacheManager;
import com.cachex.model.EvictionPolicyType;
import java.lang.management.ManagementFactory;
import javax.management.ObjectName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Concrete JMX MBean implementation registered under {@code com.cachex:type=CacheManager}.
 */
@Component
public class CacheXManagement implements CacheXManagementMBean {

    private static final Logger log = LoggerFactory.getLogger(CacheXManagement.class);
    private final CacheManager<?, ?> cacheManager;

    public CacheXManagement(CacheManager<?, ?> cacheManager) {
        this.cacheManager = cacheManager;
        registerMBean();
    }

    private void registerMBean() {
        try {
            ObjectName objectName = new ObjectName("com.cachex:type=CacheManager,name=DefaultCache");
            ManagementFactory.getPlatformMBeanServer().registerMBean(this, objectName);
            log.info("Registered CacheX JMX MBean successfully under {}", objectName);
        } catch (Exception e) {
            log.warn("Could not register JMX MBean: {}", e.getMessage());
        }
    }

    @Override
    public int getCapacity() {
        return cacheManager.getCapacity();
    }

    @Override
    public void setCapacity(int capacity) {
        cacheManager.setCapacity(capacity);
    }

    @Override
    public String getActiveEvictionPolicy() {
        return cacheManager.getEvictionPolicyType().name();
    }

    @Override
    public void switchEvictionPolicy(String policyName) {
        EvictionPolicyType type = EvictionPolicyType.valueOf(policyName.toUpperCase());
        cacheManager.switchEvictionPolicy(type);
    }

    @Override
    public long getTotalHits() {
        return cacheManager.getMetrics().getHits();
    }

    @Override
    public long getTotalMisses() {
        return cacheManager.getMetrics().getMisses();
    }

    @Override
    public double getHitRatePercent() {
        return cacheManager.getMetrics().getHitRate() * 100.0;
    }

    @Override
    public int getCurrentSize() {
        return cacheManager.size();
    }

    @Override
    public double getP99LatencyMicros() {
        return cacheManager.getMetrics().getP99LatencyMicros();
    }

    @Override
    public void clearCache() {
        cacheManager.clear();
    }
}
