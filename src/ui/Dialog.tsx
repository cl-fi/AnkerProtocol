'use client';

// Unlike Button/Card this primitive is client-only: it owns browser behaviour
// (Escape listener, body scroll lock, portal into document.body).
import { useEffect, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
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

  if (!open) return null;

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return createPortal(
    <div className="anker-dialog-backdrop" onClick={handleBackdropClick}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={['anker-dialog', className].filter(Boolean).join(' ')}
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
