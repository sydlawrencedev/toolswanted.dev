-- Rows written per day, by purpose. D1's free plan allows 100,000 rows a
-- day; the registry crawl has to leave most of that for the product.
CREATE TABLE IF NOT EXISTS usage_budget (
  day  TEXT NOT NULL,
  kind TEXT NOT NULL,
  used REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind)
);
