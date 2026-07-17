'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface MobileActionDockProps {
  enabled: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Keeps one action surface in the DOM. After its inline slot has been visible,
 * scrolling it above the phone viewport docks that same surface above the
 * bottom navigation. The measured slot height prevents layout jumps.
 */
export function MobileActionDock({ enabled, children, className }: MobileActionDockProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const hasBeenVisibleRef = useRef(false);
  const [isFloating, setIsFloating] = useState(false);
  const [surfaceHeight, setSurfaceHeight] = useState(0);

  useLayoutEffect(() => {
    if (isFloating) return;
    const nextHeight = surfaceRef.current?.getBoundingClientRect().height ?? 0;
    if (nextHeight > 0) setSurfaceHeight(nextHeight);
  }, [children, isFloating]);

  useEffect(() => {
    const slot = slotRef.current;
    if (
      !enabled ||
      !slot ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function' ||
      !window.matchMedia('(max-width: 767px)').matches ||
      typeof IntersectionObserver === 'undefined'
    ) {
      hasBeenVisibleRef.current = false;
      setIsFloating(false);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          hasBeenVisibleRef.current = true;
          setIsFloating(false);
          return;
        }
        setIsFloating(hasBeenVisibleRef.current && entry.boundingClientRect.top < 0);
      },
      { threshold: 0.1 },
    );
    observer.observe(slot);
    return () => observer.disconnect();
  }, [enabled]);

  return (
    <div
      ref={slotRef}
      className={['mobile-action-dock__slot', className].filter(Boolean).join(' ')}
      style={isFloating && surfaceHeight > 0 ? { minHeight: surfaceHeight } : undefined}
    >
      <div
        ref={surfaceRef}
        className={isFloating ? 'mobile-action-dock__surface is-floating' : 'mobile-action-dock__surface'}
      >
        {children}
      </div>
    </div>
  );
}
