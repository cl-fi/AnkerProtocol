'use client';

import { ArrowDown, Check, ChevronDown, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isDemoMode } from '../config/runtimeModes';
import type { PredictMarketState } from '../deepbook/predictMarketState';
import { copyForLocale, DEFAULT_LOCALE, formatTimeToExpiry, type Locale } from '../i18n';
import { netAprAfterCouponFee } from '../products/feePolicy';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import type { ProductNoteEventIndexEntry } from '../sui/productNoteEvents';
import { lifecycleForProductNote, type ProductNoteLifecycle } from '../sui/productNoteLifecycle';
import { subscriptionDigestForQuote } from '../sui/subscriptionDigestStore';
import {
  ClaimActionView,
  claimAboveEstimate,
  claimEstimateForNote,
  claimRowPayout,
  useClaimNote,
  type ConfirmedClaim,
} from './PortfolioClaimAction';
import {
  formatApr,
  formatBtcAmount,
  formatBtcAmountCompact,
  formatExpiry,
  formatCashAmount,
  formatPrice,
  formatQuoteBaseUnits,
  shortId,
  suiExplorerObjectUrl,
  suiExplorerTxUrl,
} from './PortfolioFormat';
import { Badge, Button, Card, type Tone } from '../ui';

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

/** Proof-footer link for the subscription transaction; renders nothing until a digest is known. */
export function SubscriptionDigestValue({
  owner,
  quoteHash,
  eventDigest,
  label,
}: {
  owner: string;
  quoteHash: string;
  eventDigest?: string;
  label?: string;
}) {
  const localDigest = useSubscriptionDigest(owner, quoteHash);
  const digest = eventDigest || localDigest;
  if (!digest) return null;
  return (
    <ProofLink href={suiExplorerTxUrl(digest)}>
      {label ? (
        <>
          {label}
          <ExternalLink size={12} aria-hidden="true" />
        </>
      ) : (
        <span>{shortId(digest)}</span>
      )}
    </ProofLink>
  );
}

export function depositedCashText(
  note: Pick<AnkerProductNoteRecord, 'principalBaseUnits'>,
  entry?: ProductNoteEventIndexEntry,
) {
  return formatQuoteBaseUnits(entry?.principalBaseUnits ?? note.principalBaseUnits);
}

/**
 * The two-branch outcome panel. Settlement only decides the deposit's form —
 * dUSDC back, or BTC bought at the target — while the coupon reward is earned
 * either way, so the below branch lists the reward as its own dUSDC line
 * instead of folding it into the BTC figure (which is deposit ÷ target,
 * exactly what the claim delivers). The skeleton is identical across the
 * lifecycle: settlement lights up the branch that happened and dims the other.
 */
