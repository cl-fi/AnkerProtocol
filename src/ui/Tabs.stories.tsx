import type { Meta, StoryObj } from '@storybook/react';
import { Tab, Tabs } from './Tabs';

const meta = {
  title: 'Primitives/Tabs',
  component: Tabs,
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs aria-label="Direction">
      <Tab active>Buy Low</Tab>
      <Tab disabled>Sell High</Tab>
    </Tabs>
  ),
};
