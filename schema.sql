-- Saved scans, one row per scan. Run once on the D1 database bound as DB.
CREATE TABLE IF NOT EXISTS scans (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,   -- who ran the scan (from the Cloudflare Access login)
  domain     TEXT NOT NULL,
  created_at TEXT NOT NULL,   -- ISO date
  summary    TEXT NOT NULL,   -- small JSON for the history list
  result     TEXT NOT NULL    -- full report JSON, without screenshots
);
CREATE INDEX IF NOT EXISTS scans_by_user ON scans (email, created_at DESC);
