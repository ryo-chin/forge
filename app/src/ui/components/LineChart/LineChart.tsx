import { useCallback, useEffect, useId, useRef, useState } from 'react';
import './LineChart.css';

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  /** labels と同じ長さ。未計測点は null（線を途切れさせる）。 */
  values: (number | null)[];
};

export type LineChartProps = {
  labels: string[];
  series: ChartSeries[];
  height?: number;
  /** y 軸・ツールチップの数値整形 */
  formatValue?: (value: number) => string;
  /** 'zero' は 0 基準（累積向け）、'auto' はデータ範囲に合わせて調整（推移向け）。 */
  yBaseline?: 'zero' | 'auto';
  ariaLabel?: string;
};

const PADDING = { top: 16, right: 16, bottom: 28, left: 52 };
const DEFAULT_HEIGHT = 280;

const niceNum = (range: number, round: boolean): number => {
  if (range <= 0) return 1;
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / 10 ** exponent;
  let niceFraction: number;
  if (round) {
    niceFraction = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  } else {
    niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  }
  return niceFraction * 10 ** exponent;
};

/** データ範囲から「きれいな」下限・上限・刻みを求める。 */
const computeBounds = (
  min: number,
  max: number,
  baseline: 'zero' | 'auto',
): { lo: number; hi: number; step: number } => {
  let lo = min;
  let hi = max;
  if (baseline === 'zero') {
    lo = Math.min(0, min);
  } else if (lo === hi) {
    // 単一値: 上下に少し余白
    const pad = Math.abs(lo) > 0 ? Math.abs(lo) * 0.1 : 1;
    lo -= pad;
    hi += pad;
  }
  const range = niceNum(hi - lo, false);
  const step = niceNum(range / 4, true);
  return {
    lo: Math.floor(lo / step) * step,
    hi: Math.ceil(hi / step) * step,
    step,
  };
};

const defaultFormat = (value: number): string => `${Math.round(value)}`;

export function LineChart({
  labels,
  series,
  height = DEFAULT_HEIGHT,
  formatValue = defaultFormat,
  yBaseline = 'auto',
  ariaLabel,
}: LineChartProps): JSX.Element {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(640);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const clipId = useId();

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(Math.max(320, entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const count = labels.length;
  const plotWidth = Math.max(1, width - PADDING.left - PADDING.right);
  const plotHeight = Math.max(1, height - PADDING.top - PADDING.bottom);

  const allValues = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const dataMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const dataMax = allValues.length > 0 ? Math.max(...allValues) : 1;
  const { lo, hi, step } = computeBounds(dataMin, dataMax, yBaseline);
  const span = hi - lo || 1;

  const xFor = useCallback(
    (index: number): number => {
      if (count <= 1) return PADDING.left + plotWidth / 2;
      return PADDING.left + (plotWidth * index) / (count - 1);
    },
    [count, plotWidth],
  );
  const yFor = useCallback(
    (value: number): number => PADDING.top + plotHeight * (1 - (value - lo) / span),
    [plotHeight, lo, span],
  );

  const ticks: number[] = [];
  for (let tick = lo; tick <= hi + step / 2; tick += step) {
    ticks.push(tick);
  }

  const handlePointer = useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      if (count === 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const ratio = plotWidth <= 0 ? 0 : offsetX / plotWidth;
      const index = Math.round(ratio * (count - 1));
      setActiveIndex(Math.min(count - 1, Math.max(0, index)));
    },
    [count, plotWidth],
  );

  const buildPath = (values: (number | null)[]): string => {
    let path = '';
    let penUp = true;
    values.forEach((value, index) => {
      if (value == null) {
        penUp = true;
        return;
      }
      const command = penUp ? 'M' : 'L';
      path += `${command}${xFor(index).toFixed(1)},${yFor(value).toFixed(1)} `;
      penUp = false;
    });
    return path.trim();
  };

  const xLabelStep = Math.max(1, Math.ceil(count / 8));
  const tooltipLeft = activeIndex != null ? xFor(activeIndex) : 0;
  const tooltipOnRight = tooltipLeft < width / 2;

  return (
    <div className="line-chart" ref={wrapperRef}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel ?? 'チャート'}
        className="line-chart__svg"
      >
        <title>{ariaLabel ?? 'チャート'}</title>
        <defs>
          <clipPath id={clipId}>
            <rect x={PADDING.left} y={PADDING.top} width={plotWidth} height={plotHeight} />
          </clipPath>
        </defs>

        {/* 横グリッド + y 目盛 */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={PADDING.left + plotWidth}
              y1={yFor(tick)}
              y2={yFor(tick)}
              className="line-chart__grid"
            />
            <text x={PADDING.left - 8} y={yFor(tick) + 4} className="line-chart__y-label">
              {formatValue(tick)}
            </text>
          </g>
        ))}

        {/* x ラベル（位置 cx をキーに使い、配列 index をキーに含めない） */}
        {labels.map((label, index) => {
          if (index % xLabelStep !== 0) return null;
          const cx = xFor(index);
          return (
            <text key={`${label}-${cx}`} x={cx} y={height - 8} className="line-chart__x-label">
              {label}
            </text>
          );
        })}

        {/* 系列線（孤立点はドットで描画して見えるようにする） */}
        <g clipPath={`url(#${clipId})`}>
          {series.map((s) => (
            <path key={s.id} d={buildPath(s.values)} fill="none" stroke={s.color} strokeWidth={2} />
          ))}
          {series.flatMap((s) =>
            s.values.map((value, index) => {
              if (value == null) return null;
              const prev = index > 0 ? s.values[index - 1] : null;
              const next = index < s.values.length - 1 ? s.values[index + 1] : null;
              if (prev != null || next != null) return null;
              const cx = xFor(index);
              return (
                <circle key={`${s.id}-dot-${cx}`} cx={cx} cy={yFor(value)} r={3} fill={s.color} />
              );
            }),
          )}
        </g>

        {/* ホバーガイド */}
        {activeIndex != null ? (
          <g>
            <line
              x1={xFor(activeIndex)}
              x2={xFor(activeIndex)}
              y1={PADDING.top}
              y2={PADDING.top + plotHeight}
              className="line-chart__guide"
            />
            {series.map((s) => {
              const value = s.values[activeIndex];
              if (value == null) return null;
              return (
                <circle
                  key={s.id}
                  cx={xFor(activeIndex)}
                  cy={yFor(value)}
                  r={3.5}
                  fill={s.color}
                  stroke="var(--line-chart-dot-stroke, #ffffff)"
                  strokeWidth={1.5}
                />
              );
            })}
          </g>
        ) : null}

        {/* ポインタ捕捉 */}
        <rect
          x={PADDING.left}
          y={PADDING.top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          onPointerMove={handlePointer}
          onPointerLeave={() => setActiveIndex(null)}
        />
      </svg>

      {activeIndex != null ? (
        <div
          className={`line-chart__tooltip ${tooltipOnRight ? 'line-chart__tooltip--right' : 'line-chart__tooltip--left'}`}
          style={{ left: `${tooltipLeft}px` }}
          role="status"
        >
          <div className="line-chart__tooltip-title">{labels[activeIndex]}</div>
          {series.map((s) => {
            const value = s.values[activeIndex];
            return (
              <div key={s.id} className="line-chart__tooltip-row">
                <span className="line-chart__tooltip-dot" style={{ background: s.color }} />
                <span className="line-chart__tooltip-label">{s.label}</span>
                <span className="line-chart__tooltip-value">
                  {value == null ? '—' : formatValue(value)}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
