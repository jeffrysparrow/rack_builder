ALTER TABLE inquiries ADD COLUMN qualified INTEGER NOT NULL DEFAULT 0 CHECK (qualified IN (0, 1));
ALTER TABLE inquiries ADD COLUMN receipt_email_status TEXT;

ALTER TABLE orders ADD COLUMN qualified INTEGER NOT NULL DEFAULT 0 CHECK (qualified IN (0, 1));
ALTER TABLE orders ADD COLUMN request_email_status TEXT;
ALTER TABLE orders ADD COLUMN receipt_email_status TEXT;
