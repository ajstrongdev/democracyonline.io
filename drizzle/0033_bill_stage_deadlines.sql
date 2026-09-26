ALTER TABLE "bills" ADD COLUMN "stage_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "stage_ends_at" timestamp;--> statement-breakpoint
UPDATE "bills"
SET
	"stage_started_at" = COALESCE("committee_closed_at", "created_at", now()),
	"stage_ends_at" = COALESCE("committee_closed_at", "created_at", now()) + interval '8 hours'
WHERE "stage_started_at" IS NULL OR "stage_ends_at" IS NULL;