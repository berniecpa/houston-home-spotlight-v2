-- db/migrations/0003_seed_legacy_listings.sql
-- Idempotent seed of 3 legacy JSON listings into D1.
--
-- PREREQUISITE (IMPORTANT — do NOT apply before these steps are complete):
--   1. Bernard must log in at least once so his agents row is created in D1.
--   2. The set-admin-claim script must have run, setting is_admin=1 on Bernard's row.
--   3. Migration 0002_add_featured_column.sql must be applied before this file.
--
-- The seed uses (SELECT id FROM agents WHERE is_admin = 1 LIMIT 1) so no UID
-- is hardcoded — this resolves dynamically to Bernard's admin agents row.
--
-- Idempotency: all INSERTs use INSERT OR IGNORE keyed on the UNIQUE slug column.
-- Re-running this migration after it has already been applied is a no-op.
--
-- WR-07 — silent-empty-seed guard:
--   Each listing INSERT below is now `INSERT OR IGNORE ... SELECT ... WHERE
--   EXISTS (SELECT 1 FROM agents WHERE is_admin = 1)`. If the admin agent row
--   does not yet exist when this migration is applied, the SELECT produces zero
--   rows and NOTHING is inserted — the migration does NOT record a spurious
--   "applied with broken FK" state. Because the slug-keyed INSERT OR IGNORE is
--   a no-op once the rows exist, this migration is safe to re-apply AFTER the
--   prerequisites above are satisfied, at which point the rows will land.
--
-- MANDATORY POST-APPLY VERIFICATION (run after every apply; the seed is silent
-- by design, so you MUST confirm the rows exist):
--   wrangler d1 execute DB --command \
--     "SELECT COUNT(*) AS seeded FROM listings WHERE id IN \
--      ('seed-listing-1','seed-listing-2','seed-listing-3');"
--   Expected result: seeded = 3. If it returns 0, the admin agent row did not
--   exist at apply time — complete the prerequisites above, then RE-APPLY.
--
-- Applied via:
--   wrangler d1 migrations apply DB --local   (dev)
--   wrangler d1 migrations apply DB --remote  (prod — only after prerequisites above)
--
-- Slugs preserved exactly to keep existing /listings/[slug] URLs working:
--   heights-bungalow-historic
--   riverside-terrace-modern-craftsman
--   sugarland-estate-pool

-- ----------------------------------------------------------------
-- Listing 1: riverside-terrace-modern-craftsman (featured=1)
-- Source: src/data/listings/riverside-terrace-modern-craftsman.json
-- ----------------------------------------------------------------
INSERT OR IGNORE INTO listings (
  id, agent_id, title, slug, address, city, state, zip,
  price, beds, baths, sqft, description, status, featured,
  created_at, updated_at
)
SELECT
  'seed-listing-1',
  (SELECT id FROM agents WHERE is_admin = 1 LIMIT 1),
  'Modern Craftsman at 2611 Wichita Street',
  'riverside-terrace-modern-craftsman',
  '2611 Wichita Street', 'Houston', 'TX', '77004',
  785000, 4, 3.5, 3200,
  'Stunning modern craftsman home in the historic Riverside Terrace neighborhood. This beautifully renovated property features an open-concept living space with vaulted ceilings, a chef''s kitchen with quartz countertops and stainless steel appliances, and a spacious master suite with a spa-like bathroom. The backyard oasis includes a covered patio, perfect for entertaining. Walking distance to Hermann Park and the Medical Center. Move-in ready with recent updates including new HVAC, roof, and energy-efficient windows.',
  'active', 1,
  strftime('%s', '2025-02-15T10:00:00Z'), unixepoch()
WHERE EXISTS (SELECT 1 FROM agents WHERE is_admin = 1);

-- ----------------------------------------------------------------
-- Listing 2: heights-bungalow-historic (featured=0)
-- Source: src/data/listings/heights-bungalow-historic.json
-- ----------------------------------------------------------------
INSERT OR IGNORE INTO listings (
  id, agent_id, title, slug, address, city, state, zip,
  price, beds, baths, sqft, description, status, featured,
  created_at, updated_at
)
SELECT
  'seed-listing-2',
  (SELECT id FROM agents WHERE is_admin = 1 LIMIT 1),
  'Historic Bungalow at 1421 Ashland Street',
  'heights-bungalow-historic',
  '1421 Ashland Street', 'Houston', 'TX', '77008',
  625000, 3, 2, 1850,
  'Charming 1920s bungalow in the heart of the Heights! This meticulously maintained home retains its original character with hardwood floors, vintage light fixtures, and a cozy front porch. Updated kitchen with farmhouse sink and butcher block counters. Large lot with mature oak trees and a detached garage with potential for workshop or studio space. Blocks from Heights Boulevard''s hike and bike trail, local boutiques, and award-winning restaurants. Zoned to top-rated Harvard Elementary.',
  'active', 0,
  strftime('%s', '2025-02-28T14:30:00Z'), unixepoch()
