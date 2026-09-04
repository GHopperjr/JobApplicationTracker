import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';

type DropdownMenuProps = {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  /** Which edge of the trigger the menu's corresponding edge aligns to. */
  align?: 'start' | 'end';
  className?: string;
  children: ReactNode;
};

/**
 * Portaled to <body> with position computed from the trigger's own
 * bounding rect, rather than `absolute` inside a `relative` ancestor. A
 * plain absolutely-positioned menu gets clipped the moment any ancestor
 * sets `overflow-x` to something other than `visible` — per the CSS spec
 * that also forces `overflow-y` to clip — which is exactly what happened
 * to row/card action menus inside this app's `overflow-x-auto` table and
 * board wrappers.
 */
export function DropdownMenu({
  isOpen,
  onClose,
  triggerRef,
  align = 'end',
  className,
  children,
}: DropdownMenuProps) {
  const [position, setPosition] = useState<{ top: number; left?: number; right?: number } | null>(
    null
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const duration = prefersReducedMotion ? 0 : 0.1;

  // Reset synchronously during render (not in an effect) when isOpen goes
  // false, so a stale position never lingers into the next open.
  const [lastOpen, setLastOpen] = useState(isOpen);
  if (isOpen !== lastOpen) {
    setLastOpen(isOpen);
    if (!isOpen) setPosition(null);
  }

  useEffect(() => {
    if (!isOpen) return;

    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPosition(
      align === 'start'
        ? { top: rect.bottom + 4, left: rect.left }
        : { top: rect.bottom + 4, right: window.innerWidth - rect.right }
    );

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (trigger.contains(target)) return; // the trigger's own click toggles it
      // Without this check, clicking a menu item fires this capture-phase
      // listener first, which closes the menu and unmounts the item's DOM
      // node before its own click handler ever runs — the browser drops a
      // click whose target was removed between pointerdown and click. That
      // was the sign-out bug: it wasn't broken, it just never got clicked.
      if (menuRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [isOpen, align, triggerRef, onClose]);

  return createPortal(
    <AnimatePresence>
      {isOpen && position && (
        <motion.div
          ref={menuRef}
          role="menu"
          // Portaled content still bubbles synthetic React events up through
          // the *component* tree (not the DOM tree) to whatever rendered
          // <DropdownMenu> — without this, clicking a menu item also fires
          // the card/row's own onClick underneath it (e.g. re-opening the
          // detail drawer right after clicking Delete).
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: position.top, left: position.left, right: position.right }}
          className={cn(
            'z-50 origin-top-right rounded-md border border-slate-200 bg-white py-1 shadow-lg',
            className
          )}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
