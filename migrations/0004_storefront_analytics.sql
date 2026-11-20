CREATE TABLE funnel_events (
  shop_id TEXT NOT NULL REFERENCES shops(id),
  event TEXT NOT NULL,
  event_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (shop_id, event, event_key)
);
CREATE INDEX funnel_events_by_date ON funnel_events(shop_id, created_at, event);

INSERT INTO funnel_events (shop_id, event, event_key, created_at)
  SELECT shop_id, 'generate_lead', 'inquiry:' || id, created_at FROM inquiries
  UNION ALL SELECT shop_id, 'generate_lead', 'order:' || id, created_at FROM orders WHERE quote_inquiry_id IS NULL;

CREATE TRIGGER inquiry_captured AFTER INSERT ON inquiries BEGIN
  INSERT INTO funnel_events (shop_id, event, event_key) VALUES (NEW.shop_id, 'generate_lead', 'inquiry:' || NEW.id);
END;

CREATE TRIGGER order_request_captured AFTER INSERT ON orders WHEN NEW.quote_inquiry_id IS NULL BEGIN
  INSERT INTO funnel_events (shop_id, event, event_key) VALUES (NEW.shop_id, 'generate_lead', 'order:' || NEW.id);
END;

CREATE TRIGGER order_confirmed AFTER UPDATE OF status ON orders WHEN OLD.status = 'requested' AND NEW.status = 'confirmed' BEGIN
  INSERT INTO funnel_events (shop_id, event, event_key) VALUES (NEW.shop_id, 'order_confirmed', NEW.id);
END;

CREATE TRIGGER order_completed AFTER UPDATE OF completed_at ON orders WHEN OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL BEGIN
  INSERT INTO funnel_events (shop_id, event, event_key) VALUES (NEW.shop_id, 'order_completed', NEW.id);
END;

CREATE TRIGGER deposit_verified AFTER INSERT ON order_payments WHEN NEW.amount_cents > 0 BEGIN
  INSERT INTO funnel_events (shop_id, event, event_key)
    SELECT o.shop_id, 'deposit_paid', o.id FROM orders o WHERE o.shop_id = NEW.shop_id AND o.id = NEW.order_id
      AND json_extract(o.snapshot, '$.payment.depositCents') > 0
      AND json_extract(o.snapshot, '$.payment.depositCents') <= (SELECT SUM(p.amount_cents) FROM order_payments p
        WHERE p.shop_id = NEW.shop_id AND p.order_id = NEW.order_id)
    ON CONFLICT(shop_id, event, event_key) DO NOTHING;
END;
