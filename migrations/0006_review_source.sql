ALTER TABLE shop_reviews ADD COLUMN source TEXT NOT NULL DEFAULT 'unspecified'
  CHECK (source IN ('unspecified', 'facebook_marketplace', 'google', 'direct', 'other'));
