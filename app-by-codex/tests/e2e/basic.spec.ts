import { test, expect } from '@playwright/test';

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

  await page.getByRole('button', { name: '+5分' }).click();
  await expect(timer).toHaveText(/05:\d{2}/);

  await page.getByRole('button', { name: '-5分' }).click();
  await expect(timer).toHaveText(/00:\d{2}/);
});

test('履歴のモーダル編集でタイトルを更新できる', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('何をやる？').fill('ギター練習');
  await page.getByRole('button', { name: '開始' }).click();
  await page.getByRole('button', { name: '停止' }).click();

  await page.getByRole('button', { name: '編集', exact: true }).click();
  await page.getByLabel('タイトル').fill('アップデート済みタイトル');
  await page.getByLabel('プロジェクト').fill('focus');
  await page.getByRole('button', { name: '保存' }).click();

  await expect(page.getByText('アップデート済みタイトル')).toBeVisible();
  await expect(page.getByText('#focus')).toBeVisible();
});
