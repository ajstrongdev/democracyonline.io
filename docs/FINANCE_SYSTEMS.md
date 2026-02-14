# Democracy Online Finance Systems

This document describes how the Democracy Online (DO) finance/economy systems currently work, including formulas, scheduled processors, and known risk areas.

## Scope

The current finance model has four major value domains:

1. **Player wallet** (`users.money`)
2. **Party treasury** (`parties.money`)
3. **Campaign funds** (`candidates.donations`)
4. **Company equity market** (`companies`, `stocks`, `user_shares`)

Primary implementation locations:

- `src/lib/server/stocks.ts`
- `src/routes/api/hourly-advance.ts`
- `src/routes/api/game-advance.ts`
- `src/lib/server/elections.ts`
- `src/lib/server/campaign.ts`
- `src/lib/server/party.ts`
- `src/lib/server/users.ts`
- `src/db/schema.ts`

---

## 1) Player Wallet (`users.money`)

### Baseline

- DB default starting balance is **100** (`users.money` default in schema).
- Admin `resetEconomy` sets all users to **2500**.

### Wallet inflows/outflows and formulas

#### A. P2P Transfer

- Sender pays exact amount, recipient receives exact amount.
- Formula:
  - `sender.money = sender.money - amount`
  - `recipient.money = recipient.money + amount`

Example:

- Alice has `1,200`, Bob has `300`, transfer amount is `250`.
- After transfer:
  - Alice: `1,200 - 250 = 950`
  - Bob: `300 + 250 = 550`

#### B. Bill voting rewards

- House, Senate, Presidential bill votes each reward **+500** to voter.
- Formula:
  - `user.money = user.money + 500`

Example:

- User balance before House vote: `760`
- Reward: `+500`
- New balance: `1,260`

#### C. Election voting rewards

- Casting a candidate vote rewards **+500** to voter.
- Formula:
  - `user.money = user.money + 500`

Example:

- User casts one candidate vote at `2,400` balance.
- New balance is `2,900` after reward.

#### D. Candidate donations (from players)

- Donor pays amount from wallet.
- Formula:
  - `donor.money = donor.money - amount`

Example:

- Donor starts at `900` and donates `275`.
- Donor wallet becomes `625`.
- Candidate campaign funds (separate ledger) increase by `275`.

#### E. Company lifecycle (player wallet side)

- Creating company:
  - `user.money = user.money - capital`
- Buying shares:
  - `totalCost = sharePrice * quantity`
  - `user.money = user.money - totalCost`
- Selling shares:
  - `totalValue = sharePrice * quantity`
  - `user.money = user.money + totalValue`
- CEO investment into company:
  - `newShares = floor(investmentAmount / sharePrice)`
  - `actualCost = newShares * sharePrice`
  - `user.money = user.money - actualCost`

Example:

- Create company with `capital = 2,000`:
  - Founder wallet decreases by `2,000`.
- Buy shares (`sharePrice = 120`, `quantity = 3`):
  - `totalCost = 360`, buyer wallet decreases by `360`.
- Sell shares (`sharePrice = 140`, `quantity = 2`):
  - `totalValue = 280`, seller wallet increases by `280`.
- CEO investment (`investmentAmount = 500`, `sharePrice = 120`):
  - `newShares = floor(500 / 120) = 4`
  - `actualCost = 4 * 120 = 480`
  - CEO wallet decreases by `480` (`20` remains unspent from intended amount).

#### F. Hourly stock dividends

- Paid in `hourly-advance`.
- Company dividend pool is modeled as **10% of market cap per hour**, then split by ownership.
- Current formulas:
  - `marketCap = stock.price * issuedShares`
  - `ownershipPct = holderShares / issuedShares`
  - `holderDividend = floor(ownershipPct * 0.1 * marketCap)`
  - `holder.money = holder.money + holderDividend`

Example:

- `stock.price = 200`, `issuedShares = 100` → `marketCap = 20,000`
- Hourly dividend pool target is `10%` of cap → `2,000` total before per-holder flooring effects.
- Holder A owns `25` shares (`25%`):
  - `floor(0.25 * 2,000) = 500`
