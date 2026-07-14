import { expect, type Page, test } from '@playwright/test';

async function expectDualInvestmentWorkspace(page: Page) {
  await expect(page.locator('main#dual-investment')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dual Investment' })).toBeVisible();

  const market = page.getByRole('region', { name: 'Choose your market' });
  await expect(market).toBeVisible();
  await expect(market.getByRole('link', { name: 'Buy Low' })).toBeVisible();
  await expect(market.getByRole('button', { name: 'Sell High' })).toHaveAttribute('aria-disabled', 'true');

  // Merged page: one tenor dropdown, day group first (primary product), hourly group tradable.
  const tenor = market.getByLabel('Tenor');
  await expect(tenor).toBeVisible();
  await expect(tenor.locator('optgroup').first()).toHaveAttribute(
    'label',
    'Days — primary product · snapshot',
  );
  await expect(tenor.locator('optgroup').nth(1)).toHaveAttribute('label', 'Hours — tradable now');

  // Day-scale copy vs sub-day yield copy — `isSubDayTenor` is wall-clock based, so a
  // default day snapshot sitting on the 24h boundary can render either branch.
  const reference = page.getByRole('region', { name: /^(APR reference|Per-period yield)$/ });
  await expect(reference.getByRole('heading', { name: /^Price & (APR|yield) reference$/ })).toBeVisible();
  await expect(reference.getByRole('button', { name: 'Refresh' })).toBeVisible();

  await expect(page.getByRole('region', { name: 'Set your Buy Low' })).toBeVisible();
}

async function waitForReferenceRows(page: Page) {
  const rows = page.locator('.di-reference-table tbody tr');
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => rows.count(), { timeout: 30_000 }).toBeGreaterThan(1);
  return rows;
}

test('landing page launches the Dual Investment workspace', async ({ page }) => {
  await page.goto('/');

  const hero = page.getByRole('region', { name: 'Anker Protocol' });
  await expect(hero.getByRole('heading', { name: 'Drop anchor on your yield.' })).toBeVisible();
  await expect(hero.getByText('DeepBook Predict prices volatility on-chain.')).toBeVisible();

  // Prefer the header CTA class so we don't race LanguageSwitcher links, and allow
  // a long URL wait — CI cold-compiles /en/app under parallel workers.
  const launch = page.locator('header a.landing-launch');
  await expect(launch).toHaveAttribute('href', '/en/app');
  await Promise.all([
    page.waitForURL(/\/en\/app\/?$/, { timeout: 30_000 }),
    launch.click(),
  ]);
  await expectDualInvestmentWorkspace(page);
});

test('renders the Dual Investment market controls and quote reference table', async ({ page }) => {
  await page.goto('/app/dual-investment');

  await expectDualInvestmentWorkspace(page);
  const rows = await waitForReferenceRows(page);
  await expect(rows.first()).toContainText('below');
  await expect(rows.first()).toContainText('%');
});

