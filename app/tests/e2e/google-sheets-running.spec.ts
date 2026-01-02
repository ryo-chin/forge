import { test, expect } from '@playwright/test';

const RUNNING_STATE_KEY = 'codex-time-tracker/running';
const SESSIONS_KEY = 'codex-time-tracker/sessions';

/**
 * Running Session同期のE2Eテスト
 *
 * このテストはLocalStorageモードで動作し、複数デバイス間の同期をシミュレートします。
 * 実際のSupabase同期をテストする場合は、Supabaseのテスト環境を設定してください。
 */

test.describe('Runningセッション - ローカルストレージでの複数デバイス同期', () => {
  test('ページ再読み込み後も計測中セッションを維持できる', async ({ page }) => {
    await page.goto('/');

    // デバイスA: セッション開始
    await page.getByPlaceholder('何をやる？').fill('資料作成');
    await page.getByRole('button', { name: '開始' }).click();

    await expect(page.getByText('計測中')).toBeVisible();

    // ページをリロード（デバイス切り替えをシミュレート）
    await page.reload();

    // Running状態が保持されていることを確認
    // リロード後、状態が復元されるまで待機
    await page.waitForTimeout(500);

    // タイトルが表示されていることで状態復元を確認
    await expect(page.getByRole('button', { name: '停止' })).toBeVisible({ timeout: 10000 });
  });

  test('再読み込み後もセッションIDが変わらない', async ({ page }) => {
    await page.goto('/');

    // セッション開始
    await page.getByPlaceholder('何をやる？').fill('テストセッション');
    await page.getByRole('button', { name: '開始' }).click();

    await expect(page.getByText('計測中')).toBeVisible();

    // LocalStorageからセッションIDを取得
    const sessionIdBefore = await page.evaluate((key) => {
      const data = localStorage.getItem(key);
      if (!data) return null;
      const state = JSON.parse(data);
      return state.draft?.id;
    }, RUNNING_STATE_KEY);

    expect(sessionIdBefore).toBeTruthy();

    // リロード
    await page.reload();

    // リロード後もセッションIDが同じことを確認
    const sessionIdAfter = await page.evaluate((key) => {
      const data = localStorage.getItem(key);
      if (!data) return null;
      const state = JSON.parse(data);
      return state.draft?.id;
    }, RUNNING_STATE_KEY);

    expect(sessionIdAfter).toBe(sessionIdBefore);
  });

  test('タイトル変更が再読み込み後に反映される', async ({ page }) => {
    await page.goto('/');

    // セッション開始
    await page.getByPlaceholder('何をやる？').fill('初期タイトル');
    await page.getByRole('button', { name: '開始' }).click();

    await expect(page.getByText('計測中')).toBeVisible();

    // タイトルを変更（Running中の編集機能があればそれを使用）
    // 注: 実際のUIに応じて調整が必要
    // ここではLocalStorageを直接操作してシミュレート
    await page.evaluate((key) => {
      const data = localStorage.getItem(key);
      if (data) {
        const state = JSON.parse(data);
        if (state.draft) {
          state.draft.title = '変更後タイトル';
          localStorage.setItem(key, JSON.stringify(state));
        }
      }
    }, RUNNING_STATE_KEY);

    // リロード
    await page.reload();

    // 変更が反映されていることを確認
    // タイトルはテキストボックスのvalueとして表示される
    await expect(page.getByRole('textbox')).toHaveValue('変更後タイトル');
  });

  test('プロジェクト変更が再読み込み後に反映される', async ({ page }) => {
    await page.goto('/');

    // セッション開始
    await page.getByPlaceholder('何をやる？').fill('プロジェクトテスト');
    await page.getByRole('button', { name: '開始' }).click();

    await expect(page.getByText('計測中')).toBeVisible();

    // プロジェクトを設定
    await page.evaluate((key) => {
      const data = localStorage.getItem(key);
      if (data) {
        const state = JSON.parse(data);
        if (state.draft) {
          state.draft.project = '新規事業';
          localStorage.setItem(key, JSON.stringify(state));
        }
      }
    }, RUNNING_STATE_KEY);

    // リロード
    await page.reload();

    // プロジェクトが反映されていることを確認
    // 注: UIにプロジェクト表示があればそれを確認
    const hasProject = await page.evaluate((key) => {
      const data = localStorage.getItem(key);
      if (!data) return false;
      const state = JSON.parse(data);
      return state.draft?.project === '新規事業';
    }, RUNNING_STATE_KEY);

    expect(hasProject).toBe(true);
  });

  test('停止後も同じセッションIDで履歴に保存される', async ({ page }) => {
    await page.goto('/');

    // セッション開始
    await page.getByPlaceholder('何をやる？').fill('完了テスト');
    await page.getByRole('button', { name: '開始' }).click();

    await expect(page.getByText('計測中')).toBeVisible();

    // セッションIDを取得
    const runningSessionId = await page.evaluate((key) => {
      const data = localStorage.getItem(key);
      if (!data) return null;
      const state = JSON.parse(data);
      return state.draft?.id;
    }, RUNNING_STATE_KEY);

    expect(runningSessionId).toBeTruthy();

    // セッション停止
    await page.getByRole('button', { name: '停止' }).click();

    // 停止後、履歴に追加されたセッションのIDを確認
    const completedSessionId = await page.evaluate((sessionsKey) => {
      const data = localStorage.getItem(sessionsKey);
      if (!data) return null;
      const sessions = JSON.parse(data);
      if (sessions.length === 0) return null;
      return sessions[0].id;
    }, SESSIONS_KEY);

    // Running時と同じIDが使用されていることを確認
    expect(completedSessionId).toBe(runningSessionId);
  });
});

