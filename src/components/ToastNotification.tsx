/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, title: string, message?: string, duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9);
    const item: ToastItem = { id, type, title, message, duration };

    setToasts(prev => [item, ...prev.slice(0, 4)]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Render Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none">
        {toasts.map(toast => {
          let borderCol = 'border-slate-800 bg-slate-900/95 text-slate-100';
          let icon = <Info className="w-4 h-4 text-cyan-400 shrink-0" />;

          if (toast.type === 'success') {
            borderCol = 'border-emerald-800/80 bg-slate-950/95 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
            icon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
          } else if (toast.type === 'error') {
            borderCol = 'border-rose-800/80 bg-slate-950/95 shadow-[0_0_15px_rgba(244,63,94,0.15)]';
            icon = <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
          } else if (toast.type === 'warning') {
            borderCol = 'border-amber-800/80 bg-slate-950/95 shadow-[0_0_15px_rgba(245,158,11,0.15)]';
            icon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-3.5 rounded-lg border shadow-xl flex items-start justify-between gap-3 text-xs transition-all animate-in slide-in-from-bottom-2 ${borderCol}`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">{icon}</div>
                <div>
                  <h4 className="font-semibold text-slate-100">{toast.title}</h4>
                  {toast.message && (
                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{toast.message}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
