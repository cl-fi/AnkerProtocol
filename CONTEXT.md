# Anker Protocol

Non-custodial structured yield products (dual investment, shark fin) on Sui, built on DeepBook Predict's range-digital option markets.

## Language

### Products

**Dual Investment (双币投资)**:
Anker's flagship structured product: deposit quote asset, pick a target price and tenor; at expiry the deposit either converts at the target price or is returned, and the coupon is paid either way. Mirrors the CEX product of the same name.
_Avoid_: dual currency, DCI, 双币盈 (Binance brand name — use only when citing Binance)

**Turbo Dual Investment (Turbo)**:
A separate product line with the exact same payoff as Dual Investment, offered on hourly tenors (1h–3h) backed by DeepBook Predict's hourly cadence markets. Yields are shown as per-period yield, never annualized APR. Minute-level tenors are deliberately not offered.
_Avoid_: flash product, prediction, up/down bet

**Shark Fin (鲨鱼鳍)**:
Principal-protected range product: enhanced coupon if price stays inside a bound, base coupon otherwise.

**Tenor (期限)**:
Time from subscription to expiry of a product. Turbo tenors are hourly; standard Dual Investment tenors are day-scale (1d–14d).
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

### Upstream (DeepBook Predict)

**Cadence**:
A DeepBook Predict schedule that continuously creates per-expiry markets (currently 1m / 5m / 1h on testnet). Anker's Turbo uses only the 1h cadence.

**Expiry Market**:
One DeepBook Predict market object for a single expiry timestamp, discovered from the Predict indexer; where legs are minted, priced, and settled.
_Avoid_: oracle market (pre-6-24 vocabulary), pool

**Demo Mode**:
Site-wide fallback state: fixture market data, transactions disabled, banner shown. Used when the upstream deployment is unavailable.
