/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { cacheApi } from '../services/cacheApi';
import { GetEntryResponse } from '../types/cache';
import { soundManager } from '../services/soundEffects';
import { useToast } from './ToastNotification';

interface GetEntryFormProps {
  onEntryLookedUp: (key: string, result: string) => void;
}

export const GetEntryForm: React.FC<GetEntryFormProps> = ({ onEntryLookedUp }) => {
  const [key, setKey] = useState<string>('user:1');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<GetEntryResponse | null>(null);
  const { showToast } = useToast();

  const handleGet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;

    setIsLoading(true);
    setResult(null);

    try {
      const res = await cacheApi.getEntry(key.trim());
      setResult(res);

      if (res.hit) {
        soundManager.playHit();
        showToast('success', `Cache HIT: "${key}"`, `Value: ${res.value}`);
        onEntryLookedUp(key.trim(), `HIT (${res.value})`);
      } else {
        soundManager.playMiss();
        showToast('error', `Cache MISS: "${key}"`, res.message || 'Key not found in cache.');
        onEntryLookedUp(key.trim(), 'MISS');
      }
    } catch (err: any) {
      soundManager.playMiss();
      setResult({
        hit: false,
        key: key.trim(),
        status: 'MISS',
        message: err.message,
      });
      showToast('error', 'Lookup Failed', err.message);
      onEntryLookedUp(key.trim(), 'ERROR');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between h-full shadow-sm">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
        <Search className="w-4 h-4 text-cyan-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
          Get Cache Entry
        </h3>
      </div>

      <form onSubmit={handleGet} className="space-y-3 mt-3 text-xs">
        <div>
          <label className="text-slate-400 text-[11px] block mb-1">Key</label>
          <input
            type="text"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="e.g. user:1"
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-md transition-colors tracking-wider text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {isLoading ? 'LOOKING UP...' : 'GET'}
        </button>

        {/* Visually distinct Result Box */}
        {result && (
          <div
            className={`p-3 rounded-lg border text-xs font-mono mt-3 ${
              result.hit
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
            }`}
          >
            <div className="flex items-center justify-between font-bold pb-1 border-b border-slate-800/60 mb-1.5">
              <span className="flex items-center gap-1">
                {result.hit ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                {result.hit ? 'RESULT: HIT' : `RESULT: ${result.status}`}
              </span>
              <span className="text-[10px] text-slate-400">Key: {result.key}</span>
            </div>

            {result.hit ? (
              <div className="space-y-1 text-[11px]">
                <div>
                  <span className="text-slate-400">Value:</span>{' '}
                  <strong className="text-white">{result.value}</strong>
                </div>
                <div>
                  <span className="text-slate-400">TTL Remaining:</span>{' '}
                  <span className="text-cyan-300 font-semibold">
                    {result.remainingTtlMillis !== undefined && result.remainingTtlMillis > 0
                      ? `${(result.remainingTtlMillis / 1000).toFixed(1)}s`
                      : '∞ Infinite'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-300 font-sans">
                {result.message || 'Key not found in memory.'}
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
};
