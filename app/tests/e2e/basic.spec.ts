import { expect, test } from '@playwright/test';

test('即時スタートUIが初期表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Time Tracker' })).toBeVisible();
  const input = page.getByPlaceholder('何をやる？');
  await expect(input).toBeVisible();
  await expect(page.getByRole('button', { name: '開始', exact: true })).toBeVisible();
});

test('クイックナッジで作業時間を前後に調整できる', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('何をやる？').fill('ギター練習');
  await page.getByRole('button', { name: '開始', exact: true }).click();

  await expect(page.getByText('計測中')).toBeVisible();

  const timer = page.locator('.time-tracker__timer');

  await page.getByRole('button', { name: '経過時間を5分延長' }).click();
  await expect(timer).toHaveText(/05:\d{2}/);

  await page.getByRole('button', { name: '経過時間を5分短縮' }).click();
  await expect(timer).toHaveText(/00:\d{2}/);
});

test('履歴のモーダル編集でタイトルを更新できる', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('何をやる？').fill('ギター練習');
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await page.getByRole('button', { name: '停止' }).click();

  await page.getByRole('button', { name: '「ギター練習」を編集' }).click();
  await page.getByLabel('タイトル', { exact: true }).fill('アップデート済みタイトル');
  await page.getByLabel('プロジェクト', { exact: true }).fill('focus');
  await page.getByRole('button', { name: '保存' }).click();

  await expect(page.getByText('アップデート済みタイトル', { exact: true })).toBeVisible();
  await expect(page.getByText('#focus')).toBeVisible();
});

test('過去の記録を追加から後追いでセッションを登録できる', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '過去の記録を追加' }).click();

  await expect(page.getByRole('dialog', { name: '記録を追加' })).toBeVisible();

  // 0分 ナッジで作業時間を 0 に戻し（00:00）、開始から数え直せる
  await page.getByRole('button', { name: '作業時間を0分に戻す' }).click();
  await expect(page.getByText('00:00', { exact: true })).toBeVisible();

  // 0 から +30分 ナッジを2回で 1時間（01:00）まで積み上げる
  await page.getByRole('button', { name: '終了時刻を30分後ろへ' }).click();
  await page.getByRole('button', { name: '終了時刻を30分後ろへ' }).click();
  await expect(page.getByText('01:00', { exact: true })).toBeVisible();

  await page.getByLabel('タイトル', { exact: true }).fill('議事録まとめ');
  await page.getByRole('button', { name: '記録する' }).click();

  await expect(page.getByRole('dialog', { name: '記録を追加' })).not.toBeVisible();
  await expect(page.getByText('議事録まとめ', { exact: true })).toBeVisible();
});

test('計測中セッションを指定時刻で完了できる', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('何をやる？').fill('資料作成');
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await expect(page.getByText('計測中')).toBeVisible();

  await page.getByRole('button', { name: '詳細編集' }).click();
  await expect(page.getByRole('dialog', { name: '計測中の編集' })).toBeVisible();

  await page.getByRole('button', { name: 'この時刻で完了' }).click();

  // 計測が終わり履歴に残る
  await expect(page.getByText('計測中')).not.toBeVisible();
  await expect(page.getByRole('button', { name: '「資料作成」を編集' })).toBeVisible();
});

test('過去の記録を追加でタイトルを履歴から選べる', async ({ page }) => {
  await page.goto('/');

  // 履歴を1件作る
  await page.getByPlaceholder('何をやる？').fill('週次レビュー');
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await page.getByRole('button', { name: '停止' }).click();

  await page.getByRole('button', { name: '過去の記録を追加' }).click();
  // タイトル欄をクリックすると履歴候補が出る
  await page.getByRole('combobox', { name: 'タイトル' }).click();
  await page.getByRole('option', { name: '週次レビュー' }).click();

  await expect(page.getByRole('combobox', { name: 'タイトル' })).toHaveValue('週次レビュー');
});

test('履歴から同じタスクを再開始できる', async ({ page }) => {
  await page.goto('/');

  // タスクを開始して停止
  await page.getByPlaceholder('何をやる？').fill('元のタスク');
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await page.getByRole('button', { name: '停止' }).click();

  // 履歴から再開始
  await page.getByRole('button', { name: '「元のタスク」を再開始' }).click();

  // 同じタイトルで実行中になることを確認
  await expect(page.getByText('計測中')).toBeVisible();
  await expect(page.getByPlaceholder('何をやる？')).toHaveValue('元のタスク');
});

test('実行中は再開始ボタンが無効になる', async ({ page }) => {
  await page.goto('/');

  // 最初のタスクを開始・停止
  await page.getByPlaceholder('何をやる？').fill('最初のタスク');
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await page.getByRole('button', { name: '停止' }).click();

  // 新しいタスクを開始（実行中状態にする）
  await page.getByPlaceholder('何をやる？').fill('実行中のタスク');
  await page.getByRole('button', { name: '開始', exact: true }).click();

  // 履歴の再開始ボタンが無効化されていることを確認
  const restartButton = page.getByRole('button', { name: '「最初のタスク」を再開始' });
  await expect(restartButton).toBeDisabled();
});
