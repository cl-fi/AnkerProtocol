import type { Meta, StoryObj } from '@storybook/react';
import { InputField } from './Field';

const meta = {
  title: 'Primitives/InputField',
  component: InputField,
} satisfies Meta<typeof InputField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Labeled: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <InputField label="Amount" suffix="dUSDC" type="number" defaultValue={5} />
    </div>
  ),
};

export const WithHint: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <InputField label="Buy Low price" suffix="3.2% below" type="number" defaultValue={62500} />
    </div>
  ),
};
