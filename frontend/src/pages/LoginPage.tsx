import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { SegmentedToggle } from '../components/ui/SegmentedToggle';
import { ROUTES } from '../constants/routes';
import { useAuth } from '../hooks/useAuth';
import { AppError } from '../services/errors';

const credentialsSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  // No composition rules — forced symbols/numbers measurably push users
  // toward weaker, more predictable passwords (docs/05 F1).
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type CredentialsValues = z.infer<typeof credentialsSchema>;

type Mode = 'sign-in' | 'sign-up';

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'sign-in', label: 'Sign in' },
  { value: 'sign-up', label: 'Sign up' },
];

const MODE_SUBTITLE: Record<Mode, string> = {
  'sign-in': 'Sign in to your account',
  'sign-up': 'Create an account to get started',
};

export function LoginPage() {
  const { session, isLoading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CredentialsValues>({ resolver: zodResolver(credentialsSchema) });

  if (!isLoading && session) {
    return <Navigate to={ROUTES.applications} replace />;
  }

  const onSubmit = async (values: CredentialsValues) => {
    setFormError(null);
    try {
      if (mode === 'sign-in') {
        await signIn(values.email, values.password);
      } else {
        await signUp(values.email, values.password);
        setConfirmationSent(true);
      }
    } catch (err) {
      setFormError(err instanceof AppError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setFormError(null);
    setConfirmationSent(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-slate-900">Job Application Tracker</h1>
        {/* A dedicated subtitle, not just the button label, so the two modes
            read as distinct screens rather than one form with a small
            difference somewhere in it. */}
        <p className="mt-1 mb-6 text-sm text-slate-600">{MODE_SUBTITLE[mode]}</p>

        <SegmentedToggle
          ariaLabel="Sign in or create an account"
          options={MODE_OPTIONS}
          value={mode}
          onChange={switchMode}
          className="mb-6"
        />

        {confirmationSent ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Check your email to confirm your account.
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
            data-testid="credentials-form"
          >
            <Input
              label="Email"
              type="email"
              required
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              required
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              error={errors.password?.message}
              {...register('password')}
            />

            {formError && (
              <p role="alert" className="text-xs text-rose-600">
                {formError}
              </p>
            )}

            <Button type="submit" variant="primary" isLoading={isSubmitting} className="w-full">
              {mode === 'sign-in' ? 'Sign in' : 'Sign up'}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
