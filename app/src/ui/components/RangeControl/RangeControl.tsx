import { addDays, addMonths, diffDays } from '@lib/date.ts';
import './RangeControl.css';

export type RangeControlProps = {
  fromKey: string;
  toKey: string;
  todayKey: string;
  onChange: (fromKey: string, toKey: string) => void;
};

type SpanPreset = { label: string; days?: number; months?: number };

const SPAN_PRESETS: SpanPreset[] = [
  { label: '1週間', days: 7 },
  { label: '2週間', days: 14 },
  { label: '1か月', months: 1 },
  { label: '3か月', months: 3 },
  { label: '6か月', months: 6 },
  { label: '1年', months: 12 },
  { label: '2年', months: 24 },
];

export function RangeControl({
  fromKey,
  toKey,
  todayKey,
  onChange,
}: RangeControlProps): JSX.Element {
  const spanDays = diffDays(fromKey, toKey) + 1;

  const shift = (deltaDays: number) => {
    let nextFrom = addDays(fromKey, deltaDays);
    let nextTo = addDays(toKey, deltaDays);
    if (nextTo > todayKey) {
      nextTo = todayKey;
      nextFrom = addDays(todayKey, -(spanDays - 1));
    }
    onChange(nextFrom, nextTo);
  };

  const applyPreset = (preset: SpanPreset) => {
    const nextFrom =
      preset.days !== undefined
        ? addDays(todayKey, -(preset.days - 1))
        : addDays(addMonths(todayKey, -(preset.months ?? 1)), 1);
    onChange(nextFrom, todayKey);
  };

  const handleFrom = (value: string) => {
    if (!value) return;
    onChange(value > toKey ? toKey : value, toKey);
  };
  const handleTo = (value: string) => {
    if (!value) return;
    const clamped = value > todayKey ? todayKey : value;
    onChange(fromKey > clamped ? clamped : fromKey, clamped);
  };

  return (
    <div className="range-control">
      <div className="range-control__nav">
        <button
          type="button"
          className="range-control__arrow"
          onClick={() => shift(-spanDays)}
          aria-label="前の期間へ"
          title="前の期間へ"
        >
          ◀
        </button>
        <div className="range-control__dates">
          <input
            type="date"
            className="range-control__date"
            value={fromKey}
            max={toKey}
            onChange={(event) => handleFrom(event.target.value)}
            aria-label="開始日"
          />
          <span className="range-control__tilde">〜</span>
          <input
            type="date"
            className="range-control__date"
            value={toKey}
            max={todayKey}
            onChange={(event) => handleTo(event.target.value)}
            aria-label="終了日"
          />
        </div>
        <button
          type="button"
          className="range-control__arrow"
          onClick={() => shift(spanDays)}
          disabled={toKey >= todayKey}
          aria-label="次の期間へ"
          title="次の期間へ"
        >
          ▶
        </button>
      </div>
      <div className="range-control__presets">
        {SPAN_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="range-control__preset"
            onClick={() => applyPreset(preset)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
