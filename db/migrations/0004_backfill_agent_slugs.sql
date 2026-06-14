-- db/migrations/0004_backfill_agent_slugs.sql
-- One-time slug backfill for existing agents rows.
--
-- APPLICATION DEFERRED (human-verify checkpoint — see 05-01-PLAN.md Task 5):
-- This migration requires agent rows to exist in D1 before it can be applied.
-- Like the Phase 4 seed (0003_seed_legacy_listings.sql), it must be run
-- manually after real agents have registered:
--
--   wrangler d1 migrations apply DB --local   (local dev)
--   wrangler d1 migrations apply DB --remote  (production)
--
-- Safe to re-apply: the WHERE slug IS NULL guard prevents overwriting existing slugs.
-- After application, verify: SELECT id, display_name, slug FROM agents;
--
-- Slug generation logic (mirrors slugifyName in src/app/api/agent/profile/route.ts):
--   1. Lowercase display_name
--   2. Replace non-alphanumeric chars (except hyphens) with empty string via
--      SQLite's replace() chained for common characters
--   3. Collapse consecutive hyphens
--   4. Trim to 80 chars
--   5. Fall back to 'agent-' || substr(id,1,8) when display_name is NULL or empty
--
-- NOTE: SQLite does not support regexp replace, so this approximates the TypeScript
-- slugifyName() by stripping spaces→hyphens and collapsing double-hyphens.
-- Agents can always refresh their slug by saving their profile via the dashboard
-- (PATCH /api/agent/profile applies the full slugifyName logic).

UPDATE agents
SET slug = CASE
  WHEN display_name IS NULL OR trim(display_name) = '' THEN
    'agent-' || substr(id, 1, 8)
  ELSE
    substr(
      replace(
        replace(
          trim(
            replace(lower(display_name), ' ', '-'),
            '-'
          ),
          '--', '-'
        ),
        '--', '-'
      ),
      1, 80
    )
  END
WHERE slug IS NULL;
