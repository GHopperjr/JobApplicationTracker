import { PLATFORM_LABELS, PLATFORM_ORDER, type PlatformSource } from '../../constants/platforms';
import { cn } from '../../lib/cn';

type PlatformFilterProps = {
  selected: PlatformSource[];
  onChange: (selected: PlatformSource[]) => void;
};

export function PlatformFilter({ selected, onChange }: PlatformFilterProps) {
  const toggle = (platform: PlatformSource) => {
    onChange(
      selected.includes(platform) ? selected.filter((p) => p !== platform) : [...selected, platform]
    );
  };

  return (
    <div role="group" aria-label="Filter by platform" className="flex flex-wrap gap-1.5">
      {PLATFORM_ORDER.map((platform) => (
        <button
          key={platform}
          type="button"
          aria-pressed={selected.includes(platform)}
          onClick={() => toggle(platform)}
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-100',
            selected.includes(platform)
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          )}
        >
          {PLATFORM_LABELS[platform]}
        </button>
      ))}
    </div>
  );
}
