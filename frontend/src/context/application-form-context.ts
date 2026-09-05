import { createContext } from 'react';
import type { Application } from '../services/applicationsService';

export type ApplicationFormState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; application: Application };

export type ApplicationFormContextValue = {
  formState: ApplicationFormState;
  openCreate: () => void;
  openEdit: (application: Application) => void;
  close: () => void;
};

// Bridges AppShell's "Add Application" button (persistent header, a layout
// route ancestor) with ApplicationsPage's form-modal state (rendered inside
// the layout route's Outlet, a descendant) — the two can't share plain
// useState since neither is an ancestor of the other's consumer.
export const ApplicationFormContext = createContext<ApplicationFormContextValue | undefined>(
  undefined
);
