-- db/migrations/0001_initial_schema.sql
-- D1 initial schema for Houston Home Spotlight
-- Source: REQUIREMENTS.md + STATE.md design decisions
-- Applied via: wrangler d1 migrations apply DB --local (dev) / --remote (prod)

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  photo_url TEXT,
  phone TEXT,
  brokerage TEXT,
  license_number TEXT,
  slug TEXT UNIQUE,
  stripe_customer_id TEXT UNIQUE,
  subscription_status TEXT NOT NULL DEFAULT 'none',
  subscription_grace_until INTEGER,
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_suspended INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Houston',
  state TEXT NOT NULL DEFAULT 'TX',
  zip TEXT,
  price INTEGER NOT NULL,
  beds INTEGER NOT NULL,
  baths REAL NOT NULL,
  sqft INTEGER,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  video_url TEXT,
  video_status TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS listing_images (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  current_period_start INTEGER,
  current_period_end INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  processed_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  firstname TEXT NOT NULL,
  lastname TEXT NOT NULL,
  email TEXT NOT NULL,
  phonenumber TEXT NOT NULL,
  message TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_listings_agent_id ON listings(agent_id);
CREATE INDEX IF NOT EXISTS idx_listings_slug ON listings(slug);
CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON listing_images(listing_id);
CREATE INDEX IF NOT EXISTS idx_leads_agent_id ON leads(agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_listing_id ON leads(listing_id);
CREATE INDEX IF NOT EXISTS idx_agents_stripe_customer ON agents(stripe_customer_id);
