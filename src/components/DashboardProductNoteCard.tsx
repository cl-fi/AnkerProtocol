'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { settlementNoteForProductNote } from '../application/settleProductNote';
import { fetchOracleMarket } from '../deepbook/predictServer';
import type { PredictManagerSummary } from '../deepbook/predictManagers';
import { usePredictManagerState } from '../hooks/usePredictManagerState';
import { settlementPayoutRange } from '../products/settlement';
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
} from './DashboardFormat';

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

function lifecycleLabel(lifecycle: ProductNoteLifecycle) {
  if (lifecycle === 'active') return 'Active';
  if (lifecycle === 'matured') return 'Matured';
  if (lifecycle === 'positions-redeemable') return 'Redeem positions';
  if (lifecycle === 'claimable') return 'Claimable';
  if (lifecycle === 'settlement-blocked') return 'Blocked';
  if (lifecycle === 'settled') return 'Settled';
  return 'Unsupported';
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
  return <dd>{digest ? shortId(digest) : 'Not indexed'}</dd>;
}

export function IndexedTransactionDigestValue({ digest }: { digest?: string }) {
  return <dd>{digest ? shortId(digest) : 'Not indexed'}</dd>;
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

export function DepositedCashValue({
  note,
  entry,
}: {
  note: Pick<AnkerProductNoteRecord, 'principalBaseUnits'>;
  entry?: ProductNoteEventIndexEntry;
}) {
  return <dd>{formatQuoteBaseUnits(entry?.principalBaseUnits ?? note.principalBaseUnits)} dUSDC</dd>;
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

  return (
    <article className="detail-panel">
      <div className="detail-title">
        <h3>{isDual ? 'Target Buy BTC' : 'Legacy Product'}</h3>
        <span>{note.status === 'redeemed' ? 'Claimed' : 'Open'} product note</span>
      </div>
      <div className="quote-summary compact-summary">
        <div>
          <span>Principal</span>
          <strong>{formatAmount(note.principal)} dUSDC</strong>
        </div>
        <div>
          <span>APR</span>
          <strong>{formatApr(note.apr)}</strong>
        </div>
        <div>
          <span>Expiry</span>
          <strong>{formatExpiry(note.expiryMs)}</strong>
        </div>
        <div>
          <span>Legs</span>
          <strong>{note.legs.length}</strong>
        </div>
      </div>
      <div className="oracle-meta">
        <div>
          <span>Note</span>
          <dd>{shortId(note.noteId)}</dd>
        </div>
        <div>
          <span>{isDual ? 'Quote Hash' : 'Product ID'}</span>
          <dd>{note.productId || '--'}</dd>
        </div>
        {isDual ? (
          <div>
            <span>Subscription Tx</span>
            <SubscriptionDigestValue
              owner={note.owner}
              quoteHash={note.productId}
              eventDigest={eventIndexEntry?.subscriptionDigest}
            />
          </div>
        ) : null}
        {isDual ? (
          <div>
            <span>Redeem Tx</span>
            <IndexedTransactionDigestValue digest={eventIndexEntry?.positionsRedeemedDigest} />
          </div>
        ) : null}
        {isDual ? (
          <div>
            <span>Settlement Tx</span>
            <IndexedTransactionDigestValue digest={eventIndexEntry?.settlementDigest} />
          </div>
        ) : null}
        <div>
          <span>Predict Manager</span>
          <dd>{shortId(note.managerId)}</dd>
        </div>
        <div>
          <span>Manager Check</span>
          <dd className={`validation-${managerValidation.tone}`}>{managerValidation.label}</dd>
        </div>
        <div>
          <span>Lifecycle</span>
          <dd>{lifecycleLabel(lifecycle)}</dd>
        </div>
        <div>
          <span>Manager Isolation</span>
          <dd>{managerIsolationLabel(backingProof.managerIsolation, backingProof.notesUsingManager)}</dd>
        </div>
        <div>
          <span>Manager DUSDC</span>
          <dd>
            {managerStateQuery.isPending
              ? 'Checking'
              : managerStateQuery.data?.dusdcBalance !== null && managerStateQuery.data?.dusdcBalance !== undefined
                ? `${formatPreciseAmount(managerStateQuery.data.dusdcBalance)} dUSDC`
                : 'Unavailable'}
          </dd>
        </div>
        {isDual ? (
          <div>
            <span>Deposited Cash</span>
            <DepositedCashValue note={note} entry={eventIndexEntry} />
          </div>
        ) : null}
        <div>
          <span>Oracle</span>
          <dd>{shortId(note.oracleId)}</dd>
        </div>
        {isDual ? (
          <div>
            <span>Oracle Update</span>
            <OracleLastUpdateValue oracleId={note.oracleId} />
          </div>
        ) : null}
        {isDual ? (
          <>
            <div>
              <span>Target Buy</span>
              <dd>{formatPrice(note.targetPrice)}</dd>
            </div>
            <div>
              <span>Floor</span>
              <dd>{formatPrice(note.floorPrice)}</dd>
            </div>
            <div>
              <span>Coupon</span>
              <dd>{formatAmount(note.coupon)} dUSDC</dd>
            </div>
            <div>
              <span>Settlement</span>
              <dd>Cash-settled dUSDC</dd>
            </div>
            <div>
              <span>Settlement Range</span>
              <SettlementRangeValue note={note} />
            </div>
            <div>
              <span>Predict legs</span>
              <dd>
                {claimState.path === 'unknown'
                  ? 'Checking'
                  : `${claimState.availableLegCount}/${claimState.totalLegCount} held`}
              </dd>
            </div>
            <div>
              <span>Backing Ratio</span>
              <dd>{formatPercent(backingProof.collateralizationRatio)}</dd>
            </div>
            <div>
              <span>Required Positions</span>
              <dd>{formatPreciseAmount(backingProof.requiredPositionQuantity)} dUSDC</dd>
            </div>
            <div>
              <span>Allocated Positions</span>
              <AllocatedPositionsValue entry={eventIndexEntry} />
            </div>
            <div>
              <span>Current Positions</span>
              <dd>{formatPreciseAmount(backingProof.availablePositionQuantity)} dUSDC</dd>
            </div>
          </>
        ) : null}
      </div>
      <ClaimAction note={note} claimState={claimState} />
    </article>
  );
}
