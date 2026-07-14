# AnkerProtocol

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (cl-fi/AnkerProtocol) via the `gh` CLI; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical label names used as-is: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Cursor Cloud specific instructions

Single Next.js 14 dApp (TypeScript) + a Move smart-contract package under `contracts/anker_protocol`. Standard commands live in `package.json` scripts and `.github/workflows/ci.yml`; use those as the source of truth.

- **Node 22** is required (matches CI). Dependencies install via `npm install` (the startup update script). Note: `npm ci` currently fails on this platform due to a transitive lockfile mismatch on `@emnapi/*` optional deps — prefer `npm install`.
- **Sui CLI** (`testnet-1.73.0`) is installed via `suiup` and added to `PATH` through `~/.bashrc` (`~/.sui/bin`). It is only needed for `npm run test:move`, `npm run codegen`, and `npm run codegen:summary` — not for running the frontend.
- **`sui move test` gotcha:** on first run `sui` prompts to create a client config and will hang waiting for input in a non-interactive shell. A config already exists here; if it is ever missing, recreate it non-interactively with `sui client --yes envs` (creates `~/.sui/sui_config/`, active env `testnet`) before running `npm run test:move`.
- **Dev server:** `npm run dev` serves on `http://127.0.0.1:3000`; the product lives at `/en/app` (or `/zh-CN/app`). The core quote flow (select strike/tenor/amount, live APR) works without a wallet, using committed testnet defaults; on-chain transactions (Subscribe) require a Sui browser wallet. If upstream testnet endpoints are down, set `NEXT_PUBLIC_ANKER_DEMO_MODE=true` for deterministic fixtures.
- **E2E:** `npm run test:e2e` (Playwright chromium is preinstalled) starts its own dev server on port 4123 with deterministic fixtures — do not point it at a plain `next dev` on 3000.
- **Env:** all config has committed testnet defaults, so no `.env.local` is needed for local dev; `DATABASE_URL`/`CRON_SECRET` are only for the optional Benchmark Recorder cron.
