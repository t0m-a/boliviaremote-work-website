/**
 * Cloudflare Worker Entrypoint — Bolivia 100% Remote Job Scout & Evaluator (v6.0.0)
 * 100% Air-Gapped Cognitive Upgrade inside scout-analyst-pipeline (ADR-06 Zero-PII & ADR-08 Separation):
 *   - Spanish (Bolivia) first UI + customizable user filters & Employer Reality badges
 *   - Dedicated D1 (`bolivia-remote-jobs-db`) with FTS5 BM25 & `job_sightings` Ghost-Job tracking
 *   - Hybrid Search v2 (3-Channel Weighted RRF + `@cf/baai/bge-reranker-base`)
 *   - Isolated `BoliviaCareerBrainDO` SQLite Durable Object (`<bolivia_context>` compiler)
 *   - Fail-closed `/mcp` Streamable HTTP server with 3 Career Brain admin tools
 *   - On-demand execution + Scheduled Cron Trigger every 15 minutes
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
  scanCustomPlatformUrl,
  runIngestionScan,
  stripHtml,
  computeJobHash,
  normalizeJobKey
} from './scanner.js';
import { renderAppHtml } from './ui.js';
import { FAVICON_SVG } from './favicon.js';
import { buildSeedExportPayload, persistCustomPlatformsToDisk } from './seed_sync.js';
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
import { handleMcpRequest } from './mcp.js';
import {
  BoliviaCareerBrainDO,
  getCareerBrainClient
} from './career_brain_do.js';
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
const EMOJI_STRIP_RE = /[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF]/g;
const STALE_THRESHOLD_SECONDS = 30 * 86400; // 30 days unseen -> STALE

let MEMORY_STATE = null;
const MEMORY_SIGHTINGS = new Map();

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
  const lastSeenEpoch = Math.max(firstSeenEpoch, Number(o.last_seen_epoch) || nowSec);

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
 * Transitions unseen listings older than 30 days to `STALE` in D1 and deletes them from Vectorize.
 */
async function expireStaleOpportunities(env, nowEpochSec = Math.floor(Date.now() / 1000)) {
  if (!env || !env.DB || typeof env.DB.prepare !== 'function') return { expired_count: 0 };
  const cutoff = nowEpochSec - STALE_THRESHOLD_SECONDS;
  try {
    let staleIds = [];
    const selBound = env.DB.prepare(
      "SELECT job_hash FROM opportunities WHERE status = 'ACTIVE' AND last_seen_epoch > 0 AND last_seen_epoch < ? LIMIT 200"
    ).bind(cutoff);
    if (selBound && typeof selBound.all === 'function') {
      const res = await selBound.all();
      staleIds = (res && Array.isArray(res.results)) ? res.results.map(r => r.job_hash).filter(Boolean) : [];
    }
    if (staleIds.length > 0) {
      await env.DB.prepare(
        "UPDATE opportunities SET status = 'STALE' WHERE status = 'ACTIVE' AND last_seen_epoch > 0 AND last_seen_epoch < ?"
      ).bind(cutoff).run();

      if (env.VECTORIZE && typeof env.VECTORIZE.deleteByIds === 'function') {
        await env.VECTORIZE.deleteByIds(staleIds).catch(() => {});
      }
    }
    return { expired_count: staleIds.length };
  } catch {
    return { expired_count: 0 };
  }
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
  } catch {
    return opportunities;
  }
}

