# Anker Protocol

**Self-custody Binance-style Dual Investment on Sui, powered by DeepBook Predict.**

![Anker live APR benchmark versus Binance](docs/screenshot-apr.png)

Anker rebuilds Binance-style Dual Investment as a self-custodial Sui product:
users can take a BTC Buy Low position with dUSDC, see the reward before
signing, compare the quote against Binance, and inspect the exact DeepBook
Predict legs behind the APR.

> I have USDC. I want to buy BTC lower. Show me the reward, the risk, and the
> construction before I sign.

**Live benchmark snapshot:** in the screenshot above, every visible matched BTC
Buy Low row shows a positive edge. Across those targets, Anker is roughly
**15-29 APR points above Binance** while keeping the product self-custodial,
transparent, and verifiable on Sui. The 63,500 target shows **118.41% Anker APR
vs. 94.07% Binance APR**, a **+24.34 APR-point** edge.

This is a live, market-dependent comparison, not a promised fixed spread. The
point is that Anker makes the edge visible in the product: for each matched row,
users see Anker APR, Binance APR, and the APR-point difference before deciding.

Live on Sui testnet. First product: **BTC Buy Low**, denominated in dUSDC.

---

## Why it matters

Binance has already proved demand for Dual Investment. Users understand the job:
pick a target BTC price, pick a settlement date, and earn a coupon for waiting.
The category is real; the weak points are custody, opacity, and trust.

Anker keeps the familiar CEX flow and replaces the trust layer:

- **Self-custody** — funds stay in a wallet-owned product container, not a CEX account.
- **Transparent APR** — every quote is compiled from DeepBook Predict legs with live quote previews.
- **Live CEX benchmark** — the UI shows Anker APR, Binance APR, and Edge side by side.
- **On-chain proof** — each subscription mints a wallet-owned `ProductNote` with terms, costs, expiry, fee snapshot, and status.
- **Aligned revenue** — Anker charges a transparent performance fee on coupon actually earned.

## Why Anker can beat Binance

Dual Investment yield is option premium. On a CEX, the exchange packages that
premium into a coupon and keeps an opaque spread. Anker sources the same
economic exposure from DeepBook Predict, assembles the payoff from market-priced
on-chain legs, and shows the construction before the user signs.

That does not mean Anker always wins every row. It means the product has a real
reason to often price better: fewer hidden margins, an explicit fee model, and a
live comparison that makes spread visible.

## Anker vs. CEX Dual Investment

| Question | Binance-style Dual Investment | Anker Protocol |
| --- | --- | --- |
| Who holds the funds? | The exchange | The user's wallet-owned product container |
| How is APR produced? | Opaque exchange quote | DeepBook Predict legs priced with live quote previews |
| Can users benchmark it? | Not inside the product | Live `Anker APR / Binance APR / Edge` table |
| Can users verify the position? | Off-chain account entry | On-chain `ProductNote`, events, and explorer links |
| How does the protocol earn? | Hidden spread and exchange margin | Explicit performance fee on coupon earned |

---

## The product: BTC Buy Low

Anker V1 is a dUSDC-denominated **BTC Buy Low Dual Investment**.

**What the user enters:**

- **Amount** — subscription size in dUSDC.
- **Buy Low price** — the target BTC price, below current spot.
- **Settlement date** — chosen from live-ready DeepBook Predict oracle expiries.
- **Payoff smoothness** *(advanced)* — a 3 / 6 / 9 Predict-leg preset (default 6) controlling ladder granularity.

The **floor price is not a user input.** Anker derives it from the Buy Low price, snaps it to the live oracle strike grid, and uses it to size the cash reserve. Less for the user to get wrong.

**The journey, end to end:**

```text
1.  Open Anker, choose BTC Buy Low.
2.  Scan the Price & APR reference table — compare targets, Anker net APR,
    live Binance APR, and Edge in percentage points.
3.  Tap a target price to load it into the Buy Low builder.
4.  Set the dUSDC amount and settlement date.
5.  Review payoff scenarios, quote freshness, liquidity, and risk fields.
6.  Expand the legs to inspect every DeepBook Predict position.
7.  Create a wallet-owned product container (one tx) if you don't have one.
8.  Subscribe with a wallet transaction.
9.  Receive a ProductNote that records every term of the trade.
10. Track it in the dashboard.
11. Claim dUSDC after expiry.
```

A normal user can stay entirely at the Dual Investment layer. An advanced user can open the leg disclosure and audit the exact construction.

**What the user gets at settlement:**

