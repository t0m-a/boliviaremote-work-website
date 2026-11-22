/**
 * Cloudflare Workers AI Position Enricher, Compensation Extractor & Bolivia UTC-4 Position Analyzer
 * Uses `env.AI` (@cf/meta/llama-3.1-8b-instruct-fast / @cf/meta/llama-3.1-8b-instruct)
 * with deterministic edge fallback when running locally or without an active Workers AI binding.
 */

import {
  POSITION_CATEGORIES,
  EXPERIENCE_OPTIONS,
  CONTRACT_OPTIONS,
  checkBoliviaRemoteEligibility,
  detectOfferAttributes
} from './evaluator.js';
import { stripHtml } from './scanner.js';

const DEFAULT_FAST_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const DEFAULT_FALLBACK_MODEL = '@cf/meta/llama-3.1-8b-instruct';

/**
 * Extracts USD hourly, daily, monthly, or annual compensation from raw job text.
 */
export function extractCompensationUsd(item) {
  if (item.compensation_usd && String(item.compensation_usd).trim()) {
    return String(item.compensation_usd).trim();
  }
  const blob = `${item.title || ''} ${item.description || ''} ${item.notes || ''}`;

  const rangeMatch = blob.match(
    /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*[kK]?\s*(?:-|–|to)\s*\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*[kK]?\s*(?:\/\s*(?:hr|hour|hora|mo|month|mes|yr|year|año)|per\s+(?:hour|month|year)|USD)?/i
  );
  if (rangeMatch) {
    return rangeMatch[0].replace(/\s+/g, ' ').trim();
  }

  const singleRateMatch = blob.match(
    /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*[kK]?\s*(?:\/\s*(?:hr|hour|hora|mo|month|mes|yr|year|study|call)|per\s+(?:hour|month|year|study))/i
  );
  if (singleRateMatch) {
    return singleRateMatch[0].replace(/\s+/g, ' ').trim();
  }

  return '';
}

/**
 * Deterministic bilingual summary generator used when env.AI is not bound or for instant enrichment.
 */
export function buildDeterministicSummaries(item) {
  const bol = checkBoliviaRemoteEligibility(item);
  const attrs = detectOfferAttributes(item);
  const comp = extractCompensationUsd(item);
  const compEs = comp ? ` Remuneración referencial: ${comp}.` : '';
  const compEn = comp ? ` Estimated pay: ${comp}.` : '';
  const skills = attrs.matchedKeywords.slice(0, 5).join(', ');
  const skillsEs = skills ? ` Habilidades clave: ${skills}.` : '';
  const skillsEn = skills ? ` Key skills: ${skills}.` : '';

  const summaryEs =
    `Vacante en ${item.company || item.platform_name} (${bol.badge_es}).` +
    skillsEs +
    compEs;
  const summaryEn =
    `Role at ${item.company || item.platform_name} (${bol.badge_en}).` +
    skillsEn +
    compEn;

  return {
    compensation_usd: comp,
    ai_summary_es: summaryEs.trim(),
    ai_summary_en: summaryEn.trim()
  };
}

/**
 * Safely invokes Cloudflare Workers AI (`env.AI.run`) and parses JSON output.
 */
async function runWorkersAiJson(env, messages, maxTokens = 450) {
  if (!env || !env.AI || typeof env.AI.run !== 'function') {
    return null;
  }

  const models = [DEFAULT_FAST_MODEL, DEFAULT_FALLBACK_MODEL];
  for (const model of models) {
    try {
      const resp = await env.AI.run(model, {
        messages,
        max_tokens: maxTokens,
        temperature: 0.1
      });
      const rawText = typeof resp === 'string'
        ? resp
        : (resp && (resp.response || resp.result || JSON.stringify(resp))) || '';
      const jsonMatch = String(rawText).match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Try next model or fallback
    }
  }
  return null;
}

/**
 * Enriches a single job opportunity using Cloudflare Workers AI (with deterministic fallback).
 */
