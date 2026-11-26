/**
 * Allowlisted Direct ATS JSON Adapters & Candidate Extractor (v6.1.0)
 * Strict SSRF-safe allowlist of 7 public ATS JSON APIs + GetOnBoard JSON:API parser:
 *   - Greenhouse (boards-api.greenhouse.io)
 *   - Lever (api.lever.co)
 *   - Ashby (api.ashbyhq.com)
 *   - Workable (apply.workable.com)
 *   - SmartRecruiters (api.smartrecruiters.com)
 *   - Recruitee (<slug>.recruitee.com)
 *   - Breezy HR (<slug>.breezy.hr)
 */

import { stripHtml, computeJobHash, isDeadPlatform } from './scanner.js';
import { sanitizePlatformUrl, normalizeCompanySlug } from './privacy_guard.js';

export const ATS_PROVIDERS = {
  greenhouse: {
    id: 'greenhouse',
    label: 'Greenhouse',
    buildApiUrl: (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
    buildBoardUrl: (slug) => `https://boards.greenhouse.io/${slug}`,
    hostCheck: (host) => host === 'boards-api.greenhouse.io'
  },
  lever: {
    id: 'lever',
    label: 'Lever',
    buildApiUrl: (slug) => `https://api.lever.co/v0/postings/${slug}?mode=json`,
    buildBoardUrl: (slug) => `https://jobs.lever.co/${slug}`,
    hostCheck: (host) => host === 'api.lever.co' || host === 'api.eu.lever.co'
  },
  ashby: {
    id: 'ashby',
    label: 'Ashby',
    buildApiUrl: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`,
    buildBoardUrl: (slug) => `https://jobs.ashbyhq.com/${slug}`,
    hostCheck: (host) => host === 'api.ashbyhq.com'
  },
  workable: {
    id: 'workable',
    label: 'Workable',
    buildApiUrl: (slug) => `https://apply.workable.com/api/v1/widget/accounts/${slug}`,
    buildBoardUrl: (slug) => `https://apply.workable.com/${slug}/`,
    hostCheck: (host) => host === 'apply.workable.com'
  },
  smartrecruiters: {
    id: 'smartrecruiters',
    label: 'SmartRecruiters',
    buildApiUrl: (slug) => `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=50`,
    buildBoardUrl: (slug) => `https://jobs.smartrecruiters.com/${slug}`,
    hostCheck: (host) => host === 'api.smartrecruiters.com'
  },
  recruitee: {
    id: 'recruitee',
    label: 'Recruitee',
    buildApiUrl: (slug) => `https://${slug}.recruitee.com/api/offers/`,
    buildBoardUrl: (slug) => `https://${slug}.recruitee.com/`,
    hostCheck: (host) => /^[a-z0-9][a-z0-9-]{1,50}\.recruitee\.com$/.test(host)
  },
  breezy: {
    id: 'breezy',
    label: 'Breezy HR',
    buildApiUrl: (slug) => `https://${slug}.breezy.hr/json`,
    buildBoardUrl: (slug) => `https://${slug}.breezy.hr/`,
    hostCheck: (host) => /^[a-z0-9][a-z0-9-]{1,50}\.breezy\.hr$/.test(host)
  }
};

const VALID_SLUG_RE = /^[a-z0-9][a-z0-9._-]{1,48}$/i;
const SUBDOMAIN_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,45}$/i;

const EXPLICIT_ATS_URL_PATTERNS = [
  { provider: 'greenhouse', re: /https?:\/\/(?:job-)?boards(?:\.eu)?\.greenhouse\.io\/([a-z0-9_-]{2,48})(?:\/|\?|$)/gi },
  { provider: 'greenhouse', re: /https?:\/\/boards-api\.greenhouse\.io\/v1\/boards\/([a-z0-9_-]{2,48})(?:\/|\?|$)/gi },
  { provider: 'lever', re: /https?:\/\/jobs(?:\.eu)?\.lever\.co\/([a-z0-9_-]{2,48})(?:\/|\?|$)/gi },
  { provider: 'lever', re: /https?:\/\/api(?:\.eu)?\.lever\.co\/v0\/postings\/([a-z0-9_-]{2,48})(?:\/|\?|$)/gi },
  { provider: 'ashby', re: /https?:\/\/jobs\.ashbyhq\.com\/([a-z0-9_.-]{2,48})(?:\/|\?|$)/gi },
  { provider: 'ashby', re: /https?:\/\/api\.ashbyhq\.com\/posting-api\/job-board\/([a-z0-9_.-]{2,48})(?:\/|\?|$)/gi },
  { provider: 'workable', re: /https?:\/\/apply\.workable\.com\/([a-z0-9_-]{2,48})(?:\/j\/|\/|\?|$)/gi },
  { provider: 'smartrecruiters', re: /https?:\/\/jobs\.smartrecruiters\.com\/([a-z0-9_-]{2,48})(?:\/|\?|$)/gi },
  { provider: 'recruitee', re: /https?:\/\/([a-z0-9][a-z0-9-]{1,45})\.recruitee\.com(?:\/|$)/gi },
  { provider: 'breezy', re: /https?:\/\/([a-z0-9][a-z0-9-]{1,45})\.breezy\.hr(?:\/|$)/gi }
];

