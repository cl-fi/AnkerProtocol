'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useAnkerPortfolio } from '../hooks/useAnkerPortfolio';
import { usePredictManagers } from '../hooks/usePredictManagers';
import { useProductNoteEventIndex } from '../hooks/useProductNoteEventIndex';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import { DEFAULT_ANKER_CONFIG } from '../sui/ankerTransactions';
import { AppHeader } from './AppHeader';
import { formatAmount, formatPreciseAmount, shortId } from './DashboardFormat';
import { ProductNoteCard, managerValidationForNote } from './DashboardProductNoteCard';

type PositionFilter = 'all' | 'ready' | 'active' | 'completed';
type PositionBucket = Exclude<PositionFilter, 'all'>;

const FILTER_TABS: { key: PositionFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready to claim' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

// Coarse bucket from owned-object fields alone (no per-note manager state needed).
// The card pill still shows the precise lifecycle (Settling / Action needed / …).
function positionBucket(note: Pick<AnkerProductNoteRecord, 'status' | 'expiryMs'>, nowMs: number): PositionBucket {
  if (note.status === 'redeemed') return 'completed';
  if (nowMs >= note.expiryMs) return 'ready';
  return 'active';
}

export { ClaimActionView, claimActionViewModel, redeemEstimateForNote } from './DashboardClaimAction';
export {
  AllocatedPositionsValue,
  IndexedTransactionDigestValue,
  OracleLastUpdateValue,
  SettlementRangeValue,
  SubscriptionDigestValue,
  depositedCashText,
  managerValidationForNote,
  positionStatusBadge,
} from './DashboardProductNoteCard';

export function DashboardPage() {
  const account = useCurrentAccount();
  const portfolioQuery = useAnkerPortfolio();
  const managersQuery = usePredictManagers();
  const [filter, setFilter] = useState<PositionFilter>('all');
  const contractConfigured = DEFAULT_ANKER_CONFIG.packageId !== '0x0' && DEFAULT_ANKER_CONFIG.packageId.length > 0;
  const notes = portfolioQuery.data ?? [];
  const noteIds = notes.map((note) => note.noteId);
  const productNoteEventIndexQuery = useProductNoteEventIndex(noteIds);

  const nowMs = Date.now();
  const openNotes = notes.filter((note) => note.status === 'open');
  const totalDeposited = openNotes.reduce((sum, note) => sum + note.principal, 0);
  const expectedRewards = openNotes.reduce((sum, note) => sum + note.coupon, 0);

  const bucketOrder: Record<PositionBucket, number> = { ready: 0, active: 1, completed: 2 };
  const sortedNotes = [...notes].sort((left, right) => {
    const weight = bucketOrder[positionBucket(left, nowMs)] - bucketOrder[positionBucket(right, nowMs)];
    if (weight !== 0) return weight;
    return left.expiryMs - right.expiryMs;
  });
  const counts: Record<PositionFilter, number> = {
    all: notes.length,
    ready: notes.filter((note) => positionBucket(note, nowMs) === 'ready').length,
    active: notes.filter((note) => positionBucket(note, nowMs) === 'active').length,
    completed: notes.filter((note) => positionBucket(note, nowMs) === 'completed').length,
  };
  const nonEmptyBuckets = (['ready', 'active', 'completed'] as const).filter((key) => counts[key] > 0).length;
  const showFilters = nonEmptyBuckets >= 2;
  const activeFilter = showFilters ? filter : 'all';
  const visibleNotes =
    activeFilter === 'all' ? sortedNotes : sortedNotes.filter((note) => positionBucket(note, nowMs) === activeFilter);

  return (
    <main className="dual-page" id="wallet-dashboard">
      <AppHeader activeProduct="dashboard" />

      <section className="dual-hero calculation-hero">
        <div>
          <h1>Dashboard</h1>
          <p>See your positions, what they&apos;ll pay, and claim your cash once they settle.</p>
        </div>
        <button className="primary-action" type="button" onClick={() => void portfolioQuery.refetch()} disabled={!account}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </section>

      {account && contractConfigured && openNotes.length > 0 ? (
        <section className="calculation-section">
          <div className="di-portfolio">
            <div>
              <span>Total deposited</span>
              <strong>{formatAmount(totalDeposited)} dUSDC</strong>
            </div>
            <div>
              <span>Expected rewards</span>
              <strong>
                +{formatPreciseAmount(expectedRewards)} <em>dUSDC</em>
              </strong>
            </div>
            <div>
              <span>Open positions</span>
              <strong>{openNotes.length}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {!account ? (
        <section className="calculation-section">
          <div className="detail-panel empty-preview">Connect your wallet to see your positions.</div>
        </section>
      ) : !contractConfigured ? (
        <section className="calculation-section">
          <div className="detail-panel error-panel">
            Anker contract package is not configured. Set NEXT_PUBLIC_ANKER_PACKAGE_ID after publishing the Move package.
          </div>
        </section>
      ) : portfolioQuery.isPending ? (
        <section className="calculation-section">
          <div className="detail-panel empty-preview">Loading your positions…</div>
        </section>
      ) : portfolioQuery.error ? (
        <section className="calculation-section">
          <div className="detail-panel error-panel">
            {portfolioQuery.error instanceof Error ? portfolioQuery.error.message : 'Unable to load your positions.'}
          </div>
        </section>
      ) : notes.length === 0 ? (
        <section className="calculation-section">
          <div className="detail-panel empty-preview">
            No positions yet for {shortId(account.address)}. Open a Buy Low position to get started.
          </div>
        </section>
      ) : (
        <section className="calculation-section">
          <div className="section-heading di-positions-heading">
            <h2>Your positions</h2>
            <span className="quote-badge live">
              {notes.length} {notes.length === 1 ? 'position' : 'positions'}
            </span>
          </div>
          {showFilters ? (
            <div className="di-position-filters" role="tablist" aria-label="Filter positions by status">
              {FILTER_TABS.filter((tab) => tab.key === 'all' || counts[tab.key] > 0).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === tab.key}
                  className={activeFilter === tab.key ? 'di-filter is-active' : 'di-filter'}
                  onClick={() => setFilter(tab.key)}
                >
                  {tab.label}
                  <em>{counts[tab.key]}</em>
                </button>
              ))}
            </div>
          ) : null}
          {visibleNotes.length === 0 ? (
            <div className="detail-panel empty-preview">No positions in this view.</div>
          ) : (
            <div className="detail-grid notes-grid">
              {visibleNotes.map((note) => (
                <ProductNoteCard
                  note={note}
                  managerValidation={managerValidationForNote(note, managersQuery.data)}
                  notes={notes}
                  eventIndexEntry={productNoteEventIndexQuery.data?.byNoteId[note.noteId]}
                  key={note.noteId}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
