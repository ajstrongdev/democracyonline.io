CREATE TABLE "candidate_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" integer NOT NULL,
	"election" varchar(50) NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL,
	"donations" bigint DEFAULT 0 NOT NULL,
	"snapshot_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donation_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" integer,
	"amount" bigint NOT NULL,
	"donator" integer,
	"donated_at" timestamp DEFAULT now()
);
