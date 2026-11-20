CREATE TABLE shop_reviews (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  customer_name TEXT NOT NULL CHECK (length(customer_name) BETWEEN 1 AND 100),
  stars INTEGER NOT NULL CHECK (stars IN (1, 2, 3, 4, 5)),
  comment TEXT NOT NULL CHECK (length(comment) BETWEEN 1 AND 2000),
  published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX reviews_by_shop ON shop_reviews(shop_id, created_at DESC, id DESC);
