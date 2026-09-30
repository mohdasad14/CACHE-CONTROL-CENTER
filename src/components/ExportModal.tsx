/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Download, FileText, Check, Database } from 'lucide-react';
import { CacheMetrics, CacheEvent, CacheEntry } from '../types/cache';

interface ExportModalProps {
  metrics: CacheMetrics;
  events: CacheEvent[];
  entries: CacheEntry[];
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  metrics,
  events,
  entries,
  onClose,
}) => {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [copied, setCopied] = useState<boolean>(false);

  const generateData = () => {
    if (format === 'json') {
      return JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          metrics,
          activeEntries: entries,
          eventHistory: events,
        },
        null,
        2
      );
    }

    // CSV format
    const lines: string[] = [];
    lines.push('--- CACHEX METRICS SUMMARY ---');
    lines.push('Metric,Value');
    lines.push(`Total Requests,${metrics.totalRequests}`);
    lines.push(`Hits,${metrics.hits}`);
    lines.push(`Misses,${metrics.misses}`);
    lines.push(`Hit Rate (%),${metrics.hitRate}%`);
    lines.push(`Miss Rate (%),${metrics.missRate}%`);
    lines.push(`Active Entries,${metrics.activeEntries}`);
    lines.push(`Capacity,${metrics.capacity}`);
    lines.push(`Evictions,${metrics.evictions}`);
    lines.push(`Expirations,${metrics.expirations}`);
    lines.push(`Avg GET Latency (ms),${metrics.avgGetLatencyMs}`);
    lines.push(`Avg PUT Latency (ms),${metrics.avgPutLatencyMs}`);
    lines.push(`P95 Latency (ms),${metrics.p95LatencyMs}`);
    lines.push(`P99 Latency (ms),${metrics.p99LatencyMs}`);
    lines.push(`Throughput (ops/s),${metrics.opsPerSec}`);
    lines.push('');

    lines.push('--- ACTIVE CACHE ENTRIES ---');
    lines.push('Key,AccessCount,LastAccess,ExpiresAt,TTL_Remaining_Sec');
    const now = Date.now();
    for (const e of entries) {
      const rem = e.expiresAt === Infinity ? 'Infinite' : Math.max(0, Math.ceil((e.expiresAt - now) / 1000));
      lines.push(`${e.key},${e.accessCount},${new Date(e.lastAccessTime).toISOString()},${e.expiresAt === Infinity ? 'Never' : new Date(e.expiresAt).toISOString()},${rem}`);
    }
    lines.push('');

    lines.push('--- EVENT HISTORY LOG ---');
    lines.push('Timestamp,Operation,Key,Result,LatencyMs,ThreadId');
    for (const evt of events) {
      lines.push(`${new Date(evt.timestamp).toISOString()},${evt.op},${evt.key || ''},${evt.result},${evt.latencyMs},${evt.threadId || ''}`);
    }

    return lines.join('\n');
  };

  const handleDownload = () => {
    const data = generateData();
    const mime = format === 'json' ? 'application/json' : 'text/csv';
    const blob = new Blob([data], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cachex_telemetry_${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateData());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-100">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Export Cache Telemetry</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Choose Format</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`py-2 px-3 rounded-lg border font-mono font-medium flex items-center justify-center gap-2 transition-colors ${
                  format === 'csv'
                    ? 'bg-cyan-950/50 border-cyan-500 text-cyan-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                CSV Format (.csv)
              </button>

              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`py-2 px-3 rounded-lg border font-mono font-medium flex items-center justify-center gap-2 transition-colors ${
                  format === 'json'
                    ? 'bg-cyan-950/50 border-cyan-500 text-cyan-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                JSON Snapshot (.json)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Preview</label>
            <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto select-all">
              {generateData().slice(0, 1000)}...
            </pre>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
