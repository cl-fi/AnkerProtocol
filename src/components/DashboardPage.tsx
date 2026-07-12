'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useAnkerPortfolio } from '../hooks/useAnkerPortfolio';
import { useProductNoteMarketStates } from '../hooks/useProductNoteMarketStates';
import { useProductNoteEventIndex } from '../hooks/useProductNoteEventIndex';
import type { PredictMarketState } from '../deepbook/predictMarketState';
import { copyForLocale, DEFAULT_LOCALE, type Locale } from '../i18n';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import { DEFAULT_ANKER_CONFIG } from '../sui/ankerTransactions';
import { lifecycleForProductNote } from '../sui/productNoteLifecycle';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';
import { formatAmount, formatPreciseAmount, shortId } from './DashboardFormat';
import { ProductNoteCard } from './DashboardProductNoteCard';
import { Badge, Button, Card } from '../ui';

type NoteFilter = 'all' | 'ready' | 'active' | 'completed';
type NoteBucket = Exclude<NoteFilter, 'all'>;

const FILTER_TABS: { key: NoteFilter }[] = [{ key: 'all' }, { key: 'ready' }, { key: 'active' }, { key: 'completed' }];

// Dashboard filter bucket derived from each Note plus its Expiry Market settlement state.
function noteBucket(
  note: Pick<AnkerProductNoteRecord, 'status' | 'oracleId' | 'expiryMs'>,
  marketState: PredictMarketState | undefined,
  nowMs: number,
): NoteBucket {
  const lifecycle = lifecycleForProductNote(note, marketState, nowMs);
  if (lifecycle === 'claimed') return 'completed';
  if (lifecycle === 'claimable') return 'ready';
  return 'active';
}

export { ClaimActionView, claimActionViewModel, claimEstimateForNote } from './DashboardClaimAction';
export {
  AllocatedPositionsValue,
  IndexedTransactionDigestValue,
  OracleLastUpdateValue,
  SettlementRangeValue,
  SubscriptionDigestValue,
  depositedCashText,
  noteStatusBadge,
} from './DashboardProductNoteCard';

