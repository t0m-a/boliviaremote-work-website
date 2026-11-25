/**
 * BoliviaCareerBrainDO — Isolated SQLite Durable Object & Context Compiler (v6.0.0)
 * 100% Air-Gapped inside scout-analyst-pipeline (ADR-08: Zero external cross-worker linkage).
 *
 * Responsibilities:
 *   1. Embedded SQLite Knowledge Graph (`entities`, `edges`, `playbooks`, `playbooks_fts`,
 *      `intel_validations`, `intel_conflicts`) initialized via `ctx.storage.sql.exec`.
 *   2. Automatic idempotent cold-start seeding of all 86 monitored platforms, major remote
 *      employers, payout rails, EORs, and 12 curated bilingual Bolivia contractor playbooks.
 *   3. Fast batch employer reality badge lookup for job cards (`/api/state`, `/`).
 *   4. Token-budgeted `<bolivia_context>` compiler (~1200 tokens) combining:
 *        - 1-hop KG triples (capped at 40% token budget)
 *        - Hybrid Playbook retrieval (SQLite FTS5 + `env.INTEL_VECTORIZE` + local 128d)
 *        - Stage-2 `@cf/baai/bge-reranker-base` reranking when `env.AI` is bound.
 *   5. Seamless in-memory + optional D1 fallback (`career_brain_fallback`) when running in
 *      Node.js tests or self-hosted GPL v3.0 deployments without Durable Objects.
 */

import {
  buildCareerIntelSeedPack,
  CAREER_INTEL_SEED_VERSION
} from './career_intel_seed.js';
import { normalizeCompanySlug } from './privacy_guard.js';
import {
  buildLocalSemanticVector,
  cosineSimilarity,
  generateEmbedding,
  normalizeSearchText
} from './vector_store.js';
import { stripHtml } from './scanner.js';

const RERANKER_MODEL = '@cf/baai/bge-reranker-base';
const DEFAULT_DO_INSTANCE_NAME = 'bolivia-career-brain-v6';

const RAIL_LABELS = {
  'rail:airtm_usdc': 'AirTM',
  'rail:payoneer': 'Payoneer',
  'rail:wise': 'Wise',
  'rail:deel_withdrawal': 'Deel',
  'rail:tipalti': 'Tipalti',
  'rail:usdc_polygon_stellar': 'USDC',
  'rail:swift_usd': 'SWIFT USD'
};

const EOR_LABELS = {
  'eor:deel': 'Deel',
  'eor:ontop': 'Ontop',
  'eor:remote_com': 'Remote.com',
  'eor:plane': 'Plane',
  'eor:direct_w8ben': 'W-8BEN Directo'
};

function safeJsonParse(raw, fallback) {
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeFtsQuery(raw) {
  const tokens = normalizeSearchText(raw)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2)
    .slice(0, 12);
  if (tokens.length === 0) return '';
  return tokens.map(t => `"${t}"*`).join(' OR ');
}

function computeEmployerMultiplier(tier, confidence) {
  const conf = Math.max(0.3, Math.min(1, Number(confidence) || 0.75));
  if (tier === 'verified_friendly') {
    return Number((1.05 + (conf - 0.5) * 0.2).toFixed(3)); // up to 1.15
  }
  if (tier === 'open_global') {
    return Number((1.0 + (conf - 0.5) * 0.08).toFixed(3));
  }
  if (tier === 'caution_friction') {
    return Number((0.88 - (1 - conf) * 0.1).toFixed(3));
  }
  if (tier === 'geo_blocked') {
    return 0.65;
  }
  return 1.0;
}

/**
 * Safely calls Workers AI `@cf/baai/bge-reranker-base` to rerank candidate text passages.
 * Returns a Map<index, normalizedScore> or null if unavailable/incompatible mock.
 */
async function rerankPassagesWithBge(query, passages, env) {
  if (!env || !env.AI || typeof env.AI.run !== 'function' || !Array.isArray(passages) || passages.length === 0) {
    return null;
  }
  try {
    const resp = await env.AI.run(RERANKER_MODEL, {
      query: String(query || '').slice(0, 400),
      contexts: passages.map(p => ({ text: String(p || '').slice(0, 700) }))
    });
    const list = (resp && Array.isArray(resp.response))
      ? resp.response
      : (Array.isArray(resp) ? resp : null);
    if (!list || list.length === 0) return null;

    const scores = new Map();
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (item && typeof item.score === 'number') {
        const idx = typeof item.id === 'number' ? item.id : i;
        scores.set(idx, Math.max(0, Math.min(1, item.score)));
      }
    }
    return scores.size > 0 ? scores : null;
  } catch {
    return null;
  }
}

/**
 * Cloudflare Durable Object Class (`new_sqlite_classes = ["BoliviaCareerBrainDO"]`)
 * Compatible with both Cloudflare `workerd` SQLite storage and local Node.js runtime.
 */
export class BoliviaCareerBrainDO {
  constructor(ctx, env) {
    this.ctx = ctx || null;
    this.env = env || {};
    this.sql = (ctx && ctx.storage && ctx.storage.sql) ? ctx.storage.sql : null;

    // In-memory store mirror (authoritative only when running without SQLite storage, e.g. Node unit tests)
    this.mem = {
      entities: new Map(),
      edges: [],
      playbooks: new Map(),
      validations: [],
      conflicts: [],
      meta: new Map()
    };

    const initWork = () => {
      if (this.sql) {
        this._initSqliteSchema();
      }
      this._ensureSeeded();
    };

    if (ctx && typeof ctx.blockConcurrencyWhile === 'function') {
      ctx.blockConcurrencyWhile(async () => {
        initWork();
      });
    } else {
      initWork();
    }
  }

