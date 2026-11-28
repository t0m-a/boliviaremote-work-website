/**
 * Nightly Sleep Cycle — Market Pulse Synthesis & Two-Stage Policy Contradiction Watchdog (v6.2.0)
 * Runs at 03:00 AM America/La_Paz (07:00 UTC) via Cloudflare Cron Trigger (`0 7 * * *`)
 * and can also be inspected/triggered via the authenticated `/mcp` server.
 *
 * Strictly air-gapped (ADR-08) and Zero-PII (ADR-06):
 *   1. Deterministic Market Pulse aggregation from live D1/state catalog (zero hallucinated stats)
 *   2. Grounded Spanish executive digest using `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
 *      with instant deterministic offline fallback
 *   3. Two-Stage, Windowed, Auto-Healing Employer Policy Contradiction Watchdog:
 *        - Stage 1 (30+ days sustained drift): logs internal `intel_conflicts` + mild confidence decay
 *        - Stage 2 (60+ days sustained drift): adds neutral observational telemetry note only
 *        - Auto-Healing: resolves open conflicts and restores confidence once >= 2 verified
 *          Bolivia/LATAM-eligible postings reappear.
 */

import {
  POSITION_CATEGORIES,
  checkBoliviaRemoteEligibility,
  detectOfferAttributes
} from './evaluator.js';
import { normalizeCompanySlug } from './privacy_guard.js';
import { getCareerBrainClient } from './career_brain_do.js';

const SLEEP_LLM_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export const WATCHDOG_CONFIG = Object.freeze({
  STAGE1_DRIFT_DAYS: 30,
  STAGE2_DRIFT_DAYS: 60,
  MIN_SAMPLE_POSTINGS: 5,
  STAGE2_MIN_AGGREGATOR_POSTINGS: 10,
  MAX_ELIGIBLE_RATIO: 0.10,
  MIN_GEO_BLOCKED_RATIO: 0.80,
  AUTO_HEAL_ELIGIBLE_COUNT: 2,
  AUTO_HEAL_WINDOW_DAYS: 30
});

const CATEGORY_LABEL_MAP = new Map(
  POSITION_CATEGORIES.map(c => [c.id, { es: c.label_es, en: c.label_en }])
);

/**
 * Parses a normalized monthly USD midpoint from `compensation_usd` strings like:
 *   "$3,500 - $5,500/mo", "$60,000 - $90,000/yr", "$25 - $40/hr", "$80k - $100k USD"
 */
export function parseMonthlyUsdMidpoint(compStr) {
  const s = String(compStr || '').trim();
  if (!s) return null;

  const isHourly = /\/\s*(hr|hour|hora|h)\b|per\s+hour|por\s+hora/i.test(s);
  const isAnnual = /\/\s*(yr|year|año|ano|annual|anual)\b|per\s+year|\bk\b/i.test(s);
  const isMonthly = /\/\s*(mo|month|mes)\b|per\s+month|mensual/i.test(s);

  const nums = [];
  const regex = /\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?/gi;
  let m;
  while ((m = regex.exec(s)) !== null) {
    let val = Number(m[1].replace(/,/g, ''));
    if (!Number.isFinite(val) || val <= 0) continue;
    if (m[2]) val *= 1000;
    nums.push(val);
  }
  if (nums.length === 0) return null;

  const avg = nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0];
  let monthly = avg;
  if (isHourly) {
    if (avg < 5 || avg > 250) return null;
    monthly = avg * 160;
  } else if (isAnnual || (!isMonthly && avg >= 18000)) {
    if (avg < 12000 || avg > 400000) return null;
    monthly = avg / 12;
  } else {
    if (avg < 300 || avg > 25000) return null;
  }

  return Math.round(monthly);
}

