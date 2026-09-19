CREATE TABLE "archived_parties" (
	"party_id" integer PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"color" varchar(7) NOT NULL,
	"bio" text,
	"political_leaning" varchar(50),
	"leaning" varchar(25),
	"logo" varchar(100),
	"discord" varchar(255),
	"created_at" timestamp,
	"archived_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_membership_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"username" varchar(255) NOT NULL,
	"office" varchar(50) NOT NULL,
	"from_party_id" integer,
	"from_party_name" varchar(255),
	"from_party_color" varchar(7),
	"to_party_id" integer,
	"to_party_name" varchar(255),
	"to_party_color" varchar(7),
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "party_membership_events_user_idx" ON "party_membership_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "party_membership_events_from_party_idx" ON "party_membership_events" USING btree ("from_party_id");--> statement-breakpoint
CREATE INDEX "party_membership_events_to_party_idx" ON "party_membership_events" USING btree ("to_party_id");--> statement-breakpoint
CREATE INDEX "party_membership_events_occurred_at_idx" ON "party_membership_events" USING btree ("occurred_at");--> statement-breakpoint
WITH historical_identities AS (
	SELECT
		candidate.party_id,
		candidate.party_name,
		candidate.party_color,
		history.concluded_at
	FROM election_candidate_history candidate
	INNER JOIN election_history history ON history.id = candidate.election_history_id
	WHERE candidate.party_id IS NOT NULL
		AND candidate.party_name IS NOT NULL
		AND candidate.party_color IS NOT NULL
	UNION ALL
	SELECT
		officeholder.party_id,
		officeholder.party_name,
		officeholder.party_color,
		history.concluded_at
	FROM election_officeholder_history officeholder
	INNER JOIN election_history history ON history.id = officeholder.election_history_id
	WHERE officeholder.party_id IS NOT NULL
		AND officeholder.party_name IS NOT NULL
		AND officeholder.party_color IS NOT NULL
), latest_identities AS (
	SELECT DISTINCT ON (party_id)
		party_id,
		party_name,
		party_color,
		concluded_at
	FROM historical_identities
	ORDER BY party_id, concluded_at DESC
)
INSERT INTO archived_parties (party_id, name, color, archived_at)
SELECT identity.party_id, identity.party_name, identity.party_color, identity.concluded_at
FROM latest_identities identity
LEFT JOIN parties current_party ON current_party.id = identity.party_id
WHERE current_party.id IS NULL
ON CONFLICT (party_id) DO NOTHING;--> statement-breakpoint
CREATE OR REPLACE FUNCTION archive_deleted_party() RETURNS trigger AS $$
BEGIN
	INSERT INTO archived_parties (
		party_id,
		name,
		color,
		bio,
		political_leaning,
		leaning,
		logo,
		discord,
		created_at,
		archived_at
	) VALUES (
		OLD.id,
		OLD.name,
		OLD.color,
		OLD.bio,
		OLD.political_leaning,
		OLD.leaning,
		OLD.logo,
		OLD.discord,
		OLD.created_at,
		now()
	)
	ON CONFLICT (party_id) DO UPDATE SET
		name = EXCLUDED.name,
		color = EXCLUDED.color,
		bio = EXCLUDED.bio,
		political_leaning = EXCLUDED.political_leaning,
		leaning = EXCLUDED.leaning,
		logo = EXCLUDED.logo,
		discord = EXCLUDED.discord,
		created_at = EXCLUDED.created_at,
		archived_at = EXCLUDED.archived_at;
	RETURN OLD;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER archive_party_before_delete
BEFORE DELETE ON parties
FOR EACH ROW EXECUTE FUNCTION archive_deleted_party();--> statement-breakpoint
CREATE OR REPLACE FUNCTION record_party_membership_change() RETURNS trigger AS $$
DECLARE
	old_party_name varchar(255);
	old_party_color varchar(7);
	new_party_name varchar(255);
	new_party_color varchar(7);
BEGIN
	IF OLD.party_id IS NOT DISTINCT FROM NEW.party_id THEN
		RETURN NEW;
	END IF;

	IF OLD.party_id IS NOT NULL THEN
		SELECT name, color INTO old_party_name, old_party_color
		FROM parties
		WHERE id = OLD.party_id;
	END IF;

	IF NEW.party_id IS NOT NULL THEN
		SELECT name, color INTO new_party_name, new_party_color
		FROM parties
		WHERE id = NEW.party_id;
	END IF;

	INSERT INTO party_membership_events (
		user_id,
		username,
		office,
		from_party_id,
		from_party_name,
		from_party_color,
		to_party_id,
		to_party_name,
		to_party_color
	) VALUES (
		NEW.id,
		NEW.username,
		coalesce(NEW.role, 'Representative'),
		OLD.party_id,
		old_party_name,
		old_party_color,
		NEW.party_id,
		new_party_name,
		new_party_color
	);
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER record_user_party_membership_change
AFTER UPDATE OF party_id ON users
FOR EACH ROW EXECUTE FUNCTION record_party_membership_change();
