import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDefaultStructuredQuoteState } from './useStructuredQuote';

describe('useDefaultStructuredQuoteState', () => {
  it('defaults the Dual Investment target below spot for Buy Low semantics', () => {
    const { result } = renderHook(() => useDefaultStructuredQuoteState(73_264));

    expect(result.current.productType).toBe('dual-investment');
    expect(result.current.dualInput.targetPrice).toBeLessThan(73_264);
    expect(result.current.dualInput.floorPrice).toBeLessThan(result.current.dualInput.targetPrice);
  });
});
