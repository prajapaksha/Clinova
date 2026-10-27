import { test, expect } from '@playwright/test';

test('bootstraps the app', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('app-root')).toBeAttached();
});