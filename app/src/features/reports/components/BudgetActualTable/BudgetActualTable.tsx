import { formatHours, formatHoursSigned } from '../../domain/format.ts';
import type { BudgetActualRow } from '../../domain/types.ts';

type BudgetActualTableProps = {
  rows: BudgetActualRow[];
};

const varianceClass = (minutes: number): string => {
  if (minutes > 0) return 'reports__cell--ahead';
  if (minutes < 0) return 'reports__cell--behind';
  return '';
};

export function BudgetActualTable({ rows }: BudgetActualTableProps): JSX.Element {
  return (
    <div className="reports__table-wrap">
      <table className="reports__table">
        <thead>
          <tr>
            <th rowSpan={2} className="reports__th-date">
              期間
            </th>
            <th colSpan={3}>期間</th>
            <th colSpan={3}>累積</th>
          </tr>
          <tr>
            <th>予算</th>
            <th>実績</th>
            <th>予実差</th>
            <th>予算</th>
            <th>実績</th>
            <th>予実差</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date}>
              <td className="reports__td-date">{row.label}</td>
              <td>{formatHours(row.budgetMinutes)}</td>
              <td>{formatHours(row.actualMinutes)}</td>
              <td className={varianceClass(row.varianceMinutes)}>
                {formatHoursSigned(row.varianceMinutes)}
              </td>
              <td>{formatHours(row.cumulativeBudgetMinutes)}</td>
              <td>{formatHours(row.cumulativeActualMinutes)}</td>
              <td className={varianceClass(row.cumulativeVarianceMinutes)}>
                {formatHoursSigned(row.cumulativeVarianceMinutes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
