/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { X, Clock, Layers, Hash, Calendar, ShieldCheck, Database, Trash2 } from 'lucide-react';
import { CacheEntry, PolicyType } from '../types/cache';

interface EntryInspectorModalProps {
  entry: CacheEntry | null;
  onClose: () => void;
  onDeleteKey?: (key: string) => void;
  policy: PolicyType;
  isEvictionCandidate: boolean;
}

export const EntryInspectorModal: React.FC<EntryInspectorModalProps> = ({
  entry,
  onClose,
  onDeleteKey,
  policy,
  isEvictionCandidate,
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!entry) return;
    const interval = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(interval);
  }, [entry]);

  if (!entry) return null;

  const isExpired = now >= entry.expiresAt;
  const remainingMs = entry.expiresAt === Infinity ? Infinity : Math.max(0, entry.expiresAt - now);
  const remainingSec = remainingMs === Infinity ? 'Infinity' : (remainingMs / 1000).toFixed(1);
  const totalTtlSec = entry.ttlMs > 0 ? (entry.ttlMs / 1000).toFixed(0) : '∞';

  const ttlProgress = entry.ttlMs > 0 && remainingMs !== Infinity
    ? Math.max(0, Math.min(100, (remainingMs / entry.ttlMs) * 100))
    : 100;

  const formattedCreated = new Date(entry.createdAt).toLocaleTimeString();
  const formattedLastAccess = new Date(entry.lastAccessTime).toLocaleTimeString();
  const formattedExpires = entry.expiresAt === Infinity ? 'Never (No TTL)' : new Date(entry.expiresAt).toLocaleTimeString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-cyan-400" />
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Cache Entry Inspector
              </h2>
              <span className="text-xs font-mono text-cyan-400">{entry.key}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 space-y-4 text-sm">
          {/* Status banner */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/60 border border-slate-700/50">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isExpired
                    ? 'bg-rose-500'
                    : isEvictionCandidate
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-emerald-500'
                }`}
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                {isExpired
                  ? 'Expired (Pending Invalidation)'
                  : isEvictionCandidate
                  ? `Next Eviction Candidate (${policy})`
                  : 'Active In-Memory Slot'}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              RAM: {entry.sizeBytes} bytes
            </span>
          </div>

          {/* TTL Countdown Gauge */}
          <div className="space-y-1.5 bg-slate-950/50 p-3.5 rounded-lg border border-slate-800">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Time To Live (TTL) Countdown
              </span>
              <span className="font-mono font-semibold text-cyan-300 tabular-nums">
                {remainingSec}s / {totalTtlSec}s
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-200 rounded-full ${
                  ttlProgress < 20 ? 'bg-rose-500' : ttlProgress < 50 ? 'bg-amber-400' : 'bg-cyan-500'
                }`}
                style={{ width: `${ttlProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              TTL operates completely independent of LRU/LFU eviction rules. When zero, entry expires automatically.
            </p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800 space-y-1">
              <span className="text-slate-400 flex items-center gap-1">
                <Hash className="w-3 h-3 text-indigo-400" />
                Access Frequency
              </span>
              <p className="text-base font-bold font-mono text-indigo-300 tabular-nums">
                {entry.accessCount} accesses
              </p>
              <p className="text-[10px] text-slate-500">
                {policy === 'LFU' ? 'Directly determines LFU eviction rank' : 'Used for frequency tracking'}
              </p>
            </div>

            <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800 space-y-1">
              <span className="text-slate-400 flex items-center gap-1">
                <Layers className="w-3 h-3 text-purple-400" />
                Active Policy Status
              </span>
              <p className="text-base font-bold font-mono text-purple-300">
                {policy}: {isEvictionCandidate ? 'Least Recent / Tail' : 'Safe In Cache'}
              </p>
              <p className="text-[10px] text-slate-500">
                Pluggable eviction strategy
              </p>
            </div>

            <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800 space-y-1">
              <span className="text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-emerald-400" />
                Created At
              </span>
              <p className="font-mono text-slate-200 font-medium tabular-nums">{formattedCreated}</p>
              <p className="text-[10px] text-slate-500">Timestamp of original PUT</p>
            </div>

            <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800 space-y-1">
              <span className="text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Last Accessed
              </span>
              <p className="font-mono text-slate-200 font-medium tabular-nums">{formattedLastAccess}</p>
              <p className="text-[10px] text-slate-500">Updated on every GET</p>
            </div>
          </div>

          {/* Raw Value Payload */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">Stored Value (JSON / Primitive)</span>
            <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto max-h-36">
              {typeof entry.value === 'object'
                ? JSON.stringify(entry.value, null, 2)
                : String(entry.value)}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          {onDeleteKey ? (
            <button
              onClick={() => {
                onDeleteKey(entry.key);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/40 rounded-md transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Evict Key Manually
            </button>
          ) : <div />}

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
