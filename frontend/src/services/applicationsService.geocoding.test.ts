import { describe, expect, it, vi } from 'vitest';

// A minimal stand-in for supabase-js's builder: every method returns the
// same chain, and the chain resolves to `result`.
function makeChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn((..._args: unknown[]) => chain),
    insert: vi.fn((..._args: unknown[]) => chain),
    update: vi.fn((..._args: unknown[]) => chain),
    eq: vi.fn((..._args: unknown[]) => chain),
    single: vi.fn(() => Promise.resolve(result)),
    then: (onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return chain;
}

const from = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: { from: (table: string) => from(table) },
}));

vi.mock('./geocodingService', () => ({ geocodeAddress: vi.fn() }));

const { createApplication } = await import('./applicationsService');
const { geocodeAddress } = await import('./geocodingService');

describe('createApplication geocoding', () => {
  // docs/11-navigation-and-distance.md's non-negotiable test: without this,
  // an outage of a free third-party service becomes an outage of the app's
  // core function.
  it('still saves the application when geocoding fails', async () => {
    const chain = makeChain({
      data: { id: 'app-1', location: 'Makati City', location_latitude: null },
      error: null,
    });
    from.mockReturnValue(chain);
    vi.mocked(geocodeAddress).mockRejectedValue(new Error('nominatim is down'));

    const created = await createApplication({
      company_name: 'Acme',
      job_title: 'Engineer',
      platform_source: 'jobstreet',
      location: 'Makati City',
    } as never);

    expect(created).toMatchObject({ id: 'app-1', location_latitude: null });
    expect(chain.insert).toHaveBeenCalled();
  });

  it('does not wait on the geocode before returning the saved row', async () => {
    const chain = makeChain({
      data: { id: 'app-1', location: 'Makati City' },
      error: null,
    });
    from.mockReturnValue(chain);

    // A geocode that never settles must not hold up the create — the row is
    // already written by the time this fires.
    vi.mocked(geocodeAddress).mockReturnValue(new Promise(() => {}));

    await expect(
      createApplication({
        company_name: 'Acme',
        job_title: 'Engineer',
        platform_source: 'jobstreet',
        location: 'Makati City',
      } as never)
    ).resolves.toMatchObject({ id: 'app-1' });
  });

  it('makes no geocoding call at all for an application with no location', async () => {
    const chain = makeChain({ data: { id: 'app-2', location: null }, error: null });
    from.mockReturnValue(chain);
    vi.mocked(geocodeAddress).mockResolvedValue(null);

    await createApplication({
      company_name: 'Acme',
      job_title: 'Engineer',
      platform_source: 'jobstreet',
    } as never);

    expect(geocodeAddress).not.toHaveBeenCalled();
  });
});
