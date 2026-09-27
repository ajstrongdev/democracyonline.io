CREATE TABLE "coup_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coup_officeholder_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "coup_id" integer NOT NULL REFERENCES "coup_history"("id") ON DELETE cascade,
  "user_id" integer,
  "username" varchar(255) NOT NULL,
  "party_id" integer,
  "party_name" varchar(255),
  "party_color" varchar(7),
  "office" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "coup_officeholder_history_coup_idx" ON "coup_officeholder_history" ("coup_id");
--> statement-breakpoint
CREATE TABLE "coup_role_changes" (
  "id" serial PRIMARY KEY NOT NULL,
  "coup_id" integer NOT NULL REFERENCES "coup_history"("id") ON DELETE cascade,
  "user_id" integer,
  "username" varchar(255) NOT NULL,
  "from_office" varchar(50),
  "to_office" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "coup_role_changes_user_idx" ON "coup_role_changes" ("user_id");