WHERE EXISTS (SELECT 1 FROM agents WHERE is_admin = 1);

-- ----------------------------------------------------------------
-- Listing 3: sugarland-estate-pool (featured=0, has video_url)
-- Source: src/data/listings/sugarland-estate-pool.json
-- ----------------------------------------------------------------
INSERT OR IGNORE INTO listings (
  id, agent_id, title, slug, address, city, state, zip,
  price, beds, baths, sqft, description, status, video_url, featured,
  created_at, updated_at
)
SELECT
  'seed-listing-3',
  (SELECT id FROM agents WHERE is_admin = 1 LIMIT 1),
  'Estate with Pool at 1523 Riverstone Ranch Drive',
  'sugarland-estate-pool',
  '1523 Riverstone Ranch Drive', 'Sugar Land', 'TX', '77479',
  925000, 5, 4, 4100,
  'Exceptional family estate in the sought-after Riverstone community! This spacious home offers 5 bedrooms plus a study, formal dining, and a massive game room upstairs. Gourmet kitchen features double ovens, gas cooktop, and walk-in pantry. Primary retreat downstairs with sitting area and luxurious bath. Resort-style backyard with saltwater pool, spa, and summer kitchen. Excellent Fort Bend ISD schools and resort-style community amenities including pools, tennis courts, and walking trails. Easy access to Highway 59 and a short commute to the Medical Center and Galleria.',
  'active', 'https://www.youtube.com/watch?v=example-tour-3', 0,
  strftime('%s', '2025-03-05T09:15:00Z'), unixepoch()
WHERE EXISTS (SELECT 1 FROM agents WHERE is_admin = 1);

-- ----------------------------------------------------------------
-- Images: seeded in original array index order (display_order = index)
-- INSERT OR IGNORE keyed on the listing_images primary key (id column)
-- ----------------------------------------------------------------

-- Listing 1 images (5 images, display_order 0-4)
INSERT OR IGNORE INTO listing_images (id, listing_id, url, display_order) VALUES
  ('seed-img-1-0', 'seed-listing-1', 'https://picsum.photos/seed/houston1-1/1200/800', 0),
  ('seed-img-1-1', 'seed-listing-1', 'https://picsum.photos/seed/houston1-2/1200/800', 1),
  ('seed-img-1-2', 'seed-listing-1', 'https://picsum.photos/seed/houston1-3/1200/800', 2),
  ('seed-img-1-3', 'seed-listing-1', 'https://picsum.photos/seed/houston1-4/1200/800', 3),
  ('seed-img-1-4', 'seed-listing-1', 'https://picsum.photos/seed/houston1-5/1200/800', 4);

-- Listing 2 images (4 images, display_order 0-3)
INSERT OR IGNORE INTO listing_images (id, listing_id, url, display_order) VALUES
  ('seed-img-2-0', 'seed-listing-2', 'https://picsum.photos/seed/houston2-1/1200/800', 0),
  ('seed-img-2-1', 'seed-listing-2', 'https://picsum.photos/seed/houston2-2/1200/800', 1),
  ('seed-img-2-2', 'seed-listing-2', 'https://picsum.photos/seed/houston2-3/1200/800', 2),
  ('seed-img-2-3', 'seed-listing-2', 'https://picsum.photos/seed/houston2-4/1200/800', 3);

-- Listing 3 images (5 images, display_order 0-4)
INSERT OR IGNORE INTO listing_images (id, listing_id, url, display_order) VALUES
  ('seed-img-3-0', 'seed-listing-3', 'https://picsum.photos/seed/houston3-1/1200/800', 0),
  ('seed-img-3-1', 'seed-listing-3', 'https://picsum.photos/seed/houston3-2/1200/800', 1),
  ('seed-img-3-2', 'seed-listing-3', 'https://picsum.photos/seed/houston3-3/1200/800', 2),
  ('seed-img-3-3', 'seed-listing-3', 'https://picsum.photos/seed/houston3-4/1200/800', 3),
  ('seed-img-3-4', 'seed-listing-3', 'https://picsum.photos/seed/houston3-5/1200/800', 4);
