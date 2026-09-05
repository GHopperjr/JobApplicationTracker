import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { cn } from '../../lib/cn';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  closeOnBackdrop?: boolean;
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  closeOnBackdrop = true,
}: ModalProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  const titleId = useId();
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const duration = prefersReducedMotion ? 0 : isMobile ? 0.2 : 0.15;

  // On mobile this becomes a bottom sheet (slide up, ~90vh, rounded top
  // corners only, drag handle) rather than a centered dialog — a centered
  // modal fights the on-screen keyboard on a small viewport
  // (docs/04-design-system.md).
  const sheetMotionProps = isMobile
    ? {
        initial: { y: '100%' },
        animate: { y: 0 },
        exit: { y: '100%' },
      }
    : {
        initial: { opacity: 0, scale: 0.99 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.99 },
      };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className={cn(
            'fixed inset-0 z-40 flex px-4',
            isMobile ? 'items-end px-0' : 'items-center justify-center'
          )}
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/20"
            onClick={closeOnBackdrop ? onClose : undefined}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              'relative flex w-full flex-col bg-white shadow-lg',
              isMobile ? 'max-h-[90vh] rounded-t-lg' : 'max-h-[85vh] max-w-lg rounded-lg'
            )}
            {...sheetMotionProps}
            transition={{ duration, ease: 'easeOut' }}
          >
            {isMobile && (
              <div className="flex justify-center pt-2" aria-hidden="true">
                <div className="h-1 w-10 rounded-full bg-slate-200" />
              </div>
            )}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 id={titleId} className="text-sm font-semibold text-slate-900">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:h-auto sm:w-auto sm:p-1"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-4">{children}</div>
            {footer && <div className="border-t border-slate-200 px-4 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
