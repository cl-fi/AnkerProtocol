import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildEdgeSeries } from '../recorder/buildEdgeSeries';
import { analyticsFixtureSamples } from '../recorder/analyticsFixtures';
import { EdgeChart, EdgeSeriesTooltipContent } from './EdgeChart';

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

describe('EdgeChart', () => {
  it('renders the Edge time series for fixture Samples including a negative 1d point', () => {
    const edgeSeries = buildEdgeSeries(analyticsFixtureSamples());
    render(<EdgeChart locale="en" edgeSeries={edgeSeries} />);

    expect(screen.getByRole('region', { name: 'Edge time series' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Edge over time' })).toBeVisible();
    expect(screen.getByTestId('analytics-edge-chart')).toBeVisible();
    expect(edgeSeries.series.find((s) => s.bucket === '1d')!.points[0]!.edgePp).toBeLessThan(0);
  });

  it('shows an empty notice when there are no plottable Samples', () => {
    render(<EdgeChart locale="en" edgeSeries={{ series: [] }} />);

    expect(screen.getByText(/No live-source matched Samples yet/i)).toBeVisible();
  });
});

describe('EdgeSeriesTooltipContent', () => {
  it('discloses Anker APR, Binance APR, and settlement offset for a sample', () => {
    render(
      <EdgeSeriesTooltipContent
        locale="en"
        bucket="3d"
        point={{
          boundaryMs: Date.UTC(2026, 6, 14, 12, 0, 0),
          targetPrice: 73_500,
          edgePp: 0.1,
          netApr: 0.4,
          benchmarkApr: 0.3,
          settlementOffsetMs: 8 * 3_600_000,
        }}
      />,
    );

    expect(screen.getByText(/Anker net APR/i)).toBeVisible();
    expect(screen.getByText('40%')).toBeVisible();
    expect(screen.getByText(/Nearest-expiry Binance APR/i)).toBeVisible();
    expect(screen.getByText('30%')).toBeVisible();
    expect(screen.getByText(/Settlement offset/i)).toBeVisible();
    expect(screen.getByText('+8h')).toBeVisible();
  });
});
