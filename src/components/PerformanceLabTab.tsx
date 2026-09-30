/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  BarChart2,
  Play,
  Award,
  Download,
  Flame,
  Shuffle,
  Repeat,
  Compass,
  ArrowUpRight,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { BenchmarkEngine } from '../engine/BenchmarkEngine';
import { BenchmarkConfig, BenchmarkResult, WorkloadType } from '../types/cache';

export const PerformanceLabTab: React.FC = () => {
  const [workloadType, setWorkloadType] = useState<WorkloadType>('zipfian');
  const [requestCount, setRequestCount] = useState<number>(5000);
  const [capacity, setCapacity] = useState<number>(50);
  const [customSequence, setCustomSequence] = useState<string>('A, B, C, A, D, B, A, E, C');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<BenchmarkResult | null>(() => {
    // Initial benchmark run for instant gratification
    return BenchmarkEngine.runBenchmark({
      workloadType: 'zipfian',
      requestCount: 5000,
      capacity: 50,
      ttlSec: 60,
      keyUniverseSize: 150,
    });
  });

  const handleRunBenchmark = async () => {
    setIsRunning(true);
    // Brief setTimeout so UI renders running state nicely
    await new Promise(resolve => setTimeout(resolve, 80));

    const config: BenchmarkConfig = {
      workloadType,
      requestCount,
      capacity,
      ttlSec: 60,
      keyUniverseSize: capacity * 3,
      customKeys: workloadType === 'custom'
        ? customSequence.split(/[,;\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
        : undefined,
    };

    const benchResult = BenchmarkEngine.runBenchmark(config);
    setResult(benchResult);
    setIsRunning(false);
  };

  const downloadCsv = () => {
    if (!result) return;
    const csvContent =
      `Workload,${result.workloadName}\n` +
      `Requests,${result.config.requestCount}\n` +
      `Capacity,${result.config.capacity}\n\n` +
      `Metric,LRU,LFU,Delta\n` +
      `Hits,${result.lru.hits},${result.lfu.hits},${result.lfu.hits - result.lru.hits}\n` +
      `Misses,${result.lru.misses},${result.lfu.misses},${result.lfu.misses - result.lru.misses}\n` +
      `Hit Rate (%),${result.lru.hitRate}%,${result.lfu.hitRate}%,${(result.lfu.hitRate - result.lru.hitRate).toFixed(2)}%\n` +
      `Evictions,${result.lru.evictions},${result.lfu.evictions},${result.lfu.evictions - result.lru.evictions}\n` +
      `Avg Latency (ms),${result.lru.avgGetLatencyMs},${result.lfu.avgGetLatencyMs},-\n` +
      `P95 Latency (ms),${result.lru.p95LatencyMs},${result.lfu.p95LatencyMs},-\n` +
      `Throughput (req/s),${result.lru.throughputReqSec},${result.lfu.throughputReqSec},-\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cachex_benchmark_${result.config.workloadType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const lruWon = result ? result.lru.hitRate > result.lfu.hitRate : false;
  const lfuWon = result ? result.lfu.hitRate > result.lru.hitRate : false;
  const isTie = result ? result.lru.hitRate === result.lfu.hitRate : false;

  return (
    <div className="space-y-6">
      {/* Benchmark configuration controls */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-3">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-amber-400" />
              LRU vs LFU Performance Benchmark Lab
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Subject both caching algorithms to identical synthetic workloads and measure hit rates, evictions, and tail latencies.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunBenchmark}
              disabled={isRunning}
              className="flex items-center gap-2 px-5 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
            >
              {isRunning ? <Cpu className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isRunning ? 'Running Benchmark...' : 'Run Benchmark'}</span>
            </button>

            {result && (
              <button
                onClick={downloadCsv}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs border border-slate-700 transition-colors"
                title="Download CSV report"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Workload presets selector */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-300 mb-2">Workload Access Model</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {[
              {
                id: 'zipfian' as WorkloadType,
                title: 'Zipfian / Hot-Cold',
                desc: '80% requests hit top 20% keys',
                icon: Flame,
                color: 'text-amber-400',
              },
              {
                id: 'cyclic' as WorkloadType,
                title: 'Cyclic Loop',
                desc: 'Pathological LRU thrashing',
                icon: Repeat,
                color: 'text-purple-400',
              },
              {
                id: 'sequential' as WorkloadType,
                title: 'Sequential Scan',
                desc: 'Streaming with low reuse',
                icon: TrendingUp,
                color: 'text-cyan-400',
              },
              {
                id: 'random' as WorkloadType,
                title: 'Uniform Random',
                desc: 'Pure stochastic distribution',
                icon: Shuffle,
                color: 'text-emerald-400',
              },
              {
                id: 'custom' as WorkloadType,
                title: 'Custom Sequence',
                desc: 'User-specified key loop',
                icon: Compass,
                color: 'text-indigo-400',
              },
            ].map(w => {
              const Icon = w.icon;
              const isSelected = workloadType === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => setWorkloadType(w.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'bg-slate-800 border-amber-500 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-200 mb-1">
                    <Icon className={`w-3.5 h-3.5 ${w.color}`} />
                    <span>{w.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">{w.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Workload Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-800 text-xs">
          <div className="space-y-1">
            <label className="font-medium text-slate-300 flex justify-between">
              <span>Total Requests</span>
              <span className="font-mono text-cyan-400 font-semibold">{requestCount.toLocaleString()}</span>
            </label>
            <div className="flex items-center gap-2">
              {[1000, 5000, 10000].map(cnt => (
                <button
                  key={cnt}
                  onClick={() => setRequestCount(cnt)}
                  className={`flex-1 py-1.5 rounded text-xs font-mono font-medium border transition-colors ${
                    requestCount === cnt
                      ? 'bg-amber-950/40 border-amber-500 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {cnt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-medium text-slate-300 flex justify-between">
              <span>Cache Capacity</span>
              <span className="font-mono text-cyan-400 font-semibold">{capacity} entries</span>
            </label>
            <div className="flex items-center gap-2">
              {[10, 50, 100, 200].map(cap => (
                <button
                  key={cap}
                  onClick={() => setCapacity(cap)}
                  className={`flex-1 py-1.5 rounded text-xs font-mono font-medium border transition-colors ${
                    capacity === cap
                      ? 'bg-amber-950/40 border-amber-500 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {cap}
                </button>
              ))}
            </div>
          </div>

          {workloadType === 'custom' && (
            <div className="space-y-1 sm:col-span-3">
              <label className="font-medium text-slate-300">Custom Sequence to Loop</label>
              <input
                type="text"
                value={customSequence}
                onChange={e => setCustomSequence(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono text-xs text-amber-300"
              />
            </div>
          )}
        </div>
      </div>

      {/* Benchmark Results Display */}
      {result && (
        <div className="space-y-6">
          {/* Winner Banner */}
          <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {isTie
                    ? 'Identical Hit Rates: Both Policies Performed Equally'
                    : lfuWon
                    ? `LFU Wins by +${(result.lfu.hitRate - result.lru.hitRate).toFixed(1)}% Higher Hit Rate`
                    : `LRU Wins by +${(result.lru.hitRate - result.lfu.hitRate).toFixed(1)}% Higher Hit Rate`}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Workload: <strong className="text-slate-200">{result.workloadName}</strong> ·{' '}
                  <span className="font-mono text-cyan-400">{result.config.requestCount.toLocaleString()} requests</span> across{' '}
                  <span className="font-mono text-cyan-400">{result.totalKeys} unique keys</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs">
              <div className="px-3 py-1.5 rounded bg-cyan-950/40 border border-cyan-800/60 text-cyan-300">
                LRU Hit Rate: <strong>{result.lru.hitRate}%</strong>
              </div>
              <div className="px-3 py-1.5 rounded bg-indigo-950/40 border border-indigo-800/60 text-indigo-300">
                LFU Hit Rate: <strong>{result.lfu.hitRate}%</strong>
              </div>
            </div>
          </div>

          {/* Side-by-side Head-to-Head Comparison Table */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Head-to-Head Comparison Matrix</h3>
              <span className="text-xs font-mono text-slate-500">All metrics calculated from actual test run</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                    <th className="py-2.5 px-4 font-medium">Metric</th>
                    <th className="py-2.5 px-4 font-medium text-cyan-300">LRU Policy</th>
                    <th className="py-2.5 px-4 font-medium text-indigo-300">LFU Policy</th>
                    <th className="py-2.5 px-4 font-medium text-right">Advantage / Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-400 font-sans">Total Requests</td>
                    <td className="py-3 px-4 font-semibold">{result.lru.totalRequests.toLocaleString()}</td>
                    <td className="py-3 px-4 font-semibold">{result.lfu.totalRequests.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-slate-500">Identical Workload</td>
                  </tr>

                  <tr className="hover:bg-slate-800/30 bg-slate-900/30">
                    <td className="py-3 px-4 text-slate-400 font-sans">Cache Hits</td>
                    <td className={`py-3 px-4 font-bold ${lruWon ? 'text-emerald-400' : ''}`}>
                      {result.lru.hits.toLocaleString()}
                    </td>
                    <td className={`py-3 px-4 font-bold ${lfuWon ? 'text-emerald-400' : ''}`}>
                      {result.lfu.hits.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-bold">
                      {result.lfu.hits - result.lru.hits > 0 ? (
                        <span className="text-indigo-400">LFU +{(result.lfu.hits - result.lru.hits).toLocaleString()}</span>
                      ) : result.lru.hits - result.lfu.hits > 0 ? (
                        <span className="text-cyan-400">LRU +{(result.lru.hits - result.lfu.hits).toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-500">Equal</span>
                      )}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-400 font-sans">Cache Misses</td>
                    <td className="py-3 px-4">{result.lru.misses.toLocaleString()}</td>
                    <td className="py-3 px-4">{result.lfu.misses.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-slate-400">
                      {result.lfu.misses < result.lru.misses
                        ? `LFU saved ${result.lru.misses - result.lfu.misses} misses`
                        : result.lru.misses < result.lfu.misses
                        ? `LRU saved ${result.lfu.misses - result.lru.misses} misses`
                        : 'Equal misses'}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/30 bg-amber-950/10">
                    <td className="py-3 px-4 font-bold text-amber-300 font-sans">Hit Rate</td>
                    <td className={`py-3 px-4 text-base font-bold ${lruWon ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {result.lru.hitRate}%
                    </td>
                    <td className={`py-3 px-4 text-base font-bold ${lfuWon ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {result.lfu.hitRate}%
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-bold">
                      {lfuWon ? (
                        <span className="text-indigo-400">LFU +{(result.lfu.hitRate - result.lru.hitRate).toFixed(2)}%</span>
                      ) : lruWon ? (
                        <span className="text-cyan-400">LRU +{(result.lru.hitRate - result.lfu.hitRate).toFixed(2)}%</span>
                      ) : (
                        <span className="text-slate-500">0.00%</span>
                      )}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-400 font-sans">Evictions Count</td>
                    <td className="py-3 px-4">{result.lru.evictions.toLocaleString()}</td>
                    <td className="py-3 px-4">{result.lfu.evictions.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-slate-400">
                      Δ {Math.abs(result.lru.evictions - result.lfu.evictions).toLocaleString()}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-400 font-sans">Avg GET Latency</td>
                    <td className="py-3 px-4">{result.lru.avgGetLatencyMs} ms</td>
                    <td className="py-3 px-4">{result.lfu.avgGetLatencyMs} ms</td>
                    <td className="py-3 px-4 text-right text-slate-400">O(1) operations</td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-400 font-sans">P95 Tail Latency</td>
                    <td className="py-3 px-4">{result.lru.p95LatencyMs} ms</td>
                    <td className="py-3 px-4">{result.lfu.p95LatencyMs} ms</td>
                    <td className="py-3 px-4 text-right text-slate-400">Sub-millisecond</td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-400 font-sans">Throughput (Req / Sec)</td>
                    <td className="py-3 px-4 text-cyan-300 font-semibold">{result.lru.throughputReqSec.toLocaleString()}</td>
                    <td className="py-3 px-4 text-indigo-300 font-semibold">{result.lfu.throughputReqSec.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-emerald-400">High concurrency</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Architectural Analysis Card */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              Systems Engineering Analysis & Architectural Tradeoffs
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {result.analysis}
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
              <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800 space-y-1">
                <span className="font-semibold text-cyan-300">When to choose LRU:</span>
                <p className="text-slate-400 text-[11px] leading-normal">
                  Optimal for workloads characterized by temporal locality and shifting working sets (e.g. user session tokens, news feeds). Adapts quickly when old keys fall out of favor without lingering frequency penalties.
                </p>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800 space-y-1">
                <span className="font-semibold text-indigo-300">When to choose LFU:</span>
                <p className="text-slate-400 text-[11px] leading-normal">
                  Optimal for static popularity distributions (e.g. product catalog lookups, CDN assets, DNS resolvers). Prevents sudden one-off scan requests from flushing the highest-value core database entries.
                </p>
              </div>
            </div>
          </div>

          {/* Access Frequency Histogram */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white">Workload Key Access Frequency Distribution</h3>
              <span className="text-xs text-slate-500 font-mono">Top 15 most requested keys</span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              {result.keyFrequencyDistribution.map((item: { key: string; count: number }, idx: number) => {
                const maxCount = result.keyFrequencyDistribution[0]?.count || 1;
                const percent = Math.round((item.count / maxCount) * 100);

                return (
                  <div key={item.key} className="flex items-center gap-3">
                    <span className="w-16 text-slate-400 text-right truncate">{item.key}</span>
                    <div className="flex-1 bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-slate-300 tabular-nums">{item.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
