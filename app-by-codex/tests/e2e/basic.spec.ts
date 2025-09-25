import { test, expect } from '@playwright/test';

test('即時スタートUIが初期表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Training Tracker' })).toBeVisible();
  const input = page.getByPlaceholder('何をやる？');
  await expect(input).toBeVisible();
});