const IGNORED_ATS_SLUGS = new Set([
  'embed', 'jobs', 'careers', 'api', 'v0', 'v1', 'widget', 'accounts', 'apply',
  'search', 'remote', 'company', 'companies', 'postings', 'board', 'boards', 'www'
]);

const AGGREGATOR_COMPANY_NAMES = new Set([
  'remotive', 'himalayas', 'we work remotely', 'remote ok', 'remoteok', 'jobicy',
  'working nomads', 'nodesk', 'jobspresso', 'dailyremote', 'getonboard', 'torre',
  'workana', 'dynamite jobs', 'real work from anywhere', 'flexjobs', 'custom'
]);

export function sanitizeAtsSlug(rawSlug, provider = '') {
  const clean = String(rawSlug || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');
  if (!clean || IGNORED_ATS_SLUGS.has(clean)) return '';
  if (provider === 'recruitee' || provider === 'breezy') {
    const sub = clean.replace(/[^a-z0-9-]/g, '');
    return SUBDOMAIN_SLUG_RE.test(sub) ? sub : '';
  }
  return VALID_SLUG_RE.test(clean) ? clean : '';
}

/**
 * Strict SSRF guard: verifies an ATS API URL belongs exclusively to an allowlisted
 * public HTTPS ATS provider endpoint.
 */
export function isAllowedAtsApiUrl(rawUrl, expectedProvider = '') {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  const host = parsed.hostname.toLowerCase();
  if (expectedProvider && ATS_PROVIDERS[expectedProvider]) {
    return ATS_PROVIDERS[expectedProvider].hostCheck(host);
  }
  return Object.values(ATS_PROVIDERS).some(p => p.hostCheck(host));
}

export function buildCandidateId(provider, slug) {
  return `ats_${provider}_${slug.replace(/[^a-z0-9]+/g, '_')}`;
}

export function buildAtsCandidateRecord({ provider, slug, companyName, domain = '', discoveredFrom = '' }) {
  const cfg = ATS_PROVIDERS[provider];
  if (!cfg) return null;
  const cleanSlug = sanitizeAtsSlug(slug, provider);
  if (!cleanSlug) return null;

  const apiUrl = cfg.buildApiUrl(cleanSlug);
  const boardUrl = cfg.buildBoardUrl(cleanSlug);
  if (!isAllowedAtsApiUrl(apiUrl, provider)) return null;

  const displayName = stripHtml(companyName || '') ||
    cleanSlug.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const companySlug = normalizeCompanySlug(displayName, 'company') || `company:${cleanSlug}`;

  return {
    candidate_id: buildCandidateId(provider, cleanSlug),
    company_slug: companySlug,
    company_name: displayName,
    domain: String(domain || '').toLowerCase().replace(/^www\./, ''),
    ats_provider: provider,
    ats_slug: cleanSlug,
    board_url: boardUrl,
    api_url: apiUrl,
    discovered_from: stripHtml(discoveredFrom || 'aggregator')
  };
}

/**
 * Extracts explicit ATS links AND high-signal recurring company slug probes
 * from a batch of scanned opportunities.
 */
export function extractAtsCandidatesFromItems(items = [], maxSlugProbes = 12) {
  const explicitById = new Map();
  const companyCounts = new Map();

  for (const item of items) {
    if (!item) continue;
    const hay = `${item.url || ''} ${item.description || ''}`;
    const companyName = stripHtml(item.company || '').trim();
    const discoveredFrom = item.platform_id || item.platform_name || 'aggregator';

    // 1. Explicit ATS URL signatures in job URL or description
    for (const pat of EXPLICIT_ATS_URL_PATTERNS) {
      pat.re.lastIndex = 0;
      let m;
      while ((m = pat.re.exec(hay)) !== null) {
        const rec = buildAtsCandidateRecord({
          provider: pat.provider,
          slug: m[1],
          companyName: companyName || m[1],
          discoveredFrom
        });
        if (rec && !explicitById.has(rec.candidate_id)) {
          explicitById.set(rec.candidate_id, { ...rec, match_type: 'explicit_url' });
        }
      }
    }

    // 2. Track recurring company names for slug-based probing (handles masked aggregator URLs)
    const lowComp = companyName.toLowerCase();
    if (
      companyName.length >= 2 &&
      companyName.length <= 45 &&
      !AGGREGATOR_COMPANY_NAMES.has(lowComp) &&
      !/feed|rss|api|board|jobs|careers/i.test(lowComp)
    ) {
      const baseSlug = normalizeCompanySlug(companyName, 'company').replace(/^company:/, '').replace(/_/g, '');
      const hyphenSlug = normalizeCompanySlug(companyName, 'company').replace(/^company:/, '').replace(/_/g, '-');
      if (baseSlug.length >= 2 && !IGNORED_ATS_SLUGS.has(baseSlug)) {
        const prev = companyCounts.get(baseSlug) || {
          companyName,
          slugCompact: baseSlug,
          slugHyphen: hyphenSlug,
          count: 0,
          discoveredFrom
        };
        prev.count += 1;
        companyCounts.set(baseSlug, prev);
      }
    }
  }

  // Generate slug-probe candidates for top recurring companies (Greenhouse, Ashby, Lever)
  const slugCandidates = [];
  const rankedCompanies = Array.from(companyCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, maxSlugProbes);

  for (const comp of rankedCompanies) {
    const slugs = Array.from(new Set([comp.slugCompact, comp.slugHyphen])).filter(Boolean);
    for (const provider of ['greenhouse', 'ashby', 'lever', 'workable']) {
      const rec = buildAtsCandidateRecord({
        provider,
        slug: slugs[0],
        companyName: comp.companyName,
        discoveredFrom: `${comp.discoveredFrom}:slug_probe`
      });
      if (rec && !explicitById.has(rec.candidate_id)) {
        slugCandidates.push({ ...rec, match_type: 'slug_probe', recurrence: comp.count });
      }
    }
  }

  return {
    explicit: Array.from(explicitById.values()),
    slug_probes: slugCandidates
  };
}

/**
 * Formats structured Ashby compensation object if present.
 */
function formatAshbyCompensation(comp) {
  if (!comp || typeof comp !== 'object') return '';
  if (typeof comp.compensationTierSummary === 'string' && comp.compensationTierSummary.trim()) {
    return stripHtml(comp.compensationTierSummary).slice(0, 60);
  }
  const summary = Array.isArray(comp.summaryComponents) ? comp.summaryComponents[0] : null;
  if (summary && summary.minValue && summary.maxValue) {
    const cur = summary.currencyCode || 'USD';
    if (cur === 'USD') {
      return `$${Number(summary.minValue).toLocaleString('en-US')} - $${Number(summary.maxValue).toLocaleString('en-US')}`;
    }
  }
  return '';
}

/**
 * Parses a direct ATS JSON API response into normalized boliviaremote.work opportunity objects.
 */
export function parseAtsResponse(provider, rawText, platform) {
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    return [];
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString().slice(0, 19);
  const companyName = stripHtml(platform.name || platform.company || platform.ats_slug || 'Company');
  const results = [];

  const pushJob = ({ title, location, url, description, tags, publishedAt, compensationUsd }) => {
    const cleanTitle = stripHtml(title || '');
    if (!cleanTitle || cleanTitle.length < 3) return;
    const cleanUrl = sanitizePlatformUrl(url || platform.url || '');
    if (!cleanUrl || isDeadPlatform(cleanUrl, cleanTitle)) return;
    const cleanDesc = stripHtml(description || '').slice(0, 1500);
    let pub = String(publishedAt || todayIso).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pub)) {
      const parsed = new Date(pub);
      pub = !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : todayIso;
    }

    results.push({
      job_hash: computeJobHash(cleanTitle, companyName, cleanUrl),
      platform_id: platform.id,
      platform_name: `${companyName} (${ATS_PROVIDERS[provider]?.label || provider})`,
      category: platform.category || 'Empresas Directas (ATS)',
      track: platform.track || 'Track F: Curated Remote-First & WFA Job Boards',
      contract_caveat: platform.contract_caveat || 'fractional_or_fulltime',
      source_type: 'direct_ats',
      ats_provider: provider,
      title: cleanTitle,
      company: companyName,
      location: stripHtml(location || 'Remote Worldwide') || 'Remote Worldwide',
      url: cleanUrl,
      description: cleanDesc,
      tags: stripHtml(tags || `direct-ats, ${provider}, remote`),
      compensation_usd: stripHtml(compensationUsd || ''),
      published_at: pub,
      discovered_at: nowIso
    });
  };

  if (provider === 'greenhouse') {
    const jobs = Array.isArray(data && data.jobs) ? data.jobs : [];
    for (const j of jobs.slice(0, 100)) {
      const dept = Array.isArray(j.departments) ? j.departments.map(d => d.name).filter(Boolean).join(', ') : '';
      pushJob({
        title: j.title,
        location: (j.location && j.location.name) || 'Remote',
        url: j.absolute_url,
        description: j.content || '',
        tags: [dept, 'greenhouse', 'direct-ats'].filter(Boolean).join(', '),
        publishedAt: j.updated_at || j.first_published
      });
    }
    return results;
  }

  if (provider === 'lever') {
    const jobs = Array.isArray(data) ? data : [];
    for (const j of jobs.slice(0, 100)) {
      const cat = j.categories || {};
      const locParts = [cat.location, j.workplaceType === 'remote' ? 'Remote' : ''].filter(Boolean);
      const desc = j.descriptionPlain || j.description ||
        (Array.isArray(j.lists) ? j.lists.map(l => `${l.text}: ${l.content}`).join(' ') : '');
      pushJob({
        title: j.text,
        location: locParts.join(' · ') || 'Remote',
        url: j.hostedUrl || j.applyUrl,
        description: desc,
        tags: [cat.team, cat.department, cat.commitment, 'lever', 'direct-ats'].filter(Boolean).join(', '),
        publishedAt: j.createdAt ? new Date(j.createdAt).toISOString().slice(0, 10) : todayIso
      });
    }
    return results;
  }

  if (provider === 'ashby') {
    const jobs = Array.isArray(data && data.jobs) ? data.jobs : [];
    for (const j of jobs.slice(0, 100)) {
      const secLocs = Array.isArray(j.secondaryLocations)
        ? j.secondaryLocations.map(l => l.location).filter(Boolean)
        : [];
      const locText = [
        j.isRemote ? 'Remote' : '',
        j.location || '',
        ...secLocs.slice(0, 3)
      ].filter(Boolean).join(' · ');
      pushJob({
        title: j.title,
        location: locText || (j.isRemote ? 'Remote Worldwide' : ''),
        url: j.jobUrl || j.applyUrl,
        description: j.descriptionPlain || j.descriptionHtml || '',
        tags: [j.department, j.team, j.employmentType, 'ashby', 'direct-ats'].filter(Boolean).join(', '),
        publishedAt: j.publishedAt,
        compensationUsd: formatAshbyCompensation(j.compensation)
      });
    }
    return results;
  }

  if (provider === 'workable') {
    const jobs = Array.isArray(data && data.jobs) ? data.jobs : [];
    for (const j of jobs.slice(0, 100)) {
      const loc = [
        j.telecommuting ? 'Remote' : '',
        j.city,
        j.country
      ].filter(Boolean).join(', ');
      pushJob({
        title: j.title,
        location: loc || (j.telecommuting ? 'Remote Worldwide' : ''),
        url: j.url || j.application_url,
        description: `${j.title || ''} ${j.department || ''} ${loc}`,
        tags: [j.department, j.employment_type, 'workable', 'direct-ats'].filter(Boolean).join(', '),
        publishedAt: j.published_on || j.created_at
      });
    }
    return results;
  }

  if (provider === 'smartrecruiters') {
    const jobs = Array.isArray(data && data.content) ? data.content : [];
    for (const j of jobs.slice(0, 100)) {
      const locObj = j.location || {};
      const loc = [
        locObj.remote ? 'Remote' : '',
        locObj.city,
        locObj.country
      ].filter(Boolean).join(', ');
      const jobUrl = j.id ? `https://jobs.smartrecruiters.com/${platform.ats_slug}/${j.id}` : platform.url;
      pushJob({
        title: j.name,
        location: loc || (locObj.remote ? 'Remote Worldwide' : ''),
        url: jobUrl,
        description: `${j.name || ''} ${(j.department && j.department.label) || ''} ${loc}`,
        tags: [j.department && j.department.label, 'smartrecruiters', 'direct-ats'].filter(Boolean).join(', '),
        publishedAt: j.releasedDate
      });
    }
    return results;
  }

  if (provider === 'recruitee') {
    const jobs = Array.isArray(data && data.offers) ? data.offers : [];
    for (const j of jobs.slice(0, 100)) {
      const loc = [
        j.remote ? 'Remote' : '',
        j.location,
        j.country
      ].filter(Boolean).join(', ');
      pushJob({
        title: j.title,
        location: loc || (j.remote ? 'Remote Worldwide' : ''),
        url: j.careers_url || j.careers_apply_url,
        description: `${j.description || ''} ${j.requirements || ''}`,
        tags: [j.department, j.employment_type_code, 'recruitee', 'direct-ats'].filter(Boolean).join(', '),
        publishedAt: j.published_at || j.created_at
      });
    }
    return results;
  }

  if (provider === 'breezy') {
    const jobs = Array.isArray(data) ? data : [];
    for (const j of jobs.slice(0, 100)) {
      const locObj = j.location || {};
      const loc = [
        locObj.is_remote ? 'Remote' : '',
        locObj.name || '',
        locObj.country && locObj.country.name ? locObj.country.name : ''
      ].filter(Boolean).join(', ');
      pushJob({
        title: j.name,
        location: loc || (locObj.is_remote ? 'Remote Worldwide' : ''),
        url: j.url,
        description: `${j.name || ''} ${j.department || ''} ${loc}`,
        tags: [j.department, j.type && j.type.name, 'breezy', 'direct-ats'].filter(Boolean).join(', '),
        publishedAt: j.published_date || j.creation_date
      });
    }
    return results;
  }

  return results;
}

