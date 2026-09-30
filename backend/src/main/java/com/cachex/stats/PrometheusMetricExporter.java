package com.cachex.stats;

import com.cachex.core.MetricsCollector;
import java.util.Map;

/**
 * Standard Prometheus Exposition Format Generator for CacheX Telemetry.
 *
 * Produces Prometheus text format metric strings suitable for scraping at /actuator/prometheus.
 */
public class PrometheusMetricExporter {

    public static String export(String cacheName, MetricsCollector metrics, int size, int capacity) {
        StringBuilder sb = new StringBuilder();

        appendMetric(sb, "cachex_cache_size", "gauge", "Current number of entries stored in cache",
            Map.of("cache", cacheName), size);

        appendMetric(sb, "cachex_cache_capacity", "gauge", "Maximum configured cache capacity",
            Map.of("cache", cacheName), capacity);

        appendMetric(sb, "cachex_requests_total", "counter", "Total cache read requests",
            Map.of("cache", cacheName, "result", "hit"), metrics.getHits());

        appendMetric(sb, "cachex_requests_total", "counter", "Total cache read requests",
            Map.of("cache", cacheName, "result", "miss"), metrics.getMisses());

        appendMetric(sb, "cachex_evictions_total", "counter", "Total cache eviction count",
            Map.of("cache", cacheName), metrics.getEvictions());

        appendMetric(sb, "cachex_hit_rate_ratio", "gauge", "Current hit rate ratio [0.0 - 1.0]",
            Map.of("cache", cacheName), metrics.getHitRate() / 100.0);

        return sb.toString();
    }

    private static void appendMetric(StringBuilder sb, String name, String type, String help,
                                    Map<String, String> labels, double value) {
        sb.append("# HELP ").append(name).append(" ").append(help).append("\n");
        sb.append("# TYPE ").append(name).append(" ").append(type).append("\n");
        sb.append(name);
        if (labels != null && !labels.isEmpty()) {
            sb.append("{");
            boolean first = true;
            for (Map.Entry<String, String> entry : labels.entrySet()) {
                if (!first) sb.append(",");
                sb.append(entry.getKey()).append("=\"").append(entry.getValue()).append("\"");
                first = false;
            }
            sb.append("}");
        }
        sb.append(" ").append(value).append("\n\n");
    }
}
