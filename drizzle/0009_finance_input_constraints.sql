DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_money_bounds_chk'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_money_bounds_chk"
      CHECK ("money" IS NULL OR ("money" >= 0 AND "money" <= 9007199254740991))
      NOT VALID;
  END IF;
END $$;

ALTER TABLE "users" VALIDATE CONSTRAINT "users_money_bounds_chk";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parties_money_bounds_chk'
  ) THEN
    ALTER TABLE "parties"
      ADD CONSTRAINT "parties_money_bounds_chk"
      CHECK ("money" IS NULL OR ("money" >= 0 AND "money" <= 9007199254740991))
      NOT VALID;
  END IF;
END $$;

ALTER TABLE "parties" VALIDATE CONSTRAINT "parties_money_bounds_chk";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parties_party_subs_bounds_chk'
  ) THEN
    ALTER TABLE "parties"
      ADD CONSTRAINT "parties_party_subs_bounds_chk"
      CHECK ("party_subs" IS NULL OR ("party_subs" >= 0 AND "party_subs" <= 100000))
      NOT VALID;
  END IF;
END $$;

ALTER TABLE "parties" VALIDATE CONSTRAINT "parties_party_subs_bounds_chk";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidates_donations_bounds_chk'
  ) THEN
    ALTER TABLE "candidates"
      ADD CONSTRAINT "candidates_donations_bounds_chk"
      CHECK ("donations" IS NULL OR ("donations" >= 0 AND "donations" <= 9007199254740991))
      NOT VALID;
  END IF;
END $$;

ALTER TABLE "candidates" VALIDATE CONSTRAINT "candidates_donations_bounds_chk";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'donation_history_amount_bounds_chk'
  ) THEN
    ALTER TABLE "donation_history"
      ADD CONSTRAINT "donation_history_amount_bounds_chk"
      CHECK ("amount" >= 1 AND "amount" <= 1000000)
      NOT VALID;
  END IF;
END $$;

ALTER TABLE "donation_history" VALIDATE CONSTRAINT "donation_history_amount_bounds_chk";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_capital_bounds_chk'
  ) THEN
    ALTER TABLE "companies"
      ADD CONSTRAINT "companies_capital_bounds_chk"
      CHECK ("capital" IS NULL OR ("capital" >= 0 AND "capital" <= 9007199254740991))
      NOT VALID;
  END IF;
END $$;

ALTER TABLE "companies" VALIDATE CONSTRAINT "companies_capital_bounds_chk";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_issued_shares_bounds_chk'
  ) THEN
    ALTER TABLE "companies"
      ADD CONSTRAINT "companies_issued_shares_bounds_chk"
      CHECK ("issued_shares" IS NULL OR ("issued_shares" >= 0 AND "issued_shares" <= 9007199254740991))
      NOT VALID;
  END IF;
END $$;

ALTER TABLE "companies" VALIDATE CONSTRAINT "companies_issued_shares_bounds_chk";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stocks_price_bounds_chk'
  ) THEN
    ALTER TABLE "stocks"
      ADD CONSTRAINT "stocks_price_bounds_chk"
      CHECK ("price" >= 10 AND "price" <= 9007199254740991)
      NOT VALID;
  END IF;
END $$;

ALTER TABLE "stocks" VALIDATE CONSTRAINT "stocks_price_bounds_chk";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stocks_brought_today_bounds_chk'
  ) THEN
    ALTER TABLE "stocks"
      ADD CONSTRAINT "stocks_brought_today_bounds_chk"
      CHECK ("brought_today" IS NULL OR ("brought_today" >= 0 AND "brought_today" <= 9007199254740991))
      NOT VALID;
  END IF;
END $$;

ALTER TABLE "stocks" VALIDATE CONSTRAINT "stocks_brought_today_bounds_chk";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stocks_sold_today_bounds_chk'
  ) THEN
    ALTER TABLE "stocks"
      ADD CONSTRAINT "stocks_sold_today_bounds_chk"
      CHECK ("sold_today" IS NULL OR ("sold_today" >= 0 AND "sold_today" <= 9007199254740991))
      NOT VALID;
  END IF;
END $$;

ALTER TABLE "stocks" VALIDATE CONSTRAINT "stocks_sold_today_bounds_chk";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_shares_quantity_bounds_chk'
  ) THEN
    ALTER TABLE "user_shares"
      ADD CONSTRAINT "user_shares_quantity_bounds_chk"
      CHECK ("quantity" >= 0 AND "quantity" <= 9007199254740991)
      NOT VALID;
  END IF;
END $$;

ALTER TABLE "user_shares" VALIDATE CONSTRAINT "user_shares_quantity_bounds_chk";
