ALTER TABLE "pressure_groups" ADD COLUMN "dormant_party_id" integer REFERENCES "parties"("id");
