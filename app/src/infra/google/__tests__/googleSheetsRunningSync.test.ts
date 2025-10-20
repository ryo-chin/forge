import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionDraft } from '../../../features/time-tracker/domain/types';

/**
 * Google Sheets Running Session同期のテスト
 *
 * このテストは、Google Sheets APIを直接呼び出してRunning状態を同期する関数をテストします。
 * 実装する関数:
 * - appendRunningSession: Running中のセッションを新しい行として追加
 * - updateRunningSession: Running中のセッションを更新
 * - completeRunningSession: Running中のセッションを完了状態に変更
 */

// グローバルなgapiオブジェクトをモック
const mockAppend = vi.fn();
const mockGet = vi.fn();
const mockBatchUpdate = vi.fn();

(global as Record<string, unknown>).gapi = {
  client: {
    sheets: {
      spreadsheets: {
        values: {
          append: mockAppend,
          get: mockGet,
          batchUpdate: mockBatchUpdate,
        },
      },
    },
  },
};

describe('Google Sheets Running Session Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('appendRunningSession', () => {
    it('should append a new row with status="Running"', async () => {
      const draft: SessionDraft = {
        id: 'test-session-id',
        title: '資料作成',
        startedAt: Date.now(),
        tags: ['重要'],
        project: '新規事業',
      };

      const options = {
        spreadsheetId: 'test-spreadsheet-id',
        sheetName: 'Sessions',
        mappings: {
          id: 'A',
          status: 'B',
          title: 'C',
          startedAt: 'D',
          endedAt: 'E',
          durationSeconds: 'F',
          project: 'G',
          tags: 'H',
        },
      };

      mockAppend.mockResolvedValue({ result: { updates: { updatedRows: 1 } } });

      // 実装する関数（まだ存在しない）
      const { appendRunningSession } = await import('../googleSheetsRunningSync');

      await appendRunningSession(draft, options);

      expect(mockAppend).toHaveBeenCalledTimes(1);
      const call = mockAppend.mock.calls[0][0];

      expect(call.spreadsheetId).toBe('test-spreadsheet-id');
      expect(call.range).toContain('Sessions');
      expect(call.valueInputOption).toBe('USER_ENTERED');

      const values = call.resource.values[0];
      expect(values[0]).toBe('test-session-id'); // id
      expect(values[1]).toBe('Running'); // status
      expect(values[2]).toBe('資料作成'); // title
      expect(values[3]).toMatch(/^\d{4}-\d{2}-\d{2}/); // startedAt (ISO 8601)
      expect(values[4]).toBe(''); // endedAt (空)
      expect(values[5]).toBe(''); // durationSeconds (空)
      expect(values[6]).toBe('新規事業'); // project
      expect(values[7]).toBe('重要'); // tags
    });

    it('should throw error if id is missing', async () => {
      const draftWithoutId = {
        title: 'テスト',
        startedAt: Date.now(),
      } as SessionDraft;

      const options = {
        spreadsheetId: 'test-spreadsheet-id',
        sheetName: 'Sessions',
        mappings: { id: 'A', status: 'B', title: 'C', startedAt: 'D', endedAt: 'E', durationSeconds: 'F' },
      };

      const { appendRunningSession } = await import('../googleSheetsRunningSync');

      await expect(appendRunningSession(draftWithoutId, options)).rejects.toThrow('id is required');
    });
  });

  describe('updateRunningSession', () => {
    it('should update running session row by id', async () => {
      const draft: SessionDraft = {
        id: 'test-session-id',
        title: '資料作成（更新）',
        startedAt: Date.now() - 60000,
        project: '新規事業',
        tags: ['重要', '緊急'],
      };

      const options = {
        spreadsheetId: 'test-spreadsheet-id',
        sheetName: 'Sessions',
        mappings: {
          id: 'A',
          status: 'B',
          title: 'C',
          startedAt: 'D',
          endedAt: 'E',
          durationSeconds: 'F',
          project: 'G',
          tags: 'H',
        },
      };

      // id列の検索結果をモック
      mockGet.mockResolvedValue({
        result: {
          values: [
            ['other-id'],
            ['test-session-id'], // 2行目にマッチ
            ['another-id'],
          ],
        },
      });

      mockBatchUpdate.mockResolvedValue({ result: { replies: [] } });

      const { updateRunningSession } = await import('../googleSheetsRunningSync');

      await updateRunningSession(draft, options);

      // id列を検索
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockGet.mock.calls[0][0].range).toContain('A:A');

      // batchUpdateで更新
      expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
      const updateCall = mockBatchUpdate.mock.calls[0][0];
      const updates = updateCall.resource.data as Array<{ range: string; values: unknown[][] }>;

      // 行番号は2（0-indexedで1）+ 1（ヘッダー）= 2行目
      expect(updates.some((entry) => entry.range.includes('C2'))).toBe(true); // title
      expect(updates.some((entry) => entry.range.includes('G2'))).toBe(true); // project
      expect(updates.some((entry) => entry.range.includes('H2'))).toBe(true); // tags
    });

    it('should log warning if session not found', async () => {
      const draft: SessionDraft = {
        id: 'non-existent-id',
        title: 'テスト',
        startedAt: Date.now(),
      };

      const options = {
        spreadsheetId: 'test-spreadsheet-id',
        sheetName: 'Sessions',
        mappings: { id: 'A', status: 'B', title: 'C', startedAt: 'D', endedAt: 'E', durationSeconds: 'F' },
      };

      mockGet.mockResolvedValue({
        result: { values: [['other-id'], ['another-id']] },
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { updateRunningSession } = await import('../googleSheetsRunningSync');

      await updateRunningSession(draft, options);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Running session not found'),
        'non-existent-id'
      );
      expect(mockBatchUpdate).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('completeRunningSession', () => {
    it('should update session status to "Completed"', async () => {
      const session = {
        id: 'test-session-id',
        title: '資料作成',
        startedAt: Date.now() - 3600000,
        endedAt: Date.now(),
        durationSeconds: 3600,
        project: '新規事業',
        tags: ['重要'],
      };

      const options = {
        spreadsheetId: 'test-spreadsheet-id',
        sheetName: 'Sessions',
        mappings: {
          id: 'A',
          status: 'B',
          title: 'C',
          startedAt: 'D',
          endedAt: 'E',
          durationSeconds: 'F',
          project: 'G',
          tags: 'H',
        },
      };

      mockGet.mockResolvedValue({
        result: {
          values: [['test-session-id']], // 1行目にマッチ
        },
      });

      mockBatchUpdate.mockResolvedValue({ result: { replies: [] } });

      const { completeRunningSession } = await import('../googleSheetsRunningSync');

      await completeRunningSession(session, options);

      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockBatchUpdate).toHaveBeenCalledTimes(1);

      const updateCall = mockBatchUpdate.mock.calls[0][0];
      const updates = updateCall.resource.data as Array<{ range: string; values: unknown[][] }>;

      // status="Completed"に更新
      const statusUpdate = updates.find((entry) => entry.range.includes('B1'));
      expect(statusUpdate).toBeDefined();
      expect(statusUpdate!.values[0][0]).toBe('Completed');

      // endedAtとdurationSecondsも更新
      expect(updates.some((entry) => entry.range.includes('E1'))).toBe(true);
      expect(updates.some((entry) => entry.range.includes('F1'))).toBe(true);
    });
  });
});
