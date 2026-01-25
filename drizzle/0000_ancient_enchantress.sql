CREATE TABLE "access_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "access_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "bill_votes_house" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer,
	"voter_id" integer,
	"vote_yes" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_votes_presidential" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer,
	"voter_id" integer,
	"vote_yes" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_votes_senate" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer,
	"voter_id" integer,
	"vote_yes" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(50) DEFAULT 'Queued' NOT NULL,
	"stage" varchar(50) DEFAULT 'House' NOT NULL,
	"title" varchar(255) NOT NULL,
	"creator_id" integer,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"pool" integer
);
--> statement-breakpoint
CREATE TABLE "candidate_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" bigint DEFAULT 0 NOT NULL,
	"purchased_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"election" varchar(50),
	"votes" integer DEFAULT 0,
	"votes_per_hour" integer DEFAULT 0,
	"donations_per_hour" integer DEFAULT 0,
	"donations" bigint DEFAULT 0,
	"haswon" boolean,
	CONSTRAINT "candidates_user_id_election_unique" UNIQUE("user_id","election")
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"room" varchar(255) NOT NULL,
	"username" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "elections" (
	"election" varchar(50) PRIMARY KEY NOT NULL,
	"status" varchar(50) DEFAULT 'Candidacy' NOT NULL,
	"seats" integer,
	"days_left" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "game_tracker" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_pool" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"target" varchar(50) NOT NULL,
	"increase_amount" bigint NOT NULL,
	"base_cost" bigint NOT NULL,
	"cost_multiplier" bigint DEFAULT 30 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merge_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"leader_id" integer,
	"name" varchar(255) NOT NULL,
	"color" varchar(7) NOT NULL,
	"bio" text,
	"political_leaning" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"leaning" varchar(25) NOT NULL,
	"logo" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "merge_request_stances" (
	"id" serial PRIMARY KEY NOT NULL,
	"merge_request_id" integer NOT NULL,
	"stance_id" integer NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" serial PRIMARY KEY NOT NULL,
	"leader_id" integer,
	"name" varchar(255) NOT NULL,
	"color" varchar(7) NOT NULL,
	"bio" text,
	"political_leaning" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"leaning" varchar(25),
	"logo" varchar(100),
	"discord" varchar(255),
	"party_subs" bigint DEFAULT 0,
	"money" bigint DEFAULT 0,
	CONSTRAINT "parties_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "party_notifications" (
	"sender_party_id" integer NOT NULL,
	"receiver_party_id" integer NOT NULL,
	"merge_request_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"status" varchar(20) DEFAULT 'Pending' NOT NULL,
	CONSTRAINT "party_notifications_sender_party_id_receiver_party_id_merge_request_id_pk" PRIMARY KEY("sender_party_id","receiver_party_id","merge_request_id")
);
--> statement-breakpoint
CREATE TABLE "party_stances" (
	"party_id" integer,
	"stance_id" integer,
	"value" varchar(1024) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "political_stances" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue" varchar(100) NOT NULL,
	"description" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presidential_election" (
	"id" serial PRIMARY KEY NOT NULL,
	"voter_id" integer,
	"candidate_id" integer,
	"points_won" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "senate_election" (
	"id" serial PRIMARY KEY NOT NULL,
	"voter_id" integer,
	"candidate_id" integer,
	"points_won" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_id" integer,
	"price" bigint NOT NULL,
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"price" bigint NOT NULL,
	"brought_today" bigint DEFAULT 0,
	"sold_today" bigint DEFAULT 0,
	CONSTRAINT "stocks_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(255) NOT NULL,
	"bio" text,
	"political_leaning" varchar(50),
	"role" varchar(50) DEFAULT 'Representative',
	"party_id" integer,
	"created_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"last_activity" bigint DEFAULT 0,
	"money" bigint DEFAULT 100,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"vote_type" varchar(50) NOT NULL,
	"candidate_id" integer
);
