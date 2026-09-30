/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Layers, CheckCircle2 } from 'lucide-react';
import { EvictionPolicyType } from '../types/cache';
import { cacheApi } from '../services/cacheApi';
import { soundManager } from '../services/soundEffects';
import { useToast } from './ToastNotification';

interface PolicySelectorProps {
  currentPolicy: EvictionPolicyType;
  onPolicyChanged: (policy: EvictionPolicyType) => void;
}

export const PolicySelector: React.FC<PolicySelectorProps> = ({ currentPolicy, onPolicyChanged }) => {
  const [isChanging, setIsChanging] = useState<boolean>(false);
  const { showToast } = useToast();

  const handleSelectPolicy = async (newPolicy: EvictionPolicyType) => {
    if (newPolicy === currentPolicy || isChanging) return;
    setIsChanging(true);
    soundManager.playHit();

    try {
      await cacheApi.setPolicy(newPolicy);
      onPolicyChanged(newPolicy);
      showToast('success', `Eviction policy changed to ${newPolicy}`, `Backend strategy updated to ${newPolicy}.`);
    } catch (err: any) {
      showToast('error', 'Failed to update policy', err.message);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-cyan-400" />
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            Eviction Policy Control
          </h3>
          <p className="text-[11px] text-slate-400 font-sans">
            Configures backend eviction candidate selection algorithm
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
          <button
            onClick={() => handleSelectPolicy('LRU')}
            disabled={isChanging}
            className={`px-4 py-1.5 rounded-md font-bold transition-all ${
              currentPolicy === 'LRU'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            LRU (Least Recently Used)
          </button>

          <button
            onClick={() => handleSelectPolicy('LFU')}
            disabled={isChanging}
            className={`px-4 py-1.5 rounded-md font-bold transition-all ${
              currentPolicy === 'LFU'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            LFU (Least Frequently Used)
          </button>
        </div>
      </div>
    </div>
  );
};