- Holder B owns `1` share (`1%`):
  - `floor(0.01 * 2,000) = 20`
- If price drops to `30`, a `1` share holder gets:
  - `floor(1 * 30 * 0.1) = floor(3) = 3`.

---

## 2) Party Treasury (`parties.money`)

### Daily membership fee processor

Executed in `game-advance`:

- For each party where `partySubs > 0`:
  - For each active member in party:
    - If `member.money >= fee`:
      - `member.money = member.money - fee`
      - Accumulate `totalFeesCollected += fee`
    - Else:
      - member is ejected (`users.partyId = null`)
- After loop:
  - `party.money = party.money + totalFeesCollected`

Example (daily run):

- Party fee is `100`.
- Members at start:
  - Member A: `350`
  - Member B: `90`
  - Member C: `100`
- Processing result:
  - A pays `100` → now `250`
  - B cannot pay (`90 < 100`) → removed from party
  - C pays `100` → now `0`
- Party treasury increases by `200` total.

### Party leader withdrawal

In `withdrawPartyFunds`:

- If leader and balance sufficient:
  - `party.money = party.money - amount`
  - `leader.money = leader.money + amount`

Example:

- Party treasury is `1,500`, leader wallet is `700`, withdrawal request is `400`.
- After successful withdrawal:
  - Party treasury: `1,100`
  - Leader wallet: `1,100`

---

## 3) Campaign Funds (`candidates.donations`)

Campaign funds are separate from player wallet money.

### Candidate donation inflow

- From donor transfer in elections server:
  - `candidate.donations = candidate.donations + amount`
  - donor wallet reduced as above.

Example:

- Donor gives `300`.
- Donor wallet decreases by `300`.
- Candidate `donations` increases by `300`.

### Campaign upgrade purchases

Item cost is exponential by owned quantity:

- `multiplier = 1 + (costMultiplier / 100)`
- `currentCost = floor(baseCost * multiplier^owned)`

Purchase effect:

- `candidate.donations = candidate.donations - currentCost`
- If item target is Votes:
  - `candidate.votesPerHour += increaseAmount`
- Else (Donations target):
  - `candidate.donationsPerHour += increaseAmount`

Example (exponential cost progression):

- Assume `baseCost = 100`, `costMultiplier = 20` (`multiplier = 1.2`).
- If `owned = 0`: `floor(100 * 1.2^0) = 100`
- If `owned = 1`: `floor(100 * 1.2^1) = 120`
- If `owned = 2`: `floor(100 * 1.2^2) = 144`
- Candidate with `donations = 500` buying at `owned = 2` pays `144` and drops to `356`.
- If upgrade targets Votes with `increaseAmount = 3`, then `votesPerHour` increases by `3`.

### Hourly campaign tick

In `hourly-advance` for elections with status `Voting`:

- `candidate.votes += votesPerHour`
- `candidate.donations += donationsPerHour`

Example (one hourly tick):

- Before tick: `votes = 1,250`, `donations = 900`
- Rates: `votesPerHour = 8`, `donationsPerHour = 35`
- After tick:
  - `votes = 1,258`
  - `donations = 935`

---

## 4) Equity / Stock Market

### Company creation

- Issued shares on creation:
  - `issuedShares = floor(capital / 100)`
- Initial stock price:
  - `initialSharePrice = 100`
- Optional founder retention writes to `user_shares`.

Example:

- `capital = 2,350`
- `issuedShares = floor(2,350 / 100) = 23`
- Initial price is `100` per share.
- If founder retains `10` shares, a `user_shares` row is written for `10`.

### Share purchase constraints

- Available shares are currently derived as:
  - `availableShares = issuedShares - totalOwnedShares`
- Purchase allowed only if `availableShares >= quantity`.

Example:

- `issuedShares = 30`, `totalOwnedShares = 24` → `availableShares = 6`.
- Buy request for `7` shares is rejected.
- Buy request for `6` shares is allowed.

### Sell flow

- User can sell only if holding quantity is sufficient.
- Shares reduced or holding row deleted when quantity becomes zero.

Example:

- User holds `5` shares and sells `2` → holding becomes `3`.
- If user later sells `3`, holding becomes `0` and the row is removed.

