import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ApplicationFormProvider } from '../context/ApplicationFormProvider';
import { ToastProvider } from '../context/ToastContext';

export function renderWithProviders(ui: ReactElement, { route = '/applications' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 }, // fail fast rather than waiting through a retry cycle
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <ApplicationFormProvider>
              <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
            </ApplicationFormProvider>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    ),
  };
}
