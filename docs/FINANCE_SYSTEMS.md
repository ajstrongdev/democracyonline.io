# Democracy Online Finance Systems

This document describes how the Democracy Online (DO) finance and economy systems work, including all formulas, the order-book stock market, scheduled processors, and input validation.

## Scope

The finance model has four major value domains:

1. **Player wallet** (`users.money`)
2. **Party treasury** (`parties.money`)
3. **Campaign funds** (`candidates.donations`)
4. **Company equity market** (`companies`, `stocks`, `stock_orders`, `order_fills`, `user_shares`)

Primary implementation locations:

- `src/lib/server/stocks.ts` — company CRUD, buy/sell order placement, CEO investment, order cancellation, order book queries
- `src/routes/api/hourly-advance.ts` — hourly cron: order matching, price updates, share issuance, dividends, company dissolution
- `src/routes/api/game-advance.ts` — daily cron: election cycles, party membership fees, user activity
- `src/lib/server/elections.ts` — voting rewards, candidate donations
- `src/lib/server/campaign.ts` — campaign idle-game upgrades
- `src/lib/server/party.ts` — party creation, treasury withdrawal
- `src/lib/server/users.ts` — P2P transfers, transaction history
- `src/lib/utils/stock-economy.ts` — market cap, dividend, share issuance formulas
- `src/lib/utils/share-issuance-policy.ts` — issuance policy logic and KPI helpers
- `src/lib/schemas/finance-schema.ts` — shared input validation schemas
- `src/db/schema.ts` — all table definitions

---

## 1) Player Wallet (`users.money`)

### Baseline

- DB default starting balance: **$100** (`users.money` default in schema).
- Admin `resetEconomy` deletes all companies, shares, orders, price history, and transaction history, then sets all users to **$2,500**.

### Wallet inflows and outflows

#### A. P2P Transfer

- Sender pays exact amount; recipient receives exact amount.
- Atomic — deduction uses a `WHERE money >= amount` guard to prevent overspend.
- Formulas:
  - `sender.money -= amount`
  - `recipient.money += amount`

#### B. Bill voting rewards

- House vote, Senate vote, and Presidential sign/veto each reward **+$500** to the voter.

#### C. Election voting rewards

- Casting a candidate vote rewards **+$500** to the voter.

#### D. Candidate donations

- Donor's personal wallet is reduced; candidate's campaign fund (`candidates.donations`) is increased.
- Atomic — deduction uses a `WHERE money >= amount` guard.
- A `donation_history` row is also written.

#### E. Stock market (player wallet side)

All stock-market wallet effects are described in detail in **Section 4**. Summary:

| Action            | Wallet effect                             | Timing         |
| ----------------- | ----------------------------------------- | -------------- |
| Create company    | `-capital`                                | Immediate      |
| Place buy order   | `-pricePerShare × quantity` (escrowed)    | Immediate      |
| Cancel buy order  | `+pricePerShare × remainingQty` (refund)  | Immediate      |
| Sell order filled | `+tradePrice × fillQty`                   | On hourly fill |
| CEO investment    | `-retainedShares × sharePrice`            | Immediate      |
| Hourly dividend   | `+floor(ownershipPct × 0.01 × marketCap)` | Hourly tick    |

#### F. Party membership fee

- Deducted daily by the game-advance cron. See **Section 2**.

---

## 2) Party Treasury (`parties.money`)

### Daily membership fee processor

Executed in `game-advance`:

1. For each party where `partySubs > 0`:
   - For each active member:
     - If `member.money >= fee`: deduct fee, accumulate into total.
     - Else: eject member (`users.partyId = null`).
2. After processing all members: `party.money += totalFeesCollected`.

Example:

- Party fee: `100`. Members: A (`350`), B (`90`), C (`100`).
- A pays → `250`. B can't pay → ejected. C pays → `0`.
- Party treasury increases by `200`.