### CEO investment and share issuance

- Only top shareholder (CEO) may issue by investment.
- Shares minted at **current share price**.
- No explicit price dilution logic is applied.

Example:

- Current price `= 80`, CEO invests `410`.
- `newShares = floor(410 / 80) = 5`, `actualCost = 400`.
- Company `issuedShares` increases by `5`; explicit price dilution is not applied by this step.

### Hourly price update (`hourly-advance`)

For each stock:

- `priceChange = boughtToday - soldToday`
- If no trades (`boughtToday == 0 && soldToday == 0`):
  - `decay = ceil(currentPrice * 0.01)`
  - `priceChange = -decay`
- `newPrice = max(10, currentPrice + priceChange)`

Example A (trade-driven):

- `currentPrice = 150`, `boughtToday = 9`, `soldToday = 3`
- `priceChange = 9 - 3 = +6`
- `newPrice = 156`

Example B (no trades decay):

- `currentPrice = 150`, `boughtToday = 0`, `soldToday = 0`
- `decay = ceil(150 * 0.01) = 2`
- `priceChange = -2`, `newPrice = 148`

### Hourly share inflation

- Issuance policy is now environment-driven (feature-flagged), not always unconditional.
- In `legacy-hourly` mode:
  - every company gets `+1` issued share each hourly run.
- In `event-conditional` mode:
  - unconditional hourly minting is disabled.
  - shares are minted only on configured issuance events (investment, optional buy-pressure trigger) with guardrails.

Example:

- If `issuedShares = 120` at hour `t`:
  - `legacy-hourly`: becomes `121` at `t + 1h`
  - `event-conditional`: remains `120` unless an issuance trigger occurs.

### Company dissolution

- Company is deleted if it has **no shareholders** (`user_shares` empty for company).

Example:

- Last holder sells final remaining share.
- `user_shares` has zero rows for that company.
- Dissolution logic removes the company on the hourly sweep.

---

## 5) Market Cap and Dividend Display

This branch standardizes market cap calculation to the issued-share definition used by payout logic:

- Canonical definition:
  - `marketCap = price * issuedShares`
- Dividend engine and dividend previews use this definition.
- Company-market surfaces were aligned to reduce payout/display drift.

Implementation intent:

- Players should see market-cap values that match the values used by dividend and KPI processors.

---

## 6) Transaction Logging Coverage

### Logged

- User transfers (sender + recipient logs)
- Bill/election vote rewards
- Company create/buy/sell/invest
- Dividend payments
- Party fee payments (member side)
- Party treasury collection summary
- Party leader withdrawal (party ledger)

Example (logged transfer):

- User A sends `200` to User B.
- Expected: sender-side and recipient-side transaction records are both written.

### Not fully mirrored

- Party withdrawal is logged in party ledger, but no user-side wallet transaction entry is currently written for the leader.
- Candidate donation writes donor wallet transaction and donation history, but not a user wallet transaction for candidate wallet (campaign fund is separate ledger).

Example gap:

- Party leader withdraws `500`.
- Party ledger has an entry, but leader wallet history may not show a matching incoming transaction row.

---

## Exploit / Glaring Issue Analysis (Post-Branch Status)

Severity uses: **Critical / High / Medium / Low**.

### Resolved in this branch

1. **Critical — election money auth binding**

- Status: **Resolved**.
- Money-sensitive election actions are now bound to authenticated identity from server context rather than trusting client-supplied identity.

2. **Critical — TOCTOU/race risks on wallet/share mutation paths**

- Status: **Resolved (core paths)**.
- Key finance mutations were moved to transactional/atomic patterns to prevent stale read-then-write overspend behavior.

3. **High — market-cap inconsistency between payout and display**

- Status: **Resolved**.
- Canonical market-cap definition (`price * issuedShares`) is now the expected basis across finance engine and aligned surfaces.

4. **High — retained-share schema/runtime mismatch**

- Status: **Resolved**.
- Validation and runtime issuance rules are aligned.

5. **High/Medium — unbounded and fractional money input risk**