- If BTC stays above the target region, they keep their dUSDC **plus the coupon**.
- If BTC settles into the buy-low region, they get the cash-settled payoff for the intended buy-low exposure.
- On current testnet this **claims dUSDC rather than delivering BTC** — there's no clean dUSDC→DBTC route yet, and the UI says so explicitly instead of pretending the production delivery path exists.

This is a structured product with defined payoff behavior, not a risk-free savings account. Anker's job is to show the quote, the construction, the risk, and the settlement path **before** the user commits.

---

## How the quote is built

Every reward number in the app is compiled from real DeepBook Predict legs — never a guess. For a product with principal `P`, target Buy Low price `T`, and auto-derived floor `F`:

1. Target BTC amount: `Q = P / T`.
2. Reserve cash for the floor: `reserve = Q * F`.
3. Build a ladder of Predict **UP** legs from `F` to `T`, every strike aligned to the live oracle grid.
4. Size each leg's dUSDC payout quantity as `Q * width`, where `width` is that leg's strike interval.
5. Price every leg with a **live DeepBook Predict quote preview** through Sui `devInspect`.
6. Compute the coupon and the net APR after fee.

```text
total leg cost = sum of live ask costs
coupon         = principal - reserve - total leg cost
gross_APR      = coupon / principal * 365 / days_to_expiry
net_APR        = gross_APR * (1 - protocol_fee_bps / 10000)
```

`net_APR` is the number shown everywhere: reference table, preview, confirmation panel, and dashboard. The dashboard computes each note's reward from the **fee snapshot stored in that ProductNote**, not a mutable current setting.

The quote model is layered for honesty:

- An **instant local Estimate** for fast browsing.
- Upgraded to a **verified Live quote** (badge) priced against the chain.
- **Subscription is only enabled on a matched, executable live quote.** Legs that can't be live-quoted fall back to a clearly-marked, non-executable snapshot — never a fake APR.

---

## The business model — real revenue, surfaced honestly

Anker charges a **performance fee — a protocol fee on the coupon, default 1000 bps = 10%.** It only ever applies to coupon actually earned, and it's exactly the gap between the gross APR and the net APR the user sees — so the user is never surprised, and the headline number is always the take-home number. For context, that single transparent cut is materially smaller than the combined, invisible margin a CEX bakes into its Dual Investment quote.

- The fee lives in the on-chain **Registry** (`Registry.fee_bps`), administrable via `AdminCap`.
- It's captured at claim time through `record_redeem_with_fee`, which routes the fee to the registry's fee recipient.
- Each `ProductNote` stores its **own `fee_bps` snapshot**, so the dashboard computes each position's reward from the fee that applied at subscription.

The incentive alignment is the pitch: **Anker only earns when it actually sources a coupon for the user.** No coupon, no fee. Revenue scales directly with delivered value, and it's enforced on-chain rather than promised.

---

## Who buys this, and why now

**Who:**

- CEX-style structured-yield buyers who want the same product without giving up custody.
- BTC holders running target-buy / target-sell strategies.
- DeFi users looking for transparent, self-custody yield.
- Protocols that want auditable structured-note inventory to build on.

**Why now:** DeepBook Predict newly exposes on-chain BTC oracles, rolling expiries, strike grids, and volatility-based digital-option pricing **and settlement**. For the first time it's possible to construct a CEX-grade structured product entirely on-chain, with live quotes. The primitives exist; what's missing is the product and distribution layer that turns them into something a normal user understands. **That layer is Anker.**

---

## What's live today

This isn't a mockup — the full path works end to end on Sui testnet.

- **Next.js app**: landing page, Dual Investment workspace, dashboard.
- **Live BTC oracle discovery** via a narrow Predict API wrapper (8s timeout, 1 MB cap, cache headers, per-client rate limit; only proxies the endpoints the app uses).
- **Product compiler**: Buy Low → Predict legs, with live `devInspect` quote previews and full risk fields (min payout, max loss, option budget, holding-period return, quote TTL, liquidity status, max-cost slippage).
- **Live Binance benchmark** with `Est. APR / Binance APR / Edge` columns.
- **Wallet flow**: create a PredictManager container → subscribe → mint a ProductNote.
- **Event-indexed dashboard** with claim + settlement states and Sui explorer links.
- **ProductNote Move package deployed on Sui testnet.**
- **7 static lint guardrails** across frontend / contract / tests / scripts / README, plus CI: `lint → unit → move test → next build → playwright e2e` (fail-fast).

---

## The Sui / DeepBook Predict integration

Anker uses DeepBook Predict in four places, and leans on Sui's primitives for custody and proof.

### 1. Oracle discovery
A Next.js API wrapper filters BTC oracles to product-ready markets: active oracle, valid expiry, spot and forward available, SVI state available, enough time remaining. The settlement-date picker uses these **live-ready expiries**, not free-form dates.

