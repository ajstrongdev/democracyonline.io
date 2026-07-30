# Democracy Online v3 — Design Language

> **Status:** Design system reference for the v3 build.
> **Companions:** [V3_DESIGN.md](V3_DESIGN.md) (direction), [V3_PRD.md](V3_PRD.md) (requirements),
> [V3_ARCHITECTURE_FLOWS.md](V3_ARCHITECTURE_FLOWS.md) (architecture).
>
> This document is the **visual + interaction design language for the entire game**, not just the
> wiki. Democracy Online is a political _encyclopedia you play inside_: every screen — article
> pages, the bill editor, ranked ballots, the League floor, party boards — wears the same
> Wikipedia-style chrome. The wiki aesthetic is the product, not a section of it.

---

## 1. Philosophy

The PRD calls for a **full-site wiki/encyclopedia redesign** — "every page adopts the wiki
aesthetic (infoboxes, cross-links, history tabs), not just a separate wiki area" (R-WK-7). This doc
operationalises that into a reusable system.

The mental model for every screen:

> **You are reading (or editing) an encyclopedia entry about a living political world.**

Even an action — drafting a bill, ranking candidates, casting a cabinet vote — is framed as
_amending the record_. The interface is calm, text-forward, and reference-like; interactive
controls are **app-like panels embedded in the encyclopedic frame**, never a separate "app UI"
that breaks the spell.

### Design principles

1. **Document-first.** Long-form, readable, generous measure. Content leads; chrome recedes.
2. **Serif authority, sans clarity.** Serif (`--font-serif`, Lora) for titles and section
   headings gives the encyclopedic voice; sans (`--font-sans`, Plus Jakarta Sans) carries body and
   UI for legibility.
3. **The infobox is the anchor.** Every entity page pairs a prose column with a right-hand
   **infobox** summarising the entity at a glance (see `src/components/infobox.tsx`).
4. **Everything cross-links.** Entities reference each other inline as accent-coloured wiki-links
   (politician ↔ party ↔ bill ↔ nation). The world feels hyperlinked.
5. **Auto-generated, trustworthy.** Pages assemble from data (§13 of the design doc). The design
   must read well when _entirely machine-filled_ — no empty hero images, no hand-tuned layouts.
6. **Theme-agnostic.** All colour comes from semantic tokens, never hard-coded values, so the
   identical layout renders correctly across every theme (light, `dark`, `t3`, `dracula`,
   `rose-pine`, `catppuccin-dark`, `nord`, `solarized`, `solarized-light`).
7. **State over decoration.** Stages, lifecycles, vote tallies, and metrics are first-class visual
   elements (badges, pills, roll-up numbers), because the game _is_ state moving.

---

## 2. Foundations (tokens)

