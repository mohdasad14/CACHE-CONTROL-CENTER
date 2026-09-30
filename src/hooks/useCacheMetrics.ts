/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { cacheApi } from '../services/cacheApi';
import { CacheMetrics, CacheEntryItem, ActivityEvent, BackendStatus, EvictionPolicyType } from '../types/cache';

export interface TimelineDataPoint {
  time: string;
  hits: number;
  misses: number;
  hitRate: number;
  missRate: number;
}

export function useCacheMetrics(pollIntervalMs: number = 1000) {
  const [metrics, setMetrics] = useState<CacheMetrics>({
    totalRequests: 500,
    hits: 412,
    misses: 88,
    hitRate: 82.4,
    missRate: 17.6,
    puts: 45,
    deletes: 12,
    evictions: 17,
    expirations: 6,
    currentSize: 8,
    activeEntries: 8,
    capacity: 10,
    policy: 'LRU',
    avgGetLatencyMs: 0.82,
    avgPutLatencyMs: 1.15,
    p95LatencyMs: 2.4,
    p99LatencyMs: 4.1,
    opsPerSec: 140,
    lruEvictions: 12,
    lfuEvictions: 5,
  });

  const [entries, setEntries] = useState<CacheEntryItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineDataPoint[]>([]);
  const [status, setStatus] = useState<BackendStatus>({ online: true, url: cacheApi.getBaseUrl(), latencyMs: 5 });
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Maintain activity log (max 30 events)
  const addEvent = useCallback((type: ActivityEvent['type'], key?: string, result?: string, latencyMs?: number) => {
    const newEvent: ActivityEvent = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      timeStr: new Date().toLocaleTimeString(),
      type,
      key,
      result,
      latencyMs,
    };
    setActivityLog(prev => [newEvent, ...prev.slice(0, 29)]);
  }, []);

  const fetchData = useCallback(async () => {
    const start = performance.now();
    try {
      const [newMetrics, newEntries] = await Promise.all([
        cacheApi.getMetrics(),
        cacheApi.getEntries(),
      ]);

      const roundTripMs = Math.round(performance.now() - start);

      setMetrics({
        ...newMetrics,
        activeEntries: newMetrics.activeEntries ?? newMetrics.currentSize ?? 0,
        avgGetLatencyMs: newMetrics.avgGetLatencyMs ?? 0.8,
        avgPutLatencyMs: newMetrics.avgPutLatencyMs ?? 1.2,
        p95LatencyMs: newMetrics.p95LatencyMs ?? 2.4,
        p99LatencyMs: newMetrics.p99LatencyMs ?? 4.1,
        opsPerSec: newMetrics.opsPerSec ?? 100,
        lruEvictions: newMetrics.lruEvictions ?? 0,
        lfuEvictions: newMetrics.lfuEvictions ?? 0,
      });
      setEntries(newEntries);
      setStatus({
        online: true,
        latencyMs: roundTripMs,
        url: cacheApi.getBaseUrl(),
        version: 'Java 17 / Spring Boot 3',
      });

      // Append to rolling timeline
      const timeStr = new Date().toLocaleTimeString();
      setTimeline(prev => {
        const nextPoint: TimelineDataPoint = {
          time: timeStr,
          hits: newMetrics.hits,
          misses: newMetrics.misses,
          hitRate: newMetrics.hitRate,
          missRate: newMetrics.missRate,
        };
        const updated = [...prev, nextPoint];
        return updated.length > 40 ? updated.slice(updated.length - 40) : updated;
      });
    } catch (err: any) {
      if (cacheApi.getBaseUrl() !== '/api') {
        cacheApi.setBaseUrl('/api');
        try {
          const [fallbackMetrics, fallbackEntries] = await Promise.all([
            cacheApi.getMetrics(),
            cacheApi.getEntries(),
          ]);
          setMetrics({
            ...fallbackMetrics,
            activeEntries: fallbackMetrics.activeEntries ?? fallbackMetrics.currentSize ?? 0,
            avgGetLatencyMs: fallbackMetrics.avgGetLatencyMs ?? 0.8,
            avgPutLatencyMs: fallbackMetrics.avgPutLatencyMs ?? 1.2,
            p95LatencyMs: fallbackMetrics.p95LatencyMs ?? 2.4,
            p99LatencyMs: fallbackMetrics.p99LatencyMs ?? 4.1,
            opsPerSec: fallbackMetrics.opsPerSec ?? 100,
            lruEvictions: fallbackMetrics.lruEvictions ?? 0,
            lfuEvictions: fallbackMetrics.lfuEvictions ?? 0,
          });
          setEntries(fallbackEntries);
          setStatus({
            online: true,
            latencyMs: Math.max(1, Math.round(performance.now() - start)),
            url: '/api',
            version: 'Java 17 / Spring Boot 3 Engine',
          });
          return;
        } catch {}
      }
      setStatus(prev => ({
        ...prev,
        online: false,
        error: err.message || 'Backend connection failed',
      }));
    }
  }, []);

  // Polling loop
  useEffect(() => {
    fetchData(); // initial fetch
    const interval = setInterval(fetchData, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchData, pollIntervalMs]);

  const refreshNow = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  }, [fetchData]);

  return {
    metrics,
    entries,
    timeline,
    status,
    activityLog,
    addEvent,
    refreshNow,
    isRefreshing,
  };
}
