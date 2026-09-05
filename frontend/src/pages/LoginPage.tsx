import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { SegmentedToggle } from '../components/ui/SegmentedToggle';
import { PLATFORM_LABELS, PLATFORM_STYLES, type PlatformSource } from '../constants/platforms';
import { ROUTES } from '../constants/routes';
import { STATUS_LABELS, STATUS_STYLES, type ApplicationStatus } from '../constants/status';
import { WORK_SETUP_LABELS, type WorkSetup } from '../constants/workSetup';
import { useAuth } from '../hooks/useAuth';
import { useMotionDuration } from '../hooks/useMotionDuration';
import { cn } from '../lib/cn';
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

const MODE_HEADING: Record<Mode, string> = {
  'sign-in': 'Sign in to your account',
  'sign-up': 'Create an account to get started',
};

const MODE_DESCRIPTION: Record<Mode, string> = {
  'sign-in': 'Pick up your job search right where you left off.',
  'sign-up': 'Track every application, interview, and offer in one place.',
};

// Static, illustrative-only preview cards for the brand panel — built from
// the app's real status/platform/work-setup tokens (constants/status.ts,
// constants/platforms.ts, constants/workSetup.ts) rather than a one-off
// palette, and carrying no claim to be live data (no counts, no "last
// synced" timestamp).
const PREVIEW_CARDS: {
  company: string;
  title: string;
  status: ApplicationStatus;
  platform: PlatformSource;
  workSetup?: WorkSetup;
}[] = [
  { company: 'Acme Corporation', title: 'Backend Developer', status: 'interviewed', platform: 'linkedin' },
  {
    company: 'Globex Corp',
    title: 'Product Designer',
    status: 'scheduled_for_interview',
    platform: 'jobstreet',
    workSetup: 'remote',
  },
];

function companyInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function LogoMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
        inverted ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'
      )}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside
      aria-hidden="true"
      className="relative hidden w-[46%] flex-col justify-center gap-10 bg-slate-900 px-12 py-12 text-white lg:flex xl:w-1/2"
    >
      <div className="absolute left-12 top-12 flex items-center gap-2.5">
        <LogoMark inverted />
        <span className="text-sm font-semibold tracking-tight text-white">Job Application Tracker</span>
      </div>

      <div>
        <h2 className="max-w-xs text-3xl font-bold leading-tight tracking-tight text-white">
          Stay on top of every application, in one calm workspace.
        </h2>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
          Track interviews, follow-ups, platforms, and salary details — organized, not overwhelming.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {PREVIEW_CARDS.map((card) => {
          const statusStyle = STATUS_STYLES[card.status];
          return (
            <div
              key={card.company}
              className="rounded-lg border border-slate-200/60 bg-white/90 p-3 shadow-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-700">
                    {companyInitials(card.company)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-slate-900">{card.title}</p>
                      {card.workSetup && (
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          {WORK_SETUP_LABELS[card.workSetup]}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500">{card.company}</p>
                  </div>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PLATFORM_STYLES[card.platform].dot)} />
                  <span className="font-medium text-slate-700">{PLATFORM_LABELS[card.platform]}</span>
                </div>
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                    statusStyle.badge
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusStyle.dot)} />
                  {STATUS_LABELS[card.status]}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function LoginPage() {
  const { session, isLoading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const duration = useMotionDuration(0.15);

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
    <div className="flex min-h-screen">
      <BrandPanel />

      <main className="flex flex-1 flex-col px-6 py-8 sm:px-12 lg:px-16 xl:px-24">
        {/* Top bar: mobile-only brand mark (the panel above already carries
            it on desktop) and the mode switcher, pinned to the top rather
            than living inside the form itself — a nav-level control, not a
            form field. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
          <div className="flex items-center gap-2 lg:hidden">
            <LogoMark />
            <span className="text-sm font-semibold text-slate-900">Job Application Tracker</span>
          </div>
          <SegmentedToggle
            ariaLabel="Sign in or create an account"
            options={MODE_OPTIONS}
            value={mode}
            onChange={switchMode}
          />
        </div>

        <div className="flex flex-1 flex-col justify-center py-10 lg:py-0">
          <div className="mx-auto w-full max-w-sm">
            {/* A dedicated heading + description, not just a small subtitle,
                so the two modes read as distinct screens rather than one
                form with a small difference somewhere in it. Crossfades on
                mode change rather than swapping instantly — `mode="wait"` so
                the old copy finishes leaving before the new copy enters,
                avoiding an overlap jump. */}
            <div className="mb-6 min-h-[74px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration }}
                >
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">{MODE_HEADING[mode]}</h1>
                  <p className="mt-1.5 text-sm text-slate-500">{MODE_DESCRIPTION[mode]}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
              {confirmationSent ? (
                <motion.div
                  key="confirmation"
                  initial={{ opacity: 0, scale: 0.99 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.99 }}
                  transition={{ duration }}
                  className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600"
                >
                  Check your email to confirm your account.
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={handleSubmit(onSubmit)}
                  initial={{ opacity: 0, scale: 0.99 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.99 }}
                  transition={{ duration }}
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
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                    error={errors.password?.message}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-xs font-medium text-slate-400 hover:text-slate-700"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    }
                    {...register('password')}
                  />

                  <AnimatePresence>
                    {formError && (
                      <motion.p
                        role="alert"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration }}
                        className="text-xs text-rose-600"
                      >
                        {formError}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <Button type="submit" variant="primary" isLoading={isSubmitting} className="w-full">
                    {mode === 'sign-in' ? 'Sign in' : 'Sign up'}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* A second, contextual way to switch modes — right where a
                user's eye already is after a failed attempt, rather than
                making them look back up at the toggle. */}
            <button
              type="button"
              onClick={() => switchMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
              className="mt-4 text-xs text-slate-500 hover:text-slate-700"
            >
              {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
