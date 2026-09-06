import {
  AUDIENCE_FILTER_LABELS,
  AUDIENCE_FILTER_VALUES,
  type AudienceFilterValue,
} from '../../constants/experienceLevel';
import { MultiSelectFilter } from '../ui/MultiSelectFilter';

type AudienceFilterProps = {
  selected: AudienceFilterValue[];
  onChange: (selected: AudienceFilterValue[]) => void;
};

export function AudienceFilter({ selected, onChange }: AudienceFilterProps) {
  return (
    <MultiSelectFilter
      ariaLabel="Filter by career stage"
      options={AUDIENCE_FILTER_VALUES}
      labels={AUDIENCE_FILTER_LABELS}
      selected={selected}
      onChange={onChange}
    />
  );
}
