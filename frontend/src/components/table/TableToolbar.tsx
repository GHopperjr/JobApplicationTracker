// Search, filters, sort, and bulk actions land here in Phase 4
// (docs/06-implementation-roadmap.md). For now this just orients the count.
export function TableToolbar({ count }: { count: number }) {
  return (
    <div className="px-6 pt-4 text-xs text-slate-500">
      {count} {count === 1 ? 'application' : 'applications'}
    </div>
  );
}
