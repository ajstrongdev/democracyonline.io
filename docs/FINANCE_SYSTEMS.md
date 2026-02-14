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

- Every company gets +1 issued share each hourly run:
  - `issuedShares = issuedShares + 1`

Example:

- If `issuedShares = 120` at hour `t`, it becomes `121` at `t + 1h` (before any additional trades/investments in that run).

### Company dissolution

- Company is deleted if it has **no shareholders** (`user_shares` empty for company).

Example:

- Last holder sells final remaining share.
- `user_shares` has zero rows for that company.
- Dissolution logic removes the company on the hourly sweep.

---

## 5) Market Cap and Dividend Display

Current usage is not fully uniform:

- Dividend engine (`hourly-advance`) uses:
  - `marketCap = price * issuedShares`
- User dividend preview (`getUserDividendCompanies`) uses same definition.
- Some company pages still display market cap from **owned shares**:
  - `marketCap = price * totalOwnedShares`

This means visible market cap in UI may differ from the cap used to pay dividends.

Example mismatch:

- `price = 100`, `issuedShares = 500`, `totalOwnedShares = 300`
- Dividend engine cap: `100 * 500 = 50,000`
- UI cap (owned-shares variant): `100 * 300 = 30,000`
- A player can see a `20,000` gap between display and payout model inputs.

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

## Exploit / Glaring Issue Analysis

Severity uses: **Critical / High / Medium / Low**.

## Critical

### 1) Broken authorization on election money actions

Several election server mutations accept `userId` in input but do not enforce that it matches authenticated user identity.

Affected patterns include:

- candidate declaration/revocation
- candidate voting (+500 reward path)
- candidate donation (wallet deduction path)

Impact:

- Attacker can potentially perform actions on behalf of other users.
- Most severe: drain another user wallet via unauthorized donation requests.

Conceptual example:

- If a request can submit another user's ID and server-side identity binding is missing, the target user's wallet may be charged for an action they never initiated.

Recommended fix:

- Resolve authenticated user from middleware context server-side.
- Ignore client-provided `userId` for authorization decisions.
- Reject if acting user and target user mismatch (except explicit admin flows).

### 2) TOCTOU / race conditions on wallet and share updates

Many money/share updates follow read-then-write with non-atomic arithmetic.

Examples:

- transfer, buy, sell, invest, create company

Impact:

- Concurrent requests can overspend or produce stale-write outcomes.
- Potential balance integrity issues under high concurrency.

Conceptual example:

- Two near-simultaneous buy requests both read the same pre-update balance, both pass checks, and both write updates, resulting in effective overspend.

Recommended fix:

- Use DB transactions + atomic SQL arithmetic with guard conditions.
- Prefer statements like `UPDATE ... SET money = money - x WHERE id = ? AND money >= x` and verify affected row count.

## High

### 3) Market cap inconsistency across payout vs UI display

- Dividends use `price * issuedShares`.
- Some company UI views show `price * totalOwnedShares`.

Impact:

- Players see different “market cap” than the engine uses for payouts.
- Can be perceived as payout bug or manipulation.

Conceptual example:

- A user sees lower UI market cap but receives dividends aligned to higher issued-share cap, causing trust/confusion issues even when payout math is internally consistent.

Recommended fix:

- Standardize on a single market cap definition (preferably one canonical helper shared by server + UI).

### 4) Schema/runtime mismatch for retained share validation

- `CreateCompanySchema` validates retained shares against `floor(capital / 50)`.
- Runtime issuance is `floor(capital / 100)`.

Impact:

- Inputs can pass schema but fail at runtime; confusing behavior and error churn.

Conceptual example:

- A retained-share value passes schema limits derived from `/50` but is rejected later when runtime issuance is computed with `/100`.

Recommended fix:

- Align schema formula to runtime issuance formula.

### 5) Unbounded monetary parameters (no hard caps)

Examples:

- party membership fee
- transfers/donations amounts (positive check exists, but no max cap)

Impact:

- Griefing/accidental extreme values can destabilize economy or party membership.

Conceptual example:

- An excessively large party fee can eject most members on the next daily sweep, even if set unintentionally.

Recommended fix:

- Add domain caps + integer constraints to all money inputs.

## Medium

### 6) Fractional money input acceptance risk

Some inputs are `z.number().positive()` without integer enforcement.

Impact:

- Potential precision/casting inconsistencies with bigint-backed monetary columns.

Conceptual example:

- Input such as `19.99` may be rounded or rejected inconsistently across paths, creating mismatched expectations versus integer wallet storage.

Recommended fix:

- Enforce integer-only money (`z.number().int().positive()`) and centralize currency type helpers.

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

### 8) Dev-mode bypass on critical cron endpoints

`hourly-advance` skips auth when `IS_DEV` is true.

Impact:

- If misconfigured in non-dev environment, endpoint can be abused.

Conceptual example:

- If `IS_DEV` is mistakenly enabled in a shared environment, unauthenticated calls could trigger sensitive economy ticks.

Recommended fix:

- Add explicit environment hard-stop (e.g., require production scheduler token unless localhost).

PR5 implementation notes:

- Added shared cron auth guard in `src/lib/server/cron-auth.ts` and applied it to:
  - `src/routes/api/hourly-advance.ts`
  - `src/routes/api/game-advance.ts`
- Removed `IS_DEV` bypass for these endpoints.
- Non-local requests now require both:
  - `x-scheduler-token` header matching `CRON_SCHEDULER_TOKEN`
  - valid `Authorization: Bearer <OIDC ID token>` from a `*-scheduler@*.iam.gserviceaccount.com` service account
- Local non-production usage is explicitly gated by:
  - localhost request URL (`localhost` / `127.0.0.1` / `::1`)
  - `x-scheduler-token` header matching `CRON_LOCAL_TOKEN`

Environment expectations:

- `CRON_SCHEDULER_TOKEN`: required in shared/prod environments for scheduler calls.
- `CRON_LOCAL_TOKEN`: required for local non-production manual/scheduled cron invocation.

---

## Hardening Priority (Suggested)

1. **Fix election auth binding to context user** (Critical)
2. **Make wallet/share writes atomic and transactional** (Critical)
3. **Standardize market cap definition everywhere** (High)
4. **Align stock schema retained-share validation** (High)
5. **Add integer + max constraints to all money inputs** (High/Medium)

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
