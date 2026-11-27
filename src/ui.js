/**
 * Self-Contained UI Generator (Spanish Bolivia 'es-BO')
 * Renders the complete interactive application with embedded data, on-the-fly Results generation,
 * customizable filters, in-app User Manual, Legal & Tax Guide, and 15-minute automatic state sync.
 */

import {
  POSITION_CATEGORIES,
  LANGUAGE_OPTIONS,
  EXPERIENCE_OPTIONS,
  CONTRACT_OPTIONS,
  DEFAULT_FILTERS,
  checkBoliviaRemoteEligibility,
  detectOfferAttributes,
  evaluateOpportunity,
  evaluateAllOpportunities,
  generateResultsMarkdown
} from './evaluator.js';
import { FAVICON_DATA_URI } from './favicon.js';
import { LEGAL_TAX_GUIDE_HTML } from './legal_tax_guide.js';
import { computeMarketPulseMetrics, buildDeterministicPulseNarrative } from './nightly_sleep.js';

const SSR_DESCRIPTION_MAX_CHARS = 450;

function compactOpportunityForClient(opp) {
  if (!opp || typeof opp !== 'object') return opp;
  const rawDesc = String(opp.description || '');
  if (rawDesc.length <= SSR_DESCRIPTION_MAX_CHARS) return opp;
  const cut = rawDesc.slice(0, SSR_DESCRIPTION_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmedDesc = (lastSpace > 260 ? cut.slice(0, lastSpace) : cut).trim() + '...';
  return { ...opp, description: trimmedDesc };
}

export function renderAppHtml(initialState, options = {}) {
  const {
    opportunities = [],
    platforms = [],
    lastScanAt = new Date().toISOString(),
    marketPulse: providedMarketPulse = null
  } = initialState;
  const rawInitView = options && options.initialView ? String(options.initialView) : 'results';
  const initialView = rawInitView === 'legal-tax' ? 'legal-tax' : (rawInitView === 'pulse' ? 'pulse' : 'results');
  const isInitialLegalTax = initialView === 'legal-tax';
  const isInitialPulse = initialView === 'pulse';
  const pageTitle = isInitialLegalTax
    ? 'Guía Legal y Fiscal (EE. UU. y Bolivia) — Bolivia Remote Work'
    : (isInitialPulse
      ? 'Pulso del Mercado Remoto desde Bolivia — Bolivia Remote Work'
      : 'Empleos Remotos desde Bolivia — Buscador y Evaluador en Vivo');
  const pageDescription = isInitialLegalTax
    ? 'Guía legal y fiscal actualizada para contratistas independientes y trabajadores remotos en Bolivia que prestan servicios a empresas de Estados Unidos (W-8BEN, IRC 862, SIN/SIAT, RC-IVA y visa B-1).'
    : (isInitialPulse
      ? 'Síntesis nocturna del mercado laboral remoto elegible desde Bolivia: categorías más demandadas en español e inglés, tarifas USD observadas y empresas directas ATS verificadas.'
      : 'Herramienta pública para filtrar y evaluar ofertas de trabajo remotas elegibles desde Bolivia según tus idiomas, área profesional, experiencia y tipo de contrato.');

  const eligibleOpportunities = (opportunities || [])
    .filter(o => o && (o.bolivia_eligible === 1 || o.bolivia_eligible === true || checkBoliviaRemoteEligibility(o).eligible));
  const clientOpportunities = eligibleOpportunities.map(compactOpportunityForClient);
  const activePlatforms = (platforms || []).filter(p => p && p.enabled !== false);
  const activePlatformsCount = activePlatforms.length;
  const fallbackMetrics = providedMarketPulse ? null : computeMarketPulseMetrics(eligibleOpportunities, platforms);
  const marketPulse = providedMarketPulse || { ...fallbackMetrics, ...buildDeterministicPulseNarrative(fallbackMetrics) };

  const clientPayload = JSON.stringify({
    opportunities: clientOpportunities,
    platforms,
    lastScanAt,
    marketPulse,
    initialView,
    POSITION_CATEGORIES,
    LANGUAGE_OPTIONS,
    EXPERIENCE_OPTIONS,
    CONTRACT_OPTIONS,
    DEFAULT_FILTERS
  }).replace(/<\//g, '<\\/');

  return `<!DOCTYPE html>
<html lang="es-BO">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <link rel="icon" type="image/svg+xml" href="${FAVICON_DATA_URI}">
  <link rel="alternate icon" type="image/x-icon" href="/favicon.ico">
  <link rel="alternate icon" type="image/png" href="/favicon.png">
  <link rel="apple-touch-icon" href="/favicon.png">
  <meta name="description" content="${pageDescription}">
  <script>
    (function() {
      try {
        var t = localStorage.getItem('bolivia_remote_theme');
        if (t === 'dark' || (!t && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark-mode');
        }
      } catch (e) {}
    })();
  </script>
  <style>
    :root {
      --bg-page: #fafafa;
      --bg-card: #ffffff;
      --bg-well: #f4f4f5;
      --bg-well-hover: #e4e4e7;
      --text-main: #18181b;
      --text-secondary: #52525b;
      --text-muted: #71717a;
      --border-hairline: rgba(24, 24, 27, 0.08);
      --border-control: rgba(24, 24, 27, 0.14);
      --border-strong: rgba(24, 24, 27, 0.24);
      --accent-primary: #18181b;
      --accent-hover: #27272a;
      --accent-fg: #ffffff;
      --accent-secondary: #18181b;
      --link-color: #18181b;
      --link-hover: #52525b;
      --bolivia-red: #dc2626;
      --bolivia-yellow: #eab308;
      --bolivia-green: #16a34a;
      --apply-bg: #ecfdf5;
      --apply-border: #10b981;
      --apply-text: #065f46;
      --possible-bg: #fffbeb;
      --possible-border: #f59e0b;
      --possible-text: #92400e;
      --skip-bg: #f4f4f5;
      --skip-border: #a1a1aa;
      --skip-text: #52525b;
      --geo-bg: #fef2f2;
      --geo-border: #ef4444;
      --geo-text: #991b1b;
      --font-head: "Bahnschrift", "Segoe UI Variable Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --font-body: "Segoe UI Variable Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --font-mono: "Consolas", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      color: var(--text-main);
      background-color: var(--bg-page);
      font-family: var(--font-body);
      line-height: 1.55;
      overflow-x: clip;
      max-width: 100%;
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3, h4, h5, p, span, a, li, label, .opp-card, .panel-card, .manual-card, .radar-box, .scan-alert, footer {
      overflow-wrap: break-word;
      word-wrap: break-word;
    }
    .bolivia-stripe {
      height: 0;
      display: none;
    }
    button, a, label, input[type="checkbox"], .chip, .btn-tab, .btn-action, .pos-dropdown-toggle, .pos-dropdown-option {
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }

    /* STICKY SWISS NAVBAR */
    #navbar {
      position: sticky;
      top: 0;
      left: 0;
      margin-top: 0;
      width: 100%;
      height: auto;
      border-bottom: 1px solid var(--border-hairline);
      background: rgba(255, 255, 255, 0.94);
      z-index: 1100;
      display: flex;
      flex-direction: column;
      transition: background 0.2s ease, border-color 0.2s ease;
    }
    #navbar.navbar-scrolled {
      background: rgba(255, 255, 255, 0.80);
      -webkit-backdrop-filter: blur(12px) saturate(140%);
      backdrop-filter: blur(12px) saturate(140%);
      border-bottom-color: var(--border-hairline);
    }
    .navbar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      max-width: 1360px;
      margin: 0 auto;
      padding: 13px 24px;
      background: transparent;
      width: 100%;
      position: relative;
    }
    .header-title {
      font-family: var(--font-head);
      font-size: 1.24em;
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: 1.15;
      color: var(--text-main);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .header-title::before {
      content: "";
      display: inline-block;
      width: 24px;
      height: 8px;
      flex-shrink: 0;
      background: no-repeat center / contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='8' viewBox='0 0 24 8'%3E%3Ccircle cx='3.5' cy='4' r='2.8' fill='%23dc2626'/%3E%3Ccircle cx='12' cy='4' r='2.8' fill='%23eab308'/%3E%3Ccircle cx='20.5' cy='4' r='2.8' fill='%2316a34a'/%3E%3C/svg%3E");
    }
    #nav-brand-title {
      color: var(--text-main);
      display: inline-block;
    }
    .navbar-header-actions {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .btn-theme-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      min-width: 34px;
      min-height: 34px;
      padding: 0;
      border-radius: 7px;
      border: 1px solid var(--border-control);
      background: var(--bg-card);
      color: var(--text-secondary);
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
      line-height: 1;
      flex-shrink: 0;
    }
    .btn-theme-toggle:hover {
      background: var(--bg-well);
      border-color: var(--border-strong);
      color: var(--text-main);
    }
    .theme-symbol {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .theme-symbol svg {
      display: block;
    }
    .sidebar-fold-btn,
    #sidebar-unfold-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: auto;
      height: 34px;
      padding: 6px 13px;
      border: 1px solid var(--border-control);
      border-radius: 7px;
      background: var(--bg-card);
      color: var(--text-main);
      font-family: var(--font-body);
      font-size: 0.84em;
      font-weight: 600;
      line-height: 1.35;
      cursor: pointer;
      flex-shrink: 0;
      touch-action: manipulation;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .hamburger-label {
      display: inline-block;
      line-height: 1;
    }
    .sidebar-fold-btn:hover,
    #sidebar-unfold-btn:hover {
      background: var(--bg-well);
      border-color: var(--border-strong);
      color: var(--text-main);
    }
    .hamburger-icon {
      display: inline-flex;
      flex-direction: column;
      justify-content: space-between;
      width: 15px;
      height: 11px;
    }
    .hamburger-icon span {
      display: block;
      height: 1.8px;
      width: 100%;
      background: currentColor;
      border-radius: 1px;
    }
    #navbar ul {
      position: absolute;
      top: calc(100% + 6px);
      right: max(24px, calc((100vw - 1360px) / 2 + 24px));
      width: min(310px, calc(100vw - 32px));
      max-height: calc(100vh - 76px);
      margin: 0;
      padding: 6px;
      overflow-y: auto;
      list-style: none;
      background: var(--bg-card);
      border: 1px solid var(--border-control);
      border-radius: 10px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
      z-index: 950;
      opacity: 1;
      transform: translateY(0);
      visibility: visible;
      pointer-events: auto;
      transition: opacity 0.22s ease, transform 0.22s ease, visibility 0.22s ease;
    }
    body.sidebar-collapsed #navbar ul {
      opacity: 0;
      transform: translateY(-6px);
      visibility: hidden;
      pointer-events: none;
    }
    #navbar li {
      border-bottom: none;
      margin-bottom: 2px;
    }
    #navbar li:last-child {
      margin-bottom: 0;
    }
    #navbar li.nav-group-header {
      background: transparent;
      padding: 9px 12px;
      border-radius: 6px;
      font-size: 0.85em;
      font-weight: 600;
      text-transform: capitalize;
      letter-spacing: normal;
      color: var(--text-muted);
    }
    #navbar li.nav-collapsible-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s ease, color 0.15s ease;
    }
    #navbar li.nav-collapsible-header:hover {
      background: var(--bg-well);
      color: var(--text-main);
    }
    .nav-caret {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-right: 1.8px solid currentColor;
      border-bottom: 1.8px solid currentColor;
      transform: rotate(-45deg);
      transition: transform 0.2s ease;
      margin-left: 8px;
      flex-shrink: 0;
    }
    #navbar li.nav-collapsible-header.expanded .nav-caret {
      transform: rotate(45deg);
    }
    #navbar li.nav-payment-item.nav-payment-folded,
    #navbar li.nav-creator-item.nav-creator-folded {
      display: none !important;
    }
    #navbar li.nav-payment-item a {
      padding-left: 22px;
      font-size: 0.85em;
    }
    #navbar li.nav-payment-desc,
    #navbar li.nav-creator-desc {
      padding: 10px 14px;
      margin: 4px 6px;
      border-radius: 7px;
      background: var(--bg-well);
    }
    #navbar li.nav-payment-desc p,
    #navbar li.nav-creator-desc p {
      margin: 0 0 8px 0;
      font-size: 0.79em;
      line-height: 1.5;
      color: var(--text-secondary);
    }
    #navbar li.nav-payment-desc p:last-child,
    #navbar li.nav-creator-desc p:last-child {
      margin-bottom: 0;
    }
    #navbar li.nav-payment-desc p strong,
    #navbar li.nav-creator-desc p strong {
      color: var(--text-main);
    }
    #navbar li.nav-creator-desc p a {
      display: inline;
      padding: 0;
      color: var(--link-color);
      text-decoration: underline;
      text-underline-offset: 2px;
      font-size: inherit;
      font-weight: 600;
      background: transparent;
    }
    #navbar li.nav-creator-desc p a:hover {
      background: transparent;
      color: var(--link-hover);
    }
    #navbar a {
      display: block;
      padding: 9px 12px;
      border-radius: 6px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.87em;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    #navbar a:hover,
    #navbar a.active-nav {
      background: var(--bg-well);
      color: var(--text-main);
      font-weight: 600;
    }
    #navbar a#nav-manual,
    #navbar a#nav-legal-tax {
      background: transparent;
      color: var(--text-main);
      font-weight: 600;
    }
    #navbar a#nav-manual:hover,
    #navbar a#nav-manual.active-nav,
    #navbar a#nav-legal-tax:hover,
    #navbar a#nav-legal-tax.active-nav {
      background: var(--bg-well);
      color: var(--text-main);
    }

    /* MAIN READING MEASURE */
    #main-doc,
    body.sidebar-collapsed #main-doc {
      margin: 0 auto;
      max-width: 1360px;
      width: 100%;
      box-sizing: border-box;
      padding: 24px 24px 64px 24px;
      transition: padding 0.2s ease;
    }
    body.sidebar-collapsed .top-banner,
    body.sidebar-collapsed .panel-card,
    body.sidebar-collapsed .kpi-grid,
    body.sidebar-collapsed .toolbar,
    body.sidebar-collapsed #view-results,
    body.sidebar-collapsed #view-manual,
    body.sidebar-collapsed #view-legal-tax,
    body.sidebar-collapsed #view-report,
    body.sidebar-collapsed #view-platforms,
    body.sidebar-collapsed #view-pulse,
    body.sidebar-collapsed .manual-container,
    body.sidebar-collapsed .manual-card,
    body.sidebar-collapsed .report-box,
    body.sidebar-collapsed #footer-text {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box;
    }
    body.view-manual-active .top-banner,
    body.view-manual-active #custom-filters-panel,
    body.view-manual-active #ai-cv-panel,
    body.view-manual-active .kpi-grid,
    body.view-manual-active .toolbar {
      display: none !important;
    }

    /* TOP BANNER */
    .top-banner {
      background: var(--bg-card);
      color: var(--text-main);
      border: 1px solid var(--border-hairline);
      padding: 18px 24px;
      border-radius: 10px;
      margin-bottom: 18px;
      box-shadow: none;
    }
    .banner-header-block {
      width: 100%;
      margin-bottom: 0;
    }
    .top-banner p,
    .banner-subtitle-line {
      margin: 0;
      color: var(--text-secondary);
      font-family: inherit;
      font-size: 0.93em;
      font-weight: 400;
      line-height: 1.58;
    }
    .top-banner h1,
    #banner-title {
      display: inline;
      margin: 0;
      font-family: var(--font-head);
      font-size: inherit;
      font-weight: 600;
      letter-spacing: -0.015em;
      color: var(--text-main);
      line-height: inherit;
    }
    .banner-inline-sep {
      display: inline;
      margin: 0 7px;
      opacity: 0.45;
    }
    #banner-subtitle {
      display: inline;
      margin: 0;
      font-size: inherit;
      line-height: inherit;
    }

    /* PANELS & BORDERLESS FILTER WELLS */
    .panel-card {
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      border-radius: 10px;
      padding: 22px 26px;
      margin-bottom: 18px;
      box-shadow: none;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 16px;
      padding-bottom: 0;
      border-bottom: none;
    }
    .panel-header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      max-width: 100%;
    }
    #custom-filters-panel {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      column-gap: 0;
    }
    .filters-panel-header {
      grid-column: 1;
      grid-row: 1;
      padding-right: 12px;
      min-width: 0;
    }
    .filters-reset-actions {
      grid-column: 2;
      grid-row: 1;
      margin-bottom: 16px;
      padding-bottom: 0;
      border-bottom: none;
      align-self: stretch;
      justify-content: flex-end;
    }
    #custom-filters-panel > .filter-grid {
      grid-column: 1 / -1;
      grid-row: 2;
    }
    #custom-filters-panel > .filter-block-full {
      grid-column: 1 / -1;
      grid-row: 3;
    }
    .panel-title {
      margin: 0;
      font-family: var(--font-head);
      font-size: 1.06em;
      font-weight: 600;
      letter-spacing: -0.015em;
      color: var(--text-main);
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      flex: 1 1 240px;
      min-width: 0;
      line-height: 1.35;
    }
    .meta-hint {
      font-size: 0.78em;
      font-weight: 400;
      color: var(--text-muted);
    }
    .meta-hint-sub {
      display: inline-block;
      font-size: 0.83em;
      font-weight: 400;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .filter-inline-action {
      border: none;
      background: transparent;
      color: var(--text-main);
      font-family: var(--font-body);
      font-size: 0.8em;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
      text-underline-offset: 2px;
      transition: color 0.15s ease;
    }
    .filter-inline-action:hover {
      color: var(--text-secondary);
    }
    .filter-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: stretch;
      width: 100%;
    }
    .filter-block {
      background: var(--bg-well);
      border: none;
      border-radius: 8px;
      padding: 13px 15px;
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
    }
    .filter-block-langs {
      flex: 0 1 auto;
      width: fit-content;
      max-width: 100%;
    }
    .filter-block-langs .filter-block-label {
      justify-content: flex-start;
      gap: 8px;
    }
    .filter-block-langs .chip-group {
      width: auto;
    }
    .filter-block-grow {
      flex: 1 1 230px;
      min-width: min(100%, 220px);
    }
    .filter-block-full {
      width: 100%;
      flex: 1 1 100%;
    }
    .filter-block-label {
      font-size: 0.83em;
      font-weight: 600;
      color: var(--text-main);
      margin-bottom: 9px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }
    .strict-pos-label {
      font-size: 0.82em;
      font-weight: 500;
      color: var(--text-secondary);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      cursor: pointer;
    }
    .keywords-input-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 14px;
      align-items: center;
      margin-top: 6px;
      width: 100%;
    }
    .keywords-input-row .input-text {
      flex: 1 1 260px;
      min-width: 0;
      width: auto;
    }
    .keywords-input-row #lbl-weight-pos {
      flex: 0 1 auto;
      max-width: 100%;
      line-height: 1.4;
    }

    /* DROPDOWNS & CHIPS */
    .pos-dropdown {
      position: relative;
      flex: 1 1 320px;
      min-width: 0;
      max-width: 100%;
    }
    .pos-dropdown.filter-dropdown-full {
      flex: none;
      width: 100%;
      min-width: 0;
    }
    .pos-dropdown .pos-dropdown-menu {
      width: 100%;
      min-width: 100%;
      max-width: 100%;
    }
    .pos-dropdown-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      cursor: pointer;
      text-align: left;
      font-weight: 500;
    }
    .pos-dropdown-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1 1 auto;
      min-width: 0;
    }
    .pos-dropdown-caret {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-right: 1.8px solid var(--text-muted);
      border-bottom: 1.8px solid var(--text-muted);
      transform: rotate(45deg);
      transition: transform 0.18s ease;
      flex-shrink: 0;
      margin-top: -3px;
    }
    .pos-dropdown.open .pos-dropdown-caret {
      transform: rotate(-135deg);
      margin-top: 3px;
    }
    .pos-dropdown-menu {
      position: absolute;
      top: calc(100% + 5px);
      left: 0;
      min-width: 100%;
      width: max-content;
      max-width: min(440px, calc(100vw - 48px));
      max-height: 310px;
      overflow-y: auto;
      background: var(--bg-card);
      border: 1px solid var(--border-control);
      border-radius: 8px;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.09);
      padding: 6px;
      z-index: 950;
      opacity: 0;
      transform: translateY(-6px);
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.22s ease, transform 0.22s ease, visibility 0.22s ease;
    }
    .pos-dropdown.open .pos-dropdown-menu {
      opacity: 1;
      transform: translateY(0);
      visibility: visible;
      pointer-events: auto;
    }
    .pos-dropdown-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .pos-dropdown-option {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 7px 9px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.84em;
      font-weight: 500;
      color: var(--text-secondary);
      line-height: 1.35;
      user-select: none;
      transition: background 0.12s ease, color 0.12s ease;
    }
    .pos-dropdown-option:hover {
      background: var(--bg-well);
      color: var(--text-main);
    }
    .pos-dropdown-option.selected {
      background: var(--bg-well);
      color: var(--text-main);
      font-weight: 600;
    }
    .pos-dropdown-option input[type="checkbox"] {
      margin-top: 2px;
      flex-shrink: 0;
      cursor: pointer;
      accent-color: var(--accent-primary);
    }
    .pos-selected-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .pos-selected-tags:empty {
      display: none;
      margin-top: 0;
    }
    .pos-selected-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 999px;
      background: var(--accent-primary);
      color: var(--accent-fg);
      font-size: 0.78em;
      font-weight: 600;
      line-height: 1.3;
    }
    .pos-selected-tag button {
      border: none;
      background: transparent;
      color: var(--accent-fg);
      font-size: 1.05em;
      line-height: 1;
      cursor: pointer;
      padding: 0 2px;
      font-weight: 700;
    }
    .chip-group {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      width: 100%;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 13px;
      border-radius: 999px;
      border: 1px solid transparent;
      background: var(--bg-card);
      color: var(--text-secondary);
      font-size: 0.83em;
      font-weight: 500;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
      max-width: 100%;
      white-space: normal;
      text-align: left;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .chip.selected {
      background: var(--accent-primary);
      color: var(--accent-fg);
      border-color: var(--accent-primary);
      font-weight: 600;
    }
    @media (hover: hover) and (pointer: fine) {
      .chip:hover {
        background: var(--bg-card);
        border-color: var(--border-control);
        color: var(--text-main);
      }
      .chip.selected:hover {
        background: var(--accent-hover);
        color: var(--accent-fg);
        border-color: var(--accent-hover);
      }
    }
    .input-text, .input-select {
      width: 100%;
      max-width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--border-control);
      border-radius: 7px;
      font-family: var(--font-body);
      font-size: 0.88em;
      background: var(--bg-card);
      color: var(--text-main);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .input-text:focus, .input-select:focus {
      outline: none;
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 2px rgba(24, 24, 27, 0.10);
    }

    .form-field {
      min-width: 0;
      width: 100%;
    }
    .form-field label {
      display: block;
      font-size: 0.8em;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 5px;
    }
    .scan-alert {
      margin-top: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.87em;
      font-weight: 500;
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .scan-alert.success {
      display: flex;
      background: var(--apply-bg);
      border: 1px solid rgba(16, 185, 129, 0.30);
      color: var(--apply-text);
    }
    .scan-alert.error {
      display: flex;
      background: var(--geo-bg);
      border: 1px solid rgba(239, 68, 68, 0.30);
      color: var(--geo-text);
    }
    .scan-alert-content {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      flex: 1 1 auto;
      min-width: 0;
    }
    .scan-alert-close {
      border: 1px solid var(--border-control);
      background: var(--bg-card);
      color: var(--text-main);
      font-size: 0.82em;
      font-weight: 600;
      cursor: pointer;
      padding: 2px 9px;
      line-height: 1.3;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .scan-alert-close:hover {
      background: var(--bg-well);
    }

    /* KPI SUMMARY CARDS (3 EQUAL COLUMNS, STATUS DOTS, NO 5PX WALL) */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 18px;
      width: 100%;
    }
    .kpi-card {
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      border-radius: 10px;
      padding: 18px 20px;
      box-shadow: none;
      cursor: pointer;
      position: relative;
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
      min-width: 0;
    }
    .kpi-card:hover {
      transform: translateY(-1px);
      border-color: var(--border-control);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
    }
    .kpi-card::after {
      content: "";
      position: absolute;
      top: 18px;
      right: 18px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--skip-border);
    }
    .kpi-card.apply::after { background: var(--apply-border); }
    .kpi-card.possible::after { background: var(--possible-border); }
    .kpi-card.skip::after { background: var(--skip-border); }
    .kpi-value {
      font-family: var(--font-head);
      font-size: 1.85em;
      font-weight: 600;
      letter-spacing: -0.03em;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      color: var(--text-main);
    }
    .kpi-label {
      font-size: 0.81em;
      color: var(--text-muted);
      margin-top: 6px;
      line-height: 1.38;
      overflow-wrap: anywhere;
    }
    .kpi-label strong {
      color: var(--text-secondary);
      font-weight: 600;
    }

    /* TOOLBAR & SEGMENTED VERDICT BAR */
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-card);
      padding: 12px 16px;
      border-radius: 10px;
      border: 1px solid var(--border-hairline);
      margin-bottom: 18px;
      width: 100%;
    }
    .toolbar-search-group {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: nowrap;
      flex: 1 1 240px;
      min-width: 0;
    }
    .search-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
      flex: 1 1 auto;
      min-width: 0;
      width: auto;
    }
    .toolbar #searchInput {
      flex: 1 1 auto;
      max-width: none;
      min-width: 0;
      width: 100%;
    }
    .search-input-wrap.has-value #searchInput {
      padding-right: 126px;
    }
    #searchInput::-webkit-search-cancel-button {
      -webkit-appearance: none;
      appearance: none;
    }
    .btn-clear-search-inline {
      position: absolute;
      right: 5px;
      top: 50%;
      transform: translateY(-50%);
      padding: 3px 9px;
      font-size: 0.74em;
      line-height: 1.25;
      border-radius: 5px;
      width: auto !important;
      z-index: 2;
    }
    .toolbar-search-group .btn-action {
      flex-shrink: 0;
      white-space: nowrap;
    }
    .filter-group {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      max-width: 100%;
    }
    #verdictFilterBar {
      background: var(--bg-well);
      padding: 3px;
      border-radius: 8px;
      gap: 3px;
    }
    .btn-tab {
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-secondary);
      padding: 6px 12px;
      border-radius: 6px;
      font-family: var(--font-body);
      font-size: 0.84em;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      white-space: normal;
      line-height: 1.35;
      max-width: 100%;
    }
    .btn-tab:hover {
      background: rgba(24, 24, 27, 0.04);
      color: var(--text-main);
    }
    .btn-tab.active,
    .btn-tab.active:hover {
      background: var(--bg-card);
      color: var(--text-main);
      border-color: transparent;
      font-weight: 600;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    }
    @media (hover: none), (pointer: coarse) {
      .btn-tab:not(.active):hover {
        background: transparent;
        color: var(--text-secondary);
        border-color: transparent;
        font-weight: 500;
      }
    }

    /* OPPORTUNITY CARDS */
    .opp-card {
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      border-radius: 10px;
      padding: 22px 26px;
      margin-bottom: 14px;
      box-shadow: none;
      max-width: 100%;
      transition: border-color 0.16s ease, box-shadow 0.16s ease;
    }
    .opp-card:hover {
      border-color: var(--border-control);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.035);
    }
    .opp-card.verdict-SKIP { opacity: 0.88; }
    .opp-card.verdict-GEO { opacity: 0.78; }
    .opp-card.card-reveal-pending,
    .radar-box.card-reveal-pending,
    .guide-step.card-reveal-pending {
      opacity: 0.28;
      transform: translateY(10px);
    }
    .opp-card.card-reveal-pending-up,
    .radar-box.card-reveal-pending-up,
    .guide-step.card-reveal-pending-up {
      opacity: 0.28;
      transform: translateY(-10px);
    }
    .opp-card.card-reveal-visible,
    .radar-box.card-reveal-visible,
    .guide-step.card-reveal-visible {
      opacity: 1;
      transform: translateY(0);
      transition: opacity 0.22s cubic-bezier(0.22, 1, 0.36, 1), transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .opp-card.verdict-SKIP.card-reveal-visible {
      opacity: 0.88;
    }
    @media (prefers-reduced-motion: reduce) {
      .opp-card.card-reveal-pending,
      .radar-box.card-reveal-pending,
      .guide-step.card-reveal-pending,
      .opp-card.card-reveal-pending-up,
      .radar-box.card-reveal-pending-up,
      .guide-step.card-reveal-pending-up {
        opacity: 1;
        transform: none;
      }
      .opp-card.card-reveal-visible,
      .radar-box.card-reveal-visible,
      .guide-step.card-reveal-visible {
        transition: none;
      }
    }
    .opp-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 10px;
    }
    .opp-title {
      margin: 0;
      font-family: var(--font-head);
      font-size: 1.08em;
      font-weight: 600;
      letter-spacing: -0.015em;
      color: var(--text-main);
      flex: 1 1 240px;
      min-width: 0;
      line-height: 1.38;
    }
    .opp-company {
      font-weight: 400;
      color: var(--text-muted);
    }
    .opp-notes {
      font-size: 0.88em;
      color: var(--text-secondary);
      margin-top: 8px;
      line-height: 1.58;
    }
    .opp-tags-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 14px;
      margin-bottom: 6px;
      color: var(--text-muted);
    }
    .platforms-filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 16px 0;
    }
    .plat-meta-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0 0 8px 0;
    }
    .plat-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.76em;
      font-weight: 600;
      background: var(--bg-well);
      color: var(--text-secondary);
      border: 1px solid var(--border-control);
    }
    .plat-badge.ats {
      background: rgba(13, 148, 136, 0.10);
      color: #0f766e;
      border-color: rgba(13, 148, 136, 0.30);
    }
    .plat-badge.ai {
      background: rgba(91, 33, 182, 0.08);
      color: #5b21b6;
      border-color: rgba(91, 33, 182, 0.25);
    }
    /* MARKET PULSE VIEW (SWISS MINIMALIST) */
    .pulse-summary-card {
      background: var(--bg-well);
      border: 1px solid var(--border-hairline);
      border-left: 3px solid var(--accent-primary);
      border-radius: 10px;
      padding: 16px 18px;
      margin-bottom: 16px;
    }
    .pulse-summary-card h4 {
      margin: 0 0 8px 0;
      font-family: var(--font-head);
      font-size: 1.04em;
      color: var(--text-main);
    }
    .pulse-summary-card p {
      margin: 0 0 10px 0;
      font-size: 0.92em;
      line-height: 1.6;
      color: var(--text-secondary);
    }
    .pulse-highlights {
      margin: 0;
      padding-left: 18px;
      font-size: 0.88em;
      color: var(--text-secondary);
      line-height: 1.55;
    }
    .pulse-highlights li {
      margin-bottom: 4px;
    }
    .pulse-kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .pulse-kpi {
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      border-radius: 10px;
      padding: 14px 16px;
    }
    .pulse-kpi-val {
      font-family: var(--font-head);
      font-size: 1.45em;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 4px;
    }
    .pulse-kpi-lbl {
      font-size: 0.82em;
      color: var(--text-muted);
      line-height: 1.4;
    }
    .pulse-split-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
      gap: 14px;
      margin-bottom: 16px;
    }
    .pulse-panel {
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      border-radius: 10px;
      padding: 16px;
    }
    .pulse-panel h4 {
      margin: 0 0 12px 0;
      font-family: var(--font-head);
      font-size: 0.96em;
      color: var(--text-main);
    }
    .pulse-bar-row {
      margin-bottom: 10px;
    }
    .pulse-bar-meta {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 0.84em;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }
    .pulse-bar-track {
      width: 100%;
      height: 7px;
      border-radius: 999px;
      background: var(--bg-well);
      overflow: hidden;
    }
    .pulse-bar-fill {
      height: 100%;
      border-radius: 999px;
      background: var(--accent-primary);
    }
    .pulse-companies-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .pulse-company-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-radius: 8px;
      font-size: 0.82em;
      font-weight: 500;
      background: var(--bg-well);
      border: 1px solid var(--border-control);
      color: var(--text-main);
      text-decoration: none;
    }
    .pulse-company-pill:hover {
      border-color: var(--border-strong);
      background: var(--bg-well-hover);
    }
    .opp-tag-group {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      max-width: 100%;
    }
    .opp-tag-group strong {
      color: var(--text-secondary);
      font-weight: 600;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 4px 11px;
      border-radius: 999px;
      border: none;
      background: var(--bg-well);
      color: var(--text-main);
      font-family: var(--font-mono);
      font-size: 0.77em;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: normal;
      text-align: center;
      line-height: 1.3;
      max-width: 100%;
    }
    .badge::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
      background: var(--skip-border);
    }
    .badge-APPLY::before { background: var(--apply-border); }
    .badge-POSSIBLE::before { background: var(--possible-border); }
    .badge-SKIP::before { background: var(--skip-border); }
    .badge-GEO::before { background: var(--geo-border); }
    .meta-line {
      font-size: 0.85em;
      color: var(--text-muted);
      margin-bottom: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 7px 12px;
      align-items: center;
    }
    .meta-line > span {
      max-width: 100%;
      overflow-wrap: anywhere;
    }
    .meta-line strong {
      color: var(--text-secondary);
      font-weight: 600;
    }
    .bolivia-pill,
    .reality-pill,
    .fresh-pill,
    .semantic-pill {
      display: inline-block;
      background: var(--bg-well);
      color: var(--text-main);
      border: none;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.79em;
      font-weight: 600;
      max-width: 100%;
      white-space: normal;
      line-height: 1.35;
    }
    .bolivia-pill.restricted {
      background: var(--geo-bg);
      color: var(--geo-text);
    }
    .comp-pill {
      display: inline-block;
      background: var(--apply-bg);
      color: var(--apply-text);
      border: none;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.79em;
      font-weight: 600;
      max-width: 100%;
    }
    .reality-pill.caution,
    .ghost-pill {
      display: inline-block;
      background: var(--possible-bg);
      color: var(--possible-text);
      border: none;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.79em;
      font-weight: 600;
      max-width: 100%;
    }
    .ghost-pill.high {
      background: var(--geo-bg);
      color: var(--geo-text);
    }

    /* BORDERLESS INLINE SCORE STRIP */
    .score-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      padding: 8px 12px;
      border-radius: 8px;
      background: var(--bg-well);
      margin-bottom: 12px;
    }
    .score-pill {
      background: transparent;
      border: none;
      border-radius: 0;
      padding: 0;
      font-family: var(--font-mono);
      font-size: 0.79em;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: var(--text-secondary);
      max-width: 100%;
      white-space: normal;
    }
    .skill-tag,
    .contract-tag,
    .lang-tag {
      display: inline-block;
      background: var(--bg-well);
      color: var(--text-secondary);
      padding: 2px 8px;
      border-radius: 5px;
      font-family: var(--font-body);
      font-size: 0.78em;
      font-weight: 500;
      margin: 2px 3px 2px 0;
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    /* INLINE AI POSITION DIAGNOSTIC PANEL */
    #ai-cv-panel.ai-cv-folded {
      display: none;
    }
    #resultsCardsContainer > #ai-cv-panel {
      margin-top: -6px;
      margin-bottom: 16px;
      background: var(--bg-well);
      border: 1px solid var(--border-control);
    }
    .ai-result-box {
      margin-top: 0;
      padding: 4px;
      border-radius: 8px;
      background: transparent;
      border: none;
      display: none;
    }
    .ai-result-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 10px;
    }
    .ai-result-header-main {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 8px;
      flex: 1 1 auto;
      min-width: 0;
    }
    .ai-result-header-actions {
      display: flex;
      align-items: center;
      flex: 0 0 auto;
    }
    #ai-target-job-pill {
      display: none;
      align-items: center;
      width: fit-content;
      max-width: 100%;
      box-sizing: border-box;
      font-size: 0.8em;
      line-height: 1.38;
      font-weight: 600;
      background: var(--bg-card);
      color: var(--text-main);
      border: 1px solid var(--border-hairline);
      padding: 5px 10px;
      border-radius: 8px;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    #ai-target-job-text {
      display: inline;
      min-width: 0;
    }
    .ai-position-details {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 4px;
    }
    .ai-position-loading {
      margin: 4px 0;
      font-size: 0.88em;
      color: var(--text-muted);
      font-style: italic;
    }
    .ai-position-overview {
      margin: 0;
      padding: 12px 14px;
      border-radius: 8px;
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      font-size: 0.88em;
      line-height: 1.55;
      color: var(--text-main);
    }
    .ai-details-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    @media (max-width: 700px) {
      .ai-details-grid {
        grid-template-columns: 1fr;
      }
    }
    .ai-detail-block {
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      border-radius: 8px;
      padding: 14px 16px;
    }
    .ai-detail-block h4 {
      margin: 0 0 8px 0;
      font-family: var(--font-head);
      font-size: 0.9em;
      font-weight: 600;
      color: var(--text-main);
    }
    .ai-detail-block p {
      margin: 0;
      font-size: 0.85em;
      line-height: 1.55;
      color: var(--text-secondary);
    }
    .ai-detail-block ul {
      margin: 0;
      padding-left: 18px;
      font-size: 0.85em;
      line-height: 1.55;
      color: var(--text-secondary);
    }
    .ai-detail-block li {
      margin-bottom: 5px;
    }
    .ai-detail-block li:last-child {
      margin-bottom: 0;
    }
    .ai-detail-block.ai-detail-reality {
      grid-column: 1 / -1;
      border-left: 3px solid var(--apply-border);
      background: var(--bg-card);
    }
    .ai-detail-block.ai-detail-reality h4 {
      color: var(--apply-text);
    }
    .ai-reality-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
    }

    /* ACTION BUTTONS */
    .btn-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 7px;
      font-family: var(--font-body);
      font-size: 0.84em;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid transparent;
      white-space: normal;
      text-align: center;
      line-height: 1.35;
      max-width: 100%;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .btn-primary {
      background: var(--accent-primary);
      color: var(--accent-fg) !important;
      border: 1px solid var(--accent-primary);
    }
    .btn-primary:hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
      color: var(--accent-fg) !important;
    }
    .btn-secondary {
      background: transparent;
      color: var(--text-secondary) !important;
      border: 1px solid var(--border-control);
    }
    .btn-secondary:hover {
      background: var(--bg-well);
      border-color: var(--border-strong);
      color: var(--text-main) !important;
    }
    .btn-ai-info {
      background: var(--bg-well);
      color: var(--text-main) !important;
      border: 1px solid transparent;
      border-radius: 7px;
      font-weight: 600;
    }
    .btn-ai-info:hover {
      background: var(--bg-well-hover);
      border-color: var(--border-control);
      color: var(--text-main) !important;
    }

    /* REPORT & PLATFORMS DIRECTORY */
    .report-box {
      background: #09090b;
      color: #f4f4f5;
      padding: 16px;
      border-radius: 8px;
      font-family: var(--font-mono);
      font-size: 0.85em;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.5;
      margin: 10px 0 0 0;
      max-height: 640px;
      overflow-y: auto;
      max-width: 100%;
    }
    .radar-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
      gap: 14px;
      margin-top: 12px;
      width: 100%;
    }
    .radar-box {
      background: var(--bg-well);
      border: none;
      border-radius: 8px;
      padding: 15px 17px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-width: 0;
      max-width: 100%;
    }
    .radar-box h4 {
      margin: 0 0 6px 0;
      font-family: var(--font-head);
      color: var(--text-main);
      font-size: 0.96em;
      font-weight: 600;
    }
    .platform-type-tag {
      font-family: var(--font-mono);
      font-size: 0.78em;
      font-weight: 500;
      color: var(--text-muted);
    }
    .radar-box p {
      margin: 0;
      font-size: 0.84em;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    /* USER MANUAL & LEGAL/TAX GUIDE */
    .manual-container {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .manual-card {
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      border-radius: 10px;
      padding: 24px 28px;
      box-shadow: none;
    }
    .doc-view-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 0;
      border-bottom: none;
    }
    .manual-card h3 {
      margin: 0 0 12px 0;
      font-family: var(--font-head);
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1.18em;
      font-weight: 600;
      letter-spacing: -0.015em;
      border-bottom: none;
      padding-bottom: 0;
    }
    .manual-card h4 {
      font-family: var(--font-head);
      color: var(--text-main);
      font-weight: 600;
      border-bottom: none;
    }
    .guide-step {
      background: var(--bg-well);
      border: none;
      border-radius: 8px;
      padding: 16px 18px;
      margin-bottom: 12px;
    }
    .guide-step-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .guide-step-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: var(--accent-primary);
      color: var(--accent-fg);
      font-family: var(--font-mono);
      font-weight: 600;
      font-size: 0.84em;
      flex-shrink: 0;
    }
    .guide-step-title {
      font-family: var(--font-head);
      font-size: 1.02em;
      font-weight: 600;
      color: var(--text-main);
      margin: 0;
    }
    #man-p-intro,
    #legal-p-intro {
      font-size: 0.92em;
      color: var(--text-secondary);
      line-height: 1.62;
    }
    #man-p-intro a {
      color: var(--link-color);
      text-decoration: underline;
      text-underline-offset: 2px;
      font-weight: 400;
      font-size: inherit;
      cursor: pointer;
    }
    #man-p-intro a:hover,
    .guide-tip a:hover {
      color: var(--link-hover);
    }
    .verdict-text-apply { color: var(--apply-text); }
    .verdict-text-possible { color: var(--possible-text); }
    .verdict-text-skip { color: var(--text-secondary); }
    .legal-table-wrap {
      width: 100%;
      overflow-x: auto;
      margin: 10px 0;
      border-radius: 8px;
      border: 1px solid var(--border-hairline);
      background: var(--bg-card);
    }
    .legal-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.91em;
      text-align: left;
    }
    .legal-table th,
    .legal-table td {
      padding: 10px 13px;
      border-bottom: 1px solid var(--border-hairline);
      vertical-align: top;
      line-height: 1.5;
      color: var(--text-secondary);
    }
    .legal-table th {
      background: var(--bg-well);
      color: var(--text-main);
      font-weight: 600;
    }
    .legal-table tr:last-child td {
      border-bottom: none;
    }
    .legal-sources-list a {
      color: var(--link-color);
      text-decoration: underline;
      text-underline-offset: 2px;
      font-weight: 600;
    }
    .legal-sources-list a:hover {
      color: var(--link-hover);
    }
    .guide-step-body {
      font-size: 0.88em;
      color: var(--text-secondary);
      line-height: 1.62;
    }
    .guide-step-body strong {
      color: var(--text-main);
    }
    .guide-step-body ul {
      margin: 6px 0 6px 20px;
      padding: 0;
    }
    .guide-step-body li {
      margin-bottom: 4px;
    }
    .guide-tip {
      background: var(--bg-card);
      border-left: 3px solid var(--accent-primary);
      padding: 9px 13px;
      border-radius: 6px;
      font-size: 0.85em;
      color: var(--text-secondary);
      margin-top: 8px;
    }
    .guide-tip a {
      color: var(--link-color);
      text-decoration: underline;
      text-underline-offset: 2px;
      font-weight: 600;
      cursor: pointer;
    }
    .info-callout {
      background: var(--bg-well);
      border-left: 3px solid var(--apply-border);
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 0.88em;
      color: var(--text-main);
      margin: 12px 0;
    }
    .info-callout.warning {
      background: var(--possible-bg);
      border-left-color: var(--possible-border);
      color: var(--possible-text);
    }
    .manual-memory-showcase {
      margin: 16px 0 6px 0;
      padding: 16px 18px;
      border-radius: 10px;
      background: var(--bg-well);
      border: 1px solid var(--border-hairline);
      border-left: 3px solid var(--accent-primary);
    }
    .manual-memory-showcase h4 {
      margin: 0 0 8px 0;
      font-size: 1.04em;
      color: var(--text-main);
    }
    .manual-memory-lead {
      margin: 0 0 12px 0;
      font-size: 0.89em;
      line-height: 1.55;
      color: var(--text-secondary);
    }
    .manual-memory-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 10px;
    }
    @media (max-width: 820px) {
      .manual-memory-grid {
        grid-template-columns: 1fr;
      }
    }
    .manual-memory-card {
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 0.85em;
      line-height: 1.5;
      color: var(--text-secondary);
    }
    .manual-memory-card strong {
      display: block;
      margin-bottom: 5px;
      color: var(--text-main);
      font-size: 0.96em;
    }
    .manual-memory-footnote {
      margin: 0;
      font-size: 0.82em;
      line-height: 1.45;
      color: var(--text-main);
      font-weight: 600;
    }

    /* FOOTER & BACK-TO-TOP */
    footer {
      margin-top: 38px;
      padding-top: 20px;
      border-top: 1px solid var(--border-hairline);
      text-align: center;
      font-size: 0.82em;
      color: var(--text-muted);
    }
    .footer-status-pills {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 8px 12px;
      margin-bottom: 0;
    }
    .banner-pill {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 3px 6px;
      border-radius: 999px;
      font-size: 0.95em;
      font-weight: 500;
      white-space: normal;
      overflow-wrap: anywhere;
      line-height: 1.45;
      max-width: 100%;
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
    }
    .footer-pill-btn {
      font-family: inherit;
      cursor: pointer;
      margin: 0;
      background: var(--bg-well);
      color: var(--text-secondary);
      padding: 4px 11px;
      font-weight: 600;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .footer-pill-btn:hover,
    .footer-pill-btn:focus-visible,
    .footer-pill-btn.expanded,
    .footer-pill-btn.active-nav {
      background: var(--bg-well-hover);
      color: var(--text-main);
      outline: none;
    }
    .footer-credit {
      line-height: 1.45;
    }
    .banner-pill.footer-credit {
      display: inline-block;
      gap: 0;
    }
    footer a {
      color: var(--link-color);
      text-decoration: underline;
      text-underline-offset: 2px;
      font-weight: 600;
    }
    footer a:hover {
      color: var(--link-hover);
    }
    .btn-back-to-top {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 900;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 999px;
      border: 1px solid var(--border-control);
      background: rgba(255, 255, 255, 0.92);
      -webkit-backdrop-filter: blur(8px);
      backdrop-filter: blur(8px);
      color: var(--text-main);
      font-family: var(--font-body);
      font-size: 0.8em;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
      opacity: 0;
      pointer-events: none;
      transform: translateY(8px);
      transition: opacity 0.18s ease, transform 0.18s ease, background 0.15s ease, border-color 0.15s ease;
    }
    .btn-back-to-top.visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }
    .btn-back-to-top:hover,
    .btn-back-to-top:focus-visible {
      background: var(--bg-well);
      border-color: var(--border-strong);
      color: var(--text-main);
      outline: none;
    }
    .back-to-top-chevron {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-top: 1.8px solid currentColor;
      border-left: 1.8px solid currentColor;
      transform: rotate(45deg);
      margin-top: 3px;
      flex-shrink: 0;
    }

    /* SWISS CARBON DARK MODE */
    html.dark-mode, body.dark-mode {
      --bg-page: #09090b;
      --bg-card: #111113;
      --bg-well: #18181b;
      --bg-well-hover: #27272a;
      --text-main: #fafafa;
      --text-secondary: #d4d4d8;
      --text-muted: #a1a1aa;
      --border-hairline: rgba(255, 255, 255, 0.08);
      --border-control: rgba(255, 255, 255, 0.15);
      --border-strong: rgba(255, 255, 255, 0.28);
      --accent-primary: #fafafa;
      --accent-hover: #e4e4e7;
      --accent-fg: #09090b;
      --link-color: #fafafa;
      --link-hover: #d4d4d8;
      --apply-bg: rgba(16, 185, 129, 0.16);
      --apply-text: #6ee7b7;
      --possible-bg: rgba(245, 158, 11, 0.16);
      --possible-text: #fde68a;
      --skip-bg: #18181b;
      --skip-text: #a1a1aa;
      --geo-bg: rgba(239, 68, 68, 0.16);
      --geo-text: #fecaca;
      background-color: var(--bg-page);
      color: var(--text-main);
    }
    body.dark-mode #navbar {
      background: rgba(9, 9, 11, 0.94);
      border-bottom-color: var(--border-hairline);
    }
    body.dark-mode #navbar.navbar-scrolled {
      background: rgba(9, 9, 11, 0.80);
      -webkit-backdrop-filter: blur(12px) saturate(140%);
      backdrop-filter: blur(12px) saturate(140%);
      border-bottom-color: var(--border-hairline);
    }
    body.dark-mode #navbar ul,
    body.dark-mode .pos-dropdown-menu {
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.55);
    }
    body.dark-mode .input-text:focus,
    body.dark-mode .input-select:focus {
      box-shadow: 0 0 0 2px rgba(250, 250, 250, 0.16);
    }
    body.dark-mode .btn-tab:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    body.dark-mode .plat-badge.ats {
      background: rgba(20, 184, 166, 0.16);
      color: #99f6e4;
      border-color: rgba(20, 184, 166, 0.35);
    }
    body.dark-mode .plat-badge.ai {
      background: rgba(139, 92, 246, 0.18);
      color: #ddd6fe;
      border-color: rgba(139, 92, 246, 0.38);
    }
    body.dark-mode .opp-card:hover,
    body.dark-mode .kpi-card:hover {
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.40);
    }
    body.dark-mode .btn-back-to-top {
      background: rgba(17, 17, 19, 0.92);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
    }
    @media (hover: hover) and (pointer: fine) {
      body.dark-mode .chip:hover {
        background: var(--bg-card);
        border-color: var(--border-control);
        color: var(--text-main);
      }
      body.dark-mode .chip.selected:hover {
        background: var(--accent-hover);
        color: var(--accent-fg);
        border-color: var(--accent-hover);
      }
    }
    @media (hover: none), (pointer: coarse) {
      body.dark-mode .btn-tab:not(.active):hover {
        background: transparent;
        color: var(--text-secondary);
        border-color: transparent;
        font-weight: 500;
      }
    }

    /* RESPONSIVE BREAKPOINTS */
    @media only screen and (max-width: 1080px) {
      .toolbar-search-group {
        flex: 1 1 100%;
        width: 100%;
      }
      .toolbar #searchInput {
        max-width: none;
        width: 100%;
        min-width: 0;
      }
    }

    @media only screen and (max-width: 820px) {
      .navbar-header {
        padding: 11px 16px;
      }
      .sidebar-fold-btn,
      #sidebar-unfold-btn {
        width: 36px;
        padding: 0;
        gap: 0;
      }
      .hamburger-label {
        display: none;
      }
      #navbar ul {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        width: 100%;
        max-width: 100%;
        margin-top: 0;
        border: none;
        border-top: 1px solid var(--border-hairline);
        border-bottom: 1px solid var(--border-control);
        border-radius: 0 0 10px 10px;
        max-height: calc(100vh - 64px);
      }
      body.sidebar-collapsed #navbar ul {
        opacity: 0;
        transform: translateY(-6px);
        visibility: hidden;
        pointer-events: none;
      }
      #main-doc, body.sidebar-collapsed #main-doc {
        margin-left: auto;
        padding: 16px 16px 56px 16px;
      }
      .panel-card,
      .manual-card,
      .opp-card {
        padding: 18px;
      }
      .top-banner {
        padding: 14px 16px;
      }
      .kpi-card {
        padding: 15px 16px;
      }
      #custom-filters-panel .panel-title {
        font-size: 0.94em;
        white-space: nowrap;
        flex: 1 1 auto;
      }
      .filter-block-langs {
        flex: 1 1 100%;
        width: 100%;
        max-width: 100%;
      }
      .filter-block-langs .filter-block-label {
        justify-content: space-between;
      }
      .filter-block-langs .chip-group {
        width: 100%;
      }
      footer {
        margin-top: 44px;
      }
      .keywords-input-row .input-text {
        flex: 1 1 100%;
        width: 100%;
      }
      .toolbar {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
        padding: 12px 14px;
      }
      .toolbar .filter-group {
        width: 100%;
      }
      #verdictFilterBar {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 4px;
        padding: 4px;
        width: 100%;
      }
      #verdictFilterBar .btn-tab {
        width: 100%;
        min-width: 0;
        padding: 7px 6px;
      }
      .toolbar-search-group {
        width: 100%;
        flex: 1 1 auto;
        gap: 8px;
      }
      .search-input-wrap {
        flex: 1 1 auto;
        min-width: 0;
        width: 100%;
      }
      .toolbar #searchInput,
      #searchInput {
        max-width: none !important;
        width: 100%;
        min-width: 0;
      }
      .kpi-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .radar-grid {
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
      }
      .ai-result-header-main {
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
      }
      #ai-target-job-pill {
        width: fit-content;
        max-width: 100%;
        padding: 6px 10px;
        border-radius: 7px;
      }
    }

    @media only screen and (max-width: 640px) {
      .navbar-header {
        padding: 10px 14px;
      }
      .header-title {
        font-size: 1.12em;
        letter-spacing: -0.015em;
      }
      #main-doc, body.sidebar-collapsed #main-doc {
        padding: 12px 12px 52px 12px;
      }
      .top-banner,
      .panel-card,
      .manual-card,
      .opp-card {
        padding: 14px;
      }
      .banner-subtitle-line {
        font-size: 0.88em;
      }
      .pos-dropdown {
        flex: 1 1 100%;
        min-width: 0;
      }
      .pos-dropdown-menu {
        width: 100%;
        max-width: 100%;
      }
      .panel-header-actions {
        width: 100%;
      }
      #custom-filters-panel {
        display: flex;
        flex-direction: column;
        align-items: stretch;
      }
      .filters-panel-header {
        order: 1;
        padding-right: 0;
        margin-bottom: 12px;
        padding-bottom: 0;
      }
      #custom-filters-panel .panel-title {
        font-size: 0.88em;
        white-space: normal;
        letter-spacing: normal;
        line-height: 1.35;
        flex: 1 1 auto;
      }
      #custom-filters-panel > .filter-grid {
        order: 2;
      }
      #custom-filters-panel > .filter-block-full {
        order: 3;
      }
      .filters-reset-actions {
        order: 4;
        margin-top: 12px;
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
        justify-content: stretch;
      }
      .panel-header-actions .btn-action {
        width: 100%;
        justify-content: center;
      }
      .filter-grid {
        gap: 10px;
      }
      .filter-block {
        padding: 12px 13px;
      }
      .filter-block-langs,
      .filter-block-grow {
        flex: 1 1 100%;
        min-width: 0;
        width: 100%;
      }
      .panel-header .btn-action {
        width: 100%;
        justify-content: center;
      }
      .chip {
        white-space: normal;
        line-height: 1.35;
      }
      .kpi-grid {
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
        gap: 8px;
      }
      .kpi-value {
        font-size: 1.48em;
      }
      .btn-back-to-top {
        right: 12px;
        bottom: 14px;
        padding: 7px 11px;
        font-size: 0.76em;
      }
      .toolbar {
        padding: 12px;
        gap: 8px;
      }
      #verdictFilterBar {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px;
        padding: 4px;
        width: 100%;
      }
      #verdictFilterBar .btn-tab {
        width: 100%;
        min-width: 0;
        padding: 8px 8px;
        font-size: 0.83em;
      }
      .toolbar-search-group {
        flex-wrap: wrap;
        gap: 8px;
        width: 100%;
      }
      .search-input-wrap {
        width: 100%;
        flex: 1 1 100%;
        min-width: 0;
      }
      .search-input-wrap.has-value #searchInput {
        padding-right: 118px;
      }
      .btn-clear-search-inline {
        font-size: 0.72em;
        padding: 3px 8px;
      }
      .toolbar-search-group > .btn-action {
        flex: 1 1 calc(50% - 4px);
        min-width: 0;
        width: 100%;
        justify-content: center;
      }
      .opp-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
      }
      .opp-title {
        flex: 1 1 auto;
        width: 100%;
      }
      .badge {
        white-space: normal;
      }
      .score-pills {
        padding: 8px 10px;
        gap: 4px 10px;
      }
      .opp-card .btn-action {
        width: 100%;
        justify-content: center;
      }
      .ai-result-box {
        padding: 2px;
      }
      #ai-target-job-pill {
        width: fit-content;
        max-width: 100%;
        padding: 6px 10px;
        border-radius: 7px;
        font-size: 0.79em;
        line-height: 1.38;
      }
      .ai-reality-meta .reality-pill,
      .ai-reality-meta .score-pill,
      .ai-reality-meta .ghost-pill {
        width: fit-content;
        max-width: 100%;
        border-radius: 7px;
      }
      .radar-grid {
        grid-template-columns: 1fr;
      }
      .radar-box p {
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .guide-step {
        padding: 13px 14px;
      }
    }

    @media only screen and (max-width: 400px) {
      .kpi-grid {
        grid-template-columns: 1fr;
      }
      #verdictFilterBar .btn-tab {
        padding: 7px 6px;
        font-size: 0.8em;
      }
      .toolbar-search-group > .btn-action {
        flex: 1 1 100%;
        width: 100%;
      }
    }
  </style>
</head>
<body class="${isInitialLegalTax ? 'sidebar-collapsed view-manual-active' : 'sidebar-collapsed'}">
  <div class="bolivia-stripe"></div>

  <nav id="navbar">
    <div class="navbar-header">
      <header class="header-title"><span id="nav-brand-title">Bolivia Remote Work</span></header>
      <div class="navbar-header-actions">
        <button type="button" class="btn-theme-toggle" id="btn-theme-toggle" onclick="toggleTheme()" title="Cambiar a modo oscuro" aria-label="Cambiar tema">
          <span class="theme-symbol theme-symbol-moon" id="theme-sym-moon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          </span>
          <span class="theme-symbol theme-symbol-sun" id="theme-sym-sun" style="display:none;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          </span>
        </button>
        <button type="button" id="sidebar-unfold-btn" class="sidebar-fold-btn" onclick="toggleSidebar(event)" title="Mostrar información" aria-label="Mostrar información" aria-expanded="false">
          <span class="hamburger-label" id="lbl-unfold-nav">Información Útil</span>
          <span class="hamburger-icon"><span></span><span></span><span></span></span>
        </button>
      </div>
    </div>
    <ul id="navbar-menu-list">
      <li><a id="nav-manual" onclick="switchMainView('manual'); closeNavbarMenu();"><span id="nav-lbl-manual">Guía del Usuario: Bolivia Remote Work</span></a></li>
      <li><a id="nav-legal-tax"${isInitialLegalTax ? ' class="active-nav"' : ''} href="/guia-legal-fiscal" onclick="event.preventDefault(); switchMainView('legal-tax'); closeNavbarMenu();"><span id="nav-lbl-legal-tax">Guía Legal y Fiscal (EE. UU. y Bolivia)</span></a></li>

      <li class="nav-group-header nav-collapsible-header" id="nav-hdr-payments-item" onclick="togglePaymentsMenu()" role="button" tabindex="0" aria-expanded="false">
        <span id="nav-hdr-payments">Información Financiera y de Pago</span>
        <span class="nav-caret" id="nav-payments-caret" aria-hidden="true"></span>
      </li>
      <li class="nav-payment-item nav-payment-folded"><a href="https://www.airtm.com/" target="_blank" rel="noopener noreferrer">AirTM</a></li>
      <li class="nav-payment-item nav-payment-folded"><a href="https://www.payoneer.com/" target="_blank" rel="noopener noreferrer">Payoneer</a></li>
      <li class="nav-payment-item nav-payment-folded"><a href="https://wise.com/" target="_blank" rel="noopener noreferrer">Wise</a></li>
      <li class="nav-payment-item nav-payment-folded"><a href="https://tipalti.com/" target="_blank" rel="noopener noreferrer">Tipalti</a></li>
      <li class="nav-payment-item nav-payment-folded"><a href="https://dolarboliviahoy.com/" target="_blank" rel="noopener noreferrer">Dólar Bolivia Hoy</a></li>
      <li class="nav-payment-item nav-payment-folded nav-payment-desc">
        <p id="nav-payments-desc">Las empresas suelen liquidar mediante plataformas de nómina global como <strong>AirTM. Wise, Payoneer o Tipalti</strong>. Desde estas cuentas puedes transferir vía SWIFT O transferancia ACH hacia tu cuenta bancaria boliviana en Boliviano o en USD, usar tarjetas de débito internacionales, o liquidar honorarios a través de pasarelas reguladas entre tus cuentas globales y locales.</p>
      </li>

      <li class="nav-group-header nav-collapsible-header" id="nav-hdr-creator-item" onclick="toggleCreatorMenu()" role="button" tabindex="0" aria-expanded="false">
        <span id="nav-hdr-creator">Sobre el creador</span>
        <span class="nav-caret" id="nav-creator-caret" aria-hidden="true"></span>
      </li>
      <li class="nav-creator-item nav-creator-folded nav-creator-desc">
        <div id="nav-creator-desc">
          <p>Soy <strong>Thomas Simon</strong>, Cloud Systems Architect, NOC &amp; AI Engineer radicado en La Paz, Bolivia. Creé esta herramienta abierta y gratuita para facilitar el acceso al empleo remoto internacional desde Bolivia.</p>
          <p>Este proyecto forma parte de <strong>Minka Lab</strong> (<em>Laboratorio Abierto de Experimentación Tecnológica y Social</em>), una iniciativa comunitaria sin fines de lucro en La Paz y El Alto inspirada en la tradición andina de la <em>Minka</em>, dedicada a la educación digital, las competencias en IA y el aprendizaje de idiomas.</p>
          <p><strong>Minka Lab:</strong> <a href="https://minkalab.net" title="Minka Lab · Laboratorio Abierto de Experimentación Tecnológica y Social" target="_blank" rel="noopener noreferrer">minkalab.net</a><br><strong>Contacto:</strong> <a href="mailto:contact@tsimon.me">Thomas Simon</a> · <a href="https://tsimon.me" title="Thomas Mathieu Simon · Cloud Systems Architect · NOC &amp; AI Engineer" target="_blank" rel="noopener noreferrer">tsimon.me</a><br><strong>Redes:</strong> <a href="https://www.facebook.com/thomas.mathieu.simon" title="Facebook de Thomas Simon" target="_blank" rel="noopener noreferrer">Facebook</a> · <a href="https://www.linkedin.com/in/tsimonfreelance/" title="LinkedIn de Thomas Simon" target="_blank" rel="noopener noreferrer">LinkedIn</a> · <a href="https://github.com/t0m-a" title="GitHub de Thomas Simon" target="_blank" rel="noopener noreferrer">GitHub</a></p>
        </div>
      </li>
    </ul>
  </nav>

  <main id="main-doc">
    <!-- TOP BANNER -->
    <section class="top-banner">
      <div class="banner-header-block">
        <div class="banner-subtitle-line">
          <h1 id="banner-title">Buscador y Evaluador de Empleos Remotos desde Bolivia</h1><span class="banner-inline-sep" aria-hidden="true">·</span><span id="banner-subtitle">Filtra y evalúa ofertas globales y regionales que permiten trabajar remoto desde Bolivia. Personaliza tus idiomas, área profesional, experiencia y modalidad de contrato.</span>
        </div>
      </div>
    </section>

    <!-- CUSTOMIZABLE USER FILTERS PANEL -->
    <section class="panel-card" id="custom-filters-panel">
      <div class="panel-header filters-panel-header">
        <h2 class="panel-title"><span id="lbl-filters-title">Personaliza tu Búsqueda y Criterios de Evaluación</span></h2>
      </div>
      <div class="panel-header-actions filters-reset-actions">
        <button type="button" class="btn-action btn-secondary" onclick="resetFilters()" id="btn-reset-filters">↺ Restablecer Filtros</button>
      </div>

      <div class="filter-grid">
        <!-- 1. LANGUAGES -->
        <div class="filter-block filter-block-langs">
          <div class="filter-block-label">
            <span id="lbl-filter-langs">1. Tus Idiomas</span>
            <span class="meta-hint" id="lbl-weight-langs">(Peso: 20 pts)</span>
          </div>
          <div class="chip-group" id="chips-languages"></div>
        </div>

        <!-- 2. EXPERIENCE LEVEL -->
        <div class="filter-block filter-block-grow">
          <div class="filter-block-label">
            <span id="lbl-filter-exp">2. Tu Nivel de Experiencia</span>
            <span class="meta-hint" id="lbl-weight-exp">(Peso: Contrato + Exp 20 pts)</span>
          </div>
          <div class="pos-dropdown filter-dropdown-full" id="exp-dropdown">
            <button
              type="button"
              id="exp-dropdown-toggle"
              class="input-select pos-dropdown-toggle"
              onclick="toggleFilterDropdown('exp-dropdown', 'exp-dropdown-toggle', event)"
              aria-haspopup="listbox"
              aria-expanded="false"
              aria-controls="exp-dropdown-menu"
            >
              <span id="exp-dropdown-label" class="pos-dropdown-label">Todos los niveles</span>
              <span class="pos-dropdown-caret" aria-hidden="true"></span>
            </button>
            <div id="exp-dropdown-menu" class="pos-dropdown-menu" role="listbox" aria-multiselectable="true">
              <div id="chips-experience" class="pos-dropdown-list"></div>
            </div>
          </div>
        </div>

        <!-- 3. CONTRACT TYPE -->
        <div class="filter-block filter-block-grow">
          <div class="filter-block-label">
            <span id="lbl-filter-contracts">3. Tipo de Contrato Buscado</span>
            <button type="button" class="filter-inline-action" onclick="selectAllContracts()" id="btn-all-contracts">Todos</button>
          </div>
          <div class="pos-dropdown filter-dropdown-full" id="contract-dropdown">
            <button
              type="button"
              id="contract-dropdown-toggle"
              class="input-select pos-dropdown-toggle"
              onclick="toggleFilterDropdown('contract-dropdown', 'contract-dropdown-toggle', event)"
              aria-haspopup="listbox"
              aria-expanded="false"
              aria-controls="contract-dropdown-menu"
            >
              <span id="contract-dropdown-label" class="pos-dropdown-label">Todos los tipos</span>
              <span class="pos-dropdown-caret" aria-hidden="true"></span>
            </button>
            <div id="contract-dropdown-menu" class="pos-dropdown-menu" role="listbox" aria-multiselectable="true">
              <div id="chips-contracts" class="pos-dropdown-list"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. POSITION TYPES & CUSTOM KEYWORDS -->
      <div class="filter-block filter-block-full" style="margin-top:12px;">
        <div class="filter-block-label">
          <span id="lbl-filter-positions">4. Tipo de Posición / Área Profesional (Selecciona una o varias, o déjalo vacío para ver todas)</span>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <label class="strict-pos-label">
              <input type="checkbox" id="chk-strict-pos" onchange="onStrictPosToggle(this.checked)">
              <span id="lbl-strict-pos">Ocultar ofertas de otras áreas</span>
            </label>
            <button type="button" class="filter-inline-action" onclick="clearPositions()" id="btn-clear-pos">Ver todas las áreas</button>
          </div>
        </div>
        <div class="keywords-input-row">
          <div class="pos-dropdown" id="pos-dropdown">
            <button
              type="button"
              id="pos-dropdown-toggle"
              class="input-select pos-dropdown-toggle"
              onclick="togglePositionsDropdown(event)"
              aria-haspopup="listbox"
              aria-expanded="false"
              aria-controls="pos-dropdown-menu"
            >
              <span id="pos-dropdown-label" class="pos-dropdown-label">Todas las áreas (seleccionar...)</span>
              <span class="pos-dropdown-caret" aria-hidden="true"></span>
            </button>
            <div id="pos-dropdown-menu" class="pos-dropdown-menu" role="listbox" aria-multiselectable="true">
              <div id="chips-positions" class="pos-dropdown-list"></div>
            </div>
          </div>
          <span class="meta-hint" id="lbl-weight-pos">(Peso Posición/Habilidades: 35 pts · Elegibilidad Bolivia: 25 pts)</span>
        </div>
        <div id="pos-selected-tags" class="pos-selected-tags"></div>
      </div>
    </section>

    <!-- INFORMACION SOBRE LA POSICION PANEL (MASKED UNTIL TRIGGERED FROM A JOB CARD) -->
    <section class="panel-card ai-cv-folded" id="ai-cv-panel">
      <div id="ai-cv-error" class="scan-alert"></div>
      <div id="ai-cv-result-box" class="ai-result-box">
        <div class="ai-result-header">
          <div class="ai-result-header-main">
            <strong style="font-size:0.95em;" id="lbl-ai-analysis-hdr">Información sobre la Posición</strong>
            <span id="ai-target-job-pill">
              <span id="ai-target-job-text"></span>
            </span>
          </div>
          <div class="ai-result-header-actions">
            <button type="button" class="scan-alert-close" onclick="closeAiDiagnosticPanel()" aria-label="Cerrar" title="Cerrar">&times;</button>
          </div>
        </div>
        <div id="ai-position-details" class="ai-position-details"></div>
      </div>
    </section>

    <!-- KPI SUMMARY CARDS -->
    <section class="kpi-grid">
      <div class="kpi-card apply" onclick="switchMainView('results'); setVerdictFilter('APPLY');">
        <div class="kpi-value"><span id="kpi-apply-cnt">0</span></div>
        <div class="kpi-label"><strong id="kpi-apply-title">POSTULAR</strong> (<span id="kpi-apply-sub">Puntaje ≥ 78/100</span>)</div>
      </div>
      <div class="kpi-card possible" onclick="switchMainView('results'); setVerdictFilter('POSSIBLE');">
        <div class="kpi-value"><span id="kpi-possible-cnt">0</span></div>
        <div class="kpi-label"><strong id="kpi-possible-title">EXPLORAR</strong> (<span id="kpi-possible-sub">Puntaje 58–77/100</span>)</div>
      </div>
      <div class="kpi-card skip" onclick="switchMainView('results'); setVerdictFilter('SKIP');">
        <div class="kpi-value"><span id="kpi-skip-cnt">0</span></div>
        <div class="kpi-label"><strong id="kpi-skip-title">BAJA COINCIDENCIA</strong> (<span id="kpi-skip-sub">Fuera de tus filtros</span>)</div>
      </div>
    </section>

    <!-- TOOLBAR -->
    <section class="toolbar">
      <div class="filter-group" id="verdictFilterBar">
        <button type="button" class="btn-tab active" data-verdict="ALL" onclick="setVerdictFilter('ALL')" id="btn-v-all">Todas las Elegibles</button>
        <button type="button" class="btn-tab" data-verdict="APPLY" onclick="setVerdictFilter('APPLY')"><span id="btn-v-apply">Postular</span></button>
        <button type="button" class="btn-tab" data-verdict="POSSIBLE" onclick="setVerdictFilter('POSSIBLE')"><span id="btn-v-possible">Explorar</span></button>
        <button type="button" class="btn-tab" data-verdict="SKIP" onclick="setVerdictFilter('SKIP')"><span id="btn-v-skip">Baja Coincidencia</span></button>
      </div>
      <div class="toolbar-search-group">
        <div class="search-input-wrap" id="search-input-wrap">
          <input type="search" id="searchInput" class="input-text" placeholder="Buscar por cargo, empresa, país..." oninput="onSearchInputChange(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();runSemanticSearch();}">
          <button type="button" class="btn-action btn-primary btn-clear-search-inline" id="btn-clear-search-input" onclick="clearSearchInput()" style="display:none;" aria-label="Borrar búsqueda">
            <span id="lbl-btn-clear-search">Borrar búsqueda</span>
          </button>
        </div>
        <button type="button" class="btn-action btn-primary" id="btn-semantic-search" onclick="runSemanticSearch()" style="padding:7px 12px;font-size:0.82em;">
          <span id="lbl-btn-semantic">Buscar con IA</span>
        </button>
        <button type="button" class="btn-action btn-secondary" id="btn-clear-semantic" onclick="clearSemanticSearch()" style="display:none;padding:7px 10px;font-size:0.8em;">
          <span id="lbl-btn-clear-semantic">Limpiar Vector</span>
        </button>
      </div>
    </section>

    <!-- VIEW 1: LIVE RESULTS -->
    <section id="view-results"${(isInitialLegalTax || isInitialPulse) ? ' style="display:none;"' : ''}>
      <div id="semantic-status-bar" class="scan-alert success" style="display:none;margin-top:0;margin-bottom:14px;"></div>
      <div id="resultsCardsContainer"></div>
    </section>

    <!-- VIEW 2: INTERACTIVE USER MANUAL -->
    <section id="view-manual" style="display:none;">
      <div class="manual-container">
        <!-- GUÍA DEL USUARIO: Bolivia Remote Work -->
        <article class="manual-card">
          <div class="doc-view-header">
            <h3 id="man-h-intro" style="margin:0;">Guía del Usuario: Bolivia Remote Work</h3>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <button type="button" class="btn-action btn-primary" onclick="switchMainView('results')"><span id="man-btn-back">Volver a la Página Principal</span></button>
            </div>
          </div>
          <p id="man-p-intro">
            <strong>Bolivia Remote Work</strong> es una plataforma pública, gratuita e interactiva diseñada para encontrar, filtrar y evaluar en vivo oportunidades laborales internacionales que admiten trabajo 100% remoto desde Bolivia (UTC-4), eliminando el ruido de ofertas con restricciones territoriales o visados extranjeros. <strong><u>Nota: Algunas de estas plataformas requieren que te registres para ver el contenido de la oferta.</u></strong>
          </p>
          <div class="info-callout" id="man-box-privacy">
            <strong>Privacidad Total y Sin Registros:</strong> No necesitas crear una cuenta ni ingresar datos personales. Tus filtros se guardan solo en tu navegador (localStorage) y cualquier dato privado escrito en una búsqueda se limpia automáticamente en memoria antes de procesarse.
          </div>

          <div class="manual-memory-showcase" id="man-box-ai-memory">
            <h4>¿Qué hace única a esta plataforma? IA con Memoria en Capas</h4>
            <p class="manual-memory-lead">
              La mayoría de bolsas de empleo solo copian enlaces y olvidan todo al día siguiente. <strong>Bolivia Remote Work</strong> combina Inteligencia Artificial con una <strong>arquitectura de memoria en 3 capas</strong> diseñada específicamente para quienes trabajan remoto desde Bolivia:
            </p>
            <div class="manual-memory-grid">
              <div class="manual-memory-card">
                <strong>1. Memoria Histórica de Vacantes</strong>
                Recuerda cuándo apareció cada oferta y detecta si una empresa la vuelve a publicar repetidamente sin contratar. Así te alerta sobre posibles <em>vacantes fantasma</em> y destaca lo recién publicado (<em>Nueva hoy</em>).
              </div>
              <div class="manual-memory-card">
                <strong>2. Memoria de Empresas y Cobros en Bolivia</strong>
                Conserva información verificada sobre las <span id="man-platforms-count">${activePlatformsCount}</span> plataformas y empresas contratantes: canales de cobro útiles en Bolivia (<em>AirTM, Payoneer, Deel, Tipalti, USDC</em>), advertencias locales, modalidad independiente (<em>W-8BEN</em>) y guías prácticas para <em>UTC-4</em>.
              </div>
              <div class="manual-memory-card">
                <strong>3. Memoria Semántica e IA de Búsqueda</strong>
                Entiende lo que buscas en español o inglés —incluso sin tildes o con errores de tipeo— combinando búsqueda exacta, significado real y reordenamiento inteligente con IA para mostrarte primero las mejores opciones.
              </div>
            </div>
            <p class="manual-memory-footnote">
              En resumen: nuestra memoria recuerda el mercado laboral para ahorrarte tiempo y evitar frustraciones, pero nunca almacena tus datos personales ni tu historial.
            </p>
          </div>

          <h4 style="margin:20px 0 14px 0;font-size:1.08em;display:flex;align-items:center;gap:8px;padding-bottom:8px;">
            Cómo Utilizar la Herramienta Paso a Paso
          </h4>

          <!-- PASO 1 -->
          <div class="guide-step">
            <div class="guide-step-header">
              <span class="guide-step-num">1</span>
              <h5 class="guide-step-title">Configura tus Idiomas de Trabajo</h5>
            </div>
            <div class="guide-step-body">
              En la sección <strong>1. Tus Idiomas</strong>, haz clic sobre las etiquetas interactivas de los idiomas que dominas (<code>Español</code>, <code>Inglés</code>):
              <ul>
                <li><strong>Solo Español:</strong> Si seleccionas únicamente <em>Español</em>, el evaluador activa una regla estricta que prioriza vacantes en español y excluye ofertas exclusivamente en inglés.</li>
                <li><strong>Solo Inglés:</strong> Si seleccionas únicamente <em>Inglés</em>, el evaluador prioriza vacantes en inglés y excluye ofertas exclusivamente en español.</li>
                <li><strong>Ambos (Español + Inglés):</strong> Si activas ambos idiomas, el sistema muestra y evalúa todas las oportunidades en español, inglés y bilingües.</li>
              </ul>
            </div>
          </div>

          <!-- PASO 2 -->
          <div class="guide-step">
            <div class="guide-step-header">
              <span class="guide-step-num">2</span>
              <h5 class="guide-step-title">Define tu Nivel de Experiencia</h5>
            </div>
            <div class="guide-step-body">
              En <strong>2. Tu Nivel de Experiencia</strong>, selecciona el rango correspondiente a tu trayectoria profesional:
              <ul>
                <li><strong>Todos los niveles:</strong> Muestra todas las vacantes sin restringir por años de experiencia.</li>
                <li><strong>Inicial / Sin Experiencia (0-1 años):</strong> Puestos de entrada, pasantías y roles de entrenamiento.</li>
                <li><strong>Junior (1-2 años):</strong> Roles iniciales con supervisión mínima.</li>
                <li><strong>Semi-Senior / Mid (3-5 años):</strong> Profesionales autónomos con experiencia demostrada.</li>
                <li><strong>Senior (5+ años) y Management (8+ años):</strong> Especialistas, líderes técnicos y directores de área.</li>
              </ul>
            </div>
          </div>

          <!-- PASO 3 -->
          <div class="guide-step">
            <div class="guide-step-header">
              <span class="guide-step-num">3</span>
              <h5 class="guide-step-title">Elige tus Modalidades de Contrato</h5>
            </div>
            <div class="guide-step-body">
              En <strong>3. Tipo de Contrato Buscado</strong>, marca una o varias modalidades según tu disponibilidad:
              <ul>
                <li><strong>Tiempo Completo (Full-Time):</strong> Jornadas estándar de 40 horas semanales.</li>
                <li><strong>Medio Tiempo (Part-Time):</strong> Esquemas de 20 horas por semana o semanas de 4 días.</li>
                <li><strong>Por Proyectos / Freelance:</strong> Contratos cerrados por entregables u objetivos.</li>
                <li><strong>Por Horas / Asíncrono:</strong> Horarios flexibles con pago por hora trabajada.</li>
                <li><strong>Consultoría / Asesoría:</strong> Llamadas de asesoramiento y redes de expertos internacionales.</li>
              </ul>
              <div class="guide-tip">
                Haz clic en el enlace <strong>"Todos"</strong> para seleccionar simultáneamente todas las modalidades disponibles.
              </div>
            </div>
          </div>

          <!-- PASO 4 -->
          <div class="guide-step">
            <div class="guide-step-header">
              <span class="guide-step-num">4</span>
              <h5 class="guide-step-title">Selecciona tus Áreas Profesionales</h5>
            </div>
            <div class="guide-step-body">
              En <strong>4. Tipo de Posición / Área Profesional</strong>:
              <ul>
                <li>Abre el menú desplegable y marca una o varias áreas profesionales (ej: <em>Asistencia Virtual, Atención al Cliente, Ventas, Marketing, Ciberseguridad, Producto, Finanzas, Diseño, Software, IA, Cloud, Datos, Salud, Legal, E-Commerce</em>).</li>
                <li><strong>Ver todas las áreas:</strong> Pulsa este botón si deseas explorar oportunidades de cualquier disciplina sin restricción.</li>
                <li><strong>Casilla "Ocultar ofertas de otras áreas":</strong> Actívala para esconder estrictamente cualquier vacante que no pertenezca a tus categorías seleccionadas.</li>
              </ul>
            </div>
          </div>

          <!-- PASO 5 -->
          <div class="guide-step">
            <div class="guide-step-header">
              <span class="guide-step-num">5</span>
              <h5 class="guide-step-title">Filtro Automático 100% Remoto desde Bolivia</h5>
            </div>
            <div class="guide-step-body">
              Todos los motores de búsqueda, escaneo y evaluación de la plataforma aplican automáticamente el filtro <strong>100% remoto desde Bolivia</strong>:
              <ul>
                <li>Descarta automáticamente antes de importar cualquier vacante que exija residencia física o visados en Estados Unidos (<em>US Only</em>, <em>W-2</em>), Europa (<em>EU Only</em>) u otros países específicos.</li>
                <li>Conserva únicamente vacantes verificadas y abiertas a Sudamérica, Latinoamérica, esquemas globales de contratación independiente (<em>W-8BEN</em>) y modalidad <em>Work From Anywhere</em>.</li>
              </ul>
            </div>
          </div>

          <!-- PASO 6 -->
          <div class="guide-step">
            <div class="guide-step-header">
              <span class="guide-step-num">6</span>
              <h5 class="guide-step-title">Interpreta el Semáforo de Compatibilidad y Filtra Resultados</h5>
            </div>
            <div class="guide-step-body">
              Cada vacante se evalúa en tiempo real con una calificación de 0 a 100 puntos y se clasifica mediante colores:
              <ul>
                <li><strong class="verdict-text-apply">POSTULAR (Puntaje ≥ 78):</strong> Máxima afinidad con tus filtros e idiomas, verificada 100% para Bolivia. ¡Recomendada para postular de inmediato!</li>
                <li><strong class="verdict-text-possible">EXPLORAR (Puntaje 58–77):</strong> Ofertas compatibles con pequeñas variaciones de modalidad o experiencia.</li>
                <li><strong class="verdict-text-skip">BAJA COINCIDENCIA (&lt; 58):</strong> Ofertas remotas válidas pero fuera de tus áreas o preferencias actuales.</li>
              </ul>
              <div class="guide-tip">
                Además del puntaje, cada tarjeta muestra etiquetas rápidas de nuestra memoria: <strong>Cobro verificado</strong> (canales compatibles en Bolivia), avisos de precaución local, <strong>Nueva hoy</strong> o alertas de <strong>Re-publicada</strong> para identificar vacantes fantasma. Usa los botones del semáforo para ver solo <strong>Postular</strong> o <strong>Explorar</strong>.
              </div>
            </div>
          </div>

          <!-- PASO 7 -->
          <div class="guide-step">
            <div class="guide-step-header">
              <span class="guide-step-num">7</span>
              <h5 class="guide-step-title">Postula Directamente a la Fuente Original</h5>
            </div>
            <div class="guide-step-body">
              En cada tarjeta de oferta, haz clic en el botón azul <strong>"Ver Oferta y Postular"</strong> para abrir directamente la página oficial de la empresa o bolsa de trabajo contratante, sin registros intermedios ni cobro de comisiones. Antes de firmar un contrato internacional, también puedes consultar la <strong>Guía Legal y Fiscal (EE. UU. y Bolivia)</strong> dentro del menú <strong>Información Útil</strong>.
            </div>
          </div>

          <!-- PASO 8 -->
          <div class="guide-step" style="margin-bottom:0;">
            <div class="guide-step-header">
              <span class="guide-step-num">8</span>
              <h5 class="guide-step-title">Aprovecha "Más información con IA" y "Buscar con IA"</h5>
            </div>
            <div class="guide-step-body">
              Aquí es donde nuestra IA conectada a la memoria en capas marca la mayor diferencia frente a cualquier bolsa tradicional:
              <ul>
                <li><strong>Más información con IA (en cada tarjeta de oferta):</strong> Haz clic en <strong>"Más información con IA"</strong> para abrir justo debajo de la vacante un análisis fundamentado con IA y memoria de Bolivia. Te muestra un resumen claro y 5 bloques prácticos: <em>Requisitos de la posición</em>, <em>Experiencia y habilidades útiles</em>, <em>Compatibilidad horaria con Bolivia (UTC-4)</em>, <em>Consejos para el candidato</em> y <strong>Realidad desde Bolivia: Contrato, Cobro e Historial</strong> (canales de cobro conocidos, modalidad W-8BEN/EOR, advertencias locales e historial de re-publicaciones). El panel se cierra automáticamente al desplazarte fuera de su área o al pulsar <code>&times;</code>.</li>
                <li><strong>Buscar con IA (en la barra de herramientas):</strong> Combina búsqueda exacta, comprensión semántica bilingüe (español/inglés, sin tildes y tolerante a errores de tipeo) y reordenamiento inteligente con IA sobre todas las vacantes 100% remotas para Bolivia. Escribe en lenguaje natural (por ejemplo: <em>"soporte al cliente bilingüe"</em>, <em>"desarrollador Python remoto"</em> o <em>"asistente contable"</em>) y pulsa <strong>"Buscar con IA"</strong>. Puedes volver a la lista normal en cualquier momento con el botón <strong>"Borrar búsqueda"</strong> o cambiando cualquier filtro.</li>
              </ul>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- VIEW 2b: LEGAL & TAX GUIDE (BOLIVIA REMOTE INDEPENDENT CONTRACTORS) -->
    <section id="view-legal-tax"${isInitialLegalTax ? '' : ' style="display:none;"'}>
${LEGAL_TAX_GUIDE_HTML}
    </section>

    <!-- VIEW 3: ON-THE-FLY RESULTS REPORT (MARKDOWN & CSV) -->
    <section id="view-report" style="display:none;">
      <div class="panel-card">
        <div class="panel-header">
          <h3 class="panel-title"><span id="lbl-live-report-heading">Reporte de Resultados Generado al Instante (Markdown)</span></h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn-action btn-primary" onclick="copyReportMarkdown(this)"><span id="lbl-copy-md">Copiar Resultados (.md)</span></button>
            <button type="button" class="btn-action btn-secondary" onclick="downloadReportMarkdown()"><span id="lbl-dl-md">Descargar .md</span></button>
            <button type="button" class="btn-action btn-secondary" onclick="downloadResultsCsv()"><span id="lbl-dl-csv">Exportar CSV</span></button>
          </div>
        </div>
        <pre id="liveReportMarkdownBox" class="report-box"></pre>
      </div>
    </section>

    <!-- VIEW 4: MONITORED PLATFORMS -->
    <section id="view-platforms" style="display:none;">
      <div class="panel-card">
        <div class="panel-header">
          <div>
            <h3 class="panel-title"><span id="lbl-platforms-heading">Directorio de Plataformas Remotas Monitoreadas</span></h3>
            <span class="meta-hint-sub" id="lbl-platforms-sub">Explora las bolsas globales y empresas directas (ATS) que nuestro motor actualiza automáticamente cada 15 minutos</span>
          </div>
          <button type="button" class="btn-action btn-primary" onclick="switchMainView('results')"><span id="plat-btn-back">Volver a la Página Principal</span></button>
        </div>
        <div id="platformsFilterBar" class="platforms-filter-bar">
          <button type="button" class="btn-tab active" data-plat-group="all" onclick="setPlatformsGroupFilter('all')">Todas</button>
          <button type="button" class="btn-tab" data-plat-group="ats" onclick="setPlatformsGroupFilter('ats')">Empresas Directas (ATS)</button>
          <button type="button" class="btn-tab" data-plat-group="boards" onclick="setPlatformsGroupFilter('boards')">Bolsas y Redes Globales</button>
        </div>
        <div id="platformsGridContainer" class="radar-grid"></div>
      </div>
    </section>

    <!-- VIEW 5: NIGHTLY MARKET PULSE SYNTHESIS ("Pulso del Mercado Remoto desde Bolivia") -->
    <section id="view-pulse"${isInitialPulse ? '' : ' style="display:none;"'}>
      <div class="panel-card">
        <div class="panel-header">
          <div>
            <h3 class="panel-title"><span id="lbl-pulse-heading">Pulso del Mercado Remoto desde Bolivia</span></h3>
            <span class="meta-hint-sub" id="lbl-pulse-sub">Síntesis nocturna automática · 03:00 AM Bolivia (UTC-4)</span>
          </div>
          <button type="button" class="btn-action btn-primary" onclick="switchMainView('results')"><span id="pulse-btn-back">Volver a la Página Principal</span></button>
        </div>
        <div id="pulseViewContainer"></div>
      </div>
    </section>

    <footer id="footer-text">
      <div class="footer-status-pills">
        <span class="banner-pill" id="pill-schedule">Actualización automática cada 15 min</span>
        <span class="banner-pill"><span id="lbl-last-sync">Última sincronización:</span> <span id="val-last-sync">-</span></span>
        <span class="banner-pill"><span id="lbl-monitored-count">Plataformas activas:</span> <span id="val-platforms-count">${activePlatformsCount}</span></span>
        <button type="button" class="banner-pill footer-pill-btn" id="nav-platforms" onclick="switchMainView('platforms')">
          <span id="nav-lbl-platforms">Plataformas Monitoreadas</span>
        </button>
        <button type="button" class="banner-pill footer-pill-btn${isInitialPulse ? ' active-nav' : ''}" id="nav-pulse" onclick="switchMainView('pulse')">
          <span id="nav-lbl-pulse">Pulso del Mercado</span>
        </button>
        <span id="footer-credit" class="banner-pill footer-credit">Designed, engineered and hosted by <a href="mailto:contact@tsimon.me">Thomas Simon</a> · <a href="https://tsimon.me" title="Thomas Mathieu Simon  · Cloud Systems Architect · NOC &amp; AI Engineer" target="_blank" rel="noopener noreferrer">tsimon.me</a></span>
      </div>
    </footer>
  </main>

  <button type="button" id="btn-back-to-top" class="btn-back-to-top" onclick="scrollToTop()" title="Volver arriba" aria-label="Volver arriba">
    <span class="back-to-top-chevron" aria-hidden="true"></span>
    <span id="lbl-btn-top">Arriba</span>
  </button>

  <script id="initial-payload" type="application/json">${clientPayload}</script>
  <script>
    const PAYLOAD = JSON.parse(document.getElementById('initial-payload').textContent);
    let opportunitiesState = PAYLOAD.opportunities || [];
    let platformsState = PAYLOAD.platforms || [];
    let lastScanAtState = PAYLOAD.lastScanAt || new Date().toISOString();
    let marketPulseState = PAYLOAD.marketPulse || null;

    const POSITION_CATEGORIES = PAYLOAD.POSITION_CATEGORIES;
    const LANGUAGE_OPTIONS = PAYLOAD.LANGUAGE_OPTIONS;
    const EXPERIENCE_OPTIONS = PAYLOAD.EXPERIENCE_OPTIONS;
    const CONTRACT_OPTIONS = PAYLOAD.CONTRACT_OPTIONS;

    // Load saved filters with Spanish (Bolivia) site language and 100% remote Bolivia locked
    let userFilters = Object.assign({}, PAYLOAD.DEFAULT_FILTERS, { ui_lang: 'es', require_bolivia_remote: true });
    try {
      const saved = localStorage.getItem('bolivia_remote_user_filters_v6');
      if (saved) {
        const parsed = JSON.parse(saved);
        userFilters = Object.assign({}, PAYLOAD.DEFAULT_FILTERS, parsed, { ui_lang: 'es', require_bolivia_remote: true });
      }
    } catch (e) {}
    const validLanguageIds = LANGUAGE_OPTIONS.map(o => o.id);
    userFilters.languages = Array.isArray(userFilters.languages)
      ? Array.from(new Set(userFilters.languages.filter(id => validLanguageIds.includes(id))))
      : [];
    if (userFilters.languages.length === 0) {
      userFilters.languages = PAYLOAD.DEFAULT_FILTERS.languages.slice();
    }

    let currentVerdictFilter = 'ALL';
    let lastEvaluationResult = { surfaced: [], all: [], apply: [], possible: [], skip: [], geo_excluded: [] };

    let currentTheme = 'light';
    try {
      const savedTheme = localStorage.getItem('bolivia_remote_theme');
      if (savedTheme === 'dark' || (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        currentTheme = 'dark';
      }
    } catch (e) {}

    function applyTheme(theme) {
      currentTheme = theme;
      const isDark = (theme === 'dark');
      if (isDark) {
        document.documentElement.classList.add('dark-mode');
        document.body.classList.add('dark-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
        document.body.classList.remove('dark-mode');
      }
      try {
        localStorage.setItem('bolivia_remote_theme', theme);
      } catch (e) {}
      updateThemeButtons();
    }

    function toggleTheme() {
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    }
    window.toggleTheme = toggleTheme;

    function updateThemeButtons() {
      const isDark = (currentTheme === 'dark');
      const t = I18N[userFilters.ui_lang] || I18N.es;
      const btnTitle = isDark ? (t.themeLightTitle || 'Cambiar a modo claro') : (t.themeDarkTitle || 'Cambiar a modo oscuro');

      document.querySelectorAll('.btn-theme-toggle').forEach(btn => {
        btn.setAttribute('title', btnTitle);
        btn.setAttribute('aria-label', btnTitle);
        const moon = btn.querySelector('.theme-symbol-moon');
        const sun = btn.querySelector('.theme-symbol-sun');
        if (moon) moon.style.display = isDark ? 'none' : 'inline-flex';
        if (sun) sun.style.display = isDark ? 'inline-flex' : 'none';
      });
    }

    function cleanTrackName(trackStr) {
      return String(trackStr || '').replace(/^Track\s+[A-F]:?\s*/i, '').trim();
    }

    const I18N = {
      es: {
        pageTitle: 'Empleos Remotos desde Bolivia — Buscador y Evaluador en Vivo',
        navBrand: 'Bolivia Remote Work',
        unfoldNav: 'Información Útil',
        navViews: 'Vistas Principales',
        navResults: 'Resultados en Vivo',
        navManual: 'Guía del Usuario: Bolivia Remote Work',
        navPlatforms: 'Plataformas Monitoreadas',
        navPayments: 'Información Financiera y de Pago',
        navPaymentsDesc: 'Las empresas suelen liquidar mediante plataformas de nómina global como <strong>AirTM. Wise, Payoneer o Tipalti</strong>. Desde estas cuentas puedes transferir vía SWIFT O transferancia ACH hacia tu cuenta bancaria boliviana en Boliviano o en USD, usar tarjetas de débito internacionales, o liquidar honorarios a través de pasarelas reguladas entre tus cuentas globales y locales.',
        categoryLabel: 'Categoría',
        themeDarkTitle: 'Cambiar a modo oscuro',
        themeLightTitle: 'Cambiar a modo claro',
        themeDarkText: 'Oscuro',
        themeLightText: 'Claro',
        bannerTitle: 'Buscador y Evaluador de Empleos Remotos desde Bolivia',
        bannerSubtitle: 'Filtra y evalúa ofertas globales y regionales que permiten trabajar remoto desde Bolivia. Personaliza tus idiomas, área profesional, experiencia y modalidad de contrato.',
        pillSchedule: 'Actualización automática cada 15 min',
        lastSync: 'Última sincronización:',
        monitoredCount: 'Plataformas activas:',
        filtersTitle: 'Personaliza tu Búsqueda y Criterios de Evaluación',
        boliviaOnly: 'Mostrar solo ofertas 100% remotas desde Bolivia',
        resetFilters: 'Restablecer Filtros',
        filterLangs: '1. Tus Idiomas',
        weightLangs: '(Peso: 20 pts)',
        filterExp: '2. Tu Nivel de Experiencia',
        weightExp: '(Peso: Contrato + Exp 20 pts)',
        filterContracts: '3. Tipo de Contrato Buscado',
        allContracts: 'Seleccionar todos',
        filterPositions: '4. Tipo de Posición / Área Profesional (Selecciona una o varias, o déjalo vacío para ver todas)',
        strictPos: 'Ocultar ofertas de otras áreas',
        clearPos: 'Ver todas las áreas',
        customKwPlaceholder: 'Asistente Virtual, Soporte, Ventas, Excel, Python, React, Contador, Diseñador, SQL, Azure, QA...',
        weightPos: '(Peso Posición/Habilidades: 35 pts · Elegibilidad Bolivia: 25 pts)',
        aiAnalysisHdr: 'Información sobre la Posición',
        draftAiBtn: 'Más información con IA',
        semanticBtn: 'Buscar con IA',
        clearSearchBtn: 'Borrar búsqueda',
        semanticLoading: 'Buscando Vectores...',
        semanticClear: 'Limpiar Vector',
        semanticBadge: 'Afinidad Vectorial:',
        kpiApplyTitle: 'POSTULAR',
        kpiApplySub: 'Puntaje ≥ 78/100',
        kpiPossibleTitle: 'EXPLORAR',
        kpiPossibleSub: 'Puntaje 58–77/100',
        kpiSkipTitle: 'BAJA COINCIDENCIA',
        kpiSkipSub: 'Fuera de tus filtros',
        kpiGeoTitle: 'NO ELEGIBLES BOLIVIA',
        kpiGeoSub: 'Restringidas por país',
        kpiReportTitle: 'Reporte de Resultados',
        kpiReportSub: 'Generado al instante',
        tabResults: 'Resultados',
        tabManual: 'Manual de Uso',
        tabReport: 'Reporte Markdown / Exportar',
        tabPlatforms: 'Plataformas Monitoreadas',
        vAll: 'Todas las Elegibles',
        vApply: 'Postular',
        vPossible: 'Explorar',
        vSkip: 'Baja Coincidencia',
        vGeo: 'Bloqueadas País',
        searchPlaceholder: 'Buscar por cargo, habilidad, empresa...',
        liveReportHeading: 'Reporte de Resultados Generado al Instante (Markdown)',
        copyMd: 'Copiar Resultados (.md)',
        copiedMd: '¡Copiado!',
        dlMd: 'Descargar resultados.md',
        dlCsv: 'Exportar CSV',
        platformsHeading: 'Directorio de Plataformas Remotas Monitoreadas',
        platformsSub: 'Explora las bolsas globales y empresas directas (ATS) que nuestro motor actualiza automáticamente cada 15 minutos',
        verdictLabels: { APPLY: 'POSTULAR', POSSIBLE: 'EXPLORAR', SKIP: 'BAJA COINCIDENCIA', GEO: 'NO ELEGIBLE BOLIVIA' },
        scorePos: 'Posición/Habilidades',
        scoreBol: 'Remoto Bolivia',
        scoreCont: 'Contrato/Exp',
        scoreLang: 'Idiomas',
        matchedSkills: 'Habilidades / Etiquetas:',
        matchedLangs: 'Idiomas:',
        contractsLabel: 'Modalidad:',
        openOfferBtn: 'Ver Oferta y Postular',
        openPlatformBtn: 'Abrir Portal',
        noResults: 'No se encontraron ofertas con los filtros actuales. Prueba ampliando los tipos de posición, contrato o palabras clave.',
        manBtnBack: 'Volver a la Página Principal',
        btnTop: 'Arriba',
        btnTopTitle: 'Volver arriba',
        footerText: 'Designed, engineered and hosted by <a href="mailto:contact@tsimon.me">Thomas Simon</a> · <a href="https://tsimon.me" title="Thomas Mathieu Simon  · Cloud Systems Architect · NOC &amp; AI Engineer" target="_blank" rel="noopener noreferrer">tsimon.me</a>'
      }
    };

    // Bring evaluation functions into client scope (with esbuild __name no-op shim for Cloudflare Workers bundles)
    const __name = (target) => target;
    const checkBoliviaRemoteEligibility = ${checkBoliviaRemoteEligibility.toString()};
    const detectOfferAttributes = ${detectOfferAttributes.toString()};
    const evaluateOpportunity = ${evaluateOpportunity.toString()};
    const evaluateAllOpportunities = ${evaluateAllOpportunities.toString()};
    const generateResultsMarkdown = ${generateResultsMarkdown.toString()};
    const DEFAULT_FILTERS = PAYLOAD.DEFAULT_FILTERS;

    function saveFilters() {
      try {
        localStorage.setItem('bolivia_remote_user_filters_v6', JSON.stringify(userFilters));
      } catch (e) {}
    }

    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function setUiLanguage() {
      userFilters.ui_lang = 'es';
      saveFilters();
      document.documentElement.lang = 'es-BO';
      applyTranslations();
      renderFilterChips();
      recomputeAndRender();
      renderPlatformsDirectory();
    }

    function applyTranslations() {
      const t = I18N[userFilters.ui_lang] || I18N.es;
      document.title = t.pageTitle;
      const map = {
        'nav-brand-title': t.navBrand,
        'lbl-unfold-nav': t.unfoldNav,
        'nav-hdr-views': t.navViews,
        'nav-lbl-results': t.navResults,
        'nav-lbl-manual': t.navManual,
        'nav-lbl-platforms': t.navPlatforms,
        'nav-hdr-payments': t.navPayments,
        'nav-payments-desc': t.navPaymentsDesc,
        'banner-title': t.bannerTitle,
        'banner-subtitle': t.bannerSubtitle,
        'pill-schedule': t.pillSchedule,
        'lbl-last-sync': t.lastSync,
        'lbl-monitored-count': t.monitoredCount,
        'lbl-filters-title': t.filtersTitle,
        'lbl-bolivia-only': t.boliviaOnly,
        'btn-reset-filters': t.resetFilters,
        'lbl-filter-langs': t.filterLangs,
        'lbl-weight-langs': t.weightLangs,
        'lbl-filter-exp': t.filterExp,
        'lbl-weight-exp': t.weightExp,
        'lbl-filter-contracts': t.filterContracts,
        'btn-all-contracts': t.allContracts,
        'lbl-filter-positions': t.filterPositions,
        'lbl-strict-pos': t.strictPos,
        'btn-clear-pos': t.clearPos,
        'lbl-weight-pos': t.weightPos,
        'lbl-ai-analysis-hdr': t.aiAnalysisHdr,
        'lbl-btn-semantic': t.semanticBtn,
        'lbl-btn-clear-search': t.clearSearchBtn,
        'lbl-btn-clear-semantic': t.semanticClear,
        'kpi-apply-title': t.kpiApplyTitle,
        'kpi-apply-sub': t.kpiApplySub,
        'kpi-possible-title': t.kpiPossibleTitle,
        'kpi-possible-sub': t.kpiPossibleSub,
        'kpi-skip-title': t.kpiSkipTitle,
        'kpi-skip-sub': t.kpiSkipSub,
        'kpi-geo-title': t.kpiGeoTitle,
        'kpi-geo-sub': t.kpiGeoSub,
        'kpi-report-title': t.kpiReportTitle,
        'kpi-report-sub': t.kpiReportSub,
        'tab-lbl-results': t.tabResults,
        'tab-lbl-manual': t.tabManual,
        'tab-lbl-report': t.tabReport,
        'tab-lbl-platforms': t.tabPlatforms,
        'btn-v-all': t.vAll,
        'btn-v-apply': t.vApply,
        'btn-v-possible': t.vPossible,
        'btn-v-skip': t.vSkip,
        'btn-v-geo': t.vGeo,
        'lbl-live-report-heading': t.liveReportHeading,
        'lbl-copy-md': t.copyMd,
        'lbl-dl-md': t.dlMd,
        'lbl-dl-csv': t.dlCsv,
        'lbl-platforms-heading': t.platformsHeading,
        'lbl-platforms-sub': t.platformsSub,
        'man-btn-back': t.manBtnBack,
        'plat-btn-back': t.manBtnBack,
        'lbl-btn-top': t.btnTop,
        'footer-credit': t.footerText
      };
      for (const [id, text] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) {
          if (id === 'footer-credit' || id === 'nav-payments-desc') {
            el.innerHTML = text;
          } else {
            el.textContent = text;
          }
        }
      }
      const topBtn = document.getElementById('btn-back-to-top');
      if (topBtn) {
        topBtn.title = t.btnTopTitle;
        topBtn.setAttribute('aria-label', t.btnTopTitle);
      }
      const unfoldBtn = document.getElementById('sidebar-unfold-btn');
      if (unfoldBtn) {
        const titleText = userFilters.ui_lang === 'en' ? 'Show information' : 'Mostrar información';
        unfoldBtn.title = titleText;
        unfoldBtn.setAttribute('aria-label', titleText);
      }
      const kwInput = document.getElementById('input-custom-keywords');
      if (kwInput) kwInput.placeholder = t.customKwPlaceholder;
      const searchEl = document.getElementById('searchInput');
      if (searchEl) searchEl.placeholder = t.searchPlaceholder;
      updateThemeButtons();
    }

    function renderFilterChips() {
      const isEs = userFilters.ui_lang !== 'en';
      const canQueryDom = (el) => el && typeof el.querySelectorAll === 'function';

      // 1. Languages (in-place class sync after initial render for instant mobile reactivity)
      const langContainer = document.getElementById('chips-languages');
      const existingLangChips = canQueryDom(langContainer)
        ? langContainer.querySelectorAll('.chip[data-opt-id]')
        : [];
      if (existingLangChips.length === LANGUAGE_OPTIONS.length) {
        existingLangChips.forEach(chipEl => {
          const optId = chipEl.getAttribute('data-opt-id');
          const isSelected = (userFilters.languages || []).includes(optId);
          chipEl.classList.toggle('selected', isSelected);
          chipEl.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
      } else {
        langContainer.innerHTML = LANGUAGE_OPTIONS.map(opt => {
          const selected = (userFilters.languages || []).includes(opt.id);
          const label = isEs ? opt.label_es : opt.label_en;
          return '<span class="chip ' + (selected ? 'selected' : '') + '" data-opt-id="' + escapeHtml(opt.id) + '" role="button" aria-pressed="' + (selected ? 'true' : 'false') + '" onclick="toggleLanguageChip(\\'' + opt.id + '\\')">' +
            escapeHtml(label) + '</span>';
        }).join('');
      }

      // 2. Experience (Multi-select dropdown, default 'all' — in-place checkbox sync keeps scroll & focus)
      const selectedExpIds = (userFilters.experience_levels && userFilters.experience_levels.length > 0)
        ? userFilters.experience_levels
        : ['all'];
      const expContainer = document.getElementById('chips-experience');
      const existingExpOpts = canQueryDom(expContainer)
        ? expContainer.querySelectorAll('.pos-dropdown-option[data-opt-id]')
        : [];
      if (existingExpOpts.length === EXPERIENCE_OPTIONS.length) {
        existingExpOpts.forEach(optEl => {
          const optId = optEl.getAttribute('data-opt-id');
          const selected = selectedExpIds.includes(optId);
          optEl.classList.toggle('selected', selected);
          const cb = optEl.querySelector('input[type="checkbox"]');
          if (cb) cb.checked = selected;
        });
      } else {
        expContainer.innerHTML = EXPERIENCE_OPTIONS.map(opt => {
          const selected = selectedExpIds.includes(opt.id);
          const label = isEs ? opt.label_es : opt.label_en;
          return '<label class="pos-dropdown-option ' + (selected ? 'selected' : '') + '" data-opt-id="' + escapeHtml(opt.id) + '">' +
            '<input type="checkbox" ' + (selected ? 'checked' : '') + ' onchange="toggleExperienceChip(\\'' + opt.id + '\\')">' +
            '<span>' + escapeHtml(label) + '</span>' +
          '</label>';
        }).join('');
      }

      const expLabelEl = document.getElementById('exp-dropdown-label');
      if (expLabelEl) {
        const expLabels = selectedExpIds.map(id => {
          const found = EXPERIENCE_OPTIONS.find(o => o.id === id);
          return found ? (isEs ? found.label_es : found.label_en) : id;
        });
        if (selectedExpIds.includes('all')) {
          expLabelEl.textContent = isEs ? 'Todos los niveles' : 'All levels';
        } else if (expLabels.length <= 2) {
          expLabelEl.textContent = expLabels.join(', ');
        } else {
          expLabelEl.textContent = isEs
            ? expLabels.length + ' niveles seleccionados'
            : expLabels.length + ' levels selected';
        }
        const expToggleBtn = document.getElementById('exp-dropdown-toggle');
        if (expToggleBtn) expToggleBtn.title = expLabels.join(', ');
      }

      // 3. Contracts (Multi-select dropdown, default all selected — in-place checkbox sync)
      const selectedContractIds = (userFilters.contract_types && userFilters.contract_types.length > 0)
        ? userFilters.contract_types
        : CONTRACT_OPTIONS.map(c => c.id);
      const contractContainer = document.getElementById('chips-contracts');
      const existingContractOpts = canQueryDom(contractContainer)
        ? contractContainer.querySelectorAll('.pos-dropdown-option[data-opt-id]')
        : [];
      if (existingContractOpts.length === CONTRACT_OPTIONS.length) {
        existingContractOpts.forEach(optEl => {
          const optId = optEl.getAttribute('data-opt-id');
          const selected = selectedContractIds.includes(optId);
          optEl.classList.toggle('selected', selected);
          const cb = optEl.querySelector('input[type="checkbox"]');
          if (cb) cb.checked = selected;
        });
      } else {
        contractContainer.innerHTML = CONTRACT_OPTIONS.map(opt => {
          const selected = selectedContractIds.includes(opt.id);
          const label = isEs ? opt.label_es : opt.label_en;
          return '<label class="pos-dropdown-option ' + (selected ? 'selected' : '') + '" data-opt-id="' + escapeHtml(opt.id) + '">' +
            '<input type="checkbox" ' + (selected ? 'checked' : '') + ' onchange="toggleContractChip(\\'' + opt.id + '\\')">' +
            '<span>' + escapeHtml(label) + '</span>' +
          '</label>';
        }).join('');
      }

      const contractLabelEl = document.getElementById('contract-dropdown-label');
      if (contractLabelEl) {
        const contractLabels = selectedContractIds.map(id => {
          const found = CONTRACT_OPTIONS.find(o => o.id === id);
          return found ? (isEs ? found.label_es : found.label_en) : id;
        });
        if (selectedContractIds.length >= CONTRACT_OPTIONS.length) {
          contractLabelEl.textContent = isEs
            ? 'Todos los tipos (' + CONTRACT_OPTIONS.length + ')'
            : 'All types (' + CONTRACT_OPTIONS.length + ')';
        } else if (contractLabels.length <= 2) {
          contractLabelEl.textContent = contractLabels.join(', ');
        } else {
          contractLabelEl.textContent = isEs
            ? contractLabels.length + ' tipos seleccionados'
            : contractLabels.length + ' types selected';
        }
        const contractToggleBtn = document.getElementById('contract-dropdown-toggle');
        if (contractToggleBtn) contractToggleBtn.title = contractLabels.join(', ');
      }

      // 4. Position Categories (Multi-select dropdown — in-place checkbox sync keeps scroll & selection)
      const selectedPosIds = userFilters.position_types || [];
      const posContainer = document.getElementById('chips-positions');
      const existingPosOpts = canQueryDom(posContainer)
        ? posContainer.querySelectorAll('.pos-dropdown-option[data-opt-id]')
        : [];
      if (existingPosOpts.length === POSITION_CATEGORIES.length) {
        existingPosOpts.forEach(optEl => {
          const optId = optEl.getAttribute('data-opt-id');
          const selected = selectedPosIds.includes(optId);
          optEl.classList.toggle('selected', selected);
          const cb = optEl.querySelector('input[type="checkbox"]');
          if (cb) cb.checked = selected;
        });
      } else {
        posContainer.innerHTML = POSITION_CATEGORIES.map(opt => {
          const selected = selectedPosIds.includes(opt.id);
          const label = isEs ? opt.label_es : opt.label_en;
          return '<label class="pos-dropdown-option ' + (selected ? 'selected' : '') + '" data-opt-id="' + escapeHtml(opt.id) + '">' +
            '<input type="checkbox" ' + (selected ? 'checked' : '') + ' onchange="togglePositionChip(\\'' + opt.id + '\\')">' +
            '<span>' + escapeHtml(label) + '</span>' +
          '</label>';
        }).join('');
      }

      const posLabelEl = document.getElementById('pos-dropdown-label');
      if (posLabelEl) {
        if (selectedPosIds.length === 0) {
          posLabelEl.textContent = isEs ? 'Todas las áreas (seleccionar...)' : 'All areas (select one or more...)';
        } else if (selectedPosIds.length === 1) {
          const found = POSITION_CATEGORIES.find(c => c.id === selectedPosIds[0]);
          posLabelEl.textContent = found ? (isEs ? found.label_es : found.label_en) : selectedPosIds[0];
        } else {
          posLabelEl.textContent = isEs
            ? selectedPosIds.length + ' áreas seleccionadas'
            : selectedPosIds.length + ' areas selected';
        }
      }

      const posTagsEl = document.getElementById('pos-selected-tags');
      if (posTagsEl) {
        posTagsEl.innerHTML = selectedPosIds.map(id => {
          const found = POSITION_CATEGORIES.find(c => c.id === id);
          if (!found) return '';
          const label = isEs ? found.label_es : found.label_en;
          return '<span class="pos-selected-tag">' + escapeHtml(label) +
            '<button type="button" onclick="togglePositionChip(\\'' + id + '\\')" aria-label="Remove">&times;</button></span>';
        }).join('');
      }

      const strictPosEl = document.getElementById('chk-strict-pos');
      if (strictPosEl) strictPosEl.checked = Boolean(userFilters.strict_position_match);
    }

    function toggleLanguageChip(id) {
      const allowedIds = LANGUAGE_OPTIONS.map(o => o.id);
      if (!allowedIds.includes(id)) return;
      const set = new Set((userFilters.languages || []).filter(x => allowedIds.includes(x)));
      if (set.has(id)) {
        if (set.size > 1) set.delete(id);
      } else {
        set.add(id);
      }
      userFilters.languages = set.size > 0 ? Array.from(set) : PAYLOAD.DEFAULT_FILTERS.languages.slice();
      saveFilters();
      renderFilterChips();
      scheduleRecomputeAndRender();
    }
    window.toggleLanguageChip = toggleLanguageChip;

    function toggleExperienceChip(id) {
      if (id === 'all') {
        userFilters.experience_levels = ['all'];
      } else {
        const set = new Set((userFilters.experience_levels || []).filter(x => x !== 'all'));
        if (set.has(id)) set.delete(id);
        else set.add(id);
        userFilters.experience_levels = set.size > 0 ? Array.from(set) : ['all'];
      }
      saveFilters();
      renderFilterChips();
      scheduleRecomputeAndRender();
    }

    function toggleContractChip(id) {
      const set = new Set(userFilters.contract_types || []);
      if (set.has(id)) {
        if (set.size > 1) set.delete(id);
      } else {
        set.add(id);
      }
      userFilters.contract_types = Array.from(set);
      saveFilters();
      renderFilterChips();
      scheduleRecomputeAndRender();
    }

    function selectAllContracts() {
      userFilters.contract_types = CONTRACT_OPTIONS.map(c => c.id);
      saveFilters();
      renderFilterChips();
      scheduleRecomputeAndRender();
    }

    const FILTER_DROPDOWN_PAIRS = [
      ['exp-dropdown', 'exp-dropdown-toggle'],
      ['contract-dropdown', 'contract-dropdown-toggle'],
      ['pos-dropdown', 'pos-dropdown-toggle']
    ];
    const filterDropdownTimers = {};

    function cancelFilterDropdownAutoClose(ddId) {
      if (filterDropdownTimers[ddId]) {
        clearTimeout(filterDropdownTimers[ddId]);
        delete filterDropdownTimers[ddId];
      }
    }
    window.cancelFilterDropdownAutoClose = cancelFilterDropdownAutoClose;

    function scheduleFilterDropdownAutoClose(ddId, btnId) {
      cancelFilterDropdownAutoClose(ddId);
      const dd = document.getElementById(ddId);
      if (!dd || (dd.classList.contains && !dd.classList.contains('open'))) return;
      filterDropdownTimers[ddId] = setTimeout(() => {
        const targetDd = document.getElementById(ddId);
        const targetBtn = document.getElementById(btnId);
        if (targetDd) targetDd.classList.remove('open');
        if (targetBtn) targetBtn.setAttribute('aria-expanded', 'false');
        delete filterDropdownTimers[ddId];
      }, 320);
    }
    window.scheduleFilterDropdownAutoClose = scheduleFilterDropdownAutoClose;

    function closeAllFilterDropdowns(exceptId) {
      for (const [ddId, btnId] of FILTER_DROPDOWN_PAIRS) {
        if (exceptId && ddId === exceptId) continue;
        cancelFilterDropdownAutoClose(ddId);
        const dd = document.getElementById(ddId);
        const btn = document.getElementById(btnId);
        if (dd) dd.classList.remove('open');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    }
    window.closeAllFilterDropdowns = closeAllFilterDropdowns;

    function toggleFilterDropdown(ddId, btnId, event) {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
      cancelFilterDropdownAutoClose(ddId);
      const dd = document.getElementById(ddId);
      const btn = document.getElementById(btnId);
      if (!dd) return;
      closeAllFilterDropdowns(ddId);
      const isOpen = dd.classList.toggle('open');
      if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
    window.toggleFilterDropdown = toggleFilterDropdown;

    function togglePositionsDropdown(event) {
      toggleFilterDropdown('pos-dropdown', 'pos-dropdown-toggle', event);
    }
    window.togglePositionsDropdown = togglePositionsDropdown;

    function closePositionsDropdown() {
      closeAllFilterDropdowns();
    }
    window.closePositionsDropdown = closePositionsDropdown;

    function supportsFineHover() {
      return typeof window.matchMedia === 'function' &&
        window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    }

    function handleFilterDropdownScrollAutoClose() {
      const vh = typeof window.innerHeight === 'number' ? window.innerHeight : 900;
      for (const [ddId, btnId] of FILTER_DROPDOWN_PAIRS) {
        const dd = document.getElementById(ddId);
        if (!dd || !dd.classList || !dd.classList.contains('open')) continue;
        if (typeof dd.getBoundingClientRect !== 'function') continue;
        const rect = dd.getBoundingClientRect();
        if (rect.bottom < 56 || rect.top > vh) {
          cancelFilterDropdownAutoClose(ddId);
          dd.classList.remove('open');
          const btn = document.getElementById(btnId);
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      }
    }
    window.handleFilterDropdownScrollAutoClose = handleFilterDropdownScrollAutoClose;

    (function initFilterDropdownHoverAutoClose() {
      for (const [ddId, btnId] of FILTER_DROPDOWN_PAIRS) {
        const dd = document.getElementById(ddId);
        if (dd && typeof dd.addEventListener === 'function') {
          dd.addEventListener('mouseenter', () => {
            if (supportsFineHover()) cancelFilterDropdownAutoClose(ddId);
          });
          dd.addEventListener('mouseleave', () => {
            if (supportsFineHover()) scheduleFilterDropdownAutoClose(ddId, btnId);
          });
        }
      }
      if (typeof window.addEventListener === 'function') {
        window.addEventListener('scroll', handleFilterDropdownScrollAutoClose, { passive: true });
      }
    })();

    if (typeof document.addEventListener === 'function') {
      const handleDropdownOutside = function (e) {
        for (const [ddId, btnId] of FILTER_DROPDOWN_PAIRS) {
          const dd = document.getElementById(ddId);
          if (dd && dd.classList.contains('open') && typeof dd.contains === 'function' && !dd.contains(e.target)) {
            cancelFilterDropdownAutoClose(ddId);
            dd.classList.remove('open');
            const btn = document.getElementById(btnId);
            if (btn) btn.setAttribute('aria-expanded', 'false');
          }
        }
      };
      document.addEventListener('pointerdown', handleDropdownOutside, { passive: true });
      document.addEventListener('click', handleDropdownOutside);
    }

    function togglePositionChip(id) {
      const set = new Set(userFilters.position_types || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      userFilters.position_types = Array.from(set);
      saveFilters();
      renderFilterChips();
      scheduleRecomputeAndRender();
    }

    function clearPositions() {
      userFilters.position_types = [];
      userFilters.custom_keywords = '';
      saveFilters();
      renderFilterChips();
      scheduleRecomputeAndRender();
    }

    function onStrictPosToggle(checked) {
      userFilters.strict_position_match = checked;
      saveFilters();
      scheduleRecomputeAndRender();
    }

    let semanticOverrideResults = null;

    function resetFilters() {
      const currentLang = userFilters.ui_lang || 'es';
      userFilters = Object.assign({}, PAYLOAD.DEFAULT_FILTERS, { ui_lang: currentLang });
      currentVerdictFilter = 'ALL';
      document.getElementById('searchInput').value = '';
      syncSearchClearButton('');
      saveFilters();
      renderFilterChips();
      scheduleRecomputeAndRender();
    }
    window.resetFilters = resetFilters;

    let recomputeRafId = null;
    let recomputeTimerId = null;
    let reportMarkdownDirty = true;

    function ensureReportMarkdownUpdated() {
      if (!reportMarkdownDirty) return;
      const box = document.getElementById('liveReportMarkdownBox');
      if (!box) return;
      box.textContent = generateResultsMarkdown(
        lastEvaluationResult,
        userFilters,
        userFilters.ui_lang,
        getActivePlatformsCount(),
        lastScanAtState
      );
      reportMarkdownDirty = false;
    }

    function scheduleRecomputeAndRender() {
      if (typeof requestAnimationFrame !== 'function') {
        recomputeAndRender();
        return;
      }
      if (recomputeRafId) {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(recomputeRafId);
        recomputeRafId = null;
      }
      if (recomputeTimerId) {
        clearTimeout(recomputeTimerId);
        recomputeTimerId = null;
      }
      recomputeRafId = requestAnimationFrame(() => {
        recomputeRafId = null;
        recomputeTimerId = setTimeout(() => {
          recomputeTimerId = null;
          recomputeAndRender();
        }, 0);
      });
    }
    window.scheduleRecomputeAndRender = scheduleRecomputeAndRender;

    function getActivePlatformsCount() {
      return (platformsState || []).filter(p => p && p.enabled !== false).length;
    }

    function updateActivePlatformsCountUi() {
      const activeCount = getActivePlatformsCount();
      const navPlatCntEl = document.getElementById('nav-cnt-platforms');
      if (navPlatCntEl) navPlatCntEl.textContent = activeCount;
      const footerPlatCntEl = document.getElementById('val-platforms-count');
      if (footerPlatCntEl) footerPlatCntEl.textContent = activeCount;
      const manPlatCntEl = document.getElementById('man-platforms-count');
      if (manPlatCntEl) manPlatCntEl.textContent = activeCount;
    }

    function recomputeAndRender() {
      if (semanticOverrideResults !== null) {
        semanticOverrideResults = null;
        const clearBtn = document.getElementById('btn-clear-semantic');
        const statusBar = document.getElementById('semantic-status-bar');
        if (clearBtn) clearBtn.style.display = 'none';
        if (statusBar) statusBar.style.display = 'none';
      }
      lastEvaluationResult = evaluateAllOpportunities(opportunitiesState, userFilters);

      document.getElementById('kpi-apply-cnt').textContent = lastEvaluationResult.apply.length;
      document.getElementById('kpi-possible-cnt').textContent = lastEvaluationResult.possible.length;
      document.getElementById('kpi-skip-cnt').textContent = lastEvaluationResult.skip.length;
      const kpiGeoEl = document.getElementById('kpi-geo-cnt');
      if (kpiGeoEl) kpiGeoEl.textContent = lastEvaluationResult.geo_excluded.length;
      const kpiTotalEl = document.getElementById('kpi-total-cnt');
      if (kpiTotalEl) kpiTotalEl.textContent = lastEvaluationResult.surfaced.length;

      const navCntEl = document.getElementById('nav-cnt-results');
      if (navCntEl) navCntEl.textContent = lastEvaluationResult.surfaced.length;
      updateActivePlatformsCountUi();
      document.getElementById('val-last-sync').textContent = String(lastScanAtState || '').replace('T', ' ').slice(0, 16);

      renderResultsCards();

      reportMarkdownDirty = true;
      const vReport = document.getElementById('view-report');
      if (typeof requestAnimationFrame !== 'function' || (vReport && vReport.style && vReport.style.display !== 'none')) {
        ensureReportMarkdownUpdated();
      }
    }

    function extractTrackCode(trackStr) {
      const m = String(trackStr || '').match(/^(Track\\s+[A-F])/i);
      return m ? m[1].toUpperCase() : 'OTHER';
    }

    function normalizeSearchText(str) {
      return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .replace(/[¡¿]/g, ' ')
        .replace(/\\s+/g, ' ')
        .trim();
    }

    function syncSearchClearButton(val) {
      const hasVal = String(val !== undefined ? val : (document.getElementById('searchInput') ? document.getElementById('searchInput').value : '')).length > 0;
      const wrap = document.getElementById('search-input-wrap');
      const btn = document.getElementById('btn-clear-search-input');
      if (wrap && wrap.classList) wrap.classList.toggle('has-value', hasVal);
      if (btn) btn.style.display = hasVal ? 'inline-flex' : 'none';
    }
    window.syncSearchClearButton = syncSearchClearButton;

    function clearSearchInput() {
      const searchEl = document.getElementById('searchInput');
      if (searchEl) searchEl.value = '';
      syncSearchClearButton('');
      clearSemanticSearch();
      if (searchEl && typeof searchEl.focus === 'function') {
        searchEl.focus();
      }
    }
    window.clearSearchInput = clearSearchInput;

    let searchInputDebounceId = null;

    function onSearchInputChange(val) {
      syncSearchClearButton(val);
      if (!String(val || '').trim() && semanticOverrideResults) {
        clearSemanticSearch();
        return;
      }
      if (!semanticOverrideResults) {
        if (typeof requestAnimationFrame === 'function' && typeof setTimeout === 'function') {
          if (searchInputDebounceId) clearTimeout(searchInputDebounceId);
          searchInputDebounceId = setTimeout(() => {
            searchInputDebounceId = null;
            renderResultsCards();
          }, 80);
        } else {
          renderResultsCards();
        }
      }
    }
    window.onSearchInputChange = onSearchInputChange;

    async function runSemanticSearch() {
      const t = I18N[userFilters.ui_lang] || I18N.es;
      const isEs = userFilters.ui_lang !== 'en';
      const searchEl = document.getElementById('searchInput');
      const btn = document.getElementById('btn-semantic-search');
      const lbl = document.getElementById('lbl-btn-semantic');
      const clearBtn = document.getElementById('btn-clear-semantic');
      const statusBar = document.getElementById('semantic-status-bar');

      const query = (searchEl ? searchEl.value : '').trim();
      if (!query) {
        clearSemanticSearch();
        return;
      }

      btn.disabled = true;
      lbl.textContent = t.semanticLoading || 'Buscando Vectores...';

      try {
        const resp = await fetch('/api/search/semantic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            filters: userFilters,
            topK: 30
          })
        });
        if (!resp.ok) throw new Error('Semantic API unavailable');
        const data = await resp.json();
        semanticOverrideResults = Array.isArray(data.results) ? data.results : [];
        if (clearBtn) clearBtn.style.display = 'inline-flex';
        if (statusBar) {
          statusBar.style.display = 'block';
          statusBar.textContent = isEs
            ? 'Búsqueda Vectorial IA activa ("' + query + '"): ' + semanticOverrideResults.length + ' ofertas ordenadas por similitud semántica (' + (data.vector_backend || 'edge-multilingual-vectors') + ').'
            : 'AI Vector Search active ("' + query + '"): ' + semanticOverrideResults.length + ' offers ranked by semantic similarity (' + (data.vector_backend || 'edge-multilingual-vectors') + ').';
        }
        renderResultsCards();
      } catch (e) {
        // Offline client-side forgiving, accent-insensitive semantic fallback
        const normQuery = normalizeSearchText(query);
        const qAttrs = detectOfferAttributes({
          title: normQuery,
          description: normQuery,
          tags: '',
          location: 'Bolivia',
          contract_caveat: 'fractional_or_fulltime'
        });
        const qCats = new Set(qAttrs.categories || []);
        const stopWords = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'en', 'con', 'para', 'por', 'un', 'una', 'y', 'o', 'a', 'al', 'the', 'and', 'for', 'with', 'in', 'of', 'to']);
        const shortOk = new Set(['ia', 'ai', 'ui', 'ux', 'qa', 'hr', 'it', 'bi', 'ml', 'pm', 'po', 'ti', 'va', 'go', 'js', 'ts', 'c#', 'db']);
        const rawWords = normQuery.replace(/[^a-z0-9+#.\\s-]/g, ' ').split(/\\s+/).filter(Boolean);
        const qWords = rawWords.filter(w => (w.length >= 3 || shortOk.has(w)) && !stopWords.has(w));
        const activeWords = qWords.length > 0 ? qWords : rawWords.filter(w => w.length >= 2);

        const scorePool = (candidates) => candidates.map(r => {
          const rCats = r.detected_categories || [];
          let catOverlap = 0;
          for (const c of rCats) {
            if (qCats.has(c)) catOverlap++;
          }
          const blob = normalizeSearchText(r.title + ' ' + r.company + ' ' + r.platform_name + ' ' + r.matched_skills + ' ' + r.description);
          let wordScore = 0;
          for (const w of activeWords) {
            if (blob.includes(w)) {
              wordScore += 1.0;
            } else if (w.length >= 5 && blob.includes(w.slice(0, Math.min(w.length - 1, 5)))) {
              wordScore += 0.8;
            }
          }
          const simScore = Math.min(100, Math.round(catOverlap * 38 + (activeWords.length ? (wordScore / activeWords.length) * 62 : 0)));
          return Object.assign({}, r, {
            semantic_score: simScore,
            blended_score: Math.round(simScore * 0.58 + r.total_score * 0.42)
          });
        }).filter(r => r.semantic_score >= 10);

        let scored = scorePool(lastEvaluationResult.surfaced || []);
        if (scored.length === 0 && Array.isArray(lastEvaluationResult.all)) {
          scored = scorePool(lastEvaluationResult.all);
        }

        scored.sort((a, b) => b.blended_score - a.blended_score);
        semanticOverrideResults = scored.slice(0, 30);
        if (clearBtn) clearBtn.style.display = 'inline-flex';
        if (statusBar) {
          statusBar.style.display = 'block';
          statusBar.textContent = isEs
            ? 'Búsqueda Vectorial Local activa ("' + query + '"): ' + semanticOverrideResults.length + ' ofertas encontradas.'
            : 'Local Vector Search active ("' + query + '"): ' + semanticOverrideResults.length + ' offers matched.';
        }
        renderResultsCards();
      } finally {
        btn.disabled = false;
        lbl.textContent = (I18N[userFilters.ui_lang] || I18N.es).semanticBtn;
      }
    }
    window.runSemanticSearch = runSemanticSearch;

    function clearSemanticSearch() {
      semanticOverrideResults = null;
      const clearBtn = document.getElementById('btn-clear-semantic');
      const statusBar = document.getElementById('semantic-status-bar');
      if (clearBtn) clearBtn.style.display = 'none';
      if (statusBar) statusBar.style.display = 'none';
      renderResultsCards();
    }
    window.clearSemanticSearch = clearSemanticSearch;

    function renderResultsCards() {
      const isEs = userFilters.ui_lang !== 'en';
      const t = I18N[userFilters.ui_lang] || I18N.es;
      const q = normalizeSearchText(document.getElementById('searchInput').value || '');
      const qTokens = q ? q.split(/\\s+/).filter(Boolean) : [];

      let pool = [];
      if (Array.isArray(semanticOverrideResults)) {
        pool = semanticOverrideResults;
      } else if (currentVerdictFilter === 'GEO') {
        pool = lastEvaluationResult.geo_excluded;
      } else if (currentVerdictFilter === 'APPLY') {
        pool = lastEvaluationResult.apply;
      } else if (currentVerdictFilter === 'POSSIBLE') {
        pool = lastEvaluationResult.possible;
      } else if (currentVerdictFilter === 'SKIP') {
        pool = lastEvaluationResult.skip;
      } else {
        pool = lastEvaluationResult.surfaced;
      }

      const filtered = pool.filter(r => {
        if (qTokens.length > 0 && !Array.isArray(semanticOverrideResults)) {
          const hay = normalizeSearchText(r.title + ' ' + r.company + ' ' + r.platform_name + ' ' + r.location + ' ' + r.matched_skills + ' ' + r.description);
          const allMatch = qTokens.every(tok => hay.includes(tok) || (tok.length >= 5 && hay.includes(tok.slice(0, Math.min(tok.length - 1, 5)))));
          if (!allMatch) return false;
        }
        return true;
      });

      const container = document.getElementById('resultsCardsContainer');
      const aiPanel = document.getElementById('ai-cv-panel');
      const viewResults = document.getElementById('view-results');
      if (aiPanel && typeof container.contains === 'function' && container.contains(aiPanel) && viewResults && viewResults.parentNode) {
        aiPanel.classList.add('ai-cv-folded');
        viewResults.parentNode.insertBefore(aiPanel, viewResults);
      }
      if (filtered.length === 0) {
        container.innerHTML = '<div class="panel-card" style="text-align:center;color:#64748b;padding:32px;">' +
          escapeHtml(t.noResults) + '</div>';
        return;
      }

      const contractNameMap = {};
      CONTRACT_OPTIONS.forEach(c => {
        contractNameMap[c.id] = isEs ? c.label_es : c.label_en;
      });

      const langFlagMap = {
        es: 'Español',
        en: 'Inglés',
        pt: 'Portugués',
        de: 'Alemán'
      };

      const todayIso = new Date().toISOString().slice(0, 10);

      container.innerHTML = filtered.map((r, idx) => {
        const vKey = r.bolivia_eligible ? r.verdict : 'GEO';
        const vLabel = t.verdictLabels[vKey] || vKey;
        const bolBadge = isEs ? r.bolivia_badge_es : r.bolivia_badge_en;
        const notes = isEs ? r.notes_es : r.notes_en;
        const skillsArr = String(r.matched_skills || '').split(',').map(s => s.trim()).filter(Boolean);
        const skillTagsHtml = skillsArr.map(s => '<span class="skill-tag">' + escapeHtml(s) + '</span>').join('');
        const contractTagsHtml = (r.detected_contracts || []).map(cid =>
          '<span class="contract-tag">' + escapeHtml(contractNameMap[cid] || cid) + '</span>'
        ).join('');
        const langTagsHtml = (r.detected_languages || []).map(lid =>
          '<span class="lang-tag">' + escapeHtml(langFlagMap[lid] || lid.toUpperCase()) + '</span>'
        ).join('');

        const empReal = r.employer_reality || null;
        const realityText = empReal ? (isEs ? empReal.reality_badge_es : empReal.reality_badge_en) : '';
        const realityPillHtml = realityText
          ? '<span class="reality-pill' + (empReal.bolivia_tier === 'caution_friction' ? ' caution' : '') + '"' +
            (empReal.caution_note_es ? ' title="' + escapeHtml(empReal.caution_note_es) + '"' : '') +
            '>' + escapeHtml(realityText) + '</span>'
          : '';

        let freshnessOrGhostHtml = '';
        if (r.ghost_risk === 'high' || r.ghost_risk === 'watch') {
          const hits = Number(r.sighting_count) || 2;
          const spanDays = Number(r.repost_span_days) || 30;
          freshnessOrGhostHtml = '<span class="ghost-pill ' + escapeHtml(r.ghost_risk) + '">Re-publicada ' + hits + 'x (' + spanDays + ' días)</span>';
        } else if (String(r.published_at || '').slice(0, 10) === todayIso) {
          freshnessOrGhostHtml = '<span class="fresh-pill">Nueva hoy</span>';
        }

        return '<article class="opp-card verdict-' + vKey + '" data-job-hash="' + escapeHtml(r.job_hash) + '">' +
          '<div class="opp-header">' +
            '<h3 class="opp-title">#' + (idx + 1) + '. [' + r.total_score + '/100] ' + escapeHtml(r.title) +
              ' — <span class="opp-company">' + escapeHtml(r.company) + '</span></h3>' +
            '<span class="badge badge-' + vKey + '">' + escapeHtml(vLabel) + ' · ' + r.total_score + '/100</span>' +
          '</div>' +
          '<div class="meta-line">' +
            '<span class="bolivia-pill ' + (r.bolivia_eligible ? '' : 'restricted') + '">' + escapeHtml(bolBadge) + '</span>' +
            realityPillHtml +
            freshnessOrGhostHtml +
            (typeof r.semantic_score === 'number' ? '<span class="semantic-pill">' + escapeHtml(t.semanticBadge || 'Afinidad Vectorial:') + ' ' + r.semantic_score + '%</span>' : '') +
            (r.compensation_usd ? '<span class="comp-pill">USD: ' + escapeHtml(r.compensation_usd) + '</span>' : '') +
            '<span><strong>Plataforma:</strong> ' + escapeHtml(r.platform_name) + '</span>' +
            '<span><strong>Ubicación:</strong> ' + escapeHtml(r.location) + '</span>' +
            '<span><strong>' + escapeHtml(t.categoryLabel || 'Categoría') + ':</strong> ' + escapeHtml(cleanTrackName(r.track)) + '</span>' +
          '</div>' +
          '<div class="score-pills">' +
            '<span class="score-pill">' + escapeHtml(t.scorePos) + ': ' + r.position_score + '/35</span>' +
            '<span class="score-pill">' + escapeHtml(t.scoreBol) + ': ' + r.bolivia_score + '/25</span>' +
            '<span class="score-pill">' + escapeHtml(t.scoreCont) + ': ' + r.contract_exp_score + '/20</span>' +
            '<span class="score-pill">' + escapeHtml(t.scoreLang) + ': ' + r.language_score + '/20</span>' +
          '</div>' +
          '<div class="opp-tags-row">' +
            '<span class="opp-tag-group"><strong style="font-size:0.82em;">' + escapeHtml(t.contractsLabel) + '</strong> ' + contractTagsHtml + '</span>' +
            (langTagsHtml ? '<span class="opp-tag-group"><strong style="font-size:0.82em;">' + escapeHtml(t.matchedLangs) + '</strong> ' + langTagsHtml + '</span>' : '') +
            (skillTagsHtml ? '<span class="opp-tag-group"><strong style="font-size:0.82em;">' + escapeHtml(t.matchedSkills) + '</strong> ' + skillTagsHtml + '</span>' : '') +
          '</div>' +
          '<div class="opp-notes">' +
            escapeHtml(notes) +
          '</div>' +
          '<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">' +
            '<a class="btn-action btn-primary" href="' + escapeHtml(r.url) + '" target="_blank" rel="noopener">' +
              escapeHtml(t.openOfferBtn) + '</a>' +
            '<button type="button" class="btn-action btn-ai-info" onclick="openAiProposalForJob(\\'' + escapeHtml(r.job_hash) + '\\', this)">' +
              escapeHtml(t.draftAiBtn || 'Más información con IA') + '</button>' +
          '</div>' +
        '</article>';
      }).join('');
      initCardScrollReveal(container);
    }

    let cardRevealObserver = null;
    let lastRevealScrollY = 0;
    let lastRevealScrollTs = 0;
    let isFastScrolling = false;

    if (typeof window.addEventListener === 'function') {
      window.addEventListener('scroll', () => {
        const now = Date.now();
        const y = typeof window.scrollY === 'number' ? window.scrollY : 0;
        const dt = Math.max(1, now - lastRevealScrollTs);
        isFastScrolling = (Math.abs(y - lastRevealScrollY) / dt) > 1.4;
        lastRevealScrollY = y;
        lastRevealScrollTs = now;
      }, { passive: true });
    }

    function initCardScrollReveal(rootEl) {
      if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return;
      const cards = rootEl.querySelectorAll('.opp-card, .radar-box, .guide-step');
      if (!cards || cards.length === 0) return;

      const reducedMotion = typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion || typeof IntersectionObserver !== 'function') {
        cards.forEach(c => {
          c.classList.remove('card-reveal-pending', 'card-reveal-pending-up');
          c.classList.add('card-reveal-visible');
        });
        return;
      }

      if (!cardRevealObserver) {
        cardRevealObserver = new IntersectionObserver((entries) => {
          let batchIdx = 0;
          entries.forEach(entry => {
            const el = entry.target;
            if (entry.isIntersecting) {
              el.style.transitionDelay = isFastScrolling ? '0ms' : Math.min(batchIdx * 18, 54) + 'ms';
              batchIdx++;
              el.classList.remove('card-reveal-pending', 'card-reveal-pending-up');
              el.classList.add('card-reveal-visible');
            } else {
              el.style.transitionDelay = '0ms';
              el.classList.remove('card-reveal-visible');
              const isAbove = entry.boundingClientRect && entry.boundingClientRect.top < 0;
              el.classList.toggle('card-reveal-pending-up', !!isAbove);
              el.classList.toggle('card-reveal-pending', !isAbove);
            }
          });
        }, {
          root: null,
          rootMargin: '60px 0px 60px 0px',
          threshold: 0.01
        });
      }

      const vh = window.innerHeight || 900;
      // Pass 1 (READ-ONLY): measure all bounding rects before mutating classes to avoid O(N) layout thrashing
      const rects = [];
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        rects.push(typeof card.getBoundingClientRect === 'function' ? card.getBoundingClientRect() : null);
      }
      // Pass 2 (WRITE-ONLY): apply initial reveal state and attach IntersectionObserver
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const rect = rects[i];
        card.classList.remove('card-reveal-visible', 'card-reveal-pending-up', 'card-reveal-pending');
        if (rect && rect.bottom <= -60) {
          card.classList.add('card-reveal-pending-up');
        } else if (rect && rect.top < vh + 40 && rect.bottom > -40) {
          card.classList.add('card-reveal-visible');
        } else {
          card.classList.add('card-reveal-pending');
        }
        card.style.transitionDelay = '0ms';
        cardRevealObserver.observe(card);
      }
    }
    window.initCardScrollReveal = initCardScrollReveal;

    let currentPlatformsGroupFilter = 'all';

    function setPlatformsGroupFilter(group) {
      currentPlatformsGroupFilter = group || 'all';
      const bar = document.getElementById('platformsFilterBar');
      if (bar && typeof bar.querySelectorAll === 'function') {
        bar.querySelectorAll('.btn-tab').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-plat-group') === currentPlatformsGroupFilter);
        });
      }
      renderPlatformsDirectory();
    }
    window.setPlatformsGroupFilter = setPlatformsGroupFilter;

    function formatPlatformTypeLabel(p) {
      const providerNames = {
        greenhouse: 'Greenhouse',
        lever: 'Lever',
        ashby: 'Ashby',
        workable: 'Workable',
        smartrecruiters: 'SmartRecruiters',
        recruitee: 'Recruitee',
        breezy: 'Breezy HR'
      };
      if (p.type === 'ats_json') {
        const prov = providerNames[p.ats_provider] || p.ats_provider || 'ATS';
        return 'ATS Directo · ' + prov;
      }
      if (p.type === 'json_api') return 'API JSON';
      if (p.type === 'rss_feed') return 'Feed RSS';
      if (p.type === 'html_board') return 'Portal Web';
      return 'Portal Monitoreado';
    }

    function renderPlatformsDirectory() {
      const t = I18N[userFilters.ui_lang] || I18N.es;
      const container = document.getElementById('platformsGridContainer');
      updateActivePlatformsCountUi();
      if (!container) return;

      const activePlatforms = (platformsState || []).filter(p => p && p.enabled !== false);
      const filtered = activePlatforms.filter(p => {
        if (currentPlatformsGroupFilter === 'ats') return p.type === 'ats_json' || String(p.id || '').startsWith('ats_');
        if (currentPlatformsGroupFilter === 'boards') return p.type !== 'ats_json' && !String(p.id || '').startsWith('ats_');
        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="radar-box"><p style="margin:0;">No hay plataformas en esta categoría por el momento. El motor autónomo de IA evalúa y promueve nuevas empresas directas automáticamente cada 15 minutos.</p></div>';
        return;
      }

      container.innerHTML = filtered.map(p => {
        const isAts = p.type === 'ats_json' || String(p.id || '').startsWith('ats_');
        const typeLabel = formatPlatformTypeLabel(p);
        const pills = ['<span class="plat-badge' + (isAts ? ' ats' : '') + '">' + escapeHtml(typeLabel) + '</span>'];
        if (p.discovered_by === 'ai_autonomous') {
          pills.push('<span class="plat-badge ai">Promovida por IA</span>');
        }
        if (Number(p.active_bolivia_jobs) > 0) {
          pills.push('<span class="plat-badge ats">' + Number(p.active_bolivia_jobs) + ' vacantes Bolivia</span>');
        }
        if (Number(p.spanish_jobs) > 0) {
          pills.push('<span class="plat-badge">Español disponible</span>');
        }

        return '<div class="radar-box">' +
          '<h4>' + escapeHtml(p.name) + '</h4>' +
          '<div class="plat-meta-pills">' + pills.join('') + '</div>' +
          '<p style="margin-bottom:6px;"><strong>' + escapeHtml(t.categoryLabel || 'Categoría') + ':</strong> ' + escapeHtml(cleanTrackName(p.track || '')) + '</p>' +
          '<p style="margin-bottom:10px;">' + escapeHtml(p.notes || p.url) + '</p>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
            '<a class="btn-action btn-secondary" style="padding:4px 10px;font-size:0.78em;" href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener">' +
              escapeHtml(t.openPlatformBtn) + '</a>' +
          '</div>' +
        '</div>';
      }).join('');
      initCardScrollReveal(container);
    }

    function setVerdictFilter(verdict) {
      currentVerdictFilter = verdict;
      document.querySelectorAll('#verdictFilterBar .btn-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-verdict') === verdict);
      });
      renderResultsCards();
    }

    let lazyStateHydrationTriggered = false;

    function switchMainView(viewName, opts) {
      if (
        opportunitiesState.length === 0 &&
        !lazyStateHydrationTriggered &&
        (viewName === 'results' || viewName === 'pulse' || viewName === 'platforms' || viewName === 'report')
      ) {
        lazyStateHydrationTriggered = true;
        refreshLiveStateFromServer();
      }
      const vResults = document.getElementById('view-results');
      const vManual = document.getElementById('view-manual');
      const vLegalTax = document.getElementById('view-legal-tax');
      const vReport = document.getElementById('view-report');
      const vPlatforms = document.getElementById('view-platforms');
      const vPulse = document.getElementById('view-pulse');

      if (vResults) vResults.style.display = viewName === 'results' ? '' : 'none';
      if (vManual) vManual.style.display = viewName === 'manual' ? '' : 'none';
      if (vLegalTax) vLegalTax.style.display = viewName === 'legal-tax' ? '' : 'none';
      if (vReport) vReport.style.display = viewName === 'report' ? '' : 'none';
      if (vPlatforms) vPlatforms.style.display = viewName === 'platforms' ? '' : 'none';
      if (vPulse) vPulse.style.display = viewName === 'pulse' ? '' : 'none';

      const isDedicatedPage = viewName === 'manual' || viewName === 'legal-tax' || viewName === 'platforms' || viewName === 'pulse';
      document.body.classList.toggle('view-manual-active', isDedicatedPage);

      const banner = document.querySelector('.top-banner');
      const filters = document.getElementById('custom-filters-panel');
      const aiPanel = document.getElementById('ai-cv-panel');
      const kpis = document.querySelector('.kpi-grid');
      const toolbar = document.querySelector('.toolbar');
      const footer = document.getElementById('footer-text');

      if (banner) banner.style.display = isDedicatedPage ? 'none' : '';
      if (filters) filters.style.display = isDedicatedPage ? 'none' : '';
      if (aiPanel) aiPanel.style.display = isDedicatedPage ? 'none' : '';
      if (kpis) kpis.style.display = isDedicatedPage ? 'none' : '';
      if (toolbar) toolbar.style.display = isDedicatedPage ? 'none' : '';
      if (footer) footer.style.display = '';

      const t = I18N[userFilters.ui_lang] || I18N.es;
      if (viewName === 'legal-tax') {
        document.title = 'Guía Legal y Fiscal (EE. UU. y Bolivia) — Bolivia Remote Work';
      } else if (viewName === 'pulse') {
        document.title = 'Pulso del Mercado Remoto desde Bolivia — Bolivia Remote Work';
      } else {
        document.title = t.pageTitle;
      }

      if (typeof window !== 'undefined' && window.history && typeof window.history.replaceState === 'function' && window.location && /^https?:$/i.test(window.location.protocol || '')) {
        try {
          const curPath = String(window.location.pathname || '').toLowerCase();
          const isLegalPath = curPath === '/guia-legal-fiscal' || curPath === '/guia-legal-fiscal/' || curPath === '/legal-fiscal' || curPath === '/legal-fiscal/';
          const isPulsePath = curPath === '/pulso' || curPath === '/pulso/';
          if (viewName === 'legal-tax' && curPath !== '/guia-legal-fiscal') {
            window.history.replaceState({ view: 'legal-tax' }, '', '/guia-legal-fiscal');
          } else if (viewName === 'pulse' && curPath !== '/pulso') {
            window.history.replaceState({ view: 'pulse' }, '', '/pulso');
          } else if (viewName === 'results' && (isLegalPath || isPulsePath)) {
            window.history.replaceState({ view: 'results' }, '', '/');
          }
        } catch (e) {}
      }

      if (isDedicatedPage && !(opts && opts.skipScroll)) {
        if (typeof window.scrollTo === 'function') {
          window.scrollTo(0, 0);
        }
      }
      if (viewName === 'manual' && vManual) {
        initCardScrollReveal(vManual);
      } else if (viewName === 'legal-tax' && vLegalTax) {
        initCardScrollReveal(vLegalTax);
      } else if (viewName === 'platforms' && vPlatforms) {
        initCardScrollReveal(vPlatforms);
      } else if (viewName === 'pulse' && vPulse) {
        renderMarketPulseView();
      } else if (viewName === 'report') {
        ensureReportMarkdownUpdated();
      }
      updateBackToTopPosition();

      const tabResults = document.getElementById('tab-view-results');
      const tabManual = document.getElementById('tab-view-manual');
      const tabReport = document.getElementById('tab-view-report');
      const tabPlatforms = document.getElementById('tab-view-platforms');

      if (tabResults) tabResults.classList.toggle('active', viewName === 'results');
      if (tabManual) tabManual.classList.toggle('active', viewName === 'manual');
      if (tabReport) tabReport.classList.toggle('active', viewName === 'report');
      if (tabPlatforms) tabPlatforms.classList.toggle('active', viewName === 'platforms');

      const navResults = document.getElementById('nav-results');
      const navManual = document.getElementById('nav-manual');
      const navLegalTax = document.getElementById('nav-legal-tax');
      const navPlatforms = document.getElementById('nav-platforms');
      const navPulse = document.getElementById('nav-pulse');

      if (navResults) navResults.classList.toggle('active-nav', viewName === 'results');
      if (navManual) navManual.classList.toggle('active-nav', viewName === 'manual');
      if (navLegalTax) navLegalTax.classList.toggle('active-nav', viewName === 'legal-tax');
      if (navPlatforms) navPlatforms.classList.toggle('active-nav', viewName === 'platforms');
      if (navPulse) navPulse.classList.toggle('active-nav', viewName === 'pulse');
    }
    window.switchMainView = switchMainView;

    function renderMarketPulseView() {
      const container = document.getElementById('pulseViewContainer');
      const subEl = document.getElementById('lbl-pulse-sub');
      if (!container) return;
      const p = marketPulseState;
      if (!p) {
        container.innerHTML = '<div class="pulse-summary-card"><p style="margin:0;">El primer pulso nocturno se sintetizará automáticamente a las 03:00 AM hora de Bolivia (UTC-4).</p></div>';
        return;
      }

      if (subEl) {
        subEl.textContent = (p.schedule_label_es || 'Síntesis nocturna · 03:00 AM Bolivia (UTC-4)') + (p.pulse_date ? ' · ' + p.pulse_date : '');
      }

      const ls = p.language_split || { es_count: 0, en_count: 0, es_share_pct: 0, en_share_pct: 0 };
      const comp = p.compensation_usd_monthly || {};
      const compVal = comp.sufficient_sample
        ? ('$' + Number(comp.median_monthly_usd || 0).toLocaleString('en-US') + '/mes')
        : 'Muestra insuficiente';
      const compSub = comp.sufficient_sample
        ? ('Mediana USD (IQR $' + Number(comp.p25_monthly_usd || 0).toLocaleString('en-US') + '–$' + Number(comp.p75_monthly_usd || 0).toLocaleString('en-US') + ' · n=' + Number(comp.sample_size || 0) + ')')
        : ('Solo ' + Number(comp.sample_size || 0) + ' ofertas con tarifa USD explícita (mín. 5)');

      const renderCatBars = (list) => {
        if (!Array.isArray(list) || list.length === 0) {
          return '<p style="margin:0;font-size:0.86em;color:var(--text-muted);">Sin datos suficientes en este ciclo.</p>';
        }
        const maxCount = Math.max(1, ...list.map(c => Number(c.count || 0)));
        return list.map(c => {
          const widthPct = Math.max(8, Math.round((Number(c.count || 0) / maxCount) * 100));
          return '<div class="pulse-bar-row">' +
            '<div class="pulse-bar-meta"><span>' + escapeHtml(c.label_es || c.id) + '</span><strong>' + Number(c.count || 0) + ' (' + Number(c.share_pct || 0) + '%)</strong></div>' +
            '<div class="pulse-bar-track"><div class="pulse-bar-fill" style="width:' + widthPct + '%;"></div></div>' +
          '</div>';
        }).join('');
      };

      const highlightsHtml = Array.isArray(p.highlights_es) && p.highlights_es.length > 0
        ? '<ul class="pulse-highlights">' + p.highlights_es.map(h => '<li>' + escapeHtml(h) + '</li>').join('') + '</ul>'
        : '';

      const atsCompanies = Array.isArray(p.newly_promoted_companies) ? p.newly_promoted_companies : [];
      const companiesHtml = atsCompanies.length > 0
        ? '<div class="pulse-companies-list">' + atsCompanies.map(c =>
            '<a class="pulse-company-pill" href="' + escapeHtml(c.url || '#') + '" target="_blank" rel="noopener noreferrer">' +
              '<span>' + escapeHtml(c.name) + '</span>' +
              (c.active_bolivia_jobs > 0 ? '<span class="plat-badge ats">' + Number(c.active_bolivia_jobs) + '</span>' : '') +
            '</a>'
          ).join('') + '</div>'
        : '<p style="margin:0;font-size:0.86em;color:var(--text-muted);">El motor autónomo evalúa y promueve nuevas empresas directas ATS cada 15 minutos.</p>';

      const ghostWatch = Number((p.ghost_job_health && p.ghost_job_health.watch_count) || 0);
      const ghostHigh = Number((p.ghost_job_health && p.ghost_job_health.high_count) || 0);

      container.innerHTML =
        '<div class="pulse-summary-card" id="pulse-summary-card">' +
          '<h4>' + escapeHtml(p.headline_es || 'Pulso del Mercado Remoto desde Bolivia') + '</h4>' +
          '<p>' + escapeHtml(p.summary_es || '') + '</p>' +
          highlightsHtml +
        '</div>' +
        '<div class="pulse-kpi-grid">' +
          '<div class="pulse-kpi"><div class="pulse-kpi-val">' + Number(p.total_active_eligible || 0) + '</div><div class="pulse-kpi-lbl">Vacantes 100% elegibles Bolivia (' + Number(p.new_last_24h || 0) + ' en últimas 24h)</div></div>' +
          '<div class="pulse-kpi"><div class="pulse-kpi-val">' + Number(ls.es_share_pct || 0) + '% ES / ' + Number(ls.en_share_pct || 0) + '% EN</div><div class="pulse-kpi-lbl">' + Number(ls.es_count || 0) + ' en español · ' + Number(ls.en_count || 0) + ' en inglés</div></div>' +
          '<div class="pulse-kpi"><div class="pulse-kpi-val">' + escapeHtml(compVal) + '</div><div class="pulse-kpi-lbl">' + escapeHtml(compSub) + '</div></div>' +
          '<div class="pulse-kpi"><div class="pulse-kpi-val">' + Number(p.direct_ats_platforms_count || 0) + ' ATS / ' + Number(p.active_platforms_count || 0) + ' total</div><div class="pulse-kpi-lbl">Empresas directas ATS promovidas por IA · ' + (ghostWatch + ghostHigh) + ' alertas fantasma</div></div>' +
        '</div>' +
        '<div class="pulse-split-grid">' +
          '<div class="pulse-panel"><h4>Categorías más activas en Español (ES)</h4>' + renderCatBars(p.top_categories_es) + '</div>' +
          '<div class="pulse-panel"><h4>Categorías más activas en Inglés (EN)</h4>' + renderCatBars(p.top_categories_en) + '</div>' +
        '</div>' +
        '<div class="pulse-panel"><h4>Empresas Directas (ATS) Promovidas Recientemente</h4>' + companiesHtml + '</div>';
    }
    window.renderMarketPulseView = renderMarketPulseView;

    if (typeof document.addEventListener === 'function') {
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          closePositionsDropdown();
          closeNavbarMenu();
        }
      });
    }

    function toggleCreatorMenu() {
      const hdr = document.getElementById('nav-hdr-creator-item');
      const items = document.querySelectorAll('#navbar li.nav-creator-item');
      let nowExpanded = false;
      items.forEach(item => {
        const isFolded = item.classList.toggle('nav-creator-folded');
        if (!isFolded) nowExpanded = true;
      });
      if (hdr) {
        hdr.classList.toggle('expanded', nowExpanded);
        hdr.setAttribute('aria-expanded', nowExpanded ? 'true' : 'false');
      }
    }
    window.toggleCreatorMenu = toggleCreatorMenu;

    let navbarAutoCloseTimer = null;

    function cancelNavbarAutoClose() {
      if (navbarAutoCloseTimer) {
        clearTimeout(navbarAutoCloseTimer);
        navbarAutoCloseTimer = null;
      }
    }
    window.cancelNavbarAutoClose = cancelNavbarAutoClose;

    function scheduleNavbarAutoClose() {
      cancelNavbarAutoClose();
      if (document.body.classList.contains && document.body.classList.contains('sidebar-collapsed')) return;
      navbarAutoCloseTimer = setTimeout(() => {
        closeNavbarMenu();
        navbarAutoCloseTimer = null;
      }, 320);
    }
    window.scheduleNavbarAutoClose = scheduleNavbarAutoClose;

    function scrollToTop() {
      if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
    window.scrollToTop = scrollToTop;

    function updateBackToTopPosition() {
      const topBtn = document.getElementById('btn-back-to-top');
      const footer = document.getElementById('footer-text');
      if (!topBtn) return;
      const y = typeof window.scrollY === 'number' ? window.scrollY : 0;
      if (topBtn.classList && typeof topBtn.classList.toggle === 'function') {
        topBtn.classList.toggle('visible', y >= 160);
      }
      if (!footer) return;
      const vw = typeof window.innerWidth === 'number' ? window.innerWidth : 1280;
      const vh = typeof window.innerHeight === 'number' ? window.innerHeight : 900;
      if (vw > 820 || footer.style.display === 'none' || typeof footer.getBoundingClientRect !== 'function') {
        topBtn.style.bottom = '';
        return;
      }
      const baseBottom = vw <= 640 ? 14 : 20;
      const footerRect = footer.getBoundingClientRect();
      const dockedBottom = Math.round(vh - footerRect.top + 10);
      if (dockedBottom > baseBottom) {
        topBtn.style.bottom = dockedBottom + 'px';
      } else {
        topBtn.style.bottom = '';
      }
    }
    window.updateBackToTopPosition = updateBackToTopPosition;

    function updateNavbarStickyState() {
      const nav = document.getElementById('navbar');
      if (!nav || !nav.classList) return;
      const y = typeof window.scrollY === 'number' ? window.scrollY : 0;
      nav.classList.toggle('navbar-scrolled', y > 4);
    }
    window.updateNavbarStickyState = updateNavbarStickyState;

    if (typeof window.addEventListener === 'function') {
      window.addEventListener('scroll', updateBackToTopPosition, { passive: true });
      window.addEventListener('scroll', updateNavbarStickyState, { passive: true });
      window.addEventListener('resize', updateBackToTopPosition, { passive: true });
    }

    function foldAllNavbarSubsections() {
      const sections = [
        { hdrId: 'nav-hdr-payments-item', itemSelector: '#navbar li.nav-payment-item', foldedClass: 'nav-payment-folded' },
        { hdrId: 'nav-hdr-creator-item', itemSelector: '#navbar li.nav-creator-item', foldedClass: 'nav-creator-folded' }
      ];
      sections.forEach(sec => {
        const hdr = document.getElementById(sec.hdrId);
        if (hdr) {
          if (hdr.classList && typeof hdr.classList.remove === 'function') {
            hdr.classList.remove('expanded');
          }
          if (typeof hdr.setAttribute === 'function') {
            hdr.setAttribute('aria-expanded', 'false');
          }
        }
        const items = typeof document.querySelectorAll === 'function' ? document.querySelectorAll(sec.itemSelector) : [];
        items.forEach(item => {
          if (item && item.classList && typeof item.classList.add === 'function') {
            item.classList.add(sec.foldedClass);
          }
        });
      });
    }
    window.foldAllNavbarSubsections = foldAllNavbarSubsections;

    let navbarOpenedScrollY = 0;
    let navbarOpenedAt = 0;

    function toggleSidebar(event) {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
      cancelNavbarAutoClose();
      const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
      const btn = document.getElementById('sidebar-unfold-btn');
      if (btn) {
        btn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      }
      if (isCollapsed) {
        foldAllNavbarSubsections();
      } else {
        navbarOpenedScrollY = (typeof window.scrollY === 'number' ? window.scrollY : 0);
        navbarOpenedAt = Date.now();
      }
    }
    window.toggleSidebar = toggleSidebar;

    function closeNavbarMenu() {
      cancelNavbarAutoClose();
      document.body.classList.add('sidebar-collapsed');
      const btn = document.getElementById('sidebar-unfold-btn');
      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
      }
      foldAllNavbarSubsections();
    }
    window.closeNavbarMenu = closeNavbarMenu;

    (function initNavbarHoverAutoClose() {
      const nav = document.getElementById('navbar');
      const navList = document.getElementById('navbar-menu-list');
      const navBtn = document.getElementById('sidebar-unfold-btn');
      [navList, navBtn].forEach(el => {
        if (el && typeof el.addEventListener === 'function') {
          el.addEventListener('mouseenter', () => {
            if (supportsFineHover()) cancelNavbarAutoClose();
          });
          el.addEventListener('mouseleave', () => {
            if (supportsFineHover()) scheduleNavbarAutoClose();
          });
        }
      });

      // Mobile & touch auto-close: tap/click outside navbar, tap any link inside menu, or scroll page
      const handleOutsideInteraction = (e) => {
        if (document.body.classList && typeof document.body.classList.contains === 'function' && document.body.classList.contains('sidebar-collapsed')) {
          return;
        }
        if ((Date.now() - navbarOpenedAt) < 120) return;
        if (nav && typeof nav.contains === 'function' && e && e.target && !nav.contains(e.target)) {
          closeNavbarMenu();
        }
      };

      if (typeof document.addEventListener === 'function') {
        document.addEventListener('pointerdown', handleOutsideInteraction, { passive: true });
        document.addEventListener('touchstart', handleOutsideInteraction, { passive: true });
        document.addEventListener('click', handleOutsideInteraction);
      }

      if (navList && typeof navList.addEventListener === 'function') {
        navList.addEventListener('click', (e) => {
          const target = e && e.target && typeof e.target.closest === 'function' ? e.target.closest('a') : null;
          if (target) {
            closeNavbarMenu();
          }
        });
      }

      if (typeof window.addEventListener === 'function') {
        window.addEventListener('scroll', () => {
          if (document.body.classList && typeof document.body.classList.contains === 'function' && document.body.classList.contains('sidebar-collapsed')) {
            return;
          }
          if ((Date.now() - navbarOpenedAt) < 400) return;
          const currentY = typeof window.scrollY === 'number' ? window.scrollY : 0;
          if (Math.abs(currentY - navbarOpenedScrollY) > 32) {
            closeNavbarMenu();
          }
        }, { passive: true });
      }
    })();

    function togglePaymentsMenu() {
      const hdr = document.getElementById('nav-hdr-payments-item');
      const items = document.querySelectorAll('#navbar li.nav-payment-item');
      let nowExpanded = false;
      items.forEach(item => {
        const isFolded = item.classList.toggle('nav-payment-folded');
        if (!isFolded) nowExpanded = true;
      });
      if (hdr) {
        hdr.classList.toggle('expanded', nowExpanded);
        hdr.setAttribute('aria-expanded', nowExpanded ? 'true' : 'false');
      }
    }
    window.togglePaymentsMenu = togglePaymentsMenu;

    async function refreshLiveStateFromServer() {
      if (typeof fetch !== 'function') return;
      try {
        const resp = await fetch('/api/state', { method: 'GET', cache: 'no-store' });
        if (!resp.ok) return;
        const data = await resp.json();
        if (Array.isArray(data.opportunities)) {
          opportunitiesState = data.opportunities;
        }
        if (Array.isArray(data.platforms)) {
          platformsState = data.platforms;
        }
        if (data.lastScanAt) {
          lastScanAtState = data.lastScanAt;
        }
        if (data.market_pulse) {
          marketPulseState = data.market_pulse;
        }
        recomputeAndRender();
        renderPlatformsDirectory();
        renderMarketPulseView();
      } catch (e) {
        // Ignore network errors when opened offline as standalone index.html
      }
    }
    window.refreshLiveStateFromServer = refreshLiveStateFromServer;

    let currentAiTargetJobHash = '';
    let lastAiResultData = null;
    let aiPanelOpenedAt = 0;

    function setAiCvPanelFolded(folded) {
      const panel = document.getElementById('ai-cv-panel');
      if (panel) {
        panel.classList.toggle('ai-cv-folded', Boolean(folded));
      }
    }
    window.setAiCvPanelFolded = setAiCvPanelFolded;

    function closeAiDiagnosticPanel() {
      setAiCvPanelFolded(true);
      clearAiTargetJob();
      const resBox = document.getElementById('ai-cv-result-box');
      if (resBox) resBox.style.display = 'none';
    }
    window.closeAiDiagnosticPanel = closeAiDiagnosticPanel;

    function handleAiPanelScrollAutoClose() {
      const panel = document.getElementById('ai-cv-panel');
      const resBox = document.getElementById('ai-cv-result-box');
      if (!panel || !resBox) return;
      if (panel.classList.contains && panel.classList.contains('ai-cv-folded')) return;
      if (Date.now() - aiPanelOpenedAt < 450) return;
      if (typeof resBox.getBoundingClientRect !== 'function') return;
      const rect = resBox.getBoundingClientRect();
      const vh = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0;
      if (vh > 0 && rect.height > 0 && (rect.bottom <= 0 || rect.top >= vh)) {
        closeAiDiagnosticPanel();
      }
    }
    window.handleAiPanelScrollAutoClose = handleAiPanelScrollAutoClose;

    if (typeof window.addEventListener === 'function') {
      window.addEventListener('scroll', handleAiPanelScrollAutoClose, { passive: true });
    }

    function openAiProposalForJob(jobHash, triggerBtn) {
      currentAiTargetJobHash = String(jobHash || '');
      aiPanelOpenedAt = Date.now();
      const job = opportunitiesState.find(o => o.job_hash === currentAiTargetJobHash);
      const pill = document.getElementById('ai-target-job-pill');
      const txt = document.getElementById('ai-target-job-text');
      if (job && pill && txt) {
        txt.textContent = job.title + ' (' + job.company + ')';
        pill.style.display = 'inline-flex';
      }
      const panel = document.getElementById('ai-cv-panel');
      let cardEl = null;
      if (triggerBtn && typeof triggerBtn.closest === 'function') {
        cardEl = triggerBtn.closest('.opp-card');
      }
      if (!cardEl && typeof document.querySelector === 'function') {
        cardEl = document.querySelector('.opp-card[data-job-hash="' + currentAiTargetJobHash + '"]');
      }
      if (panel && cardEl && typeof cardEl.insertAdjacentElement === 'function') {
        cardEl.insertAdjacentElement('afterend', panel);
      } else if (panel && cardEl && cardEl.parentNode) {
        cardEl.parentNode.insertBefore(panel, cardEl.nextSibling);
      }
      setAiCvPanelFolded(false);
      if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      submitAiCvMatch(job);
    }
    window.openAiProposalForJob = openAiProposalForJob;

    function clearAiTargetJob() {
      currentAiTargetJobHash = '';
      const pill = document.getElementById('ai-target-job-pill');
      if (pill) pill.style.display = 'none';
    }
    window.clearAiTargetJob = clearAiTargetJob;

    function renderAiPositionDetails(data) {
      const container = document.getElementById('ai-position-details');
      if (!container) return;
      const reqList = Array.isArray(data.requirements_es) ? data.requirements_es.filter(Boolean) : [];
      const skillList = Array.isArray(data.skills_experience_es) ? data.skills_experience_es.filter(Boolean) : [];
      const adviceList = Array.isArray(data.candidate_advice_es) ? data.candidate_advice_es.filter(Boolean) : [];
      const overview = String(data.overview_es || '').trim();
      const tzCompat = String(data.timezone_compatibility_es || '').trim();
      const realityObj = data.bolivia_reality || null;
      const realityItems = Array.isArray(data.bolivia_reality_es)
        ? data.bolivia_reality_es.filter(Boolean)
        : (realityObj && Array.isArray(realityObj.bolivia_reality_es) ? realityObj.bolivia_reality_es.filter(Boolean) : []);

      const renderList = items =>
        items.length > 0
          ? '<ul>' + items.map(item => '<li>' + escapeHtml(String(item)) + '</li>').join('') + '</ul>'
          : '<p>Información detallada disponible en la oferta original.</p>';

      let realityBadgesHtml = '';
      if (realityObj) {
        const badges = [];
        if (Array.isArray(realityObj.payout_rails) && realityObj.payout_rails.length > 0) {
          badges.push('<span class="reality-pill' + (realityObj.bolivia_tier === 'caution_friction' ? ' caution' : '') + '">Cobro: ' + escapeHtml(realityObj.payout_rails.join(' / ')) + '</span>');
        }
        if (Array.isArray(realityObj.eor_options) && realityObj.eor_options.length > 0) {
          badges.push('<span class="score-pill">Contrato: ' + escapeHtml(realityObj.eor_options.join(' / ')) + '</span>');
        }
        if (realityObj.ghost_risk === 'high' || realityObj.ghost_risk === 'watch') {
          badges.push('<span class="ghost-pill ' + escapeHtml(realityObj.ghost_risk) + '">Re-publicada ' + (Number(realityObj.sighting_count) || 2) + 'x (' + (Number(realityObj.repost_span_days) || 30) + ' días)</span>');
        }
        if (badges.length > 0) {
          realityBadgesHtml = '<div class="ai-reality-meta">' + badges.join('') + '</div>';
        }
      }

      let html = '';
      if (overview) {
        html += '<p class="ai-position-overview">' + escapeHtml(overview) + '</p>';
      }
      html += '<div class="ai-details-grid">';
      html += '<div class="ai-detail-block"><h4>Requisitos de la posición</h4>' + renderList(reqList) + '</div>';
      html += '<div class="ai-detail-block"><h4>Experiencia y habilidades útiles</h4>' + renderList(skillList) + '</div>';
      html += '<div class="ai-detail-block"><h4>Compatibilidad horaria con Bolivia (UTC-4)</h4><p>' +
        escapeHtml(tzCompat || 'Compatible con el huso horario de Bolivia (UTC-4) bajo modalidad remota internacional.') +
        '</p></div>';
      html += '<div class="ai-detail-block"><h4>Consejos para el candidato</h4>' + renderList(adviceList) + '</div>';
      html += '<div class="ai-detail-block ai-detail-reality"><h4>Realidad desde Bolivia: Contrato, Cobro e Historial</h4>' +
        realityBadgesHtml +
        (realityObj && realityObj.ai_synthesis_es ? '<p style="margin-bottom:8px;">' + escapeHtml(realityObj.ai_synthesis_es) + '</p>' : '') +
        renderList(realityItems.length > 0 ? realityItems : [
          'Modalidad habitual desde Bolivia: contratista independiente internacional mediante formulario W-8BEN (0% retención en EE. UU.).',
          'Canales de cobro recomendados en Bolivia: Deel, Payoneer o AirTM/USDC hacia QR bancario local.'
        ]) +
        '</div>';
      html += '</div>';

      container.innerHTML = html;
    }

    function buildOfflinePositionAnalysis(job) {
      const j = job || {
        title: 'Posición Remota',
        company: 'Empresa Contratante',
        platform_name: 'Portal Remoto',
        location: 'Remoto Global',
        description: '',
        tags: '',
        contract_caveat: 'fractional_or_fulltime'
      };
      const bol = checkBoliviaRemoteEligibility(j);
      const attrs = detectOfferAttributes(j);
      const catLabels = (attrs.categories || [])
        .map(cid => {
          const found = POSITION_CATEGORIES.find(c => c.id === cid);
          return found ? found.label_es : '';
        })
        .filter(Boolean);
      const expFound = EXPERIENCE_OPTIONS.find(e => e.id === attrs.experience);
      const expLabel = expFound ? expFound.label_es : 'Todos los niveles';
      const contractLabels = (attrs.contracts || [])
        .map(cid => {
          const found = CONTRACT_OPTIONS.find(c => c.id === cid);
          return found ? found.label_es : '';
        })
        .filter(Boolean);
      const langNames = { es: 'Español', en: 'Inglés', pt: 'Portugués', de: 'Alemán' };
      const langLabels = (attrs.languages || ['en']).map(l => langNames[l] || l.toUpperCase());

      const company = j.company || j.platform_name || 'la empresa';
      const loc = j.location || 'Remoto Global';
      const blob = (loc + ' ' + (j.title || '') + ' ' + (j.description || '') + ' ' + (j.tags || '')).toLowerCase();

      let tzText = 'Compatible con Bolivia (UTC-4): la oferta de ' + company + ' indica modalidad remota ("' + loc + '"). El huso horario UTC-4 facilita la coordinación en tiempo real con equipos de América y solapamiento matutino con Europa bajo contratación independiente (W-8BEN).';
      if (/\\b(?:async|asynchronous|asíncrono|asincrono|self-paced|flexible hours|horario flexible|work from anywhere|anywhere in the world)\\b/.test(blob)) {
        tzText = 'Excelente compatibilidad con Bolivia (UTC-4): ' + company + ' ofrece modalidad asíncrona o flexible ("' + loc + '"), permitiendo organizar tu jornada desde UTC-4 sin restricciones estrictas de horario.';
      } else if (/\\b(?:bolivia|south america|sudamérica|latam|latin america|latinoamérica|americas|américas|est|edt|eastern|us time|north america|canada)\\b/.test(blob)) {
        tzText = 'Alta compatibilidad directa con Bolivia (UTC-4): la ubicación declarada ("' + loc + '") y el enfoque regional de ' + company + ' coinciden con el huso horario boliviano (0 a 1 hora de diferencia con EST/EDT de EE. UU. y alineación total con LATAM).';
      } else if (/\\b(?:europe|europa|emea|cet|cest|uk|london|spain|españa|germany)\\b/.test(blob)) {
        tzText = 'Compatibilidad parcial-alta con Bolivia (UTC-4): para equipos en Europa/EMEA (' + company + ', "' + loc + '"), existe un solapamiento efectivo de 4 a 6 horas durante la mañana de Bolivia (08:00-13:00 BOT), ideal para reuniones tempranas y trabajo asíncrono por la tarde.';
      }

      const sk = attrs.matchedKeywords && attrs.matchedKeywords.length ? attrs.matchedKeywords.slice(0, 8) : [];
      const empReal = j.employer_reality || null;
      const offlineRealityItems = [];
      if (empReal && Array.isArray(empReal.eor_options) && empReal.eor_options.length > 0) {
        offlineRealityItems.push('Modalidad contractual habitual: ' + empReal.eor_options.join(', ') + ' (contratista internacional W-8BEN con 0% retención en EE. UU.).');
      } else {
        offlineRealityItems.push('Modalidad contractual habitual: contratista independiente internacional mediante W-8BEN (0% retención en EE. UU. desde Bolivia).');
      }
      if (empReal && Array.isArray(empReal.payout_rails) && empReal.payout_rails.length > 0) {
        offlineRealityItems.push('Canales de cobro conocidos en Bolivia: ' + empReal.payout_rails.join(', ') + '.');
      } else {
        offlineRealityItems.push('Canales de cobro sugeridos en Bolivia: Deel, Payoneer o AirTM/USDC hacia QR bancario local.');
      }
      if (empReal && empReal.caution_note_es) {
        offlineRealityItems.push('Atención Bolivia: ' + empReal.caution_note_es);
      }
      if (j.ghost_risk === 'high' || j.ghost_risk === 'watch') {
        offlineRealityItems.push('Historial de publicación: re-publicada ' + (Number(j.sighting_count) || 2) + 'x en ' + (Number(j.repost_span_days) || 30) + ' días.');
      }

      return {
        ok: true,
        ai_engine: 'edge-position-analyzer',
        overview_es:
          'Posición de ' + (j.title || 'Posición Remota') + ' en ' + company +
          ' (publicada en ' + (j.platform_name || company) + '). Área principal: ' +
          (catLabels.slice(0, 2).join(' / ') || 'Trabajo Remoto Internacional') +
          '. Elegibilidad: ' + (bol.badge_es || '100% Remoto Bolivia') +
          (j.compensation_usd ? '. Compensación referencial: ' + j.compensation_usd + '.' : '.'),
        requirements_es: [
          'Nivel de experiencia estimado: ' + expLabel + '.',
          'Idiomas requeridos / detectados: ' + langLabels.join(', ') + '.',
          'Modalidad de contratación: ' + (contractLabels.join(', ') || 'Remoto flexible / Tiempo completo') + ' (' + loc + ').'
        ],
        skills_experience_es: [
          sk.length
            ? 'Habilidades y herramientas clave detectadas: ' + sk.join(', ') + '.'
            : 'Experiencia demostrable en ' + (catLabels[0] || j.title || 'el área') + ' y gestión autónoma en equipos distribuidos.',
          'Dominio de colaboración remota (' + langLabels.join(' / ') + '), documentación clara y cumplimiento de entregables.',
          catLabels.length > 1
            ? 'Experiencia complementaria valorada en: ' + catLabels.slice(1, 3).join(', ') + '.'
            : 'Familiaridad con herramientas digitales de seguimiento, comunicación síncrona/asíncrona y métricas de desempeño.'
        ],
        timezone_compatibility_es: tzText,
        candidate_advice_es: [
          sk.length
            ? 'Destaca resultados concretos y proyectos recientes usando ' + sk.slice(0, 5).join(', ') + ' al inicio de tu perfil.'
            : 'Adapta tu CV destacando logros medibles directamente relacionados con "' + (j.title || 'la posición') + '".',
          'Indica explícitamente tu disponibilidad desde Bolivia (UTC-4), tu solapamiento horario con ' + company + ' y tu capacidad para facturar como contratista internacional (W-8BEN).',
          langLabels.includes('Inglés') && !langLabels.includes('Español')
            ? 'La oferta está orientada a inglés: prepara tu CV y respuestas de entrevista en inglés claro y conciso.'
            : 'Revisa los detalles completos en el portal original antes de postular y prepara ejemplos prácticos relevantes para el rol.'
        ],
        bolivia_reality: {
          bolivia_tier: (empReal && empReal.bolivia_tier) || 'open_global',
          payout_rails: (empReal && empReal.payout_rails) || [],
          eor_options: (empReal && empReal.eor_options) || [],
          ghost_risk: j.ghost_risk || 'none',
          sighting_count: Number(j.sighting_count) || 1,
          repost_span_days: Number(j.repost_span_days) || 0,
          bolivia_reality_es: offlineRealityItems
        },
        bolivia_reality_es: offlineRealityItems
      };
    }

    async function submitAiCvMatch(targetJob) {
      const errBox = document.getElementById('ai-cv-error');
      const resBox = document.getElementById('ai-cv-result-box');
      const detailsEl = document.getElementById('ai-position-details');
      const job = targetJob || opportunitiesState.find(o => o.job_hash === currentAiTargetJobHash) ||
        (lastEvaluationResult.surfaced && lastEvaluationResult.surfaced[0]) || null;

      if (errBox) {
        errBox.className = 'scan-alert';
        errBox.style.display = 'none';
      }
      if (detailsEl) {
        detailsEl.innerHTML = '<p class="ai-position-loading">Analizando información de la posición con IA...</p>';
      }
      if (resBox) {
        resBox.style.display = 'block';
      }

      try {
        const resp = await fetch('/api/ai/analyze-position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_job_hash: currentAiTargetJobHash || (job ? job.job_hash : ''),
            title: job ? job.title : '',
            company: job ? job.company : '',
            platform_id: job ? job.platform_id : '',
            platform_name: job ? job.platform_name : '',
            location: job ? job.location : '',
            description: job ? job.description : '',
            tags: job ? job.tags : '',
            contract_caveat: job ? job.contract_caveat : '',
            url: job ? job.url : ''
          })
        });
        if (!resp.ok) {
          const errJson = await resp.json().catch(() => ({}));
          throw new Error(errJson.error || 'Servicio IA no disponible');
        }
        const data = await resp.json();
        lastAiResultData = data;
        renderAiPositionDetails(data);
        if (resBox) resBox.style.display = 'block';
      } catch (e) {
        const fallbackData = buildOfflinePositionAnalysis(job);
        lastAiResultData = fallbackData;
        renderAiPositionDetails(fallbackData);
        if (resBox) resBox.style.display = 'block';
      }
    }
    window.submitAiCvMatch = submitAiCvMatch;
    window.analyzePositionWithAi = submitAiCvMatch;

    function copyReportMarkdown(btn) {
      ensureReportMarkdownUpdated();
      const t = I18N[userFilters.ui_lang] || I18N.es;
      const text = document.getElementById('liveReportMarkdownBox').textContent;
      navigator.clipboard.writeText(text).then(() => {
        const lbl = document.getElementById('lbl-copy-md');
        const orig = lbl.textContent;
        lbl.textContent = t.copiedMd;
        setTimeout(() => { lbl.textContent = orig; }, 1800);
      });
    }

    function downloadReportMarkdown() {
      ensureReportMarkdownUpdated();
      const text = document.getElementById('liveReportMarkdownBox').textContent;
      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'resultados-remoto-bolivia-' + new Date().toISOString().slice(0, 10) + '.md';
      a.click();
    }

    function downloadResultsCsv() {
      const rows = lastEvaluationResult.surfaced || [];
      const headers = ['Score', 'Verdict', 'Title', 'Company', 'Platform', 'Location', 'BoliviaEligible', 'Contracts', 'Experience', 'Languages', 'URL'];
      const csvLines = [headers.join(',')];
      for (const r of rows) {
        const vals = [
          r.total_score,
          r.verdict,
          '"' + String(r.title || '').replace(/"/g, '""') + '"',
          '"' + String(r.company || '').replace(/"/g, '""') + '"',
          '"' + String(r.platform_name || '').replace(/"/g, '""') + '"',
          '"' + String(r.location || '').replace(/"/g, '""') + '"',
          r.bolivia_eligible ? 'YES' : 'NO',
          '"' + (r.detected_contracts || []).join('|') + '"',
          r.detected_experience || '',
          '"' + (r.detected_languages || []).join('|') + '"',
          '"' + String(r.url || '').replace(/"/g, '""') + '"'
        ];
        csvLines.push(vals.join(','));
      }
      const blob = new Blob([csvLines.join('\\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'resultados-remoto-bolivia-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
    }

    // Initialize UI on load (Spanish Bolivia default)
    applyTheme(currentTheme);
    setUiLanguage(userFilters.ui_lang || 'es');
    syncSearchClearButton();
    const initPath = (typeof window !== 'undefined' && window.location) ? String(window.location.pathname || '').toLowerCase() : '';
    if (
      PAYLOAD.initialView === 'legal-tax' ||
      initPath === '/guia-legal-fiscal' ||
      initPath === '/guia-legal-fiscal/' ||
      initPath === '/legal-fiscal' ||
      initPath === '/legal-fiscal/'
    ) {
      switchMainView('legal-tax', { skipScroll: true });
    } else if (
      PAYLOAD.initialView === 'pulse' ||
      initPath === '/pulso' ||
      initPath === '/pulso/'
    ) {
      switchMainView('pulse', { skipScroll: true });
    } else {
      renderMarketPulseView();
    }
    updateBackToTopPosition();
    updateNavbarStickyState();

    // Read-only refresh from the 15-minute cron state while the page stays open
    setInterval(() => {
      refreshLiveStateFromServer();
    }, 15 * 60 * 1000);
  </script>
</body>
</html>`;
}
