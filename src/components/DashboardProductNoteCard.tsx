'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { settlementNoteForProductNote } from '../application/settleProductNote';
import { fetchOracleMarket } from '../deepbook/predictServer';
import type { PredictManagerSummary } from '../deepbook/predictManagers';
import { usePredictManagerState } from '../hooks/usePredictManagerState';
import { netAprAfterCouponFee } from '../products/feePolicy';
import { settlementPayoutRange } from '../products/settlement';
import { formatTimeToExpiry } from '../products/timeFormat';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import type { ProductNoteEventIndexEntry } from '../sui/productNoteEvents';
import {
  backingProofForDualInvestmentNote,
  claimStateForDualInvestmentNote,
  lifecycleForProductNote,
  type ProductNoteLifecycle,
} from '../sui/predictManagerState';
import { subscriptionDigestForQuote } from '../sui/subscriptionDigestStore';
import { ClaimAction } from './DashboardClaimAction';
import {
  formatAmount,
  formatApr,
  formatExpiry,
  formatOracleTimestamp,
  formatPercent,
  formatPreciseAmount,
  formatPrice,
  formatQuoteBaseUnits,
  shortId,
  suiExplorerObjectUrl,
  suiExplorerTxUrl,
} from './DashboardFormat';

function ProofLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="di-proof-link" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export function managerValidationForNote(
  note: AnkerProductNoteRecord,
  managers: Pick<PredictManagerSummary, 'managerId'>[] | undefined,
) {
  if (!managers) return { label: 'Checking manager', tone: 'neutral' as const };
  const verified = managers.some((manager) => manager.managerId.toLowerCase() === note.managerId.toLowerCase());
  return verified
    ? { label: 'Manager verified', tone: 'good' as const }
    : { label: 'Manager not found', tone: 'warn' as const };
}

type PositionStatusTone = 'active' | 'ready' | 'attention' | 'done';

export function positionStatusBadge(
  note: Pick<AnkerProductNoteRecord, 'status'>,
  lifecycle: ProductNoteLifecycle,
): { label: string; tone: PositionStatusTone } {
  if (note.status === 'redeemed' || lifecycle === 'settled') return { label: 'Completed', tone: 'done' };
  if (lifecycle === 'settlement-blocked') return { label: 'Action needed', tone: 'attention' };
  if (lifecycle === 'positions-redeemable' || lifecycle === 'claimable') return { label: 'Ready to claim', tone: 'ready' };
  if (lifecycle === 'matured') return { label: 'Settling', tone: 'ready' };
  return { label: 'Active', tone: 'active' };
}

function managerIsolationLabel(input: 'isolated' | 'shared' | 'unknown', notesUsingManager: number | null) {
  if (input === 'unknown') return 'Checking';
  if (input === 'isolated') return 'Isolated';
  return `Shared by ${notesUsingManager ?? 0} notes`;
}

function useSubscriptionDigest(owner: string, quoteHash: string) {
  const [digest, setDigest] = useState<string | null>(null);
  useEffect(() => {
    setDigest(subscriptionDigestForQuote({ owner, quoteHash }));
  }, [owner, quoteHash]);
  return digest;
}

export function SubscriptionDigestValue({
  owner,
  quoteHash,
  eventDigest,
}: {
  owner: string;
  quoteHash: string;
  eventDigest?: string;
}) {
  const localDigest = useSubscriptionDigest(owner, quoteHash);
  const digest = eventDigest || localDigest;
  return <dd>{digest ? <ProofLink href={suiExplorerTxUrl(digest)}>{shortId(digest)}</ProofLink> : 'Not indexed'}</dd>;
}

export function IndexedTransactionDigestValue({ digest }: { digest?: string }) {
  return <dd>{digest ? <ProofLink href={suiExplorerTxUrl(digest)}>{shortId(digest)}</ProofLink> : 'Not indexed'}</dd>;
}

export function AllocatedPositionsValue({ entry }: { entry?: ProductNoteEventIndexEntry }) {
  if (!entry) return <dd>Not indexed</dd>;

  const quantityBaseUnits = entry.allocatedPositions.reduce((sum, position) => sum + position.quantityBaseUnits, 0n);
  const costBaseUnits = entry.allocatedPositions.reduce((sum, position) => sum + position.costBaseUnits, 0n);

  return (
    <dd>
      {entry.allocatedPositions.length} indexed / {formatQuoteBaseUnits(quantityBaseUnits)} dUSDC qty /{' '}
      {formatQuoteBaseUnits(costBaseUnits)} dUSDC cost
    </dd>
  );
}

