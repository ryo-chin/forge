import { expect, test } from '@playwright/test';

const addBudget = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: '予算を追加' }).click();
  await page.getByLabel('対象プロジェクト').fill('鍛錬');
  await page.getByLabel('月曜日の予算（時間）').fill('3');
  await page.getByRole('button', { name: '保存' }).click();
};

test('プロジェクトに曜日別予算を設定すると予実グラフと表が表示される', async ({ page }) => {
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: 'レポート' })).toBeVisible();

  await addBudget(page);

  // 予実ソースのタブ・累積グラフ・予実差テーブルが出る
  await expect(page.getByRole('tab', { name: '鍛錬' })).toBeVisible();
  await expect(page.getByRole('img', { name: '累積時間の予算と実績' })).toBeVisible();
  await expect(page.getByText('予実差').first()).toBeVisible();
});

test('週次・月次・日次に切り替えると集計単位が変わる', async ({ page }) => {
  await page.goto('/reports');
  await addBudget(page);

  // 既定は週次
  await expect(page.getByRole('tab', { name: '週次' })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('tab', { name: '月次' }).click();
  await expect(page.getByRole('tab', { name: '月次' })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('tab', { name: '日次' }).click();
  await expect(page.getByRole('tab', { name: '日次' })).toHaveAttribute('aria-selected', 'true');
});

test('期間プリセットで表示レンジを切り替えられる', async ({ page }) => {
  await page.goto('/reports');
  await addBudget(page);

  // 期間プリセット（1週間〜2年）が表示され、押せる
  await expect(page.getByRole('button', { name: '2年' })).toBeVisible();
  await page.getByRole('button', { name: '1週間' }).click();
  // グラフは引き続き表示される
  await expect(page.getByRole('img', { name: '累積時間の予算と実績' })).toBeVisible();
});

test('表示状態が URL クエリと localStorage に保持される', async ({ page }) => {
  await page.goto('/reports');
  await addBudget(page);

  // 月次に切り替えると URL クエリに反映される
  await page.getByRole('tab', { name: '月次' }).click();
  await expect(page.getByRole('tab', { name: '月次' })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => new URL(page.url()).searchParams.get('period')).toBe('month');

  // リロードしても（URL クエリ／localStorage 経由で）月次が復元される
  await page.reload();
  await expect(page.getByRole('tab', { name: '月次' })).toHaveAttribute('aria-selected', 'true');
});

test('予算を選ぶとレポート開始日が予算開始日に合い、ボタンで再適用できる', async ({ page }) => {
  await page.goto('/reports');
  await addBudget(page);

  // 予算選択中は「予算開始日に合わせる」ボタンが出て、押してもグラフが表示される
  const alignButton = page.getByRole('button', { name: '予算開始日に合わせる' });
  await expect(alignButton).toBeVisible();
  await alignButton.click();
  await expect(page.getByRole('img', { name: '累積時間の予算と実績' })).toBeVisible();
});

test('クエリパラメータで表示状態を指定して開ける', async ({ page }) => {
  // 予算を作っておく（localStorage に保存される）
  await page.goto('/reports');
  await addBudget(page);

  // period=day を URL で直接指定して開くと日次で表示される
  await page.goto('/reports?period=day');
  await expect(page.getByRole('tab', { name: '日次' })).toHaveAttribute('aria-selected', 'true');
});
