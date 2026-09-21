DELETE FROM "coalition_members"
WHERE "coalition_id" NOT IN (SELECT "id" FROM "coalitions")
   OR "party_id" NOT IN (SELECT "id" FROM "parties");--> statement-breakpoint
DELETE FROM "join_requests"
WHERE "coalition_id" NOT IN (SELECT "id" FROM "coalitions")
   OR "party_id" NOT IN (SELECT "id" FROM "parties");--> statement-breakpoint
WITH ranked_memberships AS (
	SELECT "coalition_id", "party_id",
		row_number() OVER (
			PARTITION BY "party_id"
			ORDER BY "join_date" ASC NULLS LAST, "coalition_id" ASC
		) AS membership_rank
	FROM "coalition_members"
)
DELETE FROM "coalition_members"
USING ranked_memberships
WHERE "coalition_members"."coalition_id" = ranked_memberships."coalition_id"
	AND "coalition_members"."party_id" = ranked_memberships."party_id"
	AND ranked_memberships.membership_rank > 1;--> statement-breakpoint
ALTER TABLE "coalition_members" ADD CONSTRAINT "coalition_members_coalition_id_coalitions_id_fk" FOREIGN KEY ("coalition_id") REFERENCES "public"."coalitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_members" ADD CONSTRAINT "coalition_members_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_coalition_id_coalitions_id_fk" FOREIGN KEY ("coalition_id") REFERENCES "public"."coalitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_members" ADD CONSTRAINT "coalition_members_party_id_unique" UNIQUE("party_id");