### Party leader withdrawal

- Leader-only. Requires sufficient treasury balance.
- `party.money -= amount`, `leader.money += amount`.

---

## 3) Campaign Funds (`candidates.donations`)

Campaign funds are a separate ledger from player wallet money.

### Candidate donation inflow

- Donor's personal wallet is reduced; `candidate.donations` increases by the same amount.

### Campaign upgrade purchases

Items have exponential cost scaling:

- `multiplier = 1 + (costMultiplier / 100)`
- `currentCost = floor(baseCost × multiplier^owned)`

Purchase deducts from `candidate.donations` and increases either `votesPerHour` or `donationsPerHour` by the item's `increaseAmount`.

### Hourly campaign tick

In `hourly-advance`, for elections with status `Voting`:

- `candidate.votes += votesPerHour`
- `candidate.donations += donationsPerHour`
- A `candidate_snapshots` row is recorded for each candidate.

---

## 4) Equity / Stock Market (Order Book)

The stock market uses a **limit order book** system. Players place buy or sell orders; orders are matched during the hourly tick.

### Game hour

A global counter (`game_state.current_game_hour`) is incremented each hourly tick. Orders are stamped with the game hour they were placed in, and each player may only place **one buy order and one sell order per game hour** per company.

### 4.1) Company creation

- **Capital**: founder pays `capital` from wallet (min `$100`, max `$1,000,000`).
- **Issued shares**: set to the founder's chosen `retainedShares` count.
  - Constraint: `retainedShares <= floor(capital / 100)`.
  - The `$100 per share` ratio (`SHARE_ISSUANCE_CAPITAL_UNIT`) determines the maximum shares the capital can buy.
- **Initial share price**: always `$100`.
- **Founder shares**: a `user_shares` row is written for the founder's `retainedShares`.
- **Cooldown**: one company creation per user per 24 hours (enforced via transaction history).

Example:

- Founder puts up `capital = 2,000` and retains `15` shares (max allowed: `floor(2000/100) = 20`).
- Company starts with `issuedShares = 15`, all owned by the founder.
- Founder wallet decreases by `$2,000`. Initial share price is `$100`.

### 4.2) Buy orders

Placing a buy order:

1. Validates quantity (max **5** shares per order, tracked as `MAX_OPEN_ORDER_SHARES_PER_COMPANY`).
2. Checks pending unfilled buy orders for this company — total pending + new quantity must not exceed **5**.
3. Checks rate limit — only one buy order allowed per game hour.
4. **Escrows funds immediately**: `user.money -= pricePerShare × quantity`.
5. Creates a `stock_orders` row with `side = 'buy'`, `status = 'open'`.
6. Shares are **not** transferred yet — that happens during the hourly fill.

### 4.3) Sell orders

Placing a sell order:

1. Validates quantity (max **5** shares per order).
2. Checks the user actually holds enough shares, accounting for shares already locked in pending sell orders:
   - `availableToSell = ownedShares - lockedInPendingSellOrders`
3. Checks rate limit — only one sell order allowed per game hour.
4. **No money is given yet** — the seller only receives funds when the order is filled.
5. Creates a `stock_orders` row with `side = 'sell'`, `status = 'open'`.

### 4.4) Order cancellation

- Players can cancel their own `open` or `partial` orders.
- **Buy order cancellation** refunds the escrowed money for the unfilled portion: `user.money += remainingQty × pricePerShare`.
- **Sell order cancellation** simply releases the locked shares (no money movement).

### 4.5) Hourly order matching (`hourly-advance`)

The hourly tick processes orders in three phases:

#### Phase 1 — P2P matching

For each company, buy and sell orders are matched FIFO (oldest first):

