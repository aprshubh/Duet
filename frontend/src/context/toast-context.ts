import { createContext } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warn';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ToastContextValue {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  warn: (msg: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
