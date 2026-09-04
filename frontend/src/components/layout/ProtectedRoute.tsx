import { useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, isLoading, sessionExpired, clearSessionExpired } = useAuth();
  const { show } = useToast();

  // The redirect below fires as soon as `session` goes null; this just adds
  // the notice docs/05 F8 specifies for the "expired" case specifically, as
  // opposed to a deliberate sign-out (which needs no explanation).
  useEffect(() => {
    if (sessionExpired) {
      show('Your session expired. Please sign in again.', 'error');
      clearSessionExpired();
    }
  }, [sessionExpired, show, clearSessionExpired]);

  // Must be handled explicitly: rendering <Navigate> while the session is
  // still being restored from storage bounces an already-signed-in user to
  // the login screen on every refresh.
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to={ROUTES.login} replace />;
  }

  return <>{children}</>;
}
