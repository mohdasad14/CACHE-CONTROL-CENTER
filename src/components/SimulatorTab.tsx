/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { AccessPatternSimulator, SimulatorSnapshot } from '../engine/AccessPatternSimulator';
import { PolicyType } from '../types/cache';

export const SimulatorTab: React.FC = () => {
  const [patternInput, setPatternInput] = useState<string>('A, B, C, A, D, B, A, E, C');
  const [capacity, setCapacity] = useState<number>(3);
  const [policy, setPolicy] = useState<PolicyType>('LRU');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1 = 1000ms

  const simulatorRef = useRef<AccessPatternSimulator | null>(null);
  const [currentSnapshot, setCurrentSnapshot] = useState<SimulatorSnapshot | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [totalSteps, setTotalSteps] = useState<number>(0);

  // Initialize simulator
  useEffect(() => {
    const sim = new AccessPatternSimulator(patternInput, capacity, policy);
    simulatorRef.current = sim;
    setTotalSteps(sim.getTotalSteps());
    setCurrentStepIndex(-1);
    setCurrentSnapshot(null);
    setIsPlaying(false);
  }, [patternInput, capacity, policy]);

  // Auto-play loop
  useEffect(() => {
    let timer: number | null = null;
    if (isPlaying && simulatorRef.current) {
      const delay = Math.max(200, Math.floor(1000 / playbackSpeed));
      timer = window.setInterval(() => {
        if (!simulatorRef.current) return;
        if (simulatorRef.current.isFinished()) {
          setIsPlaying(false);
        } else {
          const snap = simulatorRef.current.stepForward();
          setCurrentSnapshot(snap);
          setCurrentStepIndex(simulatorRef.current.getCurrentStepIndex());
        }
      }, delay);
    }
    return () => {
      if (timer !== null) clearInterval(timer);
    };
  }, [isPlaying, playbackSpeed]);

  const handleStepForward = () => {
    if (!simulatorRef.current) return;
    setIsPlaying(false);
    const snap = simulatorRef.current.stepForward();
    setCurrentSnapshot(snap);
    setCurrentStepIndex(simulatorRef.current.getCurrentStepIndex());
  };

  const handleStepBackward = () => {
    if (!simulatorRef.current) return;
    setIsPlaying(false);
    const snap = simulatorRef.current.stepBackward();
    setCurrentSnapshot(snap);
    setCurrentStepIndex(simulatorRef.current.getCurrentStepIndex());
  };

  const handleReset = () => {
    if (!simulatorRef.current) return;
    setIsPlaying(false);
    simulatorRef.current.reset();
    setCurrentStepIndex(-1);
    setCurrentSnapshot(null);
  };

  const setPreset = (presetPattern: string, presetCap: number, presetPolicy: PolicyType) => {
    setIsPlaying(false);
    setPatternInput(presetPattern);
    setCapacity(presetCap);
    setPolicy(presetPolicy);
  };

  // Group items by frequency for LFU view
  const lfuBuckets = React.useMemo(() => {
    if (!currentSnapshot) return {};
    const buckets: Record<number, string[]> = {};
    for (const [key, freq] of Object.entries(currentSnapshot.frequencies)) {
      if (!buckets[freq]) buckets[freq] = [];
      buckets[freq].push(key);
    }
    return buckets;
  }, [currentSnapshot]);

  return (
    <div className="space-y-6">
      {/* Pattern configuration and preset cards */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Algorithm & Access Pattern Simulator
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Step through cache lookups, node shifts, and evictions with granular data structure visualization.
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-500 font-mono">Presets:</span>
            <button
              onClick={() => setPreset('A, B, C, A, D, B, A, E, C', 3, 'LRU')}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
            >
              Classic LRU
            </button>
            <button
              onClick={() => setPreset('A, B, C, A, A, D, B, A, C, E, A', 3, 'LFU')}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
            >
              Hot LFU Skew
            </button>
            <button
              onClick={() => setPreset('A, B, C, D, A, B, C, D', 3, 'LRU')}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
            >
              Cyclic Thrashing
            </button>
          </div>
        </div>

        {/* Input Parameters Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 text-xs">
          <div className="md:col-span-2 space-y-1">
            <label className="font-medium text-slate-300">Access Pattern Sequence</label>
            <input
              type="text"
              value={patternInput}
              onChange={e => setPatternInput(e.target.value)}
              placeholder="e.g. A, B, C, A, D, B, A, E, C"
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 font-mono text-cyan-300 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-slate-300 flex justify-between">
              <span>Capacity</span>
              <span className="font-mono text-cyan-400 font-semibold">{capacity} slots</span>
            </label>
            <input
              type="range"
              min="2"
              max="10"
              value={capacity}
              onChange={e => setCapacity(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2"
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-slate-300">Eviction Strategy</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPolicy('LRU')}
                className={`py-1.5 px-3 rounded-md font-medium text-xs border transition-colors ${
                  policy === 'LRU'
                    ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                LRU
              </button>
              <button
                type="button"
                onClick={() => setPolicy('LFU')}
                className={`py-1.5 px-3 rounded-md font-medium text-xs border transition-colors ${
                  policy === 'LFU'
                    ? 'bg-indigo-950/60 border-indigo-500 text-indigo-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                LFU
              </button>
            </div>
          </div>
        </div>

        {/* VCR Playback Controls Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleStepBackward}
              disabled={currentStepIndex <= -1}
              className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Step Backward"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-sm"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'Pause' : 'Play Simulation'}</span>
            </button>

            <button
              onClick={handleStepForward}
              disabled={simulatorRef.current?.isFinished()}
              className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Step Forward"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              onClick={handleReset}
              className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors ml-2"
              title="Reset Simulation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Speed selector */}
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Speed:</span>
            {[0.5, 1, 2, 4].map(s => (
              <button
                key={s}
                onClick={() => setPlaybackSpeed(s)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  playbackSpeed === s
                    ? 'bg-indigo-900/60 border border-indigo-700 text-indigo-300 font-bold'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Step Progress Ticker */}
          <div className="text-xs font-mono text-slate-400">
            Step:{' '}
            <strong className="text-white font-bold">
              {currentStepIndex >= 0 ? currentStepIndex + 1 : 0}
            </strong>{' '}
            / {totalSteps}
          </div>
        </div>
      </div>

      {/* Current Step Stage & Visual Explanation */}
      {currentSnapshot ? (
        <div
          className={`border rounded-lg p-5 transition-all duration-200 ${
            currentSnapshot.result === 'HIT'
              ? 'bg-emerald-950/20 border-emerald-800/80 shadow-[0_0_20px_rgba(16,185,129,0.06)]'
              : 'bg-slate-900/80 border-slate-800'
          }`}
        >
          {/* Top Stage Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400">
                REQUEST #{String(currentSnapshot.stepIndex + 1).padStart(2, '0')}:
              </span>
              <span className="font-mono text-base font-bold text-white bg-slate-800 px-3 py-1 rounded border border-slate-700">
                GET({currentSnapshot.requestKey})
              </span>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono ${
                  currentSnapshot.result === 'HIT'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                    : 'bg-rose-950 text-rose-400 border border-rose-700'
                }`}
              >
                {currentSnapshot.result === 'HIT' ? '✓ CACHE HIT' : '✗ CACHE MISS'}
              </span>
            </div>

            {/* Step Cumulative Metrics */}
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <span>
                Hits: <strong className="text-emerald-400 font-bold">{currentSnapshot.hits}</strong>
              </span>
              <span>
                Misses: <strong className="text-rose-400 font-bold">{currentSnapshot.misses}</strong>
              </span>
              <span>
                Hit Rate: <strong className="text-cyan-400 font-bold">{currentSnapshot.hitRate}%</strong>
              </span>
              <span>
                Evictions: <strong className="text-amber-400 font-bold">{currentSnapshot.evictions}</strong>
              </span>
            </div>
          </div>

          {/* Explanation narrative */}
          <div className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-950/50 p-3 rounded-md border border-slate-800">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-mono">{currentSnapshot.explanation}</p>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-lg p-8 text-center text-slate-400 text-xs">
          Click <strong>&quot;Play Simulation&quot;</strong> or <strong>&quot;Step Forward&quot;</strong> to begin visual algorithm execution.
        </div>
      )}

      {/* Visual Data Structure Representation */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              {policy === 'LRU'
                ? 'LRU Doubly-Linked List Visualizer'
                : 'LFU Frequency Buckets Visualizer'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {policy === 'LRU'
                ? 'Nodes are ordered from Head (MRU) to Tail (LRU). When an item is accessed, it moves to Head. When full, Tail is evicted.'
                : 'Items grouped into frequency sets. The lowest frequency bucket is evicted first, with FIFO/LRU tie-breaking.'}
            </p>
          </div>
          <span className="text-xs font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-800/60 px-2 py-0.5 rounded">
            Policy: {policy}
          </span>
        </div>

        {/* LRU Visualizer */}
        {policy === 'LRU' && (
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 overflow-x-auto">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-3 uppercase tracking-wider">
              <span className="text-emerald-400 font-bold">← MOST RECENTLY USED (HEAD)</span>
              <span className="text-amber-400 font-bold">LEAST RECENTLY USED (TAIL / EVICT) →</span>
            </div>

            {(!currentSnapshot || currentSnapshot.lruOrder.length === 0) ? (
              <div className="py-6 text-center text-slate-600 text-xs font-mono">
                [ Empty Doubly-Linked List ]
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-max py-2">
                {currentSnapshot.lruOrder.map((key, idx) => {
                  const isHead = idx === 0;
                  const isTail = idx === currentSnapshot.lruOrder.length - 1;
                  const isCurrentTarget = key === currentSnapshot.requestKey;
                  const isEvicted = key === currentSnapshot.evictedKey;

                  return (
                    <React.Fragment key={key}>
                      <div
                        className={`relative p-3.5 rounded-lg border flex flex-col items-center min-w-[90px] transition-all duration-300 ${
                          isCurrentTarget
                            ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] scale-105'
                            : isTail && currentSnapshot.lruOrder.length >= capacity
                            ? 'bg-amber-950/30 border-amber-600 text-amber-300'
                            : 'bg-slate-900 border-slate-700 text-slate-200'
                        }`}
                      >
                        <span className="text-lg font-bold font-mono">{key}</span>
                        <span className="text-[10px] font-mono text-slate-400 mt-1">
                          freq: {currentSnapshot.frequencies[key] || 1}
                        </span>
                        {isHead && (
                          <span className="text-[9px] font-mono uppercase text-emerald-400 mt-1 font-bold">
                            HEAD (MRU)
                          </span>
                        )}
                        {isTail && (
                          <span className="text-[9px] font-mono uppercase text-amber-400 mt-1 font-bold">
                            TAIL (LRU)
                          </span>
                        )}
                      </div>

                      {/* Bi-directional arrow representing Doubly Linked List */}
                      {idx < currentSnapshot.lruOrder.length - 1 && (
                        <div className="text-slate-600 font-mono text-xs flex flex-col items-center px-1">
                          <span>⇄</span>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* LFU Visualizer */}
        {policy === 'LFU' && (
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-3">
              <span className="text-amber-400 font-bold">MIN FREQUENCY: {currentSnapshot?.minFrequency || 0}</span>
              <span className="text-slate-400">Items inside each bucket ordered by insertion/recency</span>
            </div>

            {(!currentSnapshot || Object.keys(lfuBuckets).length === 0) ? (
              <div className="py-6 text-center text-slate-600 text-xs font-mono">
                [ Empty Frequency Table ]
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(lfuBuckets)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([freqStr, keys]) => {
                    const freqNum = Number(freqStr);
                    const isMinFreq = freqNum === currentSnapshot.minFrequency;

                    return (
                      <div
                        key={freqStr}
                        className={`p-3 rounded-lg border ${
                          isMinFreq
                            ? 'bg-amber-950/20 border-amber-800/80'
                            : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-mono pb-2 mb-2 border-b border-slate-800">
                          <span className="font-bold text-slate-200">{freqStr} Access{freqNum > 1 ? 'es' : ''}</span>
                          {isMinFreq && (
                            <span className="text-[10px] text-amber-400 font-bold bg-amber-950/60 px-1 rounded">
                              MIN FREQ
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {keys.map((k, i) => (
                            <div
                              key={k}
                              className={`px-3 py-1.5 rounded font-mono font-bold text-xs border ${
                                k === currentSnapshot.requestKey
                                  ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                                  : 'bg-slate-950 border-slate-700 text-slate-300'
                              }`}
                            >
                              {k}
                              {i === 0 && isMinFreq && (
                                <span className="block text-[8px] text-amber-400 uppercase">Candidate</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Access Pattern Sequence Strip */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
        <h4 className="text-xs font-semibold text-slate-300 mb-2 font-mono">Access Pattern Stream</h4>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {simulatorRef.current?.getPattern().map((key, idx) => {
            const isExecuted = idx <= currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div
                key={idx}
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold shrink-0 transition-all ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-md scale-110 border border-indigo-400'
                    : isExecuted
                    ? 'bg-slate-800 text-slate-300 border border-slate-700'
                    : 'bg-slate-950 text-slate-600 border border-slate-900'
                }`}
              >
                {key}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
