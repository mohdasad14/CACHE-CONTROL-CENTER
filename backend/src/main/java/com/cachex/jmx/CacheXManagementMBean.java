package com.cachex.jmx;

/**
 * Standard JMX MBean interface for remote monitoring and administrative control of CacheX.
 * Compatible with JConsole, VisualVM, and Prometheus JMX Exporter.
 */
public interface CacheXManagementMBean {

    int getCapacity();

    void setCapacity(int capacity);

    String getActiveEvictionPolicy();

    void switchEvictionPolicy(String policyName);

    long getTotalHits();

    long getTotalMisses();

    double getHitRatePercent();

    int getCurrentSize();

    double getP99LatencyMicros();

    void clearCache();
}
