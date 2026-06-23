import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: { children: 'Subscribe Buy Low' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary', children: 'Refresh' } };
export const Small: Story = { args: { variant: 'secondary', size: 'sm', children: 'Create' } };
export const Disabled: Story = { args: { variant: 'primary', disabled: true } };
