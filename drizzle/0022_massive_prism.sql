CREATE TABLE "wiki_article_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"editor_user_id" integer,
	"editor_username" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"edit_summary" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(30) NOT NULL,
	"entity_id" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wiki_articles_entity_unique" UNIQUE("entity_type","entity_id")
);
--> statement-breakpoint
ALTER TABLE "wiki_article_revisions" ADD CONSTRAINT "wiki_article_revisions_article_id_wiki_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."wiki_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wiki_article_revisions_article_idx" ON "wiki_article_revisions" USING btree ("article_id","created_at");