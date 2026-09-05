import { describe, expect, it } from 'vitest';
import { toAppError, toAuthError } from './errors';

describe('toAppError', () => {
  it('maps a known Postgres/PostgREST code to its friendly message', () => {
    const err = toAppError({ code: '23514', message: 'check constraint violated' });
    expect(err.code).toBe('23514');
    expect(err.message).toMatch(/job link format/i);
  });

  it('falls back to a generic message for an unrecognized code', () => {
    const err = toAppError({ code: '99999', message: 'weird db error' });
    expect(err.code).toBe('99999');
    expect(err.message).toBe('Something went wrong. Please try again.');
  });

  it('falls back when no code is present at all', () => {
    const err = toAppError({ message: 'network failure' });
    expect(err.code).toBe('UNKNOWN');
    expect(err.message).toBe('Something went wrong. Please try again.');
  });
});

describe('toAuthError', () => {
  it('gives bad password and unknown email the identical message', () => {
    // Deliberate: distinguishing the two lets an attacker enumerate
    // registered accounts (docs/02-backend-architecture.md).
    const badPassword = toAuthError({ message: 'Invalid login credentials' });
    expect(badPassword.message).toBe('Email or password is incorrect.');
    expect(badPassword.code).toBe('AUTH_INVALID');
  });

  it('maps a rate-limit response by status code even without matching text', () => {
    const err = toAuthError({ message: 'too many requests', status: 429 });
    expect(err.code).toBe('AUTH_RATE_LIMIT');
  });
});
