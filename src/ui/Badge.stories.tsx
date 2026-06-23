import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta = {
  title: 'Primitives/Badge',
  component: Badge,
  args: { children: 'Active' },
  argTypes: { tone: { control: 'inline-radio', options: ['neutral', 'positive', 'warning', 'danger'] } },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = { args: { tone: 'neutral', children: 'Completed' } };
export const Positive: Story = { args: { tone: 'positive', children: 'Ready to claim' } };
export const Warning: Story = { args: { tone: 'warning', children: 'Active' } };
export const Danger: Story = { args: { tone: 'danger', children: 'Action needed' } };
