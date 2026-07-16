'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDown, Check, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { settlementNoteForProductNote } from '../application/settleProductNote';
import { isDemoMode } from '../config/runtimeModes';
import type { PredictMarketState } from '../deepbook/predictMarketState';
import { fetchOracleMarket } from '../deepbook/predictServer';
import { copyForLocale, DEFAULT_LOCALE, formatTimeToExpiry, type Locale } from '../i18n';
import { netAprAfterCouponFee } from '../products/feePolicy';
import { settlementPayoutRange } from '../products/settlement';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import type { ProductNoteEventIndexEntry } from '../sui/productNoteEvents';
import { lifecycleForProductNote, type ProductNoteLifecycle } from '../sui/productNoteLifecycle';
import { subscriptionDigestForQuote } from '../sui/subscriptionDigestStore';
import {
  ClaimActionView,
  claimEstimateForNote,
  claimRowPayout,
  useClaimNote,
  type ConfirmedClaim,
} from './PortfolioClaimAction';
import {
  formatApr,
  formatBtcAmount,
  formatExpiry,
  formatOracleTimestamp,
  formatPreciseAmount,
  formatPrice,
  formatQuoteBaseUnits,
  shortId,
  suiExplorerObjectUrl,
  suiExplorerTxUrl,
} from './PortfolioFormat';
import { Badge, Button, Card, Disclosure, KeyValue, KeyValueList, type Tone } from '../ui';

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

