import { expect, test } from '@playwright/test';

test('renders DeepHarbor workbench', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('DeepHarbor')).toBeVisible();
  await expect(page.getByText('Dual Investment')).toBeVisible();
  await expect(page.getByText('Shark Fin')).toBeVisible();
  await expect(page.getByText('Predict Legs')).toBeVisible({ timeout: 20_000 });
});
