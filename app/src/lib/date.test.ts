import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateKeyToDate,
  eachDayKey,
  formatDateTimeLocal,
  monthStartKey,
  parseDateTimeLocal,
  toDateKey,
  weekStartKey,
  weekdayIndex,
} from './date';

describe('date', () => {
  describe('formatDateTimeLocal', () => {
    it('タイムスタンプをローカル日時文字列に変換する', () => {
      // 2024-01-15T10:30:00のタイムスタンプ（UTCではなくローカルタイム）
      const date = new Date(2024, 0, 15, 10, 30, 0);
      const timestamp = date.getTime();
      const result = formatDateTimeLocal(timestamp);
      expect(result).toBe('2024-01-15T10:30');
    });

    it('別の日時を正しく変換する', () => {
      const date = new Date(2023, 11, 31, 23, 59, 0);
      const timestamp = date.getTime();
      const result = formatDateTimeLocal(timestamp);
      expect(result).toBe('2023-12-31T23:59');
    });

    it('午前0時を正しく変換する', () => {
      const date = new Date(2024, 5, 1, 0, 0, 0);
      const timestamp = date.getTime();
      const result = formatDateTimeLocal(timestamp);
      expect(result).toBe('2024-06-01T00:00');
    });

    it('秒は切り捨てられる', () => {
      const date = new Date(2024, 0, 15, 10, 30, 45);
      const timestamp = date.getTime();
      const result = formatDateTimeLocal(timestamp);
      expect(result).toBe('2024-01-15T10:30');
    });
  });

  describe('parseDateTimeLocal', () => {
    it('日時文字列をミリ秒に変換する', () => {
      const dateString = '2024-01-15T10:30';
      const result = parseDateTimeLocal(dateString);
      const expected = new Date(2024, 0, 15, 10, 30).getTime();
      expect(result).toBe(expected);
    });

    it('別の日時文字列を正しく変換する', () => {
      const dateString = '2023-12-31T23:59';
      const result = parseDateTimeLocal(dateString);
      const expected = new Date(2023, 11, 31, 23, 59).getTime();
      expect(result).toBe(expected);
    });

    it('空文字列はnullを返す', () => {
      expect(parseDateTimeLocal('')).toBeNull();
    });

    it('無効な日時文字列はnullを返す', () => {
      expect(parseDateTimeLocal('invalid-date')).toBeNull();
    });
  });

  describe('日付キーユーティリティ', () => {
    it('ローカル日付を YYYY-MM-DD に変換する', () => {
      const ts = new Date(2025, 0, 6, 9, 30).getTime();
      expect(toDateKey(ts)).toBe('2025-01-06');
    });

    it('日付キーをローカル日の Date に戻せる', () => {
      const date = dateKeyToDate('2025-01-06');
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(6);
    });

    it('日付を加算・減算できる（月境界をまたぐ）', () => {
      expect(addDays('2025-01-31', 1)).toBe('2025-02-01');
      expect(addDays('2025-03-01', -1)).toBe('2025-02-28');
    });

    it('両端を含む日付キーを昇順で列挙する', () => {
      expect(eachDayKey('2025-01-06', '2025-01-09')).toEqual([
        '2025-01-06',
        '2025-01-07',
        '2025-01-08',
        '2025-01-09',
      ]);
    });

    it('from > to のとき空配列を返す', () => {
      expect(eachDayKey('2025-01-09', '2025-01-06')).toEqual([]);
    });

    it('曜日インデックスは 0=日曜', () => {
      expect(weekdayIndex('2025-01-05')).toBe(0);
      expect(weekdayIndex('2025-01-06')).toBe(1);
    });

    it('週開始日は既定で月曜', () => {
      expect(weekStartKey('2025-01-09')).toBe('2025-01-06');
      expect(weekStartKey('2025-01-06')).toBe('2025-01-06');
    });

    it('週開始日を日曜にもできる', () => {
      expect(weekStartKey('2025-01-09', 0)).toBe('2025-01-05');
    });

    it('月初日キーを返す', () => {
      expect(monthStartKey('2025-01-20')).toBe('2025-01-01');
    });
  });
});
