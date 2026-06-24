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

  it('renders Chinese landing copy with localized app links', () => {
    render(<HomePage locale="zh-CN" />);

    expect(screen.getByRole('heading', { name: '让收益稳稳靠岸。' })).toBeVisible();
    expect(screen.getAllByRole('link', { name: '启动应用' })[0]).toHaveAttribute('href', '/zh-CN/app');
    expect(screen.getByRole('link', { name: '双币赢' })).toHaveAttribute('href', '/zh-CN/app/dual-investment');
  });
});
