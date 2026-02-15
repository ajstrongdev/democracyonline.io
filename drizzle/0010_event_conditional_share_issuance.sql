CREATE TABLE IF NOT EXISTS share_issuance_events (
  id serial PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  policy varchar(32) NOT NULL,
  source varchar(32) NOT NULL,
  minted_shares bigint NOT NULL,
  issued_shares_before bigint NOT NULL,
  issued_shares_after bigint NOT NULL,
  active_holders bigint DEFAULT 0,
  buy_pressure_delta bigint DEFAULT 0,
  ownership_drift_bps bigint DEFAULT 0,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS share_issuance_events_company_created_idx
  ON share_issuance_events(company_id, created_at);

CREATE INDEX IF NOT EXISTS share_issuance_events_source_created_idx
  ON share_issuance_events(source, created_at);

CREATE TABLE IF NOT EXISTS finance_kpi_snapshots (
  id serial PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  policy varchar(32) NOT NULL,
  share_price bigint NOT NULL,
  issued_shares bigint NOT NULL,
  market_cap bigint NOT NULL,
  hourly_dividend_pool bigint NOT NULL,
  dividend_per_share_milli bigint NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finance_kpi_snapshots_company_created_idx
  ON finance_kpi_snapshots(company_id, created_at);
