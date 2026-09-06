import { describe, expect, it, vi } from 'vitest';

function makeChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn((..._args: unknown[]) => chain),
    upsert: vi.fn((..._args: unknown[]) => chain),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

const from = vi.fn();
vi.mock('./supabaseClient', () => ({
  supabase: { from: (table: string) => from(table) },
}));

const { getUserPreferences, upsertMonthlyGoal } = await import('./userPreferencesService');

describe('getUserPreferences', () => {
  it('returns null when the user has never set any preferences', async () => {
    from.mockReturnValue(makeChain({ data: null, error: null }));
    await expect(getUserPreferences()).resolves.toBeNull();
  });

  it('returns the row when one exists', async () => {
    from.mockReturnValue(
      makeChain({ data: { user_id: 'u1', monthly_application_goal: 20 }, error: null })
    );
    await expect(getUserPreferences()).resolves.toMatchObject({ monthly_application_goal: 20 });
  });
});

describe('upsertMonthlyGoal', () => {
  it('upserts on user_id and returns the saved row', async () => {
    const chain = makeChain({ data: { user_id: 'u1', monthly_application_goal: 20 }, error: null });
    from.mockReturnValue(chain);

    const result = await upsertMonthlyGoal(20);

    expect(chain.upsert).toHaveBeenCalledWith(
      { monthly_application_goal: 20 },
      { onConflict: 'user_id' }
    );
    expect(result).toMatchObject({ monthly_application_goal: 20 });
  });

  it('clears the goal with null rather than deleting the row', async () => {
    const chain = makeChain({ data: { user_id: 'u1', monthly_application_goal: null }, error: null });
    from.mockReturnValue(chain);

    await upsertMonthlyGoal(null);

    expect(chain.upsert).toHaveBeenCalledWith(
      { monthly_application_goal: null },
      { onConflict: 'user_id' }
    );
  });
});
