# Turbo deliberately ignores the 1m/5m cadences

DeepBook Predict testnet offers 1m, 5m, and 1h cadences. Turbo Dual Investment uses **only the 1h cadence** (three rolling expiries ≈ 1h/2h/3h tenors), even though minute-level markets exist. Minute-level settlement makes a wealth product feel like an up/down bet: it destroys the "structured yield product" positioning (Anker's differentiation against the prediction-market projects on the same track) and is counter-intuitive for the target user (CEX dual-investment users). For the same reason, sub-day tenors display per-period yield, never annualized APR — annualizing a 1-hour coupon produces scam-looking four-digit percentages.

Do not "helpfully" add minute-level products or APR display for short tenors; both were considered and rejected on product grounds, not for technical reasons.
