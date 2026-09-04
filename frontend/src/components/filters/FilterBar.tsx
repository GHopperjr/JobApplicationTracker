import { useEffect, useState } from 'react';
import type { PlatformSource } from '../../constants/platforms';
import type { ApplicationStatus } from '../../constants/status';
import type { ApplicationFilters } from '../../services/applicationsService';
import { PlatformFilter } from './PlatformFilter';
import { StatusFilter } from './StatusFilter';

type FilterBarProps = {
  filters: ApplicationFilters;
  onChange: (next: Partial<ApplicationFilters>) => void;
};

const hasActiveFilters = (filters: ApplicationFilters) =>
  Boolean(filters.status?.length || filters.platform?.length || filters.search);

export function FilterBar({ filters, onChange }: FilterBarProps) {
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

  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-3">
      <input
        type="search"
        placeholder="Search company or job title"
        aria-label="Search applications"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="w-56 rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
      />
      <StatusFilter
        selected={filters.status ?? []}
        onChange={(status: ApplicationStatus[]) => onChange({ status })}
      />
      <PlatformFilter
        selected={filters.platform ?? []}
        onChange={(platform: PlatformSource[]) => onChange({ platform })}
      />
      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={() => {
            setInputValue('');
            setLastExternalSearch('');
            onChange({ status: [], platform: [], search: '' });
          }}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
