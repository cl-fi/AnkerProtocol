import { expect, type Page, test } from '@playwright/test';

const phoneWidths = [320, 430, 767] as const;
const routes = [
  { path: '/en/app/dual-investment', active: 'Dual Investment' },
  { path: '/en/app/portfolio', active: 'Portfolio' },
  { path: '/en/analytics', active: 'Analytics' },
] as const;
const chineseRoutes = [
  { path: '/zh-CN/app/dual-investment', active: '双币赢' },
  { path: '/zh-CN/app/portfolio', active: '持仓' },
  { path: '/zh-CN/analytics', active: '数据分析' },
] as const;

async function gotoReady(page: Page, path: string) {
  try {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('ERR_ABORTED')) throw error;
    await page.goto(path, { waitUntil: 'domcontentloaded' });
  }
  await expect(page.locator('main')).toBeVisible();
}

async function expectPhoneChrome(page: Page, active: string) {
  const layout = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('.top-nav');
    const nav = document.querySelector<HTMLElement>('.product-nav');
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      headerHeight: header?.getBoundingClientRect().height ?? 0,
      navPosition: nav ? getComputedStyle(nav).position : '',
      navBottom: nav ? Math.round(window.innerHeight - nav.getBoundingClientRect().bottom) : -1,
    };
  });

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.headerHeight).toBeLessThanOrEqual(62);
  expect(layout.navPosition).toBe('fixed');
  expect(layout.navBottom).toBeGreaterThanOrEqual(10);

  const navigation = page.locator('.product-nav');
  await expect(navigation.getByRole('link', { name: active })).toHaveAttribute('aria-current', 'page');
}