### 2. Product construction
The compiler maps the user's Buy Low terms into Predict UP leg intents, aligns strikes to the oracle grid, and derives the floor/reserve path from the selected target.

### 3. Quote preview
Quote previews are batched through Sui `devInspect`. Each leg returns strike, direction, payout quantity, ask cost, executable status, quote timestamp, and an error state when unavailable. The preview also surfaces min payout, max loss, option budget, holding-period return, net APR after fee, quote TTL, liquidity status, and the max-cost slippage limit.

### 4. Execution, custody, and on-chain proof

**Self-custody by construction.** The user first creates a wallet-owned **product container** — a dedicated DeepBook `PredictManager` (via `create_manager`, a separate wallet tx). Subscribe uses an unallocated, wallet-owned container, deposits principal, mints the Predict legs, and creates an Anker `ProductNote` bound to that container. It **fails closed** if no container exists — never silently grabs someone else's.

**A real signing gate.** Subscription is fronted by a short-lived `QuoteEnvelope` (30s TTL) with a signing-time re-quote of the exact legs, max-quoted-cost bounds, a minimum-accepted-coupon floor, and transaction preflight. (DeepBook Predict mint has no atomic max-cost parameter in this app, so Anker uses TTL + re-quote + preflight rather than overclaiming full on-chain price protection.)

**The ProductNote is the proof.** It's a Move object owned by the user's wallet that records principal, reserve, coupon, target/floor price, `apr_bps`, `fee_bps`, expiry, strikes, quantities, costs, status, and redeemed payout/fee. It is a wallet-owned **strategy receipt** — honestly, not yet a transferable or pooled vault share.

**The dashboard reads the chain.** It's event-indexed (paginating ProductNote Move events by type, indexed by note / owner / manager) into lifecycle buckets — Ready to claim / Active / Completed — with a portfolio summary (Total deposited / Expected rewards / Open positions), product-container dUSDC balance and held legs, backing ratio, a **settlement-blocked safety state on partial backing**, and Sui explorer (`testnet.suivision.xyz`) links for every object and transaction. Claim redeems open legs before withdrawing dUSDC, or withdraws directly if the legs were already redeemed permissionlessly.

```mermaid
flowchart LR
  A["User: I have USDC,<br/>I want BTC lower"] --> B["Anker App"]
  B --> C["BTC Oracle Filter"]
  B --> D["Buy Low Builder"]
  D --> E["Predict Leg Basket"]
  E --> F["Sui devInspect<br/>Quote Preview"]
  F --> G["Net APR + Risk"]
  B --> X["Live Binance<br/>Benchmark"]
  X --> G
  B --> H["Wallet Tx"]
  H --> I["PredictManager<br/>Product Container"]
  H --> J["Anker ProductNote"]
  J --> K["Dashboard"]
  I --> K
  K --> L["Claim dUSDC"]
```

---

## Honest risks and scope

A product that shows its risk is more credible than one that hides it behind a higher APR headline. The app states all of this explicitly:

- **Settlement risk is real.** Dual Investment has downside settlement risk; this is not guaranteed yield.
- **APR is live, not promised.** The benchmark table shows current matched quotes and updates as DeepBook Predict and Binance pricing move.
- **Quotes can expire** before signing, and some legs can become non-executable on liquidity or mint bounds.
- **Testnet is cash-settled.** The flow claims dUSDC, **not** delivered BTC — there's no clean dUSDC→DBTC route yet, and the UI says so.
- **ProductNotes are receipts, not shares.** They're wallet-owned today, not transferable or pooled vault shares; custody is a dedicated wallet-owned PredictManager, not pooled custody.
- A Current.finance USDsui APR benchmark exists in code but is **behind a flag** (`ENABLE_EXPERIMENTAL_PRODUCTS`) and **not live in the UI** today.

---

## Roadmap

**1. Sharper benchmarking.** Build on the live Binance check: show target-discount and settlement-date matching quality, separate "benchmark unavailable" from "no edge," put holding-period return beside annualized APR, expose liquidity and freshness per row, and add historical snapshots so users can see how often an edge appears. Turn comparison into a decision tool.

**2. Sell High and a product shelf.** Next product is **BTC Sell High** (BTC collateral in, stablecoin out at the target). Then Discount Buy / Premium Sell notes, principal-protected range yield, capped participation notes, auto-roll series, and institutional quote screens across targets and expiries.

**3. Production BTC delivery.** V1 is cash-settled in dUSDC. Production adds native BTC-settled Predict support and/or DeepBook DBTC↔dUSDC conversion with slippage limits, unlocking collateralized Sell High once settlement routing is clean.

