import { useContext } from 'react';
import { ApplicationFormContext } from '../context/application-form-context';

export function useApplicationForm() {
  const context = useContext(ApplicationFormContext);
  if (!context) {
    throw new Error('useApplicationForm must be used within an ApplicationFormProvider');
  }
  return context;
}
