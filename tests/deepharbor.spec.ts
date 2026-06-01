import { expect, test } from '@playwright/test';

test('renders DeepHarbor workbench', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('DeepHarbor')).toBeVisible();
  await expect(page.getByText('Dual Investment')).toBeVisible();
  await expect(page.getByText('Shark Fin')).toBeVisible();
  await expect(page.getByText('Predict Legs')).toBeVisible({ timeout: 20_000 });
});

test('keeps the selected product tab after quote refreshes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Predict Legs')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Shark Fin' }).click();
  await expect(page.getByText('Lower bound')).toBeVisible();
  await page.waitForTimeout(1_000);
  await expect(page.getByText('Lower bound')).toBeVisible();
});
