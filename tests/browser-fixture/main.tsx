import React from 'react';
import { createRoot } from 'react-dom/client';
import { Providers } from '../../app/providers';
import type { PredictMarketState } from '../../src/deepbook/predictMarketState';
import type { AnkerProductNoteRecord } from '../../src/sui/ankerPortfolio';
import { PortfolioMobileDisconnect } from '../../src/components/PortfolioMobileDisconnect';
import { ProductNoteCard } from '../../src/components/PortfolioProductNoteCard';
import '../../src/styles.css';
import '../../src/mobile.css';

const expiryMs = Date.now() - 60_000;
const oracleId = `0x${'5'.repeat(64)}`;
const note: AnkerProductNoteRecord = {
  noteId: `0x${'c'.repeat(64)}`,
  productType: 'dual-investment',
  productId: 'mobile-layout-fixture',
  owner: `0x${'a'.repeat(64)}`,
  wrapperId: `0x${'b'.repeat(64)}`,
  oracleId,
  expiryMs,
  principal: 501,
  principalBaseUnits: 501_000_000n,
  reserve: 500,
  reserveBaseUnits: 500_000_000n,
  coupon: 2.4,
  couponBaseUnits: 2_400_000n,
  targetPrice: 64_000,
  floorPrice: 63_500,
  lowerBound: 0,
  upperBound: 0,
  isBullish: false,
  usesMockCurrentDeposit: false,
  apr: 1.38,
  feeBps: 1_000,
  legs: [],
  orderIds: [],
  status: 'open',
  redeemedPayout: 0,
  redeemedPayoutBaseUnits: 0n,
  redeemedFee: 0,
  redeemedFeeBaseUnits: 0n,
};
const marketState: PredictMarketState = {
  expiryMarketId: oracleId,
  expiryMs,
  settlementPrice: 66_000,
  settlementPriceBaseUnits: 66_000_000_000_000n,
  settledAtMs: expiryMs + 1,
};

createRoot(document.getElementById('root')!).render(
  <Providers>
    <main className="dual-page" id="portfolio-component-fixture">
      <section className="calculation-section">
        <div className="pf-wallet">
          <PortfolioMobileDisconnect onDisconnect={() => undefined} />
        </div>
      </section>
      <section className="calculation-section">
        <div className="notes-list">
          <ProductNoteCard note={note} marketState={marketState} onClaimSuccess={() => undefined} />
        </div>
      </section>
    </main>
  </Providers>,
);