**4. Tokenized notes and vault shares.** Once container ownership and production settlement stabilize, ProductNotes become tokenized strategy shares — pooled series, auto-roll keepers, management/performance fees, and composability with Sui lending, margin, and portfolio protocols.

**5. Distribution.** The thesis isn't to make users learn DeepBook Predict — it's to meet them where they are: CEX-style yield buyers, self-custody DeFi users, BTC target-buy/sell holders, and protocols that want transparent structured-note inventory. DeepBook Predict is the substrate; **Anker is the product layer.**

---

## Appendix

### On-chain contract (Sui testnet)

The Move package lives in `contracts/anker_protocol`.

```text
Network:      Sui testnet
Package ID:   0xf8fc120ddb43b29bab88fb42588f94db9d1af34164969d2d76400f068c5a7640
Registry ID:  0xf9d64b058a640f05a7f2c7ec3e289399c41124900f9e6dc73840cf96df7bb63c
AdminCap ID:  0xdb8b99921a44c216c5c864ddec9df21bfb4a09cc0d97287e4940e6be615c2478
Digest:       BoKKnVdeKccDh9C1W1huPsvBDmojH3qLMR3CMKnfkhHU
```

The contract provides the `Registry` (fee policy, default 10%), `AdminCap`, `ProductNote`, the events `FeePolicyUpdated` / `ProductSubscribed` / `ProductRedeemed`, and fee capture on claim. Two product kinds exist (Dual Investment = 0, Shark Fin = 1); **Shark Fin is contract-only** and blocked from live frontend paths by lint guardrails.

The testnet contract is deliberately scoped: it records product terms, fee policy, lifecycle status, and the PredictManager relationship as a wallet-owned strategy receipt, while leaving Predict position custody with the user's PredictManager. It is not yet a trustless pooled vault — a deliberate choice while DeepBook Predict's manager model evolves.

### Routes

```text
/                      Landing page
/app                   Alias → same workspace page
/app/dual-investment   BTC Buy Low Dual Investment (hourly + day tenors)
/app/dashboard         Wallet ProductNote dashboard
/app/multi-day         Legacy redirect → /app/dual-investment (merged page)
/dual-investment       Legacy redirect → /app/dual-investment
```

### Run locally

```bash
npm install
npm run dev
# → http://127.0.0.1:3000
```

Environment variables are optional overrides — values fall back to committed testnet defaults in `src/config/*` and `contracts/anker_protocol/deployments/testnet.json`.

```text
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_DEEPBOOK_PREDICT_PACKAGE_ID=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
NEXT_PUBLIC_DEEPBOOK_PREDICT_OBJECT_ID=0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
NEXT_PUBLIC_ANKER_PACKAGE_ID=0xf8fc120ddb43b29bab88fb42588f94db9d1af34164969d2d76400f068c5a7640
NEXT_PUBLIC_ANKER_REGISTRY_ID=0xf9d64b058a640f05a7f2c7ec3e289399c41124900f9e6dc73840cf96df7bb63c
NEXT_PUBLIC_ANKER_ADMIN_CAP_ID=0xdb8b99921a44c216c5c864ddec9df21bfb4a09cc0d97287e4940e6be615c2478
NEXT_PUBLIC_ANKER_DEMO_MODE=false
```

`NEXT_PUBLIC_ANKER_DEMO_MODE=true` puts the app in demo-data mode: market data, quotes, and the manager list are served from deterministic fixtures, a demo banner is shown on every app page, and every transaction entry point is disabled (the transaction builders also refuse to build plans as a backstop). Use it while the DeepBook Predict testnet deployment the app targets is unavailable — e.g. during the current 4-16 → 6-24 migration. It's a build-time flag: redeploy after changing it.

The `/api/predict/[...path]` wrapper is intentionally narrow: it only proxies the Predict endpoints the app uses, with an 8s upstream timeout, a 1 MB response cap, cache headers, and a basic per-client rate limit.

### Verify

```bash
npm run ci
```

`npm run ci` runs `lint → test:unit → test:move → build → test:e2e` (fail-fast). `npm run lint` includes Anker-specific guardrails that block misleading or unsafe patterns: first-manager selection, public `ProductNote` constructors, transferable `ProductNote`s, principal-plus-coupon settlement shortcuts, preview-only execution in live paths, live Shark Fin frontend paths, and unsafe number-to-bigint conversion.

### References

- Source: https://github.com/cl-fi/AnkerProtocol
- Binance Dual Investment category: https://www.binance.com/en/dual-investment
- DeepBook Predict docs: https://docs.sui.io/onchain-finance/deepbook-predict/
- DeepBook Predict testnet server: https://predict-server.testnet.mystenlabs.com
