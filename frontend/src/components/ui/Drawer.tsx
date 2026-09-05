import { AnimatePresence, motion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useMotionDuration } from '../../hooks/useMotionDuration';
import { cn } from '../../lib/cn';

type DrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function Drawer({ isOpen, onClose, title, children }: DrawerProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  const titleId = useId();
  const isMobile = useIsMobile();
  const duration = useMotionDuration(0.2);

  // On mobile this becomes a bottom sheet (slide up) rather than a
  // right-side panel (slide in) — docs/04-design-system.md.
  const sheetMotionProps = isMobile
    ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
    : { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-40">
          <motion.div
            className="absolute inset-0 bg-slate-900/20"
            onClick={onClose}
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
              'absolute flex flex-col bg-white shadow-lg',
              isMobile
                ? 'inset-x-0 bottom-0 max-h-[90vh] rounded-t-lg'
                : 'right-0 top-0 h-full w-full max-w-md rounded-l-lg'
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
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
