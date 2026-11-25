/**
 * Hybrid Search v2 — 3-Channel Weighted RRF + Cross-Encoder Reranking (v6.0.0)
 * 100% Zero-PII (ADR-06) & Air-Gapped (ADR-08):
 *   1. Ephemeral RAM-only PII scrubber (emails, phones, URLs, @handles, long numeric IDs stripped; zero persistence)
 *   2. Stage 1 — Parallel 3-Channel Candidate Generation:
 *        - Channel 1 (`d1_fts`, weight 1.15): D1 `opportunities_fts` weighted BM25 (accent-insensitive)
 *        - Channel 2 (`vec_m3`, weight 1.20): Cloudflare Vectorize `bolivia-remote-jobs-m3` (1024d bge-m3)
 *        - Channel 3 (`edge_128d`, weight 0.85): Local 128d concept-cluster + Levenshtein typo-tolerant scorer
 *   3. Weighted Reciprocal Rank Fusion + Domain Modifiers:
 *        Score_RRF(d) = sum(w_c / (60 + rank_c(d))) * D_freshness(d) * G_ghost(d) * E_employer(d)
 *   4. Stage 2 — Cross-Encoder Neural Reranking (`@cf/baai/bge-reranker-base`) over Top-16 RRF candidates.
 */

import { DEFAULT_FILTERS, evaluateAllOpportunities } from './evaluator.js';
import {
  EMBEDDING_MODEL,
  normalizeSearchText,
  extractQueryTokens,
  expandQueryTerms,
  scoreForgivingTermMatch,
  buildLocalSemanticVector,
  cosineSimilarity,
  generateEmbedding,
  buildOpportunityEmbeddingText
} from './vector_store.js';
import {
  scrubEphemeralPii,
  parseDateToEpochSeconds
} from './privacy_guard.js';
import { getCareerBrainClient } from './career_brain_do.js';
import { stripHtml } from './scanner.js';

export const RERANKER_MODEL = '@cf/baai/bge-reranker-base';

const RRF_K = 60;
const CHANNEL_WEIGHTS = {
  d1_fts: 1.15,
  vec_m3: 1.20,
  edge_128d: 0.85
};

/**
 * Exponential freshness decay with a 21-day half-life tuned for active job listings.
 */
export function computeFreshnessDecay(publishedAtOrEpoch, nowEpochSec = Math.floor(Date.now() / 1000)) {
  const pubEpoch = typeof publishedAtOrEpoch === 'number' && publishedAtOrEpoch > 0
    ? publishedAtOrEpoch
    : parseDateToEpochSeconds(publishedAtOrEpoch, nowEpochSec);
  const ageDays = Math.max(0, (nowEpochSec - pubEpoch) / 86400);
  // Cap extreme historical seed ages gently at 60 days so valid curated listings stay discoverable
  const boundedAge = Math.min(ageDays, 60);
  return Math.exp((-Math.LN2 * boundedAge) / 21);
}

/**
 * Deterministic Ghost-Job ranking dampener.
 */
export function computeGhostDampener(ghostRisk) {
  if (ghostRisk === 'high') return 0.72;
  if (ghostRisk === 'watch') return 0.88;
  return 1.0;
}

/**
 * Builds a safe FTS5 MATCH query from sanitized tokens + cross-lingual synonyms.
 */
function buildFtsMatchQuery(queryTerms, expandedSynonyms) {
  const allTerms = Array.from(
    new Set([
      ...queryTerms,
      ...expandedSynonyms.flatMap(s => s.split(/\s+/))
    ])
  )
    .map(t => t.replace(/[^a-z0-9]/g, '').trim())
    .filter(t => t.length >= 2)
    .slice(0, 14);

  if (allTerms.length === 0) return '';
  return allTerms.map(t => `"${t}"*`).join(' OR ');
}

/**
 * Channel 1: D1 `opportunities_fts` weighted BM25 candidate retrieval.
 */
async function runD1FtsChannel(env, matchQuery, limit = 40) {
  if (!env || !env.DB || typeof env.DB.prepare !== 'function' || !matchQuery) {
    return new Map();
  }
  try {
    const stmt = env.DB.prepare(
      `SELECT job_hash, bm25(opportunities_fts, 10.0, 6.0, 5.0, 4.0, 3.0, 1.0) AS rank_score
       FROM opportunities_fts
       WHERE opportunities_fts MATCH ?
       ORDER BY rank_score
       LIMIT ?`
    );
    const res = await stmt.bind(matchQuery, limit).all();
    const rows = Array.isArray(res && res.results) ? res.results : [];
    const ranks = new Map();
    rows.forEach((row, idx) => {
      if (row && row.job_hash) {
        ranks.set(row.job_hash, { rank: idx + 1, bm25: Number(row.rank_score || 0) });
      }
    });
    return ranks;
  } catch {
    return new Map();
  }
}

