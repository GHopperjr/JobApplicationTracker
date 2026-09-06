import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Application } from '../services/applicationsService';
import { useStatusChangeGuard } from './useStatusChangeGuard';

const application = (overrides: Partial<Application> = {}) =>
  ({
    id: 'app-1',
    status: 'pending_application',
    interview_scheduled_at: null,
    ...overrides,
  }) as Application;

describe('useStatusChangeGuard', () => {
  it('commits immediately for an adjacent forward move', () => {
    const onChangeStatus = vi.fn();
    const { result } = renderHook(() =>
      useStatusChangeGuard({
        applications: [application()],
        onChangeStatus,
        onBulkChangeStatus: vi.fn(),
      })
    );

    act(() => result.current.requestStatusChange('app-1', 'rejected'));

    expect(onChangeStatus).toHaveBeenCalledWith('app-1', 'rejected', undefined);
    expect(result.current.skipConfirm).toBeNull();
    expect(result.current.scheduleModalOpen).toBe(false);
  });

  it('holds a forward skip behind skipConfirm and does not commit yet', () => {
    const onChangeStatus = vi.fn();
    const { result } = renderHook(() =>
      useStatusChangeGuard({
        applications: [application()],
        onChangeStatus,
        onBulkChangeStatus: vi.fn(),
      })
    );

    act(() => result.current.requestStatusChange('app-1', 'interviewed'));

    expect(onChangeStatus).not.toHaveBeenCalled();
    expect(result.current.skipConfirm).toEqual({
      skippedStages: ['scheduled_for_interview'],
      count: 1,
    });
  });

  it('commits after confirming a skip', () => {
    const onChangeStatus = vi.fn();
    const { result } = renderHook(() =>
      useStatusChangeGuard({
        applications: [application()],
        onChangeStatus,
        onBulkChangeStatus: vi.fn(),
      })
    );

    act(() => result.current.requestStatusChange('app-1', 'interviewed'));
    act(() => result.current.confirmSkip());

    expect(onChangeStatus).toHaveBeenCalledWith('app-1', 'interviewed', undefined);
    expect(result.current.skipConfirm).toBeNull();
  });

  it('cancels a skip without ever committing', () => {
    const onChangeStatus = vi.fn();
    const { result } = renderHook(() =>
      useStatusChangeGuard({
        applications: [application()],
        onChangeStatus,
        onBulkChangeStatus: vi.fn(),
      })
    );

    act(() => result.current.requestStatusChange('app-1', 'interviewed'));
    act(() => result.current.cancelSkip());

    expect(onChangeStatus).not.toHaveBeenCalled();
    expect(result.current.skipConfirm).toBeNull();
  });

  it('opens the schedule modal for a non-skipping move to Scheduled for Interview', () => {
    const onChangeStatus = vi.fn();
    const { result } = renderHook(() =>
      useStatusChangeGuard({
        applications: [application()],
        onChangeStatus,
        onBulkChangeStatus: vi.fn(),
      })
    );

    act(() => result.current.requestStatusChange('app-1', 'scheduled_for_interview'));

    expect(onChangeStatus).not.toHaveBeenCalled();
    expect(result.current.skipConfirm).toBeNull();
    expect(result.current.scheduleModalOpen).toBe(true);
  });

  it('saves a date from the schedule modal', () => {
    const onChangeStatus = vi.fn();
    const { result } = renderHook(() =>
      useStatusChangeGuard({
        applications: [application()],
        onChangeStatus,
        onBulkChangeStatus: vi.fn(),
      })
    );

    act(() => result.current.requestStatusChange('app-1', 'scheduled_for_interview'));
    act(() => result.current.saveSchedule('2026-09-10T14:30:00.000Z'));

    expect(onChangeStatus).toHaveBeenCalledWith(
      'app-1',
      'scheduled_for_interview',
      '2026-09-10T14:30:00.000Z'
    );
    expect(result.current.scheduleModalOpen).toBe(false);
  });

  it('skipping the schedule modal still moves the card, with no date argument', () => {
    const onChangeStatus = vi.fn();
    const { result } = renderHook(() =>
      useStatusChangeGuard({
        applications: [application()],
        onChangeStatus,
        onBulkChangeStatus: vi.fn(),
      })
    );

    act(() => result.current.requestStatusChange('app-1', 'scheduled_for_interview'));
    act(() => result.current.skipSchedule());

    expect(onChangeStatus).toHaveBeenCalledWith('app-1', 'scheduled_for_interview', undefined);
  });

  it('closing the schedule modal aborts the move entirely', () => {
    const onChangeStatus = vi.fn();
    const { result } = renderHook(() =>
      useStatusChangeGuard({
        applications: [application()],
        onChangeStatus,
        onBulkChangeStatus: vi.fn(),
      })
    );

    act(() => result.current.requestStatusChange('app-1', 'scheduled_for_interview'));
    act(() => result.current.closeSchedule());

    expect(onChangeStatus).not.toHaveBeenCalled();
    expect(result.current.scheduleModalOpen).toBe(false);
  });

  it('pre-fills the schedule modal with the application’s existing date', () => {
    const { result } = renderHook(() =>
      useStatusChangeGuard({
        applications: [application({ interview_scheduled_at: '2026-09-01T09:00:00.000Z' })],
        onChangeStatus: vi.fn(),
        onBulkChangeStatus: vi.fn(),
      })
    );

    act(() => result.current.requestStatusChange('app-1', 'scheduled_for_interview'));

    expect(result.current.scheduleInitialValue).toBe('2026-09-01T09:00:00.000Z');
  });

  it('bulk: flags the group if ANY selected application would skip a stage', () => {
    const onBulkChangeStatus = vi.fn();
    const { result } = renderHook(() =>
      useStatusChangeGuard({
        applications: [
          application({ id: 'a', status: 'pending_application' }),
          application({ id: 'b', status: 'scheduled_for_interview' }),
        ],
        onChangeStatus: vi.fn(),
        onBulkChangeStatus,
      })
    );

    act(() => result.current.requestBulkStatusChange(['a', 'b'], 'accepted'));

    expect(onBulkChangeStatus).not.toHaveBeenCalled();
    expect(result.current.skipConfirm).toEqual({
      skippedStages: ['scheduled_for_interview', 'interviewed'],
      count: 2,
    });

    act(() => result.current.confirmSkip());
    expect(onBulkChangeStatus).toHaveBeenCalledWith(['a', 'b'], 'accepted', undefined);
  });

  it('bulk: does not gate a move with no skips for any selected application', () => {
    const onBulkChangeStatus = vi.fn();
    const { result } = renderHook(() =>
      useStatusChangeGuard({
        applications: [
          application({ id: 'a', status: 'pending_application' }),
          application({ id: 'b', status: 'pending_application' }),
        ],
        onChangeStatus: vi.fn(),
        onBulkChangeStatus,
      })
    );

    act(() => result.current.requestBulkStatusChange(['a', 'b'], 'rejected'));

    expect(onBulkChangeStatus).toHaveBeenCalledWith(['a', 'b'], 'rejected', undefined);
  });
});