export function DashboardPage({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const copy = copyForLocale(locale);
  const account = useCurrentAccount();
  const portfolioQuery = useAnkerPortfolio();
  const [filter, setFilter] = useState<NoteFilter>('all');
  const contractConfigured = DEFAULT_ANKER_CONFIG.packageId !== '0x0' && DEFAULT_ANKER_CONFIG.packageId.length > 0;
  const notes = portfolioQuery.data ?? [];
  const marketStates = useProductNoteMarketStates(notes);
  const marketStateFor = (note: AnkerProductNoteRecord) => marketStates.byMarketId[note.oracleId.toLowerCase()];
  const noteIds = notes.map((note) => note.noteId);
  const productNoteEventIndexQuery = useProductNoteEventIndex(noteIds);

  const nowMs = Date.now();
  const openNotes = notes.filter((note) => note.status === 'open');
  const totalDeposited = openNotes.reduce((sum, note) => sum + note.principal, 0);
  const expectedRewards = openNotes.reduce((sum, note) => sum + note.coupon, 0);

  const bucketOrder: Record<NoteBucket, number> = { ready: 0, active: 1, completed: 2 };
  const sortedNotes = [...notes].sort((left, right) => {
    const weight =
      bucketOrder[noteBucket(left, marketStateFor(left), nowMs)] -
      bucketOrder[noteBucket(right, marketStateFor(right), nowMs)];
    if (weight !== 0) return weight;
    return left.expiryMs - right.expiryMs;
  });
  const counts: Record<NoteFilter, number> = {
    all: notes.length,
    ready: notes.filter((note) => noteBucket(note, marketStateFor(note), nowMs) === 'ready').length,
    active: notes.filter((note) => noteBucket(note, marketStateFor(note), nowMs) === 'active').length,
    completed: notes.filter((note) => noteBucket(note, marketStateFor(note), nowMs) === 'completed').length,
  };
  const nonEmptyBuckets = (['ready', 'active', 'completed'] as const).filter((key) => counts[key] > 0).length;
  const showFilters = nonEmptyBuckets >= 2;
  const activeFilter = showFilters ? filter : 'all';
  const visibleNotes =
    activeFilter === 'all'
      ? sortedNotes
      : sortedNotes.filter((note) => noteBucket(note, marketStateFor(note), nowMs) === activeFilter);

  return (
    <main className="dual-page" id="wallet-dashboard">
      <AppHeader activeProduct="dashboard" locale={locale} />

      <section className="dual-hero calculation-hero">
        <div>
          <h1>{copy.dashboard.title}</h1>
          <p>{copy.dashboard.subtitle}</p>
        </div>
        <Button variant="primary" onClick={() => void portfolioQuery.refetch()} disabled={!account}>
          <RefreshCw size={16} />
          {copy.dashboard.refresh}
        </Button>
      </section>

      {account && contractConfigured && openNotes.length > 0 ? (
        <section className="calculation-section">
          <div className="di-portfolio">
            <div>
              <span>{copy.dashboard.totalDeposited}</span>
              <strong>{formatAmount(totalDeposited, locale)} dUSDC</strong>
            </div>
            <div>
              <span>{copy.dashboard.expectedRewards}</span>
              <strong>
                +{formatPreciseAmount(expectedRewards, locale)} <em>dUSDC</em>
              </strong>
            </div>
            <div>
              <span>{copy.dashboard.openNotes}</span>
              <strong>{openNotes.length}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {!account ? (
        <section className="calculation-section">
          <Card variant="empty">{copy.dashboard.connectWallet}</Card>
        </section>
      ) : null}

      {!account ? null : !contractConfigured ? (
        <section className="calculation-section">
          <Card variant="error">{copy.dashboard.contractNotConfigured}</Card>
        </section>
      ) : portfolioQuery.isPending ? (
        <section className="calculation-section">
          <Card variant="empty">{copy.dashboard.loadingNotes}</Card>
        </section>
      ) : portfolioQuery.error ? (
        <section className="calculation-section">
          <Card variant="error">
            {portfolioQuery.error instanceof Error ? portfolioQuery.error.message : copy.dashboard.unableToLoadNotes}
          </Card>
        </section>
      ) : notes.length === 0 ? (
        <section className="calculation-section">
          <Card variant="empty">
            {copy.dashboard.noNotes(shortId(account.address))}
          </Card>
        </section>
      ) : (
        <section className="calculation-section">
          <div className="section-heading di-positions-heading">
            <h2>{copy.dashboard.yourNotes}</h2>
            <Badge tone="positive">
              {notes.length} {notes.length === 1 ? copy.dashboard.note : copy.dashboard.notes}
            </Badge>
          </div>
          {showFilters ? (
            <div className="di-position-filters" role="tablist" aria-label={copy.dashboard.filterLabel}>
              {FILTER_TABS.filter((tab) => tab.key === 'all' || counts[tab.key] > 0).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === tab.key}
                  className={activeFilter === tab.key ? 'di-filter is-active' : 'di-filter'}
                  onClick={() => setFilter(tab.key)}
                >
                  {copy.dashboard.filters[tab.key]}
                  <em>{counts[tab.key]}</em>
                </button>
              ))}
            </div>
          ) : null}
          {visibleNotes.length === 0 ? (
            <Card variant="empty">{copy.dashboard.noNotesInView}</Card>
          ) : (
            <div className="detail-grid notes-grid">
              {visibleNotes.map((note) => (
                <ProductNoteCard
                  note={note}
                  marketState={marketStateFor(note)}
                  eventIndexEntry={productNoteEventIndexQuery.data?.byNoteId[note.noteId]}
                  locale={locale}
                  key={note.noteId}
                />
              ))}
            </div>
          )}
        </section>
      )}
      <AppFooter locale={locale} />
    </main>
  );
}
