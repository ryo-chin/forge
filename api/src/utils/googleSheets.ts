import type { ColumnMapping } from '../types';

export const formatDateTime = (input: string): string => {
  const date = new Date(input);

  const jstOffsetMinutes = 9 * 60;
  const jstTime = new Date(date.getTime() + jstOffsetMinutes * 60 * 1000);

  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${jstTime.getUTCFullYear()}/${pad(
    jstTime.getUTCMonth() + 1,
  )}/${pad(jstTime.getUTCDate())} ${pad(jstTime.getUTCHours())}:${pad(
    jstTime.getUTCMinutes(),
  )}:${pad(jstTime.getUTCSeconds())}`;
};

export const normalizeColumnKey = (
  value: string | undefined | null,
): string | null => {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]+$/u.test(trimmed) ? trimmed : null;
};

export const columnKeyToIndex = (columnKey: string): number => {
  let index = 0;
  for (let i = 0; i < columnKey.length; i++) {
    index = index * 26 + (columnKey.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return index - 1;
};

export const indexToColumnKey = (index: number): string => {
  let result = '';
  let current = index + 1;
  while (current > 0) {
    const modulo = (current - 1) % 26;
    result = String.fromCharCode('A'.charCodeAt(0) + modulo) + result;
    current = Math.floor((current - modulo) / 26);
  }
  return result;
};

export const resolveColumnLetter = (
  value: string | undefined | null,
  headerRow: (string | number)[] | null,
): string | null => {
  const direct = normalizeColumnKey(value);
  if (direct) return direct;
  if (!value || !headerRow) return null;

  const index = headerRow.findIndex(
    (cell) => String(cell).trim() === value.trim(),
  );
  if (index === -1) return null;
  return indexToColumnKey(index);
};

export const requiresHeaderLookup = (mapping: ColumnMapping | null): boolean =>
  !!mapping &&
  Object.values(mapping).some(
    (value) => value && !normalizeColumnKey(String(value)),
  );