test('supports selecting a Buy Low reference row and changing payoff smoothness', async ({ page }) => {
  await page.goto('/app/dual-investment');
  await expectDualInvestmentWorkspace(page);

  const rows = await waitForReferenceRows(page);
  await rows.nth(1).click();

  const controls = page.getByRole('region', { name: 'Set your Buy Low' });
  const inputs = controls.locator('input[type="number"]');
  await expect(inputs.nth(0)).toHaveValue('5');
  await expect(inputs.nth(1)).not.toHaveValue('0');

  await expect(page.getByRole('heading', { name: 'Return Overview' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Confirm your Buy Low' })).toBeVisible();

  const advanced = page.locator('details.di-advanced');
  await advanced.locator('summary').click();
  const smoothness = advanced.locator('select');
  await smoothness.selectOption('9');
  await expect(smoothness).toHaveValue('9');
  await expect(advanced.getByRole('heading', { name: 'DeepBook Predict Legs' })).toBeVisible();
  await expect.poll(() => advanced.locator('.leg-disclosure-row').count()).toBeGreaterThan(0);
});

test('renders the wallet portfolio entry point when disconnected', async ({ page }) => {
  await page.goto('/app/portfolio');

  await expect(page).toHaveURL(/\/en\/app\/portfolio$/);
  await expect(page.locator('main#wallet-portfolio')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Products' }).getByRole('link', { name: 'Portfolio' })).toBeVisible();
  await expect(page.getByText('Connect your wallet to see your Notes.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeDisabled();
});

test('redirects legacy dashboard paths to the portfolio route in both locales', async ({ page }) => {
  await page.goto('/app/dashboard');
  await expect(page).toHaveURL(/\/en\/app\/portfolio$/);
  await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();

  await page.goto('/en/app/dashboard');
  await expect(page).toHaveURL(/\/en\/app\/portfolio$/);

  await page.goto('/zh-CN/app/dashboard');
  await expect(page).toHaveURL(/\/zh-CN\/app\/portfolio$/);
  await expect(page.getByRole('heading', { name: '持仓' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '产品' }).getByRole('link', { name: '持仓' })).toBeVisible();
});

test('renders the Analytics page with fixture headline stats, Edge chart, and methodology', async ({
  page,
}) => {
  await page.goto('/analytics');

  await expect(page).toHaveURL(/\/en\/analytics$/);
  await expect(page.locator('main#benchmark-analytics')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Products' }).getByRole('link', { name: 'Analytics' })).toBeVisible();

  const stats = page.getByLabel('Headline statistics');
  await expect(stats).toBeVisible();
  await expect(stats.getByText('Samples')).toBeVisible();
  await expect(stats.getByText('4', { exact: true })).toBeVisible();
  await expect(stats.getByText('75%')).toBeVisible();
  await expect(stats.getByText('+10.00 pts')).toBeVisible();
  await expect(stats.locator('.analytics-stats > div').filter({ hasText: 'Leading streak' })).toContainText(
    '2',
  );
  await expect(stats.getByText('Runs')).toBeVisible();
  await expect(stats.getByText('80%')).toBeVisible();

  const chart = page.getByRole('region', { name: 'Edge time series' });
  await expect(chart).toBeVisible();
  await expect(chart.getByRole('heading', { name: 'Edge over time' })).toBeVisible();
  await expect(chart.getByTestId('analytics-edge-chart')).toBeVisible();
  await expect(chart.getByText('1d')).toBeVisible();
  await expect(chart.getByText('3d')).toBeVisible();
  await expect(chart.getByText('7d')).toBeVisible();
  // Zero axis + negative scale (fixture includes a −5 pts 1d Edge).
  await expect(chart.getByText('+0.00 pts')).toBeVisible();
  await expect(chart.getByText('-7.50 pts')).toBeVisible();
  await expect(chart.getByText('0', { exact: true })).toBeVisible();

  const firstDot = chart.locator('.recharts-line-dots circle').first();
  await firstDot.hover();
  const tooltip = chart.locator('.analytics-edge-tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip.getByText('Anker net APR')).toBeVisible();
  await expect(tooltip.getByText('Nearest-expiry Binance APR')).toBeVisible();
  await expect(tooltip.getByText('Settlement offset')).toBeVisible();

  const methodology = page.getByRole('region', { name: 'Methodology' });
  await expect(methodology).toBeVisible();
  await expect(methodology.getByText(/every 15 minutes/i)).toBeVisible();
  await expect(methodology.getByText(/exceeds 50%/i)).toBeVisible();
  await expect(methodology.getByText(/net after protocol fee/i)).toBeVisible();
  await expect(methodology.getByText(/live-source matched Samples/i)).toBeVisible();
  await expect(methodology.getByText(/Failed Runs record no Samples/i)).toBeVisible();
  await expect(methodology.getByText(/Sample start date:/i)).toBeVisible();
  await expect(methodology.getByRole('link', { name: 'Source repository' })).toHaveAttribute(
    'href',
    'https://github.com/cl-fi/AnkerProtocol',
  );
});

test('renders Chinese Analytics copy in fixture mode', async ({ page }) => {
  await page.goto('/zh-CN/analytics');

  await expect(page).toHaveURL(/\/zh-CN\/analytics$/);
  await expect(page.getByRole('heading', { name: '数据分析' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Edge 随时间变化' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '方法说明' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '产品' }).getByRole('link', { name: '数据分析' })).toBeVisible();
});

test('normalizes legacy and disabled Sell High routes to the Buy Low workspace', async ({ page }) => {
  await page.goto('/app/dual-investment?mode=target-sale');
  await expect(page).toHaveURL(/\/app\/dual-investment$/);
  await expectDualInvestmentWorkspace(page);

  await page.goto('/dual-investment?mode=target-sale');
  await expect(page).toHaveURL(/\/app\/dual-investment$/);
  await expectDualInvestmentWorkspace(page);
});

test('redirects the retired multi-day route to the merged Dual Investment page', async ({ page }) => {
  await page.goto('/en/app/multi-day');
  await expect(page).toHaveURL(/\/en\/app\/dual-investment$/);
  await expectDualInvestmentWorkspace(page);
});