test.describe('phone layout', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Phone-only acceptance coverage.');
  });

  for (const width of phoneWidths) {
    test(`${width}px keeps all application pages inside the viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });

      for (const route of routes) {
        await gotoReady(page, route.path);
        await expectPhoneChrome(page, route.active);
      }
    });
  }

  test('bottom navigation changes pages and preserves its active state', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/app/dual-investment');

    const navigation = page.getByRole('navigation', { name: 'Products' });
    await navigation.getByRole('link', { name: 'Portfolio' }).click();
    await expect(page).toHaveURL(/\/en\/app\/portfolio$/);
    await expect(navigation.getByRole('link', { name: 'Portfolio' })).toHaveAttribute('aria-current', 'page');

    await navigation.getByRole('link', { name: 'Analytics' }).click();
    await expect(page).toHaveURL(/\/en\/analytics$/);
    await expect(navigation.getByRole('link', { name: 'Analytics' })).toHaveAttribute('aria-current', 'page');
  });

  for (const width of phoneWidths) {
    test(`${width}px wallet entry routes Dual Investment and Analytics users to Portfolio`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });

      for (const sourcePath of ['/en/app/dual-investment', '/en/analytics']) {
        await gotoReady(page, sourcePath);
        const walletEntry = page.locator('.top-nav').getByRole('link', { name: 'View Portfolio' });
        await expect(walletEntry).toBeVisible();
        await expect(page.locator('.top-nav .desktop-wallet-entry')).toBeHidden();

        await walletEntry.click();
        await expect(page).toHaveURL(/\/en\/app\/portfolio#wallet-portfolio$/);
        await expect(page.locator('.portfolio-connect-empty').getByRole('button', { name: 'Connect' })).toBeVisible();
      }
    });
  }

  test('Chinese labels keep the 320px app bar and navigation inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    for (const route of chineseRoutes) {
      await gotoReady(page, route.path);
      await expectPhoneChrome(page, route.active);
    }
  });

  test('price ladder starts folded and closes after choosing a price', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/app/dual-investment');

    await expect(page.locator('.return-outcome:visible')).toHaveCount(1);
    await page.getByRole('button', { name: /^At or Below/ }).click();
    await expect(page.locator('.return-outcome.is-below')).toBeVisible();
    await expect(page.locator('.return-outcome.is-above')).toBeHidden();

    const disclosure = page.locator('.di-reference-disclosure > .mobile-disclosure__toggle');
    await expect(disclosure).toBeVisible();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await disclosure.click();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');

    const rows = page.locator('.di-reference-table tbody tr');
    await expect(rows.nth(1)).toBeVisible({ timeout: 30_000 });
    const selectedPrice = (await rows.nth(1).locator('strong').first().textContent())?.replace(/[$,]/g, '');
    expect(selectedPrice).toBeTruthy();
    await rows.nth(1).click();

    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('spinbutton', { name: /Buy Low price/ })).toHaveValue(selectedPrice!);
  });

  test('settlement date keeps its text control vertically centered', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await gotoReady(page, '/en/app/dual-investment');

    const layout = await page.locator('.di-select-grow .expiry-select').evaluate((wrapper) => {
      const select = wrapper.querySelector('select');
      if (!select) throw new Error('Settlement select is missing');
      const wrapperRect = wrapper.getBoundingClientRect();
      const selectRect = select.getBoundingClientRect();
      const style = getComputedStyle(select);
      return {
        wrapperHeight: wrapperRect.height,
        selectHeight: selectRect.height,
        centerDelta: Math.abs(
          wrapperRect.top + wrapperRect.height / 2 - (selectRect.top + selectRect.height / 2),
        ),
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
      };
    });

    expect(layout.wrapperHeight).toBe(48);
    expect(layout.selectHeight).toBeGreaterThanOrEqual(42);
    expect(layout.centerDelta).toBeLessThanOrEqual(1);
    expect(layout.paddingTop).toBe('0px');
    expect(layout.paddingBottom).toBe('0px');
  });

  test('claimable position renders the compact row whose sheet carries the detail', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 900 });
    await page.goto('http://127.0.0.1:4124');
    await expect(page.locator('main#portfolio-component-fixture')).toBeVisible();

    // A claimable row: two-line summary plus an inline Claim, no accordion.
    const row = page.locator('.di-position-compact');
    await expect(row).toBeVisible();
    const claimBox = await page.locator('.di-position-claim').boundingBox();
    if (!claimBox) throw new Error('Claim button is not measurable');
    expect(claimBox.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('.di-position-toggle')).toHaveCount(0);

    // Tapping the row opens the bottom-sheet detail with the outcome fork.
    await row.click();
    const sheet = page.getByRole('dialog', { name: 'Details' });
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.di-outcome-fork')).toBeVisible();
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toBeHidden();
  });

  test('subscribe action docks only after its inline position has been seen and passed', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/oracles/*/market?*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const oracleId = requestUrl.pathname.split('/').at(-2) ?? '0xoracle';
      const now = Date.now();
      await route.fulfill({
        json: {
          predictId: '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a',
          oracleId,
          underlyingAsset: 'BTC',
          expiryMs: now + 60 * 60_000,
          minStrike: 1,
          tickSize: 0.01,
          admissionTickSize: 1,
          status: 'active',
          spot: 63_960.99,
          forward: 63_961.48,
          spotTimestampMs: now - 1_000,
          sviTimestampMs: now - 1_000,
          serverLagSeconds: 1,
          svi: {
            a: 0.000018652,
            b: 0.001284769,
            rho: -0.709081279,
            m: -0.00188903,
            sigma: 0.001665076,
          },
          predictPricing: {
            baseSpread: 0.02,
            minSpread: 0.005,
            baseFee: 0.02,
            minFee: 0.005,
            utilizationMultiplier: 0,
            minAskPrice: 0.02,
            maxAskPrice: 0.99,
            vaultBalance: 0,
            vaultTotalMtm: 0,
            vaultUtilization: 0,
            ewmaPenaltyRate: 0,
          },
        },
      });
    });
    await page.goto('/en/app/dual-investment');

    const settlement = page.getByLabel('Settlement date');
    const hourlyValue = await settlement
      .locator('optgroup')
      .nth(1)
      .locator('option')
      .first()
      .getAttribute('value');
    expect(hourlyValue).toBeTruthy();
    await settlement.selectOption(hourlyValue!);
    await page.getByRole('spinbutton', { name: /Amount/ }).fill('1000');

    const slot = page.locator('.mobile-action-dock__slot');
    const surface = slot.locator('.mobile-action-dock__surface');
    await expect(slot.getByRole('button', { name: 'Connect' })).toBeVisible({ timeout: 30_000 });
    await expect(surface).not.toHaveClass(/is-floating/);
    // The inline CTA sits near the document end while Advanced details is
    // collapsed. Expanding the downstream content creates the real "read on"
    // path in which the already-seen CTA can leave through the top edge.
    await page.locator('details.di-advanced > summary').evaluate((element: HTMLElement) => element.click());

    await slot.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await expect
      .poll(() =>
        slot.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= window.innerHeight;
        }),
      )
      .toBe(true);
    await expect(surface).not.toHaveClass(/is-floating/);
    await slot.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + rect.top + rect.height + 24);
    });
    await expect
      .poll(() => slot.evaluate((element) => element.getBoundingClientRect().top < 0))
      .toBe(true);
    await expect(surface).toHaveClass(/is-floating/);
    await expect(slot.locator('.ticket-confirm')).toHaveCount(1);

    await slot.scrollIntoViewIfNeeded();
    await expect(surface).not.toHaveClass(/is-floating/);
    await expect(slot.locator('.ticket-confirm')).toHaveCount(1);
  });

  test('methodology is a keyboard-operable mobile disclosure', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 900 });
    await page.goto('/en/analytics');

    const methodology = page.getByRole('region', { name: 'Methodology' });
    const disclosure = methodology.locator(
      '.analytics-methodology-disclosure > .mobile-disclosure__toggle',
    );
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await disclosure.focus();
    await page.keyboard.press('Enter');
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await expect(methodology.getByText('Sampling cadence')).toBeVisible();
  });

  test('connect dialog is a scrollable bottom sheet inside the dynamic viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/en/app/portfolio');
    await page.locator('.portfolio-connect-empty').getByRole('button', { name: 'Connect' }).click();

    const dialog = page.getByRole('dialog', { name: 'Sign in' });
    await expect(dialog).toBeVisible();
    await expect
      .poll(() =>
        dialog.evaluate((element) =>
          Math.abs(window.innerHeight - element.getBoundingClientRect().bottom),
        ),
      )
      .toBeLessThanOrEqual(1);
    const sheet = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        bottomGap: window.innerHeight - rect.bottom,
        left: rect.left,
        width: rect.width,
        viewportWidth: window.innerWidth,
        height: rect.height,
        viewportHeight: window.innerHeight,
        overflowY: getComputedStyle(element).overflowY,
      };
    });
    expect(Math.abs(sheet.bottomGap)).toBeLessThanOrEqual(1);
    expect(Math.abs(sheet.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(sheet.width - sheet.viewportWidth)).toBeLessThanOrEqual(1);
    expect(sheet.height).toBeLessThan(sheet.viewportHeight);
    expect(['auto', 'scroll']).toContain(sheet.overflowY);

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
  });
});

test('desktop keeps the existing header wallet dialog entry', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Desktop-only compatibility coverage.');
  await page.setViewportSize({ width: 1024, height: 768 });
  await gotoReady(page, '/en/app/dual-investment');

  await expect(page.locator('.top-nav').getByRole('link', { name: 'View Portfolio' })).toBeHidden();
  const connect = page.locator('.top-nav').getByRole('button', { name: 'Connect' });
  await expect(connect).toBeVisible();
  await connect.click();
  await expect(page.getByRole('dialog', { name: 'Sign in' })).toBeVisible();
});
