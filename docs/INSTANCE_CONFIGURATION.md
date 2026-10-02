# Instance configuration

Polsimmer ships with the Oscana profile at [`instances/oscana.json`](../instances/oscana.json). Without an override, development, builds and fresh seeds use this profile. To deploy another instance, copy that file and edit the copy. For standalone seed commands, set `VITE_INSTANCE_CONFIG` to its **JSON contents**; for example:

```sh
export VITE_INSTANCE_CONFIG="$(cat instances/my-nation.json)"
bun run build
```

Set `VITE_INSTANCE_CONFIG=instances/dev.json` in the checkout's `.env` for local Vite development/builds or VPS deployments via `scripts/vps.sh`. Both resolve the path relative to the checkout and load its JSON; the VPS script also passes it to the seed container. An empty or absent value keeps the Oscana default. Direct Compose builds and standalone seed commands still require JSON contents, not a path. The profile contains **public data only** and is embedded into browser assets. Do not include secrets. Restart Vite or rebuild after edits; runtime changes do not change already-built browser assets. Use the same profile for application and seed commands. Supply the usual independent Firebase, database, `SITE_URL`, domain/DNS and deployment credentials for each installation.

The contract is the Zod `instanceSchema` in [`src/lib/instance-config.ts`](../src/lib/instance-config.ts). Required: `id` (lowercase slug, also namespaces browser events/drafts), `name`, `nationName` (fresh seed), `description`, `domain` (absolute URL), `locale` (valid BCP 47 tag), `timeZone` (IANA zone), and `branding.logo` / `branding.icon` (root-relative paths under `public/`). Validation rejects missing or invalid values with an `Invalid instance configuration` error. Put new image assets under `public/` and reference them by URL; `public/logo.png` and `public/favicon.ico` preserve Oscana's existing assets. Never put a private URL or key here.

Optional fields and defaults:

| Field | Default / purpose |
| --- | --- |
| `branding.socialName` | `Social`; name of the in-game social feed |
| `social.community` | absent; instance/nation community link shown in game navigation and login help. Polsimmer product footer links are fixed and not configurable per instance. |
| `terminology.president`, `.senate`, `.house`, `.party` | `President`, `Senate`, `House`, `Party`; display terminology (persisted roles, stages, API values and URLs remain unchanged) |
| `features.social`, `.browserNotifications` | `true`; hide the social navigation entry or the browser notification invitation; **not access-control gates** |
| `game.billAdvanceScheduleUtc`, `.gameAdvanceScheduleUtc` | `0 4,12,20 * * *` and `0 20 * * *`; server scheduling defaults, still overridable by `BILL_ADVANCE_SCHEDULE_UTC` and `GAME_ADVANCE_SCHEDULE_UTC` |

The current political simulation uses fixed internal offices, stages and election mechanics. Terminology here is presentation-only; changing government structure or disabling features end-to-end requires additional implementation. Database `game_settings` and existing nation records remain persistent per-instance state, not deployment configuration. Historical migrations and Oscana-specific E2E guards are intentionally not renamed: they are database history and safety mechanisms, not instance branding. Demo election fixtures in `scripts/seed.ts` are not a production initialization path; use `seed:fresh` on a disposable database only.
