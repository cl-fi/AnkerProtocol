export function isDeterministicE2E() {
  return (
    process.env.ANKER_DETERMINISTIC_E2E === 'true' ||
    process.env.ANKER_DETERMINISTIC_E2E === '1' ||
    process.env.NEXT_PUBLIC_ANKER_DETERMINISTIC_E2E === 'true' ||
    process.env.NEXT_PUBLIC_ANKER_DETERMINISTIC_E2E === '1'
  );
}

// Production demo switch: serve fixture market data and block on-chain transactions
// while the DeepBook Predict testnet deployment the app targets is unavailable.
export function isDemoMode() {
  return (
    process.env.NEXT_PUBLIC_ANKER_DEMO_MODE === 'true' ||
    process.env.NEXT_PUBLIC_ANKER_DEMO_MODE === '1'
  );
}

// Data routes and quote providers serve fixtures in both modes; demo mode
// additionally disables transaction entry points and shows the demo banner.
export function isFixtureDataMode() {
  return isDeterministicE2E() || isDemoMode();
}
