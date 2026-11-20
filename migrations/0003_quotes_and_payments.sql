CREATE TABLE quote_offers (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  inquiry_id TEXT NOT NULL REFERENCES inquiries(id),
  version INTEGER NOT NULL CHECK (version > 0),
  snapshot TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  email_status TEXT NOT NULL DEFAULT 'pending',
  UNIQUE (shop_id, inquiry_id, version)
);

ALTER TABLE orders ADD COLUMN quote_inquiry_id TEXT REFERENCES inquiries(id);
ALTER TABLE orders ADD COLUMN quote_offer_token TEXT REFERENCES quote_offers(token);
ALTER TABLE orders ADD COLUMN completed_at TEXT;
ALTER TABLE orders ADD COLUMN cancelled_at TEXT;
ALTER TABLE orders ADD COLUMN cancelled_window TEXT REFERENCES delivery_windows(id);
CREATE UNIQUE INDEX orders_by_quote ON orders(shop_id, quote_inquiry_id) WHERE quote_inquiry_id IS NOT NULL;

CREATE TABLE order_payments (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents != 0),
  method TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  recorded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX payments_by_order ON order_payments(shop_id, order_id, created_at, id);