/**
 * Channel 2: Cloudflare Vectorize `bolivia-remote-jobs-m3` (1024d bge-m3) or Qdrant fallback.
 */
async function runVectorChannel(env, queryEmb, filters, topK = 40) {
  const ranks = new Map();
  let backend = null;

  if (env && env.VECTORIZE && typeof env.VECTORIZE.query === 'function') {
    try {
      const langs = Array.isArray(filters && filters.languages) ? filters.languages : [];
      const filterObj = { status: 'ACTIVE' };
      if (langs.length === 1 && langs[0] === 'es') {
        // Keep metadata filter broad enough to include bilingual es_en jobs if supported
      }
      let vecMatches = null;
      try {
        vecMatches = await env.VECTORIZE.query(queryEmb.vector, {
          topK,
          filter: filterObj,
          returnMetadata: 'all'
        });
      } catch {
        vecMatches = null;
      }
      if (!vecMatches || !Array.isArray(vecMatches.matches) || vecMatches.matches.length === 0) {
        vecMatches = await env.VECTORIZE.query(queryEmb.vector, {
          topK,
          returnMetadata: 'all'
        });
      }
      const matchList = (vecMatches && Array.isArray(vecMatches.matches)) ? vecMatches.matches : [];
      matchList.forEach((m, idx) => {
        const hash = (m.metadata && m.metadata.job_hash) || m.id;
        if (hash && typeof m.score === 'number') {
          ranks.set(hash, { rank: idx + 1, score: Math.max(0, Math.min(1, m.score)) });
        }
      });
      if (matchList.length > 0) {
        backend = 'cloudflare-vectorize';
      }
    } catch {
      // Fallback gracefully
    }
  }

  if (ranks.size === 0 && env && env.QDRANT_URL) {
    try {
      const baseUrl = String(env.QDRANT_URL).replace(/\/+$/, '');
      const collection = env.QDRANT_COLLECTION || 'bolivia_remote_jobs';
      const headers = { 'Content-Type': 'application/json' };
      if (env.QDRANT_API_KEY) {
        headers['api-key'] = String(env.QDRANT_API_KEY);
      }
      const resp = await fetch(`${baseUrl}/collections/${collection}/points/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          vector: queryEmb.vector,
          limit: topK,
          with_payload: true
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        const hits = Array.isArray(data && data.result) ? data.result : [];
        hits.forEach((h, idx) => {
          const hash = h.payload && h.payload.job_hash;
          if (hash && typeof h.score === 'number') {
            ranks.set(hash, { rank: idx + 1, score: Math.max(0, Math.min(1, h.score)) });
          }
        });
        if (hits.length > 0) {
          backend = 'qdrant-edge-bridge';
        }
      }
    } catch {
      // Fallback gracefully
    }
  }

  return { ranks, backend };
}

/**
 * Channel 3: Local 128-dim concept-cluster + Levenshtein typo-tolerant scorer.
 */
function runEdge128dChannel(candidates, normalizedQuery, queryTerms, expandedSynonyms) {
  const expandedQueryText = expandedSynonyms.length > 0
    ? `${normalizedQuery} ${expandedSynonyms.join(' ')}`
    : normalizedQuery;
  const localQueryVec = buildLocalSemanticVector(expandedQueryText);

  const scored = candidates.map(opp => {
    const oppText = buildOpportunityEmbeddingText(opp);
    const normalizedBlob = normalizeSearchText(oppText);
    const blobTokens = normalizedBlob
      .replace(/[^a-z0-9+#.\s-]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 2);
    const localOppVec = buildLocalSemanticVector(normalizedBlob);
    const localSim = cosineSimilarity(localQueryVec, localOppVec);

    let termScoreSum = 0;
    for (const term of queryTerms) {
      termScoreSum += scoreForgivingTermMatch(term, normalizedBlob, blobTokens);
    }
    const lexicalBoost = queryTerms.length > 0
      ? (termScoreSum / queryTerms.length) * 0.30
      : 0;

    let synHits = 0;
    if (expandedSynonyms.length > 0) {
      for (const syn of expandedSynonyms) {
        if (normalizedBlob.includes(syn)) synHits++;
      }
    }
    const synonymBoost = expandedSynonyms.length > 0
      ? Math.min(1, synHits / Math.min(expandedSynonyms.length, 3)) * 0.18
      : 0;

    const edgeSim = Math.min(1, localSim * 0.80 + lexicalBoost + synonymBoost);
    return { job_hash: opp.job_hash, opp, edgeSim };
  });

  scored.sort((a, b) => b.edgeSim - a.edgeSim);

  const ranks = new Map();
  scored.forEach((item, idx) => {
    ranks.set(item.job_hash, { rank: idx + 1, score: item.edgeSim });
  });
  return ranks;
}

/**
 * Stage 2: Cross-Encoder Neural Reranker (`@cf/baai/bge-reranker-base`) over Top-16 RRF candidates.
 */
async function runStage2CrossEncoder(cleanQuery, topCandidates, env) {
  if (!env || !env.AI || typeof env.AI.run !== 'function' || topCandidates.length === 0) {
    return null;
  }
  try {
    const contexts = topCandidates.map(c => ({
      text: `${stripHtml(c.title)} | ${stripHtml(c.company)} | ${stripHtml(c.ai_summary_es || '')} | ${stripHtml(c.description || '').slice(0, 700)}`.slice(0, 900)
    }));
    const resp = await env.AI.run(RERANKER_MODEL, {
      query: cleanQuery.slice(0, 400),
      contexts
    });
    const list = (resp && Array.isArray(resp.response))
      ? resp.response
      : (Array.isArray(resp) ? resp : null);
    if (!list || list.length === 0) return null;

    const scoreMap = new Map();
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      if (row && typeof row.score === 'number') {
        const idx = typeof row.id === 'number' ? row.id : i;
        const cand = topCandidates[idx];
        if (cand) {
          scoreMap.set(cand.job_hash, Math.max(0, Math.min(1, row.score)));
        }
      }
    }
    return scoreMap.size > 0 ? scoreMap : null;
  } catch {
    return null;
  }
}

/**
 * Executes Hybrid Search v2 (Zero-PII + 3-Channel Weighted RRF + Domain Modifiers + Cross-Encoder Reranker).
 */
export async function hybridSearchOpportunities(query, opportunities, filters = DEFAULT_FILTERS, env = {}, options = {}) {
  const { cleanText: scrubbedQuery, redactedCount } = scrubEphemeralPii(query || '');
  const cleanQuery = scrubbedQuery.trim();
  if (!cleanQuery) {
    throw new Error('Por favor ingresa una consulta de búsqueda semántica. / Please enter a semantic search query.');
  }

  const topK = Math.min(Math.max(Number(options.topK) || 25, 1), 100);
  const evalResult = evaluateAllOpportunities(opportunities, { ...filters, require_bolivia_remote: true });
  const pool = evalResult.surfaced;

  const normalizedQuery = normalizeSearchText(cleanQuery);
  const queryTerms = extractQueryTokens(normalizedQuery);
  const expandedSynonyms = expandQueryTerms(queryTerms);
  const ftsMatchQuery = buildFtsMatchQuery(queryTerms, expandedSynonyms);

  // Run query embedding + D1 FTS5 + Employer Reality lookup in parallel
  const careerBrain = getCareerBrainClient(env);
  const [queryEmb, d1FtsRanks, employerRealityByHash] = await Promise.all([
    generateEmbedding(cleanQuery, env),
    runD1FtsChannel(env, ftsMatchQuery, 40),
    careerBrain.lookupEmployerRealityBatch(pool.slice(0, 250))
  ]);

  const { ranks: vecRanks, backend: vecBackend } = await runVectorChannel(env, queryEmb, filters, 40);

  const hybridChannels = ['edge_128d'];
  if (d1FtsRanks.size > 0) hybridChannels.unshift('d1_fts');
  if (vecRanks.size > 0) hybridChannels.unshift('vec_m3');

  let activeBackend = 'edge-multilingual-vectors';
  if (vecBackend) {
    activeBackend = vecBackend;
  } else if (d1FtsRanks.size > 0) {
    activeBackend = 'd1-fts5-hybrid';
  } else if (queryEmb.model === EMBEDDING_MODEL) {
    activeBackend = 'workers-ai-bge-m3';
  }

  const nowEpochSec = Math.floor(Date.now() / 1000);

  const fuseAndRankPool = async (candidates) => {
    const edgeRanks = runEdge128dChannel(candidates, normalizedQuery, queryTerms, expandedSynonyms);

    const fused = candidates.map(opp => {
      const ftsHit = d1FtsRanks.get(opp.job_hash) || null;
      const vecHit = vecRanks.get(opp.job_hash) || null;
      const edgeHit = edgeRanks.get(opp.job_hash) || { rank: candidates.length + 1, score: 0 };

      let rrfRaw = 0;
      if (ftsHit) rrfRaw += CHANNEL_WEIGHTS.d1_fts / (RRF_K + ftsHit.rank);
      if (vecHit) rrfRaw += CHANNEL_WEIGHTS.vec_m3 / (RRF_K + vecHit.rank);
      if (edgeHit.score > 0.04) rrfRaw += CHANNEL_WEIGHTS.edge_128d / (RRF_K + edgeHit.rank);

      const dFresh = computeFreshnessDecay(opp.published_epoch || opp.published_at || opp.discovered_at, nowEpochSec);
      const gGhost = computeGhostDampener(opp.ghost_risk);
      const empReality = opp.employer_reality || employerRealityByHash[opp.job_hash] || null;
      const eEmployer = empReality && typeof empReality.employer_multiplier === 'number'
        ? empReality.employer_multiplier
        : 1.0;

      const rrfAdjusted = rrfRaw * (0.72 + 0.28 * dFresh) * gGhost * eEmployer;

      // Combine raw similarity signal for intuitive 0..100 semantic_score
      const rawSim = vecHit
        ? Math.min(1, vecHit.score * 0.62 + edgeHit.score * 0.38 + (ftsHit ? 0.12 : 0))
        : Math.min(1, edgeHit.score + (ftsHit ? 0.16 : 0));

      const semanticScore = Math.min(100, Math.round(Math.pow(rawSim, 0.62) * 100));
      const blendedScore = Math.min(100, Math.round(semanticScore * 0.58 + opp.total_score * 0.42));

      return {
        ...opp,
        employer_reality: empReality || opp.employer_reality || undefined,
        rrf_score: Number(rrfAdjusted.toFixed(6)),
        freshness_factor: Number(dFresh.toFixed(3)),
        ghost_dampener: gGhost,
        employer_multiplier: eEmployer,
        semantic_similarity: Number(rawSim.toFixed(4)),
        semantic_score: semanticScore,
        blended_score: blendedScore
      };
    });

    // Sort by RRF + blended_score for Stage-1 candidate selection
    fused.sort((a, b) => {
      if (b.rrf_score !== a.rrf_score && (d1FtsRanks.size > 0 || vecRanks.size > 0)) {
        return b.rrf_score - a.rrf_score;
      }
      if (b.blended_score !== a.blended_score) return b.blended_score - a.blended_score;
      return b.semantic_score - a.semantic_score;
    });

    // Stage 2: Cross-Encoder Neural Reranking on Top-16
    const top16 = fused.slice(0, 16);
    const rerankScores = await runStage2CrossEncoder(cleanQuery, top16, env);
    let rerankerUsed = false;

    if (rerankScores && rerankScores.size > 0) {
      rerankerUsed = true;
      for (const item of top16) {
        const neuralScore = rerankScores.get(item.job_hash);
        if (typeof neuralScore === 'number') {
          const neuralPct = Math.round(neuralScore * 100);
          item.reranker_score = Number(neuralScore.toFixed(4));
          item.semantic_score = Math.min(100, Math.round(neuralPct * 0.65 + item.semantic_score * 0.35));
          item.blended_score = Math.min(100, Math.round(item.semantic_score * 0.62 + item.total_score * 0.38));
        }
      }
      top16.sort((a, b) => {
        if (b.blended_score !== a.blended_score) return b.blended_score - a.blended_score;
        return (b.reranker_score || 0) - (a.reranker_score || 0);
      });
    }

    const combined = [...top16, ...fused.slice(16)];
    return { results: combined, rerankerUsed };
  };

  let { results: scoredResults, rerankerUsed } = await fuseAndRankPool(pool);
  let filteredTop = scoredResults
    .filter(r => r.semantic_score >= 10)
    .slice(0, topK);

  // Forgiving broad fallback if active language filter returned 0 matches
  if (filteredTop.length === 0 && Array.isArray(evalResult.all) && evalResult.all.length > pool.length) {
    const broad = await fuseAndRankPool(evalResult.all);
    rerankerUsed = rerankerUsed || broad.rerankerUsed;
    filteredTop = broad.results
      .filter(r => r.semantic_score >= 10)
      .slice(0, topK);
  }

  return {
    ok: true,
    query: cleanQuery,
    pii_redacted_count: redactedCount,
    vector_backend: activeBackend,
    embedding_model: queryEmb.model,
    hybrid_channels: hybridChannels,
    rrf_enabled: true,
    reranker_used: rerankerUsed,
    count: filteredTop.length,
    results: filteredTop
  };
}
