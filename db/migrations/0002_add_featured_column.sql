-- db/migrations/0002_add_featured_column.sql
-- Add featured column to listings table.
-- This migration MUST be applied before 0003_seed_legacy_listings.sql
-- because the seed sets featured=1 for riverside-terrace-modern-craftsman.
--
-- Applied via:
--   wrangler d1 migrations apply DB --local   (dev)
--   wrangler d1 migrations apply DB --remote  (prod)

ALTER TABLE listings ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
