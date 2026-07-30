CREATE TYPE "public"."alliance_request_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."amendment_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('pending', 'approved', 'changes_requested', 'denied');--> statement-breakpoint
CREATE TYPE "public"."bill_stage" AS ENUM('house', 'senate', 'president');--> statement-breakpoint
CREATE TYPE "public"."bill_stage_outcome" AS ENUM('passed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."bill_status" AS ENUM('proposed', 'queued', 'voting', 'ratified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."election_type" AS ENUM('presidential', 'senate');--> statement-breakpoint
CREATE TYPE "public"."nation_event_type" AS ENUM('election_held', 'primary_held', 'office_term_started', 'office_term_ended', 'bill_ratified', 'bill_rejected', 'policy_enacted', 'party_founded', 'party_dissolved', 'party_merged', 'coalition_formed', 'coalition_dissolved', 'war_declared', 'war_ended', 'alliance_formed', 'alliance_broken', 'league_resolution_passed');--> statement-breakpoint
CREATE TYPE "public"."office_type" AS ENUM('president', 'senator', 'cabinet');--> statement-breakpoint
CREATE TYPE "public"."resolution_type" AS ENUM('sanctions', 'relief', 'war', 'peace');--> statement-breakpoint
CREATE TYPE "public"."telegram_action" AS ENUM('league_resolution_vote', 'alliance_request_response');--> statement-breakpoint
CREATE TYPE "public"."telegram_type" AS ENUM('dm', 'alert');--> statement-breakpoint
CREATE TYPE "public"."vote" AS ENUM('yes', 'no');--> statement-breakpoint
CREATE TABLE "access_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"created_by" integer NOT NULL,
	"redeemed_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "access_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "accounts_username_unique" UNIQUE("username"),
	CONSTRAINT "accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "alliance_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_nation_id" integer NOT NULL,
	"target_nation_id" integer NOT NULL,
	"status" "alliance_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "alliance_requests_distinct_nations" CHECK ("alliance_requests"."requester_nation_id" <> "alliance_requests"."target_nation_id")
);
--> statement-breakpoint
CREATE TABLE "alliances" (
	"id" serial PRIMARY KEY NOT NULL,
	"nation_a_id" integer NOT NULL,
	"nation_b_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "alliances_pair_unq" UNIQUE("nation_a_id","nation_b_id"),
	CONSTRAINT "alliances_distinct_nations" CHECK ("alliances"."nation_a_id" <> "alliances"."nation_b_id")
);
--> statement-breakpoint
CREATE TABLE "ammendments" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer NOT NULL,
	"bill_clause_id" integer NOT NULL,
	"proposer_id" integer,
	"status" "amendment_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "war_battle_participants" (
	"battle_id" integer NOT NULL,
	"nation_id" integer NOT NULL,
	"fighting_for" integer,
	CONSTRAINT "war_battle_participants_pk" PRIMARY KEY("battle_id","nation_id")
);
--> statement-breakpoint
CREATE TABLE "war_battles" (
	"id" serial PRIMARY KEY NOT NULL,
	"war_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_clauses" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_stage_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer NOT NULL,
	"stage" "bill_stage" NOT NULL,
	"outcome" "bill_stage_outcome" NOT NULL,
	"yes_votes" integer DEFAULT 0 NOT NULL,
	"no_votes" integer DEFAULT 0 NOT NULL,
	"decided_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_votes_house" (
	"politician_id" integer NOT NULL,
	"bill_id" integer NOT NULL,
	"vote" "vote" NOT NULL,
	"voted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bill_votes_house_pk" PRIMARY KEY("politician_id","bill_id")
);
--> statement-breakpoint
CREATE TABLE "bill_votes_president" (
	"politician_id" integer NOT NULL,
	"bill_id" integer NOT NULL,
	"vote" "vote" NOT NULL,
	"voted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bill_votes_president_pk" PRIMARY KEY("politician_id","bill_id")
);
--> statement-breakpoint
CREATE TABLE "bill_votes_senate" (
	"politician_id" integer NOT NULL,
	"bill_id" integer NOT NULL,
	"vote" "vote" NOT NULL,
	"voted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bill_votes_senate_pk" PRIMARY KEY("politician_id","bill_id")
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"nation_id" integer NOT NULL,
	"status" "bill_status" DEFAULT 'queued' NOT NULL,
	"stage" "bill_stage" DEFAULT 'house' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cabinet" (
	"id" serial PRIMARY KEY NOT NULL,
	"nation_id" integer NOT NULL,
	"politician_id" integer NOT NULL,
	"position" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coalition_parties" (
	"coalition_id" integer NOT NULL,
	"party_id" integer NOT NULL,
	CONSTRAINT "coalition_parties_pk" PRIMARY KEY("coalition_id","party_id")
);
--> statement-breakpoint
CREATE TABLE "coalitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"nation_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"dissolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "election_candidates" (
	"election_id" integer NOT NULL,
	"politician_id" integer NOT NULL,
	"party_id" integer,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"is_winner" boolean DEFAULT false NOT NULL,
	CONSTRAINT "election_candidates_pk" PRIMARY KEY("election_id","politician_id")
);
--> statement-breakpoint
CREATE TABLE "election_votes" (
	"election_id" integer NOT NULL,
	"politician_id" integer NOT NULL,
	CONSTRAINT "election_votes_pk" PRIMARY KEY("election_id","politician_id")
);
--> statement-breakpoint
CREATE TABLE "elections" (
	"id" serial PRIMARY KEY NOT NULL,
	"nation_id" integer NOT NULL,
	"election_type" text NOT NULL,
	"status" text NOT NULL,
	"term" integer,
	"winner_id" integer,
	"started_at" timestamp DEFAULT now(),
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "international_members" (
	"international_id" integer NOT NULL,
	"party_id" integer NOT NULL,
	CONSTRAINT "international_members_pk" PRIMARY KEY("international_id","party_id")
);
--> statement-breakpoint
CREATE TABLE "internationals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "league_resolution_votes" (
	"resolution_id" integer NOT NULL,
	"politician_id" integer NOT NULL,
	"nation_id" integer NOT NULL,
	"vote" "vote" NOT NULL,
	CONSTRAINT "league_resolution_votes_pk" PRIMARY KEY("resolution_id","politician_id")
);
--> statement-breakpoint
CREATE TABLE "league_resolutions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" "resolution_type" NOT NULL,
	"nation_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"target_nation_id" integer
);
--> statement-breakpoint
CREATE TABLE "nation_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"nation_id" integer NOT NULL,
	"type" "nation_event_type" NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"election_id" integer,
	"primary_id" integer,
	"bill_id" integer,
	"war_id" integer,
	"alliance_id" integer,
	"resolution_id" integer,
	"party_id" integer,
	"politician_id" integer
);
--> statement-breakpoint
CREATE TABLE "nation_policies" (
	"nation_id" integer NOT NULL,
	"policy_id" integer NOT NULL,
	CONSTRAINT "nation_policies_pk" PRIMARY KEY("nation_id","policy_id")
);
--> statement-breakpoint
CREATE TABLE "nation_stat_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"nation_id" integer NOT NULL,
	"stat_id" integer NOT NULL,
	"value" integer NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nation_stats" (
	"nation_id" integer NOT NULL,
	"stat_id" integer NOT NULL,
	"value" integer DEFAULT 50 NOT NULL,
	CONSTRAINT "nation_stats_pk" PRIMARY KEY("nation_id","stat_id")
);
--> statement-breakpoint
CREATE TABLE "nations" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "newspaper_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"newspaper_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"issue_id" integer,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"status" "article_status" DEFAULT 'pending' NOT NULL,
	"editor_note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "newspaper_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"newspaper_id" integer NOT NULL,
	"issue_number" integer NOT NULL,
	"title" text,
	"published_at" timestamp,
	CONSTRAINT "newspaper_issues_number_unq" UNIQUE("newspaper_id","issue_number")
);
--> statement-breakpoint
CREATE TABLE "office_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"nation_id" integer NOT NULL,
	"politician_id" integer NOT NULL,
	"office" "office_type" NOT NULL,
	"position" text,
	"party_id" integer,
	"election_id" integer,
	"term" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" serial PRIMARY KEY NOT NULL,
	"nation_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"dissolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "party_merge_requests" (
	"party_id" integer NOT NULL,
	"merged_party_id" integer NOT NULL,
	CONSTRAINT "party_merge_requests_pk" PRIMARY KEY("party_id","merged_party_id")
);
--> statement-breakpoint
CREATE TABLE "party_newspapers" (
	"id" serial PRIMARY KEY NOT NULL,
	"party_id" integer NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_policies" (
	"party_id" integer NOT NULL,
	"policy_id" integer NOT NULL,
	"section" text,
	CONSTRAINT "party_policies_pk" PRIMARY KEY("party_id","policy_id")
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" serial PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politicians" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"nation_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"retired_at" timestamp,
	"last_active_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "primaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"nation_id" integer NOT NULL,
	"party_id" integer,
	"coalition_id" integer,
	"status" text NOT NULL,
	"term" integer,
	"winner_id" integer,
	"started_at" timestamp DEFAULT now(),
	"ended_at" timestamp,
	CONSTRAINT "primaries_party_or_coalition" CHECK (num_nonnulls("primaries"."party_id", "primaries"."coalition_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "primary_candidates" (
	"primary_id" integer NOT NULL,
	"politician_id" integer NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"is_winner" boolean DEFAULT false NOT NULL,
	CONSTRAINT "primary_candidates_pk" PRIMARY KEY("primary_id","politician_id")
);
--> statement-breakpoint
CREATE TABLE "primary_votes" (
	"primary_id" integer NOT NULL,
	"politician_id" integer NOT NULL,
	CONSTRAINT "primary_votes_pk" PRIMARY KEY("primary_id","politician_id")
);
--> statement-breakpoint
CREATE TABLE "proposal_supporters" (
	"account_id" integer NOT NULL,
	"bill_id" integer NOT NULL,
	CONSTRAINT "proposal_supporters_pk" PRIMARY KEY("account_id","bill_id")
);
--> statement-breakpoint
CREATE TABLE "stats" (
	"id" serial PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegrams" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "telegram_type" NOT NULL,
	"sender_id" integer,
	"recipient_id" integer NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"action_type" "telegram_action",
	"league_resolution_id" integer,
	"alliance_request_id" integer,
	"read_at" timestamp,
	"actioned_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "telegrams_dm_has_sender" CHECK ("telegrams"."type" <> 'dm' OR "telegrams"."sender_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "wars" (
	"id" serial PRIMARY KEY NOT NULL,
	"nation_a_id" integer NOT NULL,
	"nation_b_id" integer NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"ended_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_created_by_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_redeemed_by_accounts_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_requests" ADD CONSTRAINT "alliance_requests_requester_nation_id_nations_id_fk" FOREIGN KEY ("requester_nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_requests" ADD CONSTRAINT "alliance_requests_target_nation_id_nations_id_fk" FOREIGN KEY ("target_nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliances" ADD CONSTRAINT "alliances_nation_a_id_nations_id_fk" FOREIGN KEY ("nation_a_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliances" ADD CONSTRAINT "alliances_nation_b_id_nations_id_fk" FOREIGN KEY ("nation_b_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ammendments" ADD CONSTRAINT "ammendments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ammendments" ADD CONSTRAINT "ammendments_bill_clause_id_bill_clauses_id_fk" FOREIGN KEY ("bill_clause_id") REFERENCES "public"."bill_clauses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ammendments" ADD CONSTRAINT "ammendments_proposer_id_politicians_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."politicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "war_battle_participants" ADD CONSTRAINT "war_battle_participants_battle_id_war_battles_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."war_battles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "war_battle_participants" ADD CONSTRAINT "war_battle_participants_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "war_battle_participants" ADD CONSTRAINT "war_battle_participants_fighting_for_nations_id_fk" FOREIGN KEY ("fighting_for") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "war_battles" ADD CONSTRAINT "war_battles_war_id_wars_id_fk" FOREIGN KEY ("war_id") REFERENCES "public"."wars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_clauses" ADD CONSTRAINT "bill_clauses_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_stage_history" ADD CONSTRAINT "bill_stage_history_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_votes_house" ADD CONSTRAINT "bill_votes_house_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_votes_house" ADD CONSTRAINT "bill_votes_house_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_votes_president" ADD CONSTRAINT "bill_votes_president_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_votes_president" ADD CONSTRAINT "bill_votes_president_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_votes_senate" ADD CONSTRAINT "bill_votes_senate_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_votes_senate" ADD CONSTRAINT "bill_votes_senate_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cabinet" ADD CONSTRAINT "cabinet_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cabinet" ADD CONSTRAINT "cabinet_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_parties" ADD CONSTRAINT "coalition_parties_coalition_id_coalitions_id_fk" FOREIGN KEY ("coalition_id") REFERENCES "public"."coalitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_parties" ADD CONSTRAINT "coalition_parties_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalitions" ADD CONSTRAINT "coalitions_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_votes" ADD CONSTRAINT "election_votes_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_votes" ADD CONSTRAINT "election_votes_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elections" ADD CONSTRAINT "elections_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elections" ADD CONSTRAINT "elections_winner_id_politicians_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."politicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "international_members" ADD CONSTRAINT "international_members_international_id_internationals_id_fk" FOREIGN KEY ("international_id") REFERENCES "public"."internationals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "international_members" ADD CONSTRAINT "international_members_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_resolution_votes" ADD CONSTRAINT "league_resolution_votes_resolution_id_league_resolutions_id_fk" FOREIGN KEY ("resolution_id") REFERENCES "public"."league_resolutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_resolution_votes" ADD CONSTRAINT "league_resolution_votes_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_resolution_votes" ADD CONSTRAINT "league_resolution_votes_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_resolutions" ADD CONSTRAINT "league_resolutions_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_resolutions" ADD CONSTRAINT "league_resolutions_target_nation_id_nations_id_fk" FOREIGN KEY ("target_nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_events" ADD CONSTRAINT "nation_events_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_events" ADD CONSTRAINT "nation_events_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_events" ADD CONSTRAINT "nation_events_primary_id_primaries_id_fk" FOREIGN KEY ("primary_id") REFERENCES "public"."primaries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_events" ADD CONSTRAINT "nation_events_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_events" ADD CONSTRAINT "nation_events_war_id_wars_id_fk" FOREIGN KEY ("war_id") REFERENCES "public"."wars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_events" ADD CONSTRAINT "nation_events_alliance_id_alliances_id_fk" FOREIGN KEY ("alliance_id") REFERENCES "public"."alliances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_events" ADD CONSTRAINT "nation_events_resolution_id_league_resolutions_id_fk" FOREIGN KEY ("resolution_id") REFERENCES "public"."league_resolutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_events" ADD CONSTRAINT "nation_events_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_events" ADD CONSTRAINT "nation_events_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_policies" ADD CONSTRAINT "nation_policies_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_policies" ADD CONSTRAINT "nation_policies_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_stat_history" ADD CONSTRAINT "nation_stat_history_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_stat_history" ADD CONSTRAINT "nation_stat_history_stat_id_stats_id_fk" FOREIGN KEY ("stat_id") REFERENCES "public"."stats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_stats" ADD CONSTRAINT "nation_stats_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_stats" ADD CONSTRAINT "nation_stats_stat_id_stats_id_fk" FOREIGN KEY ("stat_id") REFERENCES "public"."stats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newspaper_articles" ADD CONSTRAINT "newspaper_articles_newspaper_id_party_newspapers_id_fk" FOREIGN KEY ("newspaper_id") REFERENCES "public"."party_newspapers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newspaper_articles" ADD CONSTRAINT "newspaper_articles_author_id_accounts_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newspaper_articles" ADD CONSTRAINT "newspaper_articles_issue_id_newspaper_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."newspaper_issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newspaper_issues" ADD CONSTRAINT "newspaper_issues_newspaper_id_party_newspapers_id_fk" FOREIGN KEY ("newspaper_id") REFERENCES "public"."party_newspapers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_terms" ADD CONSTRAINT "office_terms_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_terms" ADD CONSTRAINT "office_terms_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_terms" ADD CONSTRAINT "office_terms_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_terms" ADD CONSTRAINT "office_terms_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_merge_requests" ADD CONSTRAINT "party_merge_requests_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_merge_requests" ADD CONSTRAINT "party_merge_requests_merged_party_id_parties_id_fk" FOREIGN KEY ("merged_party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_newspapers" ADD CONSTRAINT "party_newspapers_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_policies" ADD CONSTRAINT "party_policies_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_policies" ADD CONSTRAINT "party_policies_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politicians" ADD CONSTRAINT "politicians_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politicians" ADD CONSTRAINT "politicians_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "primaries" ADD CONSTRAINT "primaries_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "primaries" ADD CONSTRAINT "primaries_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "primaries" ADD CONSTRAINT "primaries_coalition_id_coalitions_id_fk" FOREIGN KEY ("coalition_id") REFERENCES "public"."coalitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "primaries" ADD CONSTRAINT "primaries_winner_id_politicians_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."politicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "primary_candidates" ADD CONSTRAINT "primary_candidates_primary_id_primaries_id_fk" FOREIGN KEY ("primary_id") REFERENCES "public"."primaries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "primary_candidates" ADD CONSTRAINT "primary_candidates_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "primary_votes" ADD CONSTRAINT "primary_votes_primary_id_primaries_id_fk" FOREIGN KEY ("primary_id") REFERENCES "public"."primaries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "primary_votes" ADD CONSTRAINT "primary_votes_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_supporters" ADD CONSTRAINT "proposal_supporters_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_supporters" ADD CONSTRAINT "proposal_supporters_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegrams" ADD CONSTRAINT "telegrams_sender_id_accounts_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegrams" ADD CONSTRAINT "telegrams_recipient_id_accounts_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegrams" ADD CONSTRAINT "telegrams_league_resolution_id_league_resolutions_id_fk" FOREIGN KEY ("league_resolution_id") REFERENCES "public"."league_resolutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegrams" ADD CONSTRAINT "telegrams_alliance_request_id_alliance_requests_id_fk" FOREIGN KEY ("alliance_request_id") REFERENCES "public"."alliance_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wars" ADD CONSTRAINT "wars_nation_a_id_nations_id_fk" FOREIGN KEY ("nation_a_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wars" ADD CONSTRAINT "wars_nation_b_id_nations_id_fk" FOREIGN KEY ("nation_b_id") REFERENCES "public"."nations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nation_stat_history_series_idx" ON "nation_stat_history" USING btree ("nation_id","stat_id","recorded_at");