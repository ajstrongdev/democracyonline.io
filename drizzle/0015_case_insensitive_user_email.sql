DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "users"
    GROUP BY lower("email")
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce case-insensitive email uniqueness: duplicate users exist that differ only by email casing.';
  END IF;
END
$$;

UPDATE "users"
SET "email" = lower("email")
WHERE "email" <> lower("email");

CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" (lower("email"));
