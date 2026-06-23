# design-sync notes — Anker Protocol Design System

Project: `1802f7a4-b9fe-4e53-9b29-2a053beb279f` (claude.ai/design)
Shape: **storybook** (`.storybook/` at repo root, `@storybook/react-vite`)
Components: 8 primitives in `src/ui/` — Button, Card, Badge, Stat, KeyValue, Disclosure, InputField, Tabs.

## How this repo is made syncable

This is a **Next.js app**, not a published component library — the primitives live as
TS source in `src/ui/` with **no build that emits declarations**. The converter discovers
components (and their prop types) from a package's shipped `.d.ts`. So we generate one:

- `[GENERAL]` `cfg.buildCmd = "node .design-sync/build-ds-pkg.mjs"` compiles `src/ui/` into a
  self-contained package at **`dist/ui/`** (JS + `.d.ts` + `package.json` name `@anker/ui`)
  via `tsc -p .design-sync/tsconfig.dspkg.json` (jsx: react-jsx, declaration: true).
  `dist/` is gitignored, so the output is transient and regenerated on every sync.
  **No repo source files are modified** — the generated package is the only build artifact.
- `cfg.entry = "dist/ui/index.js"` → PKG_DIR becomes `dist/ui`, whose package.json supplies
  name/version/types. This is what lets `exportedNames()` find the 11 PascalCase exports
  (Button, Card, Badge, Stat, StatGroup, KeyValue, KeyValueList, Disclosure, InputField,
  Tabs, Tab) so the 8 storybook titles map to public exports.
- Story files import components via **relative** paths (`./Button`); the preview redirect
  (story-imports rule 2) keys off the exported NAME set, not PKG_DIR, so previews correctly
  render `window.AnkerUI.*` regardless of where PKG_DIR points.
- Story titles (`Primitives/Button`, …) match export names 1:1 → no `titleMap` needed.
- `KeyValueList`, `StatGroup`, `Tab` are exported (on the global, usable by the design agent)
  but have no stories of their own → no cards; they appear inside KeyValue/Stat/Tabs stories.

## Fonts

- `Geist` + `GeistMono` ship as local woff2 (`fonts/`), scraped from sb-reference.
- `Fredoka` (the brand **display** font, `--font-display`) loads via a Google Fonts
  `@import url(...)` preserved at line 1 of `_ds_bundle.css` → validate reports `[FONT_REMOTE]`
  (acceptable). Verified Fredoka actually loads in the preview render
  (`document.fonts.check('700 16px Fredoka') === true`), so previews are faithful and shipped
  designs get Fredoka at runtime (Google Fonts egress required, which claude.ai/design has).

## CSS

- The DS styling lives in one large `src/styles.css` (4280 lines) + `tokens.css` + `button.css`
  + `badge.css`, all `@import`ed by `app/globals.css`, which `.storybook/preview.ts` imports.
  Converter scrapes the compiled closure from sb-reference (`[CSS_FROM_STORYBOOK]`).
- `[CSS_ASSETS]` warns that `../anker-logo.png` and `#returnPathFade` url()/fragment refs in
  the scraped CSS won't resolve post-upload. None of the 8 primitives use these, so it's
  cosmetic for unrelated app classes carried along in the big stylesheet.

## First sync result (2026-06-23)

- 8/8 components graded **match** (every story), validate exits clean, driver verdict
  `ok: true` with `pendingGrade: []`. All carried forward on the receipt build (0 cleared).
- No owned previews, no `provider`, no `titleMap`, no `overrides` — the defaults fit once
  the generated `dist/ui` package supplies declarations.

## Re-sync risks (watch-list for the next run)

- **Fredoka is CDN-loaded (`[FONT_REMOTE]`).** The compare needs Google Fonts egress or the
  preview falls back to Geist (display font wrong). This run verified Fredoka actually loads
  (`document.fonts.check('700 16px Fredoka') === true`). If a future compare shows the wrong
  display font, it's egress, not a real regression — re-run with network access.
- **Component discovery = exports of `src/ui/index.ts`.** A new primitive that isn't re-exported
  there won't be discovered (and won't get a `dist/ui` declaration). Keep `index.ts` current.
  After re-sync, sanity-check the build log shows `[DTS] parsed 9 .d.ts` and `components: 8`
  (or the new count).
- **`dist/ui` is generated + gitignored.** Fresh clone needs: `.ds-sync` deps + chromium,
  `.design-sync/sb-reference` rebuilt, and `buildCmd` (the driver runs it). `tsc` uses
  `noEmitOnError:false`, so a type error in `src/ui` yields partial `.d.ts` silently — if a
  component's prop card goes empty, check `dist/ui/<Name>.d.ts`.
- **Sub-components without stories** (StatGroup, KeyValueList, Tab) ship on the global but have
  no cards; they're only verified indirectly through their parent stories.
- **Story content is static** (no `new Date()`/random), so grades are stable across captures.
