import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';
import { ToastContext, type Toast, type ToastAction } from './toast-context';

const DISMISS_MS = 4000;
const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const scheduleDismiss = useCallback(
    (id: string) => {
      const timer = setTimeout(() => dismiss(id), DISMISS_MS);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const show = useCallback(
    (message: string, variant: 'success' | 'error' = 'success', action?: ToastAction) => {
      const id = crypto.randomUUID();
      setToasts((prev) => {
        const next = [...prev, { id, message, variant, action }];
        // When the queue exceeds the max, the oldest is dropped immediately.
        if (next.length > MAX_TOASTS) {
          const [oldest, ...rest] = next;
          const oldestTimer = timers.current.get(oldest.id);
          if (oldestTimer) clearTimeout(oldestTimer);
          timers.current.delete(oldest.id);
          return rest;
        }
        return next;
      });
      scheduleDismiss(id);
    },
    [scheduleDismiss]
  );

  const pause = (id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
  };

  const resume = (id: string) => scheduleDismiss(id);

  return (
    <ToastContext.Provider value={{ toasts, show, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} onPause={pause} onResume={resume} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
  onPause,
  onResume,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
  // No early return on an empty list: AnimatePresence needs this container
  // to stay mounted so it can play the exit animation for the *last*
  // remaining toast — that toast is already gone from `toasts` (dismiss()
  // filters immediately), so an early return here would unmount everything
  // before the exit animation ever gets a chance to run.
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={onDismiss}
            onPause={onPause}
            onResume={onResume}
          />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}

function ToastItem({
  toast,
  onDismiss,
  onPause,
  onResume,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      onMouseEnter={() => onPause(toast.id)}
      onMouseLeave={() => onResume(toast.id)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
      className={cn(
        'flex w-full max-w-sm items-center gap-3 rounded-md border px-3 py-2 text-sm shadow-lg',
        toast.variant === 'success' && 'border-emerald-100 bg-emerald-50 text-emerald-700',
        toast.variant === 'error' && 'border-rose-100 bg-rose-50 text-rose-700'
      )}
    >
      <span className="flex-1">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onDismiss(toast.id);
          }}
          className="shrink-0 font-medium underline underline-offset-2"
        >
          {toast.action.label}
        </button>
      )}
    </motion.div>
  );
}
