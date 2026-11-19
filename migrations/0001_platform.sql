CREATE TABLE shops (
  id TEXT PRIMARY KEY,
  canonical_hostname TEXT NOT NULL,
  settings TEXT NOT NULL DEFAULT '{}',
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE shop_domains (
  hostname TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id)
);
CREATE TABLE shop_members (
  shop_id TEXT NOT NULL REFERENCES shops(id),
  email TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY (shop_id, email)
);
INSERT INTO shops (id, canonical_hostname) VALUES ('toteworks-atx', 'toteworksatx.com');
INSERT INTO shop_domains VALUES
  ('toteworksatx.com', 'toteworks-atx'),
  ('www.toteworksatx.com', 'toteworks-atx'),
  ('toteworks-atx.iced-law.workers.dev', 'toteworks-atx');

CREATE TABLE delivery_windows (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  date TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  week TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX windows_by_shop ON delivery_windows (shop_id, date, start);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  snapshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'paid', 'declined')),
  confirmed_window TEXT UNIQUE REFERENCES delivery_windows(id),
  payment_token TEXT UNIQUE,
  checkout_session TEXT,
  checkout_attempt INTEGER NOT NULL DEFAULT 0,
  email_status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX orders_by_shop ON orders (shop_id, created_at DESC);

CREATE TABLE inquiries (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  snapshot TEXT NOT NULL,
  email_status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX inquiries_by_shop ON inquiries (shop_id, created_at DESC);
