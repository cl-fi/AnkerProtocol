import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { aggregateHeadlineStats } from '../recorder/aggregateHeadlineStats';
import { analyticsFixtureSamples } from '../recorder/analyticsFixtures';
import { buildEdgeTracks } from '../recorder/buildEdgeTracks';
import { AnalyticsPage } from './AnalyticsPage';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div style={{ width: 800, height: 320 }}>{children}</div>
    ),
  };
});

const samples = analyticsFixtureSamples();
const fixtureLoad = {
  kind: 'ready' as const,
  usingFixture: true,
  stats: aggregateHeadlineStats(samples),
  edgeTracks: buildEdgeTracks(samples),
};

describe('AnalyticsPage', () => {
  it('renders headline stats, Edge chart, and methodology in English', () => {
    render(<AnalyticsPage locale="en" load={fixtureLoad} />);

    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeVisible();
    expect(
      within(screen.getByRole('navigation', { name: 'Products' })).getByRole('link', { name: 'Analytics' }),
    ).toHaveAttribute('href', '/en/analytics');
    const stats = screen.getByLabelText('Headline statistics');
    expect(stats).toBeVisible();
    expect(within(stats).getByText('Samples')).toBeVisible();
    expect(within(stats).getByText('6')).toBeVisible();
    expect(within(stats).getByText('83.3%')).toBeVisible();
    expect(within(stats).getByText('+7.50 pts')).toBeVisible();
    expect(within(stats).getByText('2')).toBeVisible();
    expect(within(stats).getByText('85.7%')).toBeVisible();

    expect(screen.getByRole('region', { name: 'Edge Track' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Edge over time' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Expiry Market' })).toBeVisible();

    expect(screen.getByRole('heading', { name: 'Methodology' })).toBeVisible();
    expect(screen.getByText(/every 15 minutes/i)).toBeVisible();
    expect(screen.getByText(/exceeds 50%/i)).toBeVisible();
    expect(screen.getByText(/net after protocol fee/i)).toBeVisible();
    expect(screen.getByText(/live-source matched Samples/i)).toBeVisible();
    expect(screen.getByText(/Failed Runs record no Samples/i)).toBeVisible();
    expect(screen.getByText(/one Edge Track per Expiry Market/i)).toBeVisible();
    expect(screen.getByText(/Sample start date:/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Source repository' })).toHaveAttribute(
      'href',
      'https://github.com/cl-fi/AnkerProtocol',
    );
  });

  it('renders Chinese copy on the analytics route shell', () => {
    render(<AnalyticsPage locale="zh-CN" load={fixtureLoad} />);

    expect(screen.getByRole('heading', { name: '数据分析' })).toBeVisible();
    expect(
      within(screen.getByRole('navigation', { name: '产品' })).getByRole('link', { name: '数据分析' }),
    ).toHaveAttribute('href', '/zh-CN/analytics');
    expect(screen.getByRole('heading', { name: 'Edge 随时间变化' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '方法说明' })).toBeVisible();
    expect(screen.getByText(/每 15 分钟/)).toBeVisible();
    expect(screen.getByText(/50%/)).toBeVisible();
    expect(screen.getByRole('link', { name: '源代码仓库' })).toHaveAttribute(
      'href',
      'https://github.com/cl-fi/AnkerProtocol',
    );
  });

  it('shows an unavailable notice when Samples cannot be loaded', () => {
    render(<AnalyticsPage locale="en" load={{ kind: 'unavailable', reason: 'not_configured' }} />);

    expect(
      screen.getByText(/Benchmark Samples are not available yet/i),
    ).toBeVisible();
    expect(screen.getByText(/No live-source matched Samples yet/i)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Methodology' })).toBeVisible();
  });
});
