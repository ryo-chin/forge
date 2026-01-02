import { describe, expect, it } from 'vitest';
import { formatDateTimeLocal, parseDateTimeLocal } from './date';

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
});
