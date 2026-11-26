/**
 * Model Context Protocol (MCP) Server over Streamable HTTP (v6.0.0)
 * Endpoint: `/mcp` (and discovery manifest at `/.well-known/mcp.json`)
 * Protected by fail-closed `MCP_API_KEY`; 100% isolated inside scout-analyst-pipeline (ADR-08).
 *
 * Implements JSON-RPC 2.0 methods:
 *   - initialize / notifications/initialized / ping
 *   - tools/list & tools/call (5 public job tools + 3 isolated BoliviaCareerBrainDO governance tools)
 *   - resources/list & resources/read
 *   - prompts/list & prompts/get
 */

import {
  DEFAULT_FILTERS,
  evaluateAllOpportunities,
  generateResultsMarkdown
} from './evaluator.js';
import { scanCustomPlatformUrl } from './scanner.js';
import { enrichBatchWithAI, analyzePositionForBolivia } from './ai_enricher.js';
import { indexOpportunitiesInVectorStore } from './vector_store.js';
import { hybridSearchOpportunities } from './hybrid_search.js';
import { getCareerBrainClient } from './career_brain_do.js';
import { sanitizePlatformUrl } from './privacy_guard.js';
import { listDiscoveredSources, runAutonomousDiscoveryCycle } from './ats_discovery.js';

export const MCP_SERVER_INFO = {
  name: 'bolivia-remote-mcp-server',
  version: '6.1.0',
  description: 'Isolated Model Context Protocol (MCP) server for finding, evaluating, and governing 100% remote job intelligence for Bolivia (UTC-4).'
};