function normalizeAndMergeState(rawState) {
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

  const allCandidates = [...(rawState.opportunities || []), ...INITIAL_OPPORTUNITIES];
  for (const rawOpp of allCandidates) {
    if (!rawOpp) continue;
    if (rawOpp.status === 'STALE' || rawOpp.status === 'EXPIRED') continue;
    const opp = cleanOpportunityFields(rawOpp);
    if (!opp.title) continue;
    if (!checkBoliviaRemoteEligibility(opp).eligible) continue;
    const key = normalizeJobKey(opp.title, opp.company);
    const normUrl = opp.url.toLowerCase().replace(/\/+$/, '');
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
  if (MEMORY_STATE && !(env && env.DB && !MEMORY_STATE._d1Loaded)) {
    return MEMORY_STATE;
  }

  // 0. Try Cloudflare D1 SQL Database if bound (`env.DB`) — lifted cap up to 2,000 active jobs
  if (env && env.DB && typeof env.DB.prepare === 'function') {
    try {
      await ensureD1Tables(env.DB);
      const oppsRes = await env.DB.prepare(
        "SELECT * FROM opportunities WHERE status = 'ACTIVE' OR status IS NULL ORDER BY published_epoch DESC, published_at DESC LIMIT 2000"
      ).all();
      const platsRes = await env.DB.prepare('SELECT * FROM custom_platforms ORDER BY created_at DESC LIMIT 300').all();
      const dbOpps = Array.isArray(oppsRes && oppsRes.results) ? oppsRes.results : [];
      const dbPlats = Array.isArray(platsRes && platsRes.results) ? platsRes.results : [];
      if (dbOpps.length > 0 || dbPlats.length > 0) {
        MEMORY_STATE = normalizeAndMergeState({
          opportunities: [...dbOpps, ...(MEMORY_STATE ? MEMORY_STATE.opportunities : [])],
          platforms: [...dbPlats, ...(MEMORY_STATE ? MEMORY_STATE.platforms : [])],
          lastScanAt: new Date().toISOString()
        });
        MEMORY_STATE._d1Loaded = true;
        return MEMORY_STATE;
      }
    } catch {
      // Ignore D1 read error and fallback to KV / Cache / Seed
    }
  }

  // 1. Try Cloudflare KV if bound
  if (env && env.STORE && typeof env.STORE.get === 'function') {
    try {
      const kvRaw = await env.STORE.get('bolivia_remote_state_v6', 'json');
      if (kvRaw && Array.isArray(kvRaw.opportunities)) {
        MEMORY_STATE = normalizeAndMergeState(kvRaw);
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
          MEMORY_STATE = normalizeAndMergeState(cachedData);
          return MEMORY_STATE;
        }
      }
    } catch {
      // Ignore Cache read error
    }
  }

  // 3. Initialize from bundled seed data
  MEMORY_STATE = normalizeAndMergeState({
    opportunities: [...INITIAL_OPPORTUNITIES],
    platforms: [...INITIAL_PLATFORMS],
    lastScanAt: new Date().toISOString()
  });
  if (env && env.DB) {
    MEMORY_STATE._d1Loaded = true;
  }

  return MEMORY_STATE;
}

