# Anker Protocol

Non-custodial structured yield products (dual investment, shark fin) on Sui, built on DeepBook Predict's range-digital option markets.

## Language

### Products

**Dual Investment (双币投资)**:
Anker's flagship structured product: deposit quote asset, pick a target price and tenor; at expiry the deposit either converts at the target price or is returned, and the coupon is paid either way. Mirrors the CEX product of the same name. A single product whose tenor list spans hourly to day-scale; hourly tenors show per-period yield with at most a muted reference APR (ADR-0002), and minute-level tenors are deliberately not offered.
_Avoid_: dual currency, DCI, 双币盈 (Binance brand name — use only when citing Binance), Turbo (retired name for the hourly tenors — no longer a separate product line)

**Shark Fin (鲨鱼鳍)**:
Principal-protected range product: enhanced coupon if price stays inside a bound, base coupon otherwise.

**Tenor (期限)**:
Time from subscription to expiry of a product. Dual Investment tenors run from hourly to day-scale (1d–14d); day-scale is the primary offering, and hourly stays tradable even when day-scale live markets are unavailable. A market's shelf follows its remaining tenor: at least a day remaining sells on the day shelf, under a day on the hourly shelf — a day-born market that decays below one day is offered as an hourly product (per-period yield, like its shelf-mates) while it can still quote. Minute-level tenors are never offered.
_Avoid_: duration, term, expiry length

### Lifecycle

**Subscribe (订阅)**:
A user enters a product: deposits principal and receives a Note in one transaction.
_Avoid_: buy, invest, mint (mint refers to the underlying Predict legs)

**Note (产品凭证)**:
The on-chain receipt for one subscription; records the product terms and the underlying legs. Owned by the subscriber.
_Avoid_: position, receipt, ticket

**Leg (腿)**:
One DeepBook Predict order minted as part of a subscription. A product subscription is composed of one or more legs.
_Avoid_: option, bet

**Settlement (结算)**:
The moment the underlying expiry market fixes its settlement price after expiry. Settlement is protocol-side and permissionless; it is not an Anker action.

**Claim (领取)**:
The user (or a keeper on their behalf) redeems the settled legs and withdraws principal plus payout, closing the Note.
_Avoid_: redeem (reserved for the Predict-level leg operation), withdraw

### Benchmarking

**Benchmark (基准)**:
The comparable Binance Dual Investment product for an Anker quote row: same target price, nearest settlement time, and currently on sale — a halted product is no benchmark, exactly as if it did not exist. Surfaced as the "nearest-expiry Binance APR" (最近到期 Binance APR), always shown with the Benchmark's own settlement time and tenor; the settlement offset is disclosed alongside Edge — never used to suppress a comparison.
_Avoid_: competitor quote, reference product, same-day match (retired rule — calendar-date matching rejected fairer nearest matches)

**Edge (领先幅度)**:
Anker net APR minus Benchmark APR for the same matched row, in percentage points; positive means Anker leads. Defined only where a Benchmark match exists.
_Avoid_: spread, premium

**Benchmark Sample (基准采样)**:
One recorded comparison for one day-tenor ladder row at one instant: the Anker quote, the Benchmark result (or its absence), and the data-source condition at that moment.
_Avoid_: snapshot / 快照 (reserved for the day-browse fallback photograph)

**Run (采样轮)**:
One scheduled sweep that records Benchmark Samples across the whole day-tenor ladder. Degraded or failed sweeps are recorded as such, never silently skipped.

**Benchmark Recorder (基准记录器)**:
The subsystem that executes Runs and persists Benchmark Samples, feeding the analytics page and internal monitoring.

### Upstream (DeepBook Predict)

**AccountWrapper**:
The DeepBook Predict custody object that holds a subscriber's deposited funds and minted legs. One wrapper per subscriber; Anker Notes record its object id. Created invisibly as a one-time setup step inside the first subscription flow — never presented to users as an account they own or manage; the wallet is the only user-facing identity.
_Avoid_: Manager, PredictManager, product container, Predict account (retired user-facing name — implies a manageable account concept)

**Cadence**:
A DeepBook Predict schedule that continuously creates per-expiry markets (currently 1m / 5m / 1h on testnet). Anker's hourly tenors use only the 1h cadence.

**Expiry Market**:
One DeepBook Predict market object for a single expiry timestamp, discovered from the Predict indexer; where legs are minted, priced, and settled.
_Avoid_: oracle market (pre-6-24 vocabulary), pool

**Legacy Oracle (旧部署 oracle)**:
An expiry oracle object on the retired 4-16 deployment; its price feed stopped updating on 2026-07-12. No longer a market-data source: its prices had drifted far from the real market, so day browse never reads it live (ADR-0004). The term survives only to name the stored format of the Snapshot capture.
_Avoid_: fixture (Snapshot data is real, not canned), old market, live tier (historical usage — it was once the mid ladder tier for day browse, removed for untrustworthy data)

**Snapshot (行情快照)**:
Real market data — Legacy Oracle states plus the matching Binance benchmark — captured at one recorded instant and committed to the repo. Rendered as a frozen photograph of that instant: countdowns, expiry dates, and the Binance comparison all display as of the capture time, under a visible "snapshot as of <time>" label. The only fallback for day browse: showing the Snapshot means live day-scale Expiry Markets are temporarily unreachable.
_Avoid_: fixture (invented data — allowed only in Demo Mode and tests, never as a product data source)

**Demo Mode**:
Site-wide fallback state: fixture market data, transactions disabled, banner shown. Used when the upstream deployment is unavailable.
