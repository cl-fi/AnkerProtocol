import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook scoped to the design-system primitives in src/ui only — it does NOT
 * pull in the Next app, the Sui wallet, or react-query. This is also the input
 * the design-sync skill consumes (the .storybook/ dir makes it the storybook shape).
 */
const config: StorybookConfig = {
  stories: ['../src/ui/**/*.stories.@(ts|tsx)'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  // The src/ui components use JSX with the automatic runtime (no `import React`,
  // matching the Next app). Force esbuild to the automatic runtime here too, or
  // Storybook's Vite falls back to classic React.createElement → "React is not
  // defined" at runtime (the repo tsconfig uses jsx: "preserve" for Next).
  async viteFinal(viteConfig) {
    const { mergeConfig } = await import('vite');
    return mergeConfig(viteConfig, {
      // Force the automatic JSX runtime for our SOURCE (.tsx files use no
      // `import React`; the repo tsconfig sets jsx:"preserve" for Next, which
      // would otherwise leave JSX untransformed → "React is not defined").
      esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
      // Pre-bundle React so its CommonJS default export gets proper ESM interop
      // in dev. Do NOT set optimizeDeps.esbuildOptions.jsx here: applying the
      // JSX transform while pre-bundling React breaks its default export
      // ("react … does not provide an export named 'default'") and the preview
      // iframe renders blank with an endless spinner.
      optimizeDeps: { include: ['react', 'react-dom', 'react/jsx-runtime'] },
    });
  },
};

export default config;