async function saveState(state, env) {
  MEMORY_STATE = normalizeAndMergeState(state);
  state.opportunities = MEMORY_STATE.opportunities;
  state.platforms = MEMORY_STATE.platforms;

  // Save to Cloudflare D1 if bound (`env.DB`) — lifted 200-job cap up to 1,000 persisted per sync
  if (env && env.DB && typeof env.DB.prepare === 'function') {
    try {
      await ensureD1Tables(env.DB);
      const oppsToSave = MEMORY_STATE.opportunities.slice(0, 1000);
      const oppInsertSql =
        `INSERT OR REPLACE INTO opportunities (
          job_hash, title, company, company_slug, canonical_role_key,
          platform_id, platform_name, category, track, url,
          location, contract_caveat, tags, description,
          lang_mask, categories_csv, experience_tier, contracts_csv,
          published_at, published_epoch, discovered_at,
          first_seen_epoch, last_seen_epoch, sighting_count, repost_span_days, ghost_risk,
          bolivia_eligible, compensation_usd, ai_summary_es, ai_summary_en, ai_verified, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

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
      MEMORY_STATE._d1Loaded = true;
    } catch {
      // Ignore D1 write error
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

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-MCP-API-Key, Mcp-Session-Id'
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

    const state = await loadState(env);

    // 1. Main Web Interface (Spanish Bolivia first, with Employer Reality & Ghost-Job badges)
    if (request.method === 'GET' && (path === '/' || path === '/index.html')) {
      const enrichedOpps = await attachEmployerReality(state.opportunities, env);
      const html = renderAppHtml({ ...state, opportunities: enrichedOpps });
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }

    // 1a. Dedicated Spanish Legal & Tax Guide Page (Bolivia Remote Independent Contractors)
    if (request.method === 'GET' && (path === '/guia-legal-fiscal' || path === '/guia-legal-fiscal/' || path === '/legal-fiscal' || path === '/legal-fiscal/')) {
      const enrichedOpps = await attachEmployerReality(state.opportunities, env);
      const html = renderAppHtml({ ...state, opportunities: enrichedOpps }, { initialView: 'legal-tax' });
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }

    // 1b. Favicon Endpoints (Earth with Bolivian flag colors)
    if (request.method === 'GET' && (path === '/favicon.ico' || path === '/favicon.svg' || path === '/favicon.png')) {
      return new Response(FAVICON_SVG, {
        status: 200,
        headers: {
          'Content-Type': path.endsWith('.ico') ? 'image/x-icon' : (path.endsWith('.png') ? 'image/png' : 'image/svg+xml'),
          'Cache-Control': 'public, max-age=86400'
        }
      });
    }

    // 1c. SEO Sitemap XML & robots.txt Endpoints
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

    // 2. Get Current State API
    if (request.method === 'GET' && path === '/api/state') {
      const enrichedOpps = await attachEmployerReality(state.opportunities, env);
      return jsonResponse({
        version: '6.1.0',
        schedule: '*/15 * * * *',
        ai_enabled: Boolean(env && env.AI),
        d1_enabled: Boolean(env && env.DB),
        vectorize_enabled: Boolean(env && env.VECTORIZE),
        intel_vectorize_enabled: Boolean(env && env.INTEL_VECTORIZE),
        career_brain_enabled: Boolean(env && env.CAREER_BRAIN),
        autonomous_discovery_enabled: true,
        direct_ats_platforms_count: state.platforms.filter(p => p && p.type === 'ats_json' && p.enabled !== false).length,
        qdrant_enabled: Boolean(env && env.QDRANT_URL),
        mcp_endpoint: '/mcp',
        mcp_auth_enabled: !(env && String(env.MCP_PUBLIC_ACCESS).toLowerCase() === 'true'),
        lastScanAt: state.lastScanAt,
        platforms_count: state.platforms.length,
        opportunities_count: enrichedOpps.length,
        platforms: state.platforms,
        opportunities: enrichedOpps
      });
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

    // 5. On-Demand Scan Trigger API
    if (request.method === 'POST' && path === '/api/scan') {
      const body = await request.json().catch(() => ({}));
      const existingHashes = new Set(state.opportunities.map(o => o.job_hash));
      const scanRes = await runIngestionScan(state.platforms, existingHashes, {
        track: body.track,
        platform: body.platform,
        maxFeeds: 8,
        maxDorkClusters: 2
      });

      if (scanRes.new_opportunities.length > 0) {
        const enrichedNew = await enrichBatchWithAI(scanRes.new_opportunities, env, 5);
        const withSightings = await recordJobSightings(enrichedNew, env);
        await indexOpportunitiesInVectorStore(withSightings, env, 15);
        state.opportunities = [...withSightings, ...state.opportunities];
      }
      state.lastScanAt = scanRes.timestamp;
      if (ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(saveState(state, env));
      } else {
        await saveState(state, env);
      }

      const enrichedOpps = await attachEmployerReality(state.opportunities, env);
      return jsonResponse({
        ok: true,
        scanned_platforms: scanRes.scanned_platforms,
        new_count: scanRes.new_count,
        lastScanAt: state.lastScanAt,
        platforms: state.platforms,
        opportunities: enrichedOpps
      });
    }

    // 6. Custom Platform URL Live Scanner & Evaluator API (Zero-PII URL Sanitization)
    if (request.method === 'POST' && path === '/api/platforms/scan-url') {
      try {
        const body = await request.json();
        const cleanBody = {
          ...body,
          url: sanitizePlatformUrl(body.url || '')
        };
        const scanRes = await scanCustomPlatformUrl(cleanBody, cleanBody.filters || DEFAULT_FILTERS);
        scanRes.platform.url = sanitizePlatformUrl(scanRes.platform.url || '');
        scanRes.opportunities = await enrichBatchWithAI(scanRes.opportunities, env, 4);
        scanRes.opportunities = await recordJobSightings(scanRes.opportunities, env);
        await indexOpportunitiesInVectorStore(scanRes.opportunities, env, 10);

        const existingIdx = state.platforms.findIndex(p => p.id === scanRes.platform.id);
        if (existingIdx >= 0) {
          state.platforms[existingIdx] = scanRes.platform;
        } else {
          state.platforms.unshift(scanRes.platform);
        }

        const existingHashes = new Set(state.opportunities.map(o => o.job_hash));
        for (const item of scanRes.opportunities) {
          if (!checkBoliviaRemoteEligibility(item).eligible) continue;
          if (!existingHashes.has(item.job_hash)) {
            existingHashes.add(item.job_hash);
            state.opportunities.unshift(item);
          }
        }

        state.lastScanAt = new Date().toISOString();
        if (ctx && typeof ctx.waitUntil === 'function') {
          ctx.waitUntil(saveState(state, env));
        } else {
          await saveState(state, env);
        }

        let seedSyncInfo = null;
        if (body.persist === true && !scanRes.dead_lead) {
          const syncRes = await persistCustomPlatformsToDisk(state, ['.']);
          seedSyncInfo = {
            persisted_to_disk: syncRes.persisted_to_disk,
            custom_platforms_count: syncRes.custom_platforms_count,
            total_platforms_count: syncRes.total_platforms_count
          };
        }

        return jsonResponse({
          ok: true,
          platform: scanRes.platform,
          dead_lead: scanRes.dead_lead,
          http_status: scanRes.http_status,
          verdict_counts: scanRes.verdict_counts,
          discovered_count: scanRes.discovered_count,
          bolivia_eligible_count: scanRes.bolivia_eligible_count,
          opportunities: scanRes.opportunities,
          evaluated_opportunities: scanRes.evaluated_opportunities,
          all_opportunities: state.opportunities,
          platforms: state.platforms,
          seed_sync: seedSyncInfo
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message || 'Failed to scan URL' }, 400);
      }
    }

    // 7. Export / Sync Custom Platforms to src/seed_data.js & platforms_config.json
    if ((request.method === 'GET' || request.method === 'POST') && path === '/api/platforms/sync') {
      try {
        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          if (Array.isArray(body.platforms)) {
            const existingIds = new Set(state.platforms.map(p => p.id));
            for (const p of body.platforms) {
              if (p && p.id && !existingIds.has(p.id)) {
                existingIds.add(p.id);
                state.platforms.unshift({ ...p, url: sanitizePlatformUrl(p.url || '') });
              }
            }
          }
          if (Array.isArray(body.opportunities)) {
            const existingHashes = new Set(state.opportunities.map(o => o.job_hash));
            for (const o of body.opportunities) {
              if (!o || !checkBoliviaRemoteEligibility(o).eligible) continue;
              if (o.job_hash && !existingHashes.has(o.job_hash)) {
                existingHashes.add(o.job_hash);
                state.opportunities.unshift(cleanOpportunityFields(o));
              }
            }
          }
          await saveState(state, env);
          const syncRes = await persistCustomPlatformsToDisk(state, ['.']);
          return jsonResponse({
            ok: true,
            persisted_to_disk: syncRes.persisted_to_disk,
            written_files: syncRes.written_files,
            custom_platforms_count: syncRes.custom_platforms_count,
            newly_added_platforms_count: syncRes.newly_added_platforms_count,
            newly_added_opportunities_count: syncRes.newly_added_opportunities_count,
            total_platforms_count: syncRes.total_platforms_count,
            total_opportunities_count: syncRes.total_opportunities_count,
            custom_platforms: syncRes.custom_platforms
          });
        }

        const exportPayload = buildSeedExportPayload(state);
        return jsonResponse({
          ok: true,
          custom_platforms_count: exportPayload.custom_platforms_count,
          newly_added_platforms_count: exportPayload.newly_added_platforms_count,
          newly_added_opportunities_count: exportPayload.newly_added_opportunities_count,
          total_platforms_count: exportPayload.total_platforms_count,
          total_opportunities_count: exportPayload.total_opportunities_count,
          custom_platforms: exportPayload.custom_platforms,
          newly_added_platforms: exportPayload.newly_added_platforms,
          newly_added_opportunities: exportPayload.newly_added_opportunities
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message || 'Sync failed' }, 500);
      }
    }

    // 8. Grounded Context-Compiled Position Insights ("Más información con IA" v2)
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

        await saveState(state, env);
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
        await saveState(state, env);

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
      return handleMcpRequest(request, state, env, ctx, () => saveState(state, env));
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  },

  /**
   * Cloudflare Cron Trigger Handler — Runs automatically every 15 minutes
   * Includes self-healing promoted ATS health checks + AI-managed autonomous ATS discovery
   */
  async scheduled(event, env, ctx) {
    const task = (async () => {
      const state = await loadState(env);
      const existingHashes = new Set(state.opportunities.map(o => o.job_hash));
      const scanRes = await runIngestionScan(state.platforms, existingHashes, {
        maxFeeds: 8,
        maxDorkClusters: 2
      });

      // Self-healing health check for previously promoted direct ATS boards
      await applyPromotedSourceHealth(state, scanRes.platform_yields || [], env);

      // AI-managed background Autonomous Source Discovery & Promotion (2-3 allowlisted ATS probes per cycle)
      const discoveryRes = await runAutonomousDiscoveryCycle(state, env, {
        maxProbes: 3,
        rawScannedItems: scanRes.raw_scanned_items || []
      }).catch(() => ({ discovered_opportunities: [] }));

      const combinedNew = [
        ...(discoveryRes.discovered_opportunities || []),
        ...(scanRes.new_opportunities || [])
      ];

      if (combinedNew.length > 0) {
        const enrichedNew = await enrichBatchWithAI(combinedNew, env, 5);
        const withSightings = await recordJobSightings(enrichedNew, env);
        await indexOpportunitiesInVectorStore(withSightings, env, 25);
        state.opportunities = [...withSightings, ...state.opportunities];
      }
      await expireStaleOpportunities(env);
      state.lastScanAt = scanRes.timestamp;
      await saveState(state, env);
    })();

    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(task);
    } else {
      await task;
    }
  }
};
