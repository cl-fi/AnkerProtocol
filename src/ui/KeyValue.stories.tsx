import type { Meta, StoryObj } from '@storybook/react';
import { KeyValue, KeyValueList } from './KeyValue';

const meta = {
  title: 'Primitives/KeyValue',
  component: KeyValue,
  args: { label: 'Position ID', value: '0xab…cd12' },
} satisfies Meta<typeof KeyValue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {
  render: () => (
    <div style={{ width: 520 }}>
      <KeyValueList>
        <KeyValue label="Position ID" value="0xab…cd12" />
        <KeyValue label="Container check" value="Manager verified" tone="good" />
        <KeyValue label="Backing ratio" value="103.2%" />
        <KeyValue label="Container" value="Not found" tone="warn" />
      </KeyValueList>
    </div>
  ),
};
