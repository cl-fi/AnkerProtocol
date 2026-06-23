import type { Meta, StoryObj } from '@storybook/react';
import { Stat, StatGroup } from './Stat';

const meta = {
  title: 'Primitives/Stat',
  component: Stat,
  args: { label: 'Deposit', value: '500 dUSDC' },
} satisfies Meta<typeof Stat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Group: Story = {
  render: () => (
    <div style={{ width: 520 }}>
      <StatGroup>
        <Stat label="Deposit" value="500 dUSDC" />
        <Stat label="Reward" value="+12.4 dUSDC" sub="8.2% APR" />
        <Stat label="Settles" value="in 5d 4h" />
      </StatGroup>
    </div>
  ),
};
