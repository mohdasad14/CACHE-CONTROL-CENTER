/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Target, AlertCircle, HardDrive, RefreshCw, Trash2, Clock } from 'lucide-react';
import { CacheMetrics } from '../types/cache';

interface MetricsBarProps {
  metrics: CacheMetrics;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ metrics }) => {
  const capacityPercent = metrics.capacity > 0
    ? Math.min(100, Math.round((metrics.activeEntries / metrics.capacity) * 100))
    : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {/* 1. Hit Rate */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="flex items-center gap-1.5 font-medium">
            <Target className="w-3.5 h-3.5 text-emerald-400" />
            Hit Rate
          </span>
          <span className="text-[11px] font-mono text-emerald-400/90">{metrics.hits} hits</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
            {metrics.hitRate.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-slate-800/80 h-1.5 rounded-full mt-2.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, metrics.hitRate))}%` }}
          />
        </div>
      </div>

      {/* 2. Miss Rate */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="flex items-center gap-1.5 font-medium">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            Miss Rate
          </span>
          <span className="text-[11px] font-mono text-rose-400/90">{metrics.misses} misses</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
            {metrics.missRate.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-slate-800/80 h-1.5 rounded-full mt-2.5 overflow-hidden">
          <div
            className="bg-rose-500 h-full transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, metrics.missRate))}%` }}
          />
        </div>
      </div>

      {/* 3. Cache Entries / Capacity */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="flex items-center gap-1.5 font-medium">
            <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
            Cache Size
          </span>
          <span className="text-[11px] font-mono text-cyan-400/90">{capacityPercent}% full</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
            {metrics.activeEntries}
          </span>
          <span className="text-xs font-mono text-slate-500 tabular-nums">/ {metrics.capacity}</span>
        </div>
        <div className="w-full bg-slate-800/80 h-1.5 rounded-full mt-2.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              capacityPercent > 90 ? 'bg-amber-500' : 'bg-cyan-500'
            }`}
            style={{ width: `${capacityPercent}%` }}
          />
        </div>
      </div>

      {/* 4. Total Requests */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="flex items-center gap-1.5 font-medium">
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
            Requests
          </span>
          <span className="text-[11px] font-mono text-indigo-400/90">{metrics.puts} puts</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
            {metrics.totalRequests.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 font-mono">
          <span>{metrics.opsPerSec} req/sec</span>
          <span>·</span>
          <span>RAM In-Memory</span>
        </div>
      </div>

      {/* 5. Total Evictions */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="flex items-center gap-1.5 font-medium">
            <Trash2 className="w-3.5 h-3.5 text-amber-400" />
            Evictions
          </span>
          <span className="text-[11px] font-mono text-amber-400/90">{metrics.expirations} expired</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
            {metrics.evictions.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 font-mono">
          <span>LRU: {metrics.lruEvictions}</span>
          <span>·</span>
          <span>LFU: {metrics.lfuEvictions}</span>
        </div>
      </div>

      {/* 6. Latency */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="flex items-center gap-1.5 font-medium">
            <Clock className="w-3.5 h-3.5 text-violet-400" />
            Latency
          </span>
          <span className="text-[11px] font-mono text-violet-400/90">P95: {metrics.p95LatencyMs}ms</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
            {metrics.avgGetLatencyMs.toFixed(2)}
          </span>
          <span className="text-xs text-slate-400 font-mono">ms avg</span>
        </div>
        <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 font-mono">
          <span>P99: {metrics.p99LatencyMs}ms</span>
          <span>·</span>
          <span>Write: {metrics.avgPutLatencyMs.toFixed(2)}ms</span>
        </div>
      </div>
    </div>
  );
};