function computePercentile(sortedNums, p) {
  if (!sortedNums.length) return null;
  const idx = (sortedNums.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return Math.round(sortedNums[lo]);
  return Math.round(sortedNums[lo] + (sortedNums[hi] - sortedNums[lo]) * (idx - lo));
}

/**
 * Formats YYYY-MM-DD in America/La_Paz (UTC-4, no DST).
 */
export function getBoliviaDateString(nowMs = Date.now()) {
  const boDate = new Date(nowMs - 4 * 3600 * 1000);
  return boDate.toISOString().slice(0, 10);
}

/**
 * Deterministically computes Market Pulse metrics from the active Bolivia-eligible catalog
 * and active monitored platforms. Never fabricates statistics.
 */
export function computeMarketPulseMetrics(opportunities = [], platforms = [], nowMs = Date.now()) {
  const eligibleOpps = (opportunities || []).filter(o => o && checkBoliviaRemoteEligibility(o).eligible);
  const activePlatforms = (platforms || []).filter(p => p && p.enabled !== false);
  const directAtsPlatforms = activePlatforms.filter(p => p.type === 'ats_json' || String(p.id || '').startsWith('ats_'));

  const cutoff24h = nowMs - 24 * 3600 * 1000;
  const cutoff7d = nowMs - 7 * 24 * 3600 * 1000;

  let newLast24h = 0;
  let newLast7d = 0;
  let esCount = 0;
  let enCount = 0;
  let bilingualCount = 0;
  let ghostWatchCount = 0;
  let ghostHighCount = 0;

  const esCatCounts = new Map();
  const enCatCounts = new Map();
  const monthlyUsdRates = [];

  for (const opp of eligibleOpps) {
    const discoveredMs = Date.parse(opp.discovered_at || opp.published_at || '') || 0;
    const firstSeenMs = Number(opp.first_seen_epoch || 0) * 1000;
    const effectiveMs = firstSeenMs || discoveredMs;
    if (effectiveMs >= cutoff24h) newLast24h++;
    if (effectiveMs >= cutoff7d) newLast7d++;

    const attrs = detectOfferAttributes(opp);
    const langs = Array.isArray(attrs.languages)
      ? attrs.languages
      : (Array.isArray(attrs.detected_languages) ? attrs.detected_languages : []);
    const hasEs = langs.includes('es') || String(opp.lang_mask || '').includes('es');
    const hasEn = langs.includes('en') || String(opp.lang_mask || '').includes('en');
    if (hasEs) esCount++;
    if (hasEn) enCount++;
    if (hasEs && hasEn) bilingualCount++;

    const rawCats = Array.isArray(attrs.categories) && attrs.categories.length > 0
      ? attrs.categories
      : (Array.isArray(attrs.detected_categories) && attrs.detected_categories.length > 0
        ? attrs.detected_categories
        : String(opp.categories_csv || '').split(',').map(c => c.trim()).filter(Boolean));
    const cats = rawCats;

    for (const catId of cats) {
      if (!CATEGORY_LABEL_MAP.has(catId)) continue;
      if (hasEs) esCatCounts.set(catId, (esCatCounts.get(catId) || 0) + 1);
      if (hasEn) enCatCounts.set(catId, (enCatCounts.get(catId) || 0) + 1);
    }

    if (opp.ghost_risk === 'high') ghostHighCount++;
    else if (opp.ghost_risk === 'watch') ghostWatchCount++;

    const monthlyUsd = parseMonthlyUsdMidpoint(opp.compensation_usd || '');
    if (monthlyUsd !== null) monthlyUsdRates.push(monthlyUsd);
  }

  const totalEligible = eligibleOpps.length;
  const formatTopCats = (map, denom) => {
    const safeDenom = Math.max(1, denom);
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, count]) => ({
        id,
        label_es: CATEGORY_LABEL_MAP.get(id)?.es || id,
        label_en: CATEGORY_LABEL_MAP.get(id)?.en || id,
        count,
        share_pct: Math.round((count / safeDenom) * 100)
      }));
  };

  monthlyUsdRates.sort((a, b) => a - b);
  const compStats = monthlyUsdRates.length >= 5
    ? {
        sufficient_sample: true,
        sample_size: monthlyUsdRates.length,
        median_monthly_usd: computePercentile(monthlyUsdRates, 0.5),
        p25_monthly_usd: computePercentile(monthlyUsdRates, 0.25),
        p75_monthly_usd: computePercentile(monthlyUsdRates, 0.75)
      }
    : {
        sufficient_sample: false,
        sample_size: monthlyUsdRates.length,
        median_monthly_usd: null,
        p25_monthly_usd: null,
        p75_monthly_usd: null
      };

  const newlyPromotedCompanies = directAtsPlatforms
    .slice()
    .sort((a, b) => Date.parse(b.added_at || 0) - Date.parse(a.added_at || 0))
    .slice(0, 8)
    .map(p => ({
      id: p.id,
      name: p.name,
      url: p.url,
      ats_provider: p.ats_provider || '',
      active_bolivia_jobs: Number(p.active_bolivia_jobs || 0),
      spanish_jobs: Number(p.spanish_jobs || 0),
      added_at: p.added_at || ''
    }));

  return {
    pulse_date: getBoliviaDateString(nowMs),
    generated_at: new Date(nowMs).toISOString(),
    schedule_label_es: 'Síntesis nocturna · 03:00 AM Bolivia (UTC-4)',
    total_active_eligible: totalEligible,
    new_last_24h: newLast24h,
    new_last_7d: newLast7d,
    active_platforms_count: activePlatforms.length,
    direct_ats_platforms_count: directAtsPlatforms.length,
    language_split: {
      es_count: esCount,
      en_count: enCount,
      bilingual_count: bilingualCount,
      es_share_pct: totalEligible > 0 ? Math.round((esCount / totalEligible) * 100) : 0,
      en_share_pct: totalEligible > 0 ? Math.round((enCount / totalEligible) * 100) : 0
    },
    top_categories_es: formatTopCats(esCatCounts, esCount),
    top_categories_en: formatTopCats(enCatCounts, enCount),
    compensation_usd_monthly: compStats,
    newly_promoted_companies: newlyPromotedCompanies,
    ghost_job_health: {
      watch_count: ghostWatchCount,
      high_count: ghostHighCount
    }
  };
}

