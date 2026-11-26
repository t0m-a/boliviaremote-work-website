/**
 * Zero-PII Privacy Guard & Deterministic Normalization Utilities (v6.0.0)
 * Enforces ADR-06 (Zero-PII) in RAM before embedding, FTS5 querying, or persisting URLs:
 *   - Ephemeral query PII scrubber (emails, phone numbers, URLs, @handles, long ID numbers)
 *   - Tracking parameter stripper for scanned platform & job URLs
 *   - Deterministic company/platform slug normalizer for BoliviaCareerBrainDO lookups
 *   - Deterministic Ghost-Job risk calculator from job_sightings telemetry
 */

import { stripHtml } from './scanner.js';

// Functional job-board ID & routing query parameters that must NEVER be stripped
const FUNCTIONAL_JOB_PARAMS = new Set([
  'gh_jid', 'ashby_jid', 'jid', 'job_id', 'jobid', 'posting_id', 'postingid',
  'vacancy_id', 'offer_id', 'position_id', 'req', 'req_id', 'requisition_id',
  'id', 'uid', 'sid', 'token', 'job_token', 'board', 'company', 'team',
  'department', 'location', 'lang', 'locale', 'page', 'p'
]);

const TRACKING_PARAM_PREFIXES = ['utm_', 'mc_', 'hsa_', 'ga_', 'pk_', 'mtm_', 'vero_'];
const TRACKING_PARAM_EXACT = new Set([
  'fbclid', 'gclid', 'dclid', 'msclkid', 'yclid', 'twclid', 'li_fat_id',
  'ref', 'ref_src', 'ref_url', 'referrer', 'gh_src', 'lever-source',
  'lever-origin', 'source', 'src', 'trk', 'tracking', 'trackingid', 'campaign',
  'session', 'session_id', 'auth', 'access_token', 'email',
  'user', 'user_id', 'applicant_id', 'candidate_id', 'mkt_tok'
]);

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>()]+/gi;
const HANDLE_RE = /(?:^|[\s(,;])@[a-z0-9_.-]{2,32}\b/gi;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\b\d{3,4}[\s.-]?\d{3,4}(?:[\s.-]?\d{2,4})?\b/g;
const LONG_ID_RE = /\b\d{7,}\b/g;

/**
 * Strips PII patterns (emails, URLs, @handles, phone numbers, long numeric IDs) in RAM.
 * Queries are never persisted or logged.
 */
export function scrubEphemeralPii(rawText) {
  let text = stripHtml(rawText || '');
  if (!text) {
    return { cleanText: '', redactedCount: 0 };
  }

  let redactedCount = 0;
  const replaceAndCount = (regex) => {
    text = text.replace(regex, (match) => {
      // Avoid redacting short salary numbers or years like "2026" or "4000"
      if (regex === PHONE_RE) {
        const digits = match.replace(/\D/g, '');
        if (digits.length < 7) return match;
      }
      redactedCount++;
      return ' ';
    });
  };

  replaceAndCount(EMAIL_RE);
  replaceAndCount(URL_RE);
  replaceAndCount(HANDLE_RE);
  replaceAndCount(PHONE_RE);
  replaceAndCount(LONG_ID_RE);

  const cleanText = text.replace(/\s+/g, ' ').trim();
  return { cleanText, redactedCount };
}

/**
 * Decodes XML/HTML character entities commonly found in RSS/Atom/HTML link attributes
 * (e.g. `&amp;` -> `&`, `&#38;` -> `&`, `&#x26;` -> `&`) without altering valid URL encoding.
 */
export function decodeUrlEntities(rawUrl) {
  if (!rawUrl) return '';
  let str = String(rawUrl)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .trim();
  for (let pass = 0; pass < 2; pass++) {
    const next = str
      .replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
        const code = parseInt(hex, 16);
        return code >= 32 && code <= 126 ? String.fromCharCode(code) : match;
      })
      .replace(/&#(\d+);/g, (match, dec) => {
        const code = Number(dec);
        return code >= 32 && code <= 126 ? String.fromCharCode(code) : match;
      })
      .replace(/&apos;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&');
    if (next === str) break;
    str = next;
  }
  return str.trim();
}

function isTrackingParam(rawKey) {
  let decodedKey = rawKey;
  try {
    decodedKey = decodeURIComponent(rawKey.replace(/\+/g, ' '));
  } catch {
    // Keep rawKey if malformed percent-encoding
  }
  const low = decodedKey.trim().toLowerCase();
  if (!low || FUNCTIONAL_JOB_PARAMS.has(low)) return false;
  return (
    TRACKING_PARAM_EXACT.has(low) ||
    TRACKING_PARAM_PREFIXES.some(pref => low.startsWith(pref))
  );
}

/**
 * Removes tracking/PII query parameters while preserving remaining functional parameters
 * verbatim (no `%20` -> `+` re-encoding or unnecessary mutation).
 */
function stripTrackingQueryString(rawQuery) {
  if (!rawQuery) return '';
  const segments = rawQuery.split('&').filter(Boolean);
  let removedAny = false;
  const kept = [];
  for (const seg of segments) {
    const eqIdx = seg.indexOf('=');
    const rawKey = eqIdx >= 0 ? seg.slice(0, eqIdx) : seg;
    if (isTrackingParam(rawKey)) {
      removedAny = true;
      continue;
    }
    kept.push(seg);
  }
  return removedAny ? kept.join('&') : rawQuery;
}

