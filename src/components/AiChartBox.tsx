/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  Activity,
  Layers,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Cpu,
  Zap,
  HelpCircle,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { CacheMetrics, TimelinePoint, PolicyType, CacheEntry } from '../types/cache';

interface AiDiagnosticResult {
  analysis: string;
  healthScore: number;
  policyRecommendation: PolicyType;
  policyReasoning?: string;
  recommendedCapacity: number;
  recommendedTtlSec: number;
  bottlenecks: string[];
  optimizations: string[];
}

interface AiChartBoxProps {
  metrics: CacheMetrics;
  timeline: TimelinePoint[];
  currentPolicy: PolicyType;
  entries: CacheEntry[];
  onApplyCapacity: (capacity: number) => void;
  onApplyPolicy: (policy: PolicyType) => void;
  onApplyTtl: (ttlSec: number) => void;
}

export type ChartMetricMode = 'hit_miss' | 'latency' | 'memory' | 'evictions';

export const AiChartBox: React.FC<AiChartBoxProps> = ({
  metrics,
  timeline,
  currentPolicy,
  entries,
  onApplyCapacity,
  onApplyPolicy,
  onApplyTtl,
}) => {
  const [chartMode, setChartMode] = useState<ChartMetricMode>('hit_miss');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [customQuestion, setCustomQuestion] = useState<string>('');
  const [aiResult, setAiResult] = useState<AiDiagnosticResult | null>(null);
  const [appliedAction, setAppliedAction] = useState<string | null>(null);

  // Auto-run initial AI diagnostic when component mounts or metrics change significantly
  const runAiAnalysis = async (userQuery?: string) => {
    setIsAiLoading(true);
    try {
      const entriesSummary = entries.slice(0, 8).map(e => ({
        key: e.key,
        accessCount: e.accessCount,
        ttlRemainingSec: e.expiresAt === Infinity ? 'Infinite' : Math.max(0, Math.ceil((e.expiresAt - Date.now()) / 1000)),
      }));

      const res = await fetch('/api/ai/analyze-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics,
          timeline,
          currentPolicy,
          entriesSummary,
          question: userQuery || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }

      const data: AiDiagnosticResult = await res.json();
      setAiResult(data);
    } catch (err) {
      console.warn('AI analysis call failed, applying client fallback heuristic:', err);
      // Heuristic fallback
      const isSkewed = entries.some(e => e.accessCount > 4);
      const isFull = metrics.activeEntries >= metrics.capacity;
      setAiResult({
        analysis: `Cache telemetry indicates a ${metrics.hitRate}% hit rate under the ${currentPolicy} eviction policy. ${
          isFull ? 'Capacity ceiling reached; eviction pressure is active.' : 'Memory capacity has headroom.'
        } ${isSkewed ? 'Noticeable frequency skew detected across key lookups.' : 'Lookups are evenly distributed.'}`,
        healthScore: Math.min(100, Math.max(30, Math.round(metrics.hitRate * 0.85 + 15))),
        policyRecommendation: isSkewed ? 'LFU' : 'LRU',
        policyReasoning: isSkewed
          ? 'High access frequency variance detected; LFU shields frequently requested hot entries.'
          : 'Uniform access patterns benefit from LRU recency tracking.',
        recommendedCapacity: Math.max(10, Math.round(metrics.capacity * 1.5)),
        recommendedTtlSec: 60,
        bottlenecks: metrics.missRate > 40 ? ['High miss rate under current workload'] : ['Nominal operational latency'],
        optimizations: [
          'Tune cache capacity to match active working set size',
          'Evaluate LFU policy if hot items show high frequency',
          'Ensure TTL expiration accommodates item freshness requirements',
        ],
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    // Run an initial analysis once timeline accumulates data
    if (!aiResult && timeline.length > 2) {
      runAiAnalysis();
    }
  }, [timeline.length]);

  const handleApplyPolicy = (pol: PolicyType) => {
    onApplyPolicy(pol);
    setAppliedAction(`Switched eviction policy to ${pol}`);
    setTimeout(() => setAppliedAction(null), 2500);
  };

  const handleApplyCapacity = (cap: number) => {
    onApplyCapacity(cap);
    setAppliedAction(`Adjusted capacity to ${cap} slots`);
    setTimeout(() => setAppliedAction(null), 2500);
  };

  const handleApplyTtl = (ttl: number) => {
    onApplyTtl(ttl);
    setAppliedAction(`Set default TTL to ${ttl} seconds`);
    setTimeout(() => setAppliedAction(null), 2500);
  };

  // SVG Chart Setup
  const width = 800;
  const height = 200;
  const padding = { top: 20, right: 25, bottom: 25, left: 45 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = timeline.length > 0 ? timeline : [
    { timestamp: Date.now(), hitRate: 0, missRate: 0, requests: 0, hits: 0, misses: 0, activeEntries: 0 }
  ];

  const getX = (idx: number) => {
    if (points.length <= 1) return padding.left;
    return padding.left + (idx / (points.length - 1)) * chartW;
  };

  // Normalized Y coordinate helper based on chart mode
  const getY = (val: number, maxVal: number = 100) => {
    const clamped = Math.max(0, Math.min(maxVal, val));
    return padding.top + chartH - (clamped / (maxVal || 1)) * chartH;
  };

  // Generate chart paths
  let primaryPath = '';
  let secondaryPath = '';
  let primaryArea = '';

  if (chartMode === 'hit_miss') {
    primaryPath = points.map((p, i) => `${getX(i)},${getY(p.hitRate, 100)}`).join(' ');
    secondaryPath = points.map((p, i) => `${getX(i)},${getY(p.missRate, 100)}`).join(' ');
    primaryArea = points.length > 1
      ? `${primaryPath} ${getX(points.length - 1)},${padding.top + chartH} ${getX(0)},${padding.top + chartH}`
      : '';
  } else if (chartMode === 'latency') {
    const maxLat = Math.max(5, ...points.map(p => metrics.avgGetLatencyMs * 1.5));
    primaryPath = points.map((p, i) => `${getX(i)},${getY(metrics.avgGetLatencyMs, maxLat)}`).join(' ');
    secondaryPath = points.map((p, i) => `${getX(i)},${getY(metrics.p95LatencyMs, maxLat)}`).join(' ');
  } else if (chartMode === 'memory') {
    const maxCap = Math.max(1, metrics.capacity);
    primaryPath = points.map((p, i) => `${getX(i)},${getY((p.activeEntries / maxCap) * 100, 100)}`).join(' ');
    primaryArea = points.length > 1
      ? `${primaryPath} ${getX(points.length - 1)},${padding.top + chartH} ${getX(0)},${padding.top + chartH}`
      : '';
  } else if (chartMode === 'evictions') {
    const maxEv = Math.max(10, metrics.evictions);
    primaryPath = points.map((p, i) => `${getX(i)},${getY(metrics.evictions, maxEv)}`).join(' ');
    secondaryPath = points.map((p, i) => `${getX(i)},${getY(metrics.expirations, maxEv)}`).join(' ');
  }

  const activePoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : points[points.length - 1];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg space-y-4 p-5">
      {/* Chart Box Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-950/70 border border-cyan-800/60 text-cyan-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Performance Chart Box with AI Analytics
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-300">
                AI Engine
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live multi-metric cache telemetry paired with automated systems architecture diagnostics.
            </p>
          </div>
        </div>

        {/* Chart View Mode Selector */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setChartMode('hit_miss')}
            className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
              chartMode === 'hit_miss'
                ? 'bg-slate-800 text-cyan-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Hit vs Miss Rate
          </button>

          <button
            onClick={() => setChartMode('latency')}
            className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
              chartMode === 'latency'
                ? 'bg-slate-800 text-violet-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tail Latency
          </button>

          <button
            onClick={() => setChartMode('memory')}
            className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
              chartMode === 'memory'
                ? 'bg-slate-800 text-emerald-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Memory Saturation
          </button>

          <button
            onClick={() => setChartMode('evictions')}
            className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
              chartMode === 'evictions'
                ? 'bg-slate-800 text-amber-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Evictions / TTL
          </button>
        </div>
      </div>

      {/* SVG Telemetry Chart Viewport */}
      <div className="relative bg-slate-950/60 rounded-lg border border-slate-800/80 p-3">
        {/* Dynamic Legend based on Chart Mode */}
        <div className="flex items-center justify-between text-xs font-mono mb-1 px-2">
          <div className="flex items-center gap-4">
            {chartMode === 'hit_miss' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span className="text-slate-300">Hit Rate ({metrics.hitRate}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <span className="text-slate-300">Miss Rate ({metrics.missRate}%)</span>
                </div>
              </>
            )}

            {chartMode === 'latency' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-400"></span>
                  <span className="text-slate-300">Avg Latency ({metrics.avgGetLatencyMs}ms)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <span className="text-slate-300">P95 Tail Latency ({metrics.p95LatencyMs}ms)</span>
                </div>
              </>
            )}

            {chartMode === 'memory' && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                <span className="text-slate-300">
                  RAM Saturation ({metrics.activeEntries} / {metrics.capacity} slots)
                </span>
              </div>
            )}

            {chartMode === 'evictions' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <span className="text-slate-300">Evictions ({metrics.evictions})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
                  <span className="text-slate-300">TTL Expirations ({metrics.expirations})</span>
                </div>
              </>
            )}
          </div>

          <div className="text-[11px] text-slate-500">
            {points.length} telemetry samples recorded
          </div>
        </div>

        {/* SVG Drawing */}
        <div className="w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-44 select-none cursor-crosshair"
            onMouseMove={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const xRatio = (e.clientX - rect.left) / rect.width;
              const svgX = xRatio * width;
              if (svgX >= padding.left && svgX <= width - padding.right && points.length > 0) {
                const idx = Math.round(((svgX - padding.left) / chartW) * (points.length - 1));
                setHoveredIndex(Math.max(0, Math.min(points.length - 1, idx)));
              }
            }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <defs>
              <linearGradient id="aiChartGradPrimary" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="aiChartGradCyan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 25, 50, 75, 100].map(val => {
              const y = getY(val, 100);
              return (
                <g key={val}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="#1E293B"
                    strokeWidth="1"
                    strokeDasharray={val === 0 || val === 100 ? undefined : '3,3'}
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="text-[10px] fill-slate-500 font-mono"
                  >
                    {val}%
                  </text>
                </g>
              );
            })}

            {/* Area Fill */}
            {primaryArea && (
              <polygon
                points={primaryArea}
                fill={chartMode === 'memory' ? 'url(#aiChartGradCyan)' : 'url(#aiChartGradPrimary)'}
              />
            )}

            {/* Secondary line (Miss rate / P95 / Expirations) */}
            {secondaryPath && (
              <polyline
                points={secondaryPath}
                fill="none"
                stroke={chartMode === 'latency' ? '#F59E0B' : chartMode === 'evictions' ? '#A855F7' : '#F43F5E'}
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Primary line */}
            {primaryPath && (
              <polyline
                points={primaryPath}
                fill="none"
                stroke={chartMode === 'latency' ? '#8B5CF6' : chartMode === 'memory' ? '#06B6D4' : '#10B981'}
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Hover indicator */}
            {hoveredIndex !== null && (
              <g>
                <line
                  x1={getX(hoveredIndex)}
                  y1={padding.top}
                  x2={getX(hoveredIndex)}
                  y2={padding.top + chartH}
                  stroke="#38BDF8"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* AI Systems Architect Diagnostic Panel */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              AI Cache Telemetry Diagnostic &amp; Tuning Insights
            </h4>
          </div>

          <div className="flex items-center gap-2">
            {appliedAction && (
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {appliedAction}
              </span>
            )}
            <button
              onClick={() => runAiAnalysis()}
              disabled={isAiLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
              <span>{isAiLoading ? 'Analyzing...' : 'Run AI Diagnostic'}</span>
            </button>
          </div>
        </div>

        {/* AI Health Score & Analysis Finding */}
        {aiResult ? (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Health Score Card */}
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Cache Health Score</span>
                  <span className="text-2xl font-bold font-mono text-cyan-300 tabular-nums">
                    {aiResult.healthScore} / 100
                  </span>
                </div>
                <div className="w-10 h-10 rounded-full bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center font-bold font-mono text-cyan-400">
                  {aiResult.healthScore}%
                </div>
              </div>

              {/* Policy Recommendation Card */}
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between md:col-span-2">
                <div>
                  <span className="text-[11px] text-slate-400 block">AI Recommended Policy</span>
                  <span className="text-sm font-bold font-mono text-white flex items-center gap-2 mt-0.5">
                    {aiResult.policyRecommendation} Policy
                    {aiResult.policyRecommendation !== currentPolicy ? (
                      <span className="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.2 rounded font-sans">
                        Switch Recommended
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded font-sans">
                        Currently Optimal
                      </span>
                    )}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">{aiResult.policyReasoning}</p>
                </div>
                {aiResult.policyRecommendation !== currentPolicy && (
                  <button
                    onClick={() => handleApplyPolicy(aiResult.policyRecommendation)}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold text-xs whitespace-nowrap transition-colors"
                  >
                    Switch to {aiResult.policyRecommendation}
                  </button>
                )}
              </div>

              {/* Sizing Recommendation Card */}
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Optimal Sizing</span>
                  <span className="text-sm font-bold font-mono text-emerald-400 mt-0.5 block">
                    {aiResult.recommendedCapacity} entries
                  </span>
                  <span className="text-[10px] text-slate-500">TTL: {aiResult.recommendedTtlSec}s</span>
                </div>
                {aiResult.recommendedCapacity !== metrics.capacity && (
                  <button
                    onClick={() => handleApplyCapacity(aiResult.recommendedCapacity)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium border border-slate-700 transition-colors"
                  >
                    Apply Size
                  </button>
                )}
              </div>
            </div>

            {/* Analysis Prose */}
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 text-slate-300 leading-relaxed font-sans">
              <span className="font-semibold text-cyan-300 mr-1.5">Architect Diagnosis:</span>
              {aiResult.analysis}
            </div>

            {/* Key Optimizations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 bg-slate-900/40 rounded border border-slate-800/60 space-y-1">
                <span className="font-semibold text-slate-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Recommended Optimizations
                </span>
                <ul className="list-disc list-inside text-slate-400 space-y-0.5">
                  {aiResult.optimizations.map((opt, i) => (
                    <li key={i}>{opt}</li>
                  ))}
                </ul>
              </div>

              <div className="p-2.5 bg-slate-900/40 rounded border border-slate-800/60 space-y-1">
                <span className="font-semibold text-slate-300 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Identified Bottlenecks
                </span>
                <ul className="list-disc list-inside text-slate-400 space-y-0.5">
                  {aiResult.bottlenecks.map((btn, i) => (
                    <li key={i}>{btn}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-slate-500 text-xs">
            {isAiLoading ? 'Analyzing cache chart patterns with Gemini AI...' : 'Click "Run AI Diagnostic" to generate intelligent systems analysis.'}
          </div>
        )}

        {/* Ask AI a Custom Question about the Chart or Cache */}
        <div className="pt-2 border-t border-slate-800/80">
          <form
            onSubmit={e => {
              e.preventDefault();
              if (customQuestion.trim()) {
                runAiAnalysis(customQuestion.trim());
              }
            }}
            className="flex items-center gap-2 text-xs"
          >
            <input
              type="text"
              value={customQuestion}
              onChange={e => setCustomQuestion(e.target.value)}
              placeholder="Ask AI: e.g. Why did the miss rate spike? Should I increase TTL for user sessions?"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs"
            />
            <button
              type="submit"
              disabled={isAiLoading || !customQuestion.trim()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold rounded-md border border-slate-700 transition-colors disabled:opacity-40"
            >
              Ask AI
            </button>
          </form>

          {/* Prompt Chips */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[11px] text-slate-500">
            <span>Quick Prompts:</span>
            {[
              'Why is LRU getting misses?',
              'Is capacity large enough for this pattern?',
              'Evaluate lock contention under traffic',
            ].map(q => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setCustomQuestion(q);
                  runAiAnalysis(q);
                }}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
