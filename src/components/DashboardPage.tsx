'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { RefreshCw, ShieldCheck, WalletCards } from 'lucide-react';
import { useAnkerPortfolio } from '../hooks/useAnkerPortfolio';
import { usePredictManagers } from '../hooks/usePredictManagers';
import { useProductNoteEventIndex } from '../hooks/useProductNoteEventIndex';
import { DEFAULT_ANKER_CONFIG } from '../sui/ankerTransactions';
import { AppHeader } from './AppHeader';
import { shortId } from './DashboardFormat';
import { ProductNoteCard, managerValidationForNote } from './DashboardProductNoteCard';

export { ClaimActionView, claimActionViewModel, redeemEstimateForNote } from './DashboardClaimAction';
export {
  AllocatedPositionsValue,
  DepositedCashValue,
  IndexedTransactionDigestValue,
  OracleLastUpdateValue,
  SettlementRangeValue,
  SubscriptionDigestValue,
  managerValidationForNote,
} from './DashboardProductNoteCard';

export function DashboardPage() {
  const account = useCurrentAccount();
  const portfolioQuery = useAnkerPortfolio();
  const managersQuery = usePredictManagers();
  const contractConfigured = DEFAULT_ANKER_CONFIG.packageId !== '0x0' && DEFAULT_ANKER_CONFIG.packageId.length > 0;
  const noteIds = (portfolioQuery.data ?? []).map((note) => note.noteId);
  const productNoteEventIndexQuery = useProductNoteEventIndex(noteIds);

  return (
    <main className="dual-page" id="wallet-dashboard">
      <AppHeader activeProduct="dashboard" />

      <section className="dual-hero calculation-hero">
        <div>
          <span className="section-kicker">Wallet Position Layer</span>
          <h1>Wallet Dashboard</h1>
          <p>
            Track Anker product notes, linked Predict managers, product status, and the DUSDC claim path from one wallet
            view.
          </p>
        </div>
        <button className="primary-action" type="button" onClick={() => void portfolioQuery.refetch()} disabled={!account}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </section>

      <div className="transparency-note calculation-note">
        <WalletCards size={18} />
        <span>Product notes are owned objects created by the Anker Protocol contract.</span>
        <ShieldCheck size={18} />
      </div>

      {!account ? (
        <section className="calculation-section">
          <div className="detail-panel empty-preview">Connect your wallet to view Anker product notes.</div>
        </section>
      ) : !contractConfigured ? (
        <section className="calculation-section">
          <div className="detail-panel error-panel">
            Anker contract package is not configured. Set NEXT_PUBLIC_ANKER_PACKAGE_ID after publishing the Move package.
          </div>
        </section>
      ) : portfolioQuery.isPending ? (
        <section className="calculation-section">
          <div className="detail-panel empty-preview">Loading product notes from your wallet...</div>
        </section>
      ) : portfolioQuery.error ? (
        <section className="calculation-section">
          <div className="detail-panel error-panel">
            {portfolioQuery.error instanceof Error ? portfolioQuery.error.message : 'Unable to load product notes.'}
          </div>
        </section>
      ) : (portfolioQuery.data ?? []).length === 0 ? (
        <section className="calculation-section">
          <div className="detail-panel empty-preview">No Anker product notes found for {shortId(account.address)}.</div>
        </section>
      ) : (
        <section className="calculation-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Owned Product Notes</span>
              <h2>Open and Claimed Positions</h2>
            </div>
            <span className="quote-badge live">{portfolioQuery.data?.length ?? 0} Notes</span>
          </div>
          <div className="detail-grid notes-grid">
            {(portfolioQuery.data ?? []).map((note) => (
              <ProductNoteCard
                note={note}
                managerValidation={managerValidationForNote(note, managersQuery.data)}
                notes={portfolioQuery.data ?? []}
                eventIndexEntry={productNoteEventIndexQuery.data?.byNoteId[note.noteId]}
                key={note.noteId}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
