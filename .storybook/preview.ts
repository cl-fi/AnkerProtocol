import type { Preview } from '@storybook/react';

// Font variables first, then the full token + component stylesheet closure
// (app/globals.css @imports src/styles.css + the src/ui/*.css token & component files).
import './preview-fonts.css';
import '../app/globals.css';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: { expanded: true },
  },
};

export default preview;
