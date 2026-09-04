import { useState, type ReactNode } from 'react';
import type { Application } from '../services/applicationsService';
import {
  ApplicationFormContext,
  type ApplicationFormState,
} from './application-form-context';

export function ApplicationFormProvider({ children }: { children: ReactNode }) {
  const [formState, setFormState] = useState<ApplicationFormState>({ mode: 'closed' });

  const openCreate = () => setFormState({ mode: 'create' });
  const openEdit = (application: Application) => setFormState({ mode: 'edit', application });
  const close = () => setFormState({ mode: 'closed' });

  return (
    <ApplicationFormContext.Provider value={{ formState, openCreate, openEdit, close }}>
      {children}
    </ApplicationFormContext.Provider>
  );
}
