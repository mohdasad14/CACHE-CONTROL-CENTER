/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Terminal } from 'lucide-react';
import { ActivityEvent } from '../types/cache';

interface ActivityLogProps {
  events: ActivityEvent[];
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ events }) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between h-full shadow-sm">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Live Cache Activity Log
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-500">Latest {events.length} events</span>
      </div>

      <div className="my-2 space-y-1 font-mono text-xs max-h-52 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs font-sans">
            No cache operations observed yet. Issue a GET or PUT to see live telemetry.
          </div>
        ) : (
          events.map(evt => {
            let badgeCol = 'text-slate-400 bg-slate-800';
            if (evt.type === 'GET') {
              badgeCol = evt.result?.includes('HIT')
                ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/60'
                : 'text-rose-400 bg-rose-950/60 border border-rose-800/60';
            } else if (evt.type === 'PUT') {
              badgeCol = 'text-cyan-400 bg-cyan-950/60 border border-cyan-800/60';
            } else if (evt.type === 'DELETE' || evt.type === 'EVICTION') {
              badgeCol = 'text-purple-400 bg-purple-950/60 border border-purple-800/60';
            } else if (evt.type === 'TTL') {
              badgeCol = 'text-amber-400 bg-amber-950/60 border border-amber-800/60';
            }

            return (
              <div
                key={evt.id}
                className="flex items-center justify-between p-1.5 rounded hover:bg-slate-800/40 text-[11px] transition-colors"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-slate-500 text-[10px] shrink-0">{evt.timeStr}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${badgeCol}`}>
                    {evt.type}
                  </span>
                  <span className="text-white font-semibold truncate max-w-[120px]">
                    {evt.key || '—'}
                  </span>
                  {evt.result && (
                    <span className="text-slate-400 text-[10px] truncate max-w-[140px]">
                      {evt.result}
                    </span>
                  )}
                </div>

                {evt.latencyMs !== undefined && (
                  <span className="text-slate-500 text-[10px] shrink-0 font-mono">
                    {evt.latencyMs}ms
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
