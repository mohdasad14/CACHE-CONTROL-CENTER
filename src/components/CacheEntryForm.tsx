/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { cacheApi } from '../services/cacheApi';
import { soundManager } from '../services/soundEffects';
import { useToast } from './ToastNotification';

interface CacheEntryFormProps {
  onEntryAdded: (key: string, value: string, ttlMillis: number) => void;
}

export const CacheEntryForm: React.FC<CacheEntryFormProps> = ({ onEntryAdded }) => {
  const [key, setKey] = useState<string>('user:1');
  const [value, setValue] = useState<string>('Alice');
  const [ttlMillis, setTtlMillis] = useState<string>('30000');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedKey = key.trim();
    const trimmedVal = value.trim();

    if (!trimmedKey) {
      setErrorMsg('Key is required.');
      return;
    }
    if (!trimmedVal) {
      setErrorMsg('Value is required.');
      return;
    }

    const ttlNum = Number(ttlMillis);
    if (isNaN(ttlNum) || ttlNum < 0) {
      setErrorMsg('TTL must be a valid non-negative number in milliseconds (0 for infinite).');
      return;
    }

    setIsSubmitting(true);
    try {
      await cacheApi.putEntry(trimmedKey, trimmedVal, ttlNum);
      soundManager.playPut();
      showToast('success', 'Entry Added Successfully', `Key: "${trimmedKey}" stored with ${ttlNum > 0 ? (ttlNum / 1000).toFixed(1) + 's' : 'infinite'} TTL.`);
      onEntryAdded(trimmedKey, trimmedVal, ttlNum);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add entry.');
      showToast('error', 'Failed to Add Entry', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between h-full shadow-sm">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
        <PlusCircle className="w-4 h-4 text-emerald-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
          Put Cache Entry
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 mt-3 text-xs">
        {errorMsg && (
          <div className="p-2 rounded bg-rose-950/60 border border-rose-800/80 text-rose-300 text-[11px] font-mono">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="text-slate-400 text-[11px] block mb-1">Key</label>
          <input
            type="text"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="e.g. user:1"
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="text-slate-400 text-[11px] block mb-1">Value</label>
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="e.g. Alice"
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="text-slate-400 text-[11px] block mb-1">TTL (milliseconds, 0 = infinite)</label>
          <input
            type="number"
            value={ttlMillis}
            onChange={e => setTtlMillis(e.target.value)}
            placeholder="e.g. 10000"
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-md transition-colors tracking-wider text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {isSubmitting ? 'PUTTING...' : 'PUT ENTRY'}
        </button>
      </form>
    </div>
  );
};
