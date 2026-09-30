/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Target, AlertCircle } from 'lucide-react';

interface HitRateGaugeProps {
  hitRate: number;
  missRate: number;
}

export const HitRateGauge: React.FC<HitRateGaugeProps> = ({ hitRate, missRate }) => {
  const radius = 54;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  const hitStrokeDashoffset = circumference - (Math.min(100, Math.max(0, hitRate)) / 100) * circumference;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between h-full shadow-sm">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
          Hit / Miss Rate Gauge
        </h3>
        <span className="text-[11px] font-mono text-slate-500">Telemetry</span>
      </div>

      <div className="flex flex-col items-center justify-center my-3 relative">
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
          {/* Miss background circle */}
          <circle
            stroke="#F43F5E"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          {/* Hit foreground circle */}
          <circle
            stroke="#10B981"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{ strokeDashoffset: hitStrokeDashoffset, transition: 'stroke-dashoffset 0.5s ease' }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold font-mono text-white tabular-nums tracking-tight">
            {hitRate.toFixed(1)}%
          </span>
          <span className="text-[9px] font-mono uppercase text-emerald-400 font-bold tracking-wider">
            HIT RATE
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono pt-1">
        <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block">HIT RATE</span>
          <span className="text-emerald-400 font-bold">{hitRate.toFixed(1)}%</span>
        </div>
        <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block">MISS RATE</span>
          <span className="text-rose-400 font-bold">{missRate.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};
