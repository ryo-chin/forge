import { describe, expect, it } from 'vitest';
import { formatMetricValue, isValidMetricValue, normalizeMetricValue } from './metricValue.ts';

describe('isValidMetricValue', () => {
  it('boolean を判定する', () => {
    expect(isValidMetricValue('boolean', true)).toBe(true);
    expect(isValidMetricValue('boolean', 1)).toBe(false);
  });

  it('number は有限数のみ許可', () => {
    expect(isValidMetricValue('number', 62.5)).toBe(true);
    expect(isValidMetricValue('number', Number.NaN)).toBe(false);
    expect(isValidMetricValue('number', '62')).toBe(false);
  });

  it('text / 選択式を判定できる', () => {
    expect(isValidMetricValue('text', 'メモ')).toBe(true);
    expect(isValidMetricValue('single_select', 'a')).toBe(true);
    expect(isValidMetricValue('multi_select', ['a', 'b'])).toBe(true);
    expect(isValidMetricValue('multi_select', [1])).toBe(false);
  });
});

describe('normalizeMetricValue', () => {
  it('不正値は null を返す', () => {
    expect(normalizeMetricValue('number', 'x')).toBeNull();
    expect(normalizeMetricValue('boolean', false)).toBe(false);
  });
});

describe('formatMetricValue', () => {
  it('boolean は ✓ / —', () => {
    expect(formatMetricValue('boolean', true)).toBe('✓');
    expect(formatMetricValue('boolean', false)).toBe('—');
  });

  it('text はそのまま', () => {
    expect(formatMetricValue('text', 'ジム行った')).toBe('ジム行った');
  });

  it('number は単位付き', () => {
    expect(formatMetricValue('number', 62.5, 'kg')).toBe('62.5 kg');
  });

  it('未記録は —', () => {
    expect(formatMetricValue('number', null)).toBe('—');
  });
});
