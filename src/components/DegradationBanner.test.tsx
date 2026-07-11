import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DegradationBanner } from './DegradationBanner';

describe('DegradationBanner', () => {
  it('shows the D4 fixture source label and recovery copy', () => {
    render(<DegradationBanner locale="en" visible />);

    expect(screen.getByRole('status')).toHaveTextContent(/Fixture data/i);
    expect(screen.getByRole('status')).toHaveTextContent(/day-scale Expiry Markets/i);
    expect(screen.getByRole('status')).toHaveTextContent(/switches to live data automatically/i);
  });

  it('renders nothing when not degraded', () => {
    const { container } = render(<DegradationBanner locale="en" visible={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
