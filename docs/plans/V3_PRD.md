# Democracy Online v3 — Product Requirements Document (PRD)

> **Status:** Draft for build planning.
> **Source of truth for direction:** [V3_DESIGN.md](V3_DESIGN.md). This PRD translates that
> design into product requirements, user stories, acceptance criteria, scope boundaries, and
> success metrics. Where the design marks an item **OPEN**, this PRD captures it as a tuning
> parameter or open decision rather than a fixed requirement.

---

## 1. Overview

### 1.1 Product summary

Democracy Online v3 is a **multi-nation political simulator**. It replaces the v2 single-nation
idle/clicker (money, companies, stocks, vote-buying) with a pure governance game. Players hold
one global **account** and create a separate **politician** in each nation they join. Nations are
player-created worlds with their own government, laws, beliefs, stats, and history, all under a
global **League of Nations**.

### 1.2 Core game loop

> **Legislate → stats move → elections → history is recorded.**

Every system in the product exists to serve, gate, or record this loop.

### 1.3 Problem statement

v2's idle economy masked a structural weakness: the game is fundamentally about collective
decision-making, but the dominant mechanic was solo grinding for currency to buy votes. v3
removes the economy and makes **direct democratic participation** the entire game, while adding
multi-nation depth (diplomacy, war, a shared world stage) to create stakes beyond a single
sandbox.

### 1.4 Goals

1. Deliver a self-contained political loop that is engaging from the **first active player** in a
   nation and scales gracefully as population grows.
2. Make **one-human-one-vote** the foundational integrity rule across votes, elections, and war.
3. Give **out-of-power players genuine agency** (House vote + motions) so no one is a spectator.
4. Create **inter-nation consequences** (reputation, sanctions, treaties, war) via the League.
5. Auto-generate a **trustworthy encyclopedia/history** with effectively zero moderation surface.
6. Onboard new players via a **guided, hands-on tutorial** that ends with a forced join into a
   healthy default nation.

### 1.5 Non-goals (this release)

- No personal economy, currency, companies, stocks, markets, or idle accrual (removed entirely).
- No raw image uploads (flags/avatars come from a curated SVG builder only).
- No judiciary branch and no national constitution/charter (explicitly deferred).
- No real-money transactions or monetization features.
- **No phased rollout or continuous deployment of v3.** v3 is a full rewrite shipped as a single
  big-bang release that replaces v2 in one cutover (see §20).

---

## 2. Target users & personas

| Persona                     | Description                                                               | Primary needs                                                                                 |
| --------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **The Casual Citizen**      | Logs in occasionally, holds no office.                                    | A meaningful House vote on every bill, ability to second motions, low-friction participation. |
| **The Activist**            | Out of power but ambitious; wants to drive change without holding office. | File/second motions (Instruction, No-confidence, Referendum), join/build parties.             |
| **The Legislator**          | Holds a Senate seat or Cabinet post.                                      | Draft bills (Cabinet), propose clause amendments (Senate), see AI stat impact.                |
| **The Executive**           | Elected President.                                                        | Appoint/remove cabinet roles, toggle policies (budget-limited), represent nation in League.   |
| **The Nation-Builder**      | Founds and grows nations.                                                 | Create a nation (cap 3), customize flag/name, grow up the stage ladder.                       |
| **The Diplomat / Warlord**  | Operates at the League level.                                             | Commend/condemn, sanction, sign treaties, muster and resolve wars via cabinet votes.          |
| **The Party Boss / Editor** | Runs a party and its newspaper.                                           | Recruit, set platform, curate member-submitted newspaper issues, form coalitions/merges.      |
| **Admin / Moderator**       | Operates the game.                                                        | View account↔politician linkage for ban-evasion enforcement; react to abuse reports.          |

---

## 3. Identity & account model

### 3.1 Requirements

- **R-ID-1:** An **account** is global (auth/login, display name, settings, optional cross-nation
  reputation).
- **R-ID-2:** A **politician** is per-nation (name, avatar, role, party, voting record, bill
  history, stats).
- **R-ID-3 (invariant):** **At most one politician per account per nation**, enforced by a
  uniqueness constraint on `(accountId, nationId)`. One human = one House vote, one ballot, one
  seat per nation.
- **R-ID-4:** A single account **may hold office in multiple nations simultaneously** via
  distinct politicians.
- **R-ID-5:** Politician personas **do not leak across nations** to other players by default.
- **R-ID-6:** **Admins can view the account↔politician linkage** for moderation / ban-evasion.

### 3.2 Sockpuppet mitigation (anti-double-voting)

The whole game rests on one-human-one-vote; multiple accounts (sockpuppets) are the top systemic
risk. The following mitigations are **directional** — not all are required for launch:

- **R-ID-7 (launch):** Signup friction — verified email / auth provider; one account per identity.
- **R-ID-8 (target):** Activity gating — a politician must meet a small activity bar before its
  votes count.
- **R-ID-9 (target):** Per-nation join friction for small/private nations (founder review).
- **R-ID-10 (launch):** Admin linkage view for reactive enforcement (see R-ID-6).

### 3.3 Acceptance criteria

