/**
 * Playwright's webServer boots `next dev` with the deterministic-fixture env
 * (runtimeModes: isDeterministicE2E). Next inlines NEXT_PUBLIC_* vars as
 * constants into compiled bundles and persists them in the webpack cache under
 * distDir, so sharing `.next` between an e2e server and a normal dev server
 * poisons the dev server into fixture mode (day rows become 0xday… fixtures on
 * the $50 ladder). Keep e2e builds in their own dist dir.
 */
const isDeterministicE2E =
  process.env.ANKER_DETERMINISTIC_E2E === 'true' || process.env.ANKER_DETERMINISTIC_E2E === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: isDeterministicE2E ? '.next-e2e' : '.next',
};

export default nextConfig;
