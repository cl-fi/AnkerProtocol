import { expect, test } from '@playwright/test';

test('renders the Anker Protocol landing hero', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header').getByText('Anker Protocol')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Drop anchor on your yield.' })).toBeVisible();
  await expect(page.getByText("Structured yield products, built on DeepBook's prediction markets.")).toBeVisible();
  await expect(page.getByRole('link', { name: 'Launch' })).toBeVisible();
  await expect(page.getByLabel('Products')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open Dual Investment' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open Shark Fin' })).toHaveCount(0);
  await expect(page.getByText('Templates')).toHaveCount(0);
});

test('launch opens the app workbench', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Launch' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator('header').getByText('Anker Protocol')).toBeVisible();
  await expect(page.getByLabel('Products').getByText('Templates')).toHaveCount(0);
  await expect(page.getByLabel('Products').getByText('Auto Roll')).toHaveCount(0);
  await expect(page.getByText('Binance compare')).toHaveCount(0);
  await expect(page.getByText('Binance APR')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Dual Investment Calculator' })).toBeVisible();
});

test('renders the Dual Investment product page', async ({ page }) => {
  await page.goto('/app/dual-investment');
  await expect(page.locator('header').getByText('Anker Protocol')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dual Investment Calculator' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nearest BTC Expiry' })).toBeVisible();
  await expect(page.getByLabel('Select expiry')).toBeVisible();
  await expect(page.getByText('Oracle selector: live-ready BTC markets only')).toBeVisible();
  await expect(page.locator('.oracle-section')).toContainText(/\d+d \d+h \d+m/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Target Buy BTC Quotes' })).toBeVisible();
  await expect(page.getByText('Default notional: 5 dUSDC')).toBeVisible();
  await expect(page.getByText('Filter: targets must be strictly below live spot')).toBeVisible();
  await expect(page.locator('td[data-label="Below Spot"]').first()).toContainText(/below/);
  await expect(page.getByLabel('Dual Investment direction').getByRole('link', { name: 'Target Sale' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Design Your Target Buy' })).toBeVisible();
  await expect(page.getByLabel('Products').getByRole('link', { name: 'Shark Fin' })).toHaveCount(0);
  await expect(page.getByLabel('Products').getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await expect(page.locator('td[data-label="Anker APR"]').first()).toBeVisible();
  await expect(page.getByText('Binance compare')).toHaveCount(0);
  await expect(page.getByText('Binance APR')).toHaveCount(0);
  await expect(page.locator('td[data-label="Edge"]')).toHaveCount(0);
});

test('renders the wallet dashboard entry point', async ({ page }) => {
  await page.goto('/app/dashboard');
  await expect(page.locator('header').getByText('Anker Protocol')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wallet Dashboard' })).toBeVisible();
  await expect(page.getByText('Connect your wallet to view Anker product notes.')).toBeVisible();
  await expect(page.getByText('Product notes are owned objects created by the Anker Protocol contract.')).toBeVisible();
});

test('supports selecting a scan row and running a custom preview', async ({ page }) => {
  await page.goto('/app/dual-investment');
  const expirySelect = page.getByLabel('Select expiry');
  await expect(expirySelect).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Use' }).first()).toBeVisible({ timeout: 30_000 });
  const expiryOptions = page.locator('select[aria-label="Select expiry"] option');
  await expect.poll(async () => expiryOptions.count(), { timeout: 30_000 }).toBeGreaterThan(1);
  const optionCount = await expiryOptions.count();
  expect(optionCount).toBeGreaterThan(1);
  await expirySelect.selectOption({ index: Math.min(1, optionCount - 1) });
  await expect(page.getByRole('button', { name: 'Use' }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Use' }).first().click();
  await expect(page.getByLabel('Target Buy Price')).not.toHaveValue('0');
  await page.getByRole('button', { name: 'Preview Live Quote' }).click();
  await expect(page.locator('.quote-detail')).toContainText(/DeepBook Predict Legs|Payoff Preview/i, { timeout: 30_000 });
  await expect(page.locator('.quote-detail')).not.toContainText(/failed|MoveAbort|DevInspect/i);
});

test('renders target sale as a coming-soon BTC-collateral product', async ({ page }) => {
  await page.goto('/app/dual-investment?mode=target-sale');
  await expect(page.getByRole('heading', { name: 'Target Sale Coming Soon' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Testnet collateral: DBTC')).toBeVisible();
  await expect(page.getByText('DeepBook spot pair: DBTC/DBUSDC')).toBeVisible();
  await expect(page.getByText('Blocked by dUSDC-only Predict settlement')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Target Sale BTC Quotes' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Design Your Target Sale' })).toHaveCount(0);
});

test('redirects legacy Dual Investment routes into the app namespace', async ({ page }) => {
  await page.goto('/dual-investment?mode=target-sale');
  await expect(page).toHaveURL(/\/app\/dual-investment\?mode=target-sale$/);
  await expect(page.getByRole('heading', { name: 'Target Sale Coming Soon' })).toBeVisible({ timeout: 30_000 });
});
