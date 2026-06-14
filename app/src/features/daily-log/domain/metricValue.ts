import type { MetricKind, MetricValue } from './types.ts';

/**
 * kind に対して value が妥当か判定する。
 * boolean / number は実装済み、選択式は土台（型は通すが UI は将来）。
 */
export const isValidMetricValue = (kind: MetricKind, value: unknown): value is MetricValue => {
  switch (kind) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'text':
    case 'single_select':
      return typeof value === 'string';
    case 'multi_select':
      return Array.isArray(value) && value.every((item) => typeof item === 'string');
    default:
      return false;
  }
};

/** 永続化された jsonb 値を kind に沿って正規化する。不正なら null。 */
export const normalizeMetricValue = (kind: MetricKind, value: unknown): MetricValue | null => {
  if (isValidMetricValue(kind, value)) {
    return value;
  }
  return null;
};

/** 表示用の文字列化（boolean は ○/×、number は単位付き）。 */
export const formatMetricValue = (
  kind: MetricKind,
  value: MetricValue | null,
  unit?: string | null,
): string => {
  if (value == null) return '—';
  switch (kind) {
    case 'boolean':
      return value ? '✓' : '—';
    case 'number':
      return unit ? `${value} ${unit}` : String(value);
    case 'text':
    case 'single_select':
      return String(value);
    case 'multi_select':
      return Array.isArray(value) ? value.join(', ') : '';
    default:
      return '';
  }
};
