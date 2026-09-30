/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Table, Search, Trash2, Clock, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { CacheEntryItem } from '../types/cache';
import { cacheApi } from '../services/cacheApi';
import { soundManager } from '../services/soundEffects';
import { useToast } from './ToastNotification';

interface CacheTableProps {
  entries: CacheEntryItem[];
  onRefresh: () => void;
  onEntryDeleted: (key: string) => void;
}

export const CacheTable: React.FC<CacheTableProps> = ({
  entries,
  onRefresh,
  onEntryDeleted,
}) => {
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [sortField, setSortField] = useState<'key' | 'accessCount' | 'ttl'>('key');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const { showToast } = useToast();

  // Local timestamp for live countdown calculation
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 100); // 100ms smooth countdown
    return () => clearInterval(timer);
  }, []);

  const handleDelete = async (key: string) => {
    soundManager.playDelete();
    try {
      await cacheApi.deleteEntry(key);
      showToast('warning', `Deleted Key: "${key}"`, 'Entry removed from cache.');
      onEntryDeleted(key);
      onRefresh();
    } catch (err: any) {
      showToast('error', 'Delete Failed', err.message);
    }
  };

  const handleClearCache = async () => {
    setIsClearing(true);
    soundManager.playDelete();
    try {
      await cacheApi.clearCache();
      showToast('warning', 'Cache Cleared', 'All entries have been removed from the backend.');
      setShowClearConfirm(false);
      onRefresh();
    } catch (err: any) {
      showToast('error', 'Clear Cache Failed', err.message);
    } finally {
      setIsClearing(false);
    }
  };

  const toggleSort = (field: 'key' | 'accessCount' | 'ttl') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filtered = entries
    .filter(e =>
      e.key.toLowerCase().includes(filterQuery.toLowerCase()) ||
      e.value.toLowerCase().includes(filterQuery.toLowerCase())
    )
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'key') {
        cmp = a.key.localeCompare(b.key);
      } else if (sortField === 'accessCount') {
        cmp = a.accessCount - b.accessCount;
      } else if (sortField === 'ttl') {
        const ttlA = a.remainingTtlMillis > 0 ? a.remainingTtlMillis : Infinity;
        const ttlB = b.remainingTtlMillis > 0 ? b.remainingTtlMillis : Infinity;
        cmp = ttlA - ttlB;
      }
      return sortAsc ? cmp : -cmp;
    });

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm space-y-0">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Table className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Cache Entries Table
          </h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-semibold border border-slate-700">
            {entries.length} items
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Filter Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              placeholder="Search by key or value..."
              className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Clear Cache Button */}
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 rounded-md text-xs font-medium border border-rose-800/60 transition-colors whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Cache</span>
          </button>
        </div>
      </div>

      {/* Clear Cache Confirmation Dialog */}
      {showClearConfirm && (
        <div className="p-3 bg-rose-950/80 border-b border-rose-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-rose-200 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Clear all cached entries from the backend?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleClearCache}
              disabled={isClearing}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold"
            >
              {isClearing ? 'Clearing...' : 'Clear Cache'}
            </button>
          </div>
        </div>
      )}

      {/* Table Data */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              <th
                onClick={() => toggleSort('key')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>KEY</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-600" />
                </div>
              </th>
              <th className="py-3 px-4">VALUE</th>
              <th
                onClick={() => toggleSort('accessCount')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>ACCESS COUNT</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-600" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('ttl')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>REMAINING TTL</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-600" />
                </div>
              </th>
              <th className="py-3 px-4">STATUS</th>
              <th className="py-3 px-4 text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                  {filterQuery ? 'No matching entries found.' : 'No entries currently in cache.'}
                </td>
              </tr>
            ) : (
              filtered.map(entry => {
                // Live countdown calculation
                const isInfinite = entry.remainingTtlMillis === -1 || entry.remainingTtlMillis === undefined;
                let remainingSecStr = '∞ Infinite';
                let isExpired = entry.status === 'EXPIRED';

                if (!isInfinite && entry.remainingTtlMillis > 0) {
                  const remSec = (entry.remainingTtlMillis / 1000);
                  if (remSec <= 0) {
                    isExpired = true;
                    remainingSecStr = 'EXPIRED';
                  } else {
                    remainingSecStr = `${remSec.toFixed(1)}s`;
                  }
                }

                return (
                  <tr
                    key={entry.key}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      isExpired ? 'opacity-50 bg-rose-950/10' : ''
                    }`}
                  >
                    {/* KEY */}
                    <td className="py-2.5 px-4 font-bold text-cyan-400">
                      {entry.key}
                    </td>

                    {/* VALUE */}
                    <td className="py-2.5 px-4 text-slate-300 max-w-[200px] truncate">
                      {entry.value}
                    </td>

                    {/* ACCESS COUNT */}
                    <td className="py-2.5 px-4 font-bold tabular-nums text-slate-100">
                      {entry.accessCount}
                    </td>

                    {/* REMAINING TTL */}
                    <td className="py-2.5 px-4 font-semibold">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] tabular-nums ${
                          isExpired
                            ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                            : isInfinite
                            ? 'bg-slate-950 text-slate-400 border border-slate-800'
                            : 'bg-slate-950 text-cyan-300 border border-slate-800'
                        }`}
                      >
                        {remainingSecStr}
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

                    {/* ACTIONS */}
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => handleDelete(entry.key)}
                        className="px-2 py-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors text-[11px]"
                      >
                        Delete
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
