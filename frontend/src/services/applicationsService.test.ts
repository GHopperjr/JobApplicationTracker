import { describe, expect, it, vi } from 'vitest';

// A minimal stand-in for supabase-js's PostgrestFilterBuilder: every filter
// method returns the same chain, and the chain itself is awaitable (mirrors
// how e.g. `.ilike(...).ilike(...)` or a bare `await query` resolves without
// a terminal `.single()`).
function makeChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    in: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    neq: vi.fn(() => chain),
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

// Imported after the mock so applicationsService picks up the mocked client.
const { createApplication, bulkSetArchived, findPotentialDuplicates } = await import(
  './applicationsService'
);

describe('createApplication', () => {
  it('normalizes blank optional fields to null before sending to Postgres', async () => {
    const chain = makeChain({ data: { id: '1' }, error: null });
    from.mockReturnValue(chain);

    await createApplication({
      company_name: 'Acme',
      job_title: 'Engineer',
      platform_source: 'jobstreet',
      // Optional fields left blank, as a cleared form input would send them.
      job_link: '',
      salary_range: '',
      location: '',
      applied_date: '',
      notes: '',
    } as never);

    // Without this normalization, every application saved without a job
    // link fails the database's check constraint (docs/01-database-schema.md).
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        job_link: null,
        salary_range: null,
        location: null,
        applied_date: null,
        notes: null,
      })
    );
  });
});

describe('bulkSetArchived', () => {
  it('updates is_archived for every given id in a single request', async () => {
    const chain = makeChain({ data: [{ id: '1' }, { id: '2' }], error: null });
    from.mockReturnValue(chain);

    const result = await bulkSetArchived(['1', '2'], true);

    expect(chain.update).toHaveBeenCalledWith({ is_archived: true });
    expect(chain.in).toHaveBeenCalledWith('id', ['1', '2']);
    expect(result).toEqual([{ id: '1' }, { id: '2' }]);
  });
});

describe('findPotentialDuplicates', () => {
  it('matches case-insensitively on company name and job title', async () => {
    const chain = makeChain({ data: [{ id: '2' }], error: null });
    from.mockReturnValue(chain);

    const result = await findPotentialDuplicates('Acme', 'Engineer');

    expect(chain.ilike).toHaveBeenCalledWith('company_name', 'Acme');
    expect(chain.ilike).toHaveBeenCalledWith('job_title', 'Engineer');
    expect(chain.neq).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: '2' }]);
  });

  it('excludes the record being edited when an id is given', async () => {
    const chain = makeChain({ data: [], error: null });
    from.mockReturnValue(chain);

    await findPotentialDuplicates('Acme', 'Engineer', 'self-id');

    expect(chain.neq).toHaveBeenCalledWith('id', 'self-id');
  });
});
