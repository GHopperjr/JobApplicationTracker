import { SegmentedToggle } from '../ui/SegmentedToggle';

type ViewToggleProps = {
  view: 'kanban' | 'table';
  onChange: (view: 'kanban' | 'table') => void;
};

const OPTIONS: { value: 'kanban' | 'table'; label: string }[] = [
  { value: 'kanban', label: 'Board' },
  { value: 'table', label: 'Table' },
];

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return <SegmentedToggle ariaLabel="View" options={OPTIONS} value={view} onChange={onChange} />;
}
