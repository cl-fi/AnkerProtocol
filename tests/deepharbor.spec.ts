import { expect, test } from '@playwright/test';

test('renders the Dual Investment product page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header').getByText('DeepHarbor')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dual Investment Calculator' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nearest BTC Expiry' })).toBeVisible();
  await expect(page.getByLabel('Select expiry')).toBeVisible();
  await expect(page.locator('.oracle-section')).toContainText(/\d+d \d+h \d+m/);
  await expect(page.getByRole('heading', { name: 'Target Buy BTC Quotes' })).toBeVisible();
  await expect(page.getByText('Filter: targets must be strictly below live spot')).toBeVisible();
  await expect(page.locator('td[data-label="Below Spot"]').first()).toContainText(/below/);
  await expect(page.getByLabel('Dual Investment direction').getByRole('link', { name: 'Target Sale' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Design Your Target Buy' })).toBeVisible();
  await expect(page.getByLabel('Products').getByRole('link', { name: 'Shark Fin' })).toBeVisible();
});

test('supports selecting a scan row and running a custom preview', async ({ page }) => {
  await page.goto('/');
  const expirySelect = page.getByLabel('Select expiry');
  await expect(expirySelect).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Use' }).first()).toBeVisible({ timeout: 30_000 });
  const expiryOptions = page.locator('select[aria-label="Select expiry"] option');
  await expect.poll(async () => expiryOptions.count()).toBeGreaterThan(1);
  const optionCount = await expiryOptions.count();
  expect(optionCount).toBeGreaterThan(1);
  await expirySelect.selectOption({ index: Math.min(1, optionCount - 1) });
  await expect(page.getByRole('button', { name: 'Use' }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Use' }).first().click();
  await expect(page.getByLabel('Target Buy Price')).not.toHaveValue('0');
  await page.getByRole('button', { name: 'Preview Live Quote' }).click();
  await expect(page.locator('.quote-detail')).toContainText(/DeepBook Predict Legs|Payoff Preview|failed|MoveAbort|DevInspect/i, {
    timeout: 30_000,
  });
});

test('renders target sale as a coming-soon BTC-collateral product', async ({ page }) => {
  await page.goto('/#target-sale');
  await expect(page.getByRole('heading', { name: 'Target Sale Coming Soon' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Testnet collateral: DBTC')).toBeVisible();
  await expect(page.getByText('DeepBook spot pair: DBTC/DBUSDC')).toBeVisible();
  await expect(page.getByText('Blocked by dUSDC-only Predict settlement')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Target Sale BTC Quotes' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Design Your Target Sale' })).toHaveCount(0);
});
