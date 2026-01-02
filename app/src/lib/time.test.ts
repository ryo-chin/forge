import { describe, expect, it } from 'vitest';
import { createNudgeLabel, formatDurationForAria, formatTimer, localDateTimeToMs } from './time';

describe('time', () => {
  describe('formatTimer', () => {
    it('0秒を00:00にフォーマットする', () => {
      expect(formatTimer(0)).toBe('00:00');
    });

    it('59秒を00:59にフォーマットする', () => {
      expect(formatTimer(59)).toBe('00:59');
    });

    it('60秒を01:00にフォーマットする', () => {
      expect(formatTimer(60)).toBe('01:00');
    });

    it('90秒を01:30にフォーマットする', () => {
      expect(formatTimer(90)).toBe('01:30');
    });

    it('3599秒を59:59にフォーマットする', () => {
      expect(formatTimer(3599)).toBe('59:59');
    });

    it('3600秒を60:00にフォーマットする', () => {
      expect(formatTimer(3600)).toBe('60:00');
    });

    it('7261秒を121:01にフォーマットする', () => {
      expect(formatTimer(7261)).toBe('121:01');
    });

    it('小数点以下を切り捨てる', () => {
      expect(formatTimer(90.9)).toBe('01:30');
    });
  });

  describe('localDateTimeToMs', () => {
    it('ローカル日時文字列をミリ秒に変換する', () => {
      const dateString = '2024-01-15T10:30';
      const result = localDateTimeToMs(dateString);
      const expected = new Date(dateString).getTime();
      expect(result).toBe(expected);
    });

    it('別の日時文字列を正しく変換する', () => {
      const dateString = '2023-12-31T23:59';
      const result = localDateTimeToMs(dateString);
      const expected = new Date(dateString).getTime();
      expect(result).toBe(expected);
    });
  });

  describe('formatDurationForAria', () => {
    it('0秒を「0秒」にフォーマットする', () => {
      expect(formatDurationForAria(0)).toBe('0秒');
    });

    it('負の値を「0秒」にフォーマットする', () => {
      expect(formatDurationForAria(-10)).toBe('0秒');
    });

    it('30秒を「30秒」にフォーマットする', () => {
      expect(formatDurationForAria(30)).toBe('30秒');
    });

    it('60秒を「1分」にフォーマットする', () => {
      expect(formatDurationForAria(60)).toBe('1分');
    });

    it('90秒を「1分30秒」にフォーマットする', () => {
      expect(formatDurationForAria(90)).toBe('1分30秒');
    });

    it('120秒を「2分」にフォーマットする', () => {
      expect(formatDurationForAria(120)).toBe('2分');
    });

    it('3600秒を「1時間」にフォーマットする', () => {
      expect(formatDurationForAria(3600)).toBe('1時間');
    });

    it('3661秒を「1時間1分1秒」にフォーマットする', () => {
      expect(formatDurationForAria(3661)).toBe('1時間1分1秒');
    });

    it('7200秒を「2時間」にフォーマットする', () => {
      expect(formatDurationForAria(7200)).toBe('2時間');
    });

    it('7323秒を「2時間2分3秒」にフォーマットする', () => {
      expect(formatDurationForAria(7323)).toBe('2時間2分3秒');
    });

    it('3660秒を「1時間1分」にフォーマットする（秒が0の場合は省略）', () => {
      expect(formatDurationForAria(3660)).toBe('1時間1分');
    });
  });

  describe('createNudgeLabel', () => {
    it('正の値で延長ラベルを作成する', () => {
      expect(createNudgeLabel(5)).toBe('経過時間を5分延長');
    });

    it('負の値で短縮ラベルを作成する', () => {
      expect(createNudgeLabel(-5)).toBe('経過時間を5分短縮');
    });

    it('大きな正の値で延長ラベルを作成する', () => {
      expect(createNudgeLabel(30)).toBe('経過時間を30分延長');
    });

    it('大きな負の値で短縮ラベルを作成する', () => {
      expect(createNudgeLabel(-15)).toBe('経過時間を15分短縮');
    });
  });
});
