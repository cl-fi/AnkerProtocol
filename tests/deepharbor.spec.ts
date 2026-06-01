import { expect, test } from '@playwright/test';

test('renders the Dual Investment product page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header').getByText('DeepHarbor')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dual Investment' })).toBeVisible();
  await expect(page.getByText('Choose an Asset')).toBeVisible();
  await expect(page.getByText('Choose a Pair')).toBeVisible();
  await expect(page.getByText('Choose a Direction')).toBeVisible();
  await expect(page.getByLabel('Products').getByRole('link', { name: 'Shark Fin' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'DeepBook Predict Legs' })).toBeVisible({ timeout: 20_000 });
});

test('shows selectable quote rows and payoff transparency', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'DeepBook Predict Legs' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Subscribe' }).first()).toBeVisible();
  await expect(page.getByText('Payoff Preview')).toBeVisible();
  await expect(page.getByText(/Executable|Preview/).first()).toBeVisible();
});
