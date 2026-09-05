import { STATUS_LABELS, STATUS_ORDER, type ApplicationStatus } from '../../constants/status';
import { MultiSelectFilter } from '../ui/MultiSelectFilter';

type StatusFilterProps = {
  selected: ApplicationStatus[];
  onChange: (selected: ApplicationStatus[]) => void;
};

export function StatusFilter({ selected, onChange }: StatusFilterProps) {
  return (
    <MultiSelectFilter
      ariaLabel="Filter by status"
      options={STATUS_ORDER}
      labels={STATUS_LABELS}
      selected={selected}
      onChange={onChange}
    />
  );
}
