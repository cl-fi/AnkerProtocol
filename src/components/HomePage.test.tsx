import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('links to the project GitHub repository from the footer', () => {
    render(<HomePage />);

    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/cl-fi/AnkerProtocol',
    );
  });
});
