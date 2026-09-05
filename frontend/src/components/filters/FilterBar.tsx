import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PlatformSource } from '../../constants/platforms';
import type { ApplicationStatus } from '../../constants/status';
import { STALE_THRESHOLD_DAYS_DEFAULT } from '../../constants/staleness';
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
  /** Exports exactly what's currently filtered/sorted into view (docs/10 Part 1). */
  onExportCurrent: () => void;
  onExportAll: () => void;
  onOpenImport: () => void;
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

function ActionMenuItem({ label, onSelect }: { label: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="block min-h-11 w-full px-3.5 py-2 text-left text-sm font-medium text-slate-800 transition-colors duration-100 hover:bg-slate-100 sm:h-auto"
    >
      {label}
    </button>
  );
}

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
        'flex min-h-11 w-full items-center gap-2 px-3.5 py-2 text-left text-sm transition-colors duration-100 hover:bg-slate-100',
        checked ? 'font-semibold text-slate-900' : 'text-slate-700'
      )}
    >
      {/* Reserved even when unchecked, so the label doesn't shift left/right
          as selection changes between items. */}
      <span className="w-3.5 shrink-0 text-slate-900" aria-hidden="true">
        {checked && '✓'}
      </span>
      {label}
    </button>
  );
}

/**
 * A labeled, always-visible chip that opens a small menu — the trigger
 * itself states the current value ("Show: Archived"), so the state is
 * readable without opening anything. Replaces a bare, unlabeled "⋯" that
 * hid the Archived scope and the follow-up threshold behind an icon nobody
 * had a reason to click (docs/05 F7's "Archived scope and stale threshold
 * are modes, not filters" still holds — they're just modes worth seeing).
 */
function ChipDropdown({
  label,
  highlighted,
  align = 'start',
  isOpen,
  onOpenChange,
  menuClassName,
  children,
}: {
  label: string;
  highlighted?: boolean;
  align?: 'start' | 'end';
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  menuClassName?: string;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => onOpenChange(!isOpen)}
        className={cn(
          'flex h-11 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors duration-100 sm:h-auto sm:py-1',
          highlighted
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        )}
      >
        {label}
        <span aria-hidden="true" className="text-[9px]">
          ▾
        </span>
      </button>
      <DropdownMenu
        isOpen={isOpen}
        onClose={() => onOpenChange(false)}
        triggerRef={triggerRef}
        align={align}
        className={cn('w-48', menuClassName)}
      >
        {children}
      </DropdownMenu>
    </div>
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
  onExportCurrent,
  onExportAll,
  onOpenImport,
}: FilterBarProps) {
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  // At most one of the three chip menus open at a time.
  const [openMenu, setOpenMenu] = useState<'show' | 'reminder' | 'data' | null>(null);
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
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Data
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setFiltersOpen(false);
                    onExportCurrent();
                  }}
                  className="min-h-11 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFiltersOpen(false);
                    onExportAll();
                  }}
                  className="min-h-11 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Export all as CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFiltersOpen(false);
                    onOpenImport();
                  }}
                  className="min-h-11 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Import CSV
                </button>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  const archivedLabel = ARCHIVED_OPTIONS.find((o) => o.value === archived)?.label ?? 'Active';
  const thresholdLabel = THRESHOLD_OPTIONS.find((o) => o.value === staleThresholdDays)?.label ?? 'Off';

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
      <ChipDropdown
        label={`Show: ${archivedLabel}`}
        highlighted={archived !== 'active'}
        isOpen={openMenu === 'show'}
        onOpenChange={(open) => setOpenMenu(open ? 'show' : null)}
      >
        {ARCHIVED_OPTIONS.map((option) => (
          <RadioMenuItem
            key={option.value}
            label={option.label}
            checked={archived === option.value}
            onSelect={() => {
              onChange({ archived: option.value });
              setOpenMenu(null);
            }}
          />
        ))}
      </ChipDropdown>
      {staleChip}
      <ChipDropdown
        label={`Reminder: ${thresholdLabel}`}
        highlighted={staleThresholdDays !== STALE_THRESHOLD_DAYS_DEFAULT}
        isOpen={openMenu === 'reminder'}
        onOpenChange={(open) => setOpenMenu(open ? 'reminder' : null)}
      >
        {THRESHOLD_OPTIONS.map((option) => (
          <RadioMenuItem
            key={String(option.value)}
            label={option.label}
            checked={staleThresholdDays === option.value}
            onSelect={() => {
              onChangeStaleThreshold(option.value);
              setOpenMenu(null);
            }}
          />
        ))}
      </ChipDropdown>
      {/* The one genuinely rare control (docs/10) — labeled rather than a
          bare icon, and pushed to the far end since nothing else here needs
          finding it quickly. */}
      <ChipDropdown
        label="More"
        align="end"
        isOpen={openMenu === 'data'}
        onOpenChange={(open) => setOpenMenu(open ? 'data' : null)}
        menuClassName="w-56"
      >
        <ActionMenuItem
          label="Export CSV"
          onSelect={() => {
            onExportCurrent();
            setOpenMenu(null);
          }}
        />
        <ActionMenuItem
          label="Export all as CSV"
          onSelect={() => {
            onExportAll();
            setOpenMenu(null);
          }}
        />
        <ActionMenuItem
          label="Import CSV"
          onSelect={() => {
            onOpenImport();
            setOpenMenu(null);
          }}
        />
      </ChipDropdown>
      {hasActiveFilters(filters) && (
        <button type="button" onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-700">
          Clear all
        </button>
      )}
    </div>
  );
}
