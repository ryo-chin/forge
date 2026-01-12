import { expect, test } from '@playwright/test';

test('即時スタートUIが初期表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Time Tracker' })).toBeVisible();
  const input = page.getByPlaceholder('何をやる？');
  await expect(input).toBeVisible();
  await expect(page.getByRole('button', { name: '開始' })).toBeVisible();
});

test('クイックナッジで作業時間を前後に調整できる', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('何をやる？').fill('ギター練習');
  await page.getByRole('button', { name: '開始' }).click();

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
  await page.getByRole('button', { name: '開始' }).click();
  await page.getByRole('button', { name: '停止' }).click();

  await page.getByRole('button', { name: '「ギター練習」を編集' }).click();
  await page.getByLabel('タイトル').fill('アップデート済みタイトル');
  await page.getByRole('textbox', { name: 'プロジェクト', exact: true }).fill('focus');
  await page.getByRole('button', { name: '保存' }).click();

  await expect(page.getByText('アップデート済みタイトル', { exact: true })).toBeVisible();
  await expect(page.getByText('#focus')).toBeVisible();
});

test('履歴から同じタスクを再開始できる', async ({ page }) => {
  await page.goto('/');

  // タスクを開始して停止
  await page.getByPlaceholder('何をやる？').fill('元のタスク');
  await page.getByRole('button', { name: '開始' }).click();
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
  await page.getByRole('button', { name: '開始' }).click();
  await page.getByRole('button', { name: '停止' }).click();

  // 新しいタスクを開始（実行中状態にする）
  await page.getByPlaceholder('何をやる？').fill('実行中のタスク');
  await page.getByRole('button', { name: '開始' }).click();

  // 履歴の再開始ボタンが無効化されていることを確認
  const restartButton = page.getByRole('button', { name: '「最初のタスク」を再開始' });
  await expect(restartButton).toBeDisabled();
});