export async function enrichOpportunityWithAI(item, env) {
  const base = buildDeterministicSummaries(item);
  const detBol = checkBoliviaRemoteEligibility(item);

  const enriched = {
    ...item,
    compensation_usd: item.compensation_usd || base.compensation_usd,
    ai_summary_es: item.ai_summary_es || base.ai_summary_es,
    ai_summary_en: item.ai_summary_en || base.ai_summary_en,
    ai_verified: item.ai_verified || 0
  };

  if (!env || !env.AI || typeof env.AI.run !== 'function') {
    return enriched;
  }

  const sysPrompt =
    'You are an expert Latin America & Bolivia (UTC-4) remote work analyst. ' +
    'Given a job posting, return ONLY a valid JSON object with keys: ' +
    '{"bolivia_eligible": boolean, "company": string, "compensation_usd": string, "summary_es": string, "summary_en": string}. ' +
    'Set bolivia_eligible=false if the role requires US/EU/UK/Canada/specific foreign physical residency, W-2, security clearance, or on-site travel. ' +
    'Set bolivia_eligible=true if open to Bolivia, LATAM, South America, Americas, or Global/Worldwide contractors.';

  const userPrompt =
    `Title: ${stripHtml(item.title)}\n` +
    `Company: ${stripHtml(item.company)}\n` +
    `Platform: ${stripHtml(item.platform_name)}\n` +
    `Location: ${stripHtml(item.location)}\n` +
    `Description: ${stripHtml(item.description).slice(0, 900)}`;

  const aiJson = await runWorkersAiJson(env, [
    { role: 'system', content: sysPrompt },
    { role: 'user', content: userPrompt }
  ], 350);

  if (aiJson && typeof aiJson === 'object') {
    if (typeof aiJson.company === 'string' && aiJson.company.trim().length > 1 && aiJson.company.trim().length < 60) {
      if (enriched.company === enriched.platform_name) {
        enriched.company = stripHtml(aiJson.company.trim());
      }
    }
    if (typeof aiJson.compensation_usd === 'string' && aiJson.compensation_usd.trim()) {
      enriched.compensation_usd = stripHtml(aiJson.compensation_usd.trim()).slice(0, 60);
    }
    if (typeof aiJson.summary_es === 'string' && aiJson.summary_es.trim()) {
      enriched.ai_summary_es = stripHtml(aiJson.summary_es.trim()).slice(0, 280);
    }
    if (typeof aiJson.summary_en === 'string' && aiJson.summary_en.trim()) {
      enriched.ai_summary_en = stripHtml(aiJson.summary_en.trim()).slice(0, 280);
    }
    if (aiJson.bolivia_eligible === false && detBol.eligible) {
      enriched.location = `${enriched.location} (US Only / Geo-Restricted)`;
    }
    enriched.ai_verified = 1;
  }

  return enriched;
}

/**
 * Enriches a batch of newly discovered opportunities during ingestion scans.
 */
export async function enrichBatchWithAI(items, env, maxAiCalls = 5) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const results = [];
  for (let i = 0; i < items.length; i++) {
    if (i < maxAiCalls && env && env.AI) {
      results.push(await enrichOpportunityWithAI(items[i], env));
    } else {
      const det = buildDeterministicSummaries(items[i]);
      results.push({
        ...items[i],
        compensation_usd: items[i].compensation_usd || det.compensation_usd,
        ai_summary_es: items[i].ai_summary_es || det.ai_summary_es,
        ai_summary_en: items[i].ai_summary_en || det.ai_summary_en,
        ai_verified: items[i].ai_verified || 0
      });
    }
  }
  return results;
}

/**
 * Analyzes a position's timezone compatibility with Bolivia (UTC-4) based on location, company, and description signals.
 */
