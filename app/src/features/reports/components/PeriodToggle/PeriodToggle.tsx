import type { PeriodUnit } from '../../domain/types.ts';

type PeriodToggleProps = {
  value: PeriodUnit;
  onChange: (unit: PeriodUnit) => void;
};

const OPTIONS: { unit: PeriodUnit; label: string }[] = [
  { unit: 'day', label: '日次' },
  { unit: 'week', label: '週次' },
  { unit: 'month', label: '月次' },
];

export function PeriodToggle({ value, onChange }: PeriodToggleProps): JSX.Element {
  return (
    <div className="reports__segmented" role="tablist" aria-label="集計単位">
      {OPTIONS.map((option) => {
        const isActive = option.unit === value;
        return (
          <button
            key={option.unit}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`reports__segmented-item ${isActive ? 'reports__segmented-item--active' : ''}`}
            onClick={() => onChange(option.unit)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
