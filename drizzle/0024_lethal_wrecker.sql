CREATE TABLE "bill_locked_policy_effects" (
	"bill_id" integer NOT NULL,
	"policy_key" varchar(100) NOT NULL,
	"previous_value" jsonb NOT NULL,
	"new_value" jsonb NOT NULL,
	CONSTRAINT "bill_locked_policy_effects_bill_id_policy_key_pk" PRIMARY KEY("bill_id","policy_key")
);
--> statement-breakpoint
CREATE TABLE "bill_locked_stat_effects" (
	"bill_id" integer NOT NULL,
	"stat_key" varchar(100) NOT NULL,
	"effect" double precision NOT NULL,
	CONSTRAINT "bill_locked_stat_effects_bill_id_stat_key_pk" PRIMARY KEY("bill_id","stat_key")
);
--> statement-breakpoint
CREATE TABLE "committee_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer NOT NULL,
	"senator_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "committee_assessment_bill_senator_unique" UNIQUE("bill_id","senator_id")
);
--> statement-breakpoint
CREATE TABLE "committee_policy_assessments" (
	"assessment_id" integer NOT NULL,
	"policy_key" varchar(100) NOT NULL,
	"proposed_value" jsonb NOT NULL,
	CONSTRAINT "committee_policy_assessments_assessment_id_policy_key_pk" PRIMARY KEY("assessment_id","policy_key")
);
--> statement-breakpoint
CREATE TABLE "committee_stat_assessments" (
	"assessment_id" integer NOT NULL,
	"stat_key" varchar(100) NOT NULL,
	"effect" integer NOT NULL,
	CONSTRAINT "committee_stat_assessments_assessment_id_stat_key_pk" PRIMARY KEY("assessment_id","stat_key"),
	CONSTRAINT "committee_stat_effect_range" CHECK ("committee_stat_assessments"."effect" between -2 and 2)
);
--> statement-breakpoint
CREATE TABLE "nation_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nation_id" integer NOT NULL,
	"bill_id" integer NOT NULL,
	"kind" varchar(20) NOT NULL,
	"key" varchar(100) NOT NULL,
	"previous_value" jsonb NOT NULL,
	"new_value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nation_change_bill_kind_key_unique" UNIQUE("bill_id","kind","key")
);
--> statement-breakpoint
CREATE TABLE "nation_policy_definitions" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"options" jsonb,
	"min" double precision,
	"max" double precision,
	"default_value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nation_policy_values" (
	"nation_id" integer NOT NULL,
	"policy_key" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nation_policy_values_nation_id_policy_key_pk" PRIMARY KEY("nation_id","policy_key")
);
--> statement-breakpoint
CREATE TABLE "nation_stat_definitions" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(100) NOT NULL,
	"default_value" double precision NOT NULL,
	"min" double precision NOT NULL,
	"max" double precision NOT NULL,
	"headline" varchar(50),
	"headline_weight" double precision DEFAULT 0 NOT NULL,
	"headline_direction" varchar(20),
	"flavour" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nation_stat_values" (
	"nation_id" integer NOT NULL,
	"stat_key" varchar(100) NOT NULL,
	"value" double precision NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nation_stat_values_nation_id_stat_key_pk" PRIMARY KEY("nation_id","stat_key")
);
--> statement-breakpoint
CREATE TABLE "nations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"civil_rights" double precision DEFAULT 50 NOT NULL,
	"economy" double precision DEFAULT 50 NOT NULL,
	"political_freedoms" double precision DEFAULT 50 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bills" ALTER COLUMN "status" SET DEFAULT 'Committee';--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "committee_closed_at" timestamp;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "committee_participant_count" integer;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "nation_effects_applied_at" timestamp;--> statement-breakpoint
UPDATE "bills" SET "status" = 'Committee' WHERE "status" = 'Queued';--> statement-breakpoint
UPDATE "bills" SET "committee_closed_at" = COALESCE("created_at", now()), "committee_participant_count" = 0 WHERE "status" <> 'Committee';--> statement-breakpoint
ALTER TABLE "bill_locked_policy_effects" ADD CONSTRAINT "bill_locked_policy_effects_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_locked_policy_effects" ADD CONSTRAINT "bill_locked_policy_effects_policy_key_nation_policy_definitions_key_fk" FOREIGN KEY ("policy_key") REFERENCES "public"."nation_policy_definitions"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_locked_stat_effects" ADD CONSTRAINT "bill_locked_stat_effects_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_locked_stat_effects" ADD CONSTRAINT "bill_locked_stat_effects_stat_key_nation_stat_definitions_key_fk" FOREIGN KEY ("stat_key") REFERENCES "public"."nation_stat_definitions"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_assessments" ADD CONSTRAINT "committee_assessments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_assessments" ADD CONSTRAINT "committee_assessments_senator_id_users_id_fk" FOREIGN KEY ("senator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_policy_assessments" ADD CONSTRAINT "committee_policy_assessments_assessment_id_committee_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."committee_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_policy_assessments" ADD CONSTRAINT "committee_policy_assessments_policy_key_nation_policy_definitions_key_fk" FOREIGN KEY ("policy_key") REFERENCES "public"."nation_policy_definitions"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_stat_assessments" ADD CONSTRAINT "committee_stat_assessments_assessment_id_committee_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."committee_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_stat_assessments" ADD CONSTRAINT "committee_stat_assessments_stat_key_nation_stat_definitions_key_fk" FOREIGN KEY ("stat_key") REFERENCES "public"."nation_stat_definitions"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_changes" ADD CONSTRAINT "nation_changes_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_changes" ADD CONSTRAINT "nation_changes_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_policy_values" ADD CONSTRAINT "nation_policy_values_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_policy_values" ADD CONSTRAINT "nation_policy_values_policy_key_nation_policy_definitions_key_fk" FOREIGN KEY ("policy_key") REFERENCES "public"."nation_policy_definitions"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_stat_values" ADD CONSTRAINT "nation_stat_values_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nation_stat_values" ADD CONSTRAINT "nation_stat_values_stat_key_nation_stat_definitions_key_fk" FOREIGN KEY ("stat_key") REFERENCES "public"."nation_stat_definitions"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nation_change_created_at_idx" ON "nation_changes" USING btree ("created_at");
