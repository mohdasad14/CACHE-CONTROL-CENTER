/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Table, Search, Trash2, Clock, Eye } from 'lucide-react';
import { CacheEntry } from '../types/cache';
import { soundManager } from '../services/soundEffects';
import { useToast } from './ToastNotification';

interface CacheEntriesTableProps {
  entries: CacheEntry[];
  onDeleteKey: (key: string) => void;
  onSelectEntry: (entry: CacheEntry) => void;
}

export const CacheEntriesTable: React.FC<CacheEntriesTableProps> = ({
  entries,
  onDeleteKey,
  onSelectEntry,
}) => {
  const [filterQuery, setFilterQuery] = useState<string>('');
  const { showToast } = useToast();

  const filtered = entries.filter(e =>
    String(e.key).toLowerCase().includes(filterQuery.toLowerCase()) ||
    String(e.value).toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Header bar */}
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Table className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            CACHE ENTRIES TABLE
          </h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-semibold border border-slate-700">
            {entries.length} items
          </span>
        </div>

        {/* Filter input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            placeholder="Filter keys..."
            className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Table grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-semibold tracking-wider text-[11px] uppercase">
              <th className="py-3 px-4">KEY</th>
              <th className="py-3 px-4">VALUE</th>
              <th className="py-3 px-4">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  TTL REMAINING
                </span>
              </th>
              <th className="py-3 px-4">STATUS</th>
              <th className="py-3 px-4"># ACCESS COUNT (FREQ)</th>
              <th className="py-3 px-4">LAST ACCESSED</th>
              <th className="py-3 px-4 text-center">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  {filterQuery ? 'No matching keys found.' : 'Cache is currently empty.'}
                </td>
              </tr>
            ) : (
              filtered.map(entry => {
                const now = Date.now();
                const isExpired = now >= entry.expiresAt;
                const remainingMs = entry.expiresAt === Infinity ? Infinity : Math.max(0, entry.expiresAt - now);
                const remainingSec = remainingMs === Infinity ? '∞ Infinite' : `${Math.ceil(remainingMs / 1000)}s`;
                const formattedLastAccess = new Date(entry.lastAccessTime).toLocaleTimeString();

                return (
                  <tr
                    key={entry.key}
                    className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                    onClick={() => onSelectEntry(entry)}
                  >
                    {/* KEY */}
                    <td className="py-2.5 px-4 font-bold text-cyan-400 group-hover:text-cyan-300">
                      {entry.key}
                    </td>

                    {/* VALUE */}
                    <td className="py-2.5 px-4 text-slate-300 truncate max-w-[200px]">
                      {typeof entry.value === 'object' ? JSON.stringify(entry.value) : String(entry.value)}
                    </td>

                    {/* TTL REMAINING */}
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[11px]">
                        {remainingSec}
                      </span>
                    </td>

                    {/* STATUS */}
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isExpired
                            ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                        }`}
                      >
                        {isExpired ? 'EXPIRED' : 'ACTIVE'}
                      </span>
                    </td>

                    {/* ACCESS COUNT */}
                    <td className="py-2.5 px-4 font-bold tabular-nums text-slate-100">
                      {entry.accessCount}
                    </td>

                    {/* LAST ACCESSED */}
                    <td className="py-2.5 px-4 text-slate-400 text-[11px] tabular-nums">
                      {formattedLastAccess}
                    </td>

                    {/* ACTION */}
                    <td
                      className="py-2.5 px-4 text-center"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          onDeleteKey(entry.key);
                          soundManager.playDelete();
                          showToast('warning', `Evicted Key: ${entry.key}`, 'Removed from cache entries table.');
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                        title="Evict Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
