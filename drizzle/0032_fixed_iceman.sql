CREATE TABLE "coalition_former_members" (
	"coalition_id" integer NOT NULL,
	"party_id" integer NOT NULL,
	"first_joined_at" timestamp,
	"last_left_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coalition_former_members_coalition_id_party_id_pk" PRIMARY KEY("coalition_id","party_id")
);
--> statement-breakpoint
CREATE TABLE "coalition_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"coalition_id" integer NOT NULL,
	"proposer_user_id" integer NOT NULL,
	"proposer_party_id" integer NOT NULL,
	"proposal_type" varchar(30) NOT NULL,
	"target_id" integer,
	"payload" jsonb,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"votes_for" integer DEFAULT 0 NOT NULL,
	"votes_against" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "coalition_votes" (
	"proposal_id" integer NOT NULL,
	"voter_user_id" integer NOT NULL,
	"voter_party_id" integer NOT NULL,
	"vote" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coalition_votes_proposal_id_voter_user_id_pk" PRIMARY KEY("proposal_id","voter_user_id")
);
--> statement-breakpoint
CREATE TABLE "moderation_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" integer NOT NULL,
	"target_user_id" integer,
	"report_id" integer,
	"flag_id" integer,
	"action" varchar(40) NOT NULL,
	"reason" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"source" varchar(30) DEFAULT 'automatic' NOT NULL,
	"suspicion_score" integer NOT NULL,
	"explanation" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_user_id" integer
);
--> statement-breakpoint
CREATE TABLE "organization_lifecycle_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_type" varchar(20) NOT NULL,
	"organization_id" integer NOT NULL,
	"organization_name" varchar(255) NOT NULL,
	"action" varchar(20) NOT NULL,
	"actor_user_id" integer,
	"sponsor_party_id" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"token_prefix" varchar(12) NOT NULL,
	"inviter_id" integer NOT NULL,
	"redeemed_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"redeemed_at" timestamp,
	"revoked_at" timestamp,
	CONSTRAINT "player_invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "player_invitations_redeemed_user_unique" UNIQUE("redeemed_by_user_id")
);
--> statement-breakpoint
CREATE TABLE "player_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_id" integer NOT NULL,
	"reported_user_id" integer NOT NULL,
	"category" varchar(40) NOT NULL,
	"details" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_user_id" integer
);
--> statement-breakpoint
ALTER TABLE "access_tokens" ADD COLUMN IF NOT EXISTS "redeemed_at" timestamp;--> statement-breakpoint
ALTER TABLE "coalitions" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "feed" ADD COLUMN "visibility" varchar(10) DEFAULT 'player' NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "former_leader_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "moderation_role" varchar(20) DEFAULT 'player' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_ancestry_root" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coalition_former_members" ADD CONSTRAINT "coalition_former_members_coalition_id_coalitions_id_fk" FOREIGN KEY ("coalition_id") REFERENCES "public"."coalitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_former_members" ADD CONSTRAINT "coalition_former_members_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_proposals" ADD CONSTRAINT "coalition_proposals_coalition_id_coalitions_id_fk" FOREIGN KEY ("coalition_id") REFERENCES "public"."coalitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_proposals" ADD CONSTRAINT "coalition_proposals_proposer_user_id_users_id_fk" FOREIGN KEY ("proposer_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_proposals" ADD CONSTRAINT "coalition_proposals_proposer_party_id_parties_id_fk" FOREIGN KEY ("proposer_party_id") REFERENCES "public"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_votes" ADD CONSTRAINT "coalition_votes_proposal_id_coalition_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."coalition_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_votes" ADD CONSTRAINT "coalition_votes_voter_user_id_users_id_fk" FOREIGN KEY ("voter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_votes" ADD CONSTRAINT "coalition_votes_voter_party_id_parties_id_fk" FOREIGN KEY ("voter_party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_audit_log" ADD CONSTRAINT "moderation_audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_audit_log" ADD CONSTRAINT "moderation_audit_log_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_audit_log" ADD CONSTRAINT "moderation_audit_log_report_id_player_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."player_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_audit_log" ADD CONSTRAINT "moderation_audit_log_flag_id_moderation_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."moderation_flags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_flags" ADD CONSTRAINT "moderation_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_flags" ADD CONSTRAINT "moderation_flags_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_lifecycle_events" ADD CONSTRAINT "organization_lifecycle_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_invitations" ADD CONSTRAINT "player_invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_invitations" ADD CONSTRAINT "player_invitations_redeemed_by_user_id_users_id_fk" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_reports" ADD CONSTRAINT "player_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_reports" ADD CONSTRAINT "player_reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_reports" ADD CONSTRAINT "player_reports_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coalition_former_members_party_idx" ON "coalition_former_members" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "coalition_proposals_coalition_idx" ON "coalition_proposals" USING btree ("coalition_id","status");--> statement-breakpoint
CREATE INDEX "moderation_audit_target_idx" ON "moderation_audit_log" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "moderation_flags_status_idx" ON "moderation_flags" USING btree ("status");--> statement-breakpoint
CREATE INDEX "organization_lifecycle_entity_idx" ON "organization_lifecycle_events" USING btree ("organization_type","organization_id","created_at");--> statement-breakpoint
CREATE INDEX "player_invitations_inviter_idx" ON "player_invitations" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "player_reports_reported_status_idx" ON "player_reports" USING btree ("reported_user_id","status");--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_former_leader_id_users_id_fk" FOREIGN KEY ("former_leader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feed_visibility_created_idx" ON "feed" USING btree ("visibility","created_at");