import { PLATFORM_LABELS, PLATFORM_ORDER, type PlatformSource } from '../../constants/platforms';
import { MultiSelectFilter } from '../ui/MultiSelectFilter';

type PlatformFilterProps = {
  selected: PlatformSource[];
  onChange: (selected: PlatformSource[]) => void;
};

export function PlatformFilter({ selected, onChange }: PlatformFilterProps) {
  return (
    <MultiSelectFilter
      ariaLabel="Filter by platform"
      options={PLATFORM_ORDER}
      labels={PLATFORM_LABELS}
      selected={selected}
      onChange={onChange}
    />
  );
}