export const MCP_TOOLS = [
  {
    name: 'search_bolivia_remote_jobs',
    description:
      'Evaluates and filters remote job opportunities eligible from Bolivia (UTC-4) using a 100-point rubric across languages, professional categories, experience level, and contract modality.',
    inputSchema: {
      type: 'object',
      properties: {
        languages: {
          type: 'array',
          items: { type: 'string', enum: ['es', 'en'] },
          description: 'Languages spoken by the candidate (["es"], ["en"], or ["es", "en"]). Strictly filters results to the selected language(s).'
        },
        position_types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Target category IDs (e.g. ["software", "cloud_sys", "data", "virtual_assistant", "customer_support", "finance_accounting", "languages_translation"]).'
        },
        custom_keywords: {
          type: 'string',
          description: 'Comma-separated skills or tools (e.g. "Python, SQL, React, Excel, AWS").'
        },
        verdict: {
          type: 'string',
          enum: ['ALL', 'APPLY', 'POSSIBLE', 'SKIP', 'GEO'],
          description: 'Filter by evaluation verdict (APPLY >= 78, POSSIBLE 58-77).'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of jobs to return (default: 15, max: 50).'
        }
      }
    }
  },
  {
    name: 'semantic_search_bolivia_jobs',
    description:
      'Performs Zero-PII Hybrid Search v2 (3-Channel Weighted RRF over D1 FTS5 + 1024d Vectorize + Edge 128d + Cross-Encoder bge-reranker-base) over Bolivia-eligible remote jobs.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural-language search query in Spanish or English (e.g. "asistente virtual bilingüe atención al cliente" or "Senior Cloud DevOps AWS Terraform").'
        },
        languages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Allowed candidate languages (default: ["es", "en"]).'
        },
        topK: {
          type: 'number',
          description: 'Maximum results to return (default: 10).'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'scan_career_page_url',
    description:
      'Live-scans a custom job board, company career page, RSS/Atom feed, or JSON API URL (with automatic tracking-parameter stripping), extracts job postings, and evaluates 100% remote eligibility from Bolivia.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the job board, RSS feed, or JSON API to scan.'
        },
        name: {
          type: 'string',
          description: 'Optional display name for the platform.'
        },
        type: {
          type: 'string',
          enum: ['auto', 'html_board', 'rss_feed', 'json_api', 'portal_dork'],
          description: 'Scan mode (default: "auto").'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'analyze_position_for_bolivia',
    description:
      'Analyzes a specific remote position using context-compiled BoliviaCareerBrainDO intelligence and Workers AI (with deterministic edge fallback), returning overview, requirements, skills, UTC-4 compatibility, advice, and grounded Bolivia reality signals.',
    inputSchema: {
      type: 'object',
      properties: {
        job_hash: {
          type: 'string',
          description: 'job_hash of the opportunity to analyze.'
        },
        title: {
          type: 'string',
          description: 'Optional position title if analyzing a custom opportunity.'
        },
        description: {
          type: 'string',
          description: 'Optional position description if analyzing a custom opportunity.'
        }
      }
    }
  },
  {
    name: 'list_monitored_platforms',
    description:
      'Lists the 86+ monitored remote job platforms across Tracks A-F (Direct B2B, AI/RLHF, LATAM Networks, Global Portals, Expert Networks, and Remote Job Boards).',
    inputSchema: {
      type: 'object',
      properties: {
        track: {
          type: 'string',
          description: 'Optional track filter (e.g. "Track A", "Track B", "Track C", "Track F").'
        },
        search: {
          type: 'string',
          description: 'Optional keyword filter by platform name or domain.'
        }
      }
    }
  },
  {
    name: 'upsert_employer_reality',
    description:
      'Operator governance tool: add or update an employer/platform node, Bolivia eligibility tier, confidence score, EOR options, and payout rail edges inside BoliviaCareerBrainDO.',
    inputSchema: {
      type: 'object',
      properties: {
        entity_id: {
          type: 'string',
          description: 'Optional canonical entity ID (e.g. "company:acme" or "platform:outlier_ai").'
        },
        canonical_name: {
          type: 'string',
          description: 'Display name of the employer or platform.'
        },
        entity_type: {
          type: 'string',
          enum: ['company', 'platform', 'eor', 'payout_rail', 'skill_bridge'],
          description: 'Entity type (default: "company").'
        },
        domain: {
          type: 'string',
          description: 'Primary web domain (e.g. "deel.com").'
        },
        bolivia_tier: {
          type: 'string',
          enum: ['verified_friendly', 'open_global', 'caution_friction', 'geo_blocked'],
          description: 'Bolivia contracting and payout compatibility tier.'
        },
        confidence: {
          type: 'number',
          description: 'Confidence score in [0.0, 1.0].'
        },
        payout_rails: {
          type: 'array',
          items: { type: 'string' },
          description: 'Known payout rails (e.g. ["airtm_usdc", "payoneer", "deel_withdrawal"]).'
        },
        eor_options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Known EOR / contract paths (e.g. ["deel", "ontop", "direct_w8ben"]).'
        },
        typical_comp: {
          type: 'string',
          description: 'Observed USD compensation band.'
        },
        note_es: {
          type: 'string',
          description: 'Spanish Bolivia contractor reality note.'
        },
        note_en: {
          type: 'string',
          description: 'English Bolivia contractor reality note.'
        },
        caution_es: {
          type: 'string',
          description: 'Optional Spanish caution note if bolivia_tier is caution_friction.'
        }
      },
      required: ['canonical_name']
    }
  },
  {
    name: 'upsert_bolivia_playbook',
    description:
      'Operator governance tool: add or update a curated bilingual Bolivia contractor playbook in BoliviaCareerBrainDO SQLite FTS5 and bolivia-remote-intel-m3 Vectorize.',
    inputSchema: {
      type: 'object',
      properties: {
        playbook_id: {
          type: 'string',
          description: 'Stable playbook identifier (e.g. "pb_custom_invoicing").'
        },
        category: {
          type: 'string',
          description: 'Playbook category (e.g. "payout_rails", "tax_contracts", "timezone_strategy", "category_strategy", "upskilling").'
        },
        title_es: {
          type: 'string',
          description: 'Playbook title in Spanish (es-BO).'
        },
        title_en: {
          type: 'string',
          description: 'Playbook title in English.'
        },
        summary_es: {
          type: 'string',
          description: 'Short Spanish summary.'
        },
        content_es: {
          type: 'string',
          description: 'Detailed actionable guidance in Spanish.'
        },
        content_en: {
          type: 'string',
          description: 'Detailed actionable guidance in English.'
        },
        tags: {
          type: 'string',
          description: 'Comma-separated keywords for FTS5 retrieval.'
        }
      },
      required: ['title_es', 'content_es']
    }
  },
  {
    name: 'inspect_career_brain_status',
    description:
      'Operator governance tool: inspect D1/in-memory job counts, ghost-job flags, BoliviaCareerBrainDO KG entity/edge/playbook counts, open policy conflicts, and AI-managed autonomous ATS discovery telemetry (with optional background discovery cycle trigger).',
    inputSchema: {
      type: 'object',
      properties: {
        run_discovery_cycle: {
          type: 'boolean',
          description: 'Optional: trigger one bounded AI-managed background ATS discovery & promotion cycle (default: false).'
        },
        max_probes: {
          type: 'number',
          description: 'Optional max allowlisted ATS probes when run_discovery_cycle=true (default: 3, max: 6).'
        }
      }
    }
  }
];