All foundations are **referenced by token name** from `src/styles.css`. Do not hard-code hex/oklch
values in components — consume the tokens (directly or via the ShadCN/Tailwind utilities that map
to them) so themes keep working. The one sanctioned exception is **entity-supplied colour** (a
nation flag's accent, a party colour) passed as an inline value into a primitive that contrasts it
automatically — see the Infobox `accentColor` prop.

### Colour roles

| Token                                | Use                                                             |
| ------------------------------------ | --------------------------------------------------------------- |
| `--background` / `--foreground`      | Page surface and primary text.                                  |
| `--card` / `--card-foreground`       | Infoboxes, panels, contents box, embedded action cards.         |
| `--muted` / `--muted-foreground`     | Field labels, captions, secondary metadata, taglines.           |
| `--primary` / `--primary-foreground` | Wiki-links, active nav, primary actions, accent banner default. |
| `--secondary`                        | Quiet badges/chips.                                             |
| `--accent` / `--accent-foreground`   | Hover surfaces, subtle highlights.                              |
| `--destructive`                      | Vetoes, "bill died", removals, danger actions.                  |
| `--border` / `--input`               | Hairlines between field rows, panel edges, inputs.              |
| `--ring`                             | Focus rings (accessibility — never remove).                     |
| `--sidebar*`                         | The app-shell rail (its own token group).                       |
| `--chart-1..5`                       | Stat charts, STV transfer flows, metric history.                |

> **Semantic, not literal.** "Green" is `--primary` _because it's the brand/link role_, not because
> it's green. Under `dracula` the same role renders purple and everything still reads correctly.

### Typography

| Token          | Family            | Applied to                                                                         |
| -------------- | ----------------- | ---------------------------------------------------------------------------------- |
| `--font-serif` | Lora              | Page titles (h1), section headings (h2/h3), infobox title. The encyclopedic voice. |
| `--font-sans`  | Plus Jakarta Sans | Body copy, field values, all UI controls, nav.                                     |
| `--font-mono`  | Roboto Mono       | Vote tallies, quotas, IDs, code/bot-API snippets, numeric columns.                 |

Type scale (use Tailwind steps): page title `text-3xl`–`text-4xl` serif bold; section heading
`text-xl`–`text-2xl` serif; body `text-base`/`text-sm`; labels & captions `text-xs`
`text-muted-foreground`. Keep a comfortable reading measure on the prose column
(~`max-w-3xl`/`prose`).

### Shape, depth, spacing

- **Radius:** `--radius` (1.25rem) is the family; cards/infoboxes use the large rounding, inline
  chips/buttons step down (`rounded-md`/`rounded-full`). Use ShadCN defaults which already derive
  from `--radius`.
- **Elevation:** the `--shadow-*` ramp. Infoboxes and floating panels sit on `shadow-md`/`-lg`;
  inline content stays flat. Depth is sparing — this is a document, not a dashboard.
- **Spacing:** the `--spacing` base (0.25rem) via Tailwind scale. Field rows breathe
  (`px-4 py-3`); sections are separated by hairlines and vertical rhythm, not heavy cards.
- **Hairlines:** `border-border/50–60` between field rows and under section headings is the core
  "encyclopedia" texture (see the screenshot's underlined headings and ruled field grid).

### Iconography

`lucide-react` (already configured as the ShadCN icon library). Icons are **functional and quiet**:
small inline glyphs before section headings, nav items, and field affordances. When an entity has
no image, its icon is shown on a **solid contrasting panel** (the Infobox `icon` media mode) rather
than a bare glyph — see §6.

---

## 3. App shell

The persistent frame around every route (the chrome in the screenshot). Built from the
`--sidebar*` token group and the `Card`/`Separator` primitives.

```
┌───────────────┬─────────────────────────────────────────────────────────┐
│  BRAND        │  HEADER (sidebar toggle · breadcrumb · page actions)     │
│  crown + name ├─────────────────────────────────────────────────────────┤
│               │                                                          │
│  PRIMARY NAV  │   ┌──────────────── article column ─────┐  ┌──────────┐  │
│  Profile      │   │  Title (serif)                       │  │ INFOBOX  │  │
│  Feed         │   │  "From Democracy Online…" tagline    │  │  (right  │  │
│  Find Users   │   │  ───────────────────────────────     │  │   rail)  │  │
│  Calendar     │   │  Lead paragraph (cross-linked)       │  │          │  │
│               │   │  ┌ Contents ┐                        │  │          │  │
│  SYSTEM GROUPS│   │  Section ▸ heading                   │  │          │  │
│  Parties   ▾  │   │  field rows / panels                 │  │          │  │
│  Bills     ▾  │   │  …                                   │  │          │  │
│  Elections ▾  │   └──────────────────────────────────────┘  └──────────┘  │
│  …            │                                                          │
│  (spacer)     │                                                          │
│  STATUS STRIP │                                                          │
│  UTILITY NAV  │                                                          │
│  Admin·Wiki·  │                                                          │
│  Theme·Signout│                                                          │
└───────────────┴─────────────────────────────────────────────────────────┘
```

### Left sidebar (rail)

- **Brand block:** crown mark + `democracyonline.io` wordmark, the brand accent on the TLD.
- **Primary nav:** flat, high-frequency destinations (Profile, Feed, Find Users, Calendar).
- **System groups:** collapsible sections that mirror the v3 systems a player acts in — e.g.
  Political Parties, Bills, Elections, League. Each is a disclosure (`chevron`) revealing
  sub-items. _Nav content tracks the v3 feature set; it is illustrative here, not fixed IA._
- **Active state:** current item uses `--sidebar-accent`/`--sidebar-primary` with the brand accent
  text; hover uses `--accent`.
- **Status strip:** a slot above the footer for at-a-glance account/politician context (e.g. which
  nation/persona is active, notification count). _Note: v3 removes personal currency — the
  v2 wallet figure in the screenshot is not carried over; this slot shows political context, not
  money._
- **Utility nav (footer):** lower-frequency + meta — Admin Panel (role-gated), Discord, Wiki,
  Theme switcher, Sign out. The Admin entry only renders for admin/moderator roles (§15.7 PRD).

The rail is **collapsible** via the header toggle for a wider reading column on dense pages.

### Header

Thin bar: sidebar toggle, optional breadcrumb (`Nation ▸ Politician`), and right-aligned
**page actions** (e.g. the `Edit` affordance in the screenshot, only on entities the viewer may
edit — primarily their own politician self-bio, per R-WK-4).

### Content region

A two-column grid: **prose/article column** (primary) + **infobox rail** (right, ~320px). The
infobox rail collapses **below** the article on narrow viewports (mobile: infobox first or after
lead, then sections). The article column holds the page anatomy in §4.

---

## 4. Wiki page anatomy

The canonical structure every **entity page** follows (Nation, Politician, Party, Bill, Election,
War, and any future entity). This is the backbone the whole game decorates.

1. **Title** — serif, bold, `text-3xl/4xl`. The entity's name verbatim.
2. **Tagline** — italic muted one-liner establishing context: _"From Democracy Online, the
   political simulation."_ (constant), optionally with an entity descriptor.
3. **Rule** — a hairline under the title block.
4. **Lead paragraph** — an **auto-generated** summary sentence/paragraph with **inline
   wiki-links** to related entities (party, nation, leaning). Mirrors the screenshot:
   _"**BiMaggieThatcher** is a representative on Democracy Online, affiliated with the
   [Liberal Party of Oscana]. They identify politically as Center Left…"_
5. **Contents box** — a compact bordered `--card` panel listing the page's sections as numbered
   anchor links. Appears when a page has 3+ sections. Left-aligned, narrow, sits in the prose flow.
6. **Sections** — each introduced by an **icon + serif heading** with an under-rule, followed by
   the section body (field grids, prose, or embedded panels). Section headings are the
   `InfoboxSection` heading pattern at page scale.
7. **Field grids** — two-column `label → value` rows (`grid-cols-[minmax,1fr]`, hairline-divided),
   the encyclopedic data texture. Labels muted; values `--foreground`, cross-linked where relevant.
8. **History tab** — every entity page exposes its immutable history (§13 design doc): a timeline
   of events. Presented as a secondary tab/section on the page, never a separate area.
9. **Infobox** — the right-rail summary card (§6).

### The infobox (right rail)

The `Infobox` primitive (`src/components/infobox.tsx`) is the standard summariser:

- **Accent banner** with the entity name + role/subtitle; banner colour is the entity's own colour
  (nation flag accent, party colour) via `accentColor`, with **auto-contrasting** text.
- **Media:** the entity's flag/avatar **image**, or — when none — its **icon on a solid panel**
  (transparent line-art needs a backing so it reads).
- **Tags:** status/role chips (e.g. `Active`, `Center Left`).
- **Grouped sections** of `label → value` rows (Status, Role, Party, Leaning, Member since, …).
- **Footer:** provenance/context line.

The infobox and the page's field grids are intentionally the **same visual language** at two
scales — the rail is the "abstract", the article is the "full record".

---

## 5. Encyclopedic voice & microcopy

Because pages are auto-generated, the _words_ are part of the design system.

- **Lead sentence formula:** `**{Name}** is a {role} on Democracy Online, affiliated with
{party-link}. They {identity clause}. {one or two notable facts}.` Neutral, third-person,
  present tense. Bold the subject on first mention.
- **Constant tagline:** _"From Democracy Online, the political simulation."_ — italic, muted,
  directly under every entity title (the encyclopedic "From Wikipedia…" echo).
- **Neutral register.** Encyclopedic and factual, never marketing. State outcomes plainly:
  "The bill was vetoed by the President.", "Elected on the third count."
- **Cross-links** are accent-coloured inline text (`text-primary`), no underline until hover.
  Link every entity mention; an unlinked proper noun is a bug, not a style choice.
- **Numbers are mono.** Tallies, percentages, quotas, dates-as-data render in `--font-mono` for
  scannability ("1,204 (41%)").
- **Empty/forming states** read as encyclopedic facts, not errors: "This nation is in the Founding
  stage; no Senate has formed yet." Never "No data".
- **The one human voice:** the politician **self-bio** is the sole free-text field (R-WK-4). Style
  it as a clearly delimited quote/prose block so machine-generated and human-written content are
  visually distinguishable.

---

## 6. Component inventory

What exists, and what each page composes from. Custom game components live in `src/components/`;
ShadCN primitives in `src/components/ui/`.

| Component   | Location                     | Role                                                                                                                            |
| ----------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Infobox** | `src/components/infobox.tsx` | The right-rail entity summariser (accent banner, image/icon media, tags, grouped field sections, footer). The anchor primitive. |
| `Card`      | `ui/card.tsx`                | Contents box, embedded action panels, forum threads, newspaper frames.                                                          |
| `Badge`     | `ui/badge.tsx`               | Status/role/stage pills, tags, vote outcomes.                                                                                   |
| `Button`    | `ui/button.tsx`              | All actions; variants map to intent (default/destructive/outline/ghost/link).                                                   |
| `Separator` | `ui/separator.tsx`           | Section under-rules, infobox footers, list dividers.                                                                            |

**Components to build** (same tokens/voice), each documented as it lands:

- **PageHeader** — title + constant tagline + rule + optional edit action.
- **ContentsBox** — numbered anchor list (the screenshot's "Contents" panel).
- **SectionHeading** — icon + serif heading + under-rule (the page-scale `InfoboxSection`).
- **FieldGrid / FieldRow** — the two-column `label → value` data texture.
- **WikiLink** — accent cross-link with entity-type awareness.
- **StatRollup** — category number with trend arrow ("Economy 62 ↑") + drill-down to sub-stats.
- **HistoryTimeline** — the per-entity immutable-event tab.
- **TransferFlow** — STV/IRV round-by-round visualisation (uses `--chart-*`).
- **Ballot** — ranked drag/number ballot panel.
- **VotePanel** — yes/no House vote + live tally.

Reuse beats bespoke: a new page should be ~90% existing primitives arranged in the §4 anatomy.

---

## 7. Page & screen catalogue

The design language covers **every screen**, grouped by how much they lean article vs panel.

### 7.1 Entity (article) pages — full §4 anatomy

| Page           | Infobox highlights                                               | Distinctive sections                                                                  | History                                                           |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Nation**     | flag, stage badge, officeholders, stat roll-ups, active policies | AI narrative lead, government, stats (roll-up → sub-stats), policies, League standing | elections, bills, policy changes, wars, League actions            |
| **Politician** | avatar/icon, party, leaning, member-since, offices               | biography (self-bio), party affiliation, voting history, offices held                 | career timeline across terms                                      |
| **Party**      | colour, leader, leaning, members, International                  | platform/stances, members, election results, newspaper                                | leadership changes, merges, editions                              |
| **Bill**       | status, stage, sponsor, stat deltas                              | clauses, AI-scored deltas, vote tallies, pipeline status                              | full journey (draft → House → Senate → concurrence → assent/veto) |
| **Election**   | office, method, seats, status                                    | candidates, results, **transfer flows**                                               | point-in-time event                                               |
| **War**        | belligerents, outcome                                            | teams, muster timeline, Manpower result (post-reveal)                                 | the muster timeline                                               |

Each fills the **same template**; only infobox fields and section content differ. New entity types
(e.g. Treaty, Sanction, Newspaper edition) plug into the identical anatomy.

### 7.2 Action screens — wiki frame, app-like panels

Interactive surfaces keep the shell, title, and encyclopedic framing, but the working area is an
**embedded `Card` panel with app-like controls**. The screen reads as "editing the record".

- **Bill editor** — clause list editor; AI-delta preview shown as the same field-grid the Bill page
  will display. Drafting = pre-writing the encyclopedia entry.
- **Vote / concurrence** — `VotePanel` with the bill summarised infobox-style alongside.
- **Election ballot** — `Ballot` panel; candidate cards show party labels (party-coloured chips).
- **Motions** — file/second/vote panels with type-specific threshold readouts.
- **League floor** — resolution panels (commend/condemn/sanction/treaty/war) each running a
  **cabinet vote** widget; the League **homepage** is article-style (metrics scoreboard +
  Internationals delegate board).
- **Parties & newspaper** — party admin panels; the newspaper renders as a **dated, page-flippable
  edition** with masthead and columns (its own print-like sub-aesthetic _inside_ the wiki frame).
- **Forums & DMs** — board/thread/post panels (`Card`-based); DMs are a quiet 1:1 panel.
- **Calendar** — nation-scoped schedule, document-styled grid/agenda.
- **Search** — typed, ranked results grouped by entity type, each row previewing an infobox-lite.

### 7.3 Flow & system screens

- **Onboarding / tutorial** — the sandbox wears the full chrome so the player learns the real UI;
  contextual-tip overlays use a consistent callout style. Ends at the **forced join** to Oscana.
- **Nations screen** — joinable nations as **infobox-style cards** (Oscana pinned), an active
  **Create nation** button (cap-aware), and the flag builder.
- **Flag / avatar builder** — curated SVG heraldry (emblem + layout + palette); no uploads. A
  panel tool that previews the result in an infobox in real time.
- **Notifications** — bell + list; account-scope vs politician-scope visually distinguished.
- **Admin / moderation** — role-gated review queue and report tooling; functional, same tokens.

---

## 8. Interaction, states & motion

- **Focus:** always-visible focus ring via `--ring`. Never suppress it; keyboard navigation is a
  requirement, not a nicety.
- **Hover:** links underline on hover; nav/rows tint with `--accent`.
- **Selected/active:** brand-accent text + subtle `--sidebar-accent` fill in nav; `data-*` slots on
  primitives (Infobox/Button/Badge expose `data-slot`/`data-variant`) for styling hooks.
- **Status colour mapping:** active/positive → `--primary`; danger/death/veto/removal →
  `--destructive`; neutral/secondary → `--secondary`/`--muted`. Stage and lifecycle each get a
  consistent badge palette drawn from these roles.
- **Loading:** skeletons that match the field-grid/infobox shape (document loading, not spinners).
- **Empty/forming:** encyclopedic sentences (see §5), never bare "No data".
- **Motion:** restrained (`tw-animate-css`). Disclosures, tab transitions, toast/notification
  entrances. No decorative animation on reading surfaces. Respect `prefers-reduced-motion`.

---

## 9. Accessibility & responsiveness

- **Contrast:** entity-supplied colours (flags/party colours) always pair with **auto-contrasted**
  foreground (the Infobox already computes black/white via WCAG luminance). Token pairs are
  designed to meet contrast across themes.
- **Semantics:** real headings (`h1`–`h3`), `dl`/`dt`/`dd` for field grids (as the Infobox does),
  `nav`/`main`/`aside` landmarks for shell/article/infobox, `figure`/`figcaption` for media.
- **Responsive:** infobox rail reflows below the article on small screens; the sidebar becomes a
  drawer; field grids may collapse to stacked label/value. Reading column never exceeds a
  comfortable measure on wide screens.
- **Mono numerics + tabular alignment** for tallies/results so columns scan.

---

## 10. Implementation notes

- **Tokens are the contract.** Style with semantic Tailwind utilities / ShadCN variants that map to
  `src/styles.css` tokens. The only inline colour permitted is **entity-supplied accent** passed to
  a contrast-aware primitive (Infobox `accentColor`/`tags[].color`/icon `background`).
- **Custom components** go in `src/components/` (outside `ui/`); generated ShadCN primitives stay in
  `src/components/ui/`. The `Infobox` is the reference for how a custom primitive should consume
  tokens, expose a large typed prop API, and handle contrast.
- **Theme-agnostic by construction.** Every component must render correctly under all themes listed
  in `.storybook/preview.tsx`; verify new components in Storybook across the theme toolbar.
- **Auto-fill first.** Design and test components with **fully machine-generated** content (longest
  plausible names, empty sections, missing media → icon fallback). If it only looks right with
  hand-picked data, it's wrong for this game.
- **Stories as spec.** Every shared component ships a `*.stories.tsx` (see
  `src/components/infobox.stories.tsx`) demonstrating the entity scenarios it serves.

---

## 11. Open design questions

- **Density toggle?** A "compact" reading mode for power users vs the generous default.
- **History tab vs inline.** Whether very active entities lazy-load/paginate history (tracks the
  PRD open tuning) and whether it's a tab or an expandable section.
- **Newspaper sub-aesthetic.** How far the page-flippable print look may diverge from the token
  system while staying themeable.
- **Mobile infobox placement.** Above the lead (quick facts first) vs after it (reading first).
- **Builder scope.** The curated SVG flag/avatar palette and emblem set (visual identity range).

```

```
