import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildEdgeTracks } from '../recorder/buildEdgeTracks';
import { analyticsFixtureSamples } from '../recorder/analyticsFixtures';
import { EdgeChart, EdgeTrackTooltipContent } from './EdgeChart';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 800, height: 320 }}>
        {children}
      </div>
    ),
  };
});

const fixtureTracks = () => buildEdgeTracks(analyticsFixtureSamples());

describe('EdgeChart', () => {
  it('defaults to the nearest-expiry active market and renders its Track', () => {
    render(<EdgeChart locale="en" edgeTracks={fixtureTracks()} />);

    expect(screen.getByRole('region', { name: 'Edge Track' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Edge over time' })).toBeVisible();
    expect(screen.getByTestId('analytics-edge-chart')).toBeVisible();

    // Default selection = first active track (Jul 16 settlement, ≈3d tenor).
    const select = screen.getByRole('combobox', { name: 'Expiry Market' });
    expect(select).toHaveDisplayValue(/Jul 16.*≈3d/);
    expect(screen.getByText('Active')).toBeVisible();

    // Selected-market summary strip: 4 rows, all leading, median +7.50 pts.
    const summary = screen.getByTestId('analytics-track-summary');
    expect(within(summary).getByText('4')).toBeVisible();
    expect(within(summary).getByText('100%')).toBeVisible();
    expect(within(summary).getByText('+7.50 pts')).toBeVisible();
  });

  it('groups options into Active and Ended and switches Tracks via the dropdown', () => {
    render(<EdgeChart locale="en" edgeTracks={fixtureTracks()} />);

    const select = screen.getByRole('combobox', { name: 'Expiry Market' });
    const groups = within(select).getAllByRole('group');
    expect(groups.map((g) => g.getAttribute('label'))).toEqual(['Active', 'Ended']);

    // Ended group holds the 1d market that migrated to the hourly shelf.
    const endedOptions = within(groups[1]!).getAllByRole('option');
    expect(endedOptions).toHaveLength(1);

    fireEvent.change(select, { target: { value: endedOptions[0]!.getAttribute('value') } });
    expect(screen.getByText('Moved to hourly shelf')).toBeVisible();
    // One matched Run only → insufficient-samples notice instead of a chart.
    expect(screen.getByText(/its Edge Track appears after two matched Runs/i)).toBeVisible();
    expect(screen.queryByTestId('analytics-edge-chart')).not.toBeInTheDocument();
  });

  it('shows an empty notice when there are no plottable Samples', () => {
    render(<EdgeChart locale="en" edgeTracks={{ tracks: [] }} />);

    expect(screen.getByText(/No live-source matched Samples yet/i)).toBeVisible();
  });
});

describe('EdgeTrackTooltipContent', () => {
  it('discloses Run time, row count, median Edge, range, and median APRs', () => {
    render(
      <EdgeTrackTooltipContent
        locale="en"
        point={{
          boundaryMs: Date.UTC(2026, 6, 14, 12, 0, 0),
          medianEdgePp: 0.125,
          minEdgePp: 0.05,
          maxEdgePp: 0.2,
          rowCount: 2,
          medianNetApr: 0.425,
          medianBenchmarkApr: 0.3,
        }}
      />,
    );

    expect(screen.getByText(/2 ladder rows/i)).toBeVisible();
    expect(screen.getByText('Median Edge')).toBeVisible();
    expect(screen.getByText('+12.50 pts')).toBeVisible();
    expect(screen.getByText('Min–max')).toBeVisible();
    expect(screen.getByText(/\+5\.00 pts – \+20\.00 pts/)).toBeVisible();
    expect(screen.getByText(/Anker net APR/i)).toBeVisible();
    expect(screen.getByText('42.5%')).toBeVisible();
    expect(screen.getByText(/Nearest-expiry Binance APR/i)).toBeVisible();
    expect(screen.getByText('30%')).toBeVisible();
    expect(screen.queryByText(/Settlement offset/i)).not.toBeInTheDocument();
  });
});
