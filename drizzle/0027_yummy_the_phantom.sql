ALTER TABLE "election_night_updates" ADD COLUMN IF NOT EXISTS "total_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "election_night_updates" ALTER COLUMN "total_points" DROP DEFAULT;--> statement-breakpoint
UPDATE "elections"
SET
	"candidacy_starts_at" = COALESCE("candidacy_starts_at", now()),
	"candidacy_ends_at" = COALESCE("candidacy_ends_at", now() + make_interval(days => GREATEST("days_left", 1)))
WHERE "status" = 'CANDIDACY';--> statement-breakpoint
UPDATE "elections"
SET
	"voting_starts_at" = COALESCE("voting_starts_at", now()),
	"voting_ends_at" = COALESCE("voting_ends_at", now() + make_interval(days => GREATEST("days_left", 1)))
WHERE "status" = 'VOTING';--> statement-breakpoint
UPDATE "elections"
SET
	"election_night_starts_at" = COALESCE("election_night_starts_at", now()),
	"election_night_ends_at" = COALESCE("election_night_ends_at", now() + interval '12 hours')
WHERE "status" = 'ELECTION_NIGHT';--> statement-breakpoint
UPDATE "elections"
SET "concluded_at" = COALESCE(
	"concluded_at",
	now() - make_interval(days => GREATEST((CASE WHEN "election" = 'President' THEN 8 ELSE 6 END) - "days_left", 0))
)
WHERE "status" = 'CONCLUDED';--> statement-breakpoint
ALTER TABLE "elections" DROP COLUMN IF EXISTS "days_left";