test.describe('Runningセッション - 複数ブラウザコンテキスト', () => {
  test('別コンテキストでも同じセッションを表示できる', async ({ browser }) => {
    // デバイスA
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    // デバイスB
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // デバイスA: セッション開始
    await pageA.goto('/');
    await pageA.getByPlaceholder('何をやる？').fill('マルチデバイステスト');
    await pageA.getByRole('button', { name: '開始' }).click();
    await expect(pageA.getByText('計測中')).toBeVisible();

    // デバイスAのLocalStorageからセッション情報を取得
    const sessionDataA = await pageA.evaluate((key) => {
      return localStorage.getItem(key);
    }, RUNNING_STATE_KEY);

    // デバイスBにセッション情報をコピー（実際のSupabase同期をシミュレート）
    await pageB.goto('/');
    await pageB.evaluate(
      ({ key, data }) => {
        if (data) {
          localStorage.setItem(key, data);
        }
      },
      { key: RUNNING_STATE_KEY, data: sessionDataA },
    );

    // デバイスBでリロードして同期を確認
    await pageB.reload();

    // デバイスBでも同じセッションが表示されることを確認
    // タイトルはテキストボックスのvalueとして表示される
    await expect(pageB.getByRole('textbox')).toHaveValue('マルチデバイステスト');
    await expect(pageB.getByText('計測中')).toBeVisible();

    // セッションIDが同じことを確認
    const idA = await pageA.evaluate((key) => {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data).draft?.id : null;
    }, RUNNING_STATE_KEY);

    const idB = await pageB.evaluate((key) => {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data).draft?.id : null;
    }, RUNNING_STATE_KEY);

    expect(idA).toBe(idB);

    // クリーンアップ
    await contextA.close();
    await contextB.close();
  });

  test('別コンテキストから停止しても正しく反映される', async ({ browser }) => {
    // デバイスA
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    // デバイスB
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // デバイスA: セッション開始
    await pageA.goto('/');
    await pageA.getByPlaceholder('何をやる？').fill('デバイス切り替えテスト');
    await pageA.getByRole('button', { name: '開始' }).click();
    await expect(pageA.getByText('計測中')).toBeVisible();

    // セッション情報をデバイスBに同期
    const sessionData = await pageA.evaluate((key) => {
      return localStorage.getItem(key);
    }, RUNNING_STATE_KEY);

    await pageB.goto('/');
    await pageB.evaluate(
      ({ key, data }) => {
        if (data) {
          localStorage.setItem(key, data);
        }
      },
      { key: RUNNING_STATE_KEY, data: sessionData },
    );
    await pageB.reload();

    // デバイスBでセッション停止
    await expect(pageB.getByText('計測中')).toBeVisible();
    await pageB.getByRole('button', { name: '停止' }).click();

    // 停止後の状態を確認
    // idle状態ではLocalStorageから削除される設計
    const stoppedState = await pageB.evaluate((key) => {
      return localStorage.getItem(key);
    }, RUNNING_STATE_KEY);

    // 停止後はLocalStorageから削除される
    expect(stoppedState).toBeNull();

    // クリーンアップ
    await contextA.close();
    await contextB.close();
  });
});
