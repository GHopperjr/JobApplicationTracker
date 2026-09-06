import { useMatchScore } from '../../hooks/useMatchScore';
import type { Application } from '../../services/applicationsService';
import { Button } from '../ui/Button';

type MatchScoreProps = {
  application: Application;
};

/**
 * The drawer's match-score button/result/stale-notice states
 * (docs/14-ai-match-scoring.md). Renders nothing at all — no disabled
 * button, no explanatory placeholder — when either a resume or a job
 * description is missing, the same "no placeholder" contract every other
 * distance/metrics surface in this app already follows.
 */
export function MatchScore({ application }: MatchScoreProps) {
  const { canCalculate, isStale, hasResult, percentage, explanation, calculate, isCalculating, failed, resetFailed } =
    useMatchScore(application);

  if (!canCalculate && !hasResult) return null;

  const handleCalculate = async () => {
    resetFailed();
    try {
      await calculate();
    } catch {
      // Surfaced via `failed` below — a failed call never touches a
      // previously cached result.
    }
  };

  return (
    <div className="border-t border-slate-200 px-4 py-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
        Resume Match
      </h2>

      {hasResult && (
        <div>
          <p className="text-2xl font-semibold text-slate-900">{percentage}%</p>
          <p className="mt-1 text-sm text-slate-700">{explanation}</p>
        </div>
      )}

      {isStale && canCalculate && (
        <p className="mt-2 text-xs text-amber-700">Resume or description updated since this was calculated.</p>
      )}

      {failed && (
        <p role="alert" className="mt-2 text-xs text-rose-600">
          Couldn't calculate a match — try again.
        </p>
      )}

      {canCalculate && (!hasResult || isStale) && (
        <Button
          variant="secondary"
          className="mt-3"
          isLoading={isCalculating}
          onClick={() => void handleCalculate()}
        >
          {hasResult ? 'Recalculate' : 'Calculate Match'}
        </Button>
      )}
    </div>
  );
}
