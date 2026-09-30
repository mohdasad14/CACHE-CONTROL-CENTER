/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  RefreshCw,
  RotateCcw,
  Volume2,
  VolumeX,
  Music,
  ShieldCheck,
  Database,
  Server,
  FileCode2,
  Activity,
  Cpu,
  Layers,
  Sparkles,
  BarChart2
} from 'lucide-react';
import { BackendStatus } from '../types/cache';

export type DashboardTab = 'dashboard' | 'java-code' | 'threads' | 'simulator' | 'benchmarks';

interface HeaderProps {
  status: BackendStatus;
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
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
  activeTab,
  onTabChange,
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Tier: Logo, Status, Audio, Actions */}
        <div className="h-16 flex items-center justify-between gap-4">
          {/* Left: Branding & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-900 to-indigo-950 border border-cyan-700/60 flex items-center justify-center text-cyan-300 shadow-md shadow-cyan-950/40">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">
                  CacheX
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800 font-semibold flex items-center gap-1">
                  <span>☕</span> Java 17+ Spring Boot
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans hidden sm:block">
                Concurrent Cache Engine &amp; Live Telemetry Panel
              </p>
            </div>
          </div>

          {/* Right: Status, Audio & Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Backend Status indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  status.online ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500'
                }`}
              />
              <span className="text-slate-300">
                Engine: <strong className="text-white">{status.online ? 'Active' : 'Offline'}</strong>
              </span>
              {status.online && status.latencyMs !== undefined && (
                <span className="text-emerald-400 text-[11px]">({status.latencyMs}ms)</span>
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
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Ambient Music Toggle */}
            <button
              onClick={onToggleMusic}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                musicEnabled
                  ? 'bg-purple-950/40 border-purple-600 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Ambient Audio"
            >
              <Music className="w-3.5 h-3.5" />
              <span className="text-[11px] font-mono hidden md:inline">{musicEnabled ? 'Music ON' : 'Music OFF'}</span>
            </button>

            {/* Refresh button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg text-xs font-medium border border-slate-800 transition-colors"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Reset Metrics button */}
            <button
              onClick={onResetMetrics}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-lg text-xs font-medium border border-slate-800 hover:border-amber-800/60 transition-colors"
              title="Reset metrics counters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Lower Tier: Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2.5 pt-1 text-xs font-sans scrollbar-none border-t border-slate-900">
          <button
            onClick={() => onTabChange('java-code')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'java-code'
                ? 'bg-purple-500/20 text-purple-200 border border-purple-500/50 shadow-sm shadow-purple-950/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-semibold">Java Engineering Studio (80% Coverage)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
              Java 17+
            </span>
          </button>

          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Live Telemetry Dashboard</span>
          </button>

          <button
            onClick={() => onTabChange('threads')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'threads'
                ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>Multithreading &amp; Concurrency Lab</span>
          </button>

          <button
            onClick={() => onTabChange('simulator')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'simulator'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Visual Access Simulator</span>
          </button>

          <button
            onClick={() => onTabChange('benchmarks')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'benchmarks'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
            <span>LRU vs LFU Benchmark Lab</span>
          </button>
        </div>
      </div>
    </header>
  );
};
