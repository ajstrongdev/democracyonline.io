CREATE TABLE "color_schemes" (
  "id" serial PRIMARY KEY NOT NULL,
  "owner_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(60) NOT NULL,
  "mode" varchar(5) NOT NULL,
  "background" varchar(7) NOT NULL,
  "foreground" varchar(7) NOT NULL,
  "primary" varchar(7) NOT NULL,
  "accent" varchar(7) NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "color_schemes_mode_valid" CHECK ("mode" in ('light', 'dark')),
  CONSTRAINT "color_schemes_hex_0_valid" CHECK ("background" ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT "color_schemes_hex_1_valid" CHECK ("foreground" ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT "color_schemes_hex_2_valid" CHECK ("primary" ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT "color_schemes_hex_3_valid" CHECK ("accent" ~ '^#[0-9a-fA-F]{6}$')
);--> statement-breakpoint
CREATE INDEX "color_schemes_owner_idx" ON "color_schemes" ("owner_id");--> statement-breakpoint
CREATE INDEX "color_schemes_public_idx" ON "color_schemes" ("is_published", "id");
