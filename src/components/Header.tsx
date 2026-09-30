/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RefreshCw, RotateCcw, Volume2, VolumeX, Music, ShieldCheck, Database, Server } from 'lucide-react';
import { BackendStatus } from '../types/cache';
import { soundManager } from '../services/soundEffects';

interface HeaderProps {
  status: BackendStatus;
  onRefresh: () => void;
  onResetMetrics: () => void;
  isRefreshing: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  musicEnabled: boolean;
  onToggleMusic: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onRefresh,
  onResetMetrics,
  isRefreshing,
  soundEnabled,
  onToggleSound,
  musicEnabled,
  onToggleMusic,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Branding & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">
                Custom Cache
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-semibold">
                Java 17+ Spring Boot
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans">
              Live Metrics Dashboard &amp; Control Center
            </p>
          </div>
        </div>

        {/* Right: Status, Audio & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Backend Status indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                status.online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-300">
              Backend: <strong>{status.online ? 'Online' : 'Offline'}</strong>
            </span>
            {status.online && status.latencyMs !== undefined && (
              <span className="text-slate-500 text-[11px]">({status.latencyMs}ms)</span>
            )}
          </div>

          {/* Sound FX Toggle */}
          <button
            onClick={onToggleSound}
            className={`p-2 rounded-lg border text-xs transition-colors ${
              soundEnabled
                ? 'bg-cyan-950/40 border-cyan-700 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title={soundEnabled ? 'Sound Effects: Enabled' : 'Sound Effects: Muted'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Ambient Music Toggle */}
          <button
            onClick={onToggleMusic}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              musicEnabled
                ? 'bg-purple-950/40 border-purple-600 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Ambient Audio"
          >
            <Music className="w-3.5 h-3.5" />
            <span className="text-[11px] font-mono hidden sm:inline">{musicEnabled ? 'Music ON' : 'Music OFF'}</span>
          </button>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg text-xs font-medium border border-slate-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Reset Metrics button */}
          <button
            onClick={onResetMetrics}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-lg text-xs font-medium border border-slate-800 hover:border-amber-800/60 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Metrics</span>
          </button>
        </div>
      </div>
    </header>
  );
};