- Status: **Resolved**.
- Shared finance validators enforce integer + capped values; DB-level CHECK constraints add defense in depth.

6. **High — cron endpoint dev-bypass risk**

- Status: **Resolved**.
- Dev bypass removed; scheduler token + bearer/OIDC checks are required for non-local calls.

### Remaining / ongoing risks

1. **Medium — issuance policy tuning and KPI drift**

- Event-conditional issuance is implemented and feature-flagged, but KPI monitoring/rollout discipline remains important.

2. **Low/Medium — transaction-history parity gaps**

- Some wallet/ledger mirror semantics are still asymmetric by design (for example, party-ledger vs user-wallet mirroring).
- This is mainly auditability/UX clarity risk, not a core integrity break.

### PR4 Implementation Notes (Issue #229)

- Shared finance validators now enforce integer-only and capped input at API boundaries for:
  - transfers
  - election donations
  - stock buy/sell/invest quantities and amounts
  - party membership fee create/update
- Input caps:
  - money amount cap: `1,000,000`
  - membership fee cap: `100,000`
  - quantity cap: `100,000`
- Database CHECK constraints were added for key finance columns to protect integrity even if API validation is bypassed.

Migration safety/backward compatibility:

- Constraints are added with `NOT VALID` first, then validated in a second step.
- This allows safer rollout without immediately locking out writes during constraint creation.

Rollback path:

- Drop the PR4 constraints if rollback is required:
  - `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_money_bounds_chk;`
  - `ALTER TABLE parties DROP CONSTRAINT IF EXISTS parties_money_bounds_chk;`
  - `ALTER TABLE parties DROP CONSTRAINT IF EXISTS parties_party_subs_bounds_chk;`
  - `ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_donations_bounds_chk;`
  - `ALTER TABLE donation_history DROP CONSTRAINT IF EXISTS donation_history_amount_bounds_chk;`
  - `ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_capital_bounds_chk;`
  - `ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_issued_shares_bounds_chk;`
  - `ALTER TABLE stocks DROP CONSTRAINT IF EXISTS stocks_price_bounds_chk;`
  - `ALTER TABLE stocks DROP CONSTRAINT IF EXISTS stocks_brought_today_bounds_chk;`
  - `ALTER TABLE stocks DROP CONSTRAINT IF EXISTS stocks_sold_today_bounds_chk;`
  - `ALTER TABLE user_shares DROP CONSTRAINT IF EXISTS user_shares_quantity_bounds_chk;`

### 7) Hourly share issuance affects dividend denominator each hour

Issuing +1 share hourly can dilute ownership and lower distributed dividends over time even without trading.

Impact:

- Predictable passive dilution may be unintended by design.

Conceptual example:

- A holder with static share count owns a smaller percentage each hour as denominator grows, reducing their payout share over time without trading.

Recommended fix:

- Reassess if inflation should be conditional (e.g., on investment/events) instead of unconditional hourly issuance.

