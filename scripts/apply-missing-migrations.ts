import { loadEnvFile } from "node:process";
import pg from "pg";

loadEnvFile();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL! });

const missingTablesDDL = `
-- Tables added to schema since the 0028 snapshot

CREATE TABLE IF NOT EXISTS "organization_lifecycle_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_type" varchar(20) NOT NULL,
  "organization_id" integer NOT NULL,
  "organization_name" varchar(255) NOT NULL,
  "action" varchar(20) NOT NULL,
  "actor_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "sponsor_party_id" integer,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "organization_lifecycle_entity_idx" ON "organization_lifecycle_events" ("organization_type", "organization_id", "created_at");

CREATE TABLE IF NOT EXISTS "coalition_former_members" (
  "coalition_id" integer NOT NULL REFERENCES "coalitions"("id") ON DELETE cascade,
  "party_id" integer NOT NULL REFERENCES "parties"("id") ON DELETE cascade,
  "first_joined_at" timestamp,
  "last_left_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY("coalition_id", "party_id")
);
CREATE INDEX IF NOT EXISTS "coalition_former_members_party_idx" ON "coalition_former_members" ("party_id");

CREATE TABLE IF NOT EXISTS "player_invitations" (
  "id" serial PRIMARY KEY NOT NULL,
  "token_hash" varchar(64) NOT NULL UNIQUE,
  "token_prefix" varchar(12) NOT NULL,
  "inviter_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "redeemed_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL,
  "redeemed_at" timestamp,
  "revoked_at" timestamp
);
CREATE INDEX IF NOT EXISTS "player_invitations_inviter_idx" ON "player_invitations" ("inviter_id");
CREATE UNIQUE INDEX IF NOT EXISTS "player_invitations_redeemed_user_unique" ON "player_invitations" ("redeemed_by_user_id");

CREATE TABLE IF NOT EXISTS "player_reports" (
  "id" serial PRIMARY KEY NOT NULL,
  "reporter_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "reported_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "category" varchar(40) NOT NULL,
  "details" text NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp,
  "resolved_by_user_id" integer REFERENCES "users"("id") ON DELETE set null
);
CREATE INDEX IF NOT EXISTS "player_reports_reported_status_idx" ON "player_reports" ("reported_user_id", "status");

CREATE TABLE IF NOT EXISTS "moderation_flags" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "status" varchar(20) DEFAULT 'open' NOT NULL,
  "source" varchar(30) DEFAULT 'automatic' NOT NULL,
  "suspicion_score" integer NOT NULL,
  "explanation" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp,
  "resolved_by_user_id" integer REFERENCES "users"("id") ON DELETE set null
);
CREATE INDEX IF NOT EXISTS "moderation_flags_status_idx" ON "moderation_flags" ("status");

CREATE TABLE IF NOT EXISTS "moderation_audit_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "actor_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "target_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "report_id" integer REFERENCES "player_reports"("id") ON DELETE set null,
  "flag_id" integer REFERENCES "moderation_flags"("id") ON DELETE set null,
  "action" varchar(40) NOT NULL,
  "reason" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "moderation_audit_target_idx" ON "moderation_audit_log" ("target_user_id");

-- Coalition proposals & votes (new tables from this session)
CREATE TABLE IF NOT EXISTS "coalition_proposals" (
  "id" serial PRIMARY KEY NOT NULL,
  "coalition_id" integer NOT NULL REFERENCES "coalitions"("id") ON DELETE cascade,
  "proposer_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "proposer_party_id" integer NOT NULL REFERENCES "parties"("id") ON DELETE restrict,
  "proposal_type" varchar(30) NOT NULL,
  "target_id" integer,
  "payload" jsonb,
  "status" varchar(20) DEFAULT 'open' NOT NULL,
  "votes_for" integer DEFAULT 0 NOT NULL,
  "votes_against" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp
);
CREATE INDEX IF NOT EXISTS "coalition_proposals_coalition_idx" ON "coalition_proposals" ("coalition_id", "status");

CREATE TABLE IF NOT EXISTS "coalition_votes" (
  "proposal_id" integer NOT NULL REFERENCES "coalition_proposals"("id") ON DELETE cascade,
  "voter_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "voter_party_id" integer NOT NULL REFERENCES "parties"("id") ON DELETE cascade,
  "vote" boolean NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY("proposal_id", "voter_user_id")
);

-- Feed visibility column
ALTER TABLE "feed" ADD COLUMN IF NOT EXISTS "visibility" varchar(10) DEFAULT 'player' NOT NULL;
CREATE INDEX IF NOT EXISTS "feed_visibility_created_idx" ON "feed" ("visibility", "created_at");
`;

async function main() {
  await client.connect();
  try {
    await client.query(missingTablesDDL);
    console.log("All missing tables and indexes created successfully");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
