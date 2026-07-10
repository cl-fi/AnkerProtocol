'use client';

import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { settlementNoteForProductNote } from '../application/settleProductNote';
import { fetchOracleMarket } from '../deepbook/predictServer';
import { usePredictManagerState } from '../hooks/usePredictManagerState';
import { copyForLocale, DEFAULT_LOCALE, formatTimeToExpiry, type Locale } from '../i18n';
import { netAprAfterCouponFee } from '../products/feePolicy';
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
  managers: Array<{ managerId: string }> | undefined,
  locale: Locale = DEFAULT_LOCALE,
) {
  const copy = copyForLocale(locale);
  if (!managers) return { label: copy.dashboard.manager.checking, tone: 'neutral' as const };
  const verified = managers.some((manager) => manager.managerId.toLowerCase() === note.wrapperId.toLowerCase());
  return verified
    ? { label: copy.dashboard.manager.verified, tone: 'good' as const }
    : { label: copy.dashboard.manager.notFound, tone: 'warn' as const };
}

export function positionStatusBadge(
  note: Pick<AnkerProductNoteRecord, 'status'>,
  lifecycle: ProductNoteLifecycle,
  locale: Locale = DEFAULT_LOCALE,
): { label: string; tone: Tone } {
  const copy = copyForLocale(locale);
  if (note.status === 'redeemed' || lifecycle === 'settled')
    return { label: copy.dashboard.status.completed, tone: 'neutral' };
  if (lifecycle === 'settlement-blocked') return { label: copy.dashboard.status.actionNeeded, tone: 'danger' };
  if (lifecycle === 'positions-redeemable' || lifecycle === 'claimable')
    return { label: copy.dashboard.status.readyToClaim, tone: 'positive' };
  if (lifecycle === 'matured') return { label: copy.dashboard.status.settling, tone: 'positive' };
  return { label: copy.dashboard.status.active, tone: 'warning' };
}

function managerIsolationLabel(
  input: 'isolated' | 'shared' | 'unknown',
  notesUsingManager: number | null,
  locale: Locale,
) {
  const copy = copyForLocale(locale);
  if (input === 'unknown') return copy.common.checking;
  if (input === 'isolated') return copy.dashboard.card.isolated;
  return copy.dashboard.card.sharedBy(notesUsingManager ?? 0);
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
  locale = DEFAULT_LOCALE,
}: {
  owner: string;
  quoteHash: string;
  eventDigest?: string;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  const localDigest = useSubscriptionDigest(owner, quoteHash);
  const digest = eventDigest || localDigest;
  return (
    <dd>{digest ? <ProofLink href={suiExplorerTxUrl(digest)}>{shortId(digest)}</ProofLink> : copy.common.notIndexed}</dd>
  );
}