function OutcomeFork({
  note,
  marketState,
  lifecycle,
  locale,
}: {
  note: AnkerProductNoteRecord;
  marketState?: PredictMarketState;
  lifecycle: ProductNoteLifecycle;
  locale: Locale;
}) {
  const copy = copyForLocale(locale);
  const cardCopy = copy.portfolio.card;
  const estimate = claimEstimateForNote(note);
  const outcomeKnown = lifecycle === 'claimable' || lifecycle === 'claimed';
  const actual = outcomeKnown ? claimRowPayout(note, marketState) : null;
  const aboveWon = actual ? !actual.settledBelow : false;
  const belowWon = actual ? actual.settledBelow : false;
  const feeText = formatCashAmount(estimate.feeAmount, locale);
  const targetText = formatPrice(note.targetPrice, locale);
  // Same arithmetic as the claim flow, and always through the settlement
  // engine: the projected figure must equal the settled payout to the base
  // unit, or the branch amount jumps the moment the market fixes.
  const aboveAmount = actual && aboveWon ? actual.netPayout : claimAboveEstimate(note).netPayout;
  const btcIfBelow = note.targetPrice > 0 ? note.principal / note.targetPrice : 0;
  const rewardAfterFee = note.coupon - estimate.feeAmount;
  const wonLabel = lifecycle === 'claimed' ? copy.portfolio.claim.youReceived : copy.portfolio.claim.youllReceive;
  const settledTag =
    marketState?.settlementPrice != null
      ? cardCopy.forkSettledAt(formatPrice(marketState.settlementPrice, locale))
      : null;

  return (
    <div className="di-outcome-fork">
      <div className={`di-fork-branch is-above${aboveWon ? ' is-won' : belowWon ? ' is-lost' : ''}`}>
        {aboveWon && settledTag ? (
          <span className="di-fork-tag">
            <Check size={12} aria-hidden="true" />
            {settledTag}
          </span>
        ) : null}
        <span className="di-fork-cond">
          {aboveWon ? null : <Check size={15} aria-hidden="true" />}
          {aboveWon ? cardCopy.forkAboveSettled(targetText) : cardCopy.forkAbove(targetText)}
        </span>
        {aboveWon ? <span className="di-fork-label">{wonLabel}</span> : null}
        <strong className="di-fork-amount">{formatCashAmount(aboveAmount, locale)} dUSDC</strong>
        <span className="di-fork-sub">{belowWon ? cardCopy.forkDidntHappen : cardCopy.forkAboveSub(feeText)}</span>
      </div>
      <span className="di-fork-or">{cardCopy.forkOr}</span>
      <div className={`di-fork-branch is-below${belowWon ? ' is-won' : aboveWon ? ' is-lost' : ''}`}>
        {belowWon && settledTag ? (
          <span className="di-fork-tag">
            <ArrowDown size={12} aria-hidden="true" />
            {settledTag}
          </span>
        ) : null}
        <span className="di-fork-cond">
          {belowWon ? null : <ArrowDown size={15} aria-hidden="true" />}
          {belowWon ? cardCopy.forkBelowSettled(targetText) : cardCopy.forkBelow(targetText)}
        </span>
        {belowWon ? <span className="di-fork-label">{wonLabel}</span> : null}
        <strong className="di-fork-amount">≈ {formatBtcAmount(btcIfBelow, locale)} BTC</strong>
        <strong className="di-fork-reward">{cardCopy.forkReward(formatCashAmount(rewardAfterFee, locale))}</strong>
        <span className="di-fork-sub">
          {aboveWon
            ? cardCopy.forkDidntHappen
            : belowWon
              ? cardCopy.forkBelowSettledSub(targetText, feeText)
              : cardCopy.forkBelowSub(formatCashAmount(note.principal, locale), targetText)}
        </span>
      </div>
    </div>
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
            {/* Net of the fee, like the APR beside it — the pair must describe
                the same money or the stat contradicts itself. */}
            <dd className="is-reward">
              +{formatCashAmount(note.coupon - estimate.feeAmount, locale)}{' '}
              <em>{formatApr(rewardApr, locale)} APR</em>
            </dd>
          </div>
          {rowPayout ? (
            <div>
              <dt>{copy.portfolio.claim.youllReceive}</dt>
              <dd className="is-payout">
                {rowPayout.settledBelow ? (
                  <>
                    ~{formatBtcAmountCompact(rowPayout.btcAmount, locale)} BTC
                    <em className="is-reward-note">
                      {copy.portfolio.card.forkReward(formatCashAmount(rowPayout.rewardAfterFee, locale))}
                    </em>
                  </>
                ) : (
                  `${formatCashAmount(rowPayout.netPayout, locale)} dUSDC`
                )}
              </dd>
            </div>
          ) : (
            <div>
              <dt>{copy.portfolio.card.settles}</dt>
              <dd>{localizedSettlesText}</dd>
            </div>
          )}
        </dl>
        <div className="di-position-actions">
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
              {lifecycle === 'awaiting_settle' ? (
                <p className="di-fork-status">{copy.portfolio.claim.awaitingSettlement}</p>
              ) : null}
              <OutcomeFork note={note} marketState={marketState} lifecycle={lifecycle} locale={locale} />
            </>
          ) : (
            // Legacy products have no dual outcome to fork on — keep the
            // info-only claim block for them.
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

          {/* Proof links are audit affordances — label + external icon only;
              the explorer URL is the payload, truncated IDs are redundant. */}
          <div className="di-position-meta">
            {isDual ? (
              <span className="di-position-fee">
                {copy.portfolio.card.feeLabel}{' '}
                {copy.portfolio.card.feeValue(formatCashAmount(estimate.feeAmount, locale), feePct)}
              </span>
            ) : null}
            <span className="di-proof-links">
              <ProofLink href={suiExplorerObjectUrl(note.noteId)}>
                {copy.portfolio.card.noteId}
                <ExternalLink size={12} aria-hidden="true" />
              </ProofLink>
              {isDual ? (
                <SubscriptionDigestValue
                  owner={note.owner}
                  quoteHash={note.productId}
                  eventDigest={eventIndexEntry?.subscriptionDigest}
                  label={copy.portfolio.card.subscriptionTx}
                />
              ) : (
                <span>
                  {copy.portfolio.card.productId} {note.productId || '--'}
                </span>
              )}
              <ProofLink href={suiExplorerObjectUrl(note.oracleId)}>
                {copy.portfolio.card.priceFeed}
                <ExternalLink size={12} aria-hidden="true" />
              </ProofLink>
            </span>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
