// Fields are declared and assigned explicitly, not via constructor parameter
// properties — tsconfig's `erasableSyntaxOnly` disallows that shorthand since
// it isn't pure type-erasure (it generates real assignment code).
export class AppError extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }
}

const MESSAGES: Record<string, string> = {
  '23503': 'That record no longer exists.',
  '23514': 'Some of those details are not valid — check the job link format.',
  '22P02': 'That filter value is not valid.', // invalid enum input, e.g. a hand-edited ?status=
  '42501': 'You do not have permission to do that.',
  PGRST116: 'That application could not be found.',
  PGRST301: 'Your session expired. Please sign in again.',
};

export function toAppError(error: { code?: string; message: string }): AppError {
  const code = error.code ?? 'UNKNOWN';
  return new AppError(MESSAGES[code] ?? 'Something went wrong. Please try again.', code, error);
}

// Supabase AuthError does not carry Postgres error codes, so toAppError cannot
// classify it — auth failures need their own mapping.
export function toAuthError(error: { message: string; status?: number }): AppError {
  const msg = error.message.toLowerCase();

  // Deliberately identical message for bad password AND unknown email:
  // distinguishing them lets an attacker enumerate registered accounts.
  if (msg.includes('invalid login credentials')) {
    return new AppError('Email or password is incorrect.', 'AUTH_INVALID', error);
  }
  if (msg.includes('email not confirmed')) {
    return new AppError('Please confirm your email before signing in.', 'AUTH_UNCONFIRMED', error);
  }
  if (msg.includes('already registered')) {
    return new AppError('An account with that email already exists.', 'AUTH_EXISTS', error);
  }
  // Applies identically whether this came from a sign-in or sign-up attempt
  // — Supabase enforces one auth-request throttle per IP/project, not a
  // separate one per endpoint. There's no exact retry time to show: the
  // Supabase client doesn't expose the Retry-After value, only this message
  // and a 429 status, so "a few minutes" is honest and "5 minutes" would not be.
  if (error.status === 429 || msg.includes('rate limit')) {
    return new AppError(
      "Too many attempts. This is temporary — please wait a few minutes, then try again.",
      'AUTH_RATE_LIMIT',
      error
    );
  }
  return new AppError('Could not sign you in. Please try again.', 'AUTH_UNKNOWN', error);
}
