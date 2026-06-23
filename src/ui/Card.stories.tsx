import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta = {
  title: 'Primitives/Card',
  component: Card,
  args: { children: 'Card content goes here.', style: { width: 320 } },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'empty', 'error'] },
    as: { control: 'inline-radio', options: ['div', 'article', 'section'] },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = {
  args: { variant: 'empty', children: 'No positions yet. Open a Buy Low position to get started.' },
};
export const ErrorState: Story = { args: { variant: 'error', children: 'Unable to load your positions.' } };
