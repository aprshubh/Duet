import React, { useState, useCallback, useMemo } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { ToastContext, type ToastType, type ToastItem, type ToastContextValue } from './toast-context';

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const value = useMemo<ToastContextValue>(() => ({
    success: (msg: string) => addToast('success', msg),
    error: (msg: string) => addToast('error', msg),
    info: (msg: string) => addToast('info', msg),
    warn: (msg: string) => addToast('warn', msg),
  }), [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-portal-container" aria-live="polite" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <div key={toast.id} className={`in-app-toast toast-${toast.type}`}>
            <div className="toast-icon-wrap">
              {toast.type === 'success' && <CheckCircle2 size={16} className="text-emerald-400" />}
              {toast.type === 'error' && <AlertCircle size={16} className="text-red-400" />}
              {toast.type === 'info' && <Info size={16} className="text-sky-400" />}
              {toast.type === 'warn' && <AlertTriangle size={16} className="text-amber-400" />}
            </div>
            <span className="toast-message-text">{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="toast-dismiss-btn"
              aria-label="Dismiss notification"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
