INSERT INTO shop_domains (hostname, shop_id) VALUES
  ('totesandtimber.com', 'toteworks-atx'),
  ('www.totesandtimber.com', 'toteworks-atx');

UPDATE shops SET canonical_hostname = 'totesandtimber.com' WHERE id = 'toteworks-atx';
