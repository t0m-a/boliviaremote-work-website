-- Cloudflare D1 / SQLite Schema for Bolivia Remote Work (v6.0.0)
-- 100% Air-Gapped Storage for boliviaremote.work (ADR-06 Zero-PII & ADR-08 Separation)

CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_hash TEXT UNIQUE NOT NULL,
  platform_id TEXT,
  platform_name TEXT,
  category TEXT,
  track TEXT,
  contract_caveat TEXT DEFAULT 'fractional_or_fulltime',
  title TEXT NOT NULL,
  company TEXT,
  company_slug TEXT DEFAULT '',
  canonical_role_key TEXT DEFAULT '',
  location TEXT,
  url TEXT,
  description TEXT,
  tags TEXT,
  lang_mask TEXT DEFAULT 'en',
  categories_csv TEXT DEFAULT '',
  experience_tier TEXT DEFAULT 'mid',
  contracts_csv TEXT DEFAULT '',
  published_at TEXT,
  published_epoch INTEGER DEFAULT 0,
  discovered_at TEXT NOT NULL,
  first_seen_epoch INTEGER DEFAULT 0,
  last_seen_epoch INTEGER DEFAULT 0,
  sighting_count INTEGER DEFAULT 1,
  repost_span_days INTEGER DEFAULT 0,
  ghost_risk TEXT DEFAULT 'none',
  bolivia_eligible INTEGER DEFAULT 1,
  compensation_usd TEXT DEFAULT '',
  ai_summary_es TEXT DEFAULT '',
  ai_summary_en TEXT DEFAULT '',
  ai_verified INTEGER DEFAULT 0,
  embedding_id TEXT DEFAULT '',
  status TEXT DEFAULT 'ACTIVE'
);

CREATE INDEX IF NOT EXISTS idx_opportunities_eligible_date
  ON opportunities(status, bolivia_eligible, published_epoch DESC, discovered_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunities_platform
  ON opportunities(platform_id);

CREATE INDEX IF NOT EXISTS idx_opportunities_company_slug
  ON opportunities(company_slug);

CREATE INDEX IF NOT EXISTS idx_opportunities_canonical_role
  ON opportunities(canonical_role_key);

CREATE INDEX IF NOT EXISTS idx_opportunities_ghost_risk
  ON opportunities(ghost_risk, status);

-- Synchronized FTS5 Virtual Table (accent-insensitive Spanish/English BM25)
CREATE VIRTUAL TABLE IF NOT EXISTS opportunities_fts USING fts5(
  job_hash UNINDEXED,
  title,
  company,
  tags,
  ai_summary_es,
  ai_summary_en,
  description,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS trg_opportunities_fts_insert
AFTER INSERT ON opportunities
WHEN NEW.status = 'ACTIVE' AND NEW.bolivia_eligible = 1
BEGIN
  DELETE FROM opportunities_fts WHERE job_hash = NEW.job_hash;
  INSERT INTO opportunities_fts(job_hash, title, company, tags, ai_summary_es, ai_summary_en, description)
  VALUES (
    NEW.job_hash,
    COALESCE(NEW.title, ''),
    COALESCE(NEW.company, ''),
    COALESCE(NEW.tags, ''),
    COALESCE(NEW.ai_summary_es, ''),
    COALESCE(NEW.ai_summary_en, ''),
    COALESCE(NEW.description, '')
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_opportunities_fts_update
AFTER UPDATE ON opportunities
BEGIN
  DELETE FROM opportunities_fts WHERE job_hash = OLD.job_hash;
  DELETE FROM opportunities_fts WHERE job_hash = NEW.job_hash;
  INSERT INTO opportunities_fts(job_hash, title, company, tags, ai_summary_es, ai_summary_en, description)
  SELECT
    NEW.job_hash,
    COALESCE(NEW.title, ''),
    COALESCE(NEW.company, ''),
    COALESCE(NEW.tags, ''),
    COALESCE(NEW.ai_summary_es, ''),
    COALESCE(NEW.ai_summary_en, ''),
    COALESCE(NEW.description, '')
  WHERE NEW.status = 'ACTIVE' AND NEW.bolivia_eligible = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_opportunities_fts_delete
AFTER DELETE ON opportunities
BEGIN
  DELETE FROM opportunities_fts WHERE job_hash = OLD.job_hash;
END;

-- Cross-Board Repost & Ghost-Job Sightings Ledger
CREATE TABLE IF NOT EXISTS job_sightings (
  canonical_role_key TEXT PRIMARY KEY,
  company_slug TEXT DEFAULT '',
  title TEXT NOT NULL,
  company TEXT DEFAULT '',
  first_seen_epoch INTEGER NOT NULL,
  last_seen_epoch INTEGER NOT NULL,
  scan_hits INTEGER DEFAULT 1,
  distinct_job_hashes_json TEXT DEFAULT '[]',
  distinct_urls_json TEXT DEFAULT '[]',
  platforms_json TEXT DEFAULT '[]',
  repost_span_days INTEGER DEFAULT 0,
  ghost_risk TEXT DEFAULT 'none',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_sightings_company
  ON job_sightings(company_slug);

CREATE INDEX IF NOT EXISTS idx_job_sightings_ghost
  ON job_sightings(ghost_risk, last_seen_epoch DESC);

-- Sanitized Custom Platforms Registry
CREATE TABLE IF NOT EXISTS custom_platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  track TEXT,
  type TEXT DEFAULT 'auto',
  enabled INTEGER DEFAULT 1,
  domain TEXT,
  url TEXT NOT NULL,
  rss_url TEXT DEFAULT '',
  search_query TEXT,
  contract_caveat TEXT DEFAULT 'fractional_or_fulltime',
  bolivia_avenue TEXT DEFAULT '',
  notes TEXT,
  created_at TEXT,
  added_at TEXT
);

-- Lightweight D1 Fallback Mirror for Self-Hosted Environments Without Durable Objects
CREATE TABLE IF NOT EXISTS career_brain_fallback (
  doc_id TEXT PRIMARY KEY,
  doc_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_career_brain_fallback_type
  ON career_brain_fallback(doc_type);

-- Optional Evaluations Cache Table
CREATE TABLE IF NOT EXISTS evaluations (
  job_hash TEXT PRIMARY KEY,
  total_score INTEGER NOT NULL,
  verdict TEXT NOT NULL,
  role_score INTEGER DEFAULT 0,
  remote_score INTEGER DEFAULT 0,
  contract_score INTEGER DEFAULT 0,
  language_score INTEGER DEFAULT 0,
  matched_skills TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  evaluated_at TEXT NOT NULL
);
