type SkeletonProps = { variant: 'card' | 'row'; count?: number };

// Static blocks only — no shimmer animation. A pulsing shimmer across a dozen
// cards is more distracting than a still placeholder (docs/04-design-system.md).
export function Skeleton({ variant, count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) =>
        variant === 'card' ? (
          <div key={i} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <div className="h-4 w-2/3 rounded bg-slate-100" />
            <div className="h-3 w-1/2 rounded bg-slate-100" />
            <div className="h-3 w-1/3 rounded bg-slate-100" />
          </div>
        ) : (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-3 py-2.5">
            <div className="h-3 w-1/6 rounded bg-slate-100" />
            <div className="h-3 w-1/4 rounded bg-slate-100" />
            <div className="h-3 w-1/6 rounded bg-slate-100" />
            <div className="h-3 w-1/6 rounded bg-slate-100" />
          </div>
        )
      )}
    </>
  );
}
