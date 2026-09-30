/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, CheckCircle2, Layers, AlertCircle } from 'lucide-react';
import { EvictionPolicyType, DemoResponse } from '../types/cache';
import { cacheApi } from '../services/cacheApi';
import { soundManager } from '../services/soundEffects';
import { useToast } from './ToastNotification';

interface DemoPanelProps {
  currentPolicy: EvictionPolicyType;
  onDemoCompleted: () => void;
}

export const DemoPanel: React.FC<DemoPanelProps> = ({ currentPolicy, onDemoCompleted }) => {
  const [selectedPolicy, setSelectedPolicy] = useState<EvictionPolicyType>(currentPolicy);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [demoResult, setDemoResult] = useState<DemoResponse | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const { showToast } = useToast();

  const handleRunDemo = async () => {
    setIsRunning(true);
    setActiveStepIndex(-1);
    setDemoResult(null);
    soundManager.playHit();

    try {
      // Call real backend endpoint
      const result = await cacheApi.runDemo(selectedPolicy);
      setDemoResult(result);

      // Animate step by step
      for (let i = 0; i < result.operations.length; i++) {
        setActiveStepIndex(i);
        const op = result.operations[i];
        if (op.result === 'HIT') soundManager.playHit();
        else if (op.result === 'MISS') soundManager.playMiss();
        else if (op.result === 'EVICTED') soundManager.playDelete();
        else soundManager.playPut();

        await new Promise(r => setTimeout(r, 450));
      }

      soundManager.playStressTestComplete();
      showToast('success', 'Demo Execution Completed', `Backend evicted: "${result.evicted}" under ${result.policy} policy.`);
      onDemoCompleted();
    } catch (err: any) {
      showToast('error', 'Demo Execution Failed', err.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            EVICTION STRATEGY DEMO
          </h3>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Executes deterministic access workload against backend: <span className="font-mono text-cyan-300">PUT A, PUT B, PUT C, GET A, GET A, GET B, PUT D</span>
          </p>
        </div>

        {/* Policy Selector + Run Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setSelectedPolicy('LRU')}
              disabled={isRunning}
              className={`px-3 py-1 rounded font-bold transition-all ${
                selectedPolicy === 'LRU'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              LRU
            </button>
            <button
              onClick={() => setSelectedPolicy('LFU')}
              disabled={isRunning}
              className={`px-3 py-1 rounded font-bold transition-all ${
                selectedPolicy === 'LFU'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              LFU
            </button>
          </div>

          <button
            onClick={handleRunDemo}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs tracking-wider transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isRunning ? 'RUNNING DEMO...' : '▶ RUN SAMPLE'}</span>
          </button>
        </div>
      </div>

      {/* Demo Results & Step-by-Step Visualization */}
      {demoResult && (
        <div className="space-y-3 font-mono text-xs">
          {/* Result Banner */}
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-200">
                Final Result under <strong>{demoResult.policy}</strong>:
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-bold border border-purple-800/60">
                Evicted: {demoResult.evicted || 'None'}
              </span>
            </div>
            <div className="text-slate-400 text-[11px]">
              Retained in Cache: [ {demoResult.finalEntries.join(', ')} ]
            </div>
          </div>

          {/* Operation sequence badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {demoResult.operations.map((op, idx) => {
              const isCurrent = idx === activeStepIndex;
              const isDone = idx <= activeStepIndex;

              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    isCurrent
                      ? 'bg-cyan-950/80 border-cyan-400 scale-105 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                      : isDone
                      ? 'bg-slate-950 border-slate-700 text-slate-200'
                      : 'bg-slate-950/40 border-slate-900 text-slate-600'
                  }`}
                >
                  <div className="text-[10px] text-slate-500 font-bold">Step {op.step}</div>
                  <div className="text-xs font-bold text-white my-0.5">
                    {op.op} {op.key}
                  </div>
                  <div
                    className={`text-[9px] font-bold ${
                      op.result === 'HIT'
                        ? 'text-emerald-400'
                        : op.result === 'EVICTED'
                        ? 'text-purple-400'
                        : 'text-cyan-400'
                    }`}
                  >
                    {op.result}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