function buildBoliviaTimezoneCompatibility(job) {
  const company = job.company || job.platform_name || 'la empresa';
  const loc = String(job.location || 'Remote Worldwide');
  const blob = `${loc} ${job.title || ''} ${job.description || ''} ${job.tags || ''}`.toLowerCase();

  if (/\b(?:async|asynchronous|asíncrono|asincrono|self-paced|flexible hours|horario flexible|work from anywhere|anywhere in the world)\b/.test(blob)) {
    return `Excelente compatibilidad con Bolivia (UTC-4): ${company} ofrece modalidad asíncrona o flexible ("${loc}"), permitiendo organizar tu jornada desde UTC-4 sin restricciones estrictas de horario.`;
  }
  if (/\b(?:bolivia|south america|sudam[eé]rica|latam|latin america|latinoam[eé]rica|americas|am[eé]ricas|est|edt|eastern|us time|north america|canada)\b/.test(blob)) {
    return `Alta compatibilidad directa con Bolivia (UTC-4): la ubicación declarada ("${loc}") y el enfoque regional de ${company} coinciden con el huso horario boliviano (0 a 1 hora de diferencia con EST/EDT de EE. UU. y alineación total con LATAM).`;
  }
  if (/\b(?:europe|europa|emea|cet|cest|uk|london|spain|españa|germany|france)\b/.test(blob)) {
    return `Compatibilidad parcial-alta con Bolivia (UTC-4): para equipos en Europa/EMEA (${company}, "${loc}"), existe un solapamiento efectivo de 4 a 6 horas durante la mañana de Bolivia (08:00–13:00 BOT), ideal para reuniones tempranas y trabajo asíncrono por la tarde.`;
  }
  return `Compatible con Bolivia (UTC-4): la oferta de ${company} indica modalidad remota ("${loc}"). El huso horario UTC-4 facilita la coordinación en tiempo real con equipos de América y solapamiento matutino con Europa bajo contratación internacional independiente (W-8BEN).`;
}

/**
 * Extracts readable requirement/qualification highlights from a job description.
 */
function extractDescriptionHighlights(description) {
  const clean = stripHtml(description || '');
  if (!clean) return [];
  const sentences = clean
    .split(/(?<=[.!?])\s+|\s*[•|·]\s*/)
    .map(s => s.trim())
    .filter(s => s.length >= 24 && s.length <= 220);

  const reqRe = /\b(?:require|must|need|experience|years|años|experiencia|requisit|fluen|english|español|spanish|bilingual|degree|knowledge|proficien|familiar|strong|ability|responsib|manage|build|develop|support|disponibilidad)\b/i;
  const picked = [];
  for (const s of sentences) {
    if (reqRe.test(s) && !picked.includes(s)) {
      picked.push(s);
    }
    if (picked.length >= 3) break;
  }
  return picked;
}

/**
 * Analyzes available information for a specific remote position and returns structured,
 * Bolivia-oriented insights: overview, requirements, useful skills/experience,
 * UTC-4 timezone compatibility, and actionable candidate advice.
 */
