/**
 * Autonomous Direct ATS Source Discovery & AI-Managed Background Promotion Engine (v6.1.0)
 * 100% Air-Gapped inside scout-analyst-pipeline (ADR-06 Zero-PII & ADR-08 Separation).
 *
 * Promotion is an internal background mechanism managed autonomously by `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
 * grounded in the 3-layer memory stack:
 *   - Layer 1 (D1 `bolivia-remote-jobs-db`): `discovered_sources`, active category distribution, `job_sightings`
 *   - Layer 2 (`BoliviaCareerBrainDO` SQLite KG): known Bolivia-friendly employers, payout rails, intel conflicts
 *   - Layer 3 (Workers AI Llama 3.3 70B): evaluates probed ATS yield, Spanish coverage, category scarcity, and
 *     employer trust to decide `PROMOTE | STAGE | REJECT | COOLDOWN` under hard deterministic safety guardrails.
 */

import {
  ATS_PROVIDERS,
  buildAtsCandidateRecord,
  extractAtsCandidatesFromItems,
  isAllowedAtsApiUrl,
  parseAtsResponse
} from './ats_adapters.js';
import { fetchWithTimeout, stripHtml } from './scanner.js';
import {
  checkBoliviaRemoteEligibility,
  detectOfferAttributes
} from './evaluator.js';
import { getCareerBrainClient } from './career_brain_do.js';
import { WORKERS_AI_MODEL, extractCompensationUsd } from './ai_enricher.js';

const COOLDOWN_SECONDS = 14 * 86400; // 14-day cooldown for 404/0-yield candidates
const ZERO_YIELD_DEMOTE_THRESHOLD = 10;

/**
 * Underrepresented non-DevOps categories prioritized to balance the 25-category catalog.
 */
const HIGH_SCARCITY_CATEGORIES = new Set([
  'virtual_assistant',
  'customer_support',
  'operations_coord',
  'sales_bdr',
  'marketing_content',
  'hr_recruiting',
  'finance_accounting',
  'design_media',
  'languages_translation',
  'legal_compliance',
  'healthcare',
  'education',
  'product_mgmt',
  'ecommerce_logistics',
  'technical_writing',
  'customer_success',
  'banking_fintech'
]);

/**
 * High-signal priority ATS seed candidates aligned with BoliviaCareerBrainDO employers
 * (probed gradually during cron cycles, 2-3 per tick).
 */
export const PRIORITY_BOLIVIA_ATS_SEEDS = [
  { provider: 'ashby', slug: 'deel', companyName: 'Deel', domain: 'deel.com' },
  { provider: 'greenhouse', slug: 'gitlab', companyName: 'GitLab', domain: 'gitlab.com' },
  { provider: 'greenhouse', slug: 'canonical', companyName: 'Canonical', domain: 'canonical.com' },
  { provider: 'greenhouse', slug: 'automattic', companyName: 'Automattic', domain: 'automattic.com' },
  { provider: 'ashby', slug: 'zapier', companyName: 'Zapier', domain: 'zapier.com' },
  { provider: 'ashby', slug: 'remote', companyName: 'Remote.com', domain: 'remote.com' },
  { provider: 'greenhouse', slug: 'cloudflare', companyName: 'Cloudflare', domain: 'cloudflare.com' },
  { provider: 'ashby', slug: 'supabase', companyName: 'Supabase', domain: 'supabase.com' },
  { provider: 'ashby', slug: 'posthog', companyName: 'PostHog', domain: 'posthog.com' },
  { provider: 'ashby', slug: 'linear', companyName: 'Linear', domain: 'linear.app' },
  { provider: 'greenhouse', slug: 'toptal', companyName: 'Toptal', domain: 'toptal.com' },
  { provider: 'greenhouse', slug: 'doist', companyName: 'Doist', domain: 'doist.com' },
  { provider: 'lever', slug: 'ontop', companyName: 'Ontop', domain: 'getontop.com' },
  { provider: 'greenhouse', slug: 'airtm', companyName: 'AirTM', domain: 'airtm.com' },
  { provider: 'greenhouse', slug: 'payoneer', companyName: 'Payoneer', domain: 'payoneer.com' },
  { provider: 'greenhouse', slug: 'scaleai', companyName: 'Scale AI', domain: 'scale.com' },
  { provider: 'ashby', slug: 'mercor', companyName: 'Mercor', domain: 'mercor.com' },
  { provider: 'greenhouse', slug: 'invisibletechnologies', companyName: 'Invisible Technologies', domain: 'invisible.co' },
  { provider: 'greenhouse', slug: 'bairesdev', companyName: 'BairesDev', domain: 'bairesdev.com' },
  { provider: 'workable', slug: 'virtuallatinos', companyName: 'Virtual Latinos', domain: 'virtuallatinos.com' }
];

