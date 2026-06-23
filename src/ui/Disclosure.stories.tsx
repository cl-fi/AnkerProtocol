import type { Meta, StoryObj } from '@storybook/react';
import { Disclosure } from './Disclosure';
import { KeyValue, KeyValueList } from './KeyValue';

const meta = {
  title: 'Primitives/Disclosure',
  component: Disclosure,
  args: { summary: 'On-chain proof', children: 'Details' },
} satisfies Meta<typeof Disclosure>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div style={{ width: 420 }}>
      <Disclosure summary="On-chain proof" defaultOpen>
        <KeyValueList>
          <KeyValue label="Position ID" value="0xab…cd12" />
          <KeyValue label="Oracle" value="0x12…ef34" />
        </KeyValueList>
      </Disclosure>
    </div>
  ),
};