PR6 balance-track decision (issue #231):

- Decision: move from unconditional `+1 issued share/hour` to event-conditional minting.
- Rationale:
  - Unconditional issuance creates passive ownership drift even for inactive companies.
  - Dividend share shrinks over time for long-hold users without any counter-play.
  - Conditioning issuance on explicit economy activity keeps dilution tied to gameplay.

Chosen policy shape:

- Stop hourly unconditional minting in `hourly-advance`.
- Mint only on defined economy events (implementation track):
  - Company investment transaction accepted.
  - Optional secondary trigger: sustained buy-pressure window (to be A/B gated).
- Guardrails:
  - Daily mint cap per company.
  - No mint when there are no active holders.

KPI baseline and expected impact:

- KPI 1 — Daily ownership drift for passive holders
  - Baseline (current model): for holder shares `q` and issued shares `S`, ownership drifts from `q/S` to `q/(S+24)` per day.
  - Target: median passive-holder drift reduced by >= 70% after policy rollout.
- KPI 2 — Dividend stability for passive holders
  - Baseline: payout share decays mechanically with denominator growth even without trade/invest events.
  - Target: week-over-week passive-holder dividend volatility reduced by >= 30%.
- KPI 3 — Company dilution concentration
  - Baseline: every company dilutes at the same hourly rate regardless of activity.
  - Target: >= 80% of new issuance attributable to explicit mint-trigger events.

Rollout criteria before implementation:

- Feature flag added for issuance policy (`legacy-hourly` vs `event-conditional`).
- 14-day comparison window with KPI dashboards and rollback switch.
- Follow-up implementation issue required before merge to production.

PR6 implementation notes (issue #232):

- Added feature-flagged issuance controls in `src/env.ts`:
  - `SHARE_ISSUANCE_POLICY` (`legacy-hourly` | `event-conditional`)
  - `ENABLE_BUY_PRESSURE_MINT_TRIGGER`
  - `BUY_PRESSURE_MINT_THRESHOLD`
  - `DAILY_COMPANY_MINT_CAP`
- Updated `src/routes/api/hourly-advance.ts`:
  - `event-conditional` policy disables unconditional hourly minting.
  - Optional buy-pressure trigger can mint shares when enabled and threshold is met.
  - Buy-pressure issuance enforces guardrails: active holders required + per-company daily mint cap.
- Updated `src/lib/server/stocks.ts` investment issuance:
  - Event-triggered investment minting writes issuance telemetry.
  - In `event-conditional` mode, investment minting enforces per-company daily cap.
- Added queryable telemetry tables:
  - `share_issuance_events` for issuance source attribution and ownership-drift signals.
  - `finance_kpi_snapshots` for time-series dividend/market-cap snapshots.
- Added migration: `drizzle/0010_event_conditional_share_issuance.sql`.

### 8) Historical dev-mode bypass on critical cron endpoints

Previously, `hourly-advance` could skip auth when `IS_DEV` was true.

Previous impact:

- If misconfigured in non-dev environment, endpoint can be abused.

Conceptual example (before fix):

- If `IS_DEV` is mistakenly enabled in a shared environment, unauthenticated calls could trigger sensitive economy ticks.

Recommended fix:

- Add explicit environment hard-stop (e.g., require production scheduler token unless localhost).

PR5 implementation notes:

- Added shared cron auth guard in `src/lib/server/cron-auth.ts` and applied it to:
  - `src/routes/api/hourly-advance.ts`
  - `src/routes/api/game-advance.ts`
  - `src/routes/api/bill-advance.ts`
- Removed `IS_DEV` bypass for these endpoints.
- Non-local requests now require both:
  - `x-scheduler-token` header matching `CRON_SCHEDULER_TOKEN`
  - valid `Authorization: Bearer <OIDC ID token>` from a `*-scheduler@*.iam.gserviceaccount.com` service account
- Local non-production usage is explicitly gated by:
  - localhost request URL (`localhost` / `127.0.0.1` / `::1`)
  - `x-scheduler-token` header matching `CRON_LOCAL_TOKEN`
- Admin dashboard manual triggers now use:
  - `x-admin-cron-trigger: 1`
  - `Authorization: Bearer <Firebase user ID token>`
  - verified admin email membership via `ADMIN_EMAILS`

Environment expectations:

- `CRON_SCHEDULER_TOKEN`: required in shared/prod environments for scheduler calls.
- `CRON_LOCAL_TOKEN`: required for local non-production manual/scheduled cron invocation.

---

## Hardening Priority (Suggested)

1. **Monitor event-conditional issuance KPIs and keep rollback-ready**
2. **Close remaining transaction-history parity gaps**
3. **Keep finance invariants covered with tests for new mutation paths**
4. **Periodically audit cron auth configuration in deployed environments**

---

## Notes on Current Dividend Design

Current formula is intentionally conservative and deterministic:

- 10% of market cap per hour
- ownership-proportional
- floored to integer payout

Equivalent simplification under current market-cap definition:

- `holderDividend = floor(holderShares * sharePrice * 0.1)`

Because of floor rounding, tiny holdings at low prices can yield zero hourly payout.

Example:

- Holder has `3` shares, price is `45`.
- `holderDividend = floor(3 * 45 * 0.1) = floor(13.5) = 13`.
- If price falls to `20`: `floor(3 * 20 * 0.1) = floor(6) = 6`.
