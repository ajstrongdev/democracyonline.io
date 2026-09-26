ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
-- Legacy inactivity disabled accounts after game ticks. Restore those accounts,
-- but preserve deliberate moderator suspensions.
UPDATE "users" AS u SET "is_active" = true
WHERE u."is_active" = false
  AND NOT EXISTS (
    SELECT 1 FROM (
      SELECT action FROM "moderation_audit_log"
      WHERE target_user_id = u.id AND action IN ('suspend', 'restore')
      ORDER BY id DESC LIMIT 1
    ) AS latest WHERE latest.action = 'suspend'
  );
