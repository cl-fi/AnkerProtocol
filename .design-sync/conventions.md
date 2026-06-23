## Anker UI — how to build with these components

Anker's "sticker" design system: chunky navy outlines, hard offset shadows, a
cream canvas, a gold accent, and the rounded **Fredoka** display font. Build with
the real components below; do your own layout with the CSS variables (tokens) the
system already defines. There is **no Tailwind / utility-class system** here — and
no theme provider.

### Setup & wrapping
- **No provider, no context, no client-only setup.** Every component is a pure
  presentational primitive (props in → markup out). Render them directly.
- Styling comes entirely from the bound `styles.css` closure (tokens + component
  CSS) plus fonts. Fonts are wired for you and all ship as local `@font-face`
  files (`Geist`, `GeistMono`, and the `Fredoka` display font). Just use the
  components and the tokens.

### Styling idiom — props, then tokens (never utility classes)
- **Style components through their PROPS**, not classes: `variant`, `tone`, `size`,
  `label`, `suffix`, `as`. The look is fixed by the design system.
- **For your own layout/containers, use the design tokens** via `var(--*)` — do not
  invent colors, radii, or shadows. The vocabulary:
  - Color: `--cream` (page bg), `--paper` (raised surface), `--navy` (ink/border),
    `--gold` (accent), `--grass` (positive), `--coral` (danger), `--ink`,
    `--ink-soft` (muted). Tints: `--gold-tint`, `--grass-tint`, `--coral-tint`.
  - Semantic aliases: `--color-accent`, `--color-on-accent`, `--surface-raised`,
    `--surface-accent-soft`, `--border-strong`.
  - Spacing (4px scale): `--space-1`…`--space-6`, `--space-8`.
  - Type: `--font-display` (Fredoka, for headings/labels), `--font-sans` (Geist,
    body), `--font-mono` (GeistMono, numbers/addresses).
  - "Sticker" chrome: `--bw` (2px border), `--bw-thick` (3px), `--r` (16px radius),
    `--r-sm` (12px), `--shadow-hard` (`4px 4px 0 var(--navy)`), `--shadow-hard-sm`,
    `--focus-ring`.
- Each component also exports a `*ClassName()` helper (`buttonClassName`,
  `cardClassName`, `badgeClassName`, `tabClassName`) so a non-component element
  (e.g. a link styled as a button) can wear the same look:
  `<a className={buttonClassName({ variant: 'primary' })}>Launch</a>`.

### The components
- **Button** — `variant: 'primary'|'secondary'`, `size: 'sm'|'md'`, native button props.
- **Card** — sticker surface. `variant: 'default'|'empty'|'error'`, `as: 'div'|'article'|'section'`.
- **Badge** — pill status. `tone: 'neutral'|'positive'|'warning'|'danger'`; label is children.
- **Stat** + **StatGroup** — metric tiles: `<StatGroup>` wraps `<Stat label value sub? />`.
- **KeyValue** + **KeyValueList** — key→value rows: `<KeyValueList>` wraps
  `<KeyValue label value tone? />` (`tone: 'good'|'warn'|'neutral'`).
- **Disclosure** — native `<details>` with sticker chrome + chevron: `summary`,
  `children`, `defaultOpen?`.
- **InputField** — bordered input with optional `label` and trailing `suffix`/unit.
- **Tabs** + **Tab** — pill tab bar: `<Tabs>` wraps `<Tab active?>…</Tab>`.

### Where the truth lives
Read the bound `styles.css` and its `@import`ed token/component CSS for exact
values, and each component's `.prompt.md` / `.d.ts` for its full API before styling.

### Idiomatic example
```jsx
<Card as="article">
  <Tabs>
    <Tab active>Buy Low</Tab>
    <Tab>Sell High</Tab>
  </Tabs>
  <StatGroup>
    <Stat label="Deposit" value="500 dUSDC" />
    <Stat label="Reward" value="+12.4 dUSDC" sub="8.2% APR" />
  </StatGroup>
  <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
    <Badge tone="positive">Ready to claim</Badge>
    <Button variant="primary">Subscribe Buy Low</Button>
  </div>
</Card>
```
