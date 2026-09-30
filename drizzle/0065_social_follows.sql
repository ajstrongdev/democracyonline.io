CREATE TABLE "social_follows" (
	"follower_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"followed_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_follows_follower_followed_pk" PRIMARY KEY("follower_id","followed_id"),
	CONSTRAINT "social_follows_no_self" CHECK ("follower_id" <> "followed_id")
);
CREATE INDEX "social_follows_followed_idx" ON "social_follows" USING btree ("followed_id");
