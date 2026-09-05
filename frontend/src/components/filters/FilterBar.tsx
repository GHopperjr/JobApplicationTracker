import { useEffect, useRef, useState } from 'react';
import type { PlatformSource } from '../../constants/platforms';
import type { ApplicationStatus } from '../../constants/status';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { cn } from '../../lib/cn';
import type { ApplicationFilters } from '../../services/applicationsService';
import { Button } from '../ui/Button';
import { DropdownMenu } from '../ui/DropdownMenu';
import { Modal } from '../ui/Modal';
import { PlatformFilter } from './PlatformFilter';
import { StatusFilter } from './StatusFilter';

type FilterBarProps = {
  filters: ApplicationFilters;
  onChange: (next: Partial<ApplicationFilters>) => void;
  /** Count of currently-stale applications, for the "Needs follow-up" chip
   * label. Hidden entirely (chip and all) when the threshold is Off
   * (docs/05 F10). */
  staleCount: number;
  showStaleOnly: boolean;
  onToggleStaleOnly: () => void;
  staleThresholdDays: number | null;
  onChangeStaleThreshold: (days: number | null) => void;
};

const ARCHIVED_OPTIONS: { value: NonNullable<ApplicationFilters['archived']>; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];

const THRESHOLD_OPTIONS: { value: number | null; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: null, label: 'Off' },
];

const hasActiveFilters = (filters: ApplicationFilters) =>
  Boolean(filters.status?.length || filters.platform?.length || filters.search);

function RadioMenuItem({
  label,
  checked,
  onSelect,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'block min-h-11 w-full px-3 py-1.5 text-left text-sm transition-colors duration-100 hover:bg-slate-50',
        checked ? 'font-semibold text-slate-900' : 'text-slate-700'
      )}
    >
      {label}
    </button>
  );
}

// The Archived scope and the stale threshold are both *modes*, not filters —
// deliberately not chips, so neither implies it's one click away from the
// normal view the way Status/Platform chips do (docs/05 F7).
function OverflowSections({
  archived,
  onChangeArchived,
  staleThresholdDays,
  onChangeStaleThreshold,
  onDone,
}: {
  archived: NonNullable<ApplicationFilters['archived']>;
  onChangeArchived: (value: NonNullable<ApplicationFilters['archived']>) => void;
  staleThresholdDays: number | null;
  onChangeStaleThreshold: (days: number | null) => void;
  onDone: () => void;
}) {
  return (
    <>
      <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Show
      </p>
      {ARCHIVED_OPTIONS.map((option) => (
        <RadioMenuItem
          key={option.value}
          label={option.label}
          checked={archived === option.value}
          onSelect={() => {
            onChangeArchived(option.value);
            onDone();
          }}
        />
      ))}
      <div className="my-1 border-t border-slate-100" />
      <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Follow-up reminder
      </p>
      {THRESHOLD_OPTIONS.map((option) => (
        <RadioMenuItem
          key={String(option.value)}
          label={option.label}
          checked={staleThresholdDays === option.value}
          onSelect={() => {
            onChangeStaleThreshold(option.value);
            onDone();
          }}
        />
      ))}
    </>
  );
}

export function FilterBar({
  filters,
  onChange,
  staleCount,
  showStaleOnly,
  onToggleStaleOnly,
  staleThresholdDays,
  onChangeStaleThreshold,
}: FilterBarProps) {
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowTriggerRef = useRef<HTMLButtonElement>(null);
  const activeFilterCount = (filters.status?.length ?? 0) + (filters.platform?.length ?? 0);
  const archived = filters.archived ?? 'active';
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

  const staleChip = staleThresholdDays !== null && (
    <button
      type="button"
      aria-pressed={showStaleOnly}
      onClick={onToggleStaleOnly}
      className={cn(
        'h-11 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors duration-100 sm:h-auto sm:py-1',
        showStaleOnly
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      )}
    >
      Needs follow-up · {staleCount}
    </button>
  );

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
        {staleChip}
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
            {/* Folded into the same sheet rather than a second nested
                overlay — a dropdown popping out of an already-open bottom
                sheet is awkward to reach on a phone. */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Show
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ARCHIVED_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={archived === option.value}
                    onClick={() => onChange({ archived: option.value })}
                    className={cn(
                      'min-h-11 rounded-full border px-3 text-xs font-medium transition-colors duration-100',
                      archived === option.value
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Follow-up reminder
              </p>
              <div className="flex flex-wrap gap-1.5">
                {THRESHOLD_OPTIONS.map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    aria-pressed={staleThresholdDays === option.value}
                    onClick={() => onChangeStaleThreshold(option.value)}
                    className={cn(
                      'min-h-11 rounded-full border px-3 text-xs font-medium transition-colors duration-100',
                      staleThresholdDays === option.value
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
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
      {staleChip}
      <div>
        <button
          ref={overflowTriggerRef}
          type="button"
          aria-label="More filter options"
          aria-expanded={overflowOpen}
          aria-haspopup="menu"
          onClick={() => setOverflowOpen((open) => !open)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors duration-100 hover:bg-slate-100 hover:text-slate-700"
        >
          ⋯
        </button>
        <DropdownMenu
          isOpen={overflowOpen}
          onClose={() => setOverflowOpen(false)}
          triggerRef={overflowTriggerRef}
          className="w-56"
        >
          <OverflowSections
            archived={archived}
            onChangeArchived={(value) => onChange({ archived: value })}
            staleThresholdDays={staleThresholdDays}
            onChangeStaleThreshold={onChangeStaleThreshold}
            onDone={() => setOverflowOpen(false)}
          />
        </DropdownMenu>
      </div>
      {hasActiveFilters(filters) && (
        <button type="button" onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-700">
          Clear all
        </button>
      )}
    </div>
  );
}
