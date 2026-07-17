import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileActionDock } from './MobileActionDock';
import { MobileDisclosure } from './MobileDisclosure';

class IntersectionObserverStub {
  static callback: IntersectionObserverCallback | null = null;

  constructor(callback: IntersectionObserverCallback) {
    IntersectionObserverStub.callback = callback;
  }

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = '0px';
  thresholds = [0];
}

function intersectionEntry({ isIntersecting, top }: { isIntersecting: boolean; top: number }) {
  return {
    isIntersecting,
    boundingClientRect: { top },
  } as IntersectionObserverEntry;
}

describe('MobileDisclosure', () => {
  it('lets a user reveal and hide secondary mobile content without removing its desktop surface', () => {
    render(
      <MobileDisclosure summary="Current reference" expandLabel="Show prices" collapseLabel="Hide prices">
        <p>Price ladder</p>
      </MobileDisclosure>,
    );

    const toggle = screen.getByRole('button', { name: /Current reference.*Show prices/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Price ladder').parentElement).toHaveAttribute('data-mobile-collapsed', 'true');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName(/Current reference.*Hide prices/i);
    expect(screen.getByText('Price ladder').parentElement).toHaveAttribute('data-mobile-collapsed', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('MobileActionDock', () => {
  beforeEach(() => {
    IntersectionObserverStub.callback = null;
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  });

  it('floats the same action only after the user has seen and scrolled past its inline position', () => {
    render(
      <MobileActionDock enabled>
        <button type="button">Subscribe Buy Low</button>
      </MobileActionDock>,
    );

    const action = screen.getByRole('button', { name: 'Subscribe Buy Low' });
    const dock = action.parentElement;
    expect(screen.getAllByRole('button', { name: 'Subscribe Buy Low' })).toHaveLength(1);
    expect(dock).not.toHaveClass('is-floating');

    act(() => {
      IntersectionObserverStub.callback?.(
        [intersectionEntry({ isIntersecting: false, top: 900 })],
        {} as IntersectionObserver,
      );
    });
    expect(dock).not.toHaveClass('is-floating');

    act(() => {
      IntersectionObserverStub.callback?.(
        [intersectionEntry({ isIntersecting: true, top: 300 })],
        {} as IntersectionObserver,
      );
    });
    act(() => {
      IntersectionObserverStub.callback?.(
        [intersectionEntry({ isIntersecting: false, top: -20 })],
        {} as IntersectionObserver,
      );
    });

    expect(dock).toHaveClass('is-floating');
    expect(screen.getAllByRole('button', { name: 'Subscribe Buy Low' })).toHaveLength(1);

    act(() => {
      IntersectionObserverStub.callback?.(
        [intersectionEntry({ isIntersecting: true, top: 120 })],
        {} as IntersectionObserver,
      );
    });
    expect(dock).not.toHaveClass('is-floating');
  });
});
