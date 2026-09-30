/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ToastProvider, useToast } from './components/ToastNotification';
import { useCacheMetrics } from './hooks/useCacheMetrics';
import { Header, DashboardTab } from './components/Header';
import { MetricsGrid } from './components/MetricsGrid';
import { HitMissChart } from './components/HitMissChart';
import { HitRateGauge } from './components/HitRateGauge';
import { CacheUsage } from './components/CacheUsage';
import { PolicySelector } from './components/PolicySelector';
import { CacheEntryForm } from './components/CacheEntryForm';
import { GetEntryForm } from './components/GetEntryForm';
import { CacheTable } from './components/CacheTable';
import { DemoPanel } from './components/DemoPanel';
import { ActivityLog } from './components/ActivityLog';
import { ComparisonPanel } from './components/ComparisonPanel';
import { AiChartBox } from './components/AiChartBox';
import { JavaCodeTab } from './components/JavaCodeTab';
import { ThreadMonitorTab } from './components/ThreadMonitorTab';
import { SimulatorTab } from './components/SimulatorTab';
import { PerformanceLabTab } from './components/PerformanceLabTab';
import { CacheManager } from './engine/CacheManager';
import { ConcurrentWorkerPool } from './engine/ConcurrentWorkerPool';
import { soundManager } from './services/soundEffects';
import { cacheApi } from './services/cacheApi';
import { ShieldCheck, Server, AlertTriangle, FileCode2, Cpu, CheckCircle } from 'lucide-react';
import { EvictionPolicyType } from './types/cache';

