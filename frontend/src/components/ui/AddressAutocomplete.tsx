import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Coordinates } from '../../lib/distance';
import { cn } from '../../lib/cn';
import { searchPlaces, type PlaceSuggestion } from '../../services/geocodingService';
import { DropdownMenu } from './DropdownMenu';

export type ResolvedPlace = { address: string; name: string | null; coordinates: Coordinates };

type AddressAutocompleteProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Fires with the picked suggestion the moment one is selected, and with
   * `null` on every edit after that — this is how the parent form knows
   * whether it's holding a confirmed point or just free-typed text that
   * still needs the write-time geocode fallback. */
  onResolvedChange: (resolved: ResolvedPlace | null) => void;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
};

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;

/**
 * A free-text field backed by live place search (docs/11-navigation-and-distance.md).
 * Typing fires a debounced Photon query; picking a suggestion fills the
 * field with a clean formatted address and hands the parent its resolved
 * coordinates (and the place's own name, when it has one — "PNB", not just
 * an address). Nothing is forced: the field stays a plain free-text input
 * that still submits whatever's typed even if no suggestion is ever picked,
 * with the existing write-time `geocodeAddress` fallback covering that case.
 */
export function AddressAutocomplete({
  label,
  value,
  onChange,
  onResolvedChange,
  required,
  error,
  hint,
  placeholder,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  // Only search once the user actually types — a modal opened in edit mode
  // pre-fills this field with an already-saved value, and that alone
  // shouldn't fire a query.
  const [hasTyped, setHasTyped] = useState(false);
  const skipNextSearchRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fieldId = useId();
  const listboxId = `${fieldId}-listbox`;
  const errorId = error ? `${fieldId}-error` : undefined;
  const hintId = !error && hint ? `${fieldId}-hint` : undefined;

  // The immediate UI reaction to a value change (show "Searching…", or
  // close/clear once the text drops below the minimum length) is adjusted
  // synchronously during render rather than in the effect below — the same
  // pattern used throughout this codebase (e.g. FilterBar's own search
  // debounce) for exactly this reason (react-hooks/set-state-in-effect).
  // Refs cannot be read during render (react-hooks/refs), so this can't
  // check the skip-flag directly — instead, `handleSelect` below pre-syncs
  // `lastValue` itself, which makes this block's condition already false by
  // the time a selection's value change reaches this render, with no ref
  // access needed here at all.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (hasTyped) {
      if (value.trim().length < MIN_QUERY_LENGTH) {
        setSuggestions([]);
        setIsSearching(false);
        setIsOpen(false);
      } else {
        setIsSearching(true);
        setIsOpen(true);
      }
    }
  }

  // The actual network call is genuinely effect-shaped — a debounced,
  // cancellable subscription to an external service — so it stays here.
  useEffect(() => {
    if (!hasTyped) return;
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    if (value.trim().length < MIN_QUERY_LENGTH) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await searchPlaces(value);
      if (cancelled) return;
      setSuggestions(results);
      setIsSearching(false);
      if (results.length === 0) setIsOpen(false);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, hasTyped]);

  // Reset the highlight whenever the candidate list itself changes, rather
  // than leaving a stale index pointed at a suggestion that no longer
  // exists — same render-time pattern as above, not an effect.
  const [lastSuggestions, setLastSuggestions] = useState(suggestions);
  if (suggestions !== lastSuggestions) {
    setLastSuggestions(suggestions);
    setHighlightedIndex(-1);
  }

  const handleInputChange = (next: string) => {
    setHasTyped(true);
    onChange(next);
    onResolvedChange(null);
  };

  const handleSelect = (suggestion: PlaceSuggestion) => {
    skipNextSearchRef.current = true;
    setLastValue(suggestion.address);
    onChange(suggestion.address);
    onResolvedChange({
      address: suggestion.address,
      name: suggestion.name,
      coordinates: suggestion.coordinates,
    });
    setSuggestions([]);
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      handleSelect(suggestions[highlightedIndex >= 0 ? highlightedIndex : 0]);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        ref={inputRef}
        id={fieldId}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={highlightedIndex >= 0 ? `${listboxId}-${highlightedIndex}` : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId ?? hintId}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        className={cn(
          'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900',
          'focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1',
          error && 'border-rose-300'
        )}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}

      <DropdownMenu
        isOpen={isOpen && (suggestions.length > 0 || isSearching)}
        onClose={() => setIsOpen(false)}
        triggerRef={inputRef}
        align="start"
        matchTriggerWidth
        role="listbox"
        id={listboxId}
        className="max-h-64 overflow-y-auto"
      >
        {isSearching && suggestions.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate-400">Searching…</p>
        ) : (
          suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              id={`${listboxId}-${index}`}
              type="button"
              role="option"
              aria-selected={index === highlightedIndex}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => handleSelect(suggestion)}
              className={cn(
                'block w-full px-3 py-2 text-left text-sm transition-colors duration-100',
                index === highlightedIndex ? 'bg-slate-50' : 'text-slate-700'
              )}
            >
              {suggestion.name ? (
                <>
                  <span className="block font-medium text-slate-900">{suggestion.name}</span>
                  <span className="block truncate text-xs text-slate-500">{suggestion.address}</span>
                </>
              ) : (
                <span className="block truncate">{suggestion.address}</span>
              )}
            </button>
          ))
        )}
      </DropdownMenu>
    </div>
  );
}
