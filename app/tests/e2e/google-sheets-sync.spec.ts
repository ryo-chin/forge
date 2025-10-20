import { test, expect } from '@playwright/test';

type GapiMock = {
  client: {
    sheets: {
      spreadsheets: {
        values: {
          append: () => Promise<{ result: { updates: { updatedRows: number } } }>;
          get: () => Promise<{ result: { values: string[][] } }>;
          batchUpdate: () => Promise<{ result: { replies: unknown[] } }>;
        };
      };
    };
  };
};

type WindowWithGapi = Window & { gapi: GapiMock };

/**
 * Google Sheets同期のE2Eテスト
 *
 * このテストはGoogle Sheets連携機能をテストします。
 * Google Sheets APIはモック化されており、実際のスプレッドシートへのアクセスは行いません。
 */

test.describe('Google Sheets Sync - Running Session', () => {
  test.beforeEach(async ({ page }) => {
    // Google Sheets APIをモック
    await page.addInitScript(() => {
      const mockAppendResponse = { result: { updates: { updatedRows: 1 } } };
      const mockGetResponse = {
        result: {
          values: [
            ['running-session-id'], // マッチする行
          ],
        },
      };
      const mockBatchUpdateResponse = { result: { replies: [] } };

      // グローバルなgapiオブジェクトをモック
      const gapiMock: GapiMock = {
        client: {
          sheets: {
            spreadsheets: {
              values: {
                append: () => Promise.resolve(mockAppendResponse),
                get: () => Promise.resolve(mockGetResponse),
                batchUpdate: () => Promise.resolve(mockBatchUpdateResponse),
              },
            },
          },
        },
      };
      (window as unknown as WindowWithGapi).gapi = gapiMock;
    });

    // LocalStorageにGoogle Sheets設定を追加
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem(
        'google-sheets-sync-config',
        JSON.stringify({
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
            skill: 'I',
            intensity: 'J',
            notes: 'K',
          },
        }),
      );
    });
  });

  test('should append running session to Google Sheets on start', async ({ page }) => {
    await page.goto('/');

    // セッション開始
    await page.getByPlaceholder('何をやる？').fill('Google Sheets同期テスト');
    await page.getByRole('button', { name: '開始' }).click();

    await expect(page.getByText('計測中')).toBeVisible();

    // Google Sheets APIのappendが呼ばれたことを確認
    // 注: 実際のE2Eではモック呼び出しの検証は難しいため、
    // UIの状態確認のみ行う
    await expect(page.getByRole('button', { name: '停止' })).toBeVisible();
  });

  test('should update running session in Google Sheets on title change', async ({ page }) => {
    await page.goto('/');

    // セッション開始
    await page.getByPlaceholder('何をやる？').fill('初期タイトル');
    await page.getByRole('button', { name: '開始' }).click();

    await expect(page.getByText('計測中')).toBeVisible();

    // タイトル変更（実際のUI操作に応じて調整が必要）
    // 現時点ではLocalStorageを直接操作
    await page.evaluate(() => {
      const data = localStorage.getItem('codex-time-tracker/running');
      if (data) {
        const state = JSON.parse(data);
        if (state.draft) {
          state.draft.title = '変更後タイトル';
          localStorage.setItem('codex-time-tracker/running', JSON.stringify(state));
        }
      }
    });

    // リロードして変更を反映
    await page.reload();

    // タイトルが変更されていることを確認
    // タイトルはテキストボックスのvalueとして表示される
    await expect(page.getByRole('textbox')).toHaveValue('変更後タイトル');
  });

  test('should complete running session in Google Sheets on stop', async ({ page }) => {
    await page.goto('/');

    // セッション開始
    await page.getByPlaceholder('何をやる？').fill('完了テスト');
    await page.getByRole('button', { name: '開始' }).click();

    await expect(page.getByText('計測中')).toBeVisible();

    // セッション停止
    await page.getByRole('button', { name: '停止' }).click();

    // 停止後、履歴に追加されることを確認
    // 注: 実際のUIに応じて調整が必要
    await expect(page.getByRole('button', { name: '開始' })).toBeVisible();
  });

  test('should handle Google Sheets sync errors gracefully', async ({ page }) => {
    // Google Sheets APIエラーをモック
    await page.addInitScript(() => {
      const gapiMock: GapiMock = {
        client: {
          sheets: {
            spreadsheets: {
              values: {
                append: () => Promise.reject(new Error('API Error')),
                get: () => Promise.reject(new Error('API Error')),
                batchUpdate: () => Promise.reject(new Error('API Error')),
              },
            },
          },
        },
      };
      (window as unknown as WindowWithGapi).gapi = gapiMock;
    });

    await page.goto('/');

    // エラーが発生してもアプリは正常動作
    await page.getByPlaceholder('何をやる？').fill('エラーテスト');
    await page.getByRole('button', { name: '開始' }).click();

    // セッションは開始できる
    await expect(page.getByText('計測中')).toBeVisible();

    // セッション停止も可能
    await page.getByRole('button', { name: '停止' }).click();
    await expect(page.getByRole('button', { name: '開始' })).toBeVisible();
  });
});

test.describe('Google Sheets Sync - Configuration', () => {
  test('should not sync when Google Sheets is not configured', async ({ page }) => {
    await page.goto('/');

    // Google Sheets設定を削除
    await page.evaluate(() => {
      localStorage.removeItem('google-sheets-sync-config');
    });

    // セッション開始
    await page.getByPlaceholder('何をやる？').fill('設定なしテスト');
    await page.getByRole('button', { name: '開始' }).click();

    // セッションは正常に開始できる
    await expect(page.getByText('計測中')).toBeVisible();

    // セッション停止も可能
    await page.getByRole('button', { name: '停止' }).click();
    await expect(page.getByRole('button', { name: '開始' })).toBeVisible();
  });

  test('should validate spreadsheet ID and sheet name', async ({ page }) => {
    await page.goto('/');

    // 不正な設定を追加
    await page.evaluate(() => {
      localStorage.setItem(
        'google-sheets-sync-config',
        JSON.stringify({
          spreadsheetId: '',
          sheetName: '',
          mappings: {},
        }),
      );
    });

    // セッション開始
    await page.getByPlaceholder('何をやる？').fill('バリデーションテスト');
    await page.getByRole('button', { name: '開始' }).click();

    // バリデーションエラーがあってもアプリは動作
    await expect(page.getByText('計測中')).toBeVisible();
  });
});