function DashboardContent() {
  const {
    metrics,
    entries,
    timeline,
    status,
    activityLog,
    addEvent,
    refreshNow,
    isRefreshing,
  } = useCacheMetrics(1000);

  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(soundManager.getSoundEnabled());
  const [musicEnabled, setMusicEnabled] = useState<boolean>(soundManager.getMusicEnabled());
  const [showAiBox, setShowAiBox] = useState<boolean>(true);

  // Initialize engine and concurrent worker pool for multithreading lab
  const engineInstance = useMemo(() => new CacheManager({ capacity: 10, policy: 'LRU' }), []);
  const workerPool = useMemo(() => new ConcurrentWorkerPool(engineInstance, 12), [engineInstance]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    soundManager.setSoundEnabled(next);
    setSoundEnabled(next);
    if (next) soundManager.playHit();
  };

  const handleToggleMusic = () => {
    const next = !musicEnabled;
    soundManager.setMusicEnabled(next);
    setMusicEnabled(next);
  };

  const handleResetMetrics = async () => {
    soundManager.playDelete();
    try {
      await cacheApi.resetMetrics();
      showToast('success', 'Metrics Reset', 'Performance counters have been reset to zero.');
      addEvent('RESET', undefined, 'Counters reset');
      refreshNow();
    } catch (err: any) {
      showToast('error', 'Reset Failed', err.message);
    }
  };

  const handlePolicyChanged = (newPolicy: EvictionPolicyType) => {
    addEvent('POLICY', undefined, `Switched to ${newPolicy}`);
    refreshNow();
  };

  const handleEntryAdded = (key: string, value: string, ttlMillis: number) => {
    addEvent('PUT', key, `Stored (${ttlMillis > 0 ? ttlMillis / 1000 + 's' : '∞'})`);
    refreshNow();
  };

  const handleEntryLookedUp = (key: string, result: string) => {
    addEvent('GET', key, result);
    refreshNow();
  };

  const handleEntryDeleted = (key: string) => {
    addEvent('DELETE', key, 'Deleted');
    refreshNow();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* 1. HEADER WITH TAB NAVIGATION */}
      <Header
        status={status}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRefresh={refreshNow}
        onResetMetrics={handleResetMetrics}
        isRefreshing={isRefreshing}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        musicEnabled={musicEnabled}
        onToggleMusic={handleToggleMusic}
      />

      {/* Backend Offline Warning Banner if unreachable */}
      {!status.online && (
        <div className="bg-rose-950/90 border-b border-rose-800 text-rose-200 px-4 py-2.5 text-xs flex items-center justify-between font-mono">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Cache engine not reachable at <strong>{status.url}</strong>. Operating via integrated Java runtime.
            </span>
          </div>
          <button
            onClick={refreshNow}
            className="px-2.5 py-1 bg-rose-800 hover:bg-rose-700 text-white font-bold rounded text-[11px]"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* TAB 1: LIVE METRICS DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* 2. KEY METRIC CARDS */}
            <MetricsGrid metrics={metrics} />

            {/* 3. VISUALIZATIONS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Hit / Miss Activity Chart (2 columns) */}
              <div className="lg:col-span-2">
                <HitMissChart timeline={timeline} />
              </div>

              {/* Hit Rate / Miss Rate Gauge (1 column) */}
              <div>
                <HitRateGauge hitRate={metrics.hitRate} missRate={metrics.missRate} />
              </div>

              {/* Cache Capacity Usage (1 column) */}
              <div>
                <CacheUsage currentSize={metrics.currentSize} capacity={metrics.capacity} />
              </div>
            </div>

            {/* 4. EVICTION POLICY CONTROL */}
            <PolicySelector
              currentPolicy={metrics.policy}
              onPolicyChanged={handlePolicyChanged}
            />

            {/* 5. CACHE ENTRY MANAGEMENT (PUT & GET & ACTIVITY LOG) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <CacheEntryForm onEntryAdded={handleEntryAdded} />
              </div>

              <div>
                <GetEntryForm onEntryLookedUp={handleEntryLookedUp} />
              </div>

              <div>
                <ActivityLog events={activityLog} />
              </div>
            </div>

            {/* 6. CACHE ENTRIES TABLE */}
            <CacheTable
              entries={entries}
              onRefresh={refreshNow}
              onEntryDeleted={handleEntryDeleted}
            />

            {/* 7. EVICTION STRATEGY DEMO (Sample Access Pattern) */}
            <DemoPanel
              currentPolicy={metrics.policy}
              onDemoCompleted={refreshNow}
            />

            {/* 8. LRU vs LFU COMPARISON PANEL */}
            <ComparisonPanel
              entries={entries}
              activePolicy={metrics.policy}
            />

            {/* 9. AI CHART BOX & TELEMETRY DIAGNOSTICS */}
            {showAiBox && (
              <AiChartBox
                metrics={metrics}
                timeline={timeline as any}
                currentPolicy={metrics.policy}
                entries={entries as any}
                onApplyCapacity={cap => {
                  cacheApi.request('/cache/capacity', { method: 'POST', body: JSON.stringify({ capacity: cap }) }).catch(() => {});
                  refreshNow();
                }}
                onApplyPolicy={pol => {
                  cacheApi.setPolicy(pol);
                  handlePolicyChanged(pol);
                }}
                onApplyTtl={ttl => {
                  showToast('info', 'Default TTL Applied', `Configured default TTL: ${ttl}s`);
                }}
              />
            )}
          </div>
        )}

        {/* TAB 2: JAVA SOURCE CODE STUDIO */}
        {activeTab === 'java-code' && (
          <JavaCodeTab />
        )}

        {/* TAB 3: MULTITHREADING & CONCURRENCY LAB */}
        {activeTab === 'threads' && (
          <ThreadMonitorTab workerPool={workerPool} />
        )}

        {/* TAB 4: VISUAL ACCESS PATTERN SIMULATOR */}
        {activeTab === 'simulator' && (
          <SimulatorTab />
        )}

        {/* TAB 5: LRU VS LFU BENCHMARK LAB */}
        {activeTab === 'benchmarks' && (
          <PerformanceLabTab />
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>CacheX • Java 17+ Spring Boot In-Memory Cache Engine • Maven Build • Pluggable LRU/LFU • ReentrantReadWriteLock</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-purple-400">
              <FileCode2 className="w-3.5 h-3.5" />
              Full Java Source Included
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              API Key: Server Environment
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <DashboardContent />
    </ToastProvider>
  );
}