- Attempting to create a second politician in a nation the account already belongs to is rejected.
- An account can be a member of N nations and act independently in each.
- Admin tooling can resolve any politician to its owning account.

---

## 4. Onboarding & guided tutorial

### 4.1 Requirements

- **R-OB-1:** Every new account completes a **fully guided, interactive tutorial** in a scripted
  sandbox nation with NPC politicians before entering live play.
- **R-OB-2:** The tutorial teaches by **doing** (real actions in the sandbox), not slideshows.
- **R-OB-3:** The tutorial covers **every major system**: politician creation, House (vote +
  file/second a motion), Senate (clause amendment → House concurrence), Cabinet (draft bill → AI stat
  deltas → unlock policy), President (appoint role, toggle policy), parties + newspaper, war
  (muster-and-resolve walkthrough), diplomacy (League pass), and the wiki/history.
- **R-OB-4:** Tutorial actions have **no real-world consequences** (isolated sandbox).
- **R-OB-5:** The tutorial is **skippable but resumable**; progress is saved.
- **R-OB-6 (forced join):** The tutorial ends by **requiring** the player to create a politician
  in the default nation **Oscana** (name + avatar builder) before continuing.
- **R-OB-7:** Immediately after the forced join, surface a pointer to the **Nations screen** for
  joining/creating other nations.
- **R-OB-8 (contextual tips):** The first time a player hits a new system live (first election,
  first bill draft as cabinet, etc.), show a one-off inline explainer.

### 4.2 Nations screen (post-forced-join)

- **R-OB-9:** Lists **joinable user-generated nations** with **Oscana pinned at the top** (player
  already a member).
- **R-OB-10:** The **"Create nation" button is active** immediately after the forced join (up to
  the per-account cap of 3).

### 4.3 Open tuning

- Whether the tutorial nation is per-player ephemeral or a shared scripted demo.
- Which systems are taught in-tutorial vs deferred to contextual tips.

### 4.4 Acceptance criteria

- A new account cannot reach live play without either completing or explicitly skipping the
  tutorial, and in all cases ends as a member of Oscana with a politician.
- Skipping mid-tutorial and returning resumes at the last completed step.

---

## 5. Nations & lifecycle

### 5.1 Requirements

- **R-NA-1:** Each nation has an editable **name** and **flag** (President-editable).
- **R-NA-2:** Flags/avatars are built with a **curated SVG heraldry builder** (emblem + layout +
  palette). **No raw uploads.**
- **R-NA-3:** **Creation cap = 3 nations per account.** Joining is unlimited.
- **R-NA-4:** Nations are **public or private**.
- **R-NA-5:** **No founding gate** — after the forced join a player may immediately create a
  nation (spam is contained by the League member-count threshold, see §11).
- **R-NA-6 (lifecycle):** Nations move through `forming → active → dormant → archived`, driven by
  active-politician count and recent activity.
- **R-NA-7:** Dormant/archived nations are **hidden from default browse** but **remain readable**
  as lore.

### 5.2 Progressive unlock / stage ladder

A nation starts as an autocracy and unlocks institutions as its **active-politician count**
crosses thresholds. **Active** = a politician with real-time activity within N days; only active
politicians count.

| #   | Stage            | Active threshold  | Newly unlocked                                                  | Effect on founder                              |
| --- | ---------------- | ----------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| 0   | **Founding**     | 1                 | Solo bills, policies, stats, flag, name                         | Founder = President + whole government         |
| 1   | **Cabinet**      | 2                 | President appoints Cabinet; drafting delegable                  | Founder shares drafting                        |
| 2   | **Assembly**     | 4                 | **House vote unlocks** (Reps vote yes/no)                       | Founder's bills need House approval            |
| 3   | **Senate**       | 6                 | **Senate elections (PR-STV)** + clause amendments + concurrence | Founder loses unilateral text control          |
| 4   | **Republic**     | 9                 | **Presidential election (IRV)**; term limits begin              | Founder must win an election to stay President |
| 5   | **Member State** | Republic + stable | **League of Nations eligibility**                               | —                                              |

> Thresholds are placeholders to tune.

- **R-NA-8 (automatic + notify):** Progression is automatic with notification; never blocked on
  manual opt-in.
- **R-NA-9 (hysteresis):** Unlock thresholds are higher than revert thresholds (e.g. unlock
  Senate at 6, revert at 4) to absorb churn.
- **R-NA-10 (grace countdown):** Dropping below the revert line starts a real-time countdown
  (e.g. 48–72h); recovery within the window cancels the downgrade. This is also the on-ramp to
  dormancy.
- **R-NA-11 (election on unlock):** Unlocking schedules an election with a candidacy/campaign
  window — it does **not** instantly seat/depose. Founder is interim office-holder until resolved.
- **R-NA-12 (graceful downgrade):** In-flight bills (mid-pipeline) and open elections complete
  before a stage steps down.

### 5.3 Acceptance criteria

- A nation with 1 active player can draft and enact bills solo.
- Crossing a threshold schedules (not instantly seats) the relevant election.
- Rapid login/logout around a threshold does not flip stage state (hysteresis + grace verified).