export function IndexedTransactionDigestValue({
  digest,
  locale = DEFAULT_LOCALE,
}: {
  digest?: string;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  return (
    <dd>{digest ? <ProofLink href={suiExplorerTxUrl(digest)}>{shortId(digest)}</ProofLink> : copy.common.notIndexed}</dd>
  );
}

export function AllocatedPositionsValue({
  entry,
  locale = DEFAULT_LOCALE,
}: {
  entry?: ProductNoteEventIndexEntry;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  if (!entry) return <dd>{copy.common.notIndexed}</dd>;

  const quantityBaseUnits = entry.allocatedPositions.reduce((sum, position) => sum + position.quantityBaseUnits, 0n);
  const costBaseUnits = entry.allocatedPositions.reduce((sum, position) => sum + position.costBaseUnits, 0n);

  return (
    <dd>
      {copy.dashboard.card.indexedAllocated(
        entry.allocatedPositions.length,
        formatQuoteBaseUnits(quantityBaseUnits),
        formatQuoteBaseUnits(costBaseUnits),
      )}
    </dd>
  );
}

export function depositedCashText(
  note: Pick<AnkerProductNoteRecord, 'principalBaseUnits'>,
  entry?: ProductNoteEventIndexEntry,
) {
  return formatQuoteBaseUnits(entry?.principalBaseUnits ?? note.principalBaseUnits);
}

export function OracleLastUpdateValue({ oracleId, locale = DEFAULT_LOCALE }: { oracleId: string; locale?: Locale }) {
  const copy = copyForLocale(locale);
  const oracleQuery = useQuery({
    queryKey: ['oracle-last-update', oracleId],
    queryFn: () => fetchOracleMarket(oracleId, { serverLagSeconds: 0 }),
    enabled: Boolean(oracleId),
    retry: 1,
    refetchInterval: 60_000,
  });

  if (oracleQuery.isPending) return <dd>{copy.common.checking}</dd>;
  if (oracleQuery.error || !oracleQuery.data) return <dd>{copy.common.unavailable}</dd>;

  return (
    <dd>{formatOracleTimestamp(Math.max(oracleQuery.data.spotTimestampMs, oracleQuery.data.sviTimestampMs), locale)}</dd>
  );
}

export function SettlementRangeValue({
  note,
  locale = DEFAULT_LOCALE,
}: {
  note: AnkerProductNoteRecord;
  locale?: Locale;
}) {
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
  locale = DEFAULT_LOCALE,
}: {
  note: AnkerProductNoteRecord;
  managerValidation: ReturnType<typeof managerValidationForNote>;
  notes: readonly AnkerProductNoteRecord[];
  eventIndexEntry?: ProductNoteEventIndexEntry;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  const isDual = note.productType === 'dual-investment';
  const managerStateQuery = usePredictManagerState(note.wrapperId);
  const claimState = claimStateForDualInvestmentNote(note, managerStateQuery.data);
  const lifecycle = lifecycleForProductNote(note, claimState, Date.now());
  const backingProof = backingProofForDualInvestmentNote(note, managerStateQuery.data, notes);
  const status = positionStatusBadge(note, lifecycle, locale);
  const rewardApr = netAprAfterCouponFee(note.apr, note.feeBps);
  const localizedSettlesText =
    lifecycle === 'active'
      ? locale === 'zh-CN'
        ? formatTimeToExpiry(note.expiryMs, locale)
        : `in ${formatTimeToExpiry(note.expiryMs, locale)}`
      : formatExpiry(note.expiryMs, locale);
  const containerBalance = managerStateQuery.isPending
    ? copy.common.checking
    : managerStateQuery.data?.dusdcBalance !== null && managerStateQuery.data?.dusdcBalance !== undefined
      ? `${formatPreciseAmount(managerStateQuery.data.dusdcBalance, locale)} dUSDC`
      : copy.common.unavailable;

  return (
    <Card as="article" className="di-position-card">
      <header className="di-position-head">
        <div className="di-position-title">
          <h3>{isDual ? copy.dashboard.card.buyLowBtc : copy.dashboard.card.legacyProduct}</h3>
          {isDual ? <span className="di-position-strike">@ {formatPrice(note.targetPrice, locale)}</span> : null}
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </header>

      <StatGroup>
        <Stat label={copy.dashboard.card.deposit} value={`${depositedCashText(note, eventIndexEntry)} dUSDC`} />
        <Stat
          label={copy.dashboard.card.reward}
          value={`+${formatPreciseAmount(note.coupon, locale)} dUSDC`}
          sub={`${formatApr(rewardApr, locale)} APR`}
        />
        <Stat label={copy.dashboard.card.settles} value={localizedSettlesText} />
      </StatGroup>

      {isDual ? (
        <div className="di-position-outcome">
          <ShieldCheck size={16} />
          <span className="di-position-outcome-text">
            <span className="di-position-outcome-main">
              {copy.dashboard.card.outcomeMain(formatPrice(note.targetPrice, locale))}
            </span>
            <small>{copy.dashboard.card.outcomeTestnet}</small>
          </span>
        </div>
      ) : null}

      <ClaimAction note={note} claimState={claimState} locale={locale} />

      <Disclosure summary={copy.dashboard.card.onChainProof}>
        <KeyValueList>
          <KeyValue
            label={copy.dashboard.card.positionId}
            value={<ProofLink href={suiExplorerObjectUrl(note.noteId)}>{shortId(note.noteId)}</ProofLink>}
          />
          <KeyValue
            label={isDual ? copy.dashboard.card.quoteHash : copy.dashboard.card.productId}
            value={note.productId || '--'}
          />
          {isDual ? (
            <div>
              <span>{copy.dashboard.card.subscriptionTx}</span>
              <SubscriptionDigestValue
                owner={note.owner}
                quoteHash={note.productId}
                eventDigest={eventIndexEntry?.subscriptionDigest}
                locale={locale}
              />
            </div>
          ) : null}
          {isDual ? (
            <div>
              <span>{copy.dashboard.card.settlementTx}</span>
              <IndexedTransactionDigestValue digest={eventIndexEntry?.settlementDigest} locale={locale} />
            </div>
          ) : null}
          <KeyValue
            label={copy.dashboard.card.productContainer}
            value={<ProofLink href={suiExplorerObjectUrl(note.wrapperId)}>{shortId(note.wrapperId)}</ProofLink>}
          />
          <KeyValue
            label={copy.dashboard.card.containerCheck}
            value={managerValidation.label}
            tone={managerValidation.tone}
          />
          <KeyValue
            label={copy.dashboard.card.containerIsolation}
            value={managerIsolationLabel(backingProof.managerIsolation, backingProof.notesUsingManager, locale)}
          />
          <KeyValue label={copy.dashboard.card.containerBalance} value={containerBalance} />
          <KeyValue
            label={copy.dualInvestment.oracle}
            value={<ProofLink href={suiExplorerObjectUrl(note.oracleId)}>{shortId(note.oracleId)}</ProofLink>}
          />
          {isDual ? (
            <div>
              <span>{copy.dashboard.card.priceFeedUpdated}</span>
              <OracleLastUpdateValue oracleId={note.oracleId} locale={locale} />
            </div>
          ) : null}
          {isDual ? (
            <>
              <KeyValue label={copy.dashboard.card.yourPrice} value={formatPrice(note.targetPrice, locale)} />
              <KeyValue label={copy.dashboard.card.floor} value={formatPrice(note.floorPrice, locale)} />
              <KeyValue label={copy.dashboard.card.reward} value={`${formatAmount(note.coupon, locale)} dUSDC`} />
              <KeyValue label={copy.dashboard.card.settlement} value={copy.dashboard.card.cashSettled} />
              <div>
                <span>{copy.dashboard.card.payoutRange}</span>
                <SettlementRangeValue note={note} locale={locale} />
              </div>
              <KeyValue
                label={copy.dashboard.card.positionsHeld}
                value={
                  claimState.path === 'unknown'
                    ? copy.common.checking
                    : copy.dashboard.card.held(claimState.availableLegCount, claimState.totalLegCount)
                }
              />
              <KeyValue
                label={copy.dashboard.card.backingRatio}
                value={formatPercent(backingProof.collateralizationRatio, locale, copy.common.checking)}
              />
              <KeyValue
                label={copy.dashboard.card.requiredPositions}
                value={`${formatPreciseAmount(backingProof.requiredPositionQuantity, locale)} dUSDC`}
              />
              <div>
                <span>{copy.dashboard.card.allocatedPositions}</span>
                <AllocatedPositionsValue entry={eventIndexEntry} locale={locale} />
              </div>
              <KeyValue
                label={copy.dashboard.card.currentPositions}
                value={`${formatPreciseAmount(backingProof.availablePositionQuantity, locale)} dUSDC`}
              />
              <KeyValue label={copy.dashboard.card.legs} value={note.legs.length} />
            </>
          ) : null}
        </KeyValueList>
      </Disclosure>
    </Card>
  );
}