/**
 * Deterministic Spanish Market Pulse narrative fallback (strictly grounded in computed metrics).
 */
export function buildDeterministicPulseNarrative(metrics) {
  const m = metrics || {};
  const ls = m.language_split || { es_count: 0, en_count: 0, es_share_pct: 0, en_share_pct: 0 };
  const topEs = (m.top_categories_es || [])[0];
  const topEn = (m.top_categories_en || [])[0];
  const comp = m.compensation_usd_monthly || {};
  const atsList = m.newly_promoted_companies || [];

  const headlineEs = `Pulso del Mercado Remoto desde Bolivia (${m.pulse_date || ''}): ${m.total_active_eligible || 0} vacantes verificadas en ${m.active_platforms_count || 0} plataformas activas`;

  const compSentence = comp.sufficient_sample
    ? `Entre las ${comp.sample_size} ofertas con tarifa USD publicada, la mediana mensual observada es de $${comp.median_monthly_usd} USD (rango intercuartil $${comp.p25_monthly_usd}–$${comp.p75_monthly_usd} USD).`
    : `Actualmente solo ${comp.sample_size || 0} ofertas publican tarifa USD explícita (muestra insuficiente para reportar una mediana representativa).`;

  const summaryEs =
    `El monitoreo automático mantiene ${m.total_active_eligible || 0} oportunidades 100% remotas elegibles desde Bolivia (${m.new_last_24h || 0} incorporadas en las últimas 24 horas) a través de ${m.active_platforms_count || 0} plataformas activas (${m.direct_ats_platforms_count || 0} tableros directos ATS). ` +
    `${ls.es_count} ofertas aceptan español (${ls.es_share_pct}%) y ${ls.en_count} operan en inglés (${ls.en_share_pct}%). ${compSentence}`;

  const highlightsEs = [];
  if (topEs) {
    highlightsEs.push(`En español lidera "${topEs.label_es}" con ${topEs.count} vacantes activas (${topEs.share_pct}% de la oferta en español).`);
  }
  if (topEn) {
    highlightsEs.push(`En inglés lidera "${topEn.label_en}" con ${topEn.count} vacantes activas (${topEn.share_pct}% de la oferta en inglés).`);
  }
  if (atsList.length > 0) {
    highlightsEs.push(`Tableros directos ATS activos promovidos por IA: ${atsList.slice(0, 4).map(c => c.name).join(', ')}.`);
  }
  const ghostTotal = (m.ghost_job_health?.watch_count || 0) + (m.ghost_job_health?.high_count || 0);
  if (ghostTotal > 0) {
    highlightsEs.push(`El detector histórico vigila ${ghostTotal} vacantes con señales de re-publicación prolongada para evitar postulaciones fantasma.`);
  }

  return {
    headline_es: headlineEs,
    summary_es: summaryEs,
    highlights_es: highlightsEs.slice(0, 4),
    synthesis_mode: 'deterministic-fallback',
    model_used: 'deterministic'
  };
}

