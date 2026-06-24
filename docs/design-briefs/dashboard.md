# Design brief — Dashboard

> Paste this into a **new Design** in Claude Design that uses the **Anker Protocol
> Design System**. It tells the design agent what to build, with which of our
> components, and what content/states to cover. Style (colors, the "sticker" look,
> Fredoka font) comes from the design system automatically — don't re-specify it.

## Product context
Anker is a self-custodial "Dual Investment" (Buy Low / Sell High) product on Sui.
Users deposit dUSDC into a position; if the market doesn't hit their target price
they keep the deposit + a reward (coupon/APR); if it does, the deposit converts at
the price they chose. The **Dashboard** is where a connected user sees all their
positions, what each will pay, and claims cash once a position settles.

**Build with our components** (from the Anker Protocol Design System): `Button`,
`Card`, `Badge`, `Stat` + `StatGroup`, `KeyValue` + `KeyValueList`, `Disclosure`,
`Tabs` + `Tab`. Don't invent new component styles — compose these.

## Page layout (top to bottom)

### 1. Top nav (full width)
- Left: brand "**Anker Protocol**" with a small anchor mark.
- Center: product links — "Dual Investment" and "Dashboard" (**Dashboard active**).
- Right: a "Connect Wallet" button (wallet area).

### 2. Hero
- `H1`: **Dashboard**
- Subtitle: "See your positions, what they'll pay, and claim your cash once they settle."
- Right-aligned **primary `Button`** with a refresh icon: "**Refresh**".

### 3. Portfolio summary (only when connected with open positions)
A row of three metrics (use `StatGroup` + `Stat`):
- Total deposited — **1,250 dUSDC**
- Expected rewards — **+103.6 dUSDC** (this is the highlighted/accent number)
- Open positions — **3**

### 4. Positions area
Section heading row: `H2` "**Your positions**" + a `Badge` (tone `positive`) "**3 positions**".

Filter tabs (use `Tabs`/`Tab`, show only when ≥2 status buckets are non-empty) —
each tab shows a count:
`All (3)` · `Ready to claim (1)` · `Active (2)` · `Completed (0)` — "All" active by default.

Then a **responsive grid of position cards** (see next section). 2 columns on desktop, 1 on mobile.

## The position card (the core element — design this carefully)
Use `Card` (as an article). One card per position. Example content:

- **Header row**: title "**Buy Low BTC**" + a muted strike line "**@ $62,500**" on the
  left; a status `Badge` on the right. Status varies by lifecycle:
  - `Ready to claim` → tone `positive`
  - `Active` → tone `warning`
  - `Settling` → tone `positive`
  - `Action needed` → tone `danger`
  - `Completed` → tone `neutral`
- **`StatGroup`** (3 stats):
  - Deposit — **500 dUSDC**
  - Reward — **+12.4 dUSDC**, sub line "**8.2% APR**"
  - Settles — "**in 5d 4h**"
- **Outcome explainer**: a shield-check icon + this text:
  "If BTC is at or above $62,500 when it settles, you keep your deposit plus the
  reward. If it ends lower, your deposit buys BTC at $62,500 — the price you chose."
  with a smaller caption below: "On testnet this settles in dUSDC; on mainnet,
  positions settle in real wrapped BTC."
- **Claim action**: when status is "Ready to claim", show a primary `Button` "**Claim
  your cash**"; when "Active", show a subtle disabled/secondary state (e.g. "Settles in 5d 4h").
- **`Disclosure`** labeled "**On-chain proof**" → inside, a `KeyValueList` of proof rows:
  - Position ID → `0xab…cd12` (link style)
  - Container check → "**Manager verified**" (tone good / green)
  - Container balance → 1,020.4 dUSDC
  - Oracle → `0x12…ef34` (link style)
  - Your price → $62,500
  - Floor → $58,000
  - Backing ratio → **103.2%**
  - Payout range → 488 – 512 dUSDC

Show **3 example cards** in the grid with different statuses so the design covers the
variants: one "Ready to claim" (with the Claim button), one "Active", one "Completed".

## States to also design (each replaces the positions area)
Use a single `Card` for each:
- **No wallet** — `Card` variant `empty`: "Connect your wallet to see your positions."
- **Loading** — `Card` variant `empty`: "Loading your positions…"
- **Error** — `Card` variant `error`: "Unable to load your positions."
- **Empty (connected, none yet)** — `Card` variant `empty`: "No positions yet for
  0xab…cd12. Open a Buy Low position to get started."

## Deliverables
1. The main **populated** Dashboard (nav + hero + portfolio summary + filters + 3 cards).
2. The 4 state variants above.
Keep everything composed from the design-system components and tokens.
