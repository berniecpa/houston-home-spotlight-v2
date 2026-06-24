-- db/migrations/0007_add_listing_fields_and_expiry.sql
-- Adds uploaded-home metadata fields and a listing expiration timestamp.
--
-- New columns on `listings`:
--   homebuilder  TEXT     — builder name (e.g. "Meritage Homes"); NULL for resale.
--   incentives   TEXT     — free-text promos (e.g. "$10k toward closing"); NULL if none.
--   source_url   TEXT     — authority link to the MLS/Zillow/builder listing; NULL if none.
--   expires_at   INTEGER  — epoch seconds when the listing auto-hides from public
--                           browse (listing date + 90 days). Agents refresh to reset it.
--
-- Expiry is enforced in the read path (AGENT_VISIBLE_SQL consumers) via
--   (l.expires_at IS NULL OR l.expires_at > unixepoch())
-- NULL means "never expires" (defensive default for any row missing the value).
--
-- Backfill: existing listings get a FRESH 90 days from the migration moment so
-- current live inventory is not instantly hidden on deploy. New listings set
-- expires_at = created_at + 7776000 at insert time (SQLite ADD COLUMN cannot use
-- a non-constant DEFAULT, so the app sets it).

ALTER TABLE listings ADD COLUMN homebuilder TEXT;
ALTER TABLE listings ADD COLUMN incentives TEXT;
ALTER TABLE listings ADD COLUMN source_url TEXT;
ALTER TABLE listings ADD COLUMN expires_at INTEGER;

-- 7776000 = 90 days in seconds. Fresh 90-day window for existing inventory.
UPDATE listings SET expires_at = unixepoch() + 7776000 WHERE expires_at IS NULL;
