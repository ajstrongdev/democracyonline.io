CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"description" text,
	"capital" bigint DEFAULT 0,
	"issued_shares" bigint DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "companies_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
ALTER TABLE "stocks" DROP CONSTRAINT "stocks_symbol_unique";--> statement-breakpoint
ALTER TABLE "stocks" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stocks" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "stocks" DROP COLUMN "symbol";