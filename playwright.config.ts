import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  webServer: {
    // Dedicated port so e2e never reuses a developer's plain `next dev` on 3000,
    // which lacks the deterministic-fixture env and fails against dead upstreams.
    command: 'ANKER_DETERMINISTIC_E2E=true NEXT_PUBLIC_ANKER_DETERMINISTIC_E2E=true npm run dev -- --port 4123',
    // Ready only after /en/app compiles — CI was flaking on the landing→app click
    // while Next cold-compiled that route under parallel workers.
    url: 'http://127.0.0.1:4123/en/app',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://127.0.0.1:4123',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