export const MCP_RESOURCES = [
  {
    uri: 'bolivia://results/markdown',
    name: 'Bolivia 100% Remote Jobs — Live Markdown Report',
    description: 'Real-time evaluated Markdown report of 100% remote job opportunities eligible from Bolivia (UTC-4).',
    mimeType: 'text/markdown'
  },
  {
    uri: 'bolivia://platforms/catalog',
    name: 'Monitored Remote Job Platforms Catalog (JSON)',
    description: 'Complete directory of 86+ global and LATAM remote job platforms monitored by Bolivia Remote Work.',
    mimeType: 'application/json'
  }
];

export const MCP_PROMPTS = [
  {
    name: 'bolivia_remote_job_hunt',
    description: 'Guided workflow for finding the best 100% remote jobs from Bolivia (UTC-4) and drafting tailored applications.',
    arguments: [
      {
        name: 'candidate_profile',
        description: 'Summary of the candidate skills, experience level, and languages.',
        required: true
      }
    ]
  }
];

/**
 * Builds the public MCP discovery manifest returned on `GET /mcp` and `GET /.well-known/mcp.json`.
 */
export function getMcpServerManifest(origin = 'https://boliviaremote.work') {
  return {
    ok: true,
    mcp_version: '2025-03-26',
    transport: 'streamable-http',
    endpoint: `${origin}/mcp`,
    server: MCP_SERVER_INFO,
    tools: MCP_TOOLS,
    resources: MCP_RESOURCES,
    prompts: MCP_PROMPTS,
    client_configuration_example: {
      mcpServers: {
        'bolivia-remote-work': {
          type: 'http',
          url: `${origin}/mcp`
        }
      }
    }
  };
}

function jsonRpcSuccess(id, result) {
  return {
    jsonrpc: '2.0',
    id: id !== undefined ? id : null,
    result
  };
}

function jsonRpcError(id, code, message, data) {
  return {
    jsonrpc: '2.0',
    id: id !== undefined ? id : null,
    error: {
      code,
      message,
      ...(data !== undefined ? { data } : {})
    }
  };
}

/**
 * Executes a single JSON-RPC 2.0 MCP request object.
 */