// In-memory ledger mirror for local Node.js / no-D1 environments
const MEMORY_DISCOVERED_SOURCES = new Map();

function extractJsonObject(resp) {
  if (!resp) return null;
  let cand = resp;
  if (typeof resp === 'object' && !Array.isArray(resp)) {
    if ('response' in resp) cand = resp.response;
    else if ('result' in resp) cand = resp.result;
    else if (Array.isArray(resp.choices) && resp.choices[0]?.message?.content) {
      cand = resp.choices[0].message.content;
    } else {
      return resp;
    }
  }
  if (!cand) return null;
  if (typeof cand === 'object' && !Array.isArray(cand)) return cand;
  const match = String(cand).match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Computes deterministic Bolivia-focused discovery yield score (0..100):
 *   - Rewards Bolivia-eligible job count & yield ratio
 *   - Strongly rewards Spanish/bilingual roles (es-BO default)
 *   - Rewards underrepresented non-DevOps categories across the 25-category catalog
 *   - Rewards verified employer reality tier from BoliviaCareerBrainDO
 */
export function scoreDiscoveredSourceMetrics(metrics, employerReality = null) {
  const elig = Math.max(0, Number(metrics.bolivia_eligible_jobs) || 0);
  const ratio = Math.max(0, Math.min(1, Number(metrics.bolivia_yield_ratio) || 0));
  const spanish = Math.max(0, Number(metrics.spanish_jobs) || 0);
  const categories = Array.isArray(metrics.categories) ? metrics.categories : [];
  const scarceHits = categories.filter(c => HIGH_SCARCITY_CATEGORIES.has(c)).length;

  let score = 0;
  score += Math.min(35, elig * 5);
  score += Math.round(ratio * 25);
  score += Math.min(20, spanish * 8);
  score += Math.min(12, scarceHits * 4);

  const tier = employerReality && employerReality.bolivia_tier;
  if (tier === 'verified_friendly') score += 10;
  else if (tier === 'caution_friction') score -= 6;
  else if (tier === 'geo_blocked') score -= 25;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Persists or updates a `discovered_sources` row in D1 (and memory mirror).
 */
async function saveDiscoveredSourceRow(row, env) {
  MEMORY_DISCOVERED_SOURCES.set(row.candidate_id, { ...row });
  if (!env || !env.DB || typeof env.DB.prepare !== 'function') return;

  try {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO discovered_sources (
        candidate_id, company_slug, company_name, domain, ats_provider, ats_slug,
        board_url, api_url, discovered_from, status,
        total_jobs, bolivia_eligible_jobs, spanish_jobs, bolivia_yield_ratio,
        categories_csv, category_diversity, yield_score,
        ai_decision, ai_confidence, ai_rationale, sample_titles_json,
        consecutive_zero_yield, last_probed_epoch, cooldown_until_epoch,
        promoted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      row.candidate_id,
      row.company_slug,
      row.company_name,
      row.domain || '',
      row.ats_provider,
      row.ats_slug,
      row.board_url,
      row.api_url,
      row.discovered_from || '',
      row.status || 'CANDIDATE',
      Number(row.total_jobs || 0),
      Number(row.bolivia_eligible_jobs || 0),
      Number(row.spanish_jobs || 0),
      Number(row.bolivia_yield_ratio || 0),
      row.categories_csv || '',
      Number(row.category_diversity || 0),
      Number(row.yield_score || 0),
      row.ai_decision || '',
      Number(row.ai_confidence || 0),
      row.ai_rationale || '',
      row.sample_titles_json || '[]',
      Number(row.consecutive_zero_yield || 0),
      Number(row.last_probed_epoch || 0),
      Number(row.cooldown_until_epoch || 0),
      row.promoted_at || '',
      row.created_at || new Date().toISOString(),
      row.updated_at || new Date().toISOString()
    ).run();
  } catch {
    // Ignore D1 write error on minimal mocks
  }
}

/**
 * Loads all tracked discovered sources from D1 (falling back to memory mirror).
 */
export async function listDiscoveredSources(env, { status = '', limit = 50 } = {}) {
  let rows = [];
  if (env && env.DB && typeof env.DB.prepare === 'function') {
    try {
      const sql = status
        ? 'SELECT * FROM discovered_sources WHERE status = ? ORDER BY yield_score DESC, updated_at DESC LIMIT ?'
        : 'SELECT * FROM discovered_sources ORDER BY yield_score DESC, updated_at DESC LIMIT ?';
      const bound = status ? env.DB.prepare(sql).bind(status, limit) : env.DB.prepare(sql).bind(limit);
      if (bound && typeof bound.all === 'function') {
        const res = await bound.all();
        if (res && Array.isArray(res.results)) {
          rows = res.results;
          for (const r of rows) MEMORY_DISCOVERED_SOURCES.set(r.candidate_id, r);
        }
      }
    } catch {
      // Fallback to memory mirror
    }
  }
  if (rows.length === 0) {
    rows = Array.from(MEMORY_DISCOVERED_SOURCES.values())
      .filter(r => !status || r.status === status)
      .sort((a, b) => (b.yield_score || 0) - (a.yield_score || 0))
      .slice(0, limit);
  }
  return rows;
}

/**
 * Enqueues priority CareerBrain seeds + newly extracted aggregator candidates into `discovered_sources`.
 */
export async function enqueueDiscoveryCandidates(rawItems, existingPlatformIds, env) {
  const nowIso = new Date().toISOString();
  const existingRows = await listDiscoveredSources(env, { limit: 300 });
  const existingMap = new Map(existingRows.map(r => [r.candidate_id, r]));
  const queued = [];

  const maybeEnqueue = (rec) => {
    if (!rec || !rec.candidate_id) return;
    if (existingPlatformIds.has(rec.candidate_id) || existingMap.has(rec.candidate_id)) return;
    const row = {
      ...rec,
      status: 'CANDIDATE',
      total_jobs: 0,
      bolivia_eligible_jobs: 0,
      spanish_jobs: 0,
      bolivia_yield_ratio: 0,
      categories_csv: '',
      category_diversity: 0,
      yield_score: rec.discovered_from === 'career_brain_seed' ? 20 : 10,
      ai_decision: '',
      ai_confidence: 0,
      ai_rationale: '',
      sample_titles_json: '[]',
      consecutive_zero_yield: 0,
      last_probed_epoch: 0,
      cooldown_until_epoch: 0,
      promoted_at: '',
      created_at: nowIso,
      updated_at: nowIso
    };
    existingMap.set(row.candidate_id, row);
    queued.push(row);
  };

  // 1. Seed priority known Bolivia-friendly employers from Layer 2 CareerBrain
  for (const seed of PRIORITY_BOLIVIA_ATS_SEEDS) {
    const rec = buildAtsCandidateRecord({ ...seed, discoveredFrom: 'career_brain_seed' });
    maybeEnqueue(rec);
  }

  // 2. Harvest explicit ATS URLs and recurring company slugs from aggregator items
  const extracted = extractAtsCandidatesFromItems(rawItems, 8);
  for (const exp of extracted.explicit) maybeEnqueue(exp);
  for (const slugCand of extracted.slug_probes.slice(0, 12)) maybeEnqueue(slugCand);

  for (const row of queued.slice(0, 30)) {
    await saveDiscoveredSourceRow(row, env);
  }

  return queued;
}

/**
 * Probes a single allowlisted ATS JSON endpoint and evaluates its Bolivia yield.
 */
export async function probeAtsCandidate(candidate, fetchFn = fetchWithTimeout) {
  if (!candidate || !isAllowedAtsApiUrl(candidate.api_url, candidate.ats_provider)) {
    return { ok: false, reason: 'disallowed_ats_host', jobs: [], eligible_jobs: [], geo_blocked_count: 0 };
  }

  let resp;
  try {
    resp = await fetchFn(candidate.api_url, 7500);
  } catch {
    return { ok: false, reason: 'network_error', http_status: 0, jobs: [], eligible_jobs: [], geo_blocked_count: 0 };
  }

  if (!resp || !resp.ok || !resp.text) {
    return { ok: false, reason: `http_${resp ? resp.status : 0}`, http_status: resp ? resp.status : 0, jobs: [], eligible_jobs: [], geo_blocked_count: 0 };
  }

  const syntheticPlatform = {
    id: candidate.candidate_id,
    name: candidate.company_name,
    domain: candidate.domain,
    url: candidate.board_url,
    feed_url: candidate.api_url,
    type: 'ats_json',
    ats_provider: candidate.ats_provider,
    ats_slug: candidate.ats_slug,
    category: 'Empresas Directas (ATS)',
    track: 'Track F: Curated Remote-First & WFA Job Boards'
  };

  const allJobs = parseAtsResponse(candidate.ats_provider, resp.text, syntheticPlatform);
  const eligibleJobs = [];
  let geoBlockedCount = 0;
  let spanishJobs = 0;
  const categorySet = new Set();
  const sampleComp = [];

  for (const job of allJobs) {
    const bol = checkBoliviaRemoteEligibility(job);
    if (bol.eligible) {
      const attrs = detectOfferAttributes(job);
      if ((attrs.languages || []).includes('es')) spanishJobs++;
      for (const c of (attrs.categories || [])) categorySet.add(c);
      const comp = extractCompensationUsd(job);
      if (comp && sampleComp.length < 3) sampleComp.push(comp);
      eligibleJobs.push(job);
    } else {
      geoBlockedCount++;
    }
  }

  const totalJobs = allJobs.length;
  const yieldRatio = totalJobs > 0 ? Number((eligibleJobs.length / totalJobs).toFixed(3)) : 0;

  return {
    ok: true,
    http_status: resp.status,
    total_jobs: totalJobs,
    bolivia_eligible_jobs: eligibleJobs.length,
    geo_blocked_count: geoBlockedCount,
    spanish_jobs: spanishJobs,
    bolivia_yield_ratio: yieldRatio,
    categories: Array.from(categorySet),
    sample_titles: eligibleJobs.slice(0, 6).map(j => `${j.title} (${j.location})`),
    sample_comp: sampleComp,
    jobs: allJobs,
    eligible_jobs: eligibleJobs
  };
}

/**
 * AI-Managed Background Promotion Gate using `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
 * grounded in Layer 1 (D1 yield/category balance) + Layer 2 (`BoliviaCareerBrainDO` employer reality).
 */
export async function evaluateSourcePromotionWithAI(candidate, probeResult, employerReality, env) {
  const yieldScore = scoreDiscoveredSourceMetrics(probeResult, employerReality);

  // Hard deterministic pre-checks (SSRF & zero-yield protection that AI cannot bypass)
  if (!probeResult.ok || probeResult.total_jobs === 0) {
    return {
      decision: 'COOLDOWN',
      confidence: 0.95,
      yield_score: 0,
      rationale_es: `Endpoint ATS sin vacantes activas o no disponible (${probeResult.reason || 'empty'}). En enfriamiento 14 días.`
    };
  }
  if (probeResult.bolivia_eligible_jobs === 0) {
    return {
      decision: probeResult.geo_blocked_count >= 5 ? 'REJECT' : 'COOLDOWN',
      confidence: 0.92,
      yield_score: 0,
      rationale_es: `0 de ${probeResult.total_jobs} vacantes son elegibles desde Bolivia (${probeResult.geo_blocked_count} restringidas por país/W-2).`
    };
  }

  const isVerifiedEmployer = employerReality && employerReality.bolivia_tier === 'verified_friendly';
  const meetsHardPromotionFloor =
    isAllowedAtsApiUrl(candidate.api_url, candidate.ats_provider) &&
    (probeResult.bolivia_eligible_jobs >= 2 ||
      (probeResult.bolivia_eligible_jobs >= 1 && (probeResult.spanish_jobs >= 1 || isVerifiedEmployer))) &&
    (probeResult.bolivia_yield_ratio >= 0.12 || probeResult.bolivia_eligible_jobs >= 5);

  // Deterministic baseline decision when env.AI is unbound
  let decision = meetsHardPromotionFloor && yieldScore >= 32
    ? 'PROMOTE'
    : (probeResult.bolivia_eligible_jobs >= 1 ? 'STAGE' : 'COOLDOWN');
  let confidence = meetsHardPromotionFloor ? Math.min(0.95, 0.72 + yieldScore / 400) : 0.75;
  let rationaleEs =
    `${candidate.company_name} (${ATS_PROVIDERS[candidate.ats_provider]?.label || candidate.ats_provider}): ` +
    `${probeResult.bolivia_eligible_jobs}/${probeResult.total_jobs} vacantes elegibles para Bolivia ` +
    `(${Math.round(probeResult.bolivia_yield_ratio * 100)}% rendimiento, ${probeResult.spanish_jobs} en español, puntaje ${yieldScore}/100).`;

  if (env && env.AI && typeof env.AI.run === 'function') {
    const sysPrompt =
      'Eres el gestor autónomo de fuentes de Bolivia Remote Work (v6.1.0). ' +
      'Tu objetivo es decidir en segundo plano si un tablero ATS directo debe promoverse a monitoreo activo para candidatos 100% remotos desde Bolivia (UTC-4). ' +
      'Prioriza fuentes con vacantes elegibles reales para Bolivia/LATAM/Global, presencia de español o categorías diversas más allá de DevOps, y empleadores confiables en <employer_reality>. ' +
      'Devuelve ÚNICAMENTE JSON válido: {"decision":"PROMOTE"|"STAGE"|"REJECT"|"COOLDOWN","confidence":0.0-1.0,"rationale_es":string}.';

    const userPrompt =
      `<discovery_context>\n` +
      `  <candidate company="${stripHtml(candidate.company_name)}" provider="${candidate.ats_provider}" slug="${candidate.ats_slug}" />\n` +
      `  <metrics total_jobs="${probeResult.total_jobs}" bolivia_eligible="${probeResult.bolivia_eligible_jobs}" spanish_jobs="${probeResult.spanish_jobs}" yield_ratio="${probeResult.bolivia_yield_ratio}" yield_score="${yieldScore}" categories="${probeResult.categories.join(', ')}" />\n` +
      `  <employer_reality matched="${Boolean(employerReality && employerReality.matched)}" tier="${(employerReality && employerReality.bolivia_tier) || 'open_global'}" payout_rails="${((employerReality && employerReality.payout_rails) || []).join(', ')}" />\n` +
      `  <sample_jobs>${stripHtml(probeResult.sample_titles.join(' | ')).slice(0, 600)}</sample_jobs>\n` +
      `</discovery_context>`;

    try {
      const resp = await env.AI.run(WORKERS_AI_MODEL, {
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 220,
        temperature: 0.1
      });
      const parsed = extractJsonObject(resp);
      if (parsed && ['PROMOTE', 'STAGE', 'REJECT', 'COOLDOWN'].includes(parsed.decision)) {
        const aiConf = Math.max(0, Math.min(1, Number(parsed.confidence ?? confidence)));
        // Enforce hard deterministic promotion safety floor
        if (parsed.decision === 'PROMOTE' && (!meetsHardPromotionFloor || aiConf < 0.70)) {
          decision = 'STAGE';
          confidence = aiConf;
        } else {
          decision = parsed.decision;
          confidence = aiConf;
        }
        if (typeof parsed.rationale_es === 'string' && parsed.rationale_es.trim()) {
          rationaleEs = stripHtml(parsed.rationale_es.trim()).slice(0, 260);
        }
      }
    } catch {
      // Keep deterministic baseline decision
    }
  }

  return {
    decision,
    confidence: Number(confidence.toFixed(2)),
    yield_score: yieldScore,
    rationale_es: rationaleEs
  };
}

/**
 * Converts a promoted discovered source into a monitored platform entry (`custom_platforms`).
 */
export function buildPromotedPlatformRecord(candidate, probeResult, decisionOut) {
  const providerLabel = (ATS_PROVIDERS[candidate.ats_provider] && ATS_PROVIDERS[candidate.ats_provider].label) || candidate.ats_provider;
  const nowIso = new Date().toISOString();
  const spanishBadge = probeResult.spanish_jobs > 0 ? ` · ${probeResult.spanish_jobs} en español` : '';

  return {
    id: candidate.candidate_id,
    name: candidate.company_name,
    category: 'Empresas Directas (ATS)',
    track: 'Track F: Curated Remote-First & WFA Job Boards',
    type: 'ats_json',
    enabled: true,
    domain: candidate.domain || new URL(candidate.board_url).hostname.replace(/^www\./, ''),
    url: candidate.board_url,
    feed_url: candidate.api_url,
    ats_provider: candidate.ats_provider,
    ats_slug: candidate.ats_slug,
    discovered_by: 'ai_autonomous',
    active_bolivia_jobs: probeResult.bolivia_eligible_jobs,
    spanish_jobs: probeResult.spanish_jobs,
    consecutive_zero_yield: 0,
    last_yield_at: nowIso,
    contract_caveat: 'fractional_or_fulltime',
    notes: `ATS Directo (${providerLabel}) verificado automáticamente: ${probeResult.bolivia_eligible_jobs} vacantes activas para Bolivia${spanishBadge}. ${decisionOut.rationale_es}`.slice(0, 260),
    added_at: nowIso
  };
}

/**
 * Self-healing lifecycle pass: updates consecutive_zero_yield on promoted ATS platforms
 * and cools down dormant/404 boards so Monitored Platforms stays fresh and high-yield.
 */
export async function applyPromotedSourceHealth(state, platformYields, env, nowEpochSec = Math.floor(Date.now() / 1000)) {
  if (!Array.isArray(platformYields) || platformYields.length === 0) return { demoted: [] };
  const demoted = [];
  const yieldById = new Map(platformYields.map(y => [y.platform_id, y]));

  for (const plat of (state.platforms || [])) {
    if (!plat || plat.type !== 'ats_json') continue;
    const y = yieldById.get(plat.id);
    if (!y) continue;

    const isHardDead = y.http_status === 404 || y.http_status === 410;
    if (y.eligible > 0) {
      plat.active_bolivia_jobs = y.eligible;
      plat.consecutive_zero_yield = 0;
      plat.last_yield_at = new Date(nowEpochSec * 1000).toISOString();
    } else {
      plat.consecutive_zero_yield = (Number(plat.consecutive_zero_yield) || 0) + (isHardDead ? ZERO_YIELD_DEMOTE_THRESHOLD : 1);
      if (plat.consecutive_zero_yield >= ZERO_YIELD_DEMOTE_THRESHOLD) {
        plat.enabled = false;
        demoted.push(plat.id);
        const existing = MEMORY_DISCOVERED_SOURCES.get(plat.id);
        if (existing) {
          await saveDiscoveredSourceRow({
            ...existing,
            status: 'COOLDOWN',
            consecutive_zero_yield: plat.consecutive_zero_yield,
            cooldown_until_epoch: nowEpochSec + COOLDOWN_SECONDS,
            updated_at: new Date(nowEpochSec * 1000).toISOString()
          }, env);
        }
      }
    }
  }
  return { demoted };
}

/**
 * Executes one bounded background Autonomous Source Discovery & AI Promotion cycle:
 *   1. Enqueues CareerBrain priority seeds + newly harvested aggregator ATS candidates
 *   2. Probes up to `maxProbes` (default 3) due candidates against allowlisted ATS JSON endpoints
 *   3. Invokes AI-managed promotion gate grounded in BoliviaCareerBrainDO + D1 yield
 *   4. Promotes high-yield direct ATS boards into `state.platforms` (`custom_platforms`),
 *      ingests their Bolivia-eligible postings, and performs two-way KG/conflict sync.
 */
export async function runAutonomousDiscoveryCycle(state, env, options = {}) {
  const maxProbes = Math.min(Math.max(Number(options.maxProbes) || 3, 1), 6);
  const fetchFn = options.fetchFn || fetchWithTimeout;
  const rawItems = Array.isArray(options.rawScannedItems) ? options.rawScannedItems : [];
  const nowEpochSec = Math.floor(Date.now() / 1000);
  const nowIso = new Date(nowEpochSec * 1000).toISOString();

  const existingPlatformIds = new Set((state.platforms || []).map(p => p.id));
  await enqueueDiscoveryCandidates(rawItems, existingPlatformIds, env);

  const allCandidates = await listDiscoveredSources(env, { limit: 250 });
  const dueCandidates = allCandidates
    .filter(c => {
      if (!c || existingPlatformIds.has(c.candidate_id)) return false;
      if (c.status === 'PROMOTED' || c.status === 'REJECTED') return false;
      if (c.status === 'COOLDOWN' && Number(c.cooldown_until_epoch || 0) > nowEpochSec) return false;
      return true;
    })
    .sort((a, b) => {
      // Prioritize explicit ATS links & CareerBrain seeds not yet probed
      const aUnprobed = Number(a.last_probed_epoch || 0) === 0 ? 1 : 0;
      const bUnprobed = Number(b.last_probed_epoch || 0) === 0 ? 1 : 0;
      if (bUnprobed !== aUnprobed) return bUnprobed - aUnprobed;
      return (Number(b.yield_score) || 0) - (Number(a.yield_score) || 0);
    })
    .slice(0, maxProbes);

  const brain = getCareerBrainClient(env);
  const promotedPlatforms = [];
  const discoveredOpportunities = [];
  const probedSummary = [];

  for (const cand of dueCandidates) {
    const probeRes = await probeAtsCandidate(cand, fetchFn);
    const realityMap = await brain.lookupEmployerRealityBatch([
      { job_hash: cand.candidate_id, company: cand.company_name, domain: cand.domain }
    ]).catch(() => ({}));
    const employerReality = realityMap[cand.candidate_id] || null;

    // Two-way conflict detection: if a verified_friendly company flipped to 0 Bolivia + >=8 geo-blocked
    if (
      probeRes.ok &&
      employerReality &&
      employerReality.matched &&
      employerReality.bolivia_tier === 'verified_friendly' &&
      probeRes.bolivia_eligible_jobs === 0 &&
      probeRes.geo_blocked_count >= 8
    ) {
      await brain.recordIntelConflict({
        entity_id: employerReality.entity_id,
        conflict_type: 'ats_geo_restriction_drift',
        evidence: `Direct ${cand.ats_provider} board (${cand.ats_slug}) returned 0 Bolivia-eligible jobs and ${probeRes.geo_blocked_count} geo-restricted postings.`
      }).catch(() => {});
    }

    const aiEval = await evaluateSourcePromotionWithAI(cand, probeRes, employerReality, env);
    let nextStatus = 'COOLDOWN';
    let cooldownUntil = nowEpochSec + COOLDOWN_SECONDS;
    let promotedAt = cand.promoted_at || '';

    if (aiEval.decision === 'PROMOTE') {
      nextStatus = 'PROMOTED';
      cooldownUntil = 0;
      promotedAt = nowIso;

      const platRecord = buildPromotedPlatformRecord(cand, probeRes, aiEval);
      const existingIdx = (state.platforms || []).findIndex(p => p.id === platRecord.id);
      if (existingIdx >= 0) {
        state.platforms[existingIdx] = platRecord;
      } else {
        state.platforms.unshift(platRecord);
      }
      promotedPlatforms.push(platRecord);
      discoveredOpportunities.push(...probeRes.eligible_jobs);

      // Two-way Knowledge Graph enrichment in BoliviaCareerBrainDO
      await brain.upsertEmployerReality({
        entity_id: (employerReality && employerReality.matched && employerReality.entity_id) || cand.company_slug,
        canonical_name: cand.company_name,
        entity_type: 'company',
        domain: cand.domain,
        bolivia_tier: (employerReality && employerReality.matched && employerReality.bolivia_tier) || 'open_global',
        confidence: Math.max(Number(employerReality?.confidence || 0.78), aiEval.confidence),
        typical_comp: (probeRes.sample_comp && probeRes.sample_comp[0]) || (employerReality?.typical_comp || ''),
        note_es: (employerReality && employerReality.note_es) || `Tablero ATS directo (${cand.ats_provider}) verificado con ${probeRes.bolivia_eligible_jobs} vacantes remotas elegibles para Bolivia.`,
        validator: 'ai_autonomous_discovery'
      }).catch(() => {});
    } else if (aiEval.decision === 'STAGE') {
      nextStatus = 'STAGED';
      cooldownUntil = nowEpochSec + 3 * 86400; // Re-evaluate staged boards in 3 days
    } else if (aiEval.decision === 'REJECT') {
      nextStatus = 'REJECTED';
      cooldownUntil = nowEpochSec + 30 * 86400;
    }

    const updatedRow = {
      ...cand,
      status: nextStatus,
      total_jobs: probeRes.total_jobs || 0,
      bolivia_eligible_jobs: probeRes.bolivia_eligible_jobs || 0,
      spanish_jobs: probeRes.spanish_jobs || 0,
      bolivia_yield_ratio: probeRes.bolivia_yield_ratio || 0,
      categories_csv: (probeRes.categories || []).join(','),
      category_diversity: (probeRes.categories || []).length,
      yield_score: aiEval.yield_score,
      ai_decision: aiEval.decision,
      ai_confidence: aiEval.confidence,
      ai_rationale: aiEval.rationale_es,
      sample_titles_json: JSON.stringify(probeRes.sample_titles || []),
      consecutive_zero_yield: (probeRes.bolivia_eligible_jobs || 0) > 0 ? 0 : (Number(cand.consecutive_zero_yield || 0) + 1),
      last_probed_epoch: nowEpochSec,
      cooldown_until_epoch: cooldownUntil,
      promoted_at: promotedAt,
      updated_at: nowIso
    };
    await saveDiscoveredSourceRow(updatedRow, env);
    probedSummary.push({
      candidate_id: cand.candidate_id,
      company: cand.company_name,
      provider: cand.ats_provider,
      status: nextStatus,
      bolivia_eligible_jobs: updatedRow.bolivia_eligible_jobs,
      spanish_jobs: updatedRow.spanish_jobs,
      yield_score: updatedRow.yield_score,
      ai_decision: aiEval.decision
    });
  }

  return {
    ok: true,
    probed_count: dueCandidates.length,
    promoted_count: promotedPlatforms.length,
    discovered_opportunities_count: discoveredOpportunities.length,
    promoted_platforms: promotedPlatforms,
    discovered_opportunities: discoveredOpportunities,
    probed: probedSummary
  };
}
