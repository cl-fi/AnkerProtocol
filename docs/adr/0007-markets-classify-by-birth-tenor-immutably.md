# Markets classify by birth tenor, immutably

The tenor shelves used to be filtered by *remaining* time: hourly = 1h cadence fingerprint + expiry < 1 day away, day = expiry ≥ 1 day away. But day-scale markets share the 1h cadence's fingerprint params, so a day market decaying below 24h remaining leaked onto the hourly shelf — found live on 2026-07-13, and in its final ~3 hours such a market would sort *first* there, ahead of every true hourly market. We now classify by **birth tenor**: a market whose span at creation (expiry − creation checkpoint) is under one day is hourly, otherwise day-scale, and the group never changes as expiry approaches. The live data leaves no ambiguity at the 1-day line: true hourly markets are born at exactly 3.0h, the smallest day market at 29.6h.

With classification decoupled from decay, the day shelf's "remaining ≥ 1 day" retirement line is also removed: a decayed day market stays listed and subscribable for as long as the quote pipeline produces a positive coupon — a CEX user can buy a product settling tonight, and hiding real inventory behind an arbitrary cutoff helped no one. Display self-adapts through the existing sub-day rule (ADR-0002): below one day remaining the row switches to per-period yield and drops the APR and Benchmark columns; the thin-yield row filter extends to decayed day rows so unquotable offers fall off the shelf on their own.

## Considered Options

- **Birth-tenor classification (chosen).** A market *is* what it was created as; no time-driven identity changes, no cross-shelf leakage.
- **Remaining-time classification (status quo).** The bug: identity changes as the clock runs, and the fingerprint cannot tell a decayed day market from a true hourly one.
- **Retire decayed day markets from both shelves.** Simple, but discards genuinely subscribable inventory in its most active final day.

## Consequences

- A missing creation timestamp degrades a market to remaining-tenor classification (the old behavior) rather than failing — safe for indexer rows that omit the field.
- The Benchmark Recorder samples only day-born rows still displaying APR + Benchmark (remaining ≥ 1 day), so decayed rows never enter headline statistics — the same line ADR-0006 relies on for its offset cap.
- ADR-0002's per-period display rule now also governs decayed day rows, unchanged in code: it always keyed off remaining time.
