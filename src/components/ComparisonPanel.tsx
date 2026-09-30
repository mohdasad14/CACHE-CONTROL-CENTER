/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Layers, Compass } from 'lucide-react';
import { CacheEntryItem, EvictionPolicyType } from '../types/cache';

interface ComparisonPanelProps {
  entries: CacheEntryItem[];
  activePolicy: EvictionPolicyType;
}

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({ entries, activePolicy }) => {
  // Sort entries for LRU: by lastAccessed descending (most recent first)
  const lruSorted = [...entries].sort((a, b) => b.lastAccessed - a.lastAccessed);
  const lruCandidate = lruSorted.length > 0 ? lruSorted[lruSorted.length - 1].key : 'None';

  // Sort entries for LFU: by accessCount descending (highest frequency first)
  const lfuSorted = [...entries].sort((a, b) => b.accessCount - a.accessCount);
  const lfuCandidate = lfuSorted.length > 0 ? lfuSorted[lfuSorted.length - 1].key : 'None';

  const maxFreq = Math.max(1, ...entries.map(e => e.accessCount));

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            LRU vs LFU Eviction Strategy Comparison
          </h3>
        </div>
        <span className="text-xs font-mono text-cyan-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
          Active: {activePolicy}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        {/* LRU Box */}
        <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between font-bold">
            <span className="text-cyan-400 text-sm">LRU (Least Recently Used)</span>
            <span className="text-[10px] text-slate-500 font-sans">Focuses on recency</span>
          </div>

          <div className="space-y-2">
            {lruSorted.slice(0, 5).map((entry, idx) => (
              <div key={entry.key} className="flex items-center gap-3">
                <span className="w-16 text-white font-bold truncate">{entry.key}</span>
                <div className="flex-1 bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-cyan-500 h-full rounded-full"
                    style={{ width: `${Math.max(10, 100 - idx * 20)}%` }}
                  />
                </div>
                <span className="text-slate-400 text-[10px]">
                  {idx === 0 ? 'MRU (Head)' : idx === lruSorted.length - 1 ? 'LRU (Tail)' : `${idx + 1}`}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Eviction Candidate:</span>
            <span className="text-amber-400 font-bold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/60">
              {lruCandidate}
            </span>
          </div>
        </div>

        {/* LFU Box */}
        <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between font-bold">
            <span className="text-purple-400 text-sm">LFU (Least Frequently Used)</span>
            <span className="text-[10px] text-slate-500 font-sans">Focuses on frequency</span>
          </div>

          <div className="space-y-2">
            {lfuSorted.slice(0, 5).map((entry) => {
              const pct = Math.round((entry.accessCount / maxFreq) * 100);
              return (
                <div key={entry.key} className="flex items-center gap-3">
                  <span className="w-16 text-white font-bold truncate">{entry.key}</span>
                  <div className="flex-1 bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="bg-purple-500 h-full rounded-full"
                      style={{ width: `${Math.max(10, pct)}%` }}
                    />
                  </div>
                  <span className="text-slate-300 text-[11px] tabular-nums">{entry.accessCount} acc</span>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Eviction Candidate:</span>
            <span className="text-amber-400 font-bold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/60">
              {lfuCandidate}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
