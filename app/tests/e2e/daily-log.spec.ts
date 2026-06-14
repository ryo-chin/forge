import { expect, test } from '@playwright/test';

test('チェックボックス項目を追加して当日を記録できる', async ({ page }) => {
  await page.goto('/daily-log');
  await expect(page.getByRole('heading', { name: 'デイリー記録' })).toBeVisible();

  await page.getByRole('button', { name: '項目を追加' }).click();
  await page.getByLabel('項目名').fill('ジムで運動する');
  // 入力の種類は既定でチェックボックス
  await page.getByRole('button', { name: '保存' }).click();

  // 列ヘッダー（編集ボタン）と当日のチェックボックスが出る
  await expect(page.getByRole('button', { name: 'ジムで運動する' })).toBeVisible();

  const todayCheckbox = page.getByRole('checkbox').first();
  await todayCheckbox.check();
  await expect(todayCheckbox).toBeChecked();
});

test('数値項目を追加して記録すると推移グラフが表示される', async ({ page }) => {
  await page.goto('/daily-log');

  await page.getByRole('button', { name: '項目を追加' }).click();
  await page.getByLabel('項目名').fill('体重');
  await page.getByLabel('入力の種類').selectOption('number');
  await page.getByLabel('単位（任意）').fill('kg');
  await page.getByRole('button', { name: '保存' }).click();

  // 当日の数値セルに入力して確定
  const numberCell = page.getByRole('spinbutton').first();
  await numberCell.fill('62.5');
  await numberCell.blur();
  await expect(numberCell).toHaveValue('62.5');

  // 推移グラフが表示される
  await expect(page.getByRole('img', { name: '体重の推移' })).toBeVisible();
});

test('選択ボックス項目は選択肢から記録できる', async ({ page }) => {
  await page.goto('/daily-log');

  await page.getByRole('button', { name: '項目を追加' }).click();
  await page.getByLabel('項目名').fill('体調');
  await page.getByLabel('入力の種類').selectOption('single_select');
  await page.getByLabel('選択肢（1行に1つ）').fill('良い\n普通\n悪い');
  await page.getByRole('button', { name: '保存' }).click();

  // 列が追加され、当日のセル（select）で選べる
  await expect(page.getByRole('button', { name: '体調' })).toBeVisible();
  const select = page.getByRole('combobox').first();
  await select.selectOption('良い');
  await expect(select).toHaveValue('良い');
});
