'use client';

import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { settlementNoteForProductNote } from '../application/settleProductNote';
import type { PredictMarketState } from '../deepbook/predictMarketState';
import { fetchOracleMarket } from '../deepbook/predictServer';
import { useAccountWrapperBalance } from '../hooks/useAccountWrapper';
import { copyForLocale, DEFAULT_LOCALE, formatTimeToExpiry, type Locale } from '../i18n';
import { netAprAfterCouponFee } from '../products/feePolicy';
import { settlementPayoutRange } from '../products/settlement';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import type { ProductNoteEventIndexEntry } from '../sui/productNoteEvents';
import { lifecycleForProductNote, type ProductNoteLifecycle } from '../sui/productNoteLifecycle';
import { subscriptionDigestForQuote } from '../sui/subscriptionDigestStore';
import { ClaimAction, type ConfirmedClaim } from './PortfolioClaimAction';
import {
  formatAmount,
  formatApr,
  formatExpiry,
  formatOracleTimestamp,
  formatPreciseAmount,
  formatPrice,
  formatQuoteBaseUnits,
  shortId,
  suiExplorerObjectUrl,
  suiExplorerTxUrl,
} from './PortfolioFormat';
import { Badge, Card, Disclosure, KeyValue, KeyValueList, Stat, StatGroup, type Tone } from '../ui';

function ProofLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="di-proof-link" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export function noteStatusBadge(
  note: Pick<AnkerProductNoteRecord, 'status'>,
  lifecycle: ProductNoteLifecycle,
  locale: Locale = DEFAULT_LOCALE,
): { label: string; tone: Tone } {
  const copy = copyForLocale(locale);
  if (note.status === 'redeemed' || lifecycle === 'claimed')
    return { label: copy.portfolio.status.completed, tone: 'neutral' };
  if (lifecycle === 'claimable')
    return { label: copy.portfolio.status.readyToClaim, tone: 'positive' };
  if (lifecycle === 'awaiting_settle') return { label: copy.portfolio.status.settling, tone: 'positive' };
  return { label: copy.portfolio.status.active, tone: 'warning' };
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
      {copy.portfolio.card.indexedAllocated(
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
  marketState,
  eventIndexEntry,
  onClaimSuccess,
  locale = DEFAULT_LOCALE,
}: {
  note: AnkerProductNoteRecord;
  marketState?: PredictMarketState;
  eventIndexEntry?: ProductNoteEventIndexEntry;
  onClaimSuccess: (claim: ConfirmedClaim) => void;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  const isDual = note.productType === 'dual-investment';
  const wrapperBalanceQuery = useAccountWrapperBalance(note.wrapperId);
  const lifecycle = lifecycleForProductNote(note, marketState, Date.now());
  const status = noteStatusBadge(note, lifecycle, locale);
  const rewardApr = netAprAfterCouponFee(note.apr, note.feeBps);
  const localizedSettlesText =
    lifecycle === 'countdown'
      ? locale === 'zh-CN'
        ? formatTimeToExpiry(note.expiryMs, locale)
        : `in ${formatTimeToExpiry(note.expiryMs, locale)}`
      : formatExpiry(note.expiryMs, locale);
  const accountWrapperBalance = wrapperBalanceQuery.isPending
    ? copy.common.checking
    : wrapperBalanceQuery.data?.dusdcBalance !== null && wrapperBalanceQuery.data?.dusdcBalance !== undefined
      ? `${formatPreciseAmount(wrapperBalanceQuery.data.dusdcBalance, locale)} dUSDC`
      : copy.common.unavailable;

  return (
    <Card as="article" className="di-position-card">
      <header className="di-position-head">
        <div className="di-position-title">
          <h3>{isDual ? copy.portfolio.card.buyLowBtc : copy.portfolio.card.legacyProduct}</h3>
          {isDual ? <span className="di-position-strike">@ {formatPrice(note.targetPrice, locale)}</span> : null}
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </header>

      <StatGroup>
        <Stat label={copy.portfolio.card.deposit} value={`${depositedCashText(note, eventIndexEntry)} dUSDC`} />
        <Stat
          label={copy.portfolio.card.reward}
          value={`+${formatPreciseAmount(note.coupon, locale)} dUSDC`}
          sub={`${formatApr(rewardApr, locale)} APR`}
        />
        <Stat label={copy.portfolio.card.settles} value={localizedSettlesText} />
      </StatGroup>

      {isDual ? (
        <div className="di-position-outcome">
          <ShieldCheck size={16} />
          <span className="di-position-outcome-text">
            <span className="di-position-outcome-main">
              {copy.portfolio.card.outcomeMain(formatPrice(note.targetPrice, locale))}
            </span>
            <small>{copy.portfolio.card.outcomeTestnet}</small>
          </span>
        </div>
      ) : null}

      <ClaimAction note={note} marketState={marketState} onClaimSuccess={onClaimSuccess} locale={locale} />

      <Disclosure summary={copy.portfolio.card.onChainProof}>
        <KeyValueList>
          <KeyValue
            label={copy.portfolio.card.noteId}
            value={<ProofLink href={suiExplorerObjectUrl(note.noteId)}>{shortId(note.noteId)}</ProofLink>}
          />
          <KeyValue
            label={isDual ? copy.portfolio.card.quoteHash : copy.portfolio.card.productId}
            value={note.productId || '--'}
          />
          {isDual ? (
            <div>
              <span>{copy.portfolio.card.subscriptionTx}</span>
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
              <span>{copy.portfolio.card.settlementTx}</span>
              <IndexedTransactionDigestValue digest={eventIndexEntry?.settlementDigest} locale={locale} />
            </div>
          ) : null}
          <KeyValue
            label={copy.portfolio.card.accountWrapper}
            value={<ProofLink href={suiExplorerObjectUrl(note.wrapperId)}>{shortId(note.wrapperId)}</ProofLink>}
          />
          <KeyValue label={copy.portfolio.card.accountBalance} value={accountWrapperBalance} />
          <KeyValue
            label={copy.dualInvestment.oracle}
            value={<ProofLink href={suiExplorerObjectUrl(note.oracleId)}>{shortId(note.oracleId)}</ProofLink>}
          />
          {isDual ? (
            <div>
              <span>{copy.portfolio.card.priceFeedUpdated}</span>
              <OracleLastUpdateValue oracleId={note.oracleId} locale={locale} />
            </div>
          ) : null}
          {isDual ? (
            <>
              <KeyValue label={copy.portfolio.card.yourPrice} value={formatPrice(note.targetPrice, locale)} />
              <KeyValue label={copy.portfolio.card.floor} value={formatPrice(note.floorPrice, locale)} />
              <KeyValue label={copy.portfolio.card.reward} value={`${formatAmount(note.coupon, locale)} dUSDC`} />
              <KeyValue label={copy.portfolio.card.settlement} value={copy.portfolio.card.cashSettled} />
              <KeyValue
                label={copy.portfolio.card.settlementPrice}
                value={
                  marketState?.settlementPrice == null
                    ? copy.common.unavailable
                    : formatPrice(marketState.settlementPrice, locale)
                }
              />
              <div>
                <span>{copy.portfolio.card.payoutRange}</span>
                <SettlementRangeValue note={note} locale={locale} />
              </div>
              <div>
                <span>{copy.portfolio.card.allocatedPositions}</span>
                <AllocatedPositionsValue entry={eventIndexEntry} locale={locale} />
              </div>
              <KeyValue label={copy.portfolio.card.legs} value={note.legs.length} />
            </>
          ) : null}
        </KeyValueList>
      </Disclosure>
    </Card>
  );
}
