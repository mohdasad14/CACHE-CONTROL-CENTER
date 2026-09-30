/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HardDrive } from 'lucide-react';

interface CacheUsageProps {
  currentSize: number;
  capacity: number;
}

export const CacheUsage: React.FC<CacheUsageProps> = ({ currentSize, capacity }) => {
  const percent = capacity > 0 ? Math.min(100, Math.round((currentSize / capacity) * 100)) : 0;

  let statusText = 'Low Usage';
  let barColor = 'bg-emerald-500';
  let badgeColor = 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60';

  if (percent >= 100) {
    statusText = 'Full (Eviction Active)';
    barColor = 'bg-rose-500';
    badgeColor = 'text-rose-400 bg-rose-950/60 border-rose-800/60';
  } else if (percent >= 80) {
    statusText = 'Nearly Full';
    barColor = 'bg-amber-500';
    badgeColor = 'text-amber-400 bg-amber-950/60 border-amber-800/60';
  } else if (percent >= 40) {
    statusText = 'Moderate Usage';
    barColor = 'bg-cyan-500';
    badgeColor = 'text-cyan-400 bg-cyan-950/60 border-cyan-800/60';
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between h-full shadow-sm">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-xs text-slate-200">
          <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
          <span>CACHE USAGE</span>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeColor}`}>
          {statusText}
        </span>
      </div>

      <div className="my-3 space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-3xl font-bold text-white tabular-nums">{currentSize}</span>
            <span className="text-slate-400 text-sm">/ {capacity}</span>
          </div>
          <span className="text-xl font-bold font-mono text-cyan-400 tabular-nums">
            {percent}%
          </span>
        </div>

        {/* Visual progress bar */}
        <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between pt-1">
        <span>{capacity - currentSize} slots available</span>
        <span>RAM In-Memory</span>
      </div>
    </div>
  );
};
