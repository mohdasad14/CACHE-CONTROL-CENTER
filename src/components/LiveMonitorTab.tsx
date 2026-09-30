/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sliders,
  Play,
  Plus,
  Search,
  Trash2,
  Clock,
  Layers,
  ArrowRight,
  Database,
  CheckCircle2,
  AlertCircle,
  Activity,
  Terminal,
  RotateCcw
} from 'lucide-react';
import { CacheManager } from '../engine/CacheManager';
import { CacheEntry, CacheEvent, PolicyType } from '../types/cache';
import { AiChartBox } from './AiChartBox';

interface LiveMonitorTabProps {
  cache: CacheManager;
  entries: CacheEntry[];
  events: CacheEvent[];
  onSelectEntry: (entry: CacheEntry) => void;
  evictionCandidate: string | null;
  onRefresh: () => void;
}

export const LiveMonitorTab: React.FC<LiveMonitorTabProps> = ({
  cache,
  entries,
  events,
  onSelectEntry,
  evictionCandidate,
  onRefresh,
}) => {
  // Configuration form state
  const [capacityInput, setCapacityInput] = useState<number>(cache.getCapacity());
  const [policyInput, setPolicyInput] = useState<PolicyType>(cache.getPolicyType());
  const [ttlInput, setTtlInput] = useState<number>(cache.getDefaultTtlSec());
  const [configSuccess, setConfigSuccess] = useState<boolean>(false);

  // Playground operations
  const [getKey, setGetKey] = useState<string>('user:101');
  const [getResult, setGetResult] = useState<{ hit: boolean; val: unknown; latency: number } | null>(null);

  const [putKey, setPutKey] = useState<string>('user:101');
  const [putValue, setPutValue] = useState<string>('{"name": "Asad", "role": "Systems Engineer"}');
  const [putTtl, setPutTtl] = useState<string>('45');
  const [putSuccess, setPutSuccess] = useState<boolean>(false);

  // Event stream filter
  const [eventFilter, setEventFilter] = useState<'ALL' | 'HIT' | 'MISS' | 'PUT' | 'EVICTION' | 'EXPIRE'>('ALL');

  const handleApplyConfig = (e: React.FormEvent) => {
    e.preventDefault();
    cache.setCapacity(capacityInput);
    cache.setPolicy(policyInput);
    cache.setDefaultTtlSec(ttlInput);
    setConfigSuccess(true);
    setTimeout(() => setConfigSuccess(false), 2000);
    onRefresh();
  };

  const handleManualGet = () => {
    if (!getKey.trim()) return;
    const start = performance.now();
    const val = cache.get(getKey.trim(), 'Interactive-UI');
    const dur = performance.now() - start;
    setGetResult({
      hit: val !== null,
      val,
      latency: Number(dur.toFixed(2)),
    });
    onRefresh();
  };

  const handleManualPut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!putKey.trim()) return;
    let parsedVal: unknown = putValue;
    try {
      parsedVal = JSON.parse(putValue);
    } catch {
      parsedVal = putValue;
    }
    const customTtl = putTtl.trim() !== '' ? Number(putTtl) : undefined;
    cache.put(putKey.trim(), parsedVal, customTtl, 'Interactive-UI');
    setPutSuccess(true);
    setTimeout(() => setPutSuccess(false), 1800);
    onRefresh();
  };

  const handleClearCache = () => {
    cache.clear();
    setGetResult(null);
    onRefresh();
  };

  const filteredEvents = events.filter(evt => {
    if (eventFilter === 'ALL') return true;
    if (eventFilter === 'HIT') return evt.result === 'HIT';
    if (eventFilter === 'MISS') return evt.result === 'MISS';
    if (eventFilter === 'PUT') return evt.op === 'PUT';
    if (eventFilter === 'EVICTION') return evt.op === 'EVICT';
    if (eventFilter === 'EXPIRE') return evt.op === 'EXPIRE';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Interactive Chart Box with AI Analytics */}
      <AiChartBox
        metrics={cache.getMetrics()}
        timeline={cache.getTimeline()}
        currentPolicy={cache.getPolicyType()}
        entries={entries}
        onApplyCapacity={(cap) => {
          cache.setCapacity(cap);
          setCapacityInput(cap);
          onRefresh();
        }}
        onApplyPolicy={(pol) => {
          cache.setPolicy(pol);
          setPolicyInput(pol);
          onRefresh();
        }}
        onApplyTtl={(ttl) => {
          cache.setDefaultTtlSec(ttl);
          setTtlInput(ttl);
          onRefresh();
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Configuration & Interactive Playground */}
        <div className="space-y-6">
          {/* Cache Configuration Panel */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Cache Configuration
              </h3>
              {configSuccess && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Applied
                </span>
              )}
            </div>

            <form onSubmit={handleApplyConfig} className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between items-center mb-1 text-slate-300">
                  <span className="font-medium">Capacity (Max Entries)</span>
                  <span className="font-mono text-cyan-400 font-semibold">{capacityInput}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="100"
                  value={capacityInput}
                  onChange={e => setCapacityInput(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                  <span>2 items</span>
                  <span>50 items</span>
                  <span>100 items</span>
                </div>
              </div>

              <div>
                <span className="block font-medium text-slate-300 mb-1.5">Eviction Policy</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPolicyInput('LRU')}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      policyInput === 'LRU'
                        ? 'border-cyan-500 bg-cyan-950/30 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>LRU</span>
                      {policyInput === 'LRU' && <span className="w-2 h-2 rounded-full bg-cyan-400" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Least Recently Used (Doubly-Linked List)</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPolicyInput('LFU')}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      policyInput === 'LFU'
                        ? 'border-indigo-500 bg-indigo-950/30 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>LFU</span>
                      {policyInput === 'LFU' && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Least Frequently Used (Frequency Sets)</p>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1 text-slate-300">
                  <span className="font-medium">Default TTL</span>
                  <span className="font-mono text-cyan-400 font-semibold">{ttlInput}s</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="180"
                  step="5"
                  value={ttlInput}
                  onChange={e => setTtlInput(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                  <span>5s</span>
                  <span>60s</span>
                  <span>180s</span>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-md transition-colors text-xs text-center"
                >
                  Apply Configuration
                </button>
                <button
                  type="button"
                  onClick={handleClearCache}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-md transition-colors text-xs flex items-center gap-1"
                  title="Clear all in-memory cache entries"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            </form>
          </div>

          {/* Interactive Playground: GET / PUT */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 pb-2 border-b border-slate-800">
              <Database className="w-4 h-4 text-emerald-400" />
              Direct Cache Playground
            </h3>

            {/* GET Tester */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>GET Key</span>
                <span className="text-[11px] text-slate-500 font-mono">Thread-Safe Lookup</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={getKey}
                  onChange={e => setGetKey(e.target.value)}
                  placeholder="e.g. user:101"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleManualGet}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-medium text-xs rounded-md flex items-center gap-1 transition-colors"
                >
                  <Search className="w-3.5 h-3.5" />
                  GET
                </button>
              </div>

              {/* GET Result feedback */}
              {getResult && (
                <div
                  className={`p-2.5 rounded-md border text-xs font-mono ${
                    getResult.hit
                      ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span>{getResult.hit ? '✓ CACHE HIT' : '✗ CACHE MISS'}</span>
                    <span className="text-[10px] text-slate-400">{getResult.latency}ms</span>
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">
                    {getResult.hit
                      ? typeof getResult.val === 'object'
                        ? JSON.stringify(getResult.val)
                        : String(getResult.val)
                      : 'Key not found or expired.'}
                  </div>
                </div>
              )}
            </div>

            {/* PUT Tester */}
            <form onSubmit={handleManualPut} className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                <span>PUT Entry with per-entry TTL</span>
                {putSuccess && (
                  <span className="text-[11px] text-emerald-400 font-mono">Stored in RAM!</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <input
                    type="text"
                    value={putKey}
                    onChange={e => setPutKey(e.target.value)}
                    placeholder="Key (e.g. user:101)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    value={putTtl}
                    onChange={e => setPutTtl(e.target.value)}
                    placeholder="TTL (s)"
                    title="Per-entry TTL in seconds"
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
              <input
                type="text"
                value={putValue}
                onChange={e => setPutValue(e.target.value)}
                placeholder='Value string or JSON...'
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-md flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                PUT Key
              </button>
            </form>
          </div>
        </div>

        {/* Right 2 Columns: Active Cache In-Memory Storage Matrix & Live Event Stream */}
        <div className="lg:col-span-2 space-y-6">
          {/* In-Memory Storage Matrix */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  Active In-Memory Storage Matrix
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click any slot to open the detailed Cache Entry Inspector
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                {entries.length} / {cache.getCapacity()} occupied
              </span>
            </div>

            {entries.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-800 rounded-lg bg-slate-950/30">
                <Database className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">Cache is currently empty</p>
                <p className="text-xs text-slate-600 mt-1">
                  Use the Direct Cache Playground or click &quot;Quick Stress&quot; to populate memory slots.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {entries.map(entry => {
                  const now = Date.now();
                  const remainingMs = entry.expiresAt === Infinity ? Infinity : Math.max(0, entry.expiresAt - now);
                  const remainingSec = remainingMs === Infinity ? '∞' : `${Math.ceil(remainingMs / 1000)}s`;
                  const isCandidate = entry.key === evictionCandidate;

                  const ttlProgress = entry.ttlMs > 0 && remainingMs !== Infinity
                    ? Math.max(0, Math.min(100, (remainingMs / entry.ttlMs) * 100))
                    : 100;

                  return (
                    <div
                      key={entry.key}
                      onClick={() => onSelectEntry(entry)}
                      className={`group relative p-3 rounded-lg border text-left cursor-pointer transition-all hover:scale-[1.01] ${
                        isCandidate
                          ? 'bg-amber-950/20 border-amber-800/80 hover:border-amber-600'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-xs font-bold text-cyan-300 truncate max-w-[120px]">
                          {entry.key}
                        </span>
                        {isCandidate && (
                          <span className="text-[10px] font-mono font-medium text-amber-400 bg-amber-950/70 border border-amber-800/60 px-1 rounded">
                            Evict next
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 font-mono truncate mb-2">
                        {typeof entry.value === 'object' ? JSON.stringify(entry.value) : String(entry.value)}
                      </div>

                      {/* Bottom meta: Accesses & TTL Countdown */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span>{entry.accessCount} acc</span>
                          <span className="text-cyan-400 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {remainingSec}
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              ttlProgress < 25 ? 'bg-rose-500' : 'bg-cyan-500'
                            }`}
                            style={{ width: `${ttlProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Event Stream */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Live Event Stream</h3>
              </div>

              {/* Event filter tabs */}
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-md border border-slate-800 text-[11px] font-medium">
                {(['ALL', 'HIT', 'MISS', 'PUT', 'EVICTION', 'EXPIRE'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setEventFilter(tab)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      eventFilter === tab
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Event list */}
            <div className="space-y-1 max-h-72 overflow-y-auto font-mono text-xs pr-1">
              {filteredEvents.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No events captured yet. Issue requests to see real-time cache activity.
                </div>
              ) : (
                filteredEvents.slice(0, 40).map(evt => {
                  const timeStr = new Date(evt.timestamp).toLocaleTimeString();

                  let badgeColor = 'text-slate-400 bg-slate-800';
                  let icon = '•';

                  if (evt.result === 'HIT') {
                    badgeColor = 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/50';
                    icon = '✓';
                  } else if (evt.result === 'MISS') {
                    badgeColor = 'text-rose-400 bg-rose-950/60 border border-rose-800/50';
                    icon = '✗';
                  } else if (evt.op === 'PUT') {
                    badgeColor = 'text-cyan-400 bg-cyan-950/60 border border-cyan-800/50';
                    icon = '+';
                  } else if (evt.op === 'EVICT') {
                    badgeColor = 'text-amber-400 bg-amber-950/60 border border-amber-800/50';
                    icon = '⤑';
                  } else if (evt.op === 'EXPIRE') {
                    badgeColor = 'text-purple-400 bg-purple-950/60 border border-purple-800/50';
                    icon = '⏱';
                  }

                  return (
                    <div
                      key={evt.id}
                      className="flex items-center justify-between p-1.5 rounded hover:bg-slate-800/40 transition-colors text-[11px]"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-slate-500 text-[10px] shrink-0">{timeStr}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${badgeColor}`}>
                          {icon} {evt.op}
                        </span>
                        <span className="text-slate-200 font-semibold truncate max-w-[120px]">
                          {evt.key || '—'}
                        </span>
                        <span className="text-slate-500 text-[10px] hidden sm:inline truncate max-w-[200px]">
                          {evt.details}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-slate-400">
                        <span className="text-slate-500 text-[10px]">{evt.threadId}</span>
                        <span className="text-cyan-400 font-semibold">{evt.latencyMs}ms</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