  _initSqliteSchema() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entities (
        entity_id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        canonical_name TEXT NOT NULL,
        domain TEXT DEFAULT '',
        bolivia_tier TEXT DEFAULT 'open_global',
        confidence REAL DEFAULT 0.8,
        pagerank_score REAL DEFAULT 0.5,
        attributes_json TEXT DEFAULT '{}',
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cb_entities_name ON entities(canonical_name);
      CREATE INDEX IF NOT EXISTS idx_cb_entities_domain ON entities(domain);

      CREATE TABLE IF NOT EXISTS edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        relation TEXT NOT NULL,
        weight REAL DEFAULT 0.85,
        confidence REAL DEFAULT 0.8,
        evidence_note TEXT DEFAULT '',
        valid_from TEXT NOT NULL,
        valid_until TEXT DEFAULT NULL,
        UNIQUE(source_id, target_id, relation)
      );

      CREATE INDEX IF NOT EXISTS idx_cb_edges_source ON edges(source_id, valid_until);
      CREATE INDEX IF NOT EXISTS idx_cb_edges_target ON edges(target_id, valid_until);

      CREATE TABLE IF NOT EXISTS playbooks (
        playbook_id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        title_es TEXT NOT NULL,
        title_en TEXT NOT NULL,
        summary_es TEXT DEFAULT '',
        summary_en TEXT DEFAULT '',
        content_es TEXT NOT NULL,
        content_en TEXT NOT NULL,
        tags TEXT DEFAULT '',
        updated_at TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS playbooks_fts USING fts5(
        playbook_id UNINDEXED,
        category,
        title_es,
        title_en,
        content_es,
        content_en,
        tags,
        tokenize = 'unicode61 remove_diacritics 2'
      );

      CREATE TABLE IF NOT EXISTS intel_validations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id TEXT NOT NULL,
        validator TEXT DEFAULT 'operator',
        status TEXT DEFAULT 'verified',
        note TEXT DEFAULT '',
        validated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS intel_conflicts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id TEXT NOT NULL,
        conflict_type TEXT NOT NULL,
        evidence TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        created_at TEXT NOT NULL
      );
    `);
  }

  _getMeta(key) {
    if (this.sql) {
      const rows = this.sql.exec('SELECT value FROM meta WHERE key = ?', key).toArray();
      return rows.length > 0 ? rows[0].value : null;
    }
    return this.mem.meta.get(key) || null;
  }

  _setMeta(key, value) {
    if (this.sql) {
      this.sql.exec('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, String(value));
    } else {
      this.mem.meta.set(key, String(value));
    }
  }

  _ensureSeeded() {
    const currentVersion = this._getMeta('seed_version');
    if (currentVersion === CAREER_INTEL_SEED_VERSION) {
      return;
    }

    const pack = buildCareerIntelSeedPack();
    const nowIso = new Date().toISOString();

    for (const ent of pack.entities) {
      this._putEntityRow({
        entity_id: ent.entity_id,
        entity_type: ent.entity_type,
        canonical_name: ent.canonical_name,
        domain: ent.domain || '',
        bolivia_tier: ent.bolivia_tier || 'open_global',
        confidence: Number(ent.confidence ?? 0.8),
        pagerank_score: Number(ent.pagerank_score ?? 0.5),
        attributes_json: JSON.stringify(ent.attributes || {}),
        updated_at: nowIso
      });
    }

    for (const edge of pack.edges) {
      this._putEdgeRow({
        source_id: edge.source_id,
        target_id: edge.target_id,
        relation: edge.relation,
        weight: Number(edge.weight ?? 0.85),
        confidence: Number(edge.confidence ?? 0.8),
        evidence_note: edge.evidence_note || '',
        valid_from: nowIso,
        valid_until: null
      });
    }

    for (const pb of pack.playbooks) {
      this._putPlaybookRow({
        ...pb,
        updated_at: nowIso
      });
    }

    this._setMeta('seed_version', CAREER_INTEL_SEED_VERSION);
    this._setMeta('seeded_at', nowIso);
  }

  _putEntityRow(row) {
    if (this.sql) {
      this.sql.exec(
        `INSERT OR REPLACE INTO entities (
          entity_id, entity_type, canonical_name, domain, bolivia_tier,
          confidence, pagerank_score, attributes_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.entity_id,
        row.entity_type,
        row.canonical_name,
        row.domain || '',
        row.bolivia_tier || 'open_global',
        Number(row.confidence ?? 0.8),
        Number(row.pagerank_score ?? 0.5),
        typeof row.attributes_json === 'string' ? row.attributes_json : JSON.stringify(row.attributes_json || {}),
        row.updated_at || new Date().toISOString()
      );
    } else {
      this.mem.entities.set(row.entity_id, { ...row });
    }
  }

  _putEdgeRow(edge) {
    if (this.sql) {
      this.sql.exec(
        `INSERT OR REPLACE INTO edges (
          source_id, target_id, relation, weight, confidence,
          evidence_note, valid_from, valid_until
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        edge.source_id,
        edge.target_id,
        edge.relation,
        Number(edge.weight ?? 0.85),
        Number(edge.confidence ?? 0.8),
        edge.evidence_note || '',
        edge.valid_from || new Date().toISOString(),
        edge.valid_until || null
      );
    } else {
      const idx = this.mem.edges.findIndex(
        e => e.source_id === edge.source_id && e.target_id === edge.target_id && e.relation === edge.relation
      );
      if (idx >= 0) {
        this.mem.edges[idx] = { ...edge };
      } else {
        this.mem.edges.push({ ...edge });
      }
    }
  }

  _putPlaybookRow(pb) {
    const updatedAt = pb.updated_at || new Date().toISOString();
    if (this.sql) {
      this.sql.exec(
        `INSERT OR REPLACE INTO playbooks (
          playbook_id, category, title_es, title_en, summary_es, summary_en,
          content_es, content_en, tags, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        pb.playbook_id,
        pb.category || 'general',
        pb.title_es || '',
        pb.title_en || '',
        pb.summary_es || '',
        pb.summary_en || '',
        pb.content_es || '',
        pb.content_en || '',
        pb.tags || '',
        updatedAt
      );
      this.sql.exec('DELETE FROM playbooks_fts WHERE playbook_id = ?', pb.playbook_id);
      this.sql.exec(
        `INSERT INTO playbooks_fts (
          playbook_id, category, title_es, title_en, content_es, content_en, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        pb.playbook_id,
        pb.category || 'general',
        pb.title_es || '',
        pb.title_en || '',
        pb.content_es || '',
        pb.content_en || '',
        pb.tags || ''
      );
    } else {
      this.mem.playbooks.set(pb.playbook_id, { ...pb, updated_at: updatedAt });
    }
  }

  _getAllEntities() {
    if (this.sql) {
      return this.sql.exec('SELECT * FROM entities').toArray();
    }
    return Array.from(this.mem.entities.values());
  }

  _getActiveEdgesForSource(sourceId) {
    if (!sourceId) return [];
    if (this.sql) {
      return this.sql
        .exec('SELECT * FROM edges WHERE source_id = ? AND valid_until IS NULL', sourceId)
        .toArray();
    }
    return this.mem.edges.filter(e => e.source_id === sourceId && !e.valid_until);
  }

  _getAllPlaybooks() {
    if (this.sql) {
      return this.sql.exec('SELECT * FROM playbooks').toArray();
    }
    return Array.from(this.mem.playbooks.values());
  }

  /**
   * Resolves a company or platform name/id/domain against the KG entity index.
   */
  _resolveEntity({ company, platform_id, platform_name, domain, url } = {}) {
    const all = this._getAllEntities();
    const candidates = new Set();

    if (platform_id) {
      candidates.add(`platform:${String(platform_id).toLowerCase().trim()}`);
    }
    const compSlug = normalizeCompanySlug(company, 'company');
    if (compSlug) {
      candidates.add(compSlug);
      candidates.add(compSlug.replace(/^company:/, 'platform:'));
    }
    const platSlug = normalizeCompanySlug(platform_name, 'platform');
    if (platSlug) {
      candidates.add(platSlug);
      candidates.add(platSlug.replace(/^platform:/, 'company:'));
    }

    let extractedDomain = String(domain || '').toLowerCase().replace(/^www\./, '').trim();
    if (!extractedDomain && url) {
      try {
        extractedDomain = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      } catch {
        // ignore invalid url
      }
    }

    // 1. Exact entity_id match (prefer company over platform if company specifically matched)
    const byId = new Map(all.map(e => [e.entity_id, e]));
    if (compSlug && byId.has(compSlug)) return byId.get(compSlug);
    for (const cid of candidates) {
      if (byId.has(cid)) return byId.get(cid);
    }

    // 2. Canonical name / alias / domain match
    const normComp = normalizeSearchText(company || '');
    const normPlat = normalizeSearchText(platform_name || '');
    for (const ent of all) {
      if (ent.entity_type !== 'company' && ent.entity_type !== 'platform') continue;
      const attrs = safeJsonParse(ent.attributes_json, {});
      const entName = normalizeSearchText(ent.canonical_name || '');
      const entDom = String(ent.domain || '').toLowerCase().replace(/^www\./, '');
      if (normComp && (entName === normComp || (Array.isArray(attrs.aliases) && attrs.aliases.includes(compSlug)))) {
        return ent;
      }
      if (extractedDomain && entDom && (extractedDomain === entDom || extractedDomain.endsWith('.' + entDom))) {
        return ent;
      }
      if (normPlat && entName === normPlat) {
        return ent;
      }
    }

    return null;
  }

  /**
   * Builds a compact structured Employer Reality signal object for job cards & ranking.
   */
  lookupEmployerReality(item) {
    const entity = this._resolveEntity(item);
    if (!entity) {
      return {
        matched: false,
        entity_id: '',
        canonical_name: item.company || item.platform_name || '',
        bolivia_tier: 'open_global',
        confidence: 0.65,
        payout_rails: [],
        eor_options: [],
        assessments: [],
        typical_comp: '',
        reality_badge_es: '',
        reality_badge_en: '',
        caution_note_es: '',
        caution_note_en: '',
        note_es: '',
        note_en: '',
        employer_multiplier: 1.0,
        triples: []
      };
    }

    const attrs = safeJsonParse(entity.attributes_json, {});
    const edges = this._getActiveEdgesForSource(entity.entity_id);

    const payoutRails = [];
    const eorOptions = [];
    const assessments = [];
    let typicalComp = attrs.typical_comp || '';

    for (const e of edges) {
      if (e.relation === 'PAYS_VIA') {
        const lbl = RAIL_LABELS[e.target_id] || e.target_id.replace(/^rail:/, '');
        if (lbl && !payoutRails.includes(lbl)) payoutRails.push(lbl);
      } else if (e.relation === 'USES_EOR') {
        const lbl = EOR_LABELS[e.target_id] || e.target_id.replace(/^eor:/, '');
        if (lbl && !eorOptions.includes(lbl)) eorOptions.push(lbl);
      } else if (e.relation === 'REQUIRES_ASSESSMENT' && e.evidence_note) {
        assessments.push(e.evidence_note);
      } else if (e.relation === 'TYPICAL_COMPENSATION' && e.evidence_note && !typicalComp) {
        typicalComp = e.evidence_note;
      }
    }

    const tier = entity.bolivia_tier || 'open_global';
    const conf = Number(entity.confidence ?? 0.8);

    let realityBadgeEs = '';
    let realityBadgeEn = '';
    if (payoutRails.length > 0 && tier === 'verified_friendly') {
      const railsShort = payoutRails.slice(0, 3).join(' / ');
      realityBadgeEs = `Cobro verificado: ${railsShort}`;
      realityBadgeEn = `Verified payout: ${railsShort}`;
    } else if (payoutRails.length > 0 && tier === 'caution_friction') {
      const railsShort = payoutRails.slice(0, 2).join(' / ');
      realityBadgeEs = `Verificar cobro (${railsShort})`;
      realityBadgeEn = `Verify payout (${railsShort})`;
    } else if (eorOptions.length > 0) {
      realityBadgeEs = `Contrato: ${eorOptions.slice(0, 2).join(' / ')}`;
      realityBadgeEn = `Contract: ${eorOptions.slice(0, 2).join(' / ')}`;
    }

    const cautionEs = attrs.caution_es || (tier === 'caution_friction' ? attrs.note_es : '');
    const cautionEn = attrs.caution_en || (tier === 'caution_friction' ? attrs.note_en : '');

    return {
      matched: true,
      entity_id: entity.entity_id,
      entity_type: entity.entity_type,
      canonical_name: entity.canonical_name,
      bolivia_tier: tier,
      confidence: Number(conf.toFixed(2)),
      payout_rails: payoutRails,
      eor_options: eorOptions,
      assessments,
      typical_comp: typicalComp,
      reality_badge_es: realityBadgeEs,
      reality_badge_en: realityBadgeEn,
      caution_note_es: cautionEs || '',
      caution_note_en: cautionEn || '',
      note_es: attrs.note_es || '',
      note_en: attrs.note_en || '',
      employer_multiplier: computeEmployerMultiplier(tier, conf),
      triples: edges.map(e => ({
        source: e.source_id,
        relation: e.relation,
        target: e.target_id,
        confidence: e.confidence,
        evidence: e.evidence_note
      }))
    };
  }

  /**
   * Batch employer reality lookup (1 single DO roundtrip for all job cards).
   */
  lookupEmployerRealityBatch(items = []) {
    const out = {};
    for (const item of items) {
      if (!item) continue;
      const key = item.job_hash || `${item.company || ''}|${item.platform_id || ''}`;
      out[key] = this.lookupEmployerReality(item);
    }
    return out;
  }

  /**
   * Retrieves top Bolivia contractor playbooks using hybrid FTS5 + INTEL_VECTORIZE + local 128d
   * + Stage-2 bge-reranker-base reranking.
   */
  async _retrieveRelevantPlaybooks(queryText, limit = 4) {
    const allPlaybooks = this._getAllPlaybooks();
    if (allPlaybooks.length === 0) return [];
    const byId = new Map(allPlaybooks.map(p => [p.playbook_id, p]));

    const scores = new Map();
    const addScore = (id, delta) => {
      scores.set(id, (scores.get(id) || 0) + delta);
    };

    // Channel 1: SQLite FTS5 BM25
    if (this.sql) {
      const ftsQ = sanitizeFtsQuery(queryText);
      if (ftsQ) {
        try {
          const ftsRows = this.sql
            .exec(
              `SELECT playbook_id, bm25(playbooks_fts) AS rank
               FROM playbooks_fts
               WHERE playbooks_fts MATCH ?
               ORDER BY rank
               LIMIT 8`,
              ftsQ
            )
            .toArray();
          ftsRows.forEach((r, idx) => {
            addScore(r.playbook_id, 1.15 / (60 + idx + 1));
          });
        } catch {
          // ignore FTS syntax edge cases
        }
      }
    }

    // Channel 2: Dedicated INTEL_VECTORIZE (`bolivia-remote-intel-m3`)
    if (this.env && this.env.INTEL_VECTORIZE && typeof this.env.INTEL_VECTORIZE.query === 'function') {
      try {
        const qEmb = await generateEmbedding(queryText, this.env);
        const vecRes = await this.env.INTEL_VECTORIZE.query(qEmb.vector, {
          topK: 6,
          filter: { doc_type: 'playbook' },
          returnMetadata: 'all'
        }).catch(() => this.env.INTEL_VECTORIZE.query(qEmb.vector, { topK: 6, returnMetadata: 'all' }));
        const matches = (vecRes && Array.isArray(vecRes.matches)) ? vecRes.matches : [];
        matches.forEach((m, idx) => {
          const pid = (m.metadata && m.metadata.playbook_id) || m.id;
          if (byId.has(pid)) {
            addScore(pid, 1.25 / (60 + idx + 1));
          }
        });
      } catch {
        // ignore vectorize error
      }
    }

    // Channel 3: Local 128-dim cross-lingual semantic fallback
    const qVec = buildLocalSemanticVector(queryText);
    const localRanked = allPlaybooks
      .map(pb => {
        const blob = `${pb.title_es} ${pb.title_en} ${pb.summary_es} ${pb.tags} ${pb.content_es.slice(0, 350)}`;
        const sim = cosineSimilarity(qVec, buildLocalSemanticVector(blob));
        return { id: pb.playbook_id, sim };
      })
      .sort((a, b) => b.sim - a.sim);

    localRanked.slice(0, 8).forEach((item, idx) => {
      addScore(item.id, (0.9 + item.sim * 0.4) / (60 + idx + 1));
    });

    // Always include W-8BEN or UTC-4 if nothing strongly matched
    if (scores.size === 0) {
      addScore('pb_w8ben_bolivia', 0.02);
      addScore('pb_utc4_overlap', 0.015);
    }

    const candidates = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, score]) => ({ playbook: byId.get(id), score }))
      .filter(x => Boolean(x.playbook));

    // Stage 2: Cross-Encoder Neural Reranking (`@cf/baai/bge-reranker-base`)
    const rerankMap = await rerankPassagesWithBge(
      queryText,
      candidates.map(c => `${c.playbook.title_es}. ${c.playbook.summary_es} ${c.playbook.content_es}`),
      this.env
    );

    if (rerankMap) {
      candidates.forEach((c, idx) => {
        const rScore = rerankMap.get(idx);
        if (typeof rScore === 'number') {
          c.score = c.score * 0.35 + rScore * 0.65;
        }
      });
      candidates.sort((a, b) => b.score - a.score);
    }

    return candidates.slice(0, limit).map(c => c.playbook);
  }

  /**
   * Token-Budgeted `<bolivia_context>` Compiler (default ~1200 tokens):
   *   - 1-Hop Employer & Platform KG Triples (capped at 40% of token budget)
   *   - Top Hybrid-Retrieved & Reranked Bolivia Contractor Playbooks (remaining 60%)
   */
  async compileBoliviaContext(job, options = {}) {
    const tokenBudget = Math.min(Math.max(Number(options.tokenBudget) || 1200, 400), 2400);
    const kgTokenCap = Math.floor(tokenBudget * 0.4);
    const employerReality = this.lookupEmployerReality(job);

    // Also inspect platform reality if employer was resolved as a separate company
    let platformReality = null;
    if (job.platform_id || job.platform_name) {
      const pCheck = this.lookupEmployerReality({
        platform_id: job.platform_id,
        platform_name: job.platform_name
      });
      if (pCheck.matched && pCheck.entity_id !== employerReality.entity_id) {
        platformReality = pCheck;
      }
    }

    const combinedRails = Array.from(new Set([
      ...(employerReality.payout_rails || []),
      ...((platformReality && platformReality.payout_rails) || [])
    ]));
    const combinedEors = Array.from(new Set([
      ...(employerReality.eor_options || []),
      ...((platformReality && platformReality.eor_options) || [])
    ]));

    const queryText = [
      job.title || '',
      job.company || '',
      job.platform_name || '',
      job.location || '',
      job.track || '',
      job.tags || '',
      combinedRails.join(' '),
      combinedEors.join(' '),
      'Bolivia UTC-4 W-8BEN cobro USD'
    ]
      .filter(Boolean)
      .join(' ');

    const playbooks = await this._retrieveRelevantPlaybooks(queryText, 4);

    // 1. Serialize KG Triples up to 40% budget
    const kgLines = [];
    let kgTokens = 0;
    const allTriples = [
      ...(employerReality.triples || []),
      ...((platformReality && platformReality.triples) || [])
    ];
    for (const tr of allTriples) {
      const line = `    <triple source="${escapeXml(tr.source)}" relation="${escapeXml(tr.relation)}" target="${escapeXml(tr.target)}" confidence="${tr.confidence}">${escapeXml(tr.evidence || '')}</triple>`;
      const t = estimateTokens(line);
      if (kgTokens + t > kgTokenCap) break;
      kgLines.push(line);
      kgTokens += t;
    }

    // 2. Serialize Playbooks up to remaining budget
    const headerBase =
      `<bolivia_context version="${CAREER_INTEL_SEED_VERSION}">\n` +
      `  <employer_reality matched="${employerReality.matched}" tier="${escapeXml(employerReality.bolivia_tier)}" confidence="${employerReality.confidence}" payout_rails="${escapeXml(combinedRails.join(', '))}" eor_options="${escapeXml(combinedEors.join(', '))}">\n` +
      (employerReality.note_es ? `    <note>${escapeXml(employerReality.note_es)}</note>\n` : '') +
      (employerReality.caution_note_es ? `    <caution>${escapeXml(employerReality.caution_note_es)}</caution>\n` : '') +
      (kgLines.length > 0 ? kgLines.join('\n') + '\n' : '') +
      `  </employer_reality>\n`;

    let usedTokens = estimateTokens(headerBase) + 25;
    const pbLines = [];
    const playbooksUsed = [];

    for (const pb of playbooks) {
      const remainingTokens = tokenBudget - usedTokens;
      if (remainingTokens < 60) break;
      const maxChars = Math.max(160, (remainingTokens - 30) * 4);
      const body = String(pb.content_es || '').slice(0, maxChars);
      const block = `    <playbook id="${escapeXml(pb.playbook_id)}" category="${escapeXml(pb.category)}" title="${escapeXml(pb.title_es)}">${escapeXml(body)}</playbook>`;
      const blockTokens = estimateTokens(block);
      if (usedTokens + blockTokens > tokenBudget && pbLines.length > 0) break;
      pbLines.push(block);
      playbooksUsed.push({
        playbook_id: pb.playbook_id,
        category: pb.category,
        title_es: pb.title_es,
        title_en: pb.title_en
      });
      usedTokens += blockTokens;
    }

    const xml =
      headerBase +
      `  <contractor_playbooks>\n` +
      pbLines.join('\n') +
      (pbLines.length > 0 ? '\n' : '') +
      `  </contractor_playbooks>\n` +
      `</bolivia_context>`;

    return {
      ok: true,
      realitySignals: {
        ...employerReality,
        payout_rails: combinedRails,
        eor_options: combinedEors,
        platform_note_es: (platformReality && platformReality.note_es) || employerReality.note_es || '',
        platform_note_en: (platformReality && platformReality.note_en) || employerReality.note_en || ''
      },
      playbooks_used: playbooksUsed,
      kg_triples_count: kgLines.length,
      context_tokens_est: estimateTokens(xml),
      xml
    };
  }

  /**
   * Admin tool handler: upsert an employer/platform entity and optional directed edges.
   */
  async upsertEmployerReality(payload) {
    const rawName = stripHtml(payload.canonical_name || payload.name || '').trim();
    if (!rawName && !payload.entity_id) {
      throw new Error('canonical_name or entity_id is required');
    }
    const entityType = ['company', 'platform', 'eor', 'payout_rail', 'skill_bridge'].includes(payload.entity_type)
      ? payload.entity_type
      : 'company';
    const entityId = String(payload.entity_id || normalizeCompanySlug(rawName, entityType)).trim();
    const tier = ['verified_friendly', 'open_global', 'caution_friction', 'geo_blocked'].includes(payload.bolivia_tier)
      ? payload.bolivia_tier
      : 'open_global';
    const confidence = Math.max(0, Math.min(1, Number(payload.confidence ?? 0.85)));
    const nowIso = new Date().toISOString();

    const attributes = {
      note_es: stripHtml(payload.note_es || ''),
      note_en: stripHtml(payload.note_en || ''),
      caution_es: stripHtml(payload.caution_es || ''),
      caution_en: stripHtml(payload.caution_en || ''),
      typical_comp: stripHtml(payload.typical_comp || ''),
      assessment: stripHtml(payload.assessment || '')
    };

    this._putEntityRow({
      entity_id: entityId,
      entity_type: entityType,
      canonical_name: rawName || entityId,
      domain: stripHtml(payload.domain || '').toLowerCase(),
      bolivia_tier: tier,
      confidence,
      pagerank_score: Number(payload.pagerank_score ?? 0.75),
      attributes_json: JSON.stringify(attributes),
      updated_at: nowIso
    });

    let edgesUpserted = 0;
    const payoutRails = Array.isArray(payload.payout_rails) ? payload.payout_rails : [];
    for (const r of payoutRails) {
      const targetId = String(r).startsWith('rail:') ? String(r) : `rail:${String(r).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
      this._putEdgeRow({
        source_id: entityId,
        target_id: targetId,
        relation: 'PAYS_VIA',
        weight: 0.92,
        confidence,
        evidence_note: stripHtml(payload.evidence_note || `Verified payout rail ${r}`),
        valid_from: nowIso,
        valid_until: null
      });
      edgesUpserted++;
    }

    const eorOptions = Array.isArray(payload.eor_options) ? payload.eor_options : [];
    for (const eor of eorOptions) {
      const targetId = String(eor).startsWith('eor:') ? String(eor) : `eor:${String(eor).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
      this._putEdgeRow({
        source_id: entityId,
        target_id: targetId,
        relation: 'USES_EOR',
        weight: 0.9,
        confidence,
        evidence_note: stripHtml(payload.evidence_note || `EOR option ${eor}`),
        valid_from: nowIso,
        valid_until: null
      });
      edgesUpserted++;
    }

    if (Array.isArray(payload.edges)) {
      for (const edge of payload.edges) {
        if (edge && edge.relation && edge.target_id) {
          this._putEdgeRow({
            source_id: entityId,
            target_id: String(edge.target_id),
            relation: String(edge.relation),
            weight: Number(edge.weight ?? 0.85),
            confidence: Number(edge.confidence ?? confidence),
            evidence_note: stripHtml(edge.evidence_note || ''),
            valid_from: nowIso,
            valid_until: null
          });
          edgesUpserted++;
        }
      }
    }

    // Record validation audit trail
    if (this.sql) {
      this.sql.exec(
        'INSERT INTO intel_validations (entity_id, validator, status, note, validated_at) VALUES (?, ?, ?, ?, ?)',
        entityId,
        stripHtml(payload.validator || 'mcp_operator'),
        'verified',
        stripHtml(payload.evidence_note || attributes.note_es || 'Upserted via MCP'),
        nowIso
      );
    } else {
      this.mem.validations.push({
        entity_id: entityId,
        validator: stripHtml(payload.validator || 'mcp_operator'),
        status: 'verified',
        note: stripHtml(payload.evidence_note || attributes.note_es || 'Upserted via MCP'),
        validated_at: nowIso
      });
    }

    // Index employer dossier in dedicated INTEL_VECTORIZE if bound
    let vectorIndexed = false;
    if (this.env && this.env.INTEL_VECTORIZE && typeof this.env.INTEL_VECTORIZE.upsert === 'function') {
      try {
        const text = `${rawName} ${tier} ${payoutRails.join(' ')} ${eorOptions.join(' ')} ${attributes.note_es} ${attributes.note_en}`;
        const emb = await generateEmbedding(text, this.env);
        await this.env.INTEL_VECTORIZE.upsert([{
          id: entityId,
          values: emb.vector,
          metadata: {
            doc_type: 'employer_dossier',
            entity_id: entityId,
            bolivia_tier: tier
          }
        }]);
        vectorIndexed = true;
      } catch {
        // ignore vectorize error
      }
    }

    return {
      ok: true,
      entity_id: entityId,
      bolivia_tier: tier,
      confidence,
      edges_upserted: edgesUpserted,
      vector_indexed: vectorIndexed,
      reality: this.lookupEmployerReality({ company: rawName, platform_id: entityId.replace(/^platform:/, '') })
    };
  }

  /**
   * Admin tool handler: upsert a curated bilingual Bolivia contractor playbook.
   */
  async upsertBoliviaPlaybook(payload) {
    const playbookId = String(payload.playbook_id || '').trim() ||
      `pb_${normalizeCompanySlug(payload.title_es || payload.title_en || 'custom', 'custom').replace(/^custom:/, '')}`;
    const titleEs = stripHtml(payload.title_es || '').trim();
    const contentEs = stripHtml(payload.content_es || '').trim();
    if (!titleEs || !contentEs) {
      throw new Error('title_es and content_es are required');
    }

    const row = {
      playbook_id: playbookId,
      category: stripHtml(payload.category || 'general'),
      title_es: titleEs,
      title_en: stripHtml(payload.title_en || titleEs),
      summary_es: stripHtml(payload.summary_es || contentEs.slice(0, 180)),
      summary_en: stripHtml(payload.summary_en || payload.title_en || titleEs),
      content_es: contentEs,
      content_en: stripHtml(payload.content_en || contentEs),
      tags: stripHtml(payload.tags || ''),
      updated_at: new Date().toISOString()
    };

    this._putPlaybookRow(row);

    let vectorIndexed = false;
    if (this.env && this.env.INTEL_VECTORIZE && typeof this.env.INTEL_VECTORIZE.upsert === 'function') {
      try {
        const text = `${row.title_es} | ${row.title_en} | ${row.tags} | ${row.content_es}`;
        const emb = await generateEmbedding(text, this.env);
        await this.env.INTEL_VECTORIZE.upsert([{
          id: playbookId,
          values: emb.vector,
          metadata: {
            doc_type: 'playbook',
            playbook_id: playbookId,
            category: row.category
          }
        }]);
        vectorIndexed = true;
      } catch {
        // ignore vectorize error
      }
    }

    return {
      ok: true,
      playbook_id: playbookId,
      category: row.category,
      vector_indexed: vectorIndexed,
      updated_at: row.updated_at
    };
  }

  /**
   * Logs an employer policy contradiction into `intel_conflicts` for operator review.
   */
  recordIntelConflict({ entity_id, conflict_type = 'geo_policy_drift', evidence = '' }) {
    const nowIso = new Date().toISOString();
    if (this.sql) {
      this.sql.exec(
        'INSERT INTO intel_conflicts (entity_id, conflict_type, evidence, status, created_at) VALUES (?, ?, ?, ?, ?)',
        String(entity_id || 'unknown'),
        String(conflict_type),
        stripHtml(evidence),
        'open',
        nowIso
      );
    } else {
      this.mem.conflicts.push({
        id: this.mem.conflicts.length + 1,
        entity_id: String(entity_id || 'unknown'),
        conflict_type: String(conflict_type),
        evidence: stripHtml(evidence),
        status: 'open',
        created_at: nowIso
      });
    }
    return { ok: true, entity_id, conflict_type, created_at: nowIso };
  }

  /**
   * Returns operational diagnostics for `inspect_career_brain_status`.
   */
  inspectStatus() {
    if (this.sql) {
      const entitiesCount = this.sql.exec('SELECT COUNT(*) AS c FROM entities').one().c;
      const edgesCount = this.sql.exec('SELECT COUNT(*) AS c FROM edges WHERE valid_until IS NULL').one().c;
      const playbooksCount = this.sql.exec('SELECT COUNT(*) AS c FROM playbooks').one().c;
      const validationsCount = this.sql.exec('SELECT COUNT(*) AS c FROM intel_validations').one().c;
      const openConflicts = this.sql
        .exec("SELECT * FROM intel_conflicts WHERE status = 'open' ORDER BY created_at DESC LIMIT 20")
        .toArray();
      return {
        ok: true,
        storage_backend: 'cloudflare-do-sqlite',
        seed_version: this._getMeta('seed_version') || CAREER_INTEL_SEED_VERSION,
        entities_count: entitiesCount,
        edges_count: edgesCount,
        playbooks_count: playbooksCount,
        validations_count: validationsCount,
        open_conflicts_count: openConflicts.length,
        open_conflicts: openConflicts
      };
    }

    const openConflicts = this.mem.conflicts.filter(c => c.status === 'open').slice(-20);
    return {
      ok: true,
      storage_backend: 'in-memory-fallback',
      seed_version: this._getMeta('seed_version') || CAREER_INTEL_SEED_VERSION,
      entities_count: this.mem.entities.size,
      edges_count: this.mem.edges.filter(e => !e.valid_until).length,
      playbooks_count: this.mem.playbooks.size,
      validations_count: this.mem.validations.length,
      open_conflicts_count: openConflicts.length,
      open_conflicts: openConflicts
    };
  }

  /**
   * Internal HTTP handler invoked by Worker stubs (`stub.fetch(...)`).
   */
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (request.method === 'GET' && path === '/internal/status') {
        return Response.json(this.inspectStatus());
      }
      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        if (path === '/internal/lookup-batch') {
          return Response.json({
            ok: true,
            results: this.lookupEmployerRealityBatch(body.items || [])
          });
        }
        if (path === '/internal/compile-context') {
          return Response.json(await this.compileBoliviaContext(body.job || {}, body.options || {}));
        }
        if (path === '/internal/upsert-employer') {
          return Response.json(await this.upsertEmployerReality(body));
        }
        if (path === '/internal/upsert-playbook') {
          return Response.json(await this.upsertBoliviaPlaybook(body));
        }
        if (path === '/internal/record-conflict') {
          return Response.json(this.recordIntelConflict(body));
        }
      }
      return Response.json({ ok: false, error: 'Not Found' }, { status: 404 });
    } catch (err) {
      return Response.json({ ok: false, error: err.message || 'CareerBrainDO error' }, { status: 400 });
    }
  }
}

// Local singleton fallback for Node.js tests & self-hosted deployments without Durable Objects
let LOCAL_CAREER_BRAIN_FALLBACK = null;

function getLocalFallbackInstance(env) {
  if (!LOCAL_CAREER_BRAIN_FALLBACK) {
    LOCAL_CAREER_BRAIN_FALLBACK = new BoliviaCareerBrainDO(null, env || {});
  } else if (env) {
    LOCAL_CAREER_BRAIN_FALLBACK.env = env;
  }
  return LOCAL_CAREER_BRAIN_FALLBACK;
}

/**
 * Syncs a mutated fallback record to D1 `career_brain_fallback` when DO is absent but D1 is bound.
 */
async function mirrorToD1Fallback(env, docId, docType, payload) {
  if (!env || !env.DB || typeof env.DB.prepare !== 'function') return;
  try {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO career_brain_fallback (doc_id, doc_type, payload_json, updated_at)
       VALUES (?, ?, ?, ?)`
    )
      .bind(docId, docType, JSON.stringify(payload), new Date().toISOString())
      .run();
  } catch {
    // Ignore optional fallback mirror error
  }
}

/**
 * Unified Career Brain client:
 *   - Routes to `env.CAREER_BRAIN` SQLite Durable Object when bound on Cloudflare Workers
 *   - Seamlessly falls back to in-process `BoliviaCareerBrainDO` (+ optional D1 mirror) otherwise.
 */
export function getCareerBrainClient(env = {}) {
  const hasDO = Boolean(
    env &&
    env.CAREER_BRAIN &&
    typeof env.CAREER_BRAIN.idFromName === 'function' &&
    typeof env.CAREER_BRAIN.get === 'function'
  );

  const callDO = async (path, method = 'POST', payload = null) => {
    const id = env.CAREER_BRAIN.idFromName(DEFAULT_DO_INSTANCE_NAME);
    const stub = env.CAREER_BRAIN.get(id);
    const resp = await stub.fetch(`https://career-brain.internal${path}`, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify(payload || {}) : undefined
    });
    const data = await resp.json();
    if (!resp.ok || data.ok === false) {
      throw new Error(data.error || `CareerBrainDO request failed (${resp.status})`);
    }
    return data;
  };

  return {
    isDurableObject: hasDO,

    async lookupEmployerRealityBatch(items) {
      if (hasDO) {
        try {
          const res = await callDO('/internal/lookup-batch', 'POST', { items });
          return res.results || {};
        } catch {
          // Fall back cleanly
        }
      }
      return getLocalFallbackInstance(env).lookupEmployerRealityBatch(items);
    },

    async compileBoliviaContext(job, options = {}) {
      if (hasDO) {
        try {
          return await callDO('/internal/compile-context', 'POST', { job, options });
        } catch {
          // Fall back cleanly
        }
      }
      return getLocalFallbackInstance(env).compileBoliviaContext(job, options);
    },

    async upsertEmployerReality(payload) {
      if (hasDO) {
        return await callDO('/internal/upsert-employer', 'POST', payload);
      }
      const res = await getLocalFallbackInstance(env).upsertEmployerReality(payload);
      await mirrorToD1Fallback(env, res.entity_id, 'entity', payload);
      return res;
    },

    async upsertBoliviaPlaybook(payload) {
      if (hasDO) {
        return await callDO('/internal/upsert-playbook', 'POST', payload);
      }
      const res = await getLocalFallbackInstance(env).upsertBoliviaPlaybook(payload);
      await mirrorToD1Fallback(env, res.playbook_id, 'playbook', payload);
      return res;
    },

    async recordIntelConflict(payload) {
      if (hasDO) {
        return await callDO('/internal/record-conflict', 'POST', payload);
      }
      return getLocalFallbackInstance(env).recordIntelConflict(payload);
    },

    async inspectStatus() {
      if (hasDO) {
        try {
          return await callDO('/internal/status', 'GET');
        } catch {
          // Fall back cleanly
        }
      }
      return getLocalFallbackInstance(env).inspectStatus();
    }
  };
}
