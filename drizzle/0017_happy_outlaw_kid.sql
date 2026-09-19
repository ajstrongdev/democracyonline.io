UPDATE "elections" SET "status" = 'Candidate' WHERE "status" = 'Candidacy';--> statement-breakpoint
ALTER TABLE "elections" ALTER COLUMN "status" SET DEFAULT 'Candidate';--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_rank_positive" CHECK ("votes"."rank" > 0);--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_points_positive" CHECK ("votes"."points" > 0);
