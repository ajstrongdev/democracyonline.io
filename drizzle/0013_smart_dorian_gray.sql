CREATE TABLE "coalition_members" (
	"coalition_id" integer NOT NULL,
	"party_id" integer NOT NULL,
	"join_date" timestamp DEFAULT now(),
	CONSTRAINT "coalition_members_coalition_id_party_id_pk" PRIMARY KEY("coalition_id","party_id")
);
--> statement-breakpoint
CREATE TABLE "coalitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"color" varchar(7) NOT NULL,
	"bio" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "coalitions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "finance_kpi_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"policy" varchar(32) NOT NULL,
	"share_price" bigint NOT NULL,
	"issued_shares" bigint NOT NULL,
	"market_cap" bigint NOT NULL,
	"hourly_dividend_pool" bigint NOT NULL,
	"dividend_per_share_milli" bigint NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "game_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"current_game_hour" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "join_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"party_id" integer NOT NULL,
	"coalition_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_fills" (
	"id" serial PRIMARY KEY NOT NULL,
	"buy_order_id" integer NOT NULL,
	"sell_order_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"buyer_user_id" integer NOT NULL,
	"seller_user_id" integer NOT NULL,
	"quantity" bigint NOT NULL,
	"price_per_share" bigint NOT NULL,
	"total_price" bigint NOT NULL,
	"filled_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "share_issuance_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"policy" varchar(32) NOT NULL,
	"source" varchar(32) NOT NULL,
	"minted_shares" bigint NOT NULL,
	"issued_shares_before" bigint NOT NULL,
	"issued_shares_after" bigint NOT NULL,
	"active_holders" bigint DEFAULT 0,
	"buy_pressure_delta" bigint DEFAULT 0,
	"ownership_drift_bps" bigint DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stock_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"side" varchar(4) NOT NULL,
	"quantity" bigint NOT NULL,
	"filled_quantity" bigint DEFAULT 0 NOT NULL,
	"price_per_share" bigint NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"game_hour" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "finance_kpi_snapshots" ADD CONSTRAINT "finance_kpi_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_fills" ADD CONSTRAINT "order_fills_buy_order_id_stock_orders_id_fk" FOREIGN KEY ("buy_order_id") REFERENCES "public"."stock_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_fills" ADD CONSTRAINT "order_fills_sell_order_id_stock_orders_id_fk" FOREIGN KEY ("sell_order_id") REFERENCES "public"."stock_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_fills" ADD CONSTRAINT "order_fills_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_fills" ADD CONSTRAINT "order_fills_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_fills" ADD CONSTRAINT "order_fills_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_issuance_events" ADD CONSTRAINT "share_issuance_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_orders" ADD CONSTRAINT "stock_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_orders" ADD CONSTRAINT "stock_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;