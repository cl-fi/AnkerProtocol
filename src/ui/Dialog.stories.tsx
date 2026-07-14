import type { Meta, StoryObj } from '@storybook/react';
import { Dialog } from './Dialog';

const meta = {
  title: 'Primitives/Dialog',
  component: Dialog,
  args: {
    open: true,
    ariaLabel: 'Example dialog',
    closeLabel: 'Close',
    onClose: () => undefined,
    children: (
      <>
        <h3 style={{ marginTop: 0 }}>Subscription confirmed</h3>
        <p>Your Note is live — it now appears in your Portfolio.</p>
      </>
    ),
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
