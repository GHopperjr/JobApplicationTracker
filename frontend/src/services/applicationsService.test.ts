import { describe, expect, it, vi } from 'vitest';

// A minimal stand-in for supabase-js's PostgrestFilterBuilder: every filter
// method returns the same chain, and the chain itself is awaitable (mirrors
// how e.g. `.ilike(...).ilike(...)` or a bare `await query` resolves without
// a terminal `.single()`).
function makeChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn((..._args: unknown[]) => chain),
    insert: vi.fn((..._args: unknown[]) => chain),
    update: vi.fn((..._args: unknown[]) => chain),
    in: vi.fn((..._args: unknown[]) => chain),
    ilike: vi.fn((..._args: unknown[]) => chain),
    neq: vi.fn((..._args: unknown[]) => chain),
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
const { createApplication, bulkCreate, bulkSetArchived, findPotentialDuplicates } = await import(
  './applicationsService'
);
type ApplicationInsert = import('./applicationsService').ApplicationInsert;

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

describe('bulkCreate', () => {
  const makeRows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      company_name: `Company ${i}`,
      job_title: 'Engineer',
    })) as ApplicationInsert[];

  it('inserts in sequential chunks of 100 and reports progress after each chunk', async () => {
    const chunk1 = makeChain({ data: makeRows(100).map((r, i) => ({ id: `a${i}`, ...r })), error: null });
    const chunk2 = makeChain({ data: makeRows(50).map((r, i) => ({ id: `b${i}`, ...r })), error: null });
    from.mockReturnValueOnce(chunk1).mockReturnValueOnce(chunk2);

    const progress: [number, number][] = [];
    const result = await bulkCreate(makeRows(150), (imported, total) => progress.push([imported, total]));

    expect(chunk1.insert.mock.calls[0][0]).toHaveLength(100);
    expect(chunk2.insert.mock.calls[0][0]).toHaveLength(50);
    expect(result).toHaveLength(150);
    // Sequential, not parallel — the second chunk's insert only happens
    // after the first has already resolved (docs/10-data-import-export.md).
    expect(progress).toEqual([
      [100, 150],
      [150, 150],
    ]);
  });

  it('reports how many rows committed before a later chunk fails', async () => {
    const chunk1 = makeChain({ data: makeRows(100).map((r, i) => ({ id: `a${i}`, ...r })), error: null });
    const chunk2 = makeChain({ data: null, error: { code: '23514', message: 'check constraint violated' } });
    from.mockReturnValueOnce(chunk1).mockReturnValueOnce(chunk2);

    // "Imported 100 of 150" must be a statement bulkCreate can make
    // truthfully — that's the entire reason chunks run sequentially.
    await expect(bulkCreate(makeRows(150))).rejects.toMatchObject({
      name: 'PartialImportError',
      importedCount: 100,
      totalCount: 150,
    });
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
