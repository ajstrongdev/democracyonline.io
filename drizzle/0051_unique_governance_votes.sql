-- Refuse to change voting rules silently if an older database already has
-- duplicate ballots. Inspect and resolve them before applying this migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM coalition_votes GROUP BY proposal_id, voter_party_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Multiple coalition votes per party found; resolve duplicate (proposal_id, voter_party_id) rows before migration 0051';
  END IF;
  IF EXISTS (SELECT 1 FROM bill_votes_house WHERE bill_id IS NOT NULL AND voter_id IS NOT NULL GROUP BY bill_id, voter_id HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM bill_votes_senate WHERE bill_id IS NOT NULL AND voter_id IS NOT NULL GROUP BY bill_id, voter_id HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM bill_votes_presidential WHERE bill_id IS NOT NULL AND voter_id IS NOT NULL GROUP BY bill_id, voter_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate bill votes found; resolve duplicate (bill_id, voter_id) rows before migration 0051';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "bill_votes_house" ADD CONSTRAINT "bill_votes_house_bill_voter_unique" UNIQUE ("bill_id", "voter_id");--> statement-breakpoint
ALTER TABLE "bill_votes_senate" ADD CONSTRAINT "bill_votes_senate_bill_voter_unique" UNIQUE ("bill_id", "voter_id");--> statement-breakpoint
ALTER TABLE "bill_votes_presidential" ADD CONSTRAINT "bill_votes_presidential_bill_voter_unique" UNIQUE ("bill_id", "voter_id");--> statement-breakpoint
ALTER TABLE "coalition_votes" ADD CONSTRAINT "coalition_votes_proposal_party_unique" UNIQUE ("proposal_id", "voter_party_id");
