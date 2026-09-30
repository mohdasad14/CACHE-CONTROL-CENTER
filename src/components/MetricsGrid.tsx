/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Target, AlertCircle, HardDrive, RefreshCw, Trash2, Clock, PlusCircle, MinusCircle, Layers, Flame } from 'lucide-react';
import { CacheMetrics } from '../types/cache';

interface MetricsGridProps {
  metrics: CacheMetrics;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics }) => {
  return (
    <div className="space-y-3">
      {/* Top Row: Primary 4 Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* HIT RATE */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              HIT RATE
            </span>
            <span className="text-[11px] font-mono text-emerald-400/90">{metrics.hits} hits</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums tracking-tight">
            {metrics.hitRate.toFixed(1)}%
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, metrics.hitRate))}%` }}
            />
          </div>
        </div>

        {/* MISS RATE */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              MISS RATE
            </span>
            <span className="text-[11px] font-mono text-rose-400/90">{metrics.misses} misses</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums tracking-tight">
            {metrics.missRate.toFixed(1)}%
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div
              className="bg-rose-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, metrics.missRate))}%` }}
            />
          </div>
        </div>

        {/* CACHE SIZE */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              CACHE SIZE
            </span>
            <span className="text-[11px] font-mono text-slate-500">active</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums tracking-tight">
            {metrics.currentSize}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-2">
            In-Memory RAM slots
          </div>
        </div>

        {/* CAPACITY */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              CAPACITY
            </span>
            <span className="text-[11px] font-mono text-purple-400/90">{metrics.policy}</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums tracking-tight">
            {metrics.capacity}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-2">
            Max entry boundary
          </div>
        </div>
      </div>

      {/* Second Row: Detailed Operational Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 font-mono text-xs">
        {/* TOTAL REQUESTS */}
        <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-400 block uppercase font-sans">TOTAL REQUESTS</span>
          <span className="text-lg font-bold text-white mt-1 block tabular-nums">{metrics.totalRequests.toLocaleString()}</span>
        </div>

        {/* HITS */}
        <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
          <span className="text-[10px] text-emerald-400 block uppercase font-sans">HITS</span>
          <span className="text-lg font-bold text-emerald-400 mt-1 block tabular-nums">{metrics.hits}</span>
        </div>

        {/* MISSES */}
        <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
          <span className="text-[10px] text-rose-400 block uppercase font-sans">MISSES</span>
          <span className="text-lg font-bold text-rose-400 mt-1 block tabular-nums">{metrics.misses}</span>
        </div>

        {/* EVICTIONS */}
        <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
          <span className="text-[10px] text-purple-400 block uppercase font-sans">EVICTIONS</span>
          <span className="text-lg font-bold text-purple-400 mt-1 block tabular-nums">{metrics.evictions}</span>
        </div>

        {/* EXPIRATIONS */}
        <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
          <span className="text-[10px] text-amber-400 block uppercase font-sans">EXPIRATIONS</span>
          <span className="text-lg font-bold text-amber-400 mt-1 block tabular-nums">{metrics.expirations}</span>
        </div>

        {/* PUT OPERATIONS */}
        <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
          <span className="text-[10px] text-cyan-400 block uppercase font-sans">PUT OPERATIONS</span>
          <span className="text-lg font-bold text-cyan-400 mt-1 block tabular-nums">{metrics.puts}</span>
        </div>

        {/* DELETE OPERATIONS */}
        <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
          <span className="text-[10px] text-rose-400 block uppercase font-sans">DELETES</span>
          <span className="text-lg font-bold text-slate-300 mt-1 block tabular-nums">{metrics.deletes}</span>
        </div>
      </div>
    </div>
  );
};
