import { useReducedMotion } from 'motion/react';

// Centralizes the "respect prefers-reduced-motion" check that every
// motion.* transition in the app needs — previously duplicated inline as
// `prefersReducedMotion ? 0 : X` in Toast, Modal, Drawer, and DropdownMenu.
// `baseSeconds` may itself be computed per caller (e.g. Modal's mobile vs
// desktop duration) — this hook only ever zeroes it out, never changes it.
export function useMotionDuration(baseSeconds: number): number {
  const prefersReducedMotion = useReducedMotion();
  return prefersReducedMotion ? 0 : baseSeconds;
}
