'use client';

import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
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
import { Badge, Card, Disclosure, KeyValue, KeyValueList, Stat, StatGroup, type Tone } from '../ui';

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

export function positionStatusBadge(
  note: Pick<AnkerProductNoteRecord, 'status'>,
  lifecycle: ProductNoteLifecycle,
): { label: string; tone: Tone } {
  if (note.status === 'redeemed' || lifecycle === 'settled') return { label: 'Completed', tone: 'neutral' };
  if (lifecycle === 'settlement-blocked') return { label: 'Action needed', tone: 'danger' };
  if (lifecycle === 'positions-redeemable' || lifecycle === 'claimable') return { label: 'Ready to claim', tone: 'positive' };
  if (lifecycle === 'matured') return { label: 'Settling', tone: 'positive' };
  return { label: 'Active', tone: 'warning' };
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
    <Card as="article" className="di-position-card">
      <header className="di-position-head">
        <div className="di-position-title">
          <h3>{isDual ? 'Buy Low BTC' : 'Legacy product'}</h3>
          {isDual ? <span className="di-position-strike">@ {formatPrice(note.targetPrice)}</span> : null}
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </header>

      <StatGroup>
        <Stat label="Deposit" value={`${depositedCashText(note, eventIndexEntry)} dUSDC`} />
        <Stat
          label="Reward"
          value={`+${formatPreciseAmount(note.coupon)} dUSDC`}
          sub={`${formatApr(rewardApr)} APR`}
        />
        <Stat label="Settles" value={settlesText} />
      </StatGroup>

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

      <Disclosure summary="On-chain proof">
        <KeyValueList>
          <KeyValue
            label="Position ID"
            value={<ProofLink href={suiExplorerObjectUrl(note.noteId)}>{shortId(note.noteId)}</ProofLink>}
          />
          <KeyValue label={isDual ? 'Quote hash' : 'Product ID'} value={note.productId || '--'} />
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
          <KeyValue
            label="Product container"
            value={<ProofLink href={suiExplorerObjectUrl(note.managerId)}>{shortId(note.managerId)}</ProofLink>}
          />
          <KeyValue label="Container check" value={managerValidation.label} tone={managerValidation.tone} />
          <KeyValue
            label="Container isolation"
            value={managerIsolationLabel(backingProof.managerIsolation, backingProof.notesUsingManager)}
          />
          <KeyValue label="Container balance" value={containerBalance} />
          <KeyValue
            label="Oracle"
            value={<ProofLink href={suiExplorerObjectUrl(note.oracleId)}>{shortId(note.oracleId)}</ProofLink>}
          />
          {isDual ? (
            <div>
              <span>Price feed updated</span>
              <OracleLastUpdateValue oracleId={note.oracleId} />
            </div>
          ) : null}
          {isDual ? (
            <>
              <KeyValue label="Your price" value={formatPrice(note.targetPrice)} />
              <KeyValue label="Floor" value={formatPrice(note.floorPrice)} />
              <KeyValue label="Reward" value={`${formatAmount(note.coupon)} dUSDC`} />
              <KeyValue label="Settlement" value="Cash-settled dUSDC" />
              <div>
                <span>Payout range</span>
                <SettlementRangeValue note={note} />
              </div>
              <KeyValue
                label="Positions held"
                value={
                  claimState.path === 'unknown'
                    ? 'Checking'
                    : `${claimState.availableLegCount}/${claimState.totalLegCount} held`
                }
              />
              <KeyValue label="Backing ratio" value={formatPercent(backingProof.collateralizationRatio)} />
              <KeyValue
                label="Required positions"
                value={`${formatPreciseAmount(backingProof.requiredPositionQuantity)} dUSDC`}
              />
              <div>
                <span>Allocated positions</span>
                <AllocatedPositionsValue entry={eventIndexEntry} />
              </div>
              <KeyValue
                label="Current positions"
                value={`${formatPreciseAmount(backingProof.availablePositionQuantity)} dUSDC`}
              />
              <KeyValue label="Legs" value={note.legs.length} />
            </>
          ) : null}
        </KeyValueList>
      </Disclosure>
    </Card>
  );
}
