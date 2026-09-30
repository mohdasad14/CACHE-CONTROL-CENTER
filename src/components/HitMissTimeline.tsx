/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TimelinePoint } from '../types/cache';

interface HitMissTimelineProps {
  timeline: TimelinePoint[];
}

export const HitMissTimeline: React.FC<HitMissTimelineProps> = ({ timeline }) => {
  const [hoveredPoint, setHoveredPoint] = useState<TimelinePoint | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const width = 800;
  const height = 180;
  const padding = { top: 15, right: 20, bottom: 25, left: 45 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = timeline.length > 0 ? timeline : [
    { timestamp: Date.now(), hitRate: 0, missRate: 0, requests: 0, hits: 0, misses: 0, activeEntries: 0 }
  ];

  // Convert timeline data points to SVG coordinates
  const getX = (index: number) => {
    if (points.length <= 1) return padding.left;
    return padding.left + (index / (points.length - 1)) * chartWidth;
  };

  const getY = (valPercent: number) => {
    const clamped = Math.max(0, Math.min(100, valPercent));
    return padding.top + chartHeight - (clamped / 100) * chartHeight;
  };

  const hitPointsStr = points.map((p, idx) => `${getX(idx)},${getY(p.hitRate)}`).join(' ');
  const missPointsStr = points.map((p, idx) => `${getX(idx)},${getY(p.missRate)}`).join(' ');

  const hitAreaStr = points.length > 1
    ? `${hitPointsStr} ${getX(points.length - 1)},${padding.top + chartHeight} ${getX(0)},${padding.top + chartHeight}`
    : '';

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const svgX = xRatio * width;

    if (svgX < padding.left || svgX > width - padding.right || points.length === 0) {
      setHoveredPoint(null);
      setHoverX(null);
      return;
    }

    const index = Math.round(((svgX - padding.left) / chartWidth) * (points.length - 1));
    const safeIndex = Math.max(0, Math.min(points.length - 1, index));
    setHoveredPoint(points[safeIndex]);
    setHoverX(getX(safeIndex));
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setHoverX(null);
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 relative">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-200">Hit / Miss Rate Timeline</h3>
          <span className="text-xs text-slate-500 font-mono">Live 60-slice window</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-slate-300">Hit Rate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="text-slate-300">Miss Rate</span>
          </div>
          {hoveredPoint && (
            <div className="text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              <span className="text-emerald-400 font-semibold">{hoveredPoint.hitRate}%</span> /{' '}
              <span className="text-rose-400 font-semibold">{hoveredPoint.missRate}%</span>
              <span className="text-slate-500 ml-1.5">({hoveredPoint.requests} reqs)</span>
            </div>
          )}
        </div>
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="hitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(val => {
            const y = getY(val);
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

          {/* Area fill for Hit Rate */}
          {hitAreaStr && (
            <polygon points={hitAreaStr} fill="url(#hitGradient)" />
          )}

          {/* Lines */}
          {points.length > 1 && (
            <>
              {/* Miss Rate Line */}
              <polyline
                points={missPointsStr}
                fill="none"
                stroke="#F43F5E"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Hit Rate Line */}
              <polyline
                points={hitPointsStr}
                fill="none"
                stroke="#10B981"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Points on line */}
          {points.map((p, idx) => {
            const x = getX(idx);
            return (
              <g key={idx}>
                <circle
                  cx={x}
                  cy={getY(p.hitRate)}
                  r="2"
                  fill="#10B981"
                  className="opacity-70"
                />
              </g>
            );
          })}

          {/* Hover crosshair */}
          {hoverX !== null && hoveredPoint && (
            <g>
              <line
                x1={hoverX}
                y1={padding.top}
                x2={hoverX}
                y2={padding.top + chartHeight}
                stroke="#38BDF8"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              <circle
                cx={hoverX}
                cy={getY(hoveredPoint.hitRate)}
                r="4"
                fill="#10B981"
                stroke="#0F172A"
                strokeWidth="2"
              />
              <circle
                cx={hoverX}
                cy={getY(hoveredPoint.missRate)}
                r="4"
                fill="#F43F5E"
                stroke="#0F172A"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
