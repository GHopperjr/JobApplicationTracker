import { describe, expect, it, vi } from 'vitest';

function makeChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn((..._args: unknown[]) => chain),
    eq: vi.fn((..._args: unknown[]) => chain),
    order: vi.fn((..._args: unknown[]) => chain),
    then: (onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return chain;
}

const from = vi.fn();
vi.mock('./supabaseClient', () => ({
  supabase: { from: (table: string) => from(table) },
}));

const { listStatusHistory } = await import('./statusHistoryService');

describe('listStatusHistory', () => {
  it('requests all rows without an application filter', async () => {
    const chain = makeChain({ data: [], error: null });
    from.mockReturnValue(chain);

    await listStatusHistory();

    expect(from).toHaveBeenCalledWith('status_history');
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.eq).not.toHaveBeenCalled();
  });

  it('returns [] rather than throwing on a query error', async () => {
    from.mockReturnValue(makeChain({ data: null, error: new Error('boom') }));

    await expect(listStatusHistory()).resolves.toEqual([]);
  });

  it('returns [] rather than throwing when the client itself rejects', async () => {
    from.mockImplementation(() => {
      throw new Error('offline');
    });

    await expect(listStatusHistory()).resolves.toEqual([]);
  });
});
