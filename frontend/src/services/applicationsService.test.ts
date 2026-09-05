import { describe, expect, it, vi } from 'vitest';

const single = vi.fn();
const select = vi.fn(() => ({ single }));
const insert = vi.fn(() => ({ select }));
const from = vi.fn((_table: string) => ({ insert }));

vi.mock('./supabaseClient', () => ({
  supabase: { from: (table: string) => from(table) },
}));

// Imported after the mock so applicationsService picks up the mocked client.
const { createApplication } = await import('./applicationsService');

describe('createApplication', () => {
  it('normalizes blank optional fields to null before sending to Postgres', async () => {
    single.mockResolvedValue({ data: { id: '1' }, error: null });

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
    expect(insert).toHaveBeenCalledWith(
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