/**
 * Parses GetOnBoard's public JSON:API v0 response (`{ data: [{ id, attributes, links }] }`).
 */
export function parseGetOnBoardApi(rawText, platform) {
  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return [];
  }
  const rows = Array.isArray(payload && payload.data) ? payload.data : [];
  if (rows.length === 0) return [];

  const todayIso = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString().slice(0, 19);
  const results = [];

  for (const row of rows.slice(0, 80)) {
    const attr = (row && row.attributes) || {};
    const title = stripHtml(attr.title || '');
    if (!title || title.length < 3) continue;

    const compData = attr.company && attr.company.data && attr.company.data.attributes;
    const company = stripHtml((compData && compData.name) || attr.company_name || 'Empresa en GetOnBoard');
    const url = sanitizePlatformUrl((row.links && row.links.public_url) || `https://www.getonbrd.com/jobs/${row.id}`);
    if (!url || isDeadPlatform(url, title)) continue;

    const countries = Array.isArray(attr.countries) ? attr.countries.join(', ') : '';
    const loc = attr.remote
      ? (attr.remote_zone ? `Remoto ${attr.remote_zone}` : (countries ? `Remoto (${countries})` : 'Remoto LATAM'))
      : (countries || 'LATAM');

    let compUsd = '';
    if (attr.min_salary && attr.max_salary) {
      compUsd = `$${attr.min_salary} - $${attr.max_salary}/mo USD`;
    } else if (attr.max_salary) {
      compUsd = `$${attr.max_salary}/mo USD`;
    }

    const pubDate = attr.published_at
      ? new Date(Number(attr.published_at) * 1000).toISOString().slice(0, 10)
      : todayIso;

    const desc = stripHtml(`${attr.description_headline || ''} ${attr.description || ''} ${attr.functions || ''}`).slice(0, 1500);
    results.push({
      job_hash: computeJobHash(title, company, url),
      platform_id: platform.id || 'getonboard',
      platform_name: platform.name || 'GetOnBoard',
      category: platform.category || 'Category 2: Vetted Global & Nearshore LATAM Networks',
      track: platform.track || 'Track C: Vetted Global & Nearshore LATAM Networks',
      contract_caveat: platform.contract_caveat || 'fractional_or_fulltime',
      title,
      company,
      location: stripHtml(loc),
      url,
      description: desc,
      tags: stripHtml([attr.category_name, attr.modality, 'getonboard', 'latam', 'remoto'].filter(Boolean).join(', ')),
      compensation_usd: compUsd,
      published_at: pubDate,
      discovered_at: nowIso
    });
  }

  return results;
}
