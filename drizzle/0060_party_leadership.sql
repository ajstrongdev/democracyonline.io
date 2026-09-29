ALTER TABLE "parties" ADD COLUMN "chief_whip_id" integer;
--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "social_media_officer_id" integer;
--> statement-breakpoint
ALTER TABLE "bill_party_whips" ADD COLUMN "enforced_at" timestamptz;
--> statement-breakpoint
CREATE TABLE "bill_vote_indications" (
  "bill_id" integer NOT NULL REFERENCES "bills"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "stage" varchar(20) NOT NULL,
  "vote_yes" boolean NOT NULL,
  PRIMARY KEY ("bill_id", "user_id", "stage")
);
--> statement-breakpoint
CREATE TABLE "party_formation_invites" (
  "id" serial PRIMARY KEY,
  "founder_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "invitee_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "office" varchar(30) NOT NULL,
  "name" varchar(255) NOT NULL,
  "details" jsonb NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "party_formation_invites_invitee_idx" ON "party_formation_invites" ("invitee_id", "status");
--> statement-breakpoint
CREATE TABLE "party_newspaper_articles" (
  "id" serial PRIMARY KEY,
  "party_id" integer NOT NULL REFERENCES "parties"("id") ON DELETE CASCADE,
  "author_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "title" varchar(200) NOT NULL,
  "content" text NOT NULL,
  "published_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "party_newspaper_party_idx" ON "party_newspaper_articles" ("party_id", "created_at");
--> statement-breakpoint
CREATE TRIGGER oscana_live_party_formation_invites_change AFTER INSERT OR UPDATE OR DELETE ON party_formation_invites FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_party_newspaper_articles_change AFTER INSERT OR UPDATE OR DELETE ON party_newspaper_articles FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_bill_vote_indications_change AFTER INSERT OR UPDATE OR DELETE ON bill_vote_indications FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
