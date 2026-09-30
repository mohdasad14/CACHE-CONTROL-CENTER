/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Clock } from 'lucide-react';

interface HitMissDonutChartProps {
  hits: number;
  misses: number;
  hitRate: number;
  missRate: number;
}

export const HitMissDonutChart: React.FC<HitMissDonutChartProps> = ({
  hits,
  misses,
  hitRate,
  missRate,
}) => {
  const total = hits + misses;
  const radius = 42;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  // Calculate arc lengths
  const hitRatio = total > 0 ? hits / total : 0;
  const missRatio = total > 0 ? misses / total : 0;

  const hitStrokeDash = `${hitRatio * circumference} ${circumference}`;
  const missStrokeDash = `${missRatio * circumference} ${circumference}`;
  const missOffset = -(hitRatio * circumference);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>HIT / MISS RATIO</span>
        </div>
        <span className="text-[11px] font-mono text-slate-500">Real-time distribution</span>
      </div>

      <div className="flex items-center justify-center my-3">
        <svg viewBox="0 0 120 120" className="w-28 h-28 transform -rotate-90">
          {/* Background Track */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="transparent"
            stroke="#1E293B"
            strokeWidth={strokeWidth}
          />

          {/* Miss Arc (Red) */}
          {misses > 0 && (
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="transparent"
              stroke="#F43F5E"
              strokeWidth={strokeWidth}
              strokeDasharray={missStrokeDash}
              strokeDashoffset={missOffset}
              strokeLinecap="butt"
              className="transition-all duration-300"
            />
          )}

          {/* Hit Arc (Green) */}
          {hits > 0 && (
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="transparent"
              stroke="#10B981"
              strokeWidth={strokeWidth}
              strokeDasharray={hitStrokeDash}
              strokeDashoffset="0"
              strokeLinecap="butt"
              className="transition-all duration-300"
            />
          )}
        </svg>
      </div>

      {/* Legend below donut */}
      <div className="flex items-center justify-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span className="text-slate-300">
            Hits: <strong>{hits}</strong> ({hitRate.toFixed(1)}%)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
          <span className="text-slate-300">
            Misses: <strong>{misses}</strong> ({missRate.toFixed(1)}%)
          </span>
        </div>
      </div>
    </div>
  );
};
