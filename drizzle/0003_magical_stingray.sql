CREATE TABLE "user_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"quantity" bigint DEFAULT 0 NOT NULL,
	"acquired_at" timestamp DEFAULT now(),
	CONSTRAINT "user_shares_user_id_company_id_unique" UNIQUE("user_id","company_id")
);
--> statement-breakpoint
ALTER TABLE "user_shares" ADD CONSTRAINT "user_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_shares" ADD CONSTRAINT "user_shares_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;