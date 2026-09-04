import { afterEach, describe, expect, it } from 'vitest';
import { formatCardDate, formatDate } from './format';

describe('formatDate / formatCardDate', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  // `applied_date` is a date-only column ("2026-09-01"); parsing it with
  // `new Date(iso)` reads UTC midnight, which renders as Aug 31 anywhere
  // west of UTC. Running the same assertion under both an east-of-UTC and a
  // west-of-UTC zone is what actually catches that trap (docs/08).
  it.each(['Asia/Manila', 'America/Los_Angeles', 'UTC'])(
    'renders a date-only value as the same calendar day under TZ=%s',
    (tz) => {
      process.env.TZ = tz;
      expect(formatDate('2026-09-01')).toBe('Sep 1, 2026');
      expect(formatCardDate('2026-09-01')).toBe('Sep 1');
    }
  );
});