---

## 6. Government structure

### 6.1 Requirements

| Body                         | Membership                             | Role                                                           |
| ---------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| **House of Representatives** | **Everyone** in the nation (automatic) | Votes yes/no on final bills                                    |
| **Senate**                   | Elected (PR-STV), smaller              | Refines bills via clause amendments                            |
| **Cabinet**                  | Appointed by President                 | Holds the bill-drafting monopoly                               |
| **President**                | Elected (IRV)                          | Appoints cabinet, toggles policies, assents to or vetoes bills |

- **R-GV-1:** Every nation member is automatically a Representative with a permanent House vote.
- **R-GV-2:** No player is ever fully "out of power" (everyone keeps a House vote).
- **R-GV-3 (cabinet free-form):** The President **creates, names, and removes cabinet roles** at
  will; there are no fixed portfolios.
- **R-GV-4:** All cabinet members have **equal power** — any may draft any bill; portfolios carry
  no domain restriction. **The President does not draft bills** — drafting is the Cabinet's role.
- **R-GV-5:** **Cabinet size scales with active population** so a small nation can't put its whole
  population in cabinet and leave no out-of-cabinet majority.

---

## 7. Legislative pipeline

### 7.1 Bills & clauses

- **R-LG-1:** Bills are **structured into clauses**; amendments are **clause-scoped** so conflicts
  are impossible by construction.
- **R-LG-2:** **Cabinet drafts** bills; **the President cannot draft** (drafting belongs to the
  Cabinet). The AI scores **clamped stat deltas** per bill (see §9).
- **R-LG-3:** A single bill **may both move stats and unlock a policy**; cabinet selects which
  policies a bill introduces.

### 7.2 Pipeline

The pipeline is **linear** — a bill moves forward through fixed stages with **at most one return
trip** (when the Senate amends), never an open-ended loop.

1. **R-LG-4 (House vote):** All Representatives vote yes/no on the Cabinet's draft. **Pass →** to
   the Senate; **fail →** the bill dies.
2. **R-LG-5 (Senate review):** The Senate reviews the House-approved bill and does exactly one of:
   - **Pass as-is →** to the President.
   - **Reject →** the bill dies.
   - **Amend →** senators propose clause-scoped amendments; the Senate votes; **one amendment wins
     per clause** (highest votes / first to threshold in the window). An amended bill returns to the
     House (R-LG-6).
3. **R-LG-6 (House concurrence, only if amended):** The House casts **one** yes/no vote on the
   Senate's amended text — **no new amendments**. This reconciles editing with the House's approval:
   the House always ratifies the exact text that reaches the President. **Concur →** to the
   President; **reject →** the bill dies.
4. **R-LG-7 (Presidential decision):** **Assent → law** (apply clamped stat deltas / toggle policies
   → wiki snapshot), or **veto → the bill dies.**
5. **R-LG-8 (per-stage deadlines / inaction):** House inaction (initial or concurrence vote) → bill
   **lapses**; Senate inaction → bill **advances to the President unchanged**; President inaction →
   bill **auto-assents** (the veto is an active choice, not a pocket veto).

- **R-LG-9 (variable Senate):** With 0 candidates there is no Senate that cycle; the bill skips the
  Senate (Cabinet draft → House vote → President). The pipeline must handle a variable-size chamber.

### 7.3 Open tuning

- Whether the AI **re-scores** stat deltas after each accepted amendment (live impact preview).

### 7.4 Acceptance criteria

- An amendment can only target a single clause; two amendments cannot modify the same clause in
  one round.
- A bill can never loop more than once: a Senate amendment triggers exactly one House concurrence
  vote, after which the bill either advances to the President or dies.
- A rejected (House/Senate), vetoed, or lapsed bill is recorded as terminal with its full stage
  history.
- Inactivity at a stage triggers the defined lapse/advance/auto-assent behavior, not a stall.

---

## 8. Motions — bottom-up agency

### 8.1 Requirements

- **R-MO-1:** Any Representative may **file a motion**; it requires **co-sponsors/seconds** to
  reach the House floor (anti-spam).
- **R-MO-2:** Cooldowns prevent immediate re-filing of a failed motion; a cap limits active
  motions.

| Motion type       | Threshold       | Effect if passed                                              |
| ----------------- | --------------- | ------------------------------------------------------------- |
| **Instruction**   | simple majority | Compels cabinet to draft a bill on a topic by a deadline      |
| **No-confidence** | supermajority   | Removes the **President** → early presidential election       |
| **Referendum**    | simple majority | Escalates a yes/no question to a whole-population direct vote |

- **R-MO-3 (compel has teeth):** If cabinet ignores a passed Instruction motion past its deadline,
  the **motion text auto-promotes into a bill** and enters the normal Senate → House pipeline.
- **R-MO-4:** No-confidence removes **only the President** (not individual ministers) and triggers
  an early election. (Distinct from the passive inactive-President caretaker rule in §10.)
- **R-MO-5 (cabinet speed advantage):** Cabinet drafts directly and fast; motions are
  deliberately slower (second → vote → deadline → maybe auto-bill). Cabinet = efficient path,
  motions = override.