1. For each buy order (by creation time):
   - For each sell order (by creation time):
     - **Self-trades are skipped** (buyer cannot buy from themselves).
     - Trade quantity = `min(buyRemaining, sellRemaining)`.
     - Seller's actual holding is verified; fill quantity is capped to available shares.
     - **Trade executes at the buyer's escrowed price** (buyer already paid at order placement).
     - Effects:
       - Seller's `user_shares.quantity` decreases; zero-holdings are deleted.
       - Buyer's `user_shares` is upserted (insert or increment).
       - Seller receives payment: `seller.money += tradePrice × fillQty`.
       - Both orders update `filledQuantity` and `status` (`partial` or `filled`).
       - An `order_fills` row is recorded.
       - `stocks.broughtToday` is incremented by the fill quantity (buy pressure).
       - Transaction history is written for both buyer and seller.

#### Phase 2 — Treasury fills

Buy orders that weren't fully filled by P2P matching can be filled from unowned "treasury" shares:

- **Unowned shares** = `issuedShares - totalOwnedShares` (shares that exist but aren't held by any player).
- **Max 1 treasury share sold per company per tick**.
- Payment from treasury fills goes to company capital: `company.capital += tradePrice × fillQty`.
- Also counts as buy pressure (`broughtToday` incremented).

#### Phase 3 — Orphaned sell order cleanup

Sell orders with no possible counterparty (no buy orders from other users exist) are auto-cancelled:

- Status set to `cancelled`.
- **Cancelled sell shares count as sell pressure**: `stocks.soldToday += cancelledRemaining`.
- Transaction history records the auto-cancellation.

### 4.6) Hourly price update

After order matching, prices are updated for each stock:

- `priceChange = broughtToday - soldToday`
  - `broughtToday` = shares filled from buy orders (P2P + treasury)
  - `soldToday` = shares from auto-cancelled orphaned sell orders (oversupply signal)
- If no activity (`broughtToday == 0 && soldToday == 0`):
  - `decay = ceil(currentPrice × 0.01)`
  - `priceChange = -decay`
- `newPrice = max(10, currentPrice + priceChange)`
- Daily counters (`broughtToday`, `soldToday`) are reset to 0.
- A `share_price_history` row is recorded.

Example A (trade-driven):

- `currentPrice = 150`, `broughtToday = 4`, `soldToday = 1`
- `priceChange = 4 - 1 = +3`, `newPrice = 153`

Example B (no activity — decay):

- `currentPrice = 150`, `broughtToday = 0`, `soldToday = 0`
- `decay = ceil(150 × 0.01) = 2`, `newPrice = 148`

Example C (sell pressure):

- `currentPrice = 100`, `broughtToday = 2`, orphaned sell orders cancelled for `5` shares → `soldToday = 5`
- `priceChange = 2 - 5 = -3`, `newPrice = 97`

### 4.7) Share issuance policy

Share issuance is controlled by the `SHARE_ISSUANCE_POLICY` environment variable.

#### `legacy-hourly` mode (default)

- Every company gets **+1 issued share** each hourly tick, unconditionally.
- Creates passive ownership dilution for all holders.

#### `event-conditional` mode

- Unconditional hourly minting is **disabled**.
- Shares are minted only on specific triggers:
  - **CEO investment**: mints the `retainedShares` specified in the investment (see 4.8).
  - **Buy-pressure trigger** (optional, gated by `ENABLE_BUY_PRESSURE_MINT_TRIGGER`): mints 1 share when net demand (`broughtToday - soldToday`) meets `BUY_PRESSURE_MINT_THRESHOLD`.
- Guardrails:
  - Per-company daily mint cap (`DAILY_COMPANY_MINT_CAP`, default `10,000`).
  - No minting when there are zero active holders.
- All issuance events are recorded in `share_issuance_events` with policy, source, minted count, and ownership-drift basis points.

### 4.8) CEO investment

- **CEO** = top shareholder by share count for a given company.
- Only the CEO may invest to issue new shares.
- The CEO specifies `investmentAmount` and `retainedShares`.
- `actualCost = retainedShares × currentSharePrice`.
- New shares are minted and added to the CEO's holdings.
- Company `issuedShares` and `capital` both increase.
- In `event-conditional` mode, the daily mint cap is enforced.
- A `share_issuance_events` row and a `finance_kpi_snapshots` row are recorded.

Example:

- Share price: `$80`, CEO invests with `retainedShares = 5`.
- `actualCost = 5 × 80 = 400`. CEO wallet decreases by `$400`.
- `issuedShares` increases by `5`. Company `capital` increases by `$400`.

### 4.9) CEO determination

- Updated every hourly tick.
- The user with the most shares (`userShares.quantity`) in a company becomes the CEO (`companies.creatorId`).

### 4.10) Hourly dividends

Paid every hourly tick to all shareholders of active (non-dissolved) companies:

- `marketCap = sharePrice × issuedShares`
- `ownershipPct = holderShares / issuedShares`
- `holderDividend = floor(ownershipPct × 0.01 × marketCap)`

This is equivalent to: `holderDividend = floor(holderShares × sharePrice × 0.01)` — **1% of the holder's share value per hour**.

A `finance_kpi_snapshots` row is recorded per company per tick.

Example:

- `sharePrice = 200`, `issuedShares = 100` → `marketCap = 20,000`
- Holder A owns `25` shares (25%): `floor(0.25 × 0.01 × 20,000) = floor(50) = $50`
- Holder B owns `1` share (1%): `floor(0.01 × 0.01 × 20,000) = floor(2) = $2`
- At `sharePrice = 30`, holder with `1` share: `floor(0.01 × 0.01 × 3,000) = floor(0.3) = $0`

### 4.11) Company dissolution

During the hourly tick, companies with **zero shareholders** are dissolved:

1. All open orders for the company are cancelled (buy orders refunded).
2. `order_fills`, `share_price_history`, `stocks`, and `companies` rows are deleted.
3. A public feed post announces the dissolution.

### 4.12) Order book visibility

The `getCompanyOrderBook` function returns:

- **Bids** (open buy orders): sorted by price descending, then creation time ascending.
- **Asks** (open sell orders): sorted by price ascending, then creation time ascending.
- **Recent fills**: last 20 executed trades for the company.

---

## 5) Input Validation and Constraints

### API-level validation (Zod schemas)

All finance inputs are validated at API boundaries via shared schemas in `src/lib/schemas/finance-schema.ts`:

| Schema                           | Constraint                    |
| -------------------------------- | ----------------------------- |
| `positiveMoneyAmountSchema`      | Integer, min 1, max 1,000,000 |
| `nonNegativeMembershipFeeSchema` | Integer, min 0, max 100,000   |
| `positiveQuantitySchema`         | Integer, min 1, max 100,000   |
| `nonNegativeQuantitySchema`      | Integer, min 0, max 100,000   |

Stock order quantities are further capped to **5** shares per order (`MAX_OPEN_ORDER_SHARES_PER_COMPANY`).

### Database CHECK constraints

Defense-in-depth constraints on key finance columns:

- `users.money` — bounded
- `parties.money`, `parties.party_subs` — bounded
- `candidates.donations`, `donation_history.amount` — bounded
- `companies.capital`, `companies.issued_shares` — bounded
- `stocks.price`, `stocks.brought_today`, `stocks.sold_today` — bounded
- `user_shares.quantity` — bounded

---

## 6) Transaction Logging

### Logged events

- P2P money transfers (sender + recipient entries)
- Bill vote rewards (House, Senate, Presidential)
- Election vote rewards
- Candidate donations (donor-side wallet + donation_history)
- Buy order placement (with escrow note)
- Buy/sell order fills (both buyer and seller entries)
- Buy order cancellation (with refund note)
- Sell order auto-cancellation (orphaned orders)
- Treasury fill purchases
- CEO investment
- Company creation
- Dividend payments (per shareholder, with ownership % and market cap)
- Party fee payments (member side)
- Party treasury collection summary
- Party leader withdrawal (party ledger)

### Known gaps

- Party leader withdrawal is logged in the party ledger but not as a user-side wallet transaction for the leader.
- Campaign donations are logged in donor wallet and `donation_history`, but the candidate's campaign fund is a separate ledger without its own transaction history table.

---

## 7) Scheduled Processors

### Hourly tick (`/api/hourly-advance`)

Execution order:

1. Advance game hour (`game_state.current_game_hour + 1`)
2. P2P order matching (FIFO, per company)
3. Treasury fills (max 1 share per company)
4. Orphaned sell order cleanup
5. Price update and daily counter reset
6. Share issuance (policy-dependent)
7. CEO update (top shareholder)
8. Company dissolution (zero shareholders)
9. Dividend payments
10. Campaign candidate hourly tick (votes/donations per hour)

### Daily tick (`/api/game-advance`)

1. Presidential election cycle management
2. Senate election cycle management
3. Campaign item seeding for new elections
4. Party membership fee collection
5. User activity tracking and inactivity cleanup (14-day threshold)

### Cron authentication

Both cron endpoints require authentication via `src/lib/server/cron-auth.ts`:

- **Production**: `x-scheduler-token` header + OIDC bearer token from a service account.
- **Local**: localhost origin + `x-scheduler-token` matching `CRON_LOCAL_TOKEN`.
- **Admin manual trigger**: `x-admin-cron-trigger` header + Firebase user ID token + verified admin email.

---

## 8) Environment Variables (Finance)

| Variable                           | Default         | Description                                                |
| ---------------------------------- | --------------- | ---------------------------------------------------------- |
| `SHARE_ISSUANCE_POLICY`            | `legacy-hourly` | `legacy-hourly` or `event-conditional`                     |
| `ENABLE_BUY_PRESSURE_MINT_TRIGGER` | `false`         | Enable buy-pressure share minting (event-conditional only) |
| `BUY_PRESSURE_MINT_THRESHOLD`      | `25`            | Net demand required to trigger buy-pressure mint           |
| `DAILY_COMPANY_MINT_CAP`           | `10000`         | Max shares mintable per company per day                    |
| `CRON_SCHEDULER_TOKEN`             | —               | Required for production cron auth                          |
| `CRON_LOCAL_TOKEN`                 | —               | Required for local cron invocation                         |

---

## 9) Database Tables (Finance)

| Table                       | Purpose                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `users`                     | Player wallet (`money`), party membership                                                             |
| `parties`                   | Party treasury (`money`), membership fee (`party_subs`)                                               |
| `companies`                 | Company metadata, `capital`, `issued_shares`, `creator_id` (CEO)                                      |
| `stocks`                    | Current price, `brought_today`/`sold_today` counters (one row per company)                            |
| `user_shares`               | Player share holdings (unique per user+company)                                                       |
| `stock_orders`              | Buy/sell order book — `side`, `quantity`, `filled_quantity`, `price_per_share`, `status`, `game_hour` |
| `order_fills`               | Trade execution history — links buy and sell orders with fill details                                 |
| `share_price_history`       | Historical price snapshots (one per company per tick)                                                 |
| `share_issuance_events`     | Telemetry for every share mint event (policy, source, drift)                                          |
| `finance_kpi_snapshots`     | Time-series market cap, dividend pool, and per-share dividend data                                    |
| `game_state`                | Global game hour counter (single-row table)                                                           |
| `candidates`                | Campaign funds (`donations`), `votes_per_hour`, `donations_per_hour`                                  |
| `candidate_snapshots`       | Hourly vote/donation snapshots per candidate                                                          |
| `donation_history`          | Player-to-candidate donation records                                                                  |
| `transaction_history`       | General wallet transaction log                                                                        |
| `party_transaction_history` | Party treasury transaction log                                                                        |
