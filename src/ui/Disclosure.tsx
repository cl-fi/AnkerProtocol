// Pure presentational primitive — universal (no 'use client').
// Reuses the existing, already-clean `.di-position-proof` styling (Card pattern).
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

export interface DisclosureProps {
  /** Always-visible summary row content. */
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  /** Render expanded on first paint. */
  defaultOpen?: boolean;
}

/** Native <details>/<summary> with the sticker chrome and a rotating chevron. */
export function Disclosure({ summary, children, className, defaultOpen }: DisclosureProps) {
  return (
    <details className={['di-position-proof', className].filter(Boolean).join(' ')} open={defaultOpen}>
      <summary>
        <span>{summary}</span>
        <ChevronDown size={18} />
      </summary>
      {children}
    </details>
  );
}
