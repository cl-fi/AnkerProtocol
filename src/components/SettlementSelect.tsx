'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { copyForLocale, DEFAULT_LOCALE, formattersForLocale, type Locale } from '../i18n';
import { utcOffsetLabel } from '../i18n/formatters';
import type { CuratedOracleListItem } from '../server/curatedOracles';
import { Dialog } from '../ui';
import { useIsMobile } from '../hooks/useIsMobile';

export interface SettlementGroup {
  key: string;
  label: string;
  rows: CuratedOracleListItem[];
}

/** One row's display pair — bold countdown plus compact 24h settle moment. */
function rowParts(oracle: CuratedOracleListItem, locale: Locale, snapshotCapturedAtMs?: number) {
  const format = formattersForLocale(locale);
  // Snapshot rows freeze their countdown at the capture instant (photograph model).
  const countdown =
    oracle.source === 'snapshot' && snapshotCapturedAtMs
      ? format.timeToExpiry(oracle.expiry, snapshotCapturedAtMs)
      : format.timeToExpiry(oracle.expiry);
  return { countdown, settlesAt: format.expiryCompact(oracle.expiry) };
}

/**
 * Settlement-date picker styled like the rest of the sticker UI, replacing the
 * native select whose popup is unbrandable (transparent gray in Chromium).
 * Desktop anchors a listbox card under the trigger; phones reuse the Dialog
 * bottom sheet. The trigger is a plain button, so it escapes the global
 * ≥16px form-control font (iOS anti-zoom) and fits on one line.
 */
export function SettlementSelect({
  value,
  groups,
  onSelect,
  snapshotCapturedAtMs,
  locale = DEFAULT_LOCALE,
}: {
  value: string;
  groups: SettlementGroup[];
  onSelect: (oracleId: string) => void;
  snapshotCapturedAtMs?: number;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();

  const rows = groups.flatMap((group) => group.rows);
  const selected = rows.find((oracle) => oracle.oracle_id === value);
  const selectedParts = selected ? rowParts(selected, locale, snapshotCapturedAtMs) : null;
  const zoneNote = rows.length > 0 ? copy.dualInvestment.settlementTimesNote(utcOffsetLabel(rows[0].expiry)) : null;

  // Desktop popover dismissal — outside pointerdown or Escape (sheet mode
  // delegates both to Dialog).
  useEffect(() => {
    if (!open || isMobile) return;
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !anchorRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, isMobile]);

  const pick = (oracleId: string) => {
    onSelect(oracleId);
    setOpen(false);
    if (!isMobile) triggerRef.current?.focus();
  };

  const optionList = (
    <div className="expiry-listbox" id={listboxId} role="listbox" aria-label={copy.dualInvestment.settlementDate}>
      {groups.map((group) =>
        group.rows.length > 0 ? (
          <div className="expiry-group" key={group.key} role="group" aria-label={group.label}>
            <span className="expiry-group-label" aria-hidden="true">
              {group.label}
            </span>
            {group.rows.map((oracle) => {
              const parts = rowParts(oracle, locale, snapshotCapturedAtMs);
              const isSelected = oracle.oracle_id === value;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={isSelected ? 'expiry-option selected' : 'expiry-option'}
                  key={oracle.oracle_id}
                  onClick={() => pick(oracle.oracle_id)}
                >
                  <strong>
                    {isSelected ? <Check aria-hidden="true" size={15} strokeWidth={3} /> : null}
                    {parts.countdown}
                  </strong>
                  <span>{parts.settlesAt}</span>
                </button>
              );
            })}
          </div>
        ) : null,
      )}
    </div>
  );

  return (
    <div className="di-settlement" ref={anchorRef}>
      <button
        type="button"
        className="expiry-trigger"
        aria-label={copy.dualInvestment.settlementDate}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open && !isMobile ? listboxId : undefined}
        disabled={rows.length === 0}
        ref={triggerRef}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="expiry-trigger-value">
          {selectedParts ? `${selectedParts.countdown} · ${selectedParts.settlesAt}` : '--'}
        </span>
        <ChevronDown aria-hidden="true" size={18} strokeWidth={2.75} />
      </button>

      {open && isMobile ? (
        <Dialog
          open
          ariaLabel={copy.dualInvestment.settlementDate}
          closeLabel={copy.common.close}
          className="expiry-sheet"
          onClose={() => setOpen(false)}
        >
          <header className="expiry-sheet-head">
            <h2>{copy.dualInvestment.settlementDate}</h2>
            {zoneNote ? <span>{zoneNote}</span> : null}
          </header>
          {optionList}
        </Dialog>
      ) : null}

      {/* No zone note here — the section label right above the trigger already
          carries the offset; the sheet keeps it because it covers that label. */}
      {open && !isMobile ? <div className="expiry-panel">{optionList}</div> : null}
    </div>
  );
}
