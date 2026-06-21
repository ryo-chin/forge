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

  // チェックは remote クエリで制御されるため、click 後に retry 付きで反映を待つ
  const todayCheckbox = page.getByRole('checkbox').first();
  await todayCheckbox.click();
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

test('列ヘッダのドラッグで項目順を入れ替えられ、リロード後も保持される', async ({ page }) => {
  await page.goto('/daily-log');

  // 2項目を追加（追加順に「あ」「い」が並ぶ）
  for (const name of ['あ', 'い']) {
    await page.getByRole('button', { name: '項目を追加' }).click();
    await page.getByLabel('項目名').fill(name);
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }

  const headNames = () => page.locator('.daily-log__col-head');
  await expect(headNames().first()).toHaveText('あ');

  // 「い」のドラッグハンドルを「あ」の位置までドラッグ（dnd-kit は pointer + activation distance）
  const handle = page.getByRole('button', { name: 'い の並び替え' });
  const target = page.getByRole('button', { name: 'あ', exact: true });
  const hb = await handle.boundingBox();
  const tb = await target.boundingBox();
  if (!hb || !tb) throw new Error('bounding box not found');
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x - 12, hb.y + hb.height / 2, { steps: 6 }); // activation distance 超え
  await page.mouse.move(tb.x - 4, tb.y + tb.height / 2, { steps: 12 });
  await page.mouse.up();

  // 先頭列が「い」に入れ替わる（楽観更新）
  await expect(headNames().first()).toHaveText('い');

  // リロードしても保持される（localStorage に displayOrder が保存済み）
  await page.reload();
  await expect(headNames().first()).toHaveText('い');
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