export function depositedCashText(
  note: Pick<AnkerProductNoteRecord, 'principalBaseUnits'>,
  entry?: ProductNoteEventIndexEntry,
) {
  return formatQuoteBaseUnits(entry?.principalBaseUnits ?? note.principalBaseUnits);
}

export function OracleLastUpdateValue({ oracleId }: { oracleId: string }) {
  const oracleQuery = useQuery({
    queryKey: ['oracle-last-update', oracleId],
    queryFn: () => fetchOracleMarket(oracleId, { serverLagSeconds: 0 }),
    enabled: Boolean(oracleId),
    retry: 1,
    refetchInterval: 60_000,
  });

  if (oracleQuery.isPending) return <dd>Checking</dd>;
  if (oracleQuery.error || !oracleQuery.data) return <dd>Unavailable</dd>;

  return <dd>{formatOracleTimestamp(Math.max(oracleQuery.data.spotTimestampMs, oracleQuery.data.sviTimestampMs))}</dd>;
}

export function SettlementRangeValue({ note }: { note: AnkerProductNoteRecord }) {
  const range = settlementPayoutRange(settlementNoteForProductNote(note));
  return (
    <dd>
      {formatQuoteBaseUnits(range.minGrossPayoutBaseUnits)} - {formatQuoteBaseUnits(range.maxGrossPayoutBaseUnits)}{' '}
      dUSDC
    </dd>
  );
}

