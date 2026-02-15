CREATE TABLE IF NOT EXISTS "stock_orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "company_id" integer NOT NULL REFERENCES "companies"("id"),
  "side" varchar(4) NOT NULL,
  "quantity" bigint NOT NULL,
  "filled_quantity" bigint DEFAULT 0 NOT NULL,
  "price_per_share" bigint NOT NULL,
  "status" varchar(16) DEFAULT 'open' NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "order_fills" (
  "id" serial PRIMARY KEY NOT NULL,
  "buy_order_id" integer NOT NULL REFERENCES "stock_orders"("id"),
  "sell_order_id" integer NOT NULL REFERENCES "stock_orders"("id"),
  "company_id" integer NOT NULL REFERENCES "companies"("id"),
  "buyer_user_id" integer NOT NULL REFERENCES "users"("id"),
  "seller_user_id" integer NOT NULL REFERENCES "users"("id"),
  "quantity" bigint NOT NULL,
  "price_per_share" bigint NOT NULL,
  "total_price" bigint NOT NULL,
  "filled_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_stock_orders_company_side_status" ON "stock_orders" ("company_id", "side", "status");
CREATE INDEX IF NOT EXISTS "idx_stock_orders_user_status" ON "stock_orders" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_order_fills_company" ON "order_fills" ("company_id");