### 8.2 Acceptance criteria

- A motion without enough seconds never reaches a House vote and expires.
- A passed Instruction motion that cabinet ignores produces an auto-bill at the deadline.
- A passed No-confidence motion removes the sitting President and schedules an early election.

---

## 9. Policies & nation stats

### 9.1 Policies (national beliefs)

- **R-PO-1:** A **policy** is an official national position (e.g. "Gay marriage is legal" vs
  "illegal"), a **separate entity** from party stances.
- **R-PO-2:** Policies are **unlocked through bills** (bill = key, policy = door).
- **R-PO-3:** Enabled policies apply **passive modifiers** to stats and to **International
  standing** (the basis for League commend/condemn).
- **R-PO-4 (budget):** A government may **introduce or revoke 3 policies per 4-week presidential
  term**.

### 9.2 Nation stats

Structure: **categories → sub-stats**; the category score rolls up its sub-stats.

| Category          | Example sub-stats                                             |
| ----------------- | ------------------------------------------------------------- |
| **Economy**       | growth, employment, treasury/debt, inflation                  |
| **Social**        | approval, equality, healthcare, education, crime              |
| **Stability**     | corruption, civil liberties, unrest                           |
| **International** | Prestige, Trust, Belligerence (the three League metrics, §11) |

- **R-ST-1:** Bills move sub-stats via **AI-generated, clamped** deltas — **balance is enforced by
  clamping logic, not the model**.
- **R-ST-2:** Policies apply ongoing passive modifiers.
- **R-ST-3:** Use the **TanStack AI package** with a cheap model strong at structured output.
- **R-ST-4 (display):** Homepage shows category roll-ups ("Economy: 62 ↑"); detail view shows
  contributing sub-stats.

### 9.3 Acceptance criteria

- An AI-proposed delta outside clamp bounds is clamped before being applied — never applied raw.
- A nation cannot exceed 3 policy changes within a single 4-week presidential term.

---

## 10. Elections

### 10.1 Requirements

Elections are **direct** (no idle accrual, money, or vote-buying). Both offices use the **same
ranked ballot**; only the count differs. Every Representative may vote.

| Office        | Seats    | Method                                                               | Term    |
| ------------- | -------- | -------------------------------------------------------------------- | ------- |
| **Senate**    | multiple | **multi-seat PR-STV** (Droop quota, surplus + elimination transfers) | 2 weeks |
| **President** | 1        | **IRV / Alternative Vote**                                           | 4 weeks |

- **R-EL-1 (ballot model):** Candidate-centric STV with party labels (hybrid). Voters rank
  individual candidates; ballots show each candidate's party; independents can win.
- **R-EL-2 (display):** Show each candidate's vote share and how transfers flowed across rounds.
- **R-EL-3 (Droop quota):** `floor(votes / (seats + 1)) + 1`.
- **R-EL-4 (Senate size):** `seats = max(1, floor(candidates / 2))` (half the candidates win,
  round down). Unopposed candidate is elected automatically; **0 candidates → no Senate** that
  cycle.
- **R-EL-5 (cadence):** Senate term 2 weeks, President 4 weeks, staggered → two Senate elections
  per presidential term. The "3 policies per term" budget tracks the 4-week presidential term.
- **R-EL-6 (eligibility):** Anyone may stand for Senate or President; no party requirement.
- **R-EL-7 (no quorum):** Whoever votes decides; low turnout self-corrects next cycle.

### 10.2 Vacancies

- **R-EL-8 (Senate):** Refilled by **countback** — reuse stored ranked ballots to seat the
  next-eligible candidate without a new vote.
- **R-EL-9 (President inactive):** **No early election** — the **cabinet collectively exercises
  caretaker powers** until the 4-week term ends, then a normal election runs.

### 10.3 Open tuning

- Candidacy-declaration window vs voting-window lengths.
- Countback variant (re-run excluding departed member vs transfer their electing ballots).

### 10.4 Acceptance criteria

- STV counts produce auditable round-by-round transfer flows persisted with the result.
- A Senate vacancy is filled via countback without scheduling a new election.
- A President going inactive does not trigger an early election (caretaker cabinet until term end).

---

## 11. League of Nations

The League is the only system that creates **inter-nation consequences**. Each capability is its
own subsystem.

### 11.1 Membership & structure

