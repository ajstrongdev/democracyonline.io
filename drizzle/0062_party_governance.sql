CREATE TABLE "party_join_requests" (
  "id" serial PRIMARY KEY,
  "party_id" integer NOT NULL REFERENCES "parties"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "party_join_requests_pending_idx" ON "party_join_requests" ("party_id", "user_id") WHERE "status" = 'pending';
--> statement-breakpoint
CREATE TABLE "party_leadership_bids" (
  "id" serial PRIMARY KEY,
  "party_id" integer NOT NULL REFERENCES "parties"("id") ON DELETE CASCADE,
  "candidate_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "threshold" integer NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'open',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "party_leadership_bids_open_idx" ON "party_leadership_bids" ("party_id") WHERE "status" = 'open';
--> statement-breakpoint
CREATE TABLE "party_leadership_support" (
  "bid_id" integer NOT NULL REFERENCES "party_leadership_bids"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  PRIMARY KEY ("bid_id", "user_id")
);
--> statement-breakpoint
CREATE TABLE "party_leadership_eligible" (
  "bid_id" integer NOT NULL REFERENCES "party_leadership_bids"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  PRIMARY KEY ("bid_id", "user_id")
);
--> statement-breakpoint
CREATE FUNCTION "oscana_remove_departed_leadership_support"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.party_id IS DISTINCT FROM NEW.party_id AND OLD.party_id IS NOT NULL THEN
    DELETE FROM party_leadership_support s USING party_leadership_bids b
    WHERE s.bid_id = b.id AND s.user_id = NEW.id AND b.party_id = OLD.party_id;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER oscana_remove_departed_leadership_support_change AFTER UPDATE OF party_id ON users FOR EACH ROW EXECUTE FUNCTION oscana_remove_departed_leadership_support();
--> statement-breakpoint
CREATE TRIGGER oscana_live_party_join_requests_change AFTER INSERT OR UPDATE OR DELETE ON party_join_requests FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_party_leadership_bids_change AFTER INSERT OR UPDATE OR DELETE ON party_leadership_bids FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_party_leadership_support_change AFTER INSERT OR UPDATE OR DELETE ON party_leadership_support FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_party_leadership_eligible_change AFTER INSERT OR UPDATE OR DELETE ON party_leadership_eligible FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
