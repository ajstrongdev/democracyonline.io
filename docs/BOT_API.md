# Public Discord Bot API

The public, read-only API is `GET /api/bot?endpoint=…`. It requires no token and returns JSON. Do not use it for private account information or write operations. Examples below use the production hostname; substitute the development hostname for staging checks.

```bash
curl -fsS 'https://oscana.nya.je/api/bot?endpoint=game-state'
```

## Query contract

| `endpoint` (required) | Optional parameters                  | Response                                                                     |
| --------------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| `users`               | `id` **or** `limit` and `offset`     | User object for `id`, otherwise an array of users                            |
| `parties`             | `id` **or** `limit` and `offset`     | Party object with `members` for `id`, otherwise an array of parties          |
| `bills`               | `stage`, `status`, `limit`, `offset` | Filtered array; **without** `stage` and `status`, an object grouped by stage |
| `posts`               | `limit`, `offset`                    | Newest Z.com posts                                                           |
| `candidates`          | `election`, `limit`, `offset`        | Array of current-cycle candidates                                            |

**Posts** (`?endpoint=posts`): `id`, `userId`, `username`, `accountKey`, `accountPartyId`, `content`, `createdAt`. Posts are ordered newest first; `accountKey` is `null` for a player post and `party` or `potro` for posts made from those accounts. `userId` and `accountPartyId` can be `null` when the related account has been removed.
| `game-state` | None | Array of current President/Senate election states, each with a `candidates` array |

`id` must be an integer from 1 to 2,147,483,647. IDs cannot be combined with pagination. Lists default to `limit=50&offset=0`; `limit` must be 1–100 and `offset` 0–10,000. Follow pages by incrementing `offset` until the page has fewer than `limit` records. Users, parties, and bills sort by ascending ID; candidates sort by concluded points and then ID (see below). Updates to the database between requests can shift offset pages. The bills page applies **before** grouping, so a grouped page can have fewer than `limit` entries in each stage. The party-detail `members` array and `game-state` rosters are not paginated.

Allowed filters (case-sensitive):

- `stage=House|Senate|Presidential` (`Presidency` is accepted as a legacy alias for `Presidential`, but responses always say `Presidential`).
- `status=Committee|Voting|Passed|Defeated`.
- `election=President|Senate`.

Unknown, repeated, empty, or out-of-range query parameters return `400` with `{ "error": "…" }`. Supply each query parameter only once. Unfiltered bills are grouped under `House`, `Senate`, and `Presidential`, including empty arrays; filtered bills return an array even if the filter matches zero rows.

## Response fields

All nullable fields below can be `null`. Timestamps are JSON ISO 8601 strings (or `null`). Field names are case-sensitive.

**Users** (`?endpoint=users` or `?endpoint=users&id=1`): `id`, `username`, `bio`, `role`, `partyId`, `politicalLeaning`, `isActive`, `lastSeenAt`, `archivedAt`, `partyName`, `partyColor`. `lastSeenAt` is a timestamp, **not** a day count; it approximates recent activity rather than a live socket connection. The deprecated `lastActivity` field is not returned.

**Parties** (`?endpoint=parties` or `?endpoint=parties&id=5`): `id`, `name`, `color`, `bio`, `leaderId`, `politicalLeaning`, `leaning`, `logo`, `discord`, `memberCount`. Detail responses add `members: [{ id, username, role }]`; list responses do not. `memberCount` counts current members, including inactive members still assigned to the party.

**Bills** (`?endpoint=bills`, `?endpoint=bills&stage=House`, `?endpoint=bills&status=Voting`, or both filters): `id`, `status`, `stage`, `title`, `creatorId`, `content`, `createdAt`, `pool`, `creatorUsername`. `content` is the bill's full text. A missing creator yields `creatorUsername: null`. The unfiltered response shape is `{ "House": [...], "Senate": [...], "Presidential": [...] }`.

**Candidates** (`?endpoint=candidates` or `?endpoint=candidates&election=President`): `id`, `userId`, `username`, `election`, `points`, `partyId`, `partyName`, `partyColor`. `points` is **null until that election reaches `CONCLUDED`**, including during election night; do not treat null as zero or infer live rankings. Concluded candidates sort by points descending, with candidate ID as the tie-breaker; sealed candidates follow in ID order. These are current-cycle candidates, not a historical election archive.

**Game state** (`?endpoint=game-state`): one entry per configured President or Senate election with `election`, `status`, `seats`, `cycle`, `candidacyStartsAt`, `candidacyEndsAt`, `votingStartsAt`, `votingEndsAt`, `electionNightStartsAt`, `electionNightEndsAt`, `concludedAt`, and `candidates` (with the candidate fields above). Status is `CANDIDACY`, `VOTING`, `ELECTION_NIGHT`, or `CONCLUDED`. Some deadlines are null outside their phase. The API returns raw deadlines; calculate time remaining relative to the current clock rather than relying on a `daysLeft` field (none is returned). A newly initialized database may have no election rows yet.

Example (sealed results during voting):

```json
[
  {
    "election": "President",
    "status": "VOTING",
    "seats": 1,
    "cycle": 1,
    "candidacyStartsAt": "2026-09-20T00:00:00.000Z",
    "candidacyEndsAt": "2026-09-22T00:00:00.000Z",
    "votingStartsAt": "2026-09-22T00:00:00.000Z",
    "votingEndsAt": "2026-09-28T00:00:00.000Z",
    "electionNightStartsAt": null,
    "electionNightEndsAt": null,
    "concludedAt": null,
    "candidates": [
      {
        "id": 15,
        "userId": 42,
        "username": "example",
        "election": "President",
        "points": null,
        "partyId": 5,
        "partyName": "Example Party",
        "partyColor": "#3B82F6"
      }
    ]
  }
]
```

## HTTP behavior and operations

- `200`: successful JSON object, array, or grouped bills object.
- `400`: invalid endpoint or parameter; `{ "error": "…" }`.
- `404`: user or party ID not found; `{ "error": "User not found" }` or `{ "error": "Party not found" }`.
- `500`: database/internal error; `{ "error": "Internal server error" }`. Error details are logged server-side, not exposed to callers.
- Successful public responses allow 15 seconds of caching. Error responses are `no-store`. No application-level rate limit is currently enforced; clients should cache, paginate, back off on errors, and avoid high-frequency polling.

For deploy monitoring, `GET /api/health` returns `{ "status": "ok" }` (200) if the app can query its database and `{ "status": "unavailable" }` (503) otherwise. It is not a test of the scheduler, migrations, Firebase, or game correctness. This endpoint is not a bot data source.

For the internal game-advance endpoints and their authentication, see [API operations](API_OPERATIONS.md). Implementation: [`src/routes/api/bot.ts`](../src/routes/api/bot.ts), [`src/lib/bot-api.ts`](../src/lib/bot-api.ts).
