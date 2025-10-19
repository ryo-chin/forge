import { expect, test } from '@playwright/test';

test.describe('モバイルレイアウト', () => {
  test.beforeEach(async ({}, testInfo) => {
    if (testInfo.project.name !== 'Mobile Chrome') {
      test.skip();
    }
  });

  test('開始と停止がスクロール無しで完了できる', async ({ page }) => {
    await page.goto('/');

    const hasHorizontalScroll = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      return (
        body.scrollWidth - doc.clientWidth > 1 ||
        doc.scrollWidth - doc.clientWidth > 1
      );
    });
    expect(hasHorizontalScroll).toBeFalsy();

    await page.getByPlaceholder('何をやる？').fill('モバイル操作');
    await page.getByRole('button', { name: '開始' }).click();
    await expect(page.getByRole('button', { name: '停止' })).toBeVisible();

    const scrollTopWhileRunning = await page.evaluate(() => window.scrollY);
    expect(scrollTopWhileRunning).toBeLessThan(5);

    await page.getByRole('button', { name: '停止' }).click();
    await expect(page.getByRole('button', { name: '開始' })).toBeVisible();
  });

  test('ハンバーガーメニューを開閉できる', async ({ page }) => {
    await page.goto('/');

    const openButton = page.getByRole('button', { name: 'メニューを開く' });
    await openButton.click();

    const menuDialog = page.getByRole('dialog', { name: 'ナビゲーションメニュー' });
    await expect(menuDialog).toBeVisible();

    await page.locator('.time-tracker__nav-close').click();
    await expect(page.locator('.time-tracker__nav-overlay')).toHaveCount(0);
  });
});
