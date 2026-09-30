/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PlusCircle, Search, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import { CacheManager } from '../engine/CacheManager';
import { soundManager } from '../services/soundEffects';
import { useToast } from './ToastNotification';

interface CacheOperationsPanelProps {
  cache: CacheManager;
  onRefresh: () => void;
}

interface LastExecutionOutput {
  operation: 'PUT' | 'GET' | 'DELETE';
  key: string;
  status: 'HIT' | 'MISS' | 'STORED' | 'DELETED' | 'EXPIRED';
  result: string;
  timestamp: string;
}

export const CacheOperationsPanel: React.FC<CacheOperationsPanelProps> = ({ cache, onRefresh }) => {
  const { showToast } = useToast();

  // PUT Form State
  const [putKey, setPutKey] = useState<string>('user1');
  const [putValue, setPutValue] = useState<string>('Aparna');
  const [putTtl, setPutTtl] = useState<string>('30');

  // GET Form State
  const [getKey, setGetKey] = useState<string>('user1');

  // DELETE Form State
  const [deleteKey, setDeleteKey] = useState<string>('user1');

  // Last Execution Output State
  const [lastOutput, setLastOutput] = useState<LastExecutionOutput | null>({
    operation: 'PUT',
    key: 'user1',
    status: 'STORED',
    result: 'Aparna',
    timestamp: new Date().toLocaleTimeString(),
  });

  const handlePut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!putKey.trim()) return;

    const ttlSec = putTtl.trim() !== '' ? Number(putTtl) : 0;
    cache.put(putKey.trim(), putValue, ttlSec, 'UI-Client');
    soundManager.playPut();

    const timeStr = new Date().toLocaleTimeString();
    setLastOutput({
      operation: 'PUT',
      key: putKey.trim(),
      status: 'STORED',
      result: `"${putValue}" (TTL: ${ttlSec > 0 ? ttlSec + 's' : '∞'})`,
      timestamp: timeStr,
    });

    showToast('success', `PUT Key: ${putKey}`, `Stored value with ${ttlSec > 0 ? ttlSec + 's' : 'infinite'} TTL`);
    onRefresh();
  };

  const handleGet = () => {
    if (!getKey.trim()) return;

    const val = cache.get(getKey.trim(), 'UI-Client');
    const timeStr = new Date().toLocaleTimeString();

    if (val !== null) {
      soundManager.playHit();
      setLastOutput({
        operation: 'GET',
        key: getKey.trim(),
        status: 'HIT',
        result: typeof val === 'object' ? JSON.stringify(val) : String(val),
        timestamp: timeStr,
      });
      showToast('success', `Cache HIT for "${getKey}"`, `Value: ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`);
    } else {
      soundManager.playMiss();
      setLastOutput({
        operation: 'GET',
        key: getKey.trim(),
        status: 'MISS',
        result: '(null)',
        timestamp: timeStr,
      });
      showToast('error', `Cache MISS for "${getKey}"`, 'Key was not found in cache or expired.');
    }

    onRefresh();
  };

  const handleDelete = () => {
    if (!deleteKey.trim()) return;

    const existed = cache.remove(deleteKey.trim(), 'UI-Client');
    const timeStr = new Date().toLocaleTimeString();

    soundManager.playDelete();
    setLastOutput({
      operation: 'DELETE',
      key: deleteKey.trim(),
      status: 'DELETED',
      result: existed ? '(evicted)' : '(not_found)',
      timestamp: timeStr,
    });

    if (existed) {
      showToast('warning', `Evicted Key: ${deleteKey}`, 'Removed entry immediately from memory index.');
    } else {
      showToast('info', `Key "${deleteKey}" not found`, 'No active slot with this key.');
    }

    onRefresh();
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-mono text-cyan-400 font-bold">&gt;_</span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">CACHE OPERATIONS</h3>
        </div>
        <span className="text-xs text-slate-500 font-sans">Real-time cache manipulation</span>
      </div>

      {/* 3 Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* Card 1: PUT ENTRY */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <form onSubmit={handlePut} className="space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <PlusCircle className="w-4 h-4" />
              <span>PUT ENTRY</span>
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 text-[11px] block">Key</label>
              <input
                type="text"
                value={putKey}
                onChange={e => setPutKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 text-[11px] block">Value</label>
              <input
                type="text"
                value={putValue}
                onChange={e => setPutValue(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 text-[11px] block">TTL (seconds, 0 = infinite)</label>
              <input
                type="number"
                value={putTtl}
                onChange={e => setPutTtl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-md transition-colors text-xs tracking-wider"
            >
              PUT
            </button>
          </form>
        </div>

        {/* Card 2: GET ENTRY */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-cyan-400">
              <Search className="w-4 h-4" />
              <span>GET ENTRY</span>
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 text-[11px] block">Key</label>
              <input
                type="text"
                value={getKey}
                onChange={e => setGetKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed font-sans pt-1">
              Performs instant in-memory lookup, updates LRU/LFU access stats &amp; validates TTL.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGet}
            className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-md transition-colors text-xs tracking-wider mt-4"
          >
            GET
          </button>
        </div>

        {/* Card 3: DELETE ENTRY */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-rose-400">
              <Trash2 className="w-4 h-4" />
              <span>DELETE ENTRY</span>
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 text-[11px] block">Key</label>
              <input
                type="text"
                value={deleteKey}
                onChange={e => setDeleteKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed font-sans pt-1">
              Evicts key immediately and removes node from active policy index.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-md transition-colors text-xs tracking-wider mt-4"
          >
            DELETE
          </button>
        </div>
      </div>

      {/* Last Execution Output Banner */}
      {lastOutput && (
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold font-sans">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Last Execution Output
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Operation:</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">
              {lastOutput.operation}
            </span>

            <span className="text-slate-400 ml-1">Key:</span>
            <span className="text-white font-bold">{lastOutput.key}</span>

            <span className="text-slate-400 ml-1">Status:</span>
            <span
              className={`px-1.5 py-0.5 rounded font-bold ${
                lastOutput.status === 'HIT' || lastOutput.status === 'STORED'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                  : lastOutput.status === 'DELETED'
                  ? 'bg-purple-950 text-purple-400 border border-purple-800/60'
                  : 'bg-rose-950 text-rose-400 border border-rose-800/60'
              }`}
            >
              {lastOutput.status}
            </span>

            <span className="text-slate-400 ml-1">Result:</span>
            <span className="text-slate-300 truncate max-w-[200px]">{lastOutput.result}</span>
          </div>

          <div className="flex items-center gap-1 text-slate-500 text-[11px] shrink-0">
            <Clock className="w-3 h-3" />
            <span>{lastOutput.timestamp}</span>
          </div>
        </div>
      )}
    </div>
  );
};
