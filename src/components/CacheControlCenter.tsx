/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  RefreshCw,
  Trash2,
  Volume2,
  VolumeX,
  Music,
  Activity,
  Layers,
  Flame,
  CheckCircle2,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { CacheManager } from '../engine/CacheManager';
import { ConcurrentWorkerPool } from '../engine/ConcurrentWorkerPool';
import { CacheEntry, CacheMetrics, PolicyType } from '../types/cache';
import { HitMissDonutChart } from './HitMissDonutChart';
import { CacheOperationsPanel } from './CacheOperationsPanel';
import { CacheEntriesTable } from './CacheEntriesTable';
import { SampleAccessPatternDemo } from './SampleAccessPatternDemo';
import { ConcurrencyStressTestPanel } from './ConcurrencyStressTestPanel';
import { AiChartBox } from './AiChartBox';
import { soundManager } from '../services/soundEffects';
import { useToast } from './ToastNotification';

interface CacheControlCenterProps {
  cache: CacheManager;
  workerPool: ConcurrentWorkerPool;
  entries: CacheEntry[];
  metrics: CacheMetrics;
  onRefresh: () => void;
  onSelectEntry: (entry: CacheEntry) => void;
}

export const CacheControlCenter: React.FC<CacheControlCenterProps> = ({
  cache,
  workerPool,
  entries,
  metrics,
  onRefresh,
  onSelectEntry,
}) => {
  const { showToast } = useToast();
  const [autoPoll, setAutoPoll] = useState<boolean>(true);
  const [soundOn, setSoundOn] = useState<boolean>(soundManager.getSoundEnabled());
  const [musicOn, setMusicOn] = useState<boolean>(soundManager.getMusicEnabled());
  const [capacityInput, setCapacityInput] = useState<number>(cache.getCapacity());
  const [currentPolicy, setCurrentPolicy] = useState<PolicyType>(cache.getPolicyType());
  const [showSecurityInfo, setShowSecurityInfo] = useState<boolean>(false);

  // Auto-poll interval
  useEffect(() => {
    let timer: number | null = null;
    if (autoPoll) {
      timer = window.setInterval(() => {
        onRefresh();
      }, 1000);
    }
    return () => {
      if (timer !== null) clearInterval(timer);
    };
  }, [autoPoll, onRefresh]);

  const toggleSound = () => {
    const next = !soundOn;
    soundManager.setSoundEnabled(next);
    setSoundOn(next);
    if (next) soundManager.playHit();
  };

  const toggleMusic = () => {
    const next = !musicOn;
    soundManager.setMusicEnabled(next);
    setMusicOn(next);
  };

  const handleSetCapacity = () => {
    cache.setCapacity(capacityInput);
    soundManager.playPut();
    showToast('info', 'Capacity Updated', `Maximum capacity set to ${capacityInput} entries.`);
    onRefresh();
  };

  const handlePolicyChange = (policy: PolicyType) => {
    cache.setPolicy(policy);
    setCurrentPolicy(policy);
    soundManager.playHit();
    showToast('success', `Policy Switched to ${policy}`, `Cache entries re-indexed under ${policy} strategy.`);
    onRefresh();
  };

  const handleClearCache = () => {
    cache.clear();
    soundManager.playDelete();
    showToast('warning', 'Cache Cleared', 'All active entries evicted from RAM.');
    onRefresh();
  };

  const occupancyPercent = metrics.capacity > 0
    ? Math.min(100, Math.round((metrics.activeEntries / metrics.capacity) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* 1. Header Bar matching Image 2 */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/70 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold uppercase tracking-wider text-white">
                CACHE CONTROL CENTER
              </h1>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-[10px] font-bold text-emerald-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Custom Java In-Memory Cache Engine • LRU / LFU • Per-Entry TTL • Thread-Safe Concurrency
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Security Badge */}
          <button
            onClick={() => setShowSecurityInfo(!showSecurityInfo)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium text-emerald-400 bg-emerald-950/50 border border-emerald-800/70 hover:bg-emerald-900/40 transition-colors"
            title="API Keys strictly isolated in server.ts environment"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">API Key: Secure</span>
          </button>

          {/* Sound FX Button */}
          <button
            onClick={toggleSound}
            className={`p-2 rounded-lg border text-xs transition-colors ${
              soundOn ? 'bg-cyan-950/50 border-cyan-700 text-cyan-300' : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
            title={soundOn ? 'Sound FX: ON' : 'Sound FX: MUTED'}
          >
            {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Ambient Music Button */}
          <button
            onClick={toggleMusic}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              musicOn ? 'bg-purple-950/50 border-purple-600 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
            title="Toggle Systems Ambient Music"
          >
            <Music className="w-3.5 h-3.5" />
            <span className="text-[11px] font-mono">{musicOn ? 'Music ON' : 'Music OFF'}</span>
          </button>

          {/* Auto-Poll Toggle */}
          <button
            onClick={() => setAutoPoll(!autoPoll)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors ${
              autoPoll
                ? 'bg-cyan-950/50 border-cyan-800 text-cyan-400'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Auto-Poll: {autoPoll ? 'ON' : 'OFF'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => {
              onRefresh();
              soundManager.playHit();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          {/* Clear Cache Button */}
          <button
            onClick={handleClearCache}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 rounded-lg text-xs font-medium border border-rose-800/60 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Cache</span>
          </button>
        </div>
      </div>

      {/* Security Info Drawer if opened */}
      {showSecurityInfo && (
        <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-800/80 text-xs font-mono space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <Lock className="w-4 h-4" />
            <span>Server-Side API Key &amp; Architecture Security Invariants</span>
          </div>
          <p className="text-slate-300 font-sans text-xs leading-relaxed">
            All AI queries are proxied via server endpoint <code className="text-cyan-400">/api/ai/analyze-cache</code> on <code className="text-cyan-400">server.ts</code>. The Gemini API key is extracted directly from server-side environment secrets (<code className="text-cyan-400">process.env.GEMINI_API_KEY</code>). Zero secrets are transmitted to browser bundles.
          </p>
        </div>
      )}

      {/* 2. Control Bar matching Image 2 */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs shadow-md">
        {/* Eviction Policy Segmented Switch */}
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            EVICTION POLICY
          </span>
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => handlePolicyChange('LRU')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                currentPolicy === 'LRU'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              LRU (Least Recently Used)
            </button>
            <button
              onClick={() => handlePolicyChange('LFU')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                currentPolicy === 'LFU'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              LFU (Least Frequently Used)
            </button>
          </div>
        </div>

        {/* Max Capacity Input & Occupancy */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-mono">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">MAX CAPACITY</span>
            <input
              type="number"
              value={capacityInput}
              onChange={e => setCapacityInput(Number(e.target.value))}
              className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-center text-white font-bold focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleSetCapacity}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold rounded border border-slate-700 transition-colors"
            >
              Set
            </button>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-400">Occupancy:</span>
            <strong className="text-white">
              {metrics.activeEntries} / {metrics.capacity} ({occupancyPercent}%)
            </strong>
            <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${occupancyPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Top Metrics Grid & Donut Chart matching Image 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 6 Metric Boxes */}
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* CACHE HITS */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
              <span>CACHE HITS</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            </div>
            <div className="my-2">
              <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                {metrics.hits}
              </span>
              <span className="text-xs text-slate-400 ml-1 font-mono">reqs</span>
            </div>
            <span className="text-[11px] text-slate-500 font-sans">Successful lookups</span>
          </div>

          {/* CACHE MISSES */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
              <span>CACHE MISSES</span>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            </div>
            <div className="my-2">
              <span className="text-2xl font-bold font-mono text-rose-500 tabular-nums">
                {metrics.misses}
              </span>
              <span className="text-xs text-slate-400 ml-1 font-mono">reqs</span>
            </div>
            <span className="text-[11px] text-slate-500 font-sans">Not found / Expired</span>
          </div>

          {/* HIT RATE */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
              <span>HIT RATE</span>
              <span className="text-[11px] font-mono text-cyan-400">%</span>
            </div>
            <div className="my-2">
              <span className="text-2xl font-bold font-mono text-cyan-400 tabular-nums">
                {metrics.hitRate.toFixed(2)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${metrics.hitRate}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 font-mono">hits / (hits + misses)</span>
          </div>

          {/* MISS RATE */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
              <span>MISS RATE</span>
              <span className="text-[11px] font-mono text-amber-400">%</span>
            </div>
            <div className="my-2">
              <span className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
                {metrics.missRate.toFixed(2)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${metrics.missRate}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 font-mono">misses / (hits + misses)</span>
          </div>

          {/* EVICTIONS */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
              <span>EVICTIONS</span>
              <Flame className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="my-2">
              <span className="text-2xl font-bold font-mono text-purple-400 tabular-nums">
                {metrics.evictions}
              </span>
              <span className="text-xs text-slate-400 ml-1 font-mono">purged</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Policy: {currentPolicy}</span>
          </div>

          {/* ENTRIES / CAPACITY */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
              <span>ENTRIES / CAPACITY</span>
              <span className="text-[11px] font-mono text-cyan-400">RAM</span>
            </div>
            <div className="my-2">
              <span className="text-2xl font-bold font-mono text-cyan-300 tabular-nums">
                {metrics.activeEntries}
              </span>
              <span className="text-xs text-slate-500 ml-1 font-mono">/ {metrics.capacity}</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Total Requests: {metrics.totalRequests}</span>
          </div>
        </div>

        {/* Donut Chart */}
        <HitMissDonutChart
          hits={metrics.hits}
          misses={metrics.misses}
          hitRate={metrics.hitRate}
          missRate={metrics.missRate}
        />
      </div>

      {/* 4. Interactive Chart Box with AI Analytics */}
      <AiChartBox
        metrics={metrics}
        timeline={cache.getTimeline()}
        currentPolicy={currentPolicy}
        entries={entries}
        onApplyCapacity={(cap) => {
          cache.setCapacity(cap);
          setCapacityInput(cap);
          onRefresh();
        }}
        onApplyPolicy={(pol) => {
          cache.setPolicy(pol);
          setCurrentPolicy(pol);
          onRefresh();
        }}
        onApplyTtl={(ttl) => {
          cache.setDefaultTtlSec(ttl);
          onRefresh();
        }}
      />

      {/* 5. Cache Operations Panel matching Image 1 */}
      <CacheOperationsPanel cache={cache} onRefresh={onRefresh} />

      {/* 6. Cache Entries Table matching Image 1 */}
      <CacheEntriesTable
        entries={entries}
        onDeleteKey={(key) => {
          cache.remove(key, 'Table-Action');
          onRefresh();
        }}
        onSelectEntry={onSelectEntry}
      />

      {/* 7. Sample Access Pattern Demo matching Image 3 */}
      <SampleAccessPatternDemo />

      {/* 8. Thread-Safe Concurrency Stress Test matching Image 4 */}
      <ConcurrencyStressTestPanel workerPool={workerPool} onRefresh={onRefresh} />
    </div>
  );
};
