import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseIntensity,
  parseOptionalString,
  parseRunningDraft,
  parseSession,
  parseTagsArray,
} from './sessionParsers';

describe('sessionParsers', () => {
  describe('parseOptionalString', () => {
    it('有効な文字列を返す', () => {
      expect(parseOptionalString('hello')).toBe('hello');
    });

    it('空文字列はundefinedを返す', () => {
      expect(parseOptionalString('')).toBeUndefined();
    });

    it('空白のみの文字列はundefinedを返す', () => {
      expect(parseOptionalString('   ')).toBeUndefined();
    });

    it('nullはundefinedを返す', () => {
      expect(parseOptionalString(null)).toBeUndefined();
    });

    it('undefinedはundefinedを返す', () => {
      expect(parseOptionalString(undefined)).toBeUndefined();
    });

    it('数値はundefinedを返す', () => {
      expect(parseOptionalString(123)).toBeUndefined();
    });
  });

  describe('parseTagsArray', () => {
    it('文字列配列を返す', () => {
      expect(parseTagsArray(['tag1', 'tag2'])).toEqual(['tag1', 'tag2']);
    });

    it('空白を含むタグをトリムする', () => {
      expect(parseTagsArray([' tag1 ', '  tag2  '])).toEqual(['tag1', 'tag2']);
    });

    it('空文字列のタグを除外する', () => {
      expect(parseTagsArray(['tag1', '', 'tag2'])).toEqual(['tag1', 'tag2']);
    });

    it('文字列以外の値を除外する', () => {
      expect(parseTagsArray(['tag1', 123, 'tag2', null])).toEqual(['tag1', 'tag2']);
    });

    it('空配列はundefinedを返す', () => {
      expect(parseTagsArray([])).toBeUndefined();
    });

    it('空文字列のみの配列はundefinedを返す', () => {
      expect(parseTagsArray(['', '  '])).toBeUndefined();
    });

    it('配列以外はundefinedを返す', () => {
      expect(parseTagsArray('not-array')).toBeUndefined();
      expect(parseTagsArray(null)).toBeUndefined();
      expect(parseTagsArray(undefined)).toBeUndefined();
    });
  });

  describe('parseIntensity', () => {
    it('lowを返す', () => {
      expect(parseIntensity('low')).toBe('low');
    });

    it('mediumを返す', () => {
      expect(parseIntensity('medium')).toBe('medium');
    });

    it('highを返す', () => {
      expect(parseIntensity('high')).toBe('high');
    });

    it('無効な値はundefinedを返す', () => {
      expect(parseIntensity('invalid')).toBeUndefined();
      expect(parseIntensity('')).toBeUndefined();
      expect(parseIntensity(123)).toBeUndefined();
      expect(parseIntensity(null)).toBeUndefined();
    });
  });

  describe('parseSession', () => {
    const validSession = {
      id: 'session-1',
      title: 'テストセッション',
      startedAt: 1700000000000,
      endedAt: 1700003600000,
      durationSeconds: 3600,
    };

    it('有効なセッションをパースする', () => {
      const result = parseSession(validSession);
      expect(result).toEqual(validSession);
    });

    it('オプションフィールドを含むセッションをパースする', () => {
      const sessionWithOptionals = {
        ...validSession,
        tags: ['tag1', 'tag2'],
        project: 'プロジェクト',
        skill: 'スキル',
        notes: 'メモ',
        intensity: 'high',
      };
      const result = parseSession(sessionWithOptionals);
      expect(result).toEqual(sessionWithOptionals);
    });

    it('空のtagsはセッションに含めない', () => {
      const result = parseSession({ ...validSession, tags: [] });
      expect(result).toEqual(validSession);
      expect(result?.tags).toBeUndefined();
    });

    it('空のprojectはセッションに含めない', () => {
      const result = parseSession({ ...validSession, project: '' });
      expect(result).toEqual(validSession);
      expect(result?.project).toBeUndefined();
    });

    it('idがない場合はnullを返す', () => {
      const { id, ...withoutId } = validSession;
      expect(parseSession(withoutId)).toBeNull();
    });

    it('titleがない場合はnullを返す', () => {
      const { title, ...withoutTitle } = validSession;
      expect(parseSession(withoutTitle)).toBeNull();
    });

    it('startedAtがない場合はnullを返す', () => {
      const { startedAt, ...withoutStartedAt } = validSession;
      expect(parseSession(withoutStartedAt)).toBeNull();
    });

    it('endedAtがない場合はnullを返す', () => {
      const { endedAt, ...withoutEndedAt } = validSession;
      expect(parseSession(withoutEndedAt)).toBeNull();
    });

    it('durationSecondsがない場合はnullを返す', () => {
      const { durationSeconds, ...withoutDuration } = validSession;
      expect(parseSession(withoutDuration)).toBeNull();
    });

    it('startedAtがNaNの場合はnullを返す', () => {
      expect(parseSession({ ...validSession, startedAt: NaN })).toBeNull();
    });

    it('nullの場合はnullを返す', () => {
      expect(parseSession(null)).toBeNull();
    });

    it('undefinedの場合はnullを返す', () => {
      expect(parseSession(undefined)).toBeNull();
    });

    it('配列の場合はnullを返す', () => {
      expect(parseSession([])).toBeNull();
    });
  });

  describe('parseRunningDraft', () => {
    let mockRandomUUID: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockRandomUUID = vi.fn().mockReturnValue('generated-uuid');
      vi.stubGlobal('crypto', { randomUUID: mockRandomUUID });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const validDraft = {
      id: 'draft-1',
      title: 'テストドラフト',
      startedAt: 1700000000000,
    };

    it('有効なドラフトをパースする', () => {
      const result = parseRunningDraft(validDraft);
      expect(result).toEqual(validDraft);
    });

    it('オプションフィールドを含むドラフトをパースする', () => {
      const draftWithOptionals = {
        ...validDraft,
        tags: ['tag1'],
        project: 'プロジェクト',
        skill: 'スキル',
        notes: 'メモ',
        intensity: 'medium',
      };
      const result = parseRunningDraft(draftWithOptionals);
      expect(result).toEqual({
        ...validDraft,
        tags: ['tag1'],
        project: 'プロジェクト',
        skill: 'スキル',
        notes: 'メモ',
        intensity: 'medium',
      });
    });

    it('idがない場合は新規UUIDを生成する', () => {
      const { id, ...withoutId } = validDraft;
      const result = parseRunningDraft(withoutId);
      expect(result?.id).toBe('generated-uuid');
      expect(mockRandomUUID).toHaveBeenCalled();
    });

    it('titleがない場合はnullを返す', () => {
      const { title, ...withoutTitle } = validDraft;
      expect(parseRunningDraft(withoutTitle)).toBeNull();
    });

    it('startedAtがない場合はnullを返す', () => {
      const { startedAt, ...withoutStartedAt } = validDraft;
      expect(parseRunningDraft(withoutStartedAt)).toBeNull();
    });

    it('startedAtがNaNの場合はnullを返す', () => {
      expect(parseRunningDraft({ ...validDraft, startedAt: NaN })).toBeNull();
    });

    it('nullの場合はnullを返す', () => {
      expect(parseRunningDraft(null)).toBeNull();
    });

    it('undefinedの場合はnullを返す', () => {
      expect(parseRunningDraft(undefined)).toBeNull();
    });
  });
});
