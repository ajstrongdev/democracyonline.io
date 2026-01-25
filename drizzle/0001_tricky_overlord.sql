CREATE TABLE "transaction_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
