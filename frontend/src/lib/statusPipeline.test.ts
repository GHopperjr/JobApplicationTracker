import { describe, expect, it } from 'vitest';
import { getSkippedStages } from './statusPipeline';

describe('getSkippedStages', () => {
  it('returns [] for an adjacent forward move', () => {
    expect(getSkippedStages('pending_application', 'scheduled_for_interview')).toEqual([]);
  });

  it('returns the skipped stage for a one-stage skip', () => {
    expect(getSkippedStages('pending_application', 'interviewed')).toEqual([
      'scheduled_for_interview',
    ]);
  });

  it('returns every skipped stage for a two-stage skip', () => {
    expect(getSkippedStages('pending_application', 'accepted')).toEqual([
      'scheduled_for_interview',
      'interviewed',
    ]);
  });

  it('returns [] for a backward move, even a large one', () => {
    expect(getSkippedStages('accepted', 'pending_application')).toEqual([]);
  });

  it('returns [] for a move into Rejected from anywhere', () => {
    expect(getSkippedStages('pending_application', 'rejected')).toEqual([]);
    expect(getSkippedStages('scheduled_for_interview', 'rejected')).toEqual([]);
  });

  it('returns [] for a move out of Rejected to anywhere', () => {
    expect(getSkippedStages('rejected', 'accepted')).toEqual([]);
  });

  it('returns [] for a no-op move to the same status', () => {
    expect(getSkippedStages('pending_application', 'pending_application')).toEqual([]);
  });
});