/**
 * One Position, one row: the collapsed summary carries only what varies
 * between Positions (strike, status, deposit, reward, settle time); every
 * shared explainer lives in the expanded detail. Claimable rows swap the
 * settle time for the payout and carry the Claim button inline, so claiming
 * never requires expanding — the detail stays optional reading.
 */
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
  const lifecycle = lifecycleForProductNote(note, marketState, Date.now());
  const status = noteStatusBadge(note, lifecycle, locale);
  const [expanded, setExpanded] = useState(false);
  const claimFlow = useClaimNote({ note, marketState, onClaimSuccess, locale });
  const demoMode = isDemoMode();
  const showRowClaim = isDual && lifecycle === 'claimable';
  const rowPayout = showRowClaim ? claimRowPayout(note, marketState) : null;

  function toggle() {
    setExpanded((value) => !value);
  }

  const rewardApr = netAprAfterCouponFee(note.apr, note.feeBps);
  const localizedSettlesText =
    lifecycle === 'countdown'
      ? locale === 'zh-CN'
        ? formatTimeToExpiry(note.expiryMs, locale)
        : `in ${formatTimeToExpiry(note.expiryMs, locale)}`
      : formatExpiry(note.expiryMs, locale);
  const estimate = claimEstimateForNote(note);
  // Same arithmetic as the claim block: deposit + reward, net of the fee.
  const netIfAbove = note.principal + note.coupon - estimate.feeAmount;
  const btcIfBelow = note.targetPrice > 0 ? netIfAbove / note.targetPrice : 0;
  const feePct = `${note.feeBps / 100}%`;

  return (
    <Card as="article" className="di-position-row">
      <div className="di-position-summary" onClick={toggle}>
        <div className="di-position-title">
          <h3>{isDual ? copy.portfolio.card.buyLowBtc : copy.portfolio.card.legacyProduct}</h3>
          {isDual ? <span className="di-position-strike">@ {formatPrice(note.targetPrice, locale)}</span> : null}
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <dl className="di-position-inline-stats">
          <div>
            <dt>{copy.portfolio.card.deposit}</dt>
            <dd>{depositedCashText(note, eventIndexEntry)} dUSDC</dd>
          </div>
          <div>
            <dt>{copy.portfolio.card.reward}</dt>
            <dd className="is-reward">
              +{formatPreciseAmount(note.coupon, locale)} <em>{formatApr(rewardApr, locale)} APR</em>
            </dd>
          </div>
          {rowPayout ? (
            <div>
              <dt>{copy.portfolio.claim.youllReceive}</dt>
              <dd className="is-payout">
                {rowPayout.settledBelow
                  ? `~${formatBtcAmount(rowPayout.btcAmount, locale)} BTC`
                  : `${formatPreciseAmount(rowPayout.netPayout, locale)} dUSDC`}
              </dd>
            </div>
          ) : (
            <div>
              <dt>{copy.portfolio.card.settles}</dt>
              <dd>{localizedSettlesText}</dd>
            </div>
          )}
        </dl>
        {showRowClaim ? (
          <Button
            variant="primary"
            size="sm"
            className="di-position-claim"
            disabled={demoMode || claimFlow.isPending}
            title={demoMode ? copy.demo.claimDisabled : undefined}
            onClick={(event) => {
              event.stopPropagation();
              claimFlow.claim();
            }}
          >
            {claimFlow.isPending ? copy.portfolio.claim.submitting : copy.portfolio.claim.claimPayout}
          </Button>
        ) : null}
        <button
          type="button"
          className="di-position-toggle"
          aria-expanded={expanded}
          aria-label={copy.portfolio.card.details}
          onClick={(event) => {
            event.stopPropagation();
            toggle();
          }}
        >
          {showRowClaim ? null : copy.portfolio.card.details}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      {claimFlow.digest ? (
        <p className="execution-message di-position-claim-message">
          {copy.portfolio.claim.submitted} —{' '}
          <a className="di-proof-link" href={suiExplorerTxUrl(claimFlow.digest)} target="_blank" rel="noreferrer">
            {shortId(claimFlow.digest)}
          </a>
        </p>
      ) : null}
      {claimFlow.error ? <p className="execution-error di-position-claim-message">{claimFlow.error}</p> : null}

      {expanded ? (
        <div className="di-position-detail">
          {isDual ? (
            <>
              <ul className="di-position-outcomes">
                <li className="is-above">
                  <Check size={15} aria-hidden="true" />
                  <span>
                    {copy.portfolio.card.outcomeAbove(
                      formatPrice(note.targetPrice, locale),
                      formatPreciseAmount(netIfAbove, locale),
                    )}
                  </span>
                </li>
                <li className="is-below">
                  <ArrowDown size={15} aria-hidden="true" />
                  <span>
                    {copy.portfolio.card.outcomeBelow(
                      formatPrice(note.targetPrice, locale),
                      formatBtcAmount(btcIfBelow, locale),
                    )}
                  </span>
                </li>
              </ul>
              <KeyValueList className="di-position-facts">
                <KeyValue
                  label={copy.portfolio.card.feeLabel}
                  value={copy.portfolio.card.feeValue(formatPreciseAmount(estimate.feeAmount, locale), feePct)}
                />
                <div>
                  <span>{copy.portfolio.card.payoutRange}</span>
                  <SettlementRangeValue note={note} locale={locale} />
                </div>
                {marketState?.settlementPrice != null ? (
                  <KeyValue
                    label={copy.portfolio.card.settlementPrice}
                    value={formatPrice(marketState.settlementPrice, locale)}
                  />
                ) : null}
              </KeyValueList>
            </>
          ) : null}

          {/* The claimable payout + button already live in the summary row;
              the detail keeps the info-only block for every other lifecycle. */}
          {showRowClaim ? null : (
            <ClaimActionView
              note={note}
              nowMs={Date.now()}
              marketState={marketState}
              isPending={claimFlow.isPending}
              demoMode={demoMode}
              locale={locale}
              onClaim={claimFlow.claim}
              showAction={false}
            />
          )}

          <Disclosure summary={copy.portfolio.card.onChainProof}>
            <KeyValueList>
              <KeyValue
                label={copy.portfolio.card.noteId}
                value={<ProofLink href={suiExplorerObjectUrl(note.noteId)}>{shortId(note.noteId)}</ProofLink>}
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
              ) : (
                <KeyValue label={copy.portfolio.card.productId} value={note.productId || '--'} />
              )}
              {isDual ? (
                <div>
                  <span>{copy.portfolio.card.settlementTx}</span>
                  <IndexedTransactionDigestValue digest={eventIndexEntry?.settlementDigest} locale={locale} />
                </div>
              ) : null}
              <KeyValue
                label={copy.portfolio.card.priceFeed}
                value={<ProofLink href={suiExplorerObjectUrl(note.oracleId)}>{shortId(note.oracleId)}</ProofLink>}
              />
              {isDual ? (
                <div>
                  <span>{copy.portfolio.card.priceFeedUpdated}</span>
                  <OracleLastUpdateValue oracleId={note.oracleId} locale={locale} />
                </div>
              ) : null}
            </KeyValueList>
          </Disclosure>
        </div>
      ) : null}
    </Card>
  );
}