/**
 * Extracts a parsed JSON object from a Workers AI response, supporting both
 * pre-parsed JS object responses (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`),
 * raw JSON strings, and OpenAI-style `choices[0].message.content` envelopes.
 */
function extractJsonObjectFromPulseAiResponse(resp) {
  if (!resp) return null;
  if (typeof resp === 'string') {
    const m = resp.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  }
  if (typeof resp !== 'object' || Array.isArray(resp)) {
    return null;
  }

  const candidates = [];
  if ('response' in resp && resp.response != null) candidates.push(resp.response);
  if (resp.result && typeof resp.result === 'object' && 'response' in resp.result && resp.result.response != null) {
    candidates.push(resp.result.response);
  }
  if (Array.isArray(resp.choices) && resp.choices[0]?.message && 'content' in resp.choices[0].message) {
    candidates.push(resp.choices[0].message.content);
  }
  if (resp.result && Array.isArray(resp.result.choices) && resp.result.choices[0]?.message && 'content' in resp.result.choices[0].message) {
    candidates.push(resp.result.choices[0].message.content);
  }
  if (typeof resp.summary_es === 'string') {
    candidates.push(resp);
  }

  for (const cand of candidates) {
    if (!cand) continue;
    if (typeof cand === 'object' && !Array.isArray(cand)) {
      return cand;
    }
    if (typeof cand === 'string') {
      const m = cand.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          const obj = JSON.parse(m[0]);
          if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
            return obj;
          }
        } catch {
          // Try next candidate
        }
      }
    }
  }
  return null;
}

/**
 * Generates the nightly Spanish Market Pulse narrative using `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
 * strictly grounded in the pre-computed D1/catalog metrics.
 */
