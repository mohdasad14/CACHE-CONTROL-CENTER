/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { soundManager } from '../services/soundEffects';
import { useToast } from './ToastNotification';

export interface TraceStep {
  step: number;
  op: 'PUT' | 'GET';
  key: string;
  result: 'HIT' | 'MISS' | 'STORED' | 'EVICTION & STORED';
  details: string;
}

export const SampleAccessPatternDemo: React.FC = () => {
  const [showTrace, setShowTrace] = useState<boolean>(true);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const { showToast } = useToast();

  const [stats, setStats] = useState({
    totalOps: 13,
    hits: 6,
    misses: 2,
    hitRate: 75,
    missRate: 25,
    evictions: 2,
    finalSize: 3,
  });

  const traceSteps: TraceStep[] = [
    { step: 1, op: 'PUT', key: 'A', result: 'STORED', details: 'Inserted key A into empty cache slot.' },
    { step: 2, op: 'PUT', key: 'B', result: 'STORED', details: 'Inserted key B into cache (slots 2/3).' },
    { step: 3, op: 'PUT', key: 'C', result: 'STORED', details: 'Inserted key C. Cache reached full capacity (3/3).' },
    { step: 4, op: 'GET', key: 'A', result: 'HIT', details: 'Cache hit for A. Promoted to MRU head.' },
    { step: 5, op: 'GET', key: 'B', result: 'HIT', details: 'Cache hit for B. Promoted to MRU head.' },
    { step: 6, op: 'GET', key: 'A', result: 'HIT', details: 'Cache hit for A.' },
    { step: 7, op: 'PUT', key: 'D', result: 'EVICTION & STORED', details: 'Cache full. Evicted key C (Least Recently Used). Inserted D.' },
    { step: 8, op: 'GET', key: 'C', result: 'MISS', details: 'Cache miss for evicted key C (Reason: NOT_FOUND)' },
    { step: 9, op: 'GET', key: 'A', result: 'HIT', details: 'Cache hit for A.' },
    { step: 10, op: 'GET', key: 'D', result: 'HIT', details: 'Cache hit for D.' },
    { step: 11, op: 'PUT', key: 'E', result: 'EVICTION & STORED', details: 'Cache full. Evicted next victim. Inserted E.' },
    { step: 12, op: 'GET', key: 'B', result: 'MISS', details: 'Looked up key B: MISS' },
    { step: 13, op: 'GET', key: 'E', result: 'HIT', details: 'Cache hit for E.' },
  ];

  const handleRun = async () => {
    setIsRunning(true);
    soundManager.playHit();
    showToast('info', 'Running Sample Access Pattern', 'Executing deterministic workload of 13 operations...');

    // Simulate animated execution
    await new Promise(r => setTimeout(r, 400));
    soundManager.playStressTestComplete();
    setIsRunning(false);
    showToast('success', 'Access Pattern Completed', '13 operations evaluated: 6 hits, 2 misses (75% hit rate)');
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 text-xs">
              ▶
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              SAMPLE ACCESS PATTERN DEMO
            </h3>
          </div>
          <p className="text-xs text-slate-400 font-sans">
            Executes deterministic workload: <span className="font-mono text-cyan-300">PUT [A, B, C], GET A, GET B, GET A, PUT D (forces eviction), GET C (miss), GET A, GET D, PUT E.</span>
          </p>
        </div>

        <button
          onClick={handleRun}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs tracking-wider transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap self-start sm:self-auto"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isRunning ? 'EXECUTING...' : 'RUN SAMPLE ACCESS PATTERN'}</span>
        </button>
      </div>

      {/* 7 Stat Boxes Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 font-mono text-xs">
        <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase block font-semibold">TOTAL OPERATIONS</span>
          <span className="text-xl font-bold text-white mt-1 block">{stats.totalOps}</span>
        </div>

        <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase block font-semibold">HITS</span>
          <span className="text-xl font-bold text-emerald-400 mt-1 block">{stats.hits}</span>
        </div>

        <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase block font-semibold">MISSES</span>
          <span className="text-xl font-bold text-rose-400 mt-1 block">{stats.misses}</span>
        </div>

        <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase block font-semibold">HIT RATE</span>
          <span className="text-xl font-bold text-cyan-400 mt-1 block">{stats.hitRate}%</span>
        </div>

        <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase block font-semibold">MISS RATE</span>
          <span className="text-xl font-bold text-amber-400 mt-1 block">{stats.missRate}%</span>
        </div>

        <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase block font-semibold">EVICTIONS</span>
          <span className="text-xl font-bold text-purple-400 mt-1 block">{stats.evictions}</span>
        </div>

        <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase block font-semibold">FINAL SIZE</span>
          <span className="text-xl font-bold text-cyan-300 mt-1 block">{stats.finalSize}</span>
        </div>
      </div>

      {/* Trace Accordion Header */}
      <div className="pt-2">
        <div
          onClick={() => setShowTrace(!showTrace)}
          className="flex items-center justify-between py-2 text-xs font-semibold text-slate-300 cursor-pointer hover:text-white select-none"
        >
          <span className="flex items-center gap-2">
            <span className="font-mono text-cyan-400">|i|</span>
            Step-by-Step Execution Trace
          </span>
          <button className="flex items-center gap-1 text-[11px] text-cyan-400 font-mono">
            {showTrace ? <><ChevronUp className="w-3.5 h-3.5" /> Hide Trace</> : <><ChevronDown className="w-3.5 h-3.5" /> Show Trace</>}
          </button>
        </div>

        {/* Trace rows */}
        {showTrace && (
          <div className="space-y-1.5 font-mono text-xs max-h-80 overflow-y-auto pr-1 mt-2">
            {traceSteps.map(step => {
              let badgeColor = 'bg-slate-800 text-slate-300';
              if (step.result === 'HIT') badgeColor = 'bg-emerald-950 text-emerald-400 border border-emerald-800/60';
              if (step.result === 'MISS') badgeColor = 'bg-rose-950 text-rose-400 border border-rose-800/60';
              if (step.result === 'STORED') badgeColor = 'bg-cyan-950 text-cyan-400 border border-cyan-800/60';
              if (step.result === 'EVICTION & STORED') badgeColor = 'bg-purple-950 text-purple-400 border border-purple-800/60';

              return (
                <div
                  key={step.step}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-slate-500 text-[11px] w-6 shrink-0 font-bold">#{step.step}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-cyan-300 font-bold text-[11px] shrink-0 border border-slate-800">
                      {step.op}
                    </span>
                    <span className="text-white font-bold text-xs w-4 shrink-0">{step.key}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${badgeColor}`}>
                      {step.result}
                    </span>
                    <span className="text-slate-400 text-xs truncate font-sans">
                      {step.details}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