export function ProductNoteCard({
  note,
  managerValidation,
  notes,
  eventIndexEntry,
}: {
  note: AnkerProductNoteRecord;
  managerValidation: ReturnType<typeof managerValidationForNote>;
  notes: readonly AnkerProductNoteRecord[];
  eventIndexEntry?: ProductNoteEventIndexEntry;
}) {
  const isDual = note.productType === 'dual-investment';
  const managerStateQuery = usePredictManagerState(note.managerId);
  const claimState = claimStateForDualInvestmentNote(note, managerStateQuery.data);
  const lifecycle = lifecycleForProductNote(note, claimState, Date.now());
  const backingProof = backingProofForDualInvestmentNote(note, managerStateQuery.data, notes);
  const status = positionStatusBadge(note, lifecycle);
  const rewardApr = netAprAfterCouponFee(note.apr, note.feeBps);
  const settlesText =
    lifecycle === 'active' ? `in ${formatTimeToExpiry(note.expiryMs, Date.now())}` : formatExpiry(note.expiryMs);
  const containerBalance = managerStateQuery.isPending
    ? 'Checking'
    : managerStateQuery.data?.dusdcBalance !== null && managerStateQuery.data?.dusdcBalance !== undefined
      ? `${formatPreciseAmount(managerStateQuery.data.dusdcBalance)} dUSDC`
      : 'Unavailable';

  return (
    <article className="detail-panel di-position-card">
      <header className="di-position-head">
        <div className="di-position-title">
          <h3>{isDual ? 'Buy Low BTC' : 'Legacy product'}</h3>
          {isDual ? <span className="di-position-strike">@ {formatPrice(note.targetPrice)}</span> : null}
        </div>
        <span className={`di-status-pill is-${status.tone}`}>{status.label}</span>
      </header>

      <div className="di-position-stats">
        <div>
          <span>Deposit</span>
          <strong>{depositedCashText(note, eventIndexEntry)} dUSDC</strong>
        </div>
        <div>
          <span>Reward</span>
          <strong>
            +{formatPreciseAmount(note.coupon)} dUSDC<em>{formatApr(rewardApr)} APR</em>
          </strong>
        </div>
        <div>
          <span>Settles</span>
          <strong>{settlesText}</strong>
        </div>
      </div>

      {isDual ? (
        <div className="di-position-outcome">
          <ShieldCheck size={16} />
          <span className="di-position-outcome-text">
            <span className="di-position-outcome-main">
              If BTC is at or above {formatPrice(note.targetPrice)} when it settles, you keep your deposit plus the
              reward. If it ends lower, your deposit buys BTC at {formatPrice(note.targetPrice)} — the price you chose.
            </span>
            <small>
              On testnet this settles in dUSDC, not BTC — you may receive slightly less cash if BTC ends below your
              price. On mainnet, positions settle in real wrapped BTC.
            </small>
          </span>
        </div>
      ) : null}

      <ClaimAction note={note} claimState={claimState} />

      <details className="di-position-proof">
        <summary>
          <span>On-chain proof</span>
          <ChevronDown size={18} />
        </summary>
        <div className="oracle-meta">
          <div>
            <span>Position ID</span>
            <dd>
              <ProofLink href={suiExplorerObjectUrl(note.noteId)}>{shortId(note.noteId)}</ProofLink>
            </dd>
          </div>
          <div>
            <span>{isDual ? 'Quote hash' : 'Product ID'}</span>
            <dd>{note.productId || '--'}</dd>
          </div>
          {isDual ? (
            <div>
              <span>Subscription tx</span>
              <SubscriptionDigestValue
                owner={note.owner}
                quoteHash={note.productId}
                eventDigest={eventIndexEntry?.subscriptionDigest}
              />
            </div>
          ) : null}
          {isDual ? (
            <div>
              <span>Redeem tx</span>
              <IndexedTransactionDigestValue digest={eventIndexEntry?.positionsRedeemedDigest} />
            </div>
          ) : null}
          {isDual ? (
            <div>
              <span>Settlement tx</span>
              <IndexedTransactionDigestValue digest={eventIndexEntry?.settlementDigest} />
            </div>
          ) : null}
          <div>
            <span>Product container</span>
            <dd>
              <ProofLink href={suiExplorerObjectUrl(note.managerId)}>{shortId(note.managerId)}</ProofLink>
            </dd>
          </div>
          <div>
            <span>Container check</span>
            <dd className={`validation-${managerValidation.tone}`}>{managerValidation.label}</dd>
          </div>
          <div>
            <span>Container isolation</span>
            <dd>{managerIsolationLabel(backingProof.managerIsolation, backingProof.notesUsingManager)}</dd>
          </div>
          <div>
            <span>Container balance</span>
            <dd>{containerBalance}</dd>
          </div>
          <div>
            <span>Oracle</span>
            <dd>
              <ProofLink href={suiExplorerObjectUrl(note.oracleId)}>{shortId(note.oracleId)}</ProofLink>
            </dd>
          </div>
          {isDual ? (
            <div>
              <span>Price feed updated</span>
              <OracleLastUpdateValue oracleId={note.oracleId} />
            </div>
          ) : null}
          {isDual ? (
            <>
              <div>
                <span>Your price</span>
                <dd>{formatPrice(note.targetPrice)}</dd>
              </div>
              <div>
                <span>Floor</span>
                <dd>{formatPrice(note.floorPrice)}</dd>
              </div>
              <div>
                <span>Reward</span>
                <dd>{formatAmount(note.coupon)} dUSDC</dd>
              </div>
              <div>
                <span>Settlement</span>
                <dd>Cash-settled dUSDC</dd>
              </div>
              <div>
                <span>Payout range</span>
                <SettlementRangeValue note={note} />
              </div>
              <div>
                <span>Positions held</span>
                <dd>
                  {claimState.path === 'unknown'
                    ? 'Checking'
                    : `${claimState.availableLegCount}/${claimState.totalLegCount} held`}
                </dd>
              </div>
              <div>
                <span>Backing ratio</span>
                <dd>{formatPercent(backingProof.collateralizationRatio)}</dd>
              </div>
              <div>
                <span>Required positions</span>
                <dd>{formatPreciseAmount(backingProof.requiredPositionQuantity)} dUSDC</dd>
              </div>
              <div>
                <span>Allocated positions</span>
                <AllocatedPositionsValue entry={eventIndexEntry} />
              </div>
              <div>
                <span>Current positions</span>
                <dd>{formatPreciseAmount(backingProof.availablePositionQuantity)} dUSDC</dd>
              </div>
              <div>
                <span>Legs</span>
                <dd>{note.legs.length}</dd>
              </div>
            </>
          ) : null}
        </div>
      </details>
    </article>
  );
}
