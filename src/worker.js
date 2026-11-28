/**
 * Cloudflare Worker Entrypoint — Bolivia 100% Remote Job Scout & Evaluator (v6.1.0)
 * 100% Air-Gapped Cognitive Upgrade inside scout-analyst-pipeline (ADR-06 Zero-PII & ADR-08 Separation):
 *   - Spanish (Bolivia) first UI + customizable user filters & Employer Reality badges
 *   - Dedicated D1 (`bolivia-remote-jobs-db`) with FTS5 BM25 & `job_sightings` Ghost-Job tracking
 *   - Hybrid Search v2 (3-Channel Weighted RRF + `@cf/baai/bge-reranker-base`)
 *   - Isolated `BoliviaCareerBrainDO` SQLite Durable Object (`<bolivia_context>` compiler)
 *   - Fail-closed `/mcp` Streamable HTTP server with Career Brain & discovery admin tools
 *   - Scheduled Cron Trigger every 15 minutes + autonomous direct ATS source discovery
 */

import { INITIAL_PLATFORMS, INITIAL_OPPORTUNITIES } from './seed_data.js';
import {
  DEFAULT_FILTERS,
  evaluateAllOpportunities,
  generateResultsMarkdown,
  checkBoliviaRemoteEligibility,
  detectOfferAttributes
} from './evaluator.js';
import {
  runIngestionScan,
  stripHtml,
  computeJobHash,
  normalizeJobKey
} from './scanner.js';
import { renderAppHtml } from './ui.js';
import {
  FAVICON_SVG,
  FAVICON_ICO_BYTES,
  FAVICON_96_PNG_BYTES,
  APPLE_TOUCH_ICON_BYTES
} from './favicon.js';
import {
  buildDeterministicSummaries,
  enrichOpportunityWithAI,
  enrichBatchWithAI,
  analyzePositionForBolivia
} from './ai_enricher.js';
import {
  indexOpportunitiesInVectorStore,
  deduplicateSemantically
} from './vector_store.js';
import { hybridSearchOpportunities } from './hybrid_search.js';
import { handleMcpRequest, verifyMcpAuth } from './mcp.js';
import {
  BoliviaCareerBrainDO,
  getCareerBrainClient
} from './career_brain_do.js';
import {
  computeMarketPulseMetrics,
  buildDeterministicPulseNarrative,
  extractEmployerGeoSnapshots,
  runNightlySleepCycle
} from './nightly_sleep.js';
import {
  sanitizePlatformUrl,
  normalizeCompanySlug,
  parseDateToEpochSeconds,
  computeGhostJobMetrics
} from './privacy_guard.js';
import {
  runAutonomousDiscoveryCycle,
  applyPromotedSourceHealth
} from './ats_discovery.js';

export { BoliviaCareerBrainDO };

const CACHE_KEY_URL = 'https://bolivia-remote-scout.internal/state-v6.1';
const EDGE_CACHE_ORIGIN = 'https://boliviaremote.work';
const SSR_INITIAL_LIMIT = 300;
const MAX_CATALOG_LIMIT = 2000;
const SSR_DESCRIPTION_LIMIT = 450;
const EDGE_CACHE_PURGE_PATHS = [
  '/',
  '/pulso',
  '/guia-legal-fiscal',
  '/api/state',
  '/api/pulse',
  `/api/opportunities?offset=${SSR_INITIAL_LIMIT}&limit=${MAX_CATALOG_LIMIT}`
];
const EMOJI_STRIP_RE = /[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF]/g;
const STALE_THRESHOLD_SECONDS = 30 * 86400; // 30 days unseen -> STALE
const LAST_SEEN_BUMP_INTERVAL_SECONDS = 6 * 3600; // Bump D1 last_seen_epoch at most every 6h to cut FTS5 rewrites
const MEMORY_STATE_TTL_MS = 5 * 60 * 1000; // Refresh warm isolate D1 snapshot every 5 min

const LEAN_OPPORTUNITY_COLUMNS_SQL = `
  job_hash, title, company, company_slug, canonical_role_key,
  platform_id, platform_name, category, track, url,
  location, contract_caveat, tags, description,
  lang_mask, categories_csv, experience_tier, contracts_csv,
  published_at, published_epoch, discovered_at,
  first_seen_epoch, last_seen_epoch, sighting_count, repost_span_days, ghost_risk,
  bolivia_eligible, compensation_usd, ai_summary_es, ai_summary_en, ai_verified, status
`;

let MEMORY_STATE = null;
let LEAN_HOME_CACHE = null;
const MEMORY_SIGHTINGS = new Map();
const D1_SCHEMA_VERIFIED = new WeakSet();

function parseOpportunitiesPageParams(url) {
  const rawOffset = Number(url.searchParams.get('offset') || 0);
  const rawLimit = Number(url.searchParams.get('limit') || 500);
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.min(Math.floor(rawOffset), MAX_CATALOG_LIMIT) : 0;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_CATALOG_LIMIT) : 500;
  return { offset, limit };
}

function compactOpportunityForApi(opp) {
  if (!opp || typeof opp !== 'object') return opp;
  const bol = (opp._pre_bol && typeof opp._pre_bol.score === 'number')
    ? opp._pre_bol
    : checkBoliviaRemoteEligibility(opp);
  const attrs = (opp._pre_attrs && Array.isArray(opp._pre_attrs.categories))
    ? opp._pre_attrs
    : detectOfferAttributes(opp);
  const rawDesc = String(opp.description || '');
  let description = rawDesc;
  if (rawDesc.length > SSR_DESCRIPTION_LIMIT) {
    const cut = rawDesc.slice(0, SSR_DESCRIPTION_LIMIT);
    const lastSpace = cut.lastIndexOf(' ');
    description = (lastSpace > 260 ? cut.slice(0, lastSpace) : cut).trim() + '...';
  }
  const { embedding_id, ...rest } = opp;
  return {
    ...rest,
    description,
    _pre_bol: {
      eligible: Boolean(bol.eligible),
      score: Number(bol.score || 0),
      badge_es: bol.badge_es || '',
      badge_en: bol.badge_en || '',
      reason_es: bol.reason_es || '',
      reason_en: bol.reason_en || ''
    },
    _pre_attrs: {
      categories: Array.isArray(attrs.categories) ? attrs.categories : [],
      experience: attrs.experience || 'mid',
      contracts: Array.isArray(attrs.contracts) ? attrs.contracts : [],
      languages: Array.isArray(attrs.languages) ? attrs.languages : ['en'],
      primaryLanguage: attrs.primaryLanguage || 'en',
      matchedKeywords: Array.isArray(attrs.matchedKeywords) ? attrs.matchedKeywords : []
    }
  };
}

function canonicalEdgeCachePath(path, url = null) {
  if (path === '/' || path === '/index.html') return '/';
  if (path === '/pulso' || path === '/pulso/') return '/pulso';
  if (path === '/guia-legal-fiscal' || path === '/guia-legal-fiscal/' || path === '/legal-fiscal' || path === '/legal-fiscal/') {
    return '/guia-legal-fiscal';
  }
  if (path === '/api/state') return '/api/state';
  if (path === '/api/pulse') return '/api/pulse';
  if (path === '/api/opportunities' && url) {
    const { offset, limit } = parseOpportunitiesPageParams(url);
    return `/api/opportunities?offset=${offset}&limit=${limit}`;
  }
  return null;
}

function isKnownRoute(method, path) {
  if (path === '/mcp' || path === '/api/mcp' || path === '/.well-known/mcp.json') return true;
  if (method === 'GET' && path === '/admin/pitr-bookmark') return true;
  if (method === 'POST' && (path === '/admin/pitr-restore' || path === '/admin/restore-batch')) return true;
  if (method === 'GET') {
    return (
      path === '/' ||
      path === '/index.html' ||
      path === '/guia-legal-fiscal' ||
      path === '/guia-legal-fiscal/' ||
      path === '/legal-fiscal' ||
      path === '/legal-fiscal/' ||
      path === '/pulso' ||
      path === '/pulso/' ||
      path === '/favicon.ico' ||
      path === '/favicon.svg' ||
      path === '/favicon.png' ||
      path === '/favicon-96x96.png' ||
      path === '/apple-touch-icon.png' ||
      path === '/sitemap.xml' ||
      path === '/robots.txt' ||
      path === '/api/state' ||
      path === '/api/opportunities' ||
      path === '/api/pulse' ||
      path === '/api/results.md' ||
      path === '/results.md' ||
      path === '/api/search/semantic'
    );
  }
  if (method === 'POST') {
    return (
      path === '/api/evaluate' ||
      path === '/api/ai/analyze-position' ||
      path === '/api/ai/enrich' ||
      path === '/api/search/semantic' ||
      path === '/api/vectors/index'
    );
  }
  return false;
}

async function matchEdgeCache(request, url, canonicalPath) {
  if (!canonicalPath || typeof caches === 'undefined' || !caches.default) return null;
  if (url.searchParams.get('nocache') === '1' || url.searchParams.get('refresh') === '1') return null;
  try {
    const cacheKey = new Request(`${EDGE_CACHE_ORIGIN}${canonicalPath}`, { method: 'GET' });
    const cached = await caches.default.match(cacheKey);
    if (!cached) return null;
    const headers = new Headers(cached.headers);
    headers.set('X-Edge-Cache', 'HIT');
    return new Response(cached.body, { status: cached.status, headers });
  } catch {
    return null;
  }
}

function putEdgeCache(canonicalPath, response, ctx) {
  if (!canonicalPath || typeof caches === 'undefined' || !caches.default) return;
  try {
    const cacheKey = new Request(`${EDGE_CACHE_ORIGIN}${canonicalPath}`, { method: 'GET' });
    const toStore = response.clone();
    const putPromise = caches.default.put(cacheKey, toStore).catch(() => {});
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(putPromise);
    }
  } catch {
    // Ignore optional edge cache write error
  }
}

