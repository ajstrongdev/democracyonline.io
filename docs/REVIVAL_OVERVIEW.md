# Revival branch overview

`develop` last changed on 6 June 2026; `revival` branched from it and had 21 commits through 24 September 2026. This is a substantial, unfinished v3 rewrite, not just an infrastructure change.

- The UI now separates public wiki pages from a signed-in dashboard. Dashboard routes cover government, nation, elections, bills, parties, coalitions, and players. The old sidebar and several old public pages were removed or redirected.
- Elections gained a new lifecycle, ranked ballots, election-night coverage, candidate history, and dashboard views. The admin and game scheduling paths were rewritten.
- Bills gained stage deadlines, committee outcomes, vote views, policy effects, and wiki article editing/history. A minute-based scheduler now reconciles bill, election, and game advancement.
- New nation stats and policies drive simulation and headline indicators. Moderation, invitations, and audit/history features were added.
- The former banking, companies, stock market, campaign, and party merge flows were removed in this branch. Do not assume old game data or features carry over.
- There are 19 new Drizzle migrations (0016–0034), including schema/data changes and removal of Firebase UID storage. A fresh seed was introduced; it truncates game data.
- Deployment work on the branch was incomplete: it contained a Google Cloud script and Terraform alongside an experimental VPS setup. This deployment branch replaces those with the documented VPS path.

Before launching production, exercise sign-up/sign-in, admin access, a complete election and bill cycle, and backup restore on development. The rewrite has not been established as production-compatible with the `develop` database; treat any data migration as a separate project.