- **R-LN-1:** Members are **nations**, eligible only at **Member State** stage (ladder #5), which
  requires a minimum member count. This is the **anti-spam gate** — vanity nations can't reach the
  world stage until they attract real members.
- **R-LN-2:** **Fully flat** — every Member State is equal, **1 nation = 1 vote**.
- **R-LN-3 (cabinet casts the vote):** Every League ballot triggers an **internal cabinet vote**
  in each member nation; the nation's single League vote is the cabinet's collective decision.
- **R-LN-4:** Nation-level acts that aren't League-wide ballots (declaring war, signing a treaty)
  also go through the internal cabinet vote.

### 11.2 Internationals (cross-nation party blocs)

- **R-LN-IN-1:** An **International** is a **global ideological bloc of parties** (e.g. a Socialist
  or Liberal International) that groups **parties from different nations** sharing a platform.
- **R-LN-IN-2:** Internationals are **global** (not nation-scoped). A **party affiliates with at
  most one International**; its **party leader** opts the party in or out.
- **R-LN-IN-2a (Member State gate):** Only parties whose nation has reached **Member State** stage
  (ladder #5 — the same gate as League membership) may affiliate. A party in a pre–Member State
  nation **cannot join an International**; if its nation later drops below Member State, its
  affiliation is suspended until the nation regains the stage.
- **R-LN-IN-3 (no mechanical power):** Internationals are a **soft diplomatic/cosmetic layer** —
  they do **not** vote, hold office, or alter game mechanics. They exist to show how movements span
  the world.
- **R-LN-IN-4 (delegates):** A nation's **President + Cabinet members** are its **delegates**. The
  **League of Nations homepage displays, per International, the total delegate count** (Cabinet
  members + President summed across **all** Member State nations) whose party is affiliated with
  that International — a live "which blocs hold the world's executive seats" scoreboard.
- **AC:** Affiliating/un-affiliating a party updates the homepage delegate tally; only Member State
  nations' parties can affiliate; a party with no International is excluded; counting only includes
  sitting Presidents + Cabinet members.

### 11.3 League metrics

Three bounded, decaying public metrics form the scoreboard + inter-nation history:

| Metric           | Up from                                               | Down from                                              | Represents                 |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------ | -------------------------- |
| **Prestige**     | commendations, won wars, upheld treaties              | condemnations, sanctions, lost wars, abandoning allies | Headline global reputation |
| **Trust**        | honoring pacts, keeping treaties, brokering peace     | breaking treaties, aggressive war                      | Reliability as a partner   |
| **Belligerence** | declaring wars, proposing sanctions (decays in peace) | peace, time without aggression                         | Visible warning flag       |

- **R-LN-5 (self-balancing brake):** A warmonger can have high Prestige but low Trust — feared but
  friendless — making alliances harder without a hard rule.

### 11.4 Subsystem 1 — Commendations & Condemnations

- **R-LN-6:** A member proposes; passes by **simple majority** (severity-scaled thresholds).
- **R-LN-7:** Commend → bounded Prestige boost + badge; Condemn → bounded, **decaying** Prestige
  penalty + mark.
- **R-LN-8:** ~1 week **cooldown** before re-proposing the same judgment against the same nation.

### 11.5 Subsystem 2 — Sanctions

- **R-LN-9:** Proposed against a target; passes by **supermajority**.
- **R-LN-10:** Bounded passive stat penalty while active; **decays**, is **liftable** via repeal
  vote, and **auto-expires** after a long window.
- **R-LN-11:** Aggressor-side standing cost discourages frivolous use.

### 11.6 Subsystem 3 — Treaties

Ratified **only by the signatories' cabinets** (non-signatories don't vote):

| Treaty                            | Effect                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| **Peace treaty** (non-aggression) | Declaring war on a co-signatory carries heavy Trust + Prestige penalty              |
| **Alliance** (mutual-defense)     | Triggers the reinforcement chain in war; honoring builds Trust, abandoning costs it |

### 11.7 Subsystem 4 — War (muster-and-resolve)

War is a **one-shot event**, not ongoing attrition. **There are no armies; a nation's stats are
its military strength.**

- **R-LN-12 (Manpower):** Manpower = **pooled stats only** (no population term); a team's Manpower
  is the sum of its members' stats. Well-governed nations win wars.
- **R-LN-13 (muster):** Declaration opens an X-day window. Originators' allies receive a
  _reinforce?_ invite (mutual-defense pacts give a casus belli); each ally's **cabinet votes** to
  join/decline. **Declining pays a Trust/standing penalty.**
- **R-LN-14 (cascade):** Allies-of-allies can be invited with no hard depth cap; the chain only
  spreads as far as cabinets choose to join (world war possible by collective decision).
- **R-LN-15 (hidden totals):** Manpower totals are **hidden until resolution** → the
  intervention/stand-down window is **brinkmanship**, not a calculated decision.
- **R-LN-16 (resolution):** A single comparison; higher Manpower wins.
  - Winner: small, bounded Prestige/stat boost.
  - Losers (all on losing team): **bounded** stat hit **proportional to the margin**, with a
    **recovery floor** so a nation can't drop below a recoverable baseline. **No death spirals.**

### 11.8 Peace

- **R-LN-17:** Peace = standing down during the intervention window. Both originating cabinets
  stand down → no war.
- **R-LN-18:** The **League can force a ceasefire** before comparison via a **supermajority**
  resolution (the League's primary teeth).

### 11.9 Anti-griefing guardrails

- **R-LN-19:** Member States only (newcomers shielded).
- **R-LN-20:** Severity-scaled thresholds (sanctions/war-adjacent need supermajority).
- **R-LN-21:** All negative effects bounded + decaying.
- **R-LN-22:** Cooldowns on re-proposing failed condemns/sanctions.
- **R-LN-23:** Aggressor pays standing (Belligerence up, Trust down).
- **R-LN-24:** Loser hit has a recovery floor.

### 11.10 Open tuning

- Muster window length, vote windows (~48–72h start), cooldown lengths.
- Manpower formula weighting across stat categories.
- Whether a nation allied to opposing belligerents must pick one side.

---

## 12. Parties & newspaper

### 12.1 Parties

- **R-PA-1:** Players can **create parties**, recruit members, set platforms/stances, form
  **coalitions**, and **merge**.
- **R-PA-2 (kept):** Party platform stances (`political_stances`, `party_stances`),
  coalitions/merges, and primaries carry over from v2.

### 12.2 Newspaper

- **R-NP-1:** Party **members submit stories**; the **party leader curates/approves**.
- **R-NP-2:** An issue requires a **minimum number of approved submissions** before publishing
  (forces collective effort).
- **R-NP-3:** Published as a **dated, immutable, page-flippable edition** with a real newspaper
  layout (masthead, columns); editions are archived as primary-source lore in the wiki.

---

## 13. Wiki & history

The "wiki" is two layers: a **history layer** (immutable data) and a **presentation layer** (typed
entity pages generated from history). Pages are never hand-written.

### 13.1 Storage model (live state + immutable snapshots, NOT event sourcing)

- **R-WK-1:** **Live, mutable tables** hold current state (stats now, current officeholders,
  active policies).
- **R-WK-2:** **Immutable point-in-time records** capture completed events (bill outcome, election
  result, war resolution); write-once, never edited — these are the history.
- **R-WK-3 (daily snapshot):** A lightweight per-nation **daily stats snapshot** so stats can be
  charted over time (reuse the existing `candidateSnapshots` pattern). The **same daily tick
  regenerates the AI nation narrative** (one job, two outputs).

### 13.2 Page types (typed, auto-assembled)

Every page has an auto-generated sidebar/infobox and auto wiki-links cross-referencing related
entities (politician ↔ party ↔ bill ↔ nation).

| Page type      | Auto content                                                           | History                                                                       |
| -------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Nation**     | flag, stage, officeholders, stats, active policies, **AI narrative**   | every election, bill, policy change, war, League action                       |
| **Politician** | avatar, party, offices held, voting record, **human-written self-bio** | career timeline across terms                                                  |
| **Party**      | platform/stances, members, election results                            | leadership changes, merges, newspaper editions                                |
| **Bill**       | clauses, stat deltas, vote tallies, final status                       | full legislative journey (draft → House → Senate → concurrence → assent/veto) |
| **Election**   | candidates, results, STV transfer flows                                | point-in-time event                                                           |
| **War**        | belligerents, teams, outcome                                           | muster timeline                                                               |

### 13.3 Human-written vs generated

- **R-WK-4:** The **only** human-written field is the **politician self-bio** (free text on their
  own page).
- **R-WK-5:** The AI-narrated nation summary is regenerated daily and **overwrites** — only the
  latest is kept (no archived chronicle).
- **R-WK-6:** Everything else is auto-generated from data (no moderation surface).

### 13.4 Visual scope

- **R-WK-7:** **Full-site wiki/encyclopedia redesign** — every page adopts the wiki aesthetic
  (infoboxes, cross-links, history tabs), not a separate wiki area.

### 13.5 Known risk (accepted)

- **R-WK-8:** The self-bio has **no moderation** (accepted). Cheap future mitigation: a report
  button + admin review (near-zero effort to add later).

### 13.6 Open tuning

- AI narrative prompt/length and exact daily-tick timing.
- Whether bill/election history tabs paginate or lazy-load for very active nations.

---

## 14. Calendar

- **R-CA-1 (built from scratch):** The calendar is **built from scratch for v3**; the v2
  implementation is not carried over.
- **R-CA-2 (nation-scoped):** `getCalendarData()` must filter by `nationId`; each nation runs its
  own election cadence (different nations vote on different days).
- **R-CA-3:** Cadence is driven by the staggered terms from §10 (Senate every 2 weeks, President
  every 4 weeks); each nation's clock starts when its stages unlocked.

---

## 15. Platform & social systems

These systems support the political loop and **replace v2's chat, feed, and Discord bot**. All
user-generated content (UGC) is reportable and covered by the moderation MVP (§15.7).

### 15.1 Search

- **R-SR-1:** A global search indexes nations, politicians, parties, bills, elections, wars, and
  wiki pages, scoped so results respect nation visibility (public vs private).
- **R-SR-2:** A server-side query API returns typed, ranked results; the search UI groups them by
  entity type.
- **AC:** searching a known entity name returns it; private-nation content is hidden from
  non-members.

### 15.2 Forums

- **R-FO-1:** Each nation has **public** discussion boards; each party has a **private** board for
  its members.
- **R-FO-2:** Boards contain threads; threads contain posts. Posts are nation-scoped and
  reportable.
- **AC:** a member can create a thread and reply; non-members cannot post to a private party board.

### 15.3 Direct messages

- **R-DM-1:** Politician-to-politician **1:1** DMs within a nation (replaces v2 global chat).
- **R-DM-2:** DMs are private and **mod-viewable only when reported** (§15.7).
- **AC:** two politicians in the same nation can exchange messages not visible to others.

### 15.4 Activity feed

- **R-AF-1:** A recent-events feed reads the history log (§13) and surfaces notable nation events
  (bills enacted, elections seated, League actions, lifecycle changes).
- **AC:** enacting a bill produces a feed entry visible to the nation.

### 15.5 Notifications

- **R-NT-1:** Notifications are scoped to an **account** or a **politician**.
- **R-NT-2:** In-game politician notifications drive participation ("Vote on this bill", "Election
  open"); account notifications cover cross-nation/platform events and **private-nation invites**.
- **R-NT-3:** A notification bell/UI lists unread items.
- **AC:** when a bill reaches the House vote, eligible politicians receive a notification.

### 15.6 Bot API

- **R-BT-1:** A reworked, **nation-scoped** bot API with token-based auth (replaces the v2 Discord
  bot and `access_tokens`).
- **R-BT-2:** Read / limited-write endpoints for nation state, bills, and elections; documented.
- **AC:** a valid token can read its nation's current bills; invalid tokens are rejected.

### 15.7 Admin & moderation (MVP)

- **R-MO-1:** **Admin** and **moderator** roles gate privileged actions.
- **R-MO-2:** A **report button** on every UGC surface (self-bio, party/nation names, forum posts,
  DMs, newspaper submissions) files a report.
- **R-MO-3:** A moderator **review queue** supports content removal and account **ban/suspension**;
  private DMs are mod-viewable **only when reported**.
- **AC:** a reported forum post appears in the queue; a moderator can remove it and suspend the
  author.

---

## 16. Removed systems

Deleted from v3 (~a third of the current schema). Removal is a hard requirement:

- **R-RM-1:** Personal currency / `money`, `lastActivity`-driven idle mechanics.
- **R-RM-2:** `votesPerHour` / `donationsPerHour` accrual, `items`, `candidatePurchases`,
  donations.
- **R-RM-3:** Entire finance stack — `companies`, `stocks`, `userShares`, `sharePriceHistory`,
  `shareIssuanceEvents`, `stockOrders`, `orderFills`, `financeKpiSnapshots`.
- **R-RM-4:** Candidate idle tracking — `candidateSnapshots` (finance use), `donationHistory`,
  transaction histories.

---

## 17. Data model requirements (high level)

v3 is built on a **clean new schema** (§20) with **no v2 data carried forward**. "New / Replaces /
Carried over" below describe the v3 schema's relationship to v2 **concepts**, not an in-place
migration of live tables or rows.

- **New:** `nations`, `politicians`, `policies`, `nation_policies`, `nation_stats`,
  `bill_clauses`, `amendments`, `motions`, `motion_seconds`, `motion_votes`, `newspapers`,
  `newspaper_issues`, `newspaper_submissions`, `league_resolutions`, `league_commendations`,
  `history_snapshots`, `forums`, `forum_threads`, `forum_posts`, `direct_messages`,
  `notifications`, `reports`, `moderation_actions`, `internationals`, `party_internationals`.
- **Reworked for v3:** the bot API + tokens replace the v2 Discord bot / `access_tokens`; `forums`
  and `direct_messages` replace v2 chat; the activity feed replaces the v2 feed; search indexes the
  new entities.
- **Replaces v2 concepts (nation-scoped):** `accounts` (replaces `users`), `parties (+nationId)`,
  `bills (+nationId, clause-based, linear stage machine)`, per-chamber bill votes,
  `elections (+nationId, PR-STV)`, `candidates (PR-STV)`.
- **Carried over (concepts re-implemented in v3):** party platform stances (`political_stances`,
  `party_stances`), coalitions/merges, primaries.
- **Deferred:** judiciary branch, nation charter/constitution.

---

## 18. Non-functional requirements

- **NFR-1 (time model):** Real-time (hours/days), not discrete turns.
- **NFR-2 (integrity):** One-human-one-vote enforced at the data layer (`(accountId, nationId)`
  uniqueness) and respected by all vote/election/war tallies.
- **NFR-3 (AI safety/balance):** All AI-produced stat deltas are clamped server-side; the model is
  never trusted for balance. Use the TanStack AI package with a cheap structured-output model.
- **NFR-4 (no uploads):** No raw image upload path anywhere; flags/avatars are SVG-builder output.
- **NFR-5 (auditability):** Completed events (bills, elections, wars, League actions) are stored as
  immutable records sufficient to render history and STV transfer flows.
- **NFR-6 (scalability of history):** Daily snapshots are lightweight; history tabs for very active
  nations may paginate/lazy-load (tuning).
- **NFR-7 (moderation surface):** Auto-generated wiki pages have no editable surface. All
  user-generated content (self-bio, forum posts, DMs, newspaper submissions, party/nation names) is
  **reportable** and covered by the moderation MVP (§15.7); private DMs are mod-viewable only when
  reported.
- **NFR-8 (resilience to inactivity):** Every stage has deadlines/caretaker rules so inactive
  players cannot deadlock bills, elections, or nations.

---

## 19. Success metrics

| Goal                        | Metric                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------- |
| First-session comprehension | % of new accounts that complete the tutorial and cast their first House vote in Oscana. |
| Out-of-power agency         | % of active players who second or file a motion within their first week.                |
| Healthy nations             | # of nations reaching Assembly (House) and Senate stages; dormancy rate.                |
| Legislative throughput      | Bills enacted vs died per nation per week; pipeline completion rate.                    |
| Election participation      | Turnout per Senate/President cycle (despite no quorum requirement).                     |
| Inter-nation engagement     | # of Member States; League actions (commend/condemn/sanction/treaty/war) per week.      |
| Integrity                   | Detected/actioned sockpuppet cases; share of votes from activity-gated politicians.     |
| Retention                   | D1/D7/D30 retention of new v3 signups (fresh-world baseline; no v2 carryover).          |

---

## 20. Build plan — single full-rebuild release

v3 is a **full rebuild** and a **hard breaking change**: the entire game is rewritten from scratch
and ships as **one single release**. There is **no phased rollout, no continuous deployment of v3
systems to production, and no migration of v2 data or accounts**. v2 continues to run untouched
until v3 is feature-complete and replaces it in a **single cutover**.

**Breaking change — fresh start:**

- **No data is carried forward.** v3 launches with a **fresh world** (empty except for the default
  nation, Oscana). No v2 nations, parties, bills, or history are imported.
- **Users must sign up again.** v2 accounts/logins are **not** migrated; every player creates a new
  v3 account and is taken through the guided tutorial from scratch.
- **No backward compatibility.** v3 does not read v2 tables, APIs, or save state. The break is total
  and intentional.

**Implications:**

- **No partial deploys.** Individual systems are not shipped to players one at a time; everything
  below is built behind the scenes and released together.
- **Clean schema.** v3 is built on a **new schema**, not an evolution of the v2 tables. There is no
  nullable-`nationId`-then-backfill dance on the live database.
- **One cutover.** At launch, v3 replaces v2 wholesale; v2 is retired.

The list below is **internal build sequencing** (dependency order for the team), **not** a
deployment schedule — none of these are user-visible milestones; they all converge into the same
release.

1. **Nations & identity foundation.** New schema with `nations`, `accounts`, and `politicians`;
   `nationId` scoping throughout; `(accountId, nationId)` uniqueness invariant.
2. **Political loop.** Clause-based bills, linear pipeline, PR-STV/IRV elections, nation stats,
   policies, AI bill scoring, motions.
3. **Social/meta systems.** Party newspapers, League of Nations, wiki/history layer.
4. **Onboarding.** Guided tutorial + forced join to Oscana + Nations screen.
5. **Visual overhaul.** Full-site wiki aesthetic.

> The tutorial depends on most systems existing in the sandbox; build it after the loop and meta
> systems are functional, but design its scripts alongside each system as it lands.

> The removed v2 systems (§16) simply do not exist in the new codebase — there is nothing to
> "delete" at runtime; they are absent by construction in the rewrite.

---

## 21. Risks & mitigations

| Risk                                              | Impact                                    | Mitigation                                                                                                        |
| ------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Sockpuppets** (multi-account vote/war stuffing) | High — undermines core integrity          | Signup friction, activity gating, per-nation join friction, admin linkage view (§3.2).                            |
| **Ghost-town nations**                            | Players land in empty worlds              | Forced join to populated Oscana; League member-count gate keeps vanity nations isolated; dormancy lifecycle.      |
| **AI imbalance**                                  | Bills produce broken stat swings          | Server-side clamping is authoritative; model never trusted for balance (NFR-3).                                   |
| **Inactivity deadlock**                           | Bills/elections/nations stall             | Per-stage deadlines, caretaker cabinet, hysteresis + grace, auto-advance/lapse (NFR-8).                           |
| **War death spirals**                             | Losing nations become unrecoverable       | Bounded, margin-proportional hits with a recovery floor (R-LN-16, R-LN-24).                                       |
| **Self-bio abuse**                                | Slurs/harassment/illegal content          | Moderation MVP at launch: report button on all UGC + moderator review queue with removal/ban (§15.7, R-WK-8).     |
| **League griefing**                               | Coordinated condemn/sanction/war pile-ons | Supermajority thresholds, cooldowns, bounded+decaying effects, aggressor standing cost, League ceasefire (§11.9). |
| **Rebuild scope**                                 | Full rewrite shipped in one cutover       | Build v3 alongside live v2 on a clean schema; single big-bang release with no in-place migration (§20).           |

---

## 22. Open questions (parking lot)

- Stage thresholds + hysteresis gaps + grace-period length (§5).
- Live AI re-scoring after each amendment? (§7)
- Election windows (candidacy vs voting); countback variant (§10).
- League: muster window length, Manpower weighting, dual-side conflict edge case (§11.10).
- AI narrative prompt/length and daily-tick timing; history pagination (§13).
- Tutorial nation: per-player ephemeral vs shared scripted demo; in-tutorial vs contextual-tip
  coverage (§4).
- Deferred: judiciary branch, nation charter/constitution (revisit after core loop).
