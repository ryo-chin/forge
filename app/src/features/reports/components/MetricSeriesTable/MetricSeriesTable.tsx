import type { MetricSeriesRow } from '../../domain/aggregation.ts';

type MetricSeriesTableProps = {
  rows: MetricSeriesRow[];
  valueHeader: string;
  formatValue: (value: number) => string;
};

export function MetricSeriesTable({
  rows,
  valueHeader,
  formatValue,
}: MetricSeriesTableProps): JSX.Element {
  return (
    <div className="reports__table-wrap">
      <table className="reports__table">
        <thead>
          <tr>
            <th className="reports__th-date">期間</th>
            <th>{valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date}>
              <td className="reports__td-date">{row.label}</td>
              <td>{row.value == null ? '—' : formatValue(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