export async function synthesizeMarketPulseWithAI(metrics, env) {
  const fallback = buildDeterministicPulseNarrative(metrics);
  if (!env || !env.AI || typeof env.AI.run !== 'function') {
    return fallback;
  }

  const compactMetrics = {
    pulse_date: metrics.pulse_date,
    total_active_eligible: metrics.total_active_eligible,
    new_last_24h: metrics.new_last_24h,
    active_platforms_count: metrics.active_platforms_count,
    direct_ats_platforms_count: metrics.direct_ats_platforms_count,
    language_split: metrics.language_split,
    top_categories_es: (metrics.top_categories_es || []).slice(0, 5).map(c => ({ label: c.label_es, count: c.count, pct: c.share_pct })),
    top_categories_en: (metrics.top_categories_en || []).slice(0, 5).map(c => ({ label: c.label_es, count: c.count, pct: c.share_pct })),
    compensation_usd_monthly: metrics.compensation_usd_monthly,
    newly_promoted_companies: (metrics.newly_promoted_companies || []).slice(0, 5).map(c => c.name),
    ghost_job_health: metrics.ghost_job_health
  };

  try {
    const resp = await env.AI.run(SLEEP_LLM_MODEL, {
      messages: [
        {
          role: 'system',
          content:
            'Eres el analista nocturno de Bolivia Remote Work. Redacta un resumen ejecutivo claro, objetivo y útil en Español (Bolivia) basado EXCLUSIVAMENTE en las cifras JSON proporcionadas. ' +
            'REGLAS ESTRICTAS: total_active_eligible y new_last_24h son VACANTES / OFERTAS LABORALES remotas (nunca trabajadores ni candidatos); median_monthly_usd es la MEDIANA mensual en USD (nunca promedio) y p25/p75 es el rango intercuartil. ' +
            'Nunca inventes cifras, salarios ni empresas fuera del JSON. Si sufficient_sample es false, indica que la muestra salarial es insuficiente sin inventar montos. ' +
            'Sin emojis. Devuelve máximo 4 elementos en highlights_es. Responde UNICAMENTE con JSON valido: {"headline_es":"...","summary_es":"...","highlights_es":["...","...","..."]}.'
        },
        {
          role: 'user',
          content: `Metricas verificadas del dia:\n${JSON.stringify(compactMetrics)}`
        }
      ],
      max_tokens: 520,
      temperature: 0.2
    });

    const parsed = extractJsonObjectFromPulseAiResponse(resp);
    if (!parsed || typeof parsed.summary_es !== 'string' || parsed.summary_es.trim().length < 25) {
      console.error(
        '[nightly_sleep] synthesizeMarketPulseWithAI invalid payload, using deterministic fallback:',
        JSON.stringify({
          respKeys: resp && typeof resp === 'object' ? Object.keys(resp) : typeof resp,
          responseType: resp && typeof resp === 'object' ? typeof resp.response : null
        })
      );
      return fallback;
    }

    return {
      headline_es: String(parsed.headline_es || fallback.headline_es).trim().slice(0, 220),
      summary_es: String(parsed.summary_es).trim().slice(0, 900),
      highlights_es: Array.isArray(parsed.highlights_es) && parsed.highlights_es.length > 0
        ? parsed.highlights_es.map(h => String(h || '').trim()).filter(Boolean).slice(0, 4)
        : fallback.highlights_es,
      synthesis_mode: 'workers-ai-llama-3.3',
      model_used: SLEEP_LLM_MODEL
    };
  } catch (err) {
    console.error(
      '[nightly_sleep] synthesizeMarketPulseWithAI failed, using deterministic fallback:',
      err && err.message ? err.message : String(err)
    );
    return fallback;
  }
}

/**
 * Extracts per-company geo-eligibility observation batches from raw scanned items & ATS yields
 * so `BoliviaCareerBrainDO` can evaluate 30-day (Stage 1) and 60-day (Stage 2) policy drift.
 */
export function extractEmployerGeoSnapshots(rawItems = [], platformYields = [], nowEpoch = Math.floor(Date.now() / 1000)) {
  const grouped = new Map();

  const addObs = (companyName, sourceKind, eligibleDelta, blockedDelta) => {
    const slug = normalizeCompanySlug(companyName, 'company');
    if (!slug) return;
    const key = `${slug}|${sourceKind}`;
    const existing = grouped.get(key) || {
      entity_id: slug,
      source_kind: sourceKind,
      eligible_count: 0,
      geo_blocked_count: 0,
      observed_at_epoch: nowEpoch
    };
    existing.eligible_count += Number(eligibleDelta || 0);
    existing.geo_blocked_count += Number(blockedDelta || 0);
    grouped.set(key, existing);
  };

  for (const item of rawItems || []) {
    if (!item || !item.company) continue;
    const isDirectAts = String(item.platform_id || '').startsWith('ats_');
    const sourceKind = isDirectAts ? 'direct_ats' : 'aggregator';
    const check = checkBoliviaRemoteEligibility(item);
    addObs(item.company, sourceKind, check.eligible ? 1 : 0, check.eligible ? 0 : 1);
  }

  for (const y of platformYields || []) {
    if (!y || !y.ats_provider || !y.company_name) continue;
    const eligible = Number(y.eligible || 0);
    const total = Number(y.total || 0);
    const blocked = Math.max(0, total - eligible);
    if (total > 0) {
      addObs(y.company_name, 'direct_ats', eligible, blocked);
    }
  }

  return Array.from(grouped.values()).filter(r => r.eligible_count + r.geo_blocked_count > 0);
}