/**
 * Preserves SPA hash routes (`#/...` and `#!/...`) while stripping plain anchor fragments (`#apply`, `#top`, `#`).
 * Cleans tracking parameters inside hash-route query strings without altering functional route params.
 */
function sanitizeHashFragment(rawHash) {
  if (!rawHash) return '';
  if (!/^#!?\/.+/.test(rawHash)) {
    return '';
  }
  const qIdx = rawHash.indexOf('?');
  if (qIdx === -1) {
    return rawHash;
  }
  const routePart = rawHash.slice(0, qIdx);
  const queryPart = rawHash.slice(qIdx + 1);
  const cleanedQuery = stripTrackingQueryString(queryPart);
  return cleanedQuery ? `${routePart}?${cleanedQuery}` : routePart;
}

/**
 * Validates an HTTP(S) URL, decodes XML/HTML entities, strips credentials, non-route anchors,
 * and tracking/PII query parameters while preserving functional job IDs and SPA hash routes (`#/...`).
 */
export function sanitizePlatformUrl(rawUrl) {
  const input = decodeUrlEntities(rawUrl);
  if (!input) return '';

  let candidate = input;
  if (candidate.startsWith('//')) {
    candidate = `https:${candidate}`;
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    if (!/^https?:/i.test(candidate)) {
      return '';
    }
  } else {
    candidate = `https://${candidate}`;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return input;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return '';
  }

  const rawSearch = parsed.search ? parsed.search.slice(1) : '';
  const cleanedSearch = stripTrackingQueryString(rawSearch);
  const cleanedHash = sanitizeHashFragment(parsed.hash);
  const hadCredentials = Boolean(parsed.username || parsed.password);
  const searchChanged = cleanedSearch !== rawSearch;
  const hashChanged = cleanedHash !== parsed.hash;

  if (!hadCredentials && !searchChanged && !hashChanged) {
    return parsed.toString();
  }

  parsed.username = '';
  parsed.password = '';
  parsed.search = cleanedSearch ? `?${cleanedSearch}` : '';
  parsed.hash = cleanedHash;

  return parsed.toString();
}

/**
 * Produces a normalized canonical slug for an employer or platform entity
 * (e.g. "Deel Inc." -> "company:deel", "Outlier AI" -> "company:outlier_ai").
 */
export function normalizeCompanySlug(name, prefix = 'company') {
  const clean = stripHtml(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(?:inc|llc|ltd|corp|corporation|gmbh|s\.a\.|s\.r\.l\.|technologies|technology|labs|group|holdings|feed|rss|api)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  if (!clean) return '';
  return `${prefix}:${clean}`;
}

/**
 * Parses a YYYY-MM-DD or ISO date into Unix epoch seconds.
 */
export function parseDateToEpochSeconds(dateStr, fallbackNowSec = Math.floor(Date.now() / 1000)) {
  const raw = String(dateStr || '').trim();
  if (!raw) return fallbackNowSec;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return fallbackNowSec;
  return Math.floor(ms / 1000);
}

/**
 * Deterministic Ghost-Job Risk Classifier from cross-board sighting history:
 *   - 'high': repost_span_days >= 60 OR distinctRepostUrls >= 4
 *   - 'watch': repost_span_days >= 30 AND distinctRepostUrls >= 2
 *   - 'none': otherwise
 */
export function computeGhostJobMetrics(sighting, nowEpochSec = Math.floor(Date.now() / 1000)) {
  const firstSeen = Number(sighting && sighting.first_seen_epoch) || nowEpochSec;
  const lastSeen = Math.max(firstSeen, Number(sighting && sighting.last_seen_epoch) || nowEpochSec);
  const repostSpanDays = Math.max(0, Math.floor((lastSeen - firstSeen) / 86400));

  let distinctHashes = [];
  let distinctUrls = [];
  try {
    distinctHashes = Array.isArray(sighting.distinct_job_hashes)
      ? sighting.distinct_job_hashes
      : JSON.parse(sighting.distinct_job_hashes_json || '[]');
  } catch {
    distinctHashes = [];
  }
  try {
    distinctUrls = Array.isArray(sighting.distinct_urls)
      ? sighting.distinct_urls
      : JSON.parse(sighting.distinct_urls_json || '[]');
  } catch {
    distinctUrls = [];
  }

  const distinctRepostCount = Math.max(distinctHashes.length, distinctUrls.length, 1);
  const scanHits = Math.max(1, Number(sighting && sighting.scan_hits) || 1);

  let ghostRisk = 'none';
  if (repostSpanDays >= 60 || distinctRepostCount >= 4) {
    ghostRisk = 'high';
  } else if (repostSpanDays >= 30 && distinctRepostCount >= 2) {
    ghostRisk = 'watch';
  }

  return {
    first_seen_epoch: firstSeen,
    last_seen_epoch: lastSeen,
    repost_span_days: repostSpanDays,
    distinct_repost_count: distinctRepostCount,
    sighting_count: scanHits,
    ghost_risk: ghostRisk
  };
}
