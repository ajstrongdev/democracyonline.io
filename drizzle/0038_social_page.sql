CREATE TABLE "social_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"username" varchar(255) NOT NULL,
	"content" varchar(280) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "social_posts_created_idx" ON "social_posts" USING btree ("created_at", "id");
--> statement-breakpoint
CREATE TABLE "social_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL REFERENCES "social_posts"("id") ON DELETE CASCADE,
	"user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"username" varchar(255) NOT NULL,
	"content" varchar(2000) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "social_comments_post_idx" ON "social_comments" USING btree ("post_id", "created_at");
--> statement-breakpoint
CREATE TABLE "social_likes" (
	"post_id" integer NOT NULL REFERENCES "social_posts"("id") ON DELETE CASCADE,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "social_likes_pkey" PRIMARY KEY("post_id", "user_id")
);
--> statement-breakpoint
CREATE INDEX "social_likes_user_idx" ON "social_likes" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE "social_reposts" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL REFERENCES "social_posts"("id") ON DELETE CASCADE,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "social_reposts_post_user_unique" UNIQUE("post_id", "user_id")
);
--> statement-breakpoint
CREATE INDEX "social_reposts_created_idx" ON "social_reposts" USING btree ("created_at", "id");