export async function analyzePositionForBolivia(payload, opportunities, env) {
  const targetHash = String((payload && (payload.target_job_hash || payload.job_hash)) || '').trim();
  const eligiblePool = (Array.isArray(opportunities) ? opportunities : []).filter(
    o => o && checkBoliviaRemoteEligibility(o).eligible
  );

  let job = null;
  if (targetHash) {
    job = eligiblePool.find(o => o.job_hash === targetHash) || null;
  }
  if (!job && payload && (payload.title || payload.description)) {
    job = {
      job_hash: targetHash || 'custom',
      title: stripHtml(payload.title || 'Posición Remota'),
      company: stripHtml(payload.company || 'Empresa Contratante'),
      platform_name: stripHtml(payload.platform_name || 'Portal Remoto'),
      location: stripHtml(payload.location || 'Remote Worldwide'),
      description: stripHtml(payload.description || ''),
      tags: stripHtml(payload.tags || ''),
      contract_caveat: payload.contract_caveat || 'fractional_or_fulltime',
      url: String(payload.url || '')
    };
  }
  if (!job && eligiblePool.length > 0) {
    job = eligiblePool[0];
  }
  if (!job) {
    throw new Error('No se encontró la posición solicitada para analizar.');
  }

  const bol = checkBoliviaRemoteEligibility(job);
  const attrs = detectOfferAttributes(job);
  const comp = extractCompensationUsd(job);

  const catLabelsEs = attrs.categories
    .map(cid => POSITION_CATEGORIES.find(c => c.id === cid)?.label_es)
    .filter(Boolean);
  const expOpt = EXPERIENCE_OPTIONS.find(e => e.id === attrs.experience);
  const expLabelEs = expOpt ? expOpt.label_es : 'Todos los niveles';
  const contractLabelsEs = (attrs.contracts || [])
    .map(cid => CONTRACT_OPTIONS.find(c => c.id === cid)?.label_es)
    .filter(Boolean);
  const langMap = { es: 'Español', en: 'Inglés', pt: 'Portugués', de: 'Alemán' };
  const langLabelsEs = (attrs.languages || ['en']).map(l => langMap[l] || l.toUpperCase());

  const titleClean = stripHtml(job.title || 'Posición Remota');
  const companyClean = stripHtml(job.company || job.platform_name || 'Empresa Contratante');
  const platformClean = stripHtml(job.platform_name || companyClean);
  const locClean = stripHtml(job.location || 'Remoto Global');
  const descHighlights = extractDescriptionHighlights(job.description);

  let overviewEs =
    `Posición de ${titleClean} en ${companyClean} (publicada en ${platformClean}). ` +
    `Área principal: ${catLabelsEs.slice(0, 2).join(' · ') || 'Trabajo Remoto Internacional'}. ` +
    `Elegibilidad: ${bol.badge_es}.` +
    (comp ? ` Compensación referencial: ${comp}.` : '');

  let requirementsEs = [
    `Nivel de experiencia estimado: ${expLabelEs}.`,
    `Idiomas requeridos / detectados: ${langLabelsEs.join(', ')}.`,
    `Modalidad de contratación: ${contractLabelsEs.join(', ') || 'Remoto flexible / Tiempo completo'} (${locClean}).`,
    ...descHighlights.slice(0, 2)
  ];

  const detectedSkills = attrs.matchedKeywords.length > 0
    ? attrs.matchedKeywords.slice(0, 10)
    : [];
  let skillsExperienceEs = [
    detectedSkills.length > 0
      ? `Habilidades y herramientas clave detectadas: ${detectedSkills.join(', ')}.`
      : `Experiencia demostrable en ${catLabelsEs[0] || titleClean} y gestión autónoma en equipos distribuidos.`,
    `Dominio de colaboración remota (${langLabelsEs.join(' / ')}), documentación clara y cumplimiento de entregables.`,
    catLabelsEs.length > 1
      ? `Experiencia complementaria valorada en: ${catLabelsEs.slice(1, 3).join(', ')}.`
      : `Familiaridad con herramientas digitales de seguimiento, comunicación síncrona/asíncrona y métricas de desempeño.`
  ];

  let timezoneCompatibilityEs = buildBoliviaTimezoneCompatibility(job);

  let candidateAdviceEs = [
    detectedSkills.length > 0
      ? `Resalta resultados concretos y proyectos recientes usando ${detectedSkills.slice(0, 5).join(', ')} en los primeros párrafos de tu perfil.`
      : `Adapta tu CV destacando logros medibles directamente relacionados con "${titleClean}".`,
    `Indica explícitamente tu disponibilidad desde Bolivia (UTC-4), tu solapamiento horario con ${companyClean} y tu capacidad para facturar como contratista independiente internacional (W-8BEN).`,
    langLabelsEs.includes('Inglés') && !langLabelsEs.includes('Español')
      ? 'La oferta está orientada a inglés: prepara tu CV y respuestas de entrevista en inglés claro y conciso.'
      : 'Revisa los detalles completos en el portal original antes de postular y prepara ejemplos prácticos relevantes para el rol.'
  ];

  let usedWorkersAi = false;

  if (env && env.AI && typeof env.AI.run === 'function') {
    const sysPrompt =
      'Eres un analista experto en empleo remoto internacional para candidatos en Bolivia (UTC-4). ' +
      'Analiza la información disponible de la vacante y devuelve ÚNICAMENTE un objeto JSON válido en español con estas claves exactas: ' +
      '{"overview_es": string, "requirements_es": string[], "skills_experience_es": string[], "timezone_compatibility_es": string, "candidate_advice_es": string[]}. ' +
      'Reglas: ' +
      '1) overview_es: resumen informativo y concreto de la posición (2-3 frases). ' +
      '2) requirements_es: 3 a 5 requisitos concretos de la vacante (experiencia, idiomas, modalidad, perfil). ' +
      '3) skills_experience_es: 3 a 5 habilidades y experiencias útiles para desempeñarse bien en el puesto. ' +
      '4) timezone_compatibility_es: análisis claro de la compatibilidad de la posición y la empresa con el huso horario de Bolivia (UTC-4). ' +
      '5) candidate_advice_es: 3 a 4 consejos prácticos y accionables para el candidato que postula a esta posición. ' +
      'No redactes cartas de presentación; céntrate en información útil y análisis objetivo de la posición.';

    const userPrompt =
      `Título: ${titleClean}\n` +
      `Empresa: ${companyClean}\n` +
      `Plataforma: ${platformClean}\n` +
      `Ubicación / Región: ${locClean}\n` +
      `Modalidad: ${contractLabelsEs.join(', ') || job.contract_caveat || 'Remoto'}\n` +
      `Idiomas detectados: ${langLabelsEs.join(', ')}\n` +
      `Nivel estimado: ${expLabelEs}\n` +
      `Compensación: ${comp || 'No especificada'}\n` +
      `Etiquetas: ${stripHtml(job.tags || '')}\n` +
      `Descripción disponible:\n${stripHtml(job.description || '').slice(0, 1400)}`;

    const aiOut = await runWorkersAiJson(env, [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: userPrompt }
    ], 750);

    if (aiOut && typeof aiOut === 'object') {
      if (typeof aiOut.overview_es === 'string' && aiOut.overview_es.trim()) {
        overviewEs = stripHtml(aiOut.overview_es.trim());
      }
      if (Array.isArray(aiOut.requirements_es) && aiOut.requirements_es.length > 0) {
        requirementsEs = aiOut.requirements_es.map(x => stripHtml(String(x || '').trim())).filter(Boolean).slice(0, 6);
      }
      if (Array.isArray(aiOut.skills_experience_es) && aiOut.skills_experience_es.length > 0) {
        skillsExperienceEs = aiOut.skills_experience_es.map(x => stripHtml(String(x || '').trim())).filter(Boolean).slice(0, 6);
      }
      if (typeof aiOut.timezone_compatibility_es === 'string' && aiOut.timezone_compatibility_es.trim()) {
        timezoneCompatibilityEs = stripHtml(aiOut.timezone_compatibility_es.trim());
      }
      if (Array.isArray(aiOut.candidate_advice_es) && aiOut.candidate_advice_es.length > 0) {
        candidateAdviceEs = aiOut.candidate_advice_es.map(x => stripHtml(String(x || '').trim())).filter(Boolean).slice(0, 5);
      }
      usedWorkersAi = true;
    }
  }

  return {
    ok: true,
    ai_engine: usedWorkersAi ? DEFAULT_FAST_MODEL : 'edge-position-analyzer',
    position: {
      job_hash: job.job_hash,
      title: titleClean,
      company: companyClean,
      platform_name: platformClean,
      location: locClean,
      compensation_usd: comp,
      experience: expLabelEs,
      languages: langLabelsEs,
      contracts: contractLabelsEs,
      categories_es: catLabelsEs,
      url: job.url || ''
    },
    overview_es: overviewEs,
    requirements_es: requirementsEs,
    skills_experience_es: skillsExperienceEs,
    timezone_compatibility_es: timezoneCompatibilityEs,
    candidate_advice_es: candidateAdviceEs
  };
}
