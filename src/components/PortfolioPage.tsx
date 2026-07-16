'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { ArrowUpRight, QrCode, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useAnkerPortfolio } from '../hooks/useAnkerPortfolio';
import { useProductNoteMarketStates } from '../hooks/useProductNoteMarketStates';
import { useProductNoteEventIndex } from '../hooks/useProductNoteEventIndex';
import { useWalletFunds } from '../hooks/useWalletFunds';
import type { PredictMarketState } from '../deepbook/predictMarketState';
import { copyForLocale, DEFAULT_LOCALE, type Locale } from '../i18n';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import { DEFAULT_ANKER_CONFIG } from '../sui/ankerTransactions';
import { lifecycleForProductNote } from '../sui/productNoteLifecycle';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';
import { ClaimSuccessDialog } from './ClaimSuccessDialog';
import type { ConfirmedClaim } from './PortfolioClaimAction';
import { formatAmount, formatPreciseAmount, shortId } from './PortfolioFormat';
import { ProductNoteCard } from './PortfolioProductNoteCard';
import { ReceiveDialog } from './ReceiveDialog';
import { SendDialog } from './SendDialog';
import { Badge, Button, Card } from '../ui';

type PositionFilter = 'all' | 'ready' | 'active' | 'completed';
type PositionBucket = Exclude<PositionFilter, 'all'>;

const FILTER_TABS: { key: PositionFilter }[] = [
  { key: 'all' },
  { key: 'ready' },
  { key: 'active' },
  { key: 'completed' },
];

// Filter bucket derived from each Position plus its Expiry Market settlement state.
function positionBucket(
  note: Pick<AnkerProductNoteRecord, 'status' | 'oracleId' | 'expiryMs'>,
  marketState: PredictMarketState | undefined,
  nowMs: number,
): PositionBucket {
  const lifecycle = lifecycleForProductNote(note, marketState, nowMs);
  if (lifecycle === 'claimed') return 'completed';
  if (lifecycle === 'claimable') return 'ready';
  return 'active';
}

export { ClaimActionView, claimActionViewModel, claimEstimateForNote } from './PortfolioClaimAction';
export {
  IndexedTransactionDigestValue,
  OracleLastUpdateValue,
  SettlementRangeValue,
  SubscriptionDigestValue,
  depositedCashText,
  noteStatusBadge,
} from './PortfolioProductNoteCard';