async function purgeEdgeCache(ctx) {
  if (typeof caches === 'undefined' || !caches.default) return;
  const purgeWork = Promise.all(
    EDGE_CACHE_PURGE_PATHS.map(p =>
      caches.default.delete(new Request(`${EDGE_CACHE_ORIGIN}${p}`, { method: 'GET' })).catch(() => {})
    )
  ).catch(() => {});
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(purgeWork);
  } else {
    await purgeWork;
  }
}

function cleanOpportunityFields(o) {
  let title = stripHtml(o.title || '').replace(EMOJI_STRIP_RE, '').trim();
  let company = stripHtml(o.company || o.platform_name || '').replace(EMOJI_STRIP_RE, '').trim();
  if (/\s+at\s+([A-Z0-9][A-Za-z0-9\s.&'-]{1,38})$/.test(title) && (company === o.platform_name || company.includes('Feed'))) {
    const m = title.match(/^(.*?)\s+at\s+([A-Z0-9][A-Za-z0-9\s.&'-]{1,38})$/);
    if (m && m[1].length >= 4) {
      title = m[1].trim();
      company = m[2].trim();
    }
  }
  company = company.replace(/\s+(?:RSS Feed|Remote Jobs Feed|Curated Remote Feed|Feed|API)$/i, '').trim() || company;
  const description = stripHtml(o.description || '').replace(EMOJI_STRIP_RE, '').trim();
  const url = sanitizePlatformUrl(o.url || '');
  let published_at = String(o.published_at || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(published_at)) {
    const d = new Date(published_at);
    published_at = !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : String(o.discovered_at || new Date().toISOString()).slice(0, 10);
  }
  const job_hash = computeJobHash(title, company, url);
  const nowSec = Math.floor(Date.now() / 1000);
  const publishedEpoch = Number(o.published_epoch) || parseDateToEpochSeconds(published_at, nowSec);
  const discoveredAt = o.discovered_at || new Date().toISOString();
  const firstSeenEpoch = Number(o.first_seen_epoch) || parseDateToEpochSeconds(discoveredAt, publishedEpoch);
  const lastSeenEpoch = Number(o.last_seen_epoch) > 0
    ? Math.max(firstSeenEpoch, Number(o.last_seen_epoch))
    : firstSeenEpoch;

  const cleaned = {
    ...o,
    job_hash,
    title,
    company,
    company_slug: o.company_slug || normalizeCompanySlug(company, 'company'),
    canonical_role_key: o.canonical_role_key || normalizeJobKey(title, company),
    description,
    url,
    published_at,
    published_epoch: publishedEpoch,
    discovered_at: discoveredAt,
    first_seen_epoch: firstSeenEpoch,
    last_seen_epoch: lastSeenEpoch,
    sighting_count: Math.max(1, Number(o.sighting_count) || 1),
    repost_span_days: Math.max(0, Number(o.repost_span_days) || 0),
    ghost_risk: o.ghost_risk || 'none',
    status: o.status || 'ACTIVE'
  };

  const attrs = detectOfferAttributes(cleaned);
  const langs = attrs.languages || ['en'];
  const langMask = langs.includes('es') && langs.includes('en')
    ? 'es_en'
    : (langs.includes('es') ? 'es' : 'en');
  const det = buildDeterministicSummaries(cleaned);

  return {
    ...cleaned,
    lang_mask: cleaned.lang_mask || langMask,
    categories_csv: cleaned.categories_csv || (attrs.categories || []).join(','),
    experience_tier: cleaned.experience_tier || attrs.experience || 'mid',
    contracts_csv: cleaned.contracts_csv || (attrs.contracts || []).join(','),
    compensation_usd: cleaned.compensation_usd || det.compensation_usd,
    ai_summary_es: cleaned.ai_summary_es || det.ai_summary_es,
    ai_summary_en: cleaned.ai_summary_en || det.ai_summary_en,
    ai_verified: Number(cleaned.ai_verified || 0)
  };
}

async function ensureD1Tables(db) {
  if (!db || typeof db.prepare !== 'function') return;
  if (D1_SCHEMA_VERIFIED.has(db)) return;

  // Single fast metadata read skips all 34 sequential DDL/ALTER roundtrips on migrated production D1
  try {
    const checkStmt = db.prepare(
      `SELECT COUNT(*) AS cnt FROM sqlite_master
       WHERE type IN ('table', 'trigger')
         AND name IN (
           'opportunities', 'job_sightings', 'custom_platforms',
           'discovered_sources', 'career_brain_fallback',
           'opportunities_fts', 'trg_opportunities_fts_update'
         )`
    );
    if (checkStmt && typeof checkStmt.all === 'function') {
      const checkRes = await checkStmt.all();
      const cnt = Number(checkRes && Array.isArray(checkRes.results) && checkRes.results[0] && checkRes.results[0].cnt) || 0;
      if (cnt >= 7) {
        D1_SCHEMA_VERIFIED.add(db);
        return;
      }
    }
  } catch {
    // Fall through to idempotent schema bootstrap on fresh DB or minimal test mock
  }

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS opportunities (
      job_hash TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      company TEXT,
      company_slug TEXT DEFAULT '',
      canonical_role_key TEXT DEFAULT '',
      platform_id TEXT,
      platform_name TEXT,
      category TEXT DEFAULT '',
      track TEXT,
      url TEXT,
      location TEXT,
      contract_caveat TEXT,
      tags TEXT,
      description TEXT,
      lang_mask TEXT DEFAULT 'en',
      categories_csv TEXT DEFAULT '',
      experience_tier TEXT DEFAULT 'mid',
      contracts_csv TEXT DEFAULT '',
      published_at TEXT,
      published_epoch INTEGER DEFAULT 0,
      discovered_at TEXT,
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
      status TEXT DEFAULT 'ACTIVE'
    )
  `).run();

  // Best-effort idempotent upgrades if migrating an existing v5.8 opportunities table
  const alterCols = [
    "ALTER TABLE opportunities ADD COLUMN company_slug TEXT DEFAULT ''",
    "ALTER TABLE opportunities ADD COLUMN canonical_role_key TEXT DEFAULT ''",
    "ALTER TABLE opportunities ADD COLUMN lang_mask TEXT DEFAULT 'en'",
    "ALTER TABLE opportunities ADD COLUMN categories_csv TEXT DEFAULT ''",
    "ALTER TABLE opportunities ADD COLUMN experience_tier TEXT DEFAULT 'mid'",
    "ALTER TABLE opportunities ADD COLUMN contracts_csv TEXT DEFAULT ''",
    'ALTER TABLE opportunities ADD COLUMN published_epoch INTEGER DEFAULT 0',
    'ALTER TABLE opportunities ADD COLUMN first_seen_epoch INTEGER DEFAULT 0',
    'ALTER TABLE opportunities ADD COLUMN last_seen_epoch INTEGER DEFAULT 0',
    'ALTER TABLE opportunities ADD COLUMN sighting_count INTEGER DEFAULT 1',
    'ALTER TABLE opportunities ADD COLUMN repost_span_days INTEGER DEFAULT 0',
    "ALTER TABLE opportunities ADD COLUMN ghost_risk TEXT DEFAULT 'none'",
    "ALTER TABLE opportunities ADD COLUMN status TEXT DEFAULT 'ACTIVE'"
  ];
  for (const sql of alterCols) {
    try {
      await db.prepare(sql).run();
    } catch {
      // Column already exists
    }
  }

  await db.prepare(`
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
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS custom_platforms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      track TEXT DEFAULT 'Custom',
      type TEXT DEFAULT 'auto',
      enabled INTEGER DEFAULT 1,
      domain TEXT DEFAULT '',
      url TEXT NOT NULL,
      feed_url TEXT DEFAULT '',
      rss_url TEXT DEFAULT '',
      ats_provider TEXT DEFAULT '',
      ats_slug TEXT DEFAULT '',
      discovered_by TEXT DEFAULT 'user',
      active_bolivia_jobs INTEGER DEFAULT 0,
      spanish_jobs INTEGER DEFAULT 0,
      consecutive_zero_yield INTEGER DEFAULT 0,
      last_yield_at TEXT DEFAULT '',
      contract_caveat TEXT DEFAULT 'fractional_or_fulltime',
      bolivia_avenue TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT
    )
  `).run();

  const customPlatAlterCols = [
    "ALTER TABLE custom_platforms ADD COLUMN category TEXT DEFAULT ''",
    "ALTER TABLE custom_platforms ADD COLUMN type TEXT DEFAULT 'auto'",
    'ALTER TABLE custom_platforms ADD COLUMN enabled INTEGER DEFAULT 1',
    "ALTER TABLE custom_platforms ADD COLUMN domain TEXT DEFAULT ''",
    "ALTER TABLE custom_platforms ADD COLUMN feed_url TEXT DEFAULT ''",
    "ALTER TABLE custom_platforms ADD COLUMN ats_provider TEXT DEFAULT ''",
    "ALTER TABLE custom_platforms ADD COLUMN ats_slug TEXT DEFAULT ''",
    "ALTER TABLE custom_platforms ADD COLUMN discovered_by TEXT DEFAULT 'user'",
    'ALTER TABLE custom_platforms ADD COLUMN active_bolivia_jobs INTEGER DEFAULT 0',
    'ALTER TABLE custom_platforms ADD COLUMN spanish_jobs INTEGER DEFAULT 0',
    'ALTER TABLE custom_platforms ADD COLUMN consecutive_zero_yield INTEGER DEFAULT 0',
    "ALTER TABLE custom_platforms ADD COLUMN last_yield_at TEXT DEFAULT ''"
  ];
  for (const sql of customPlatAlterCols) {
    try {
      await db.prepare(sql).run();
    } catch {
      // Column already exists
    }
  }

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS discovered_sources (
      candidate_id TEXT PRIMARY KEY,
      company_slug TEXT NOT NULL,
      company_name TEXT NOT NULL,
      domain TEXT DEFAULT '',
      ats_provider TEXT NOT NULL,
      ats_slug TEXT NOT NULL,
      board_url TEXT NOT NULL,
      api_url TEXT NOT NULL,
      discovered_from TEXT DEFAULT '',
      status TEXT DEFAULT 'CANDIDATE',
      total_jobs INTEGER DEFAULT 0,
      bolivia_eligible_jobs INTEGER DEFAULT 0,
      spanish_jobs INTEGER DEFAULT 0,
      bolivia_yield_ratio REAL DEFAULT 0,
      categories_csv TEXT DEFAULT '',
      category_diversity INTEGER DEFAULT 0,
      yield_score REAL DEFAULT 0,
      ai_decision TEXT DEFAULT '',
      ai_confidence REAL DEFAULT 0,
      ai_rationale TEXT DEFAULT '',
      sample_titles_json TEXT DEFAULT '[]',
      consecutive_zero_yield INTEGER DEFAULT 0,
      last_probed_epoch INTEGER DEFAULT 0,
      cooldown_until_epoch INTEGER DEFAULT 0,
      promoted_at TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS career_brain_fallback (
      doc_id TEXT PRIMARY KEY,
      doc_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  // Synchronized FTS5 virtual table + triggers (ignored silently if mock SQLite lacks FTS5)
  try {
    await db.prepare(`
      CREATE VIRTUAL TABLE IF NOT EXISTS opportunities_fts USING fts5(
        job_hash UNINDEXED,
        title,
        company,
        tags,
        ai_summary_es,
        ai_summary_en,
        description,
        tokenize = 'unicode61 remove_diacritics 2'
      )
    `).run();
    await db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_opportunities_fts_insert
      AFTER INSERT ON opportunities
      WHEN NEW.status = 'ACTIVE' AND NEW.bolivia_eligible = 1
      BEGIN
        DELETE FROM opportunities_fts WHERE job_hash = NEW.job_hash;
        INSERT INTO opportunities_fts(job_hash, title, company, tags, ai_summary_es, ai_summary_en, description)
        VALUES (NEW.job_hash, COALESCE(NEW.title, ''), COALESCE(NEW.company, ''), COALESCE(NEW.tags, ''), COALESCE(NEW.ai_summary_es, ''), COALESCE(NEW.ai_summary_en, ''), COALESCE(NEW.description, ''));
      END
    `).run();
    await db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_opportunities_fts_update
      AFTER UPDATE ON opportunities
      BEGIN
        DELETE FROM opportunities_fts WHERE job_hash = OLD.job_hash;
        DELETE FROM opportunities_fts WHERE job_hash = NEW.job_hash;
        INSERT INTO opportunities_fts(job_hash, title, company, tags, ai_summary_es, ai_summary_en, description)
        SELECT NEW.job_hash, COALESCE(NEW.title, ''), COALESCE(NEW.company, ''), COALESCE(NEW.tags, ''), COALESCE(NEW.ai_summary_es, ''), COALESCE(NEW.ai_summary_en, ''), COALESCE(NEW.description, '')
        WHERE NEW.status = 'ACTIVE' AND NEW.bolivia_eligible = 1;
      END
    `).run();
    await db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_opportunities_fts_delete
      AFTER DELETE ON opportunities
      BEGIN
        DELETE FROM opportunities_fts WHERE job_hash = OLD.job_hash;
      END
    `).run();
  } catch {
    // Ignore FTS5 creation errors on minimal test mocks
  }
  D1_SCHEMA_VERIFIED.add(db);
}

/**
 * Records cross-board sightings for newly scanned opportunities and updates ghost-job telemetry.
 */
export async function recordJobSightings(items, env, nowEpochSec = Math.floor(Date.now() / 1000)) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const nowIso = new Date(nowEpochSec * 1000).toISOString();
  const updated = [];

  for (const rawItem of items) {
    if (!rawItem || !rawItem.title) continue;
    const item = cleanOpportunityFields(rawItem);
    const key = item.canonical_role_key || normalizeJobKey(item.title, item.company);

    let existing = MEMORY_SIGHTINGS.get(key) || null;
    if (!existing && env && env.DB && typeof env.DB.prepare === 'function') {
      try {
        const bound = env.DB.prepare('SELECT * FROM job_sightings WHERE canonical_role_key = ? LIMIT 1').bind(key);
        if (bound && typeof bound.all === 'function') {
          const res = await bound.all();
          if (res && Array.isArray(res.results) && res.results.length > 0) {
            existing = res.results[0];
          }
        }
      } catch {
        // ignore read error
      }
    }

    const hashes = new Set();
    const urls = new Set();
    const platforms = new Set();
    if (existing) {
      try { JSON.parse(existing.distinct_job_hashes_json || '[]').forEach(x => hashes.add(x)); } catch {}
      try { JSON.parse(existing.distinct_urls_json || '[]').forEach(x => urls.add(x)); } catch {}
      try { JSON.parse(existing.platforms_json || '[]').forEach(x => platforms.add(x)); } catch {}
    }
    if (item.job_hash) hashes.add(item.job_hash);
    if (item.url) urls.add(item.url);
    if (item.platform_name) platforms.add(item.platform_name);

    const firstSeen = existing ? Math.min(Number(existing.first_seen_epoch) || nowEpochSec, nowEpochSec) : Math.min(item.first_seen_epoch || nowEpochSec, nowEpochSec);
    const lastSeen = Math.max(firstSeen, nowEpochSec);
    const scanHits = (existing ? Number(existing.scan_hits || 1) : 0) + 1;

    const record = {
      canonical_role_key: key,
      company_slug: item.company_slug,
      title: item.title,
      company: item.company,
      first_seen_epoch: firstSeen,
      last_seen_epoch: lastSeen,
      scan_hits: scanHits,
      distinct_job_hashes_json: JSON.stringify(Array.from(hashes).slice(-25)),
      distinct_urls_json: JSON.stringify(Array.from(urls).slice(-25)),
      platforms_json: JSON.stringify(Array.from(platforms).slice(-15)),
      updated_at: nowIso
    };
    const metrics = computeGhostJobMetrics(record, nowEpochSec);
    record.repost_span_days = metrics.repost_span_days;
    record.ghost_risk = metrics.ghost_risk;

    MEMORY_SIGHTINGS.set(key, record);

    if (env && env.DB && typeof env.DB.prepare === 'function') {
      try {
        await env.DB.prepare(
          `INSERT OR REPLACE INTO job_sightings (
            canonical_role_key, company_slug, title, company, first_seen_epoch, last_seen_epoch,
            scan_hits, distinct_job_hashes_json, distinct_urls_json, platforms_json,
            repost_span_days, ghost_risk, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          record.canonical_role_key,
          record.company_slug,
          record.title,
          record.company,
          record.first_seen_epoch,
          record.last_seen_epoch,
          record.scan_hits,
          record.distinct_job_hashes_json,
          record.distinct_urls_json,
          record.platforms_json,
          record.repost_span_days,
          record.ghost_risk,
          record.updated_at
        ).run();
      } catch {
        // Ignore D1 sightings write error
      }
    }

    updated.push({
      ...item,
      first_seen_epoch: metrics.first_seen_epoch,
      last_seen_epoch: metrics.last_seen_epoch,
      sighting_count: metrics.sighting_count,
      repost_span_days: metrics.repost_span_days,
      ghost_risk: metrics.ghost_risk
    });
  }

  return updated;
}

/**
 * Transitions unseen listings older than 30 days to `STALE` in D1, prunes them from
 * active in-memory `state.opportunities` so `saveState()` cannot resurrect them,
 * and deletes them from Vectorize.
 */
export async function expireStaleOpportunities(env, nowEpochSec = Math.floor(Date.now() / 1000), state = null) {
  const cutoff = nowEpochSec - STALE_THRESHOLD_SECONDS;
  const staleSet = new Set();

  if (env && env.DB && typeof env.DB.prepare === 'function') {
    try {
      const selBound = env.DB.prepare(
        "SELECT job_hash FROM opportunities WHERE (status = 'ACTIVE' OR status IS NULL) AND last_seen_epoch > 0 AND last_seen_epoch < ? LIMIT 500"
      ).bind(cutoff);
      if (selBound && typeof selBound.all === 'function') {
        const res = await selBound.all();
        const rows = (res && Array.isArray(res.results)) ? res.results : [];
        for (const r of rows) {
          if (r && r.job_hash) staleSet.add(r.job_hash);
        }
      }
      if (staleSet.size > 0) {
        await env.DB.prepare(
          "UPDATE opportunities SET status = 'STALE' WHERE (status = 'ACTIVE' OR status IS NULL) AND last_seen_epoch > 0 AND last_seen_epoch < ?"
        ).bind(cutoff).run();
      }
    } catch {
      // Ignore D1 expiration query error
    }
  }

  const pruneList = (opps) => {
    if (!Array.isArray(opps)) return [];
    return opps.filter(o => {
      if (!o) return false;
      if (staleSet.has(o.job_hash)) return false;
      if (o.status === 'STALE' || o.status === 'EXPIRED' || o.status === 'DEAD_LINK') {
        if (o.job_hash) staleSet.add(o.job_hash);
        return false;
      }
      const lastSeen = Number(o.last_seen_epoch || 0);
      if (lastSeen > 0 && lastSeen < cutoff) {
        if (o.job_hash) staleSet.add(o.job_hash);
        return false;
      }
      return true;
    });
  };

  if (state && Array.isArray(state.opportunities)) {
    state.opportunities = pruneList(state.opportunities);
  }
  if (MEMORY_STATE && Array.isArray(MEMORY_STATE.opportunities) && MEMORY_STATE !== state) {
    MEMORY_STATE.opportunities = pruneList(MEMORY_STATE.opportunities);
  }

  const expiredIds = Array.from(staleSet);
  if (expiredIds.length > 0 && env && env.VECTORIZE && typeof env.VECTORIZE.deleteByIds === 'function') {
    await env.VECTORIZE.deleteByIds(expiredIds).catch(() => {});
  }

  return { expired_count: expiredIds.length, expired_ids: expiredIds };
}

/**
 * Batch-attaches compact Employer Reality badges from BoliviaCareerBrainDO to opportunities.
 */
async function attachEmployerReality(opportunities, env) {
  if (!Array.isArray(opportunities) || opportunities.length === 0) return opportunities;
  try {
    const brain = getCareerBrainClient(env);
    const realityMap = await brain.lookupEmployerRealityBatch(opportunities);
    return opportunities.map(o => {
      const r = realityMap[o.job_hash];
      if (!r || !r.matched) return o;
      return {
        ...o,
        employer_reality: {
          entity_id: r.entity_id,
          bolivia_tier: r.bolivia_tier,
          confidence: r.confidence,
          payout_rails: r.payout_rails,
          eor_options: r.eor_options,
          reality_badge_es: r.reality_badge_es,
          reality_badge_en: r.reality_badge_en,
          caution_note_es: r.caution_note_es,
          caution_note_en: r.caution_note_en,
          typical_comp: r.typical_comp,
          employer_multiplier: r.employer_multiplier
        }
      };
    });
  } catch (err) {
    console.error('[attachEmployerReality] lookup failed:', err && err.message ? err.message : err);
    return opportunities;
  }
}

function isPreCleanedOpportunity(rawOpp) {
  return Boolean(
    rawOpp &&
    rawOpp.job_hash &&
    rawOpp.title &&
    rawOpp.company_slug &&
    rawOpp.canonical_role_key &&
    rawOpp.ai_summary_es &&
    rawOpp.lang_mask &&
    Number(rawOpp.published_epoch) > 0 &&
    (rawOpp.bolivia_eligible === 1 || rawOpp.bolivia_eligible === true)
  );
}

export function normalizeAndMergeState(rawState, options = {}) {
  const existingPlatIds = new Set((rawState.platforms || []).map(p => p.id));
  const mergedPlatforms = [...(rawState.platforms || [])];
  for (const p of INITIAL_PLATFORMS) {
    if (!existingPlatIds.has(p.id)) {
      existingPlatIds.add(p.id);
      mergedPlatforms.push(p);
    }
  }

  const existingHashes = new Set();
  const keyToIndex = new Map();
  const urlToIndex = new Map();
  const mergedOpportunities = [];

  const isDirectAtsOpp = (o) => Boolean(o && (o.source_type === 'direct_ats' || String(o.platform_id || '').startsWith('ats_')));
  const usePreCleanedFastPath = Boolean(options.preCleaned);

  const rawOpps = Array.isArray(rawState && rawState.opportunities) ? rawState.opportunities : [];
  const includeSeedOpportunities =
    typeof options.includeSeedOpportunities === 'boolean'
      ? options.includeSeedOpportunities
      : rawOpps.length === 0;
  const allCandidates = includeSeedOpportunities
    ? [...rawOpps, ...INITIAL_OPPORTUNITIES]
    : [...rawOpps];

  for (const rawOpp of allCandidates) {
    if (!rawOpp) continue;
    if (rawOpp.status === 'STALE' || rawOpp.status === 'EXPIRED' || rawOpp.status === 'DEAD_LINK') continue;

    let opp;
    if (usePreCleanedFastPath && isPreCleanedOpportunity(rawOpp)) {
      opp = {
        ...rawOpp,
        published_epoch: Number(rawOpp.published_epoch) || 0,
        first_seen_epoch: Number(rawOpp.first_seen_epoch) || Number(rawOpp.published_epoch) || 0,
        last_seen_epoch: Number(rawOpp.last_seen_epoch) || Number(rawOpp.first_seen_epoch) || 0,
        sighting_count: Math.max(1, Number(rawOpp.sighting_count) || 1),
        repost_span_days: Math.max(0, Number(rawOpp.repost_span_days) || 0),
        ghost_risk: rawOpp.ghost_risk || 'none',
        ai_verified: Number(rawOpp.ai_verified || 0),
        status: rawOpp.status || 'ACTIVE'
      };
    } else {
      opp = cleanOpportunityFields(rawOpp);
      if (!opp.title) continue;
      if (!checkBoliviaRemoteEligibility(opp).eligible) continue;
    }

    const key = opp.canonical_role_key || normalizeJobKey(opp.title, opp.company);
    const normUrl = String(opp.url || '').toLowerCase().replace(/\/+$/, '');
    const isGenericUrl = /^https?:\/\/[^/]+\/?(?:jobs\/?|careers\/?|work\/?|remote\/?|apply\/?)?$/i.test(normUrl);

    if (existingHashes.has(opp.job_hash)) {
      continue;
    }

    // Direct-over-Aggregator precedence: a Direct ATS posting supersedes an aggregator duplicate for the same role
    if (keyToIndex.has(key)) {
      const existingIdx = keyToIndex.get(key);
      const existingOpp = mergedOpportunities[existingIdx];
      if (isDirectAtsOpp(opp) && !isDirectAtsOpp(existingOpp)) {
        mergedOpportunities[existingIdx] = {
          ...opp,
          first_seen_epoch: Math.min(existingOpp.first_seen_epoch || opp.first_seen_epoch, opp.first_seen_epoch),
          sighting_count: Math.max(existingOpp.sighting_count || 1, opp.sighting_count || 1)
        };
        existingHashes.add(opp.job_hash);
        if (!isGenericUrl && normUrl) urlToIndex.set(normUrl, existingIdx);
      }
      continue;
    }

    if (!isGenericUrl && normUrl && urlToIndex.has(normUrl)) {
      continue;
    }

    const newIdx = mergedOpportunities.length;
    existingHashes.add(opp.job_hash);
    keyToIndex.set(key, newIdx);
    if (!isGenericUrl && normUrl) {
      urlToIndex.set(normUrl, newIdx);
    }
    mergedOpportunities.push(opp);
  }

  return {
    opportunities: mergedOpportunities,
    platforms: mergedPlatforms,
    lastScanAt: rawState.lastScanAt || new Date().toISOString()
  };
}

async function loadState(env) {
  const hasD1 = Boolean(env && env.DB && typeof env.DB.prepare === 'function');
  if (MEMORY_STATE) {
    if (!hasD1) return MEMORY_STATE;
    const ageMs = Date.now() - Number(MEMORY_STATE._loadedAt || 0);
    if (MEMORY_STATE._d1Loaded && (!MEMORY_STATE._dbRef || MEMORY_STATE._dbRef === env.DB) && ageMs < MEMORY_STATE_TTL_MS) {
      return MEMORY_STATE;
    }
  }

  // 0. Try Cloudflare D1 SQL Database if bound (`env.DB`) — uses idx_opportunities_eligible_date
  if (hasD1) {
    try {
      await ensureD1Tables(env.DB);
      const [oppsRes, platsRes] = await Promise.all([
        env.DB.prepare(
          `SELECT * FROM opportunities
           WHERE (status = 'ACTIVE' OR status IS NULL)
             AND (bolivia_eligible = 1 OR bolivia_eligible IS NULL)
           ORDER BY published_epoch DESC, discovered_at DESC
           LIMIT 2000`
        ).all(),
        env.DB.prepare('SELECT * FROM custom_platforms ORDER BY created_at DESC LIMIT 300').all()
      ]);
      const dbOpps = Array.isArray(oppsRes && oppsRes.results) ? oppsRes.results : [];
      const dbPlats = Array.isArray(platsRes && platsRes.results) ? platsRes.results : [];
      if (dbOpps.length > 0 || dbPlats.length > 0) {
        const hasLiveOpps = dbOpps.length > 0;
        MEMORY_STATE = normalizeAndMergeState({
          opportunities: hasLiveOpps ? dbOpps : (MEMORY_STATE ? MEMORY_STATE.opportunities : []),
          platforms: [...dbPlats, ...(MEMORY_STATE ? MEMORY_STATE.platforms : [])],
          lastScanAt: new Date().toISOString()
        }, { includeSeedOpportunities: !hasLiveOpps, preCleaned: hasLiveOpps });
        MEMORY_STATE._d1Loaded = true;
        MEMORY_STATE._dbRef = env.DB;
        MEMORY_STATE._hasLiveStorage = hasLiveOpps;
        MEMORY_STATE._loadedAt = Date.now();
        return MEMORY_STATE;
      }
    } catch (err) {
      console.error('[loadState] D1 read failed, falling back:', err && err.message ? err.message : err);
    }
  }

  // 1. Try Cloudflare KV if bound
  if (env && env.STORE && typeof env.STORE.get === 'function') {
    try {
      const kvRaw = await env.STORE.get('bolivia_remote_state_v6', 'json');
      if (kvRaw && Array.isArray(kvRaw.opportunities)) {
        const hasKvOpps = kvRaw.opportunities.length > 0;
        MEMORY_STATE = normalizeAndMergeState(kvRaw, { includeSeedOpportunities: !hasKvOpps });
        MEMORY_STATE._hasLiveStorage = hasKvOpps;
        return MEMORY_STATE;
      }
    } catch {
      // Ignore KV read error
    }
  }

  // 2. Try Cloudflare Edge Cache API
  if (typeof caches !== 'undefined' && caches.default) {
    try {
      const cachedResp = await caches.default.match(CACHE_KEY_URL);
      if (cachedResp) {
        const cachedData = await cachedResp.json();
        if (cachedData && Array.isArray(cachedData.opportunities)) {
          const hasCachedOpps = cachedData.opportunities.length > 0;
          MEMORY_STATE = normalizeAndMergeState(cachedData, { includeSeedOpportunities: !hasCachedOpps });
          MEMORY_STATE._hasLiveStorage = hasCachedOpps;
          return MEMORY_STATE;
        }
      }
    } catch {
      // Ignore Cache read error
    }
  }

  // 3. Initialize from bundled seed data (only when storage is empty or unbound)
  MEMORY_STATE = normalizeAndMergeState({
    opportunities: [...INITIAL_OPPORTUNITIES],
    platforms: [...INITIAL_PLATFORMS],
    lastScanAt: new Date().toISOString()
  }, { includeSeedOpportunities: false });
  if (env && env.DB) {
    MEMORY_STATE._d1Loaded = true;
    MEMORY_STATE._loadedAt = Date.now();
  }
  MEMORY_STATE._hasLiveStorage = false;

  return MEMORY_STATE;
}

async function loadLeanHomeState(env, limit = SSR_INITIAL_LIMIT) {
  const hasD1 = Boolean(env && env.DB && typeof env.DB.prepare === 'function');
  const now = Date.now();

  if (MEMORY_STATE) {
    const sameDb = !hasD1 || !MEMORY_STATE._dbRef || MEMORY_STATE._dbRef === env.DB;
    if ((!hasD1 || (MEMORY_STATE._d1Loaded && sameDb && now - Number(MEMORY_STATE._loadedAt || 0) < MEMORY_STATE_TTL_MS))) {
      return {
        opportunities: MEMORY_STATE.opportunities.slice(0, limit),
        totalCatalogCount: Math.min(MEMORY_STATE.opportunities.length, MAX_CATALOG_LIMIT),
        platforms: MEMORY_STATE.platforms,
        lastScanAt: MEMORY_STATE.lastScanAt
      };
    }
  }

  if (hasD1 && LEAN_HOME_CACHE && LEAN_HOME_CACHE._dbRef === env.DB && LEAN_HOME_CACHE._limit === limit && now - Number(LEAN_HOME_CACHE._loadedAt || 0) < MEMORY_STATE_TTL_MS) {
    return LEAN_HOME_CACHE;
  }

  if (hasD1) {
    try {
      await ensureD1Tables(env.DB);
      const [oppsRes, countRes, platsRes] = await Promise.all([
        env.DB.prepare(
          `SELECT ${LEAN_OPPORTUNITY_COLUMNS_SQL}
           FROM opportunities
           WHERE (status = 'ACTIVE' OR status IS NULL)
             AND (bolivia_eligible = 1 OR bolivia_eligible IS NULL)
           ORDER BY published_epoch DESC, discovered_at DESC
           LIMIT ?`
        ).bind(limit).all(),
        env.DB.prepare(
          `SELECT COUNT(*) AS cnt
           FROM opportunities
           WHERE (status = 'ACTIVE' OR status IS NULL)
             AND (bolivia_eligible = 1 OR bolivia_eligible IS NULL)`
        ).all(),
        env.DB.prepare('SELECT * FROM custom_platforms ORDER BY created_at DESC LIMIT 300').all()
      ]);

      const dbOpps = Array.isArray(oppsRes && oppsRes.results) ? oppsRes.results : [];
      const dbPlats = Array.isArray(platsRes && platsRes.results) ? platsRes.results : [];
      const dbTotal = Number(countRes && Array.isArray(countRes.results) && countRes.results[0] && countRes.results[0].cnt) || dbOpps.length;

      if (dbOpps.length > 0 || dbPlats.length > 0) {
        const hasLiveOpps = dbOpps.length > 0;
        const normalized = normalizeAndMergeState(
          {
            opportunities: hasLiveOpps ? dbOpps : [],
            platforms: dbPlats,
            lastScanAt: new Date().toISOString()
          },
          { includeSeedOpportunities: !hasLiveOpps, preCleaned: hasLiveOpps }
        );
        const totalCatalogCount = Math.min(Math.max(normalized.opportunities.length, dbTotal), MAX_CATALOG_LIMIT);
        LEAN_HOME_CACHE = {
          ...normalized,
          totalCatalogCount,
          _dbRef: env.DB,
          _limit: limit,
          _loadedAt: Date.now()
        };
        return LEAN_HOME_CACHE;
      }
    } catch (err) {
      console.error('[loadLeanHomeState] D1 lean read failed, falling back to full loadState:', err && err.message ? err.message : err);
    }
  }

  const full = await loadState(env);
  return {
    opportunities: full.opportunities.slice(0, limit),
    totalCatalogCount: Math.min(full.opportunities.length, MAX_CATALOG_LIMIT),
    platforms: full.platforms,
    lastScanAt: full.lastScanAt
  };
}

async function loadOpportunitiesPage(env, offset = 0, limit = 500) {
  const hasD1 = Boolean(env && env.DB && typeof env.DB.prepare === 'function');
  const now = Date.now();

  if (MEMORY_STATE) {
    const sameDb = !hasD1 || !MEMORY_STATE._dbRef || MEMORY_STATE._dbRef === env.DB;
    if (!hasD1 || (MEMORY_STATE._d1Loaded && sameDb && now - Number(MEMORY_STATE._loadedAt || 0) < MEMORY_STATE_TTL_MS)) {
      const totalActive = Math.min(MEMORY_STATE.opportunities.length, MAX_CATALOG_LIMIT);
      const slice = MEMORY_STATE.opportunities.slice(offset, offset + limit);
      return {
        opportunities: slice,
        totalActive,
        lastScanAt: MEMORY_STATE.lastScanAt
      };
    }
  }

  if (hasD1) {
    try {
      await ensureD1Tables(env.DB);
      const effectiveLimit = Math.max(0, Math.min(limit, MAX_CATALOG_LIMIT - offset));
      const [oppsRes, countRes] = await Promise.all([
        effectiveLimit > 0
          ? env.DB.prepare(
              `SELECT ${LEAN_OPPORTUNITY_COLUMNS_SQL}
               FROM opportunities
               WHERE (status = 'ACTIVE' OR status IS NULL)
                 AND (bolivia_eligible = 1 OR bolivia_eligible IS NULL)
               ORDER BY published_epoch DESC, discovered_at DESC
               LIMIT ? OFFSET ?`
            ).bind(effectiveLimit, offset).all()
          : Promise.resolve({ results: [] }),
        env.DB.prepare(
          `SELECT COUNT(*) AS cnt
           FROM opportunities
           WHERE (status = 'ACTIVE' OR status IS NULL)
             AND (bolivia_eligible = 1 OR bolivia_eligible IS NULL)`
        ).all()
      ]);

      const dbOpps = Array.isArray(oppsRes && oppsRes.results) ? oppsRes.results : [];
      const dbTotal = Number(countRes && Array.isArray(countRes.results) && countRes.results[0] && countRes.results[0].cnt) || 0;
      if (dbOpps.length > 0 || dbTotal > 0) {
        const normalized = normalizeAndMergeState(
          { opportunities: dbOpps, platforms: [], lastScanAt: new Date().toISOString() },
          { includeSeedOpportunities: false, preCleaned: true }
        );
        return {
          opportunities: normalized.opportunities,
          totalActive: Math.min(dbTotal, MAX_CATALOG_LIMIT),
          lastScanAt: normalized.lastScanAt
        };
      }
    } catch (err) {
      console.error('[loadOpportunitiesPage] D1 page read failed, falling back:', err && err.message ? err.message : err);
    }
  }

  const full = await loadState(env);
  const totalActive = Math.min(full.opportunities.length, MAX_CATALOG_LIMIT);
  return {
    opportunities: full.opportunities.slice(offset, offset + limit),
    totalActive,
    lastScanAt: full.lastScanAt
  };
}

export async function saveState(state, env, options = {}) {
  LEAN_HOME_CACHE = null;
  const hadLiveStorage = Boolean(
    state._hasLiveStorage ||
    (MEMORY_STATE && MEMORY_STATE._hasLiveStorage) ||
    (env && env.DB)
  );
  MEMORY_STATE = normalizeAndMergeState(state, {
    includeSeedOpportunities: false,
    preCleaned: Boolean(state._d1Loaded)
  });
  MEMORY_STATE._hasLiveStorage = hadLiveStorage;
  if (state._d1Loaded || (env && env.DB)) {
    MEMORY_STATE._d1Loaded = true;
    if (env && env.DB) MEMORY_STATE._dbRef = env.DB;
    MEMORY_STATE._loadedAt = Date.now();
  }
  state.opportunities = MEMORY_STATE.opportunities;
  state.platforms = MEMORY_STATE.platforms;

  // Save to Cloudflare D1 if bound (`env.DB`) — supports delta-only upserts via options.changedOpportunities
  if (env && env.DB && typeof env.DB.prepare === 'function') {
    try {
      await ensureD1Tables(env.DB);
      let oppsToSave;
      if (Array.isArray(options.changedOpportunities)) {
        const normalizedByHash = new Map(MEMORY_STATE.opportunities.map(o => [o.job_hash, o]));
        const seenDelta = new Set();
        oppsToSave = [];
        for (const raw of options.changedOpportunities) {
          if (!raw) continue;
          const norm = (raw.job_hash && normalizedByHash.get(raw.job_hash)) || cleanOpportunityFields(raw);
          if (!norm || !norm.job_hash || seenDelta.has(norm.job_hash)) continue;
          if (norm.status === 'STALE' || norm.status === 'EXPIRED' || norm.status === 'DEAD_LINK') continue;
          seenDelta.add(norm.job_hash);
          oppsToSave.push(norm);
        }
      } else {
        oppsToSave = MEMORY_STATE.opportunities
          .filter(o => o && o.status !== 'STALE' && o.status !== 'EXPIRED' && o.status !== 'DEAD_LINK')
          .slice(0, 1000);
      }
      const oppInsertSql =
        `INSERT INTO opportunities (
          job_hash, title, company, company_slug, canonical_role_key,
          platform_id, platform_name, category, track, url,
          location, contract_caveat, tags, description,
          lang_mask, categories_csv, experience_tier, contracts_csv,
          published_at, published_epoch, discovered_at,
          first_seen_epoch, last_seen_epoch, sighting_count, repost_span_days, ghost_risk,
          bolivia_eligible, compensation_usd, ai_summary_es, ai_summary_en, ai_verified, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(job_hash) DO UPDATE SET
          title = excluded.title,
          company = excluded.company,
          company_slug = excluded.company_slug,
          canonical_role_key = excluded.canonical_role_key,
          platform_id = excluded.platform_id,
          platform_name = excluded.platform_name,
          category = excluded.category,
          track = excluded.track,
          url = excluded.url,
          location = excluded.location,
          contract_caveat = excluded.contract_caveat,
          tags = excluded.tags,
          description = excluded.description,
          lang_mask = excluded.lang_mask,
          categories_csv = excluded.categories_csv,
          experience_tier = excluded.experience_tier,
          contracts_csv = excluded.contracts_csv,
          published_at = excluded.published_at,
          published_epoch = excluded.published_epoch,
          discovered_at = excluded.discovered_at,
          first_seen_epoch = CASE
            WHEN opportunities.first_seen_epoch > 0 AND excluded.first_seen_epoch > 0
            THEN MIN(opportunities.first_seen_epoch, excluded.first_seen_epoch)
            ELSE MAX(opportunities.first_seen_epoch, excluded.first_seen_epoch)
          END,
          last_seen_epoch = MAX(opportunities.last_seen_epoch, excluded.last_seen_epoch),
          sighting_count = MAX(opportunities.sighting_count, excluded.sighting_count),
          repost_span_days = MAX(opportunities.repost_span_days, excluded.repost_span_days),
          ghost_risk = excluded.ghost_risk,
          bolivia_eligible = excluded.bolivia_eligible,
          compensation_usd = CASE WHEN excluded.compensation_usd != '' THEN excluded.compensation_usd ELSE opportunities.compensation_usd END,
          ai_summary_es = CASE WHEN excluded.ai_summary_es != '' THEN excluded.ai_summary_es ELSE opportunities.ai_summary_es END,
          ai_summary_en = CASE WHEN excluded.ai_summary_en != '' THEN excluded.ai_summary_en ELSE opportunities.ai_summary_en END,
          ai_verified = MAX(opportunities.ai_verified, excluded.ai_verified),
          status = CASE
            WHEN opportunities.status IN ('STALE', 'EXPIRED', 'DEAD_LINK')
              AND excluded.last_seen_epoch <= opportunities.last_seen_epoch
            THEN opportunities.status
            ELSE excluded.status
          END`;

      const bindOpp = (o) => {
        const bol = checkBoliviaRemoteEligibility(o);
        return env.DB.prepare(oppInsertSql).bind(
          o.job_hash,
          o.title,
          o.company,
          o.company_slug || '',
          o.canonical_role_key || '',
          o.platform_id || 'custom',
          o.platform_name || o.company,
          o.category || '',
          o.track || 'Custom',
          o.url,
          o.location || 'Remote',
          o.contract_caveat || 'fractional_or_fulltime',
          o.tags || '',
          o.description || '',
          o.lang_mask || 'en',
          o.categories_csv || '',
          o.experience_tier || 'mid',
          o.contracts_csv || '',
          o.published_at || '',
          Number(o.published_epoch || 0),
          o.discovered_at || new Date().toISOString(),
          Number(o.first_seen_epoch || 0),
          Number(o.last_seen_epoch || 0),
          Number(o.sighting_count || 1),
          Number(o.repost_span_days || 0),
          o.ghost_risk || 'none',
          bol.eligible ? 1 : 0,
          o.compensation_usd || '',
          o.ai_summary_es || '',
          o.ai_summary_en || '',
          Number(o.ai_verified || 0),
          o.status || 'ACTIVE'
        );
      };

      if (oppsToSave.length > 0) {
        if (typeof env.DB.batch === 'function') {
          for (let i = 0; i < oppsToSave.length; i += 80) {
            const chunk = oppsToSave.slice(i, i + 80).map(bindOpp);
            await env.DB.batch(chunk);
          }
        } else {
          for (const o of oppsToSave) {
            await bindOpp(o).run();
          }
        }
      }

      if (!options.skipPlatformsSync) {
        const seedIds = new Set(INITIAL_PLATFORMS.map(p => p.id));
        for (const p of MEMORY_STATE.platforms) {
          if (p && p.id && (!seedIds.has(p.id) || String(p.id).startsWith('custom_') || String(p.id).startsWith('ats_'))) {
            await env.DB.prepare(
              `INSERT OR REPLACE INTO custom_platforms (
                id, name, category, track, type, enabled, domain, url, feed_url, rss_url,
                ats_provider, ats_slug, discovered_by, active_bolivia_jobs, spanish_jobs,
                consecutive_zero_yield, last_yield_at, contract_caveat, bolivia_avenue, notes, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              p.id,
              p.name || p.id,
              p.category || '',
              p.track || 'Custom',
              p.type || 'auto',
              p.enabled === false ? 0 : 1,
              p.domain || '',
              sanitizePlatformUrl(p.url || ''),
              sanitizePlatformUrl(p.feed_url || ''),
              sanitizePlatformUrl(p.rss_url || ''),
              p.ats_provider || '',
              p.ats_slug || '',
              p.discovered_by || (String(p.id).startsWith('ats_') ? 'ai_autonomous' : 'user'),
              Number(p.active_bolivia_jobs || 0),
              Number(p.spanish_jobs || 0),
              Number(p.consecutive_zero_yield || 0),
              p.last_yield_at || '',
              p.contract_caveat || 'fractional_or_fulltime',
              p.bolivia_avenue || '',
              p.notes || '',
              p.added_at || new Date().toISOString()
            ).run();
          }
        }
      }
      MEMORY_STATE._d1Loaded = true;
      MEMORY_STATE._loadedAt = Date.now();
    } catch (err) {
      console.error('[saveState] D1 write failed:', err && err.message ? err.message : err);
    }
  }

  // Save to KV if bound
  if (env && env.STORE && typeof env.STORE.put === 'function') {
    try {
      await env.STORE.put('bolivia_remote_state_v6', JSON.stringify(MEMORY_STATE));
    } catch {
      // Ignore KV write error
    }
  }

  // Save to Cloudflare Edge Cache API
  if (typeof caches !== 'undefined' && caches.default) {
    try {
      const resp = new Response(JSON.stringify(MEMORY_STATE), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400'
        }
      });
      await caches.default.put(CACHE_KEY_URL, resp);
    } catch {
      // Ignore Cache write error
    }
  }
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-MCP-API-Key, Mcp-Session-Id',
      ...extraHeaders
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return jsonResponse({ ok: true });
    }

    // 0. Zero-DB static routes & immediate 404 rejection BEFORE touching D1 or Durable Objects
    if (
      request.method === 'GET' &&
      (path === '/favicon.ico' ||
        path === '/favicon.svg' ||
        path === '/favicon.png' ||
        path === '/favicon-96x96.png' ||
        path === '/apple-touch-icon.png')
    ) {
      if (path === '/favicon.svg') {
        return new Response(FAVICON_SVG, {
          status: 200,
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=86400'
          }
        });
      }
      if (path === '/favicon.ico') {
        return new Response(FAVICON_ICO_BYTES, {
          status: 200,
          headers: {
            'Content-Type': 'image/x-icon',
            'Cache-Control': 'public, max-age=86400'
          }
        });
      }
      const pngBytes = path === '/apple-touch-icon.png' ? APPLE_TOUCH_ICON_BYTES : FAVICON_96_PNG_BYTES;
      return new Response(pngBytes, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400'
        }
      });
    }

    if (request.method === 'GET' && path === '/robots.txt') {
      const robotsTxt = `User-agent: *
Allow: /
Disallow: /mcp
Disallow: /api/mcp
Disallow: /.well-known/mcp.json

Sitemap: https://boliviaremote.work/sitemap.xml
`;
      return new Response(robotsTxt, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=86400'
        }
      });
    }

    if (!isKnownRoute(request.method, path)) {
      return jsonResponse({ error: 'Not Found' }, 404);
    }

    // 0b. Authenticated Durable Object Disaster Recovery & PITR Routes (Fail-Closed, Zero-D1 Load)
    if (
      (request.method === 'GET' && path === '/admin/pitr-bookmark') ||
      (request.method === 'POST' && (path === '/admin/pitr-restore' || path === '/admin/restore-batch'))
    ) {
      // Force fail-closed MCP_API_KEY verification regardless of MCP_PUBLIC_ACCESS
      const strictEnv = env ? { ...env, MCP_PUBLIC_ACCESS: 'false' } : { MCP_PUBLIC_ACCESS: 'false' };
      const auth = verifyMcpAuth(request, strictEnv, url);
      if (!auth.ok) {
        return jsonResponse({ ok: false, error: 'Unauthorized: Valid MCP_API_KEY required.' }, 401);
      }

      const brain = getCareerBrainClient(env);
      try {
        if (request.method === 'GET' && path === '/admin/pitr-bookmark') {
          const atParam = url.searchParams.get('at');
          const atMs = atParam ? Number(atParam) : null;
          const res = await brain.getPitrBookmark(Number.isFinite(atMs) ? atMs : null);
          return jsonResponse(res, 200);
        }
        const body = await request.json().catch(() => ({}));
        if (path === '/admin/pitr-restore') {
          const res = await brain.restorePitrBookmark(body || {});
          return jsonResponse(res, res.ok ? 200 : 400);
        }
        if (path === '/admin/restore-batch') {
          const res = await brain.restoreTableBatch(body || {});
          return jsonResponse(res, res.ok ? 200 : 400);
        }
      } catch (err) {
        return jsonResponse({ ok: false, error: err && err.message ? err.message : 'Admin DR action failed' }, 500);
      }
    }

    // 0b. Edge Cache lookup for public read routes BEFORE loading D1/DO state
    const cachePath = request.method === 'GET' ? canonicalEdgeCachePath(path, url) : null;
    if (cachePath) {
      const cachedResp = await matchEdgeCache(request, url, cachePath);
      if (cachedResp) {
        return cachedResp;
      }
    }

    // 1a. Dedicated Spanish Legal & Tax Guide Page (static SSR; zero D1/DO queries, client hydrates catalog on demand)
    if (request.method === 'GET' && (path === '/guia-legal-fiscal' || path === '/guia-legal-fiscal/' || path === '/legal-fiscal' || path === '/legal-fiscal/')) {
      const html = renderAppHtml(
        {
          opportunities: [],
          platforms: INITIAL_PLATFORMS,
          lastScanAt: (MEMORY_STATE && MEMORY_STATE.lastScanAt) || new Date().toISOString(),
          marketPulse: null
        },
        { initialView: 'legal-tax' }
      );
      const resp = new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400',
          'X-Edge-Cache': 'MISS'
        }
      });
      putEdgeCache('/guia-legal-fiscal', resp, ctx);
      return resp;
    }

    // Helper: resolve latest nightly Market Pulse from BoliviaCareerBrainDO (or compute deterministic fallback)
    const resolveMarketPulse = async (fallbackState) => {
      try {
        const brain = getCareerBrainClient(env);
        const stored = await brain.getLatestMarketPulse();
        if (stored && stored.pulse_date) return stored;
      } catch (err) {
        console.error('[resolveMarketPulse] failed, falling back:', err && err.message ? err.message : err);
      }
      const src = fallbackState || { opportunities: [], platforms: INITIAL_PLATFORMS };
      const metrics = computeMarketPulseMetrics(src.opportunities, src.platforms);
      return { ...metrics, ...buildDeterministicPulseNarrative(metrics) };
    };

    // 1. Main Web Interface (Lean SSR: newest 300 listings + projected D1 columns; client paginates 60/page & hydrates remainder in background)
    if (request.method === 'GET' && (path === '/' || path === '/index.html')) {
      const leanState = await loadLeanHomeState(env, SSR_INITIAL_LIMIT);
      const [enrichedOpps, marketPulse] = await Promise.all([
        attachEmployerReality(leanState.opportunities, env),
        resolveMarketPulse(leanState)
      ]);
      const html = renderAppHtml({
        ...leanState,
        opportunities: enrichedOpps,
        totalCatalogCount: leanState.totalCatalogCount,
        marketPulse
      });
      const resp = new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
          'X-Edge-Cache': 'MISS'
        }
      });
      putEdgeCache('/', resp, ctx);
      return resp;
    }

    // 2a. Edge-Cached Paginated Opportunities API (backs background catalog hydration & "Cargar más")
    if (request.method === 'GET' && path === '/api/opportunities') {
      const { offset, limit } = parseOpportunitiesPageParams(url);
      const page = await loadOpportunitiesPage(env, offset, limit);
      const enrichedSlice = await attachEmployerReality(page.opportunities, env);
      const compactSlice = enrichedSlice.map(compactOpportunityForApi);
      const resp = jsonResponse(
        {
          ok: true,
          offset,
          limit,
          total_active: page.totalActive,
          has_more: offset + compactSlice.length < page.totalActive,
          count: compactSlice.length,
          lastScanAt: page.lastScanAt,
          opportunities: compactSlice
        },
        200,
        {
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
          'X-Edge-Cache': 'MISS'
        }
      );
      putEdgeCache(cachePath, resp, ctx);
      return resp;
    }

    const state = await loadState(env);

    // 1a2. Dedicated Market Pulse Page ("Pulso del Mercado Remoto desde Bolivia")
    if (request.method === 'GET' && (path === '/pulso' || path === '/pulso/')) {
      const [enrichedOpps, marketPulse] = await Promise.all([
        attachEmployerReality(state.opportunities.slice(0, SSR_INITIAL_LIMIT), env),
        resolveMarketPulse(state)
      ]);
      const html = renderAppHtml(
        {
          ...state,
          opportunities: enrichedOpps,
          totalCatalogCount: Math.min(state.opportunities.length, MAX_CATALOG_LIMIT),
          marketPulse
        },
        { initialView: 'pulse' }
      );
      const resp = new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
          'X-Edge-Cache': 'MISS'
        }
      });
      putEdgeCache('/pulso', resp, ctx);
      return resp;
    }

    // 1c. SEO Sitemap XML Endpoint
    if (request.method === 'GET' && path === '/sitemap.xml') {
      const lastModDate = String(state.lastScanAt || new Date().toISOString()).slice(0, 10);
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://boliviaremote.work/</loc>
    <xhtml:link rel="alternate" hreflang="es-BO" href="https://boliviaremote.work/" />
    <xhtml:link rel="alternate" hreflang="es" href="https://boliviaremote.work/" />
    <xhtml:link rel="alternate" hreflang="en" href="https://boliviaremote.work/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://boliviaremote.work/" />
    <lastmod>${lastModDate}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://boliviaremote.work/guia-legal-fiscal</loc>
    <xhtml:link rel="alternate" hreflang="es-BO" href="https://boliviaremote.work/guia-legal-fiscal" />
    <xhtml:link rel="alternate" hreflang="es" href="https://boliviaremote.work/guia-legal-fiscal" />
    <lastmod>${lastModDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://boliviaremote.work/pulso</loc>
    <xhtml:link rel="alternate" hreflang="es-BO" href="https://boliviaremote.work/pulso" />
    <xhtml:link rel="alternate" hreflang="es" href="https://boliviaremote.work/pulso" />
    <lastmod>${lastModDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://boliviaremote.work/api/results.md?lang=es</loc>
    <lastmod>${lastModDate}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://boliviaremote.work/api/results.md?lang=en</loc>
    <lastmod>${lastModDate}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;
      return new Response(sitemapXml, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // 2. Get Current State API
    if (request.method === 'GET' && path === '/api/state') {
      const [enrichedOpps, marketPulse] = await Promise.all([
        attachEmployerReality(state.opportunities, env),
        resolveMarketPulse(state)
      ]);
      const activePlatforms = state.platforms.filter(p => p && p.enabled !== false);
      const resp = jsonResponse(
        {
          version: '6.2.0',
          schedule: '*/15 * * * *',
          nightly_sleep_schedule: '0 7 * * *',
          ai_enabled: Boolean(env && env.AI),
          d1_enabled: Boolean(env && env.DB),
          vectorize_enabled: Boolean(env && env.VECTORIZE),
          intel_vectorize_enabled: Boolean(env && env.INTEL_VECTORIZE),
          career_brain_enabled: Boolean(env && env.CAREER_BRAIN),
          autonomous_discovery_enabled: true,
          direct_ats_platforms_count: activePlatforms.filter(p => p.type === 'ats_json').length,
          qdrant_enabled: Boolean(env && env.QDRANT_URL),
          mcp_endpoint: '/mcp',
          mcp_auth_enabled: !(env && String(env.MCP_PUBLIC_ACCESS).toLowerCase() === 'true'),
          lastScanAt: state.lastScanAt,
          platforms_count: activePlatforms.length,
          opportunities_count: enrichedOpps.length,
          market_pulse: marketPulse,
          platforms: activePlatforms,
          opportunities: enrichedOpps
        },
        200,
        {
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
          'X-Edge-Cache': 'MISS'
        }
      );
      putEdgeCache('/api/state', resp, ctx);
      return resp;
    }

    // 2b. Read-Only Market Pulse API ("Pulso del Mercado Remoto desde Bolivia")
    if (request.method === 'GET' && path === '/api/pulse') {
      const marketPulse = await resolveMarketPulse(state);
      const resp = jsonResponse(
        {
          ok: true,
          version: '6.2.0',
          schedule: '0 7 * * *',
          pulse: marketPulse
        },
        200,
        {
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
          'X-Edge-Cache': 'MISS'
        }
      );
      putEdgeCache('/api/pulse', resp, ctx);
      return resp;
    }

    // 3. On-the-Fly Results Markdown Endpoint
    if (request.method === 'GET' && (path === '/api/results.md' || path === '/results.md')) {
      const lang = url.searchParams.get('lang') || 'es';
      const customKeywords = url.searchParams.get('keywords') || '';
      const languages = url.searchParams.get('languages')
        ? url.searchParams.get('languages').split(',')
        : DEFAULT_FILTERS.languages;
      const positionTypes = url.searchParams.get('positions')
        ? url.searchParams.get('positions').split(',')
        : [];
      const contractTypes = url.searchParams.get('contracts')
        ? url.searchParams.get('contracts').split(',')
        : DEFAULT_FILTERS.contract_types;
      const experienceLevels = url.searchParams.get('experience')
        ? url.searchParams.get('experience').split(',')
        : ['all'];

      const filters = {
        ...DEFAULT_FILTERS,
        ui_lang: lang,
        languages,
        position_types: positionTypes,
        custom_keywords: customKeywords,
        contract_types: contractTypes,
        experience_levels: experienceLevels
      };

      const evalResult = evaluateAllOpportunities(state.opportunities, filters);
      const md = generateResultsMarkdown(
        evalResult,
        filters,
        lang,
        state.platforms.length,
        state.lastScanAt
      );

      return new Response(md, {
        status: 200,
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
      });
    }

    // 4. Dynamic On-the-Fly Evaluation API
    if (request.method === 'POST' && path === '/api/evaluate') {
      const body = await request.json().catch(() => ({}));
      const filters = { ...DEFAULT_FILTERS, ...(body.filters || body) };
      const evalResult = evaluateAllOpportunities(state.opportunities, filters);
      const markdown = generateResultsMarkdown(
        evalResult,
        filters,
        filters.ui_lang || 'es',
        state.platforms.length,
        state.lastScanAt
      );
      return jsonResponse({
        ok: true,
        counts: {
          surfaced: evalResult.surfaced.length,
          apply: evalResult.apply.length,
          possible: evalResult.possible.length,
          skip: evalResult.skip.length,
          geo_excluded: evalResult.geo_excluded.length
        },
        results: evalResult.surfaced,
        markdown
      });
    }

    // 5. Grounded Context-Compiled Position Insights ("Más información con IA" v2)
    // Note: Public manual scan/URL-addition endpoints (/api/scan, /api/platforms/scan-url, /api/platforms/sync)
    // are intentionally omitted; ingestion runs solely via the 15-minute Cron Trigger and authenticated /mcp.
    if (request.method === 'POST' && path === '/api/ai/analyze-position') {
      try {
        const body = await request.json().catch(() => ({}));
        const res = await analyzePositionForBolivia(body, state.opportunities, env);
        return jsonResponse(res);
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message || 'AI position analysis failed' }, 400);
      }
    }

    // 9. Cloudflare Workers AI — On-Demand Opportunity Enrichment API
    if (request.method === 'POST' && path === '/api/ai/enrich') {
      try {
        const body = await request.json().catch(() => ({}));
        const targetHash = String(body.job_hash || '').trim();
        let enrichedCount = 0;
        const updatedItems = [];

        if (targetHash) {
          const idx = state.opportunities.findIndex(o => o.job_hash === targetHash);
          if (idx < 0) {
            return jsonResponse({ ok: false, error: 'Opportunity not found' }, 404);
          }
          state.opportunities[idx] = await enrichOpportunityWithAI(state.opportunities[idx], env);
          updatedItems.push(state.opportunities[idx]);
          enrichedCount = 1;
        } else {
          const limit = Math.min(Math.max(Number(body.max_items) || 5, 1), 15);
          for (let i = 0; i < Math.min(limit, state.opportunities.length); i++) {
            state.opportunities[i] = await enrichOpportunityWithAI(state.opportunities[i], env);
            updatedItems.push(state.opportunities[i]);
            enrichedCount++;
          }
        }

        await saveState(state, env, { changedOpportunities: updatedItems, skipPlatformsSync: true });
        await purgeEdgeCache(ctx);
        return jsonResponse({
          ok: true,
          ai_enabled: Boolean(env && env.AI),
          enriched_count: enrichedCount,
          opportunities: updatedItems
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message || 'AI enrichment failed' }, 500);
      }
    }

    // 10. Hybrid Search v2 — 3-Channel Weighted RRF + Cross-Encoder Reranker (Zero-PII)
    if ((request.method === 'GET' || request.method === 'POST') && path === '/api/search/semantic') {
      try {
        let query = url.searchParams.get('q') || url.searchParams.get('query') || '';
        let filters = { ...DEFAULT_FILTERS };
        let topK = Number(url.searchParams.get('limit') || url.searchParams.get('topK') || 25);

        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          query = body.query || body.q || query;
          if (body.filters) {
            filters = { ...DEFAULT_FILTERS, ...body.filters };
          }
          if (body.topK || body.limit) {
            topK = Number(body.topK || body.limit);
          }
        }

        const semRes = await hybridSearchOpportunities(query, state.opportunities, filters, env, { topK });
        return jsonResponse(semRes);
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message || 'Semantic search failed' }, 400);
      }
    }

    // 11. Vectorial Database — Index Opportunities & Semantic Deduplication API
    if (request.method === 'POST' && path === '/api/vectors/index') {
      try {
        const body = await request.json().catch(() => ({}));
        const maxItems = Math.min(Math.max(Number(body.max_items) || 25, 1), 150);
        let dedupRemoved = 0;

        if (body.deduplicate === true) {
          const dedupRes = deduplicateSemantically(state.opportunities, Number(body.threshold) || 0.92);
          state.opportunities = dedupRes.opportunities;
          dedupRemoved = dedupRes.duplicates_removed;
        }

        const idxRes = await indexOpportunitiesInVectorStore(state.opportunities, env, maxItems);
        await saveState(state, env, { changedOpportunities: [], skipPlatformsSync: true });
        await purgeEdgeCache(ctx);

        return jsonResponse({
          ok: true,
          indexed_count: idxRes.indexed_count,
          embedding_dimensions: idxRes.embedding_dimensions,
          mutation_id: idxRes.mutation_id || null,
          vectorize_error: idxRes.vectorize_error || null,
          backends: idxRes.backends,
          duplicates_removed: dedupRemoved,
          total_opportunities: state.opportunities.length
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message || 'Vector indexing failed' }, 500);
      }
    }

    // 12. Isolated Fail-Closed MCP Server (`/mcp`, `/api/mcp`, `/.well-known/mcp.json`)
    if (path === '/mcp' || path === '/api/mcp' || path === '/.well-known/mcp.json') {
      return handleMcpRequest(request, state, env, ctx, async () => {
        await saveState(state, env);
        await purgeEdgeCache(ctx);
      });
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  },

  /**
   * Cloudflare Cron Trigger Handler:
   *   - Every 15 minutes: Ingestion scan, self-healing ATS checks, autonomous ATS discovery & geo-observation logging
   *   - 07:00 UTC (03:00 AM America/La_Paz): Nightly Sleep Cycle (Market Pulse Synthesis + 30d/60d Policy Watchdog)
   */
  async scheduled(event, env, ctx) {
    const task = (async () => {
      const state = await loadState(env);

      // Nightly Sleep Cycle at 03:00 AM America/La_Paz (07:00 UTC)
      if (event && event.cron === '0 7 * * *') {
        await expireStaleOpportunities(env, Math.floor(Date.now() / 1000), state);
        await runNightlySleepCycle(state, env);
        await saveState(state, env, { changedOpportunities: [], skipPlatformsSync: true });
        await purgeEdgeCache(ctx);
        return;
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const existingHashes = new Set(state.opportunities.map(o => o.job_hash));
      const scanRes = await runIngestionScan(state.platforms, existingHashes, {
        maxFeeds: 8,
        maxDorkClusters: 2
      });

      // Refresh last_seen_epoch on still-active listings re-observed in this live scan (throttled to 6h intervals to avoid FTS5 write amplification)
      const touchedOpps = [];
      if (Array.isArray(scanRes.raw_scanned_items) && scanRes.raw_scanned_items.length > 0) {
        const seenHashes = new Set(scanRes.raw_scanned_items.map(i => i && i.job_hash).filter(Boolean));
        const seenUrls = new Set(scanRes.raw_scanned_items.map(i => i && i.url ? String(i.url).toLowerCase().replace(/\/+$/, '') : '').filter(Boolean));
        for (const opp of state.opportunities) {
          if (!opp) continue;
          const normUrl = opp.url ? String(opp.url).toLowerCase().replace(/\/+$/, '') : '';
          if (seenHashes.has(opp.job_hash) || (normUrl && seenUrls.has(normUrl))) {
            const prevLastSeen = Number(opp.last_seen_epoch || 0);
            if (nowSec - prevLastSeen >= LAST_SEEN_BUMP_INTERVAL_SECONDS) {
              opp.last_seen_epoch = Math.max(prevLastSeen, nowSec);
              touchedOpps.push(opp);
            }
          }
        }
      }

      // Self-healing health check for previously promoted direct ATS boards
      await applyPromotedSourceHealth(state, scanRes.platform_yields || [], env);

      // Record per-employer geo-eligibility snapshots into BoliviaCareerBrainDO for 30d/60d Watchdog
      const geoSnapshots = extractEmployerGeoSnapshots(
        scanRes.raw_scanned_items || [],
        scanRes.platform_yields || []
      );
      if (geoSnapshots.length > 0) {
        const brain = getCareerBrainClient(env);
        if (typeof brain.recordEmployerGeoObservations === 'function') {
          await brain.recordEmployerGeoObservations(geoSnapshots).catch(err => {
            console.error('[scheduled] recordEmployerGeoObservations failed:', err && err.message ? err.message : err);
          });
        }
      }

      // AI-managed background Autonomous Source Discovery & Promotion (2-3 allowlisted ATS probes per cycle)
      const discoveryRes = await runAutonomousDiscoveryCycle(state, env, {
        maxProbes: 3,
        rawScannedItems: scanRes.raw_scanned_items || []
      }).catch(err => {
        console.error('[scheduled] runAutonomousDiscoveryCycle failed:', err && err.message ? err.message : err);
        return { discovered_opportunities: [] };
      });

      const combinedNew = [
        ...(discoveryRes.discovered_opportunities || []),
        ...(scanRes.new_opportunities || [])
      ];

      let newlyPersisted = [];
      if (combinedNew.length > 0) {
        const enrichedNew = await enrichBatchWithAI(combinedNew, env, 5);
        const withSightings = await recordJobSightings(enrichedNew, env);
        await indexOpportunitiesInVectorStore(withSightings, env, 25);
        newlyPersisted = withSightings;
        state.opportunities = [...withSightings, ...state.opportunities];
      }
      await expireStaleOpportunities(env, nowSec, state);
      state.lastScanAt = scanRes.timestamp;
      await saveState(state, env, {
        changedOpportunities: [...newlyPersisted, ...touchedOpps]
      });
      await purgeEdgeCache(ctx);
    })();

    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(task);
    } else {
      await task;
    }
  }
};
