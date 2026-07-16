'use client';

// Unlike Button/Card this primitive is client-only: it owns browser behaviour
// (Escape listener, body scroll lock, focus trap, portal into document.body).
import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  /** Requested by the ✕ button, a backdrop click, or Escape. Pure dismissal — must have no side effects. */
  onClose: () => void;
  /** Accessible name for the dialog. */
  ariaLabel: string;
  /** Localised label for the ✕ button. */
  closeLabel: string;
  className?: string;
  children: ReactNode;
}

/**
 * Modal dialog — centered sticker card over a navy-tinted backdrop.
 * Renders nothing while closed; while open it portals into document.body so
 * no ancestor stacking context or transform can clip the overlay.
 */
export function Dialog({ open, onClose, ariaLabel, closeLabel, className, children }: DialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  // aria-modal hides the background from screen readers but not from Tab:
  // move focus onto the card while open and hand it back on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cardRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, [open]);

  if (!open) return null;

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !cardRef.current) return;
    const focusable = Array.from(cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === cardRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div className="anker-dialog-backdrop" onClick={handleBackdropClick}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={['anker-dialog', className].filter(Boolean).join(' ')}
        ref={cardRef}
        tabIndex={-1}
        onKeyDown={handleCardKeyDown}
      >
        <button type="button" className="anker-dialog-close" aria-label={closeLabel} onClick={onClose}>
          ×
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
