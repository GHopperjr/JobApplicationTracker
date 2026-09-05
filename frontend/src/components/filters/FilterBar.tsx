import { useEffect, useState } from 'react';
import type { PlatformSource } from '../../constants/platforms';
import type { ApplicationStatus } from '../../constants/status';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { ApplicationFilters } from '../../services/applicationsService';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { PlatformFilter } from './PlatformFilter';
import { StatusFilter } from './StatusFilter';

type FilterBarProps = {
  filters: ApplicationFilters;
  onChange: (next: Partial<ApplicationFilters>) => void;
};

const hasActiveFilters = (filters: ApplicationFilters) =>
  Boolean(filters.status?.length || filters.platform?.length || filters.search);

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = (filters.status?.length ?? 0) + (filters.platform?.length ?? 0);
  const externalSearch = filters.search ?? '';

  // The input itself is never debounced (must feel instant while typing);
  // only the URL write is. Re-sync local state when the URL's `q` changes
  // for a reason other than this component's own typing (e.g. Clear all) —
  // adjusted during render, not in an effect, so it can't race the debounce
  // timer below.
  const [inputValue, setInputValue] = useState(externalSearch);
  const [lastExternalSearch, setLastExternalSearch] = useState(externalSearch);
  if (externalSearch !== lastExternalSearch) {
    setLastExternalSearch(externalSearch);
    setInputValue(externalSearch);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== externalSearch) {
        setLastExternalSearch(inputValue);
        onChange({ search: inputValue });
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the debounced value should restart the timer
  }, [inputValue]);

  const clearAll = () => {
    setInputValue('');
    setLastExternalSearch('');
    onChange({ status: [], platform: [], search: '' });
  };

  const searchInput = (
    <input
      type="search"
      placeholder="Search company or job title"
      aria-label="Search applications"
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      className="w-56 rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
    />
  );

  // Desktop shows both filter groups inline; on a narrow viewport they move
  // into a bottom sheet so the bar itself stays a single row
  // (docs/06 Phase 5).
  if (isMobile) {
    return (
      <div className="flex items-center gap-2 px-4 py-3">
        <input
          type="search"
          placeholder="Search company or job title"
          aria-label="Search applications"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="h-11 flex-1 rounded-md border border-slate-200 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
        />
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="relative flex h-11 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        <Modal
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="Filters"
          footer={
            <div className="flex gap-2">
              {hasActiveFilters(filters) && (
                <Button variant="secondary" className="flex-1" onClick={clearAll}>
                  Clear all
                </Button>
              )}
              <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                Show results
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Status
              </p>
              <StatusFilter
                selected={filters.status ?? []}
                onChange={(status: ApplicationStatus[]) => onChange({ status })}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Platform
              </p>
              <PlatformFilter
                selected={filters.platform ?? []}
                onChange={(platform: PlatformSource[]) => onChange({ platform })}
              />
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-3">
      {searchInput}
      <StatusFilter
        selected={filters.status ?? []}
        onChange={(status: ApplicationStatus[]) => onChange({ status })}
      />
      <PlatformFilter
        selected={filters.platform ?? []}
        onChange={(platform: PlatformSource[]) => onChange({ platform })}
      />
      {hasActiveFilters(filters) && (
        <button type="button" onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-700">
          Clear all
        </button>
      )}
    </div>
  );
}
