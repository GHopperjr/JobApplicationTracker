import { createContext } from 'react';

export type ToastAction = { label: string; onClick: () => void };

export type Toast = {
  id: string;
  message: string;
  variant: 'success' | 'error';
  action?: ToastAction;
};

export type ToastContextValue = {
  toasts: Toast[];
  show: (message: string, variant?: 'success' | 'error', action?: ToastAction) => void;
  dismiss: (id: string) => void;
};

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);