async function executeMcpRpcObject(rpc, state, env, saveStateFn) {
  if (!rpc || typeof rpc !== 'object' || rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
    return jsonRpcError(rpc && rpc.id, -32600, 'Invalid JSON-RPC 2.0 Request');
  }

  const { id, method, params = {} } = rpc;

  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    return null;
  }

  if (method === 'ping') {
    return jsonRpcSuccess(id, {});
  }

  if (method === 'initialize') {
    const requestedVersion = (params && params.protocolVersion) || '2025-03-26';
    return jsonRpcSuccess(id, {
      protocolVersion: requestedVersion,
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
        prompts: { listChanged: false }
      },
      serverInfo: MCP_SERVER_INFO
    });
  }

  if (method === 'tools/list') {
    return jsonRpcSuccess(id, { tools: MCP_TOOLS });
  }

  if (method === 'resources/list') {
    return jsonRpcSuccess(id, { resources: MCP_RESOURCES });
  }

  if (method === 'resources/read') {
    const uri = String(params.uri || '');
    if (uri === 'bolivia://results/markdown') {
      const evalResult = evaluateAllOpportunities(state.opportunities, DEFAULT_FILTERS);
      const md = generateResultsMarkdown(evalResult, DEFAULT_FILTERS, 'es', state.platforms.length, state.lastScanAt);
      return jsonRpcSuccess(id, {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: md
          }
        ]
      });
    }
    if (uri === 'bolivia://platforms/catalog') {
      return jsonRpcSuccess(id, {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(state.platforms, null, 2)
          }
        ]
      });
    }
    return jsonRpcError(id, -32602, `Unknown resource URI: ${uri}`);
  }

  if (method === 'prompts/list') {
    return jsonRpcSuccess(id, { prompts: MCP_PROMPTS });
  }

  if (method === 'prompts/get') {
    const name = String(params.name || '');
    if (name !== 'bolivia_remote_job_hunt') {
      return jsonRpcError(id, -32602, `Unknown prompt: ${name}`);
    }
    const profile = (params.arguments && params.arguments.candidate_profile) || 'Remote professional in Bolivia (UTC-4)';
    return jsonRpcSuccess(id, {
      description: 'Bolivia 100% Remote Job Search & Application Assistant',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Using the bolivia-remote-mcp-server tools, find the best 100% remote jobs from Bolivia (UTC-4) for this candidate profile:\n\n` +
              `"${profile}"\n\n` +
              `1. Run semantic_search_bolivia_jobs and search_bolivia_remote_jobs.\n` +
              `2. Call analyze_position_for_bolivia for the top opportunity to retrieve requirements, useful skills, UTC-4 timezone compatibility, grounded Bolivia payout/contract reality, and candidate advice.`
          }
        }
      ]
    });
  }

  if (method === 'tools/call') {
    const toolName = String(params.name || '');
    const args = params.arguments || {};

    try {
      if (toolName === 'search_bolivia_remote_jobs') {
        const filters = {
          ...DEFAULT_FILTERS,
          ...(Array.isArray(args.languages) && args.languages.length > 0 ? { languages: args.languages } : {}),
          ...(Array.isArray(args.position_types) ? { position_types: args.position_types } : {}),
          ...(typeof args.custom_keywords === 'string' ? { custom_keywords: args.custom_keywords } : {})
        };
        const evalRes = evaluateAllOpportunities(state.opportunities, filters);
        const verdict = String(args.verdict || 'ALL').toUpperCase();
        let pool = evalRes.surfaced;
        if (verdict === 'APPLY') pool = evalRes.apply;
        else if (verdict === 'POSSIBLE') pool = evalRes.possible;
        else if (verdict === 'SKIP') pool = evalRes.skip;
        else if (verdict === 'GEO') pool = evalRes.geo_excluded;

        const limit = Math.min(Math.max(Number(args.limit) || 15, 1), 50);
        const payload = {
          total_evaluated: evalRes.all.length,
          counts: {
            surfaced: evalRes.surfaced.length,
            apply: evalRes.apply.length,
            possible: evalRes.possible.length,
            skip: evalRes.skip.length,
            geo_excluded: evalRes.geo_excluded.length
          },
          results: pool.slice(0, limit).map(r => ({
            job_hash: r.job_hash,
            title: r.title,
            company: r.company,
            platform_name: r.platform_name,
            total_score: r.total_score,
            verdict: r.verdict,
            location: r.location,
            bolivia_badge: r.bolivia_badge_en,
            compensation_usd: r.compensation_usd || '',
            ghost_risk: r.ghost_risk || 'none',
            matched_skills: r.matched_skills,
            url: r.url
          }))
        };
        return jsonRpcSuccess(id, {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          isError: false
        });
      }

      if (toolName === 'semantic_search_bolivia_jobs') {
        const filters = {
          ...DEFAULT_FILTERS,
          ...(Array.isArray(args.languages) && args.languages.length > 0 ? { languages: args.languages } : {})
        };
        const semRes = await hybridSearchOpportunities(
          args.query,
          state.opportunities,
          filters,
          env,
          { topK: Number(args.topK) || 10 }
        );
        return jsonRpcSuccess(id, {
          content: [{ type: 'text', text: JSON.stringify(semRes, null, 2) }],
          isError: false
        });
      }

      if (toolName === 'scan_career_page_url') {
        const cleanUrl = sanitizePlatformUrl(args.url || '');
        const scanRes = await scanCustomPlatformUrl(
          { url: cleanUrl, name: args.name, type: args.type || 'auto' },
          DEFAULT_FILTERS
        );
        scanRes.opportunities = await enrichBatchWithAI(scanRes.opportunities, env, 3);
        await indexOpportunitiesInVectorStore(scanRes.opportunities, env, 10);

        const existingHashes = new Set(state.opportunities.map(o => o.job_hash));
        for (const item of scanRes.opportunities) {
          if (!existingHashes.has(item.job_hash)) {
            existingHashes.add(item.job_hash);
            state.opportunities.unshift(item);
          }
        }
        if (typeof saveStateFn === 'function') {
          await saveStateFn();
        }

        return jsonRpcSuccess(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  platform: scanRes.platform,
                  discovered_count: scanRes.discovered_count,
                  bolivia_eligible_count: scanRes.bolivia_eligible_count,
                  opportunities: scanRes.opportunities.slice(0, 15)
                },
                null,
                2
              )
            }
          ],
          isError: false
        });
      }

      if (toolName === 'analyze_position_for_bolivia') {
        const analysisRes = await analyzePositionForBolivia(
          {
            target_job_hash: args.job_hash || args.target_job_hash,
            title: args.title,
            description: args.description
          },
          state.opportunities,
          env
        );
        return jsonRpcSuccess(id, {
          content: [{ type: 'text', text: JSON.stringify(analysisRes, null, 2) }],
          isError: false
        });
      }

      if (toolName === 'list_monitored_platforms') {
        const trackQ = String(args.track || '').toLowerCase().trim();
        const searchQ = String(args.search || '').toLowerCase().trim();
        const filtered = state.platforms.filter(p => {
          if (trackQ && !String(p.track || '').toLowerCase().includes(trackQ)) return false;
          if (searchQ) {
            const hay = `${p.name} ${p.domain} ${p.notes || ''}`.toLowerCase();
            if (!hay.includes(searchQ)) return false;
          }
          return true;
        });
        return jsonRpcSuccess(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ count: filtered.length, platforms: filtered }, null, 2)
            }
          ],
          isError: false
        });
      }

      // Isolated Governance Tool 1: upsert_employer_reality
      if (toolName === 'upsert_employer_reality') {
        const brain = getCareerBrainClient(env);
        const res = await brain.upsertEmployerReality(args);
        return jsonRpcSuccess(id, {
          content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
          isError: false
        });
      }

      // Isolated Governance Tool 2: upsert_bolivia_playbook
      if (toolName === 'upsert_bolivia_playbook') {
        const brain = getCareerBrainClient(env);
        const res = await brain.upsertBoliviaPlaybook(args);
        return jsonRpcSuccess(id, {
          content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
          isError: false
        });
      }

      // Isolated Governance Tool 3: inspect_career_brain_status
      if (toolName === 'inspect_career_brain_status') {
        let discoveryCycleResult = null;
        if (args && args.run_discovery_cycle === true) {
          discoveryCycleResult = await runAutonomousDiscoveryCycle(state, env, {
            maxProbes: Number(args.max_probes) || 3,
            rawScannedItems: (state.opportunities || []).slice(0, 80)
          });
          if (discoveryCycleResult.discovered_opportunities && discoveryCycleResult.discovered_opportunities.length > 0) {
            state.opportunities = [...discoveryCycleResult.discovered_opportunities, ...state.opportunities];
            await indexOpportunitiesInVectorStore(discoveryCycleResult.discovered_opportunities, env, 25);
          }
          if (typeof saveStateFn === 'function') {
            await saveStateFn();
          }
        }

        const brain = getCareerBrainClient(env);
        const brainStatus = await brain.inspectStatus();
        const discoveredRows = await listDiscoveredSources(env, { limit: 100 });
        const ghostHighCount = (state.opportunities || []).filter(o => o.ghost_risk === 'high').length;
        const ghostWatchCount = (state.opportunities || []).filter(o => o.ghost_risk === 'watch').length;

        let d1Stats = { bound: Boolean(env && env.DB), active_jobs: null, sightings_tracked: null };
        if (env && env.DB && typeof env.DB.prepare === 'function') {
          try {
            const r1 = await env.DB.prepare("SELECT COUNT(*) AS c FROM opportunities WHERE status = 'ACTIVE' OR status IS NULL").all();
            const r2 = await env.DB.prepare('SELECT COUNT(*) AS c FROM job_sightings').all();
            if (r1 && Array.isArray(r1.results) && r1.results[0]) d1Stats.active_jobs = Number(r1.results[0].c);
            if (r2 && Array.isArray(r2.results) && r2.results[0]) d1Stats.sightings_tracked = Number(r2.results[0].c);
          } catch {
            // ignore D1 count errors on minimal mocks
          }
        }

        const payload = {
          ok: true,
          version: '6.1.0',
          air_gapped_isolation: true,
          state_opportunities_count: (state.opportunities || []).length,
          platforms_count: (state.platforms || []).length,
          direct_ats_platforms_count: (state.platforms || []).filter(p => p && p.type === 'ats_json' && p.enabled !== false).length,
          ghost_job_flags: {
            high: ghostHighCount,
            watch: ghostWatchCount
          },
          d1: d1Stats,
          vectorize: {
            jobs_index_bound: Boolean(env && env.VECTORIZE),
            intel_index_bound: Boolean(env && env.INTEL_VECTORIZE)
          },
          autonomous_discovery: {
            total_tracked: discoveredRows.length,
            promoted_count: discoveredRows.filter(r => r.status === 'PROMOTED').length,
            staged_count: discoveredRows.filter(r => r.status === 'STAGED').length,
            cooldown_count: discoveredRows.filter(r => r.status === 'COOLDOWN').length,
            last_cycle: discoveryCycleResult,
            top_sources: discoveredRows.slice(0, 12).map(r => ({
              candidate_id: r.candidate_id,
              company: r.company_name,
              provider: r.ats_provider,
              status: r.status,
              bolivia_eligible_jobs: r.bolivia_eligible_jobs,
              spanish_jobs: r.spanish_jobs,
              yield_score: r.yield_score,
              ai_decision: r.ai_decision
            }))
          },
          career_brain: brainStatus
        };
        return jsonRpcSuccess(id, {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          isError: false
        });
      }

      return jsonRpcError(id, -32601, `Unknown MCP tool: ${toolName}`);
    } catch (err) {
      return jsonRpcSuccess(id, {
        content: [{ type: 'text', text: `Error executing ${toolName}: ${err.message || String(err)}` }],
        isError: true
      });
    }
  }

  return jsonRpcError(id, -32601, `Method not found: ${method}`);
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks on API keys.
 */
function timingSafeEqualStr(a, b) {
  const strA = String(a || '');
  const strB = String(b || '');
  if (strA.length === 0 || strA.length !== strB.length) return false;
  let diff = 0;
  for (let i = 0; i < strA.length; i++) {
    diff |= strA.charCodeAt(i) ^ strB.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verifies Bearer Token / API Key for private `/mcp` access (Fail-Closed by default).
 */
export function verifyMcpAuth(request, env, urlObj) {
  const allowPublic = Boolean(env && String(env.MCP_PUBLIC_ACCESS).toLowerCase() === 'true');
  if (allowPublic) {
    return { ok: true, enforced: false };
  }

  const expectedKey = env && typeof env.MCP_API_KEY === 'string' ? env.MCP_API_KEY.trim() : '';
  if (!expectedKey) {
    return { ok: false, enforced: true, reason: 'MCP_API_KEY secret is not configured on the Worker' };
  }

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || '';
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const headerKey = request.headers.get('X-MCP-API-Key') || request.headers.get('x-mcp-api-key') || '';
  const parsedUrl = urlObj || new URL(request.url);
  const queryKey = parsedUrl.searchParams.get('key') || parsedUrl.searchParams.get('api_key') || '';

  const providedKey = (bearerMatch ? bearerMatch[1] : (headerKey || queryKey)).trim();
  if (!providedKey) {
    return { ok: false, enforced: true, reason: 'Missing Bearer token or X-MCP-API-Key' };
  }

  return {
    ok: timingSafeEqualStr(providedKey, expectedKey),
    enforced: true,
    reason: 'Invalid Bearer token or X-MCP-API-Key'
  };
}

/**
 * HTTP Handler for `/mcp`, `/api/mcp`, and `/.well-known/mcp.json`.
 */
export async function handleMcpRequest(request, state, env, ctx, saveStateFn) {
  const url = new URL(request.url);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-MCP-API-Key, Mcp-Session-Id'
  };

  const auth = verifyMcpAuth(request, env, url);
  if (!auth.ok) {
    return new Response(
      JSON.stringify(
        jsonRpcError(null, -32001, 'Unauthorized: Valid Bearer token or X-MCP-API-Key required'),
        null,
        2
      ),
      {
        status: 401,
        headers: {
          ...headers,
          'WWW-Authenticate': 'Bearer realm="bolivia-remote-mcp-server"'
        }
      }
    );
  }

  if (request.method === 'GET') {
    const manifest = getMcpServerManifest(url.origin);
    return new Response(JSON.stringify(manifest, null, 2), { status: 200, headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify(jsonRpcError(null, -32700, 'Parse error: Invalid JSON payload')),
      { status: 400, headers }
    );
  }

  if (Array.isArray(body)) {
    const responses = [];
    for (const item of body) {
      const res = await executeMcpRpcObject(item, state, env, saveStateFn);
      if (res !== null) responses.push(res);
    }
    if (responses.length === 0) {
      return new Response(null, { status: 202, headers });
    }
    return new Response(JSON.stringify(responses, null, 2), { status: 200, headers });
  }

  const rpcResponse = await executeMcpRpcObject(body, state, env, saveStateFn);
  if (rpcResponse === null) {
    return new Response(null, { status: 202, headers });
  }
  return new Response(JSON.stringify(rpcResponse, null, 2), { status: 200, headers });
}
