# Cursor Cloud dev environment notes

Reference notes for Cursor Cloud Agents setting up / running this repo. Not required
for local development — kept out of `AGENTS.md` so it isn't loaded every session.

Standard commands live in `package.json` scripts and `.github/workflows/ci.yml`; use
those as the source of truth. This file only records non-obvious caveats.

## Layout

Single Next.js 14 dApp (TypeScript) plus a Move smart-contract package under
`contracts/anker_protocol`.

## Setup / dependencies

- **Node 22** (matches CI). Install deps with `npm install`. `npm ci` currently fails on
  the Cloud VM platform due to a transitive lockfile mismatch on `@emnapi/*` optional
  deps, so prefer `npm install`.
- **Sui CLI** (`testnet-1.73.0`) is installed via `suiup` (`~/.sui/bin`, added to `PATH`
  via `~/.bashrc`). Only needed for `npm run test:move`, `npm run codegen`, and
  `npm run codegen:summary` — not for running the frontend.
- **Playwright** chromium is preinstalled for `npm run test:e2e`.

## Gotchas

- **`sui move test` first-run prompt:** `sui` prompts to create a client config on first
  run and hangs waiting for input in a non-interactive shell. If the config is missing,
  create it non-interactively with `sui client --yes envs` (creates `~/.sui/sui_config/`,
  active env `testnet`) before running `npm run test:move`.
- **Dev server:** `npm run dev` serves on `http://127.0.0.1:3000`; the product lives at
  `/en/app` (or `/zh-CN/app`). The core quote flow (select strike/tenor/amount, live APR)
  works without a wallet using committed testnet defaults; on-chain transactions
  (Subscribe) require a Sui browser wallet. If upstream testnet endpoints are down, set
  `NEXT_PUBLIC_ANKER_DEMO_MODE=true` for deterministic fixtures.
- **E2E:** `npm run test:e2e` starts its own dev server on port 4123 with deterministic
  fixtures — do not point it at a plain `next dev` on 3000.
- **Env:** all config has committed testnet defaults, so no `.env.local` is needed for
  local dev; `DATABASE_URL` / `CRON_SECRET` are only for the optional Benchmark Recorder
  cron.
