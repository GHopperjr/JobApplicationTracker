import { useCallback, useState, type ReactNode } from 'react';
import type { Application } from '../services/applicationsService';
import {
  ApplicationFormContext,
  type ApplicationFormState,
} from './application-form-context';

export function ApplicationFormProvider({ children }: { children: ReactNode }) {
  const [formState, setFormState] = useState<ApplicationFormState>({ mode: 'closed' });

  // Stable references: these get passed as props down through KanbanBoard/
  // ApplicationsTable to ApplicationCard's memo comparator, which only pays
  // off if the callbacks it compares don't change identity every render.
  const openCreate = useCallback(() => setFormState({ mode: 'create' }), []);
  const openEdit = useCallback(
    (application: Application) => setFormState({ mode: 'edit', application }),
    []
  );
  const close = useCallback(() => setFormState({ mode: 'closed' }), []);

  return (
    <ApplicationFormContext.Provider value={{ formState, openCreate, openEdit, close }}>
      {children}
    </ApplicationFormContext.Provider>
  );
}
