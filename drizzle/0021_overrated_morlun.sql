CREATE TABLE "election_candidate_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"election_history_id" integer NOT NULL,
	"user_id" integer,
	"username" varchar(255) NOT NULL,
	"party_id" integer,
	"party_name" varchar(255),
	"party_color" varchar(7),
	"points" integer DEFAULT 0 NOT NULL,
	"first_preference_votes" integer DEFAULT 0 NOT NULL,
	"placement" integer NOT NULL,
	"elected" boolean DEFAULT false NOT NULL,
	CONSTRAINT "election_candidate_history_result_unique" UNIQUE("election_history_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "election_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"election" varchar(50) NOT NULL,
	"cycle" integer NOT NULL,
	"seats" integer,
	"total_ballots" integer DEFAULT 0 NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"concluded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "election_history_election_cycle_unique" UNIQUE("election","cycle")
);
--> statement-breakpoint
CREATE TABLE "election_officeholder_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"election_history_id" integer NOT NULL,
	"user_id" integer,
	"username" varchar(255) NOT NULL,
	"party_id" integer,
	"party_name" varchar(255),
	"party_color" varchar(7),
	"office" varchar(50) NOT NULL,
	"selection" varchar(50) NOT NULL,
	CONSTRAINT "election_officeholder_history_member_unique" UNIQUE("election_history_id","user_id","office")
);
--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "cycle" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "election_candidate_history" ADD CONSTRAINT "election_candidate_history_election_history_id_election_history_id_fk" FOREIGN KEY ("election_history_id") REFERENCES "public"."election_history"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_officeholder_history" ADD CONSTRAINT "election_officeholder_history_election_history_id_election_history_id_fk" FOREIGN KEY ("election_history_id") REFERENCES "public"."election_history"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "election_candidate_history_user_idx" ON "election_candidate_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "election_history_concluded_at_idx" ON "election_history" USING btree ("concluded_at");--> statement-breakpoint
CREATE INDEX "election_officeholder_history_user_idx" ON "election_officeholder_history" USING btree ("user_id");--> statement-breakpoint

-- Preserve any result that is already in its concluded window when this
-- feature is deployed. Elections in Candidate or Voting status are archived
-- transactionally by the game-advance handler when they conclude.
INSERT INTO "election_history" (
	"election",
	"cycle",
	"seats",
	"total_ballots",
	"total_points",
	"concluded_at"
)
SELECT
	e."election",
	e."cycle",
	e."seats",
	(
		SELECT count(DISTINCT v."user_id")::integer
		FROM "votes" v
		WHERE v."vote_type" = e."election"
	),
	(
		SELECT coalesce(sum(v."points"), 0)::integer
		FROM "votes" v
		WHERE v."vote_type" = e."election"
	),
	now()
FROM "elections" e
WHERE e."status" = 'Concluded'
ON CONFLICT ("election", "cycle") DO NOTHING;--> statement-breakpoint

INSERT INTO "election_candidate_history" (
	"election_history_id",
	"user_id",
	"username",
	"party_id",
	"party_name",
	"party_color",
	"points",
	"first_preference_votes",
	"placement",
	"elected"
)
SELECT
	eh."id",
	u."id",
	u."username",
	p."id",
	p."name",
	p."color",
	coalesce(c."votes", 0),
	(
		SELECT count(*)::integer
		FROM "votes" v
		WHERE v."candidate_id" = c."id" AND v."rank" = 1
	),
	row_number() OVER (
		PARTITION BY c."election"
		ORDER BY c."votes" DESC, c."id"
	)::integer,
	coalesce(c."haswon", false)
FROM "candidates" c
JOIN "elections" e ON e."election" = c."election" AND e."status" = 'Concluded'
JOIN "election_history" eh ON eh."election" = e."election" AND eh."cycle" = e."cycle"
JOIN "users" u ON u."id" = c."user_id"
LEFT JOIN "parties" p ON p."id" = u."party_id"
ON CONFLICT ("election_history_id", "user_id") DO NOTHING;--> statement-breakpoint

INSERT INTO "election_officeholder_history" (
	"election_history_id",
	"user_id",
	"username",
	"party_id",
	"party_name",
	"party_color",
	"office",
	"selection"
)
SELECT
	eh."id",
	u."id",
	u."username",
	p."id",
	p."name",
	p."color",
	u."role",
	CASE
		WHEN EXISTS (
			SELECT 1
			FROM "candidates" c
			WHERE c."election" = e."election"
				AND c."user_id" = u."id"
				AND c."haswon" = true
		) THEN 'Elected'
		WHEN e."election" = 'Senate' AND u."role" = 'Senator' THEN 'Appointed'
		ELSE 'Serving'
	END
FROM "elections" e
JOIN "election_history" eh ON eh."election" = e."election" AND eh."cycle" = e."cycle"
CROSS JOIN "users" u
LEFT JOIN "parties" p ON p."id" = u."party_id"
WHERE e."status" = 'Concluded'
	AND u."role" IN ('Representative', 'Senator', 'President')
ON CONFLICT ("election_history_id", "user_id", "office") DO NOTHING;
