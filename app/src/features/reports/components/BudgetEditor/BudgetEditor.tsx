import { toDateKey } from '@lib/date.ts';
import { type FormEvent, useState } from 'react';
import type { Budget, BudgetInput } from '../../domain/types.ts';

type BudgetEditorProps = {
  initial?: Budget | null;
  onSave: (input: BudgetInput) => void;
  onCancel: () => void;
};

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

const minutesToHoursInput = (minutes: number): string =>
  minutes === 0 ? '' : String(Math.round((minutes / 60) * 100) / 100);

const hoursInputToMinutes = (value: string): number => {
  const hours = Number.parseFloat(value);
  if (!Number.isFinite(hours) || hours < 0) return 0;
  return Math.round(hours * 60);
};

export function BudgetEditor({ initial, onSave, onCancel }: BudgetEditorProps): JSX.Element {
  const today = toDateKey(Date.now());
  const [tag, setTag] = useState(initial?.tag ?? '');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [hours, setHours] = useState<string[]>(
    () => (initial?.weekdayMinutes ?? [0, 0, 0, 0, 0, 0, 0]).map(minutesToHoursInput) as string[],
  );
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effectiveFrom ?? today);
  const [effectiveTo, setEffectiveTo] = useState(initial?.effectiveTo ?? '');

  const handleHoursChange = (index: number, value: string) => {
    setHours((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTag = tag.trim();
    if (!trimmedTag || !effectiveFrom) return;
    onSave({
      id: initial?.id,
      tag: trimmedTag,
      label: label.trim() ? label.trim() : null,
      weekdayMinutes: hours.map(hoursInputToMinutes),
      effectiveFrom,
      effectiveTo: effectiveTo ? effectiveTo : null,
    });
  };

  return (
    <form className="reports__editor" onSubmit={handleSubmit}>
      <h2 className="reports__editor-title">{initial ? '予算を編集' : '予算を追加'}</h2>

      <label className="reports__field">
        <span className="reports__field-label">対象プロジェクト</span>
        <input
          type="text"
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          placeholder="例: 鍛錬（Time Tracker のプロジェクト名）"
          required
        />
      </label>

      <label className="reports__field">
        <span className="reports__field-label">表示名（任意）</span>
        <input
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="例: 累積鍛錬時間"
        />
      </label>

      <fieldset className="reports__weekday">
        <legend className="reports__field-label">曜日別の1日あたり予算（時間）</legend>
        <div className="reports__weekday-grid">
          {WEEKDAY_LABELS.map((weekday, index) => (
            <label key={weekday} className="reports__weekday-item">
              <span>{weekday}</span>
              <input
                type="number"
                min={0}
                step={0.5}
                inputMode="decimal"
                value={hours[index]}
                onChange={(event) => handleHoursChange(index, event.target.value)}
                placeholder="0"
                aria-label={`${weekday}曜日の予算（時間）`}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="reports__field-row">
        <label className="reports__field">
          <span className="reports__field-label">開始日</span>
          <input
            type="date"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
            required
          />
        </label>
        <label className="reports__field">
          <span className="reports__field-label">終了日（任意）</span>
          <input
            type="date"
            value={effectiveTo}
            onChange={(event) => setEffectiveTo(event.target.value)}
          />
        </label>
      </div>

      <div className="reports__editor-actions">
        <button type="button" className="reports__button-ghost" onClick={onCancel}>
          キャンセル
        </button>
        <button type="submit" className="reports__button-primary">
          保存
        </button>
      </div>
    </form>
  );
}
