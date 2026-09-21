# Open Product And Deployment Questions

## 1. Coalition governance

At present, every leader of a member party can edit the coalition, accept or decline applications, and remove their own party. Should a coalition instead have a designated leader/founding party, require a vote of member-party leaders, or use another governance model?

ANSWER:

Require a vote of member-party leaders.

## 2. Coalition changes during elections

Primary candidates currently record their coalition when they declare, while voter eligibility is based on current coalition membership. A party joining or leaving during a live primary can therefore produce inconsistent candidate groups and voting rights. Which rule should apply?

- Freeze coalition membership while an affected primary or election is active.
- Snapshot affiliation at candidacy and allow later coalition changes without changing that election.
- Move candidates and existing votes when coalition membership changes.

Snapshotting is the safest long-term model; freezing membership is the smallest immediate rule.

A: Freezing is fine.

## 3. Fresh-game government

`pnpm db:seed:fresh` creates one President and one Senator, then prints a registration access token so new players can join as Representatives. The seeded officeholders are database records only and can sign in only if matching Firebase accounts already exist. Should fresh production setup also provision Firebase identities, or should the seed contain no named players and use a separate first-admin/bootstrap flow?

A: The firebase users will always be provisioned for the administrator/seeded office holder accounts. This is something I will do myself in the firebase console.

## 4. Empty elections

If a presidential election concludes with no candidates, the current lifecycle removes the incumbent and leaves the presidency vacant. Senate elections fill empty seats from eligible players at random. Should incumbents remain in office when an election has no candidates, or is a vacancy/random appointment intended?

A: Yes the game should default to random appointments.

## 5. Production migrations

The deployment workflow builds and deploys Cloud Run but does not run `pnpm db:migrate`; the infrastructure documentation requires a manual migration before traffic reaches the new revision. Should migrations remain an explicit operator step, or should deployment run a gated Cloud Run job/migration step before updating traffic?

Automating a gated migration job is recommended before treating push-to-deploy as fully safe.

A: Deployment will be dealt with later as I am moving to my own VPS, do not worry about deployment at all yet.

## 6. Registration tokens

Access tokens are currently reusable. The fresh seed now creates and prints one usable token, but it can register multiple players until manually deleted. Should tokens be single-use, limited-use, or remain reusable invitation codes?

A: Can we make it so players can invite other players instead of access tokens, but then it will always be linked to that player therefore I can see if someone is cheating the system. I want to be able to trace back tokens also as then I can see if people are inviting alts from their main, then inviting new alts from their alts.

## New things I want you to add:

- We need to figure out a way to make moderation very automatic, I want players to get a suspicion score based on who they're inviting, how many and how fast, things should be flagged to people. Players should be able to report things as well.

- Parties should not be deleted if all members leave but instead archived.

- Coalitions should also be archived if they lose all members.

- Archived parties should not be shown on the parties chart.

- Add a revive button for archived parties and coalitions. We should log somewhere when parties are revived or not.

- Most actions currently do not get something added to the feed, lets add that.

- When people hyperlink to bill numbers, eg writing Bill #84 it should link to that, same for Presidential Election #1 and such, and add buttons to insert that in text for bills, pages and such.

- The UI/X is pretty good right now, do not make any major or drastic changes to it, implement the features with as much precision as you have been.