-- db/migrations/0005_video_jobs.sql
-- video_jobs table: tracks async AI video generation requests (Phase 6)
-- Applied via: wrangler d1 migrations apply DB --local (dev) / --remote (prod)
--
-- Status enum:
--   queued      — job inserted, provider submission not yet attempted
--   processing  — job submitted to provider; awaiting callback or poll
--   ready       — video_url written to listings; terminal success
--   failed      — all provider attempts exhausted; terminal failure
--
-- Idempotency: task_id UNIQUE prevents duplicate callback writes.
-- Dedup: findActiveJob queries status IN ('queued','processing') LIMIT 1.

CREATE TABLE IF NOT EXISTS video_jobs (
  id         TEXT    NOT NULL PRIMARY KEY,
  listing_id TEXT    NOT NULL REFERENCES listings(id),
  agent_id   TEXT    NOT NULL REFERENCES agents(id),
  provider   TEXT    NOT NULL,
  task_id    TEXT    UNIQUE,
  status     TEXT    NOT NULL DEFAULT 'processing',
  attempts   INTEGER NOT NULL DEFAULT 1,
  error      TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_listing_id ON video_jobs(listing_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_task_id    ON video_jobs(task_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status     ON video_jobs(status);