/**
 * Executes the 03:00 AM America/La_Paz (`07:00 UTC`) Nightly Sleep Cycle:
 *   1. Records any pending geo-observations into `BoliviaCareerBrainDO`
 *   2. Runs the Two-Stage (30d Stage 1 / 60d Stage 2) Auto-Healing Policy Contradiction Watchdog
 *   3. Computes deterministic Market Pulse metrics + Llama 3.3 70B Spanish synthesis
 *   4. Persists the Market Pulse snapshot inside `BoliviaCareerBrainDO` (and D1 fallback)
 */
export async function runNightlySleepCycle(state, env = {}, options = {}) {
  const nowMs = Number(options.nowMs || Date.now());
  const nowEpoch = Math.floor(nowMs / 1000);
  const brain = getCareerBrainClient(env);

  // 1. Record any fresh observations passed into this run
  const observations = Array.isArray(options.observations) ? options.observations : [];
  if (observations.length > 0 && typeof brain.recordEmployerGeoObservations === 'function') {
    await brain.recordEmployerGeoObservations(observations).catch(() => {});
  }

  // 2. Run Two-Stage (30d / 60d) Auto-Healing Policy Contradiction Watchdog
  let watchdogRes = { ok: true, evaluated_employers: 0, stage1_flagged: [], stage2_flagged: [], auto_healed: [] };
  if (typeof brain.runPolicyWatchdog === 'function') {
    watchdogRes = await brain.runPolicyWatchdog({
      nowEpoch,
      stage1Days: WATCHDOG_CONFIG.STAGE1_DRIFT_DAYS,
      stage2Days: WATCHDOG_CONFIG.STAGE2_DRIFT_DAYS,
      minSample: WATCHDOG_CONFIG.MIN_SAMPLE_POSTINGS,
      stage2MinAggregatorSample: WATCHDOG_CONFIG.STAGE2_MIN_AGGREGATOR_POSTINGS,
      maxEligibleRatio: WATCHDOG_CONFIG.MAX_ELIGIBLE_RATIO,
      minGeoBlockedRatio: WATCHDOG_CONFIG.MIN_GEO_BLOCKED_RATIO,
      autoHealEligibleCount: WATCHDOG_CONFIG.AUTO_HEAL_ELIGIBLE_COUNT,
      autoHealWindowDays: WATCHDOG_CONFIG.AUTO_HEAL_WINDOW_DAYS
    }).catch(() => watchdogRes);
  }

  // 3. Compute Market Pulse metrics & grounded Llama 3.3 70B narrative
  const metrics = computeMarketPulseMetrics(
    (state && state.opportunities) || [],
    (state && state.platforms) || [],
    nowMs
  );
  const narrative = await synthesizeMarketPulseWithAI(metrics, env);

  const pulsePayload = {
    ...metrics,
    ...narrative,
    watchdog_telemetry: {
      stage1_days: WATCHDOG_CONFIG.STAGE1_DRIFT_DAYS,
      stage2_days: WATCHDOG_CONFIG.STAGE2_DRIFT_DAYS,
      evaluated_employers: watchdogRes.evaluated_employers || 0,
      stage1_open_count: (watchdogRes.stage1_flagged || []).length,
      stage2_open_count: (watchdogRes.stage2_flagged || []).length,
      auto_healed_count: (watchdogRes.auto_healed || []).length
    }
  };

  // 4. Persist Market Pulse in BoliviaCareerBrainDO
  if (typeof brain.saveMarketPulse === 'function') {
    await brain.saveMarketPulse(pulsePayload).catch(() => {});
  }

  return {
    ok: true,
    pulse: pulsePayload,
    watchdog: watchdogRes
  };
}
