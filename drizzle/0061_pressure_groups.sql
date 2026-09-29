CREATE TABLE "pressure_groups" (
  "id" serial PRIMARY KEY,
  "founder_id" integer NOT NULL REFERENCES "users"("id"),
  "name" varchar(255) NOT NULL,
  "details" jsonb NOT NULL,
  "formed_party_id" integer REFERENCES "parties"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pressure_groups_pending_name_idx"
  ON "pressure_groups" (lower("name"))
  WHERE "formed_party_id" IS NULL;
--> statement-breakpoint
CREATE TABLE "pressure_group_members" (
  "group_id" integer NOT NULL REFERENCES "pressure_groups"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "pressure_group_members_pkey" PRIMARY KEY ("group_id", "user_id"),
  CONSTRAINT "pressure_group_members_user_id_unique" UNIQUE ("user_id")
);
--> statement-breakpoint
CREATE TRIGGER oscana_live_pressure_groups_change
AFTER INSERT OR UPDATE OR DELETE ON pressure_groups
FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_pressure_group_members_change
AFTER INSERT OR UPDATE OR DELETE ON pressure_group_members
FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
