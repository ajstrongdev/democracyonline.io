CREATE TABLE "election_night_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"election" varchar(50) NOT NULL,
	"cycle" integer NOT NULL,
	"sequence" integer NOT NULL,
	"reveal_at" timestamp with time zone NOT NULL,
	"type" varchar(50) NOT NULL,
	"headline" text NOT NULL,
	"cumulative_totals" jsonb NOT NULL,
	CONSTRAINT "election_night_update_sequence_unique" UNIQUE("election","cycle","sequence")
);
--> statement-breakpoint
ALTER TABLE "elections" ALTER COLUMN "status" SET DEFAULT 'CANDIDACY';--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "candidacy_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "candidacy_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "voting_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "voting_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "election_night_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "election_night_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "concluded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "reporting_seed" varchar(100);--> statement-breakpoint
UPDATE "elections"
SET "status" = CASE
	WHEN upper("status") IN ('CANDIDATE', 'CANDIDACY') THEN 'CANDIDACY'
	WHEN upper("status") = 'VOTING' THEN 'VOTING'
	WHEN upper("status") = 'ELECTION_NIGHT' THEN 'ELECTION_NIGHT'
	WHEN upper("status") = 'CONCLUDED' THEN 'CONCLUDED'
	ELSE "status"
END;--> statement-breakpoint
UPDATE "elections"
SET
	"candidacy_starts_at" = now() - make_interval(days => GREATEST((CASE WHEN "election" = 'President' THEN 10 ELSE 4 END) - "days_left", 0)),
	"candidacy_ends_at" = (
		date_trunc('day', now() AT TIME ZONE 'Europe/London')
		+ make_interval(days => GREATEST("days_left", 1))
		+ interval '20 hours'
	) AT TIME ZONE 'Europe/London'
WHERE "status" = 'CANDIDACY';--> statement-breakpoint
UPDATE "elections"
SET
	"voting_starts_at" = now() - make_interval(days => GREATEST((CASE WHEN "election" = 'President' THEN 10 ELSE 4 END) - "days_left", 0)),
	"voting_ends_at" = (
		date_trunc('day', now() AT TIME ZONE 'Europe/London')
		+ make_interval(days => GREATEST("days_left", 1))
		+ interval '20 hours'
	) AT TIME ZONE 'Europe/London'
WHERE "status" = 'VOTING';--> statement-breakpoint
UPDATE "elections"
SET "concluded_at" = now() - make_interval(days => GREATEST((CASE WHEN "election" = 'President' THEN 8 ELSE 6 END) - "days_left", 0))
WHERE "status" = 'CONCLUDED';--> statement-breakpoint
ALTER TABLE "election_night_updates" ADD CONSTRAINT "election_night_updates_election_elections_election_fk" FOREIGN KEY ("election") REFERENCES "public"."elections"("election") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "election_night_update_reveal_idx" ON "election_night_updates" USING btree ("election","cycle","reveal_at");