export function PortfolioPage({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const copy = copyForLocale(locale);
  const account = useCurrentAccount();
  const portfolioQuery = useAnkerPortfolio();
  const funds = useWalletFunds();
  const [filter, setFilter] = useState<PositionFilter>('all');
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  // Claim success dialog state lives at page level: the optimistic claimed-state
  // update moves the position out of the "ready" bucket, unmounting its card —
  // any dialog state kept inside the card would be wiped before it could render.
  const [confirmedClaim, setConfirmedClaim] = useState<ConfirmedClaim | null>(null);
  const contractConfigured = DEFAULT_ANKER_CONFIG.packageId !== '0x0' && DEFAULT_ANKER_CONFIG.packageId.length > 0;
  const notes = portfolioQuery.data ?? [];
  const marketStates = useProductNoteMarketStates(notes);
  const marketStateFor = (note: AnkerProductNoteRecord) => marketStates.byMarketId[note.oracleId.toLowerCase()];
  const noteIds = notes.map((note) => note.noteId);
  const productNoteEventIndexQuery = useProductNoteEventIndex(noteIds);

  const nowMs = Date.now();
  const openNotes = notes.filter((note) => note.status === 'open');
  const expectedRewards = openNotes.reduce((sum, note) => sum + note.coupon, 0);
  // Cumulative Rewards (累计收益): realized payout − principal across every
  // Claim on the current deployment — from the redeemed fields the claimed
  // ProductNote objects keep on-chain.
  const cumulativeRewards = notes
    .filter((note) => note.status === 'redeemed')
    .reduce((sum, note) => sum + (note.redeemedPayout - note.redeemedFee - note.principal), 0);
  // In Position / Total Assets come from useWalletFunds so this band and the
  // account panel can never disagree; expected rewards are never counted in.
  const { inPosition, totalAssets } = funds;

  const bucketOrder: Record<PositionBucket, number> = { ready: 0, active: 1, completed: 2 };
  const sortedNotes = [...notes].sort((left, right) => {
    const weight =
      bucketOrder[positionBucket(left, marketStateFor(left), nowMs)] -
      bucketOrder[positionBucket(right, marketStateFor(right), nowMs)];
    if (weight !== 0) return weight;
    return left.expiryMs - right.expiryMs;
  });
  const counts: Record<PositionFilter, number> = {
    all: notes.length,
    ready: notes.filter((note) => positionBucket(note, marketStateFor(note), nowMs) === 'ready').length,
    active: notes.filter((note) => positionBucket(note, marketStateFor(note), nowMs) === 'active').length,
    completed: notes.filter((note) => positionBucket(note, marketStateFor(note), nowMs) === 'completed').length,
  };
  const nonEmptyBuckets = (['ready', 'active', 'completed'] as const).filter((key) => counts[key] > 0).length;
  const showFilters = nonEmptyBuckets >= 2;
  const activeFilter = showFilters ? filter : 'all';
  const visibleNotes =
    activeFilter === 'all'
      ? sortedNotes
      : sortedNotes.filter((note) => positionBucket(note, marketStateFor(note), nowMs) === activeFilter);

  function handleRefresh() {
    void portfolioQuery.refetch();
    void funds.refresh();
  }

  return (
    <main className="dual-page" id="wallet-portfolio">
      <AppHeader activeProduct="portfolio" locale={locale} />

      <section className="dual-hero calculation-hero">
        <div>
          <h1>{copy.portfolio.title}</h1>
        </div>
        <Button variant="secondary" onClick={handleRefresh} disabled={!account}>
          <RefreshCw size={16} />
          {copy.portfolio.refresh}
        </Button>
      </section>

      {account && contractConfigured ? (
        <section className="calculation-section">
          <div className="pf-wallet">
            <div className="pf-wallet-top">
              <div className="pf-wallet-total">
                {/* Identity lives in the header account control; Receive owns
                    the "get my address" flow (full address + QR + network
                    warning) — the band stays amounts and actions only. */}
                <span className="pf-wallet-label">{copy.portfolio.totalAssets}</span>
                <span className="pf-wallet-amount-row">
                  <strong className="pf-wallet-amount">
                    {totalAssets !== null ? formatAmount(totalAssets, locale) : '—'} <em>dUSDC</em>
                  </strong>
                  {expectedRewards > 0 ? (
                    <em className="pf-wallet-expected">
                      <Sparkles size={13} aria-hidden="true" />
                      +{formatPreciseAmount(expectedRewards, locale)} {copy.portfolio.expectedRewards}
                    </em>
                  ) : null}
                </span>
              </div>
              {/* Transfers are utilities, not the product loop — both stay
                  secondary; gold primary is reserved for Subscribe and Claim. */}
              <div className="pf-wallet-actions">
                <Button variant="secondary" onClick={() => setReceiveOpen(true)}>
                  <QrCode size={16} />
                  {copy.wallet.receive}
                </Button>
                <Button variant="secondary" onClick={() => setSendOpen(true)}>
                  <ArrowUpRight size={16} />
                  {copy.wallet.send}
                </Button>
              </div>
            </div>
            <div className="di-portfolio pf-tiles">
              <div>
                <span>{copy.portfolio.available}</span>
                <strong>{funds.available !== null ? formatAmount(funds.available, locale) : '—'}</strong>
                <small>{copy.portfolio.availableHint}</small>
              </div>
              <div>
                <span>{copy.portfolio.inPosition}</span>
                <strong>{formatAmount(inPosition, locale)}</strong>
                <small>{copy.portfolio.inPositionHint}</small>
              </div>
              <div>
                <span>{copy.portfolio.expectedRewardsTile}</span>
                <strong className="pf-rewards-expected">+{formatPreciseAmount(expectedRewards, locale)}</strong>
                <small>{copy.portfolio.expectedRewardsHint}</small>
              </div>
              <div>
                <span>{copy.portfolio.cumulativeRewards}</span>
                <strong className={cumulativeRewards >= 0 ? 'pf-rewards-positive' : undefined}>
                  {cumulativeRewards >= 0 ? '+' : ''}
                  {formatPreciseAmount(cumulativeRewards, locale)}
                </strong>
                <small>{copy.portfolio.cumulativeRewardsHint}</small>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {!account ? (
        <section className="calculation-section">
          <Card variant="empty">{copy.portfolio.connectWallet}</Card>
        </section>
      ) : null}

      {!account ? null : !contractConfigured ? (
        <section className="calculation-section">
          <Card variant="error">{copy.portfolio.contractNotConfigured}</Card>
        </section>
      ) : portfolioQuery.isPending ? (
        <section className="calculation-section">
          <Card variant="empty">{copy.portfolio.loadingPositions}</Card>
        </section>
      ) : portfolioQuery.error ? (
        <section className="calculation-section">
          <Card variant="error">
            {portfolioQuery.error instanceof Error
              ? portfolioQuery.error.message
              : copy.portfolio.unableToLoadPositions}
          </Card>
        </section>
      ) : notes.length === 0 ? (
        <section className="calculation-section">
          <Card variant="empty">{copy.portfolio.noPositions(shortId(account.address))}</Card>
        </section>
      ) : (
        <section className="calculation-section">
          <div className="section-heading di-positions-heading">
            <h2>{copy.portfolio.yourPositions}</h2>
            <Badge tone="positive">
              {notes.length} {notes.length === 1 ? copy.portfolio.position : copy.portfolio.positions}
            </Badge>
          </div>
          {/* One settlement note for the whole section — repeating it on every
              card buried the numbers under identical fine print. */}
          <p className="di-positions-note">{copy.portfolio.card.outcomeTestnet}</p>
          {showFilters ? (
            <div className="di-position-filters" role="tablist" aria-label={copy.portfolio.filterLabel}>
              {FILTER_TABS.filter((tab) => tab.key === 'all' || counts[tab.key] > 0).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === tab.key}
                  className={activeFilter === tab.key ? 'di-filter is-active' : 'di-filter'}
                  onClick={() => setFilter(tab.key)}
                >
                  {copy.portfolio.filters[tab.key]}
                  <em>{counts[tab.key]}</em>
                </button>
              ))}
            </div>
          ) : null}
          {visibleNotes.length === 0 ? (
            <Card variant="empty">{copy.portfolio.noPositionsInView}</Card>
          ) : (
            <div className="notes-list">
              {visibleNotes.map((note) => (
                <ProductNoteCard
                  note={note}
                  marketState={marketStateFor(note)}
                  eventIndexEntry={productNoteEventIndexQuery.data?.byNoteId[note.noteId]}
                  onClaimSuccess={setConfirmedClaim}
                  locale={locale}
                  key={note.noteId}
                />
              ))}
            </div>
          )}
        </section>
      )}
      {account ? (
        <>
          <ReceiveDialog
            open={receiveOpen}
            address={account.address}
            locale={locale}
            onClose={() => setReceiveOpen(false)}
          />
          <SendDialog open={sendOpen} locale={locale} onClose={() => setSendOpen(false)} />
        </>
      ) : null}
      {confirmedClaim ? (
        <ClaimSuccessDialog
          note={confirmedClaim.note}
          success={confirmedClaim.summary}
          locale={locale}
          onClose={() => setConfirmedClaim(null)}
        />
      ) : null}
      <AppFooter locale={locale} />
    </main>
  );
}
