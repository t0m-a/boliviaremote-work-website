/**
 * Self-Contained Bilingual UI Generator (Spanish Bolivia 'es-BO' first, switchable to English 'en')
 * Renders the complete interactive application with embedded data, on-the-fly Results generation,
 * customizable filters, custom platform URL scanner, in-app User Manual, and 15-minute + on-demand scan controls.
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

export function renderAppHtml(initialState) {
  const {
    opportunities = [],
    platforms = [],
    lastScanAt = new Date().toISOString()
  } = initialState;

  const eligibleOpportunities = (opportunities || []).filter(o => checkBoliviaRemoteEligibility(o).eligible);

  const clientPayload = JSON.stringify({
    opportunities: eligibleOpportunities,
    platforms,
    lastScanAt,
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
  <title>Empleos Remotos desde Bolivia — Buscador y Evaluador en Vivo</title>
  <link rel="icon" type="image/svg+xml" href="${FAVICON_DATA_URI}">
  <link rel="alternate icon" type="image/x-icon" href="/favicon.ico">
  <link rel="alternate icon" type="image/png" href="/favicon.png">
  <link rel="apple-touch-icon" href="/favicon.png">
  <meta name="description" content="Herramienta pública para filtrar, escanear y evaluar ofertas de trabajo remotas elegibles desde Bolivia según tus idiomas, área profesional, experiencia y tipo de contrato.">
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
      --bg-page: #f4f6f9;
      --bg-card: #ffffff;
      --text-main: #1e293b;
      --text-muted: #64748b;
      --accent-primary: #0284c7;
      --accent-secondary: #0f766e;
      --bolivia-red: #d52b1e;
      --bolivia-yellow: #f9e300;
      --bolivia-green: #007934;
      --apply-bg: #ecfdf5;
      --apply-border: #10b981;
      --apply-text: #065f46;
      --possible-bg: #fffbeb;
      --possible-border: #f59e0b;
      --possible-text: #92400e;
      --skip-bg: #f1f5f9;
      --skip-border: #94a3b8;
      --skip-text: #475569;
      --geo-bg: #fef2f2;
      --geo-border: #ef4444;
      --geo-text: #991b1b;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      color: var(--text-main);
      background-color: var(--bg-page);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.5;
      overflow-x: clip;
      max-width: 100%;
    }
    h1, h2, h3, h4, h5, p, span, a, li, label, .opp-card, .panel-card, .manual-card, .radar-box, .scan-alert, footer {
      overflow-wrap: break-word;
      word-wrap: break-word;
    }
    .bolivia-stripe {
      height: 5px;
      background: linear-gradient(90deg, var(--bolivia-red) 0%, var(--bolivia-red) 33.3%, var(--bolivia-yellow) 33.3%, var(--bolivia-yellow) 66.6%, var(--bolivia-green) 66.6%, var(--bolivia-green) 100%);
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1200;
    }
    button, a, label, input[type="checkbox"], .chip, .btn-tab, .btn-action, .pos-dropdown-toggle, .pos-dropdown-option {
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    #navbar {
      position: sticky;
      top: 5px;
      left: 0;
      margin-top: 5px;
      width: 100%;
      height: auto;
      border-bottom: 1px solid #e2e8f0;
      background: #ffffff;
      z-index: 1100;
      display: flex;
      flex-direction: column;
      transition: background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    }
    #navbar.navbar-scrolled {
      background: rgba(248, 250, 252, 0.72);
      -webkit-backdrop-filter: blur(12px) saturate(150%);
      backdrop-filter: blur(12px) saturate(150%);
      border-bottom-color: rgba(203, 213, 225, 0.75);
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
    }
    .navbar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      padding: 10px 24px;
      background: #f8fafc;
      width: 100%;
      transition: background 0.2s ease;
    }
    #navbar.navbar-scrolled .navbar-header {
      background: transparent;
    }
    .header-title {
      font-size: 1.38em;
      font-weight: 500;
      letter-spacing: 0.04em;
      line-height: 1.1;
      color: #0f172a;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    #nav-brand-title {
      background: linear-gradient(100deg, #0f172a 0%, #0369a1 58%, #059669 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      display: inline-block;
    }
    .navbar-header-actions {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .navbar-header .btn-theme-toggle {
      width: 34px;
      height: 34px;
      min-width: 34px;
      min-height: 34px;
      border-radius: 7px;
      background: #ffffff;
    }
    .sidebar-fold-btn,
    #sidebar-unfold-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: auto;
      height: 34px;
      padding: 6px 12px;
      border: 1px solid #10b981;
      border-radius: 6px;
      background: #ecfdf5;
      color: #065f46;
      font-size: 0.84em;
      font-weight: 700;
      line-height: 1.35;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .hamburger-label {
      display: inline-block;
      line-height: 1;
    }
    .sidebar-fold-btn:hover,
    #sidebar-unfold-btn:hover {
      background: #d1fae5;
      border-color: #059669;
      color: #064e3b;
    }
    .hamburger-icon {
      display: inline-flex;
      flex-direction: column;
      justify-content: space-between;
      width: 16px;
      height: 12px;
    }
    .hamburger-icon span {
      display: block;
      height: 2px;
      width: 100%;
      background: currentColor;
      border-radius: 1px;
    }
    #navbar ul {
      position: absolute;
      top: 100%;
      right: 24px;
      width: min(300px, calc(100vw - 32px));
      max-height: calc(100vh - 70px);
      margin: 0;
      padding: 0;
      overflow-y: auto;
      list-style: none;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 0 0 10px 10px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.14);
      z-index: 950;
      opacity: 1;
      transform: translateY(0);
      visibility: visible;
      pointer-events: auto;
      transition: opacity 0.28s ease, transform 0.28s ease, visibility 0.28s ease, max-height 0.28s ease;
    }
    body.sidebar-collapsed #navbar ul {
      opacity: 0;
      transform: translateY(-8px);
      visibility: hidden;
      pointer-events: none;
    }
    #navbar li {
      border-bottom: 1px solid #f1f5f9;
    }
    #navbar li.nav-group-header {
      background: #f1f5f9;
      padding: 10px 16px;
      font-size: 0.88em;
      font-weight: 700;
      text-transform: capitalize;
      letter-spacing: normal;
      color: #475569;
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
      background: #e2e8f0;
      color: #0f172a;
    }
    .nav-caret {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-right: 2px solid currentColor;
      border-bottom: 2px solid currentColor;
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
      padding-left: 26px;
      font-size: 0.85em;
    }
    #navbar li.nav-payment-desc,
    #navbar li.nav-creator-desc {
      padding: 10px 16px 12px 26px;
      background: #f8fafc;
    }
    #navbar li.nav-payment-desc p,
    #navbar li.nav-creator-desc p {
      margin: 0 0 8px 0;
      font-size: 0.78em;
      line-height: 1.45;
      color: #475569;
    }
    #navbar li.nav-payment-desc p:last-child,
    #navbar li.nav-creator-desc p:last-child {
      margin-bottom: 0;
    }
    #navbar li.nav-creator-desc p a {
      display: inline;
      padding: 0;
      color: var(--accent-primary);
      text-decoration: underline;
      font-size: inherit;
      font-weight: 600;
      background: transparent;
      border-left: none;
    }
    #navbar li.nav-creator-desc p a:hover {
      background: transparent;
      color: var(--accent-hover);
      border-left: none;
    }
    #navbar a {
      display: block;
      padding: 10px 16px;
      color: #334155;
      text-decoration: none;
      font-size: 0.88em;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    #navbar a:hover, #navbar a.active-nav {
      background: #e0f2fe;
      color: #0369a1;
      font-weight: 700;
      border-left: 3px solid var(--accent-primary);
    }
    #navbar a#nav-manual {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
    }
    #navbar a#nav-manual:hover {
      background: #e2e8f0;
      color: #0f172a;
      border-left: none;
    }
    #navbar a#nav-manual.active-nav {
      background: #e2e8f0;
      color: #0f172a;
      border-left: 3px solid var(--accent-primary);
    }
    #main-doc,
    body.sidebar-collapsed #main-doc {
      margin-left: 0;
      max-width: 100% !important;
      width: 100% !important;
      box-sizing: border-box;
      padding: 22px 24px 60px 24px;
      transition: padding 0.25s ease;
    }
    body.sidebar-collapsed .top-banner,
    body.sidebar-collapsed .panel-card,
    body.sidebar-collapsed .kpi-grid,
    body.sidebar-collapsed .toolbar,
    body.sidebar-collapsed #view-results,
    body.sidebar-collapsed #view-manual,
    body.sidebar-collapsed #view-report,
    body.sidebar-collapsed #view-platforms,
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
    body.view-manual-active #custom-url-panel,
    body.view-manual-active #ai-cv-panel,
    body.view-manual-active .kpi-grid,
    body.view-manual-active .toolbar {
      display: none !important;
    }
    .manual-card .btn-lang {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #0f172a;
    }
    .manual-card .btn-lang.active, .manual-card .btn-lang:hover {
      background: var(--accent-primary);
      color: #ffffff;
      border-color: var(--accent-primary);
    }
    .top-banner {
      background: var(--bg-card);
      color: var(--text-main);
      border: 1px solid #e2e8f0;
      padding: 12px 18px;
      border-radius: 10px;
      margin-bottom: 14px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
    }
    .banner-header-block {
      width: 100%;
      margin-bottom: 0;
    }
    .top-banner p,
    .banner-subtitle-line {
      margin: 0;
      color: #334155;
      font-family: inherit;
      font-size: 0.92em;
      font-weight: 400;
      line-height: 1.5;
    }
    .top-banner h1,
    #banner-title {
      display: inline;
      margin: 0;
      font-size: inherit;
      font-weight: 700;
      color: inherit;
      line-height: inherit;
    }
    .banner-inline-sep {
      display: inline;
      margin: 0 6px;
      opacity: 0.65;
    }
    #banner-subtitle,
    .banner-disclaimer {
      display: inline;
      margin: 0;
      font-size: inherit;
      line-height: inherit;
    }
    .banner-disclaimer {
      margin-left: 6px;
      white-space: nowrap;
    }
    .banner-disclaimer a {
      color: var(--accent-primary);
      text-decoration: underline;
      font-weight: 600;
    }
    .banner-disclaimer a:hover {
      color: var(--accent-hover);
    }
    .banner-actions-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      margin-bottom: 0;
      flex-wrap: wrap;
      width: 100%;
    }
    .lang-switch-group {
      display: inline-flex;
      gap: 7px;
      align-items: center;
      flex-wrap: wrap;
      max-width: 100%;
    }
    .btn-lang {
      padding: 5px 12px;
      border-radius: 999px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #334155;
      font-size: 0.79em;
      font-weight: 600;
      cursor: pointer;
      line-height: 1.4;
      white-space: normal;
      text-align: center;
      max-width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }
    .btn-lang.active, .btn-lang:hover {
      background: var(--accent-primary);
      color: #ffffff;
      border-color: var(--accent-primary);
    }
    .btn-scan-now {
      padding: 5px 12px;
      border-radius: 999px;
      border: 1px solid #10b981;
      background: rgba(16, 185, 129, 0.11);
      color: #065f46;
      font-size: 0.79em;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      line-height: 1.4;
      white-space: normal;
      text-align: center;
      max-width: 100%;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .btn-scan-now:hover {
      background: rgba(16, 185, 129, 0.20);
      border-color: #059669;
      color: #064e3b;
    }
    .btn-scan-now:disabled {
      opacity: 0.65;
      cursor: wait;
    }
    .banner-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
      align-items: center;
      width: 100%;
    }
    .banner-pill {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #334155;
      padding: 4px 11px;
      border-radius: 999px;
      font-size: 0.79em;
      font-weight: 600;
      white-space: normal;
      overflow-wrap: anywhere;
      line-height: 1.45;
      max-width: 100%;
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
    }
    .panel-card {
      background: var(--bg-card);
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 18px 22px;
      margin-bottom: 18px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
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
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid #f1f5f9;
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
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid #f1f5f9;
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
    .bolivia-only-label {
      font-size: 0.84em;
      font-weight: 700;
      color: #065f46;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      background: #ecfdf5;
      padding: 6px 11px;
      border-radius: 6px;
      border: 1px solid #10b981;
      max-width: 100%;
      white-space: normal;
      line-height: 1.35;
    }
    .bolivia-only-label input[type="checkbox"] {
      flex-shrink: 0;
      margin: 0;
    }
    .panel-title {
      margin: 0;
      font-size: 1.1em;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      flex: 1 1 240px;
      min-width: 0;
      line-height: 1.35;
    }
    .filter-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: stretch;
      width: 100%;
    }
    .filter-block {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
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
      font-size: 0.85em;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }
    .strict-pos-label {
      font-size: 0.8em;
      font-weight: 600;
      color: #334155;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
    }
    .keywords-input-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-top: 8px;
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
      font-weight: 600;
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
      width: 7px;
      height: 7px;
      border-right: 2px solid #64748b;
      border-bottom: 2px solid #64748b;
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
      top: calc(100% + 4px);
      left: 0;
      min-width: 100%;
      width: max-content;
      max-width: min(440px, calc(100vw - 48px));
      max-height: 310px;
      overflow-y: auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.16);
      padding: 6px;
      z-index: 950;
      opacity: 0;
      transform: translateY(-8px);
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.28s ease, transform 0.28s ease, visibility 0.28s ease;
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
      color: #1e293b;
      line-height: 1.35;
      user-select: none;
      transition: background 0.12s ease;
    }
    .pos-dropdown-option:hover {
      background: #f1f5f9;
    }
    .pos-dropdown-option.selected {
      background: #e0f2fe;
      color: #0369a1;
      font-weight: 600;
    }
    .pos-dropdown-option input[type="checkbox"] {
      margin-top: 2px;
      flex-shrink: 0;
      cursor: pointer;
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
      padding: 3px 9px;
      border-radius: 999px;
      background: var(--accent-primary);
      color: #ffffff;
      font-size: 0.78em;
      font-weight: 600;
      line-height: 1.3;
    }
    .pos-selected-tag button {
      border: none;
      background: transparent;
      color: #ffffff;
      font-size: 1.05em;
      line-height: 1;
      cursor: pointer;
      padding: 0 2px;
      font-weight: 700;
    }
    .chip-group {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      width: 100%;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 999px;
      border: 1px solid #cbd5e1;
      background: rgba(100, 116, 139, 0.08);
      color: #334155;
      font-size: 0.81em;
      font-weight: 600;
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
      background: rgba(2, 132, 199, 0.12);
      color: #0369a1;
      border-color: #0ea5e9;
      font-weight: 700;
    }
    @media (hover: hover) and (pointer: fine) {
      .chip:hover {
        background: rgba(2, 132, 199, 0.08);
        border-color: #0ea5e9;
        color: #0369a1;
      }
      .chip.selected:hover {
        background: rgba(2, 132, 199, 0.20);
        color: #0c4a6e;
        border-color: #0284c7;
      }
    }
    .input-text, .input-select {
      width: 100%;
      max-width: 100%;
      padding: 8px 11px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.88em;
      background: #ffffff;
      color: #0f172a;
    }
    .input-text:focus, .input-select:focus {
      outline: none;
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
    }
    .url-scanner-form {
      display: grid;
      grid-template-columns: minmax(220px, 2fr) minmax(150px, 1.1fr) minmax(160px, 1fr) auto;
      gap: 10px;
      align-items: end;
      width: 100%;
    }
    .url-scanner-form #btn-submit-url {
      min-height: 36px;
      height: auto;
      width: 100%;
      justify-content: center;
    }
    .form-field {
      min-width: 0;
      width: 100%;
    }
    .form-field label {
      display: block;
      font-size: 0.8em;
      font-weight: 700;
      color: #475569;
      margin-bottom: 4px;
    }
    .scan-alert {
      margin-top: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.88em;
      font-weight: 600;
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .scan-alert.success {
      display: flex;
      background: #ecfdf5;
      border: 1px solid #10b981;
      color: #065f46;
    }
    .scan-alert.error {
      display: flex;
      background: #fef2f2;
      border: 1px solid #ef4444;
      color: #991b1b;
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
      border: none;
      background: #e0f2fe;
      color: #0369a1;
      font-size: 0.78em;
      font-weight: 700;
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
      background: #bae6fd;
      color: #075985;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 18px;
      width: 100%;
    }
    .kpi-card {
      background: var(--bg-card);
      border-radius: 8px;
      padding: 14px 16px;
      border-left: 5px solid var(--accent-primary);
      box-shadow: 0 2px 5px rgba(0,0,0,0.04);
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      min-width: 0;
    }
    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 10px rgba(0,0,0,0.09);
    }
    .kpi-card.apply { border-left-color: var(--apply-border); }
    .kpi-card.possible { border-left-color: var(--possible-border); }
    .kpi-card.skip { border-left-color: var(--skip-border); }
    .kpi-card.geo { border-left-color: var(--geo-border); }
    .kpi-value {
      font-size: 1.6em;
      font-weight: 800;
      line-height: 1.1;
    }
    .kpi-label {
      font-size: 0.82em;
      color: var(--text-muted);
      margin-top: 4px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-card);
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
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
      gap: 8px;
      align-items: center;
      max-width: 100%;
    }
    .btn-tab {
      border: 1px solid #cbd5e1;
      background: rgba(100, 116, 139, 0.08);
      color: #334155;
      padding: 7px 13px;
      border-radius: 6px;
      font-size: 0.85em;
      font-weight: 600;
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
    .btn-tab:hover, .btn-tab.active {
      background: rgba(2, 132, 199, 0.12);
      color: #0369a1;
      border-color: #0ea5e9;
      font-weight: 700;
    }
    .btn-tab.active:hover {
      background: rgba(2, 132, 199, 0.20);
      color: #0c4a6e;
      border-color: #0284c7;
    }
    .btn-tab.btn-tab-scan {
      background: rgba(16, 185, 129, 0.11);
      color: #065f46;
      border-color: #10b981;
      font-weight: 700;
    }
    .btn-tab.btn-tab-scan:hover {
      background: rgba(16, 185, 129, 0.20);
      color: #064e3b;
      border-color: #059669;
    }
    .btn-tab.btn-tab-scan:disabled {
      opacity: 0.65;
      cursor: wait;
    }
    .opp-card {
      background: var(--bg-card);
      border: 1px solid #e2e8f0;
      border-left: 5px solid var(--accent-primary);
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 14px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.03);
      max-width: 100%;
    }
    .opp-card.verdict-APPLY { border-left-color: var(--apply-border); }
    .opp-card.verdict-POSSIBLE { border-left-color: var(--possible-border); }
    .opp-card.verdict-SKIP { border-left-color: var(--skip-border); opacity: 0.88; }
    .opp-card.verdict-GEO { border-left-color: var(--geo-border); opacity: 0.78; }
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
      .sidebar-fold-btn,
      #sidebar-unfold-btn {
        animation: none !important;
      }
    }
    .opp-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 8px;
    }
    .opp-title {
      margin: 0;
      font-size: 1.1em;
      font-weight: 700;
      color: #0f172a;
      flex: 1 1 240px;
      min-width: 0;
      line-height: 1.35;
    }
    .opp-company {
      font-weight: 500;
      color: #475569;
    }
    .opp-notes {
      font-size: 0.88em;
      color: #334155;
      margin-top: 6px;
      line-height: 1.5;
    }
    .opp-tags-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 14px;
      margin-bottom: 6px;
    }
    .opp-tag-group {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      max-width: 100%;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.78em;
      font-weight: 700;
      white-space: normal;
      text-align: center;
      line-height: 1.3;
      max-width: 100%;
    }
    .badge-APPLY { background: var(--apply-bg); color: var(--apply-text); border: 1px solid var(--apply-border); }
    .badge-POSSIBLE { background: var(--possible-bg); color: var(--possible-text); border: 1px solid var(--possible-border); }
    .badge-SKIP { background: var(--skip-bg); color: var(--skip-text); border: 1px solid var(--skip-border); }
    .badge-GEO { background: var(--geo-bg); color: var(--geo-text); border: 1px solid var(--geo-border); }
    .meta-line {
      font-size: 0.86em;
      color: var(--text-muted);
      margin-bottom: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
    }
    .meta-line > span {
      max-width: 100%;
      overflow-wrap: anywhere;
    }
    .bolivia-pill {
      display: inline-block;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      padding: 2px 9px;
      border-radius: 999px;
      font-size: 0.79em;
      font-weight: 700;
      max-width: 100%;
      white-space: normal;
      line-height: 1.35;
    }
    .bolivia-pill.restricted {
      background: #fef2f2;
      color: #991b1b;
      border-color: #fecaca;
    }
    .score-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-bottom: 10px;
    }
    .score-pill {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 3px 9px;
      font-size: 0.8em;
      font-weight: 600;
      color: #334155;
      max-width: 100%;
      white-space: normal;
    }
    .skill-tag {
      display: inline-block;
      background: #e0f2fe;
      color: #0369a1;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.78em;
      margin: 2px 4px 2px 0;
      font-family: monospace;
      max-width: 100%;
      overflow-wrap: anywhere;
    }
    .comp-pill {
      display: inline-block;
      background: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
      padding: 2px 9px;
      border-radius: 999px;
      font-size: 0.79em;
      font-weight: 700;
      max-width: 100%;
    }
    .semantic-pill {
      display: inline-block;
      background: #ede9fe;
      color: #5b21b6;
      border: 1px solid #c4b5fd;
      padding: 2px 9px;
      border-radius: 999px;
      font-size: 0.79em;
      font-weight: 700;
      max-width: 100%;
    }
    #ai-cv-panel.ai-cv-folded {
      display: none;
    }
    #resultsCardsContainer > #ai-cv-panel {
      margin-top: -6px;
      margin-bottom: 16px;
      border-left: 5px solid var(--accent-primary);
    }
    .ai-result-box {
      margin-top: 0;
      padding: 14px 16px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      display: none;
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
      padding: 10px 12px;
      border-radius: 6px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
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
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 14px;
    }
    .ai-detail-block h4 {
      margin: 0 0 8px 0;
      font-size: 0.88em;
      font-weight: 700;
      color: var(--accent-primary);
    }
    .ai-detail-block p {
      margin: 0;
      font-size: 0.85em;
      line-height: 1.5;
      color: var(--text-main);
    }
    .ai-detail-block ul {
      margin: 0;
      padding-left: 18px;
      font-size: 0.85em;
      line-height: 1.5;
      color: var(--text-main);
    }
    .ai-detail-block li {
      margin-bottom: 5px;
    }
    .ai-detail-block li:last-child {
      margin-bottom: 0;
    }
    .contract-tag {
      display: inline-block;
      background: #f3e8ff;
      color: #6b21a8;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.78em;
      margin: 2px 4px 2px 0;
      font-weight: 600;
      max-width: 100%;
      overflow-wrap: anywhere;
    }
    .lang-tag {
      display: inline-block;
      background: #fef3c7;
      color: #92400e;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.78em;
      margin: 2px 4px 2px 0;
      font-weight: 600;
      max-width: 100%;
      overflow-wrap: anywhere;
    }
    .btn-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 6px;
      font-size: 0.85em;
      font-weight: 700;
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
      background: rgba(2, 132, 199, 0.12);
      color: #0369a1 !important;
      border: 1px solid #0ea5e9;
    }
    .btn-primary:hover {
      background: rgba(2, 132, 199, 0.20);
      border-color: #0284c7;
      color: #0c4a6e !important;
    }
    .btn-secondary {
      background: rgba(100, 116, 139, 0.08);
      color: #334155 !important;
      border: 1px solid #94a3b8;
    }
    .btn-secondary:hover {
      background: rgba(100, 116, 139, 0.16);
      border-color: #64748b;
      color: #0f172a !important;
    }
    .btn-ai-info {
      background: #ecfdf5;
      color: #065f46 !important;
      border: 1px solid #10b981;
      border-radius: 6px;
      font-weight: 700;
    }
    .btn-ai-info:hover {
      background: #d1fae5;
      border-color: #059669;
      color: #064e3b !important;
    }
    .report-box {
      background: #0f172a;
      color: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      font-family: Consolas, Monaco, "Courier New", monospace;
      font-size: 0.86em;
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
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid var(--accent-primary);
      border-radius: 8px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-width: 0;
      max-width: 100%;
    }
    .radar-box h4 {
      margin: 0 0 6px 0;
      color: #0f172a;
      font-size: 0.95em;
    }
    .radar-box p {
      margin: 0;
      font-size: 0.84em;
      color: #475569;
    }

    /* USER MANUAL STYLES */
    .manual-container {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .manual-card {
      background: var(--bg-card);
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 22px 24px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    .manual-card h3 {
      margin: 0 0 12px 0;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1.15em;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 8px;
    }
    .manual-card h4 {
      color: #0f172a;
      border-bottom: 1px solid #f1f5f9;
    }
    .guide-step {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 18px;
      margin-bottom: 14px;
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
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--accent-primary);
      color: #ffffff;
      font-weight: 800;
      font-size: 0.88em;
      flex-shrink: 0;
    }
    .guide-step-title {
      font-size: 1.02em;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    #man-p-intro {
      font-size: 0.92em;
      color: #334155;
      line-height: 1.6;
    }
    .guide-step-body {
      font-size: 0.88em;
      color: #334155;
      line-height: 1.6;
    }
    .guide-step-body ul {
      margin: 6px 0 6px 20px;
      padding: 0;
    }
    .guide-step-body li {
      margin-bottom: 4px;
    }
    .guide-tip {
      background: #eff6ff;
      border-left: 4px solid var(--accent-primary);
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 0.85em;
      color: #1e40af;
      margin-top: 8px;
    }
    .guide-tip a,
    #man-p-intro a {
      color: #0369a1;
      text-decoration: underline;
      font-weight: 700;
      cursor: pointer;
    }
    .guide-tip a:hover,
    #man-p-intro a:hover {
      color: #0c4a6e;
    }
    .info-callout {
      background: #ecfdf5;
      border-left: 4px solid #10b981;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 0.88em;
      color: #065f46;
      margin: 12px 0;
    }
    .info-callout.warning {
      background: #fffbeb;
      border-left-color: #f59e0b;
      color: #92400e;
    }

    footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #cbd5e1;
      text-align: center;
      font-size: 0.82em;
      color: var(--text-muted);
    }
    .footer-status-pills {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 6px;
      margin-bottom: 0;
    }
    .footer-pill-btn {
      font-family: inherit;
      cursor: pointer;
      margin: 0;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .footer-pill-btn:hover,
    .footer-pill-btn:focus-visible,
    .footer-pill-btn.expanded,
    .footer-pill-btn.active-nav {
      background: #e2e8f0;
      border-color: #94a3b8;
      color: #0f172a;
      outline: none;
    }
    .footer-pill-caret {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-right: 1.8px solid currentColor;
      border-bottom: 1.8px solid currentColor;
      transform: rotate(-135deg);
      margin-left: 3px;
      margin-top: 2px;
      transition: transform 0.2s ease;
      flex-shrink: 0;
    }
    .footer-pill-btn.expanded .footer-pill-caret {
      transform: rotate(45deg);
      margin-top: -2px;
    }
    .footer-categories-dropdown {
      position: relative;
      display: inline-flex;
      align-items: center;
      max-width: 100%;
    }
    .footer-categories-menu {
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      width: min(260px, calc(100vw - 32px));
      margin: 0;
      padding: 4px 0;
      list-style: none;
      text-align: left;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.14);
      z-index: 950;
      display: none;
    }
    .footer-categories-dropdown.open .footer-categories-menu {
      display: block;
    }
    .footer-categories-menu li {
      border-bottom: 1px solid #f1f5f9;
    }
    .footer-categories-menu li:last-child {
      border-bottom: none;
    }
    .footer-categories-menu li.nav-track-item.nav-track-folded {
      display: none;
    }
    footer .footer-categories-menu a {
      display: block;
      padding: 8px 14px;
      color: #334155;
      text-decoration: none;
      font-size: 1.02em;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    footer .footer-categories-menu a:hover,
    footer .footer-categories-menu a.active-track {
      background: #e0f2fe;
      color: #0369a1;
      font-weight: 700;
    }
    .footer-credit {
      line-height: 1.45;
    }
    .banner-pill.footer-credit {
      display: inline-block;
      gap: 0;
    }
    footer a {
      color: var(--accent-primary);
      text-decoration: underline;
    }
    footer a:hover {
      color: var(--accent-hover);
    }
    .btn-back-to-top {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 900;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 13px;
      border-radius: 6px;
      border: 1px solid #0ea5e9;
      background: rgba(2, 132, 199, 0.12);
      backdrop-filter: blur(6px);
      color: #0369a1;
      font-size: 0.8em;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.10);
      transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.2s ease;
    }
    .btn-back-to-top:hover,
    .btn-back-to-top:focus-visible {
      background: rgba(2, 132, 199, 0.22);
      color: #0c4a6e;
      border-color: #0284c7;
      transform: translateY(-2px);
      outline: none;
    }
    .back-to-top-chevron {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-top: 2px solid currentColor;
      border-left: 2px solid currentColor;
      transform: rotate(45deg);
      margin-top: 3px;
      flex-shrink: 0;
    }
    /* THEME TOGGLE BUTTON */
    .btn-theme-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 27px;
      height: 27px;
      min-width: 27px;
      min-height: 27px;
      padding: 0;
      border-radius: 50%;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #0f172a;
      cursor: pointer;
      transition: all 0.15s ease;
      line-height: 1;
      flex-shrink: 0;
    }
    .btn-theme-toggle:hover {
      background: #e2e8f0;
      border-color: #94a3b8;
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
    .manual-card .btn-theme-toggle {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #0f172a;
    }
    .manual-card .btn-theme-toggle:hover {
      background: #e2e8f0;
      border-color: #94a3b8;
    }

    /* COMPLETE DARK MODE THEME */
    html.dark-mode, body.dark-mode {
      --bg-page: #0b0f17;
      --bg-card: #131d2e;
      --text-main: #e2e8f0;
      --text-muted: #94a3b8;
      background-color: #0b0f17;
      color: #e2e8f0;
    }
    body.dark-mode #navbar {
      background: #0f172a;
      border-bottom-color: #1e293b;
    }
    body.dark-mode #navbar.navbar-scrolled {
      background: rgba(15, 23, 42, 0.72);
      -webkit-backdrop-filter: blur(12px) saturate(150%);
      backdrop-filter: blur(12px) saturate(150%);
      border-bottom-color: rgba(51, 65, 85, 0.75);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.38);
    }
    body.dark-mode .navbar-header {
      background: #131d2e;
      border-bottom-color: #1e293b;
    }
    body.dark-mode #navbar.navbar-scrolled .navbar-header {
      background: transparent;
    }
    body.dark-mode .header-title {
      color: #f8fafc;
    }
    body.dark-mode #nav-brand-title {
      background: linear-gradient(100deg, #f8fafc 0%, #7dd3fc 58%, #6ee7b7 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    body.dark-mode .sidebar-fold-btn,
    body.dark-mode #sidebar-unfold-btn {
      background: #064e3b;
      color: #a7f3d0;
      border-color: #10b981;
    }
    body.dark-mode .sidebar-fold-btn:hover,
    body.dark-mode #sidebar-unfold-btn:hover {
      background: #047857;
      color: #ffffff;
      border-color: #34d399;
    }
    body.dark-mode #navbar ul {
      background: #0f172a;
      border-color: #334155;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    body.dark-mode #navbar li {
      border-bottom-color: #1e293b;
    }
    body.dark-mode #navbar li.nav-group-header {
      background: #131d2e;
      color: #94a3b8;
    }
    body.dark-mode #navbar li.nav-collapsible-header:hover {
      background: #1e293b;
      color: #f8fafc;
    }
    body.dark-mode #navbar a {
      color: #cbd5e1;
    }
    body.dark-mode #navbar a:hover, body.dark-mode #navbar a.active-nav {
      background: #1e293b;
      color: #38bdf8;
      border-left-color: #38bdf8;
    }
    body.dark-mode #navbar a#nav-manual {
      background: #131d2e;
      color: #94a3b8;
    }
    body.dark-mode #navbar a#nav-manual:hover {
      background: #1e293b;
      color: #f8fafc;
      border-left: none;
    }
    body.dark-mode #navbar a#nav-manual.active-nav {
      background: #1e293b;
      color: #f8fafc;
      border-left-color: #38bdf8;
    }
    body.dark-mode #navbar li.nav-payment-desc,
    body.dark-mode #navbar li.nav-creator-desc {
      background: #0f172a;
    }
    body.dark-mode #navbar li.nav-payment-desc p,
    body.dark-mode #navbar li.nav-creator-desc p {
      color: #94a3b8;
    }
    body.dark-mode #navbar li.nav-payment-desc p strong,
    body.dark-mode #navbar li.nav-creator-desc p strong {
      color: #e2e8f0;
    }
    body.dark-mode #navbar li.nav-creator-desc p a {
      color: #38bdf8;
    }
    body.dark-mode #navbar li.nav-creator-desc p a:hover {
      color: #7dd3fc;
    }
    body.dark-mode .top-banner {
      background: var(--bg-card);
      border-color: #1e293b;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      color: #e2e8f0;
    }
    body.dark-mode .top-banner h1,
    body.dark-mode .top-banner p,
    body.dark-mode .banner-subtitle-line,
    body.dark-mode #banner-subtitle,
    body.dark-mode .banner-disclaimer {
      color: #cbd5e1;
    }
    body.dark-mode .banner-disclaimer a {
      color: #38bdf8;
    }
    body.dark-mode .banner-disclaimer a:hover {
      color: #7dd3fc;
    }
    body.dark-mode .banner-pill {
      background: #0f172a;
      border-color: #334155;
      color: #cbd5e1;
    }
    body.dark-mode .btn-lang {
      background: #1e293b;
      color: #cbd5e1;
      border-color: #334155;
    }
    body.dark-mode .btn-lang.active, body.dark-mode .btn-lang:hover {
      background: var(--accent-primary);
      color: #ffffff;
      border-color: var(--accent-primary);
    }
    body.dark-mode .btn-theme-toggle,
    body.dark-mode .navbar-header .btn-theme-toggle {
      background: #1e293b;
      border-color: #334155;
      color: #fde047;
    }
    body.dark-mode .btn-theme-toggle:hover,
    body.dark-mode .navbar-header .btn-theme-toggle:hover {
      background: #334155;
      border-color: #475569;
    }
    body.dark-mode .manual-card .btn-theme-toggle {
      background: #1e293b;
      color: #fde047;
      border-color: #334155;
    }
    body.dark-mode .manual-card .btn-theme-toggle:hover {
      background: #334155;
      border-color: #475569;
    }
    body.dark-mode .panel-card {
      background: var(--bg-card);
      border-color: #1e293b;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    body.dark-mode .panel-header,
    body.dark-mode .filters-reset-actions {
      border-bottom-color: #1e293b;
    }
    body.dark-mode .panel-title {
      color: #f8fafc;
    }
    body.dark-mode .filter-block {
      background: #0f172a;
      border-color: #1e293b;
    }
    body.dark-mode .filter-block-label {
      color: #f1f5f9;
    }
    body.dark-mode .strict-pos-label {
      color: #94a3b8;
    }
    body.dark-mode .chip {
      background: rgba(148, 163, 184, 0.10);
      color: #cbd5e1;
      border-color: #334155;
    }
    body.dark-mode .chip.selected {
      background: rgba(14, 165, 233, 0.18);
      color: #7dd3fc;
      border-color: #0ea5e9;
    }
    @media (hover: hover) and (pointer: fine) {
      body.dark-mode .chip:hover {
        background: rgba(14, 165, 233, 0.14);
        border-color: #38bdf8;
        color: #7dd3fc;
      }
      body.dark-mode .chip.selected:hover {
        background: rgba(14, 165, 233, 0.28);
        color: #e0f2fe;
        border-color: #38bdf8;
      }
    }
    @media (hover: none), (pointer: coarse) {
      .btn-tab:not(.active):not(.btn-tab-scan):hover {
        background: rgba(100, 116, 139, 0.08);
        color: #334155;
        border-color: #cbd5e1;
        font-weight: 600;
      }
      body.dark-mode .btn-tab:not(.active):not(.btn-tab-scan):hover {
        background: rgba(148, 163, 184, 0.10);
        color: #cbd5e1;
        border-color: #334155;
        font-weight: 600;
      }
    }
    body.dark-mode .input-text, body.dark-mode .input-select {
      background: #0f172a;
      color: #f8fafc;
      border-color: #334155;
    }
    body.dark-mode .input-text:focus, body.dark-mode .input-select:focus {
      border-color: #38bdf8;
      box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
    }
    body.dark-mode .pos-dropdown-caret {
      border-color: #94a3b8;
    }
    body.dark-mode .pos-dropdown-menu {
      background: #0f172a;
      border-color: #334155;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5);
    }
    body.dark-mode .pos-dropdown-option {
      color: #e2e8f0;
    }
    body.dark-mode .pos-dropdown-option:hover {
      background: #1e293b;
    }
    body.dark-mode .pos-dropdown-option.selected {
      background: #082f49;
      color: #38bdf8;
    }
    body.dark-mode .form-field label {
      color: #94a3b8;
    }
    body.dark-mode .scan-alert.success {
      background: #064e3b;
      border-color: #10b981;
      color: #ecfdf5;
    }
    body.dark-mode .scan-alert.error {
      background: #450a0a;
      border-color: #ef4444;
      color: #fecaca;
    }
    body.dark-mode .scan-alert-close {
      background: #082f49;
      color: #38bdf8;
    }
    body.dark-mode .scan-alert-close:hover {
      background: #0c4a6e;
      color: #7dd3fc;
    }
    body.dark-mode .kpi-card {
      background: var(--bg-card);
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    body.dark-mode .kpi-value {
      color: #f8fafc;
    }
    body.dark-mode .btn-back-to-top {
      background: rgba(14, 165, 233, 0.18);
      color: #7dd3fc;
      border-color: #0ea5e9;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
    }
    body.dark-mode .btn-back-to-top:hover,
    body.dark-mode .btn-back-to-top:focus-visible {
      background: rgba(14, 165, 233, 0.28);
      color: #e0f2fe;
      border-color: #38bdf8;
    }
    body.dark-mode .toolbar {
      background: var(--bg-card);
      border-color: #1e293b;
    }
    body.dark-mode .btn-tab {
      background: rgba(148, 163, 184, 0.10);
      color: #cbd5e1;
      border-color: #334155;
    }
    body.dark-mode .btn-tab:hover, body.dark-mode .btn-tab.active {
      background: rgba(14, 165, 233, 0.18);
      color: #7dd3fc;
      border-color: #0ea5e9;
    }
    body.dark-mode .btn-tab.active:hover {
      background: rgba(14, 165, 233, 0.28);
      color: #e0f2fe;
      border-color: #38bdf8;
    }
    body.dark-mode .btn-tab.btn-tab-scan,
    body.dark-mode .btn-scan-now {
      background: rgba(16, 185, 129, 0.16);
      color: #a7f3d0;
      border-color: #10b981;
    }
    body.dark-mode .btn-tab.btn-tab-scan:hover,
    body.dark-mode .btn-scan-now:hover {
      background: rgba(16, 185, 129, 0.28);
      color: #ffffff;
      border-color: #34d399;
    }
    body.dark-mode .opp-card {
      background: var(--bg-card);
      border-color: #1e293b;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    body.dark-mode .opp-title {
      color: #f8fafc;
    }
    body.dark-mode .opp-company {
      color: #94a3b8;
    }
    body.dark-mode .opp-notes {
      color: #cbd5e1;
    }
    body.dark-mode .bolivia-only-label {
      background: #064e3b;
      color: #a7f3d0;
      border-color: #10b981;
    }
    body.dark-mode .score-pill {
      background: #0f172a;
      border-color: #334155;
      color: #cbd5e1;
    }
    body.dark-mode .skill-tag {
      background: #082f49;
      color: #38bdf8;
    }
    body.dark-mode .comp-pill {
      background: #064e3b;
      color: #a7f3d0;
      border-color: #10b981;
    }
    body.dark-mode .semantic-pill {
      background: #2e1065;
      color: #ddd6fe;
      border-color: #7c3aed;
    }
    body.dark-mode .ai-result-box {
      background: #0f172a;
      border-color: #334155;
      color: #cbd5e1;
    }
    body.dark-mode .ai-position-overview,
    body.dark-mode .ai-detail-block {
      background: #1e293b;
      border-color: #334155;
      color: #e2e8f0;
    }
    body.dark-mode .ai-detail-block h4 {
      color: #38bdf8;
    }
    body.dark-mode .ai-detail-block p,
    body.dark-mode .ai-detail-block ul {
      color: #cbd5e1;
    }
    body.dark-mode .contract-tag {
      background: #3b0764;
      color: #d8b4fe;
    }
    body.dark-mode .lang-tag {
      background: #451a03;
      color: #fde047;
    }
    body.dark-mode .btn-primary {
      background: rgba(14, 165, 233, 0.18);
      color: #7dd3fc !important;
      border-color: #0ea5e9;
    }
    body.dark-mode .btn-primary:hover {
      background: rgba(14, 165, 233, 0.28);
      color: #e0f2fe !important;
      border-color: #38bdf8;
    }
    body.dark-mode .btn-secondary {
      background: rgba(148, 163, 184, 0.12);
      color: #e2e8f0 !important;
      border-color: #475569;
    }
    body.dark-mode .btn-secondary:hover {
      background: rgba(148, 163, 184, 0.22);
      border-color: #64748b;
      color: #ffffff !important;
    }
    body.dark-mode .btn-ai-info {
      background: #064e3b;
      color: #a7f3d0 !important;
      border-color: #10b981;
    }
    body.dark-mode .btn-ai-info:hover {
      background: #047857;
      color: #ffffff !important;
      border-color: #34d399;
    }
    body.dark-mode .radar-box {
      background: #0f172a;
      border-color: #1e293b;
    }
    body.dark-mode .radar-box h4 {
      color: #f8fafc;
    }
    body.dark-mode .radar-box p {
      color: #94a3b8;
    }
    body.dark-mode .manual-card {
      background: var(--bg-card);
      border-color: #1e293b;
    }
    body.dark-mode .manual-card h3, body.dark-mode .manual-card h4 {
      color: #f8fafc;
      border-bottom-color: #1e293b;
    }
    body.dark-mode .manual-card .btn-lang {
      background: #1e293b;
      color: #cbd5e1;
      border-color: #334155;
    }
    body.dark-mode .manual-card .btn-lang.active, body.dark-mode .manual-card .btn-lang:hover {
      background: var(--accent-primary);
      color: #ffffff;
      border-color: var(--accent-primary);
    }
    body.dark-mode .guide-step {
      background: #0f172a;
      border-color: #1e293b;
    }
    body.dark-mode .guide-step-title {
      color: #f8fafc;
    }
    body.dark-mode #man-p-intro,
    body.dark-mode .guide-step-body {
      color: #cbd5e1;
    }
    body.dark-mode .guide-tip {
      background: #0c2340;
      color: #93c5fd;
      border-left-color: var(--accent-primary);
    }
    body.dark-mode .guide-tip a,
    body.dark-mode #man-p-intro a {
      color: #38bdf8;
    }
    body.dark-mode .guide-tip a:hover,
    body.dark-mode #man-p-intro a:hover {
      color: #7dd3fc;
    }
    body.dark-mode .info-callout {
      background: #064e3b;
      color: #a7f3d0;
      border-left-color: #10b981;
    }
    body.dark-mode footer {
      border-top-color: #1e293b;
    }
    body.dark-mode footer a {
      color: #38bdf8;
    }
    body.dark-mode footer a:hover {
      color: #7dd3fc;
    }
    body.dark-mode .footer-pill-btn:hover,
    body.dark-mode .footer-pill-btn:focus-visible,
    body.dark-mode .footer-pill-btn.expanded,
    body.dark-mode .footer-pill-btn.active-nav {
      background: #1e293b;
      border-color: #475569;
      color: #f8fafc;
    }
    body.dark-mode .footer-categories-menu {
      background: #0f172a;
      border-color: #334155;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    body.dark-mode .footer-categories-menu li {
      border-bottom-color: #1e293b;
    }
    body.dark-mode footer .footer-categories-menu a {
      color: #cbd5e1;
    }
    body.dark-mode footer .footer-categories-menu a:hover,
    body.dark-mode footer .footer-categories-menu a.active-track {
      background: #1e293b;
      color: #38bdf8;
    }

    @media only screen and (max-width: 1080px) {
      .url-scanner-form {
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
      }
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

    @keyframes boliviaHamburgerCycleLight {
      0%, 100% {
        background: rgba(239, 68, 68, 0.14);
        border-color: #ef4444;
        color: #991b1b;
      }
      30%, 40% {
        background: rgba(250, 204, 21, 0.28);
        border-color: #eab308;
        color: #a16207;
      }
      66.66% {
        background: rgba(16, 185, 129, 0.14);
        border-color: #10b981;
        color: #065f46;
      }
    }
    @keyframes boliviaHamburgerCycleDark {
      0%, 100% {
        background: rgba(239, 68, 68, 0.20);
        border-color: #ef4444;
        color: #fca5a5;
      }
      30%, 40% {
        background: rgba(250, 204, 21, 0.30);
        border-color: #facc15;
        color: #fef08a;
      }
      66.66% {
        background: rgba(16, 185, 129, 0.20);
        border-color: #10b981;
        color: #a7f3d0;
      }
    }

    @media only screen and (max-width: 820px) {
      .navbar-header {
        padding: 10px 16px;
      }
      .sidebar-fold-btn,
      #sidebar-unfold-btn {
        width: 36px;
        padding: 0;
        gap: 0;
        animation: boliviaHamburgerCycleLight 5.4s ease-in-out infinite;
      }
      body.dark-mode .sidebar-fold-btn,
      body.dark-mode #sidebar-unfold-btn {
        animation: boliviaHamburgerCycleDark 5.4s ease-in-out infinite;
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
        border: none;
        border-top: 1px solid #e2e8f0;
        border-bottom: 1px solid #cbd5e1;
        border-radius: 0 0 10px 10px;
        box-shadow: 0 12px 26px rgba(15, 23, 42, 0.16);
        max-height: calc(100vh - 64px);
      }
      body.dark-mode #navbar ul {
        border-top-color: #1e293b;
        border-bottom-color: #334155;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.55);
      }
      body.sidebar-collapsed #navbar ul {
        opacity: 0;
        transform: translateY(-6px);
        visibility: hidden;
        pointer-events: none;
      }
      #main-doc, body.sidebar-collapsed #main-doc {
        margin-left: 0;
        padding: 16px;
      }
      .top-banner,
      .panel-card,
      .manual-card {
        padding: 16px;
      }
      .top-banner {
        padding: 11px 14px;
      }
      #custom-filters-panel .panel-title {
        font-size: 0.92em;
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
        margin-top: 52px;
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
      .toolbar-scan-group .btn-tab {
        width: 100%;
      }
      #verdictFilterBar {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        width: 100%;
      }
      #verdictFilterBar .btn-tab {
        width: 100%;
        min-width: 0;
        padding: 8px 8px;
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
    }

    @media only screen and (max-width: 640px) {
      .navbar-header {
        padding: 10px 14px;
      }
      .header-title {
        font-size: 1.18em;
        letter-spacing: 0.025em;
      }
      #main-doc, body.sidebar-collapsed #main-doc {
        padding: 12px;
      }
      .top-banner,
      .panel-card,
      .manual-card,
      .opp-card {
        padding: 14px;
      }
      .top-banner {
        padding: 10px 12px;
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
      .banner-pill {
        white-space: normal;
        word-break: break-word;
        line-height: 1.4;
      }
      .lang-switch-group {
        width: 100%;
        justify-content: flex-start;
        flex-wrap: wrap;
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
        padding-bottom: 8px;
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
      body.dark-mode .filters-reset-actions {
        border-bottom: none;
      }
      .panel-header-actions .btn-action,
      .panel-header-actions .bolivia-only-label {
        width: 100%;
        justify-content: center;
      }
      .filter-grid {
        gap: 10px;
      }
      .filter-block {
        padding: 11px 12px;
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
      .url-scanner-form {
        grid-template-columns: 1fr;
      }
      .url-scanner-form #btn-submit-url {
        width: 100%;
        justify-content: center;
      }
      .kpi-grid {
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
        gap: 8px;
      }
      .btn-back-to-top {
        right: 12px;
        bottom: 14px;
        padding: 7px 11px;
        font-size: 0.76em;
      }
      .kpi-value {
        font-size: 1.35em;
      }
      .toolbar {
        padding: 12px;
        gap: 8px;
      }
      .toolbar-scan-group .btn-tab {
        width: 100%;
        padding: 8px 12px;
      }
      #verdictFilterBar {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        width: 100%;
      }
      #verdictFilterBar .btn-tab {
        width: 100%;
        min-width: 0;
        padding: 8px 10px;
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
      .opp-card .btn-action {
        width: 100%;
        justify-content: center;
      }
      .radar-grid {
        grid-template-columns: 1fr;
      }
      .radar-box p {
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .guide-step {
        padding: 12px 14px;
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
      .lang-switch-group .btn-scan-now {
        width: 100%;
      }
    }
  </style>
</head>
<body class="sidebar-collapsed">
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
            <span style="font-size:0.76em;color:#64748b;" id="lbl-weight-langs">(Peso: 20 pts)</span>
          </div>
          <div class="chip-group" id="chips-languages"></div>
        </div>

        <!-- 2. EXPERIENCE LEVEL -->
        <div class="filter-block filter-block-grow">
          <div class="filter-block-label">
            <span id="lbl-filter-exp">2. Tu Nivel de Experiencia</span>
            <span style="font-size:0.76em;color:#64748b;" id="lbl-weight-exp">(Peso: Contrato + Exp 20 pts)</span>
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
            <button type="button" style="border:none;background:none;color:#0284c7;font-size:0.78em;font-weight:700;cursor:pointer;" onclick="selectAllContracts()" id="btn-all-contracts">Todos</button>
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
            <button type="button" style="border:none;background:none;color:#0284c7;font-size:0.8em;font-weight:700;cursor:pointer;" onclick="clearPositions()" id="btn-clear-pos">Ver todas las áreas</button>
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
          <span style="font-size:0.78em;color:#64748b;" id="lbl-weight-pos">(Peso Posición/Habilidades: 35 pts · Elegibilidad Bolivia: 25 pts)</span>
        </div>
        <div id="pos-selected-tags" class="pos-selected-tags"></div>
      </div>
    </section>

    <!-- INFORMACION SOBRE LA POSICION PANEL (MASKED UNTIL TRIGGERED FROM A JOB CARD) -->
    <section class="panel-card ai-cv-folded" id="ai-cv-panel">
      <div id="ai-cv-error" class="scan-alert"></div>
      <div id="ai-cv-result-box" class="ai-result-box">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <strong style="font-size:0.95em;" id="lbl-ai-analysis-hdr">Información sobre la Posición</strong>
            <span id="ai-target-job-pill" style="display:none;font-size:0.78em;background:#e0f2fe;color:#0369a1;padding:2px 9px;border-radius:999px;font-weight:700;">
              <span id="ai-target-job-text"></span>
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button type="button" class="scan-alert-close" onclick="closeAiDiagnosticPanel()" aria-label="Cerrar" title="Cerrar">&times;</button>
          </div>
        </div>
        <div id="ai-position-details" class="ai-position-details"></div>
      </div>
    </section>

    <!-- KPI SUMMARY CARDS -->
    <section class="kpi-grid">
      <div class="kpi-card apply" onclick="switchMainView('results'); setVerdictFilter('APPLY');">
        <div class="kpi-value" style="color:#059669;"><span id="kpi-apply-cnt">0</span></div>
        <div class="kpi-label"><strong id="kpi-apply-title">POSTULAR</strong> (<span id="kpi-apply-sub">Puntaje ≥ 78/100</span>)</div>
      </div>
      <div class="kpi-card possible" onclick="switchMainView('results'); setVerdictFilter('POSSIBLE');">
        <div class="kpi-value" style="color:#d97706;"><span id="kpi-possible-cnt">0</span></div>
        <div class="kpi-label"><strong id="kpi-possible-title">EXPLORAR</strong> (<span id="kpi-possible-sub">Puntaje 58–77/100</span>)</div>
      </div>
      <div class="kpi-card skip" onclick="switchMainView('results'); setVerdictFilter('SKIP');">
        <div class="kpi-value" style="color:#475569;"><span id="kpi-skip-cnt">0</span></div>
        <div class="kpi-label"><strong id="kpi-skip-title">BAJA COINCIDENCIA</strong> (<span id="kpi-skip-sub">Fuera de tus filtros</span>)</div>
      </div>
    </section>

    <!-- TOOLBAR -->
    <section class="toolbar">
      <div class="filter-group toolbar-scan-group">
        <button type="button" class="btn-tab btn-tab-scan" id="btn-scan-now" onclick="triggerOnDemandScan()"><span id="lbl-scan-now">Escanear Ofertas Ahora</span></button>
      </div>
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
    <section id="view-results">
      <div id="semantic-status-bar" class="scan-alert success" style="display:none;margin-top:0;margin-bottom:14px;"></div>
      <div id="resultsCardsContainer"></div>
    </section>

    <!-- VIEW 2: INTERACTIVE USER MANUAL -->
    <section id="view-manual" style="display:none;">
      <div class="manual-container">
        <!-- GUÍA DEL USUARIO: Bolivia Remote Work -->
        <article class="manual-card">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;border-bottom:1px solid #f1f5f9;padding-bottom:12px;">
            <h3 id="man-h-intro" style="margin:0;">Guía del Usuario: Bolivia Remote Work</h3>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <button type="button" class="btn-action btn-primary" onclick="switchMainView('results')"><span id="man-btn-back">Volver a la Página Principal</span></button>
            </div>
          </div>
          <p id="man-p-intro">
            <strong>Bolivia Remote Work</strong> es una plataforma pública, gratuita e interactiva diseñada para encontrar, filtrar y evaluar en vivo oportunidades laborales internacionales que admiten trabajo 100% remoto desde Bolivia (UTC-4), eliminando el ruido de ofertas con restricciones territoriales o visados extranjeros. Puedes verificar las fuentes por tipo en <a href="#footer-categories-dropdown" id="man-link-categories" onclick="openFooterCategoriesFromManual(event)">Categorías De Plataformas</a> o consultar el directorio completo en <a href="#view-platforms" id="man-link-platforms" onclick="event.preventDefault(); switchMainView('platforms');">Plataformas Monitoreadas</a>.
          </p>
          <div class="info-callout" id="man-box-privacy">
            <strong>Privacidad Total y Sin Registros:</strong> No necesitas crear una cuenta ni ingresar datos personales. Tus filtros y preferencias se guardan de forma privada en tu propio navegador (localStorage).
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
                <li><strong>Senior (5+ años) &amp; Lead (8+ años):</strong> Especialistas, líderes técnicos y directores de área.</li>
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
                <li><strong style="color:#059669;">POSTULAR (Puntaje ≥ 78):</strong> Máxima afinidad con tus filtros e idiomas, verificada 100% para Bolivia. ¡Recomendada para postular de inmediato!</li>
                <li><strong style="color:#d97706;">EXPLORAR (Puntaje 58–77):</strong> Ofertas compatibles con pequeñas variaciones de modalidad o experiencia.</li>
                <li><strong style="color:#475569;">BAJA COINCIDENCIA (&lt; 58):</strong> Ofertas remotas válidas pero fuera de tus áreas o preferencias actuales.</li>
              </ul>
              <div class="guide-tip">
                Usa los botones del semáforo en la barra de herramientas para ver solo vacantes de <strong>Postular</strong> o <strong>Explorar</strong>, o escribe en la barra de búsqueda para filtrar por empresa o cargo al instante.
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
              En cada tarjeta de oferta, haz clic en el botón azul <strong>"Ver Oferta y Postular"</strong> para abrir directamente la página oficial de la empresa o bolsa de trabajo contratante, sin registros intermedios ni cobro de comisiones.
            </div>
          </div>

          <!-- PASO 8 -->
          <div class="guide-step" style="margin-bottom:0;">
            <div class="guide-step-header">
              <span class="guide-step-num">8</span>
              <h5 class="guide-step-title">Aprovecha "Más información con IA" y "Buscar con IA"</h5>
            </div>
            <div class="guide-step-body">
              La plataforma integra dos herramientas de inteligencia artificial pensadas para ahorrar tiempo y mejorar tus postulaciones desde Bolivia:
              <ul>
                <li><strong>Más información con IA (en cada tarjeta de oferta):</strong> Haz clic en el botón <strong>"Más información con IA"</strong> para desplegar justo debajo de la vacante un análisis detallado generado con Cloudflare Workers AI. Te muestra un resumen claro de la posición, los <em>Requisitos de la posición</em>, la <em>Experiencia y habilidades útiles</em>, la <em>Compatibilidad horaria con Bolivia (UTC-4)</em> y <em>Consejos para el candidato</em>. El panel se cierra automáticamente al desplazarte fuera de su área o al pulsar <code>&times;</code>.</li>
                <li><strong>Buscar con IA (en la barra de herramientas):</strong> Realiza una búsqueda semántica vectorial multilingüe sobre todas las ofertas 100% remotas para Bolivia. Escribe en lenguaje natural lo que buscas (por ejemplo: <em>"soporte al cliente bilingüe"</em>, <em>"desarrollador Python remoto"</em> o <em>"asistente contable"</em>) y pulsa <strong>"Buscar con IA"</strong> para ordenar las vacantes por afinidad semántica y relevancia. Puedes volver a la lista normal en cualquier momento con el botón <strong>"Borrar búsqueda"</strong> o cambiando cualquier filtro.</li>
              </ul>
            </div>
          </div>
        </article>
      </div>
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

    <!-- VIEW 4: MONITORED PLATFORMS & CUSTOM URLS -->
    <section id="view-platforms" style="display:none;">
      <div class="panel-card">
        <div class="panel-header">
          <div>
            <h3 class="panel-title"><span id="lbl-platforms-heading">Directorio de Plataformas Remotas Monitoreadas</span></h3>
            <span style="font-size:0.84em;color:#64748b;" id="lbl-platforms-sub">Haz clic en "Escanear" en cualquier plataforma para buscar nuevas ofertas al instante</span>
          </div>
          <button type="button" class="btn-action btn-primary" onclick="switchMainView('results')"><span id="plat-btn-back">Volver a la Página Principal</span></button>
        </div>
        <div id="platformsGridContainer" class="radar-grid"></div>
      </div>
    </section>

    <!-- ADD & SCAN CUSTOM PLATFORM URL PANEL -->
    <section class="panel-card" id="custom-url-panel" style="margin-top:18px;">
      <div class="panel-header" style="margin-bottom:10px;padding-bottom:8px;">
        <h2 class="panel-title"><span id="lbl-add-url-title">Agregar y Escanear tu Propia URL de Plataforma o Bolsa de Empleo</span></h2>
        <span style="font-size:0.82em;color:#64748b;" id="lbl-add-url-sub">Auto-detecta APIs JSON, Feeds RSS/Atom y Páginas Web de Empleo</span>
      </div>
      <form class="url-scanner-form" onsubmit="event.preventDefault(); submitCustomPlatformScan();">
        <div class="form-field">
          <label for="scan-url-input" id="lbl-url-field">URL de la Plataforma o Feed a Escanear *</label>
          <input type="text" id="scan-url-input" class="input-text" placeholder="https://remotive.com/api/remote-jobs o https://empresa.com/careers" required>
        </div>
        <div class="form-field">
          <label for="scan-name-input" id="lbl-name-field">Nombre (Opcional)</label>
          <input type="text" id="scan-name-input" class="input-text" placeholder="Ej: Mi Portal Remoto">
        </div>
        <div class="form-field">
          <label for="scan-type-select" id="lbl-type-field">Modo de Escaneo</label>
          <select id="scan-type-select" class="input-select">
            <option value="auto" id="opt-type-auto">Auto-detectar (Web / RSS / JSON)</option>
            <option value="html_board">Página Web / Bolsa HTML</option>
            <option value="rss_feed">Feed RSS / Atom XML</option>
            <option value="json_api">API JSON</option>
            <option value="portal_dork">Búsqueda Profunda de Portal</option>
          </select>
        </div>
        <div>
          <button type="submit" class="btn-action btn-primary" id="btn-submit-url">
            <span id="lbl-btn-submit-url">Escanear y Evaluar URL</span>
          </button>
        </div>
      </form>
      <div id="scan-feedback-box" class="scan-alert"></div>
    </section>

    <footer id="footer-text">
      <div class="footer-status-pills">
        <span class="banner-pill" id="pill-schedule">Ejecución: Bajo Demanda + Automático cada 15 min</span>
        <span class="banner-pill"><span id="lbl-last-sync">Última sincronización:</span> <span id="val-last-sync">-</span></span>
        <span class="banner-pill"><span id="lbl-monitored-count">Plataformas activas:</span> <span id="val-platforms-count">0</span></span>
        <div class="footer-categories-dropdown" id="footer-categories-dropdown">
          <button type="button" class="banner-pill footer-pill-btn" id="nav-hdr-tracks-item" onclick="toggleCategoriesMenu(event)" aria-expanded="false" aria-haspopup="true" aria-controls="footer-categories-menu">
            <span id="nav-hdr-tracks">Categorías De Plataformas</span>
            <span class="footer-pill-caret" id="nav-tracks-caret" aria-hidden="true"></span>
          </button>
          <ul id="footer-categories-menu" class="footer-categories-menu" role="menu">
            <li class="nav-track-item nav-track-folded"><a data-track="ALL" class="active-track" onclick="selectFooterTrack('ALL')"><span id="nav-track-all">Todas las Categorías</span></a></li>
            <li class="nav-track-item nav-track-folded"><a data-track="TRACK A" onclick="selectFooterTrack('TRACK A')"><span id="nav-track-a">B2B Directo &amp; Freelance</span></a></li>
            <li class="nav-track-item nav-track-folded"><a data-track="TRACK B" onclick="selectFooterTrack('TRACK B')"><span id="nav-track-b">Entrenamiento IA &amp; RLHF</span></a></li>
            <li class="nav-track-item nav-track-folded"><a data-track="TRACK C" onclick="selectFooterTrack('TRACK C')"><span id="nav-track-c">Redes LATAM &amp; Globales</span></a></li>
            <li class="nav-track-item nav-track-folded"><a data-track="TRACK D" onclick="selectFooterTrack('TRACK D')"><span id="nav-track-d">Portales Europeos &amp; Globales</span></a></li>
            <li class="nav-track-item nav-track-folded"><a data-track="TRACK E" onclick="selectFooterTrack('TRACK E')"><span id="nav-track-e">Redes de Consultoría Experta</span></a></li>
            <li class="nav-track-item nav-track-folded"><a data-track="TRACK F" onclick="selectFooterTrack('TRACK F')"><span id="nav-track-f">Bolsas de Empleo Remoto</span></a></li>
          </ul>
        </div>
        <button type="button" class="banner-pill footer-pill-btn" id="nav-platforms" onclick="switchMainView('platforms')">
          <span id="nav-lbl-platforms">Plataformas Monitoreadas</span>
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
    let currentTrackFilter = 'ALL';
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
        navTracks: 'Categorías De Plataformas',
        navTrackAll: 'Todas las Categorías',
        navTrackA: 'B2B Directo & Freelance',
        navTrackB: 'Entrenamiento IA & RLHF',
        navTrackC: 'Redes LATAM & Globales',
        navTrackD: 'Portales Europeos & Globales',
        navTrackE: 'Redes de Consultoría Experta',
        navTrackF: 'Bolsas de Empleo Remoto',
        navPayments: 'Información Financiera y de Pago',
        navPaymentsDesc: 'Las empresas suelen liquidar mediante plataformas de nómina global como <strong>AirTM. Wise, Payoneer o Tipalti</strong>. Desde estas cuentas puedes transferir vía SWIFT O transferancia ACH hacia tu cuenta bancaria boliviana en Boliviano o en USD, usar tarjetas de débito internacionales, o liquidar honorarios a través de pasarelas reguladas entre tus cuentas globales y locales.',
        categoryLabel: 'Categoría',
        themeDarkTitle: 'Cambiar a modo oscuro',
        themeLightTitle: 'Cambiar a modo claro',
        themeDarkText: 'Oscuro',
        themeLightText: 'Claro',
        bannerTitle: 'Buscador y Evaluador de Empleos Remotos desde Bolivia',
        bannerSubtitle: 'Filtra y evalúa ofertas globales y regionales que permiten trabajar remoto desde Bolivia. Personaliza tus idiomas, área profesional, experiencia y modalidad de contrato.',
        scanNow: 'Escanear Ofertas Ahora',
        scanningNow: 'Escaneando plataformas...',
        pillSchedule: 'Ejecución: Bajo Demanda + Automático cada 15 min',
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
        addUrlTitle: 'Agregar y Escanear tu Propia URL de Plataforma o Bolsa de Empleo',
        addUrlSub: 'Auto-detecta APIs JSON, Feeds RSS/Atom y Páginas Web de Empleo',
        urlField: 'URL de la Plataforma o Feed a Escanear *',
        nameField: 'Nombre (Opcional)',
        typeField: 'Modo de Escaneo',
        typeAuto: 'Auto-detectar (Web / RSS / JSON)',
        btnSubmitUrl: 'Escanear y Evaluar URL',
        scanningUrl: 'Escaneando URL...',
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
        platformsSub: 'Puedes escanear cualquier plataforma bajo demanda o agregar nuevas URLs abajo',
        verdictLabels: { APPLY: 'POSTULAR', POSSIBLE: 'EXPLORAR', SKIP: 'BAJA COINCIDENCIA', GEO: 'NO ELEGIBLE BOLIVIA' },
        scorePos: 'Posición/Habilidades',
        scoreBol: 'Remoto Bolivia',
        scoreCont: 'Contrato/Exp',
        scoreLang: 'Idiomas',
        matchedSkills: 'Habilidades / Etiquetas:',
        matchedLangs: 'Idiomas:',
        contractsLabel: 'Modalidad:',
        openOfferBtn: 'Ver Oferta y Postular',
        scanPlatformBtn: 'Escanear esta plataforma',
        openPlatformBtn: 'Abrir Portal',
        noResults: 'No se encontraron ofertas con los filtros actuales. Prueba ampliando los tipos de posición, contrato o palabras clave.',
        manBtnBack: 'Volver a la Página Principal',
        btnTop: 'Arriba',
        btnTopTitle: 'Volver arriba',
        footerText: 'Designed, engineered and hosted by <a href="mailto:contact@tsimon.me">Thomas Simon</a> · <a href="https://tsimon.me" title="Thomas Mathieu Simon  · Cloud Systems Architect · NOC &amp; AI Engineer" target="_blank" rel="noopener noreferrer">tsimon.me</a>'
      }
    };

    // Bring evaluation functions into client scope
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
        'nav-hdr-tracks': t.navTracks,
        'nav-track-all': t.navTrackAll,
        'nav-track-a': t.navTrackA,
        'nav-track-b': t.navTrackB,
        'nav-track-c': t.navTrackC,
        'nav-track-d': t.navTrackD,
        'nav-track-e': t.navTrackE,
        'nav-track-f': t.navTrackF,
        'nav-hdr-payments': t.navPayments,
        'nav-payments-desc': t.navPaymentsDesc,
        'banner-title': t.bannerTitle,
        'banner-subtitle': t.bannerSubtitle,
        'lbl-scan-now': t.scanNow,
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
        'lbl-add-url-title': t.addUrlTitle,
        'lbl-add-url-sub': t.addUrlSub,
        'lbl-url-field': t.urlField,
        'lbl-name-field': t.nameField,
        'lbl-type-field': t.typeField,
        'opt-type-auto': t.typeAuto,
        'lbl-btn-submit-url': t.btnSubmitUrl,
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
      const catDd = document.getElementById('footer-categories-dropdown');
      if (catDd && catDd.classList && catDd.classList.contains('open') && typeof catDd.getBoundingClientRect === 'function') {
        const cRect = catDd.getBoundingClientRect();
        if (cRect.bottom < 56 || cRect.top > vh) {
          closeCategoriesMenu();
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
        const catDd = document.getElementById('footer-categories-dropdown');
        if (catDd && catDd.classList.contains('open') && typeof catDd.contains === 'function' && !catDd.contains(e.target)) {
          closeCategoriesMenu();
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
      currentTrackFilter = 'ALL';
      updateActiveTrackHighlight();
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
        platformsState.length,
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
      const navPlatCntEl = document.getElementById('nav-cnt-platforms');
      if (navPlatCntEl) navPlatCntEl.textContent = platformsState.length;
      document.getElementById('val-platforms-count').textContent = platformsState.length;
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

    function onSearchInputChange(val) {
      syncSearchClearButton(val);
      if (!String(val || '').trim() && semanticOverrideResults) {
        clearSemanticSearch();
        return;
      }
      if (!semanticOverrideResults) {
        renderResultsCards();
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
        const tCode = extractTrackCode(r.track);
        if (currentTrackFilter !== 'ALL' && tCode !== currentTrackFilter) return false;
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

        return '<article class="opp-card verdict-' + vKey + '" data-job-hash="' + escapeHtml(r.job_hash) + '">' +
          '<div class="opp-header">' +
            '<h3 class="opp-title">#' + (idx + 1) + '. [' + r.total_score + '/100] ' + escapeHtml(r.title) +
              ' — <span class="opp-company">' + escapeHtml(r.company) + '</span></h3>' +
            '<span class="badge badge-' + vKey + '">' + escapeHtml(vLabel) + ' · ' + r.total_score + '/100</span>' +
          '</div>' +
          '<div class="meta-line">' +
            '<span class="bolivia-pill ' + (r.bolivia_eligible ? '' : 'restricted') + '">' + escapeHtml(bolBadge) + '</span>' +
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
      cards.forEach((card, idx) => {
        card.classList.remove('card-reveal-visible', 'card-reveal-pending-up', 'card-reveal-pending');
        const rect = typeof card.getBoundingClientRect === 'function' ? card.getBoundingClientRect() : null;
        if (rect && rect.bottom <= -60) {
          card.classList.add('card-reveal-pending-up');
          card.style.transitionDelay = '0ms';
        } else if (rect && rect.top < vh + 40 && rect.bottom > -40) {
          card.classList.add('card-reveal-visible');
          card.style.transitionDelay = '0ms';
        } else {
          card.classList.add('card-reveal-pending');
          card.style.transitionDelay = '0ms';
        }
        cardRevealObserver.observe(card);
      });
    }
    window.initCardScrollReveal = initCardScrollReveal;

    function renderPlatformsDirectory() {
      const t = I18N[userFilters.ui_lang] || I18N.es;
      const container = document.getElementById('platformsGridContainer');
      if (!container) return;

      container.innerHTML = platformsState.map(p => {
        return '<div class="radar-box">' +
          '<h4>' + escapeHtml(p.name) + ' <span style="font-size:0.76em;color:#0284c7;">(' + escapeHtml(p.type || 'portal') + ')</span></h4>' +
          '<p style="margin-bottom:6px;"><strong>' + escapeHtml(t.categoryLabel || 'Categoría') + ':</strong> ' + escapeHtml(cleanTrackName(p.track || '')) + '</p>' +
          '<p style="margin-bottom:10px;">' + escapeHtml(p.notes || p.url) + '</p>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
            '<button type="button" class="btn-action btn-primary" style="padding:4px 10px;font-size:0.78em;" onclick="scanExistingPlatform(\\'' + escapeHtml(p.url) + '\\', \\'' + escapeHtml(p.name) + '\\', \\'' + escapeHtml(p.type || 'auto') + '\\', \\'' + escapeHtml(p.track || '') + '\\')">' +
              escapeHtml(t.scanPlatformBtn) + '</button>' +
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

    function updateActiveTrackHighlight() {
      if (typeof document.querySelectorAll === 'function') {
        document.querySelectorAll('#footer-categories-menu a[data-track]').forEach(link => {
          link.classList.toggle('active-track', link.getAttribute('data-track') === currentTrackFilter);
        });
      }
    }

    function filterByTrack(trackCode) {
      currentTrackFilter = trackCode;
      updateActiveTrackHighlight();
      renderResultsCards();
    }

    function switchMainView(viewName) {
      closeCategoriesMenu();
      const vResults = document.getElementById('view-results');
      const vManual = document.getElementById('view-manual');
      const vReport = document.getElementById('view-report');
      const vPlatforms = document.getElementById('view-platforms');

      if (vResults) vResults.style.display = viewName === 'results' ? '' : 'none';
      if (vManual) vManual.style.display = viewName === 'manual' ? '' : 'none';
      if (vReport) vReport.style.display = viewName === 'report' ? '' : 'none';
      if (vPlatforms) vPlatforms.style.display = viewName === 'platforms' ? '' : 'none';

      const isDedicatedPage = viewName === 'manual' || viewName === 'platforms';
      document.body.classList.toggle('view-manual-active', isDedicatedPage);

      const banner = document.querySelector('.top-banner');
      const filters = document.getElementById('custom-filters-panel');
      const urlPanel = document.getElementById('custom-url-panel');
      const aiPanel = document.getElementById('ai-cv-panel');
      const kpis = document.querySelector('.kpi-grid');
      const toolbar = document.querySelector('.toolbar');
      const footer = document.getElementById('footer-text');

      if (banner) banner.style.display = isDedicatedPage ? 'none' : '';
      if (filters) filters.style.display = isDedicatedPage ? 'none' : '';
      if (urlPanel) urlPanel.style.display = isDedicatedPage ? 'none' : '';
      if (aiPanel) aiPanel.style.display = isDedicatedPage ? 'none' : '';
      if (kpis) kpis.style.display = isDedicatedPage ? 'none' : '';
      if (toolbar) toolbar.style.display = isDedicatedPage ? 'none' : '';
      if (footer) footer.style.display = '';

      if (isDedicatedPage) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (viewName === 'manual' && vManual) {
        initCardScrollReveal(vManual);
      } else if (viewName === 'platforms' && vPlatforms) {
        initCardScrollReveal(vPlatforms);
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
      const navPlatforms = document.getElementById('nav-platforms');

      if (navResults) navResults.classList.toggle('active-nav', viewName === 'results');
      if (navManual) navManual.classList.toggle('active-nav', viewName === 'manual');
      if (navPlatforms) navPlatforms.classList.toggle('active-nav', viewName === 'platforms');
    }

    if (typeof document.addEventListener === 'function') {
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          closePositionsDropdown();
          closeCategoriesMenu();
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
      if (!topBtn || !footer) return;
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

    let footerCategoriesAutoCloseTimer = null;

    function cancelFooterCategoriesAutoClose() {
      if (footerCategoriesAutoCloseTimer) {
        clearTimeout(footerCategoriesAutoCloseTimer);
        footerCategoriesAutoCloseTimer = null;
      }
    }
    window.cancelFooterCategoriesAutoClose = cancelFooterCategoriesAutoClose;

    function closeCategoriesMenu() {
      cancelFooterCategoriesAutoClose();
      const dd = document.getElementById('footer-categories-dropdown');
      const hdr = document.getElementById('nav-hdr-tracks-item');
      const items = typeof document.querySelectorAll === 'function'
        ? document.querySelectorAll('#footer-categories-menu li.nav-track-item')
        : [];
      if (dd && dd.classList && typeof dd.classList.remove === 'function') {
        dd.classList.remove('open');
      }
      if (hdr) {
        if (hdr.classList && typeof hdr.classList.remove === 'function') {
          hdr.classList.remove('expanded');
        }
        if (typeof hdr.setAttribute === 'function') {
          hdr.setAttribute('aria-expanded', 'false');
        }
      }
      items.forEach(item => {
        if (item && item.classList && typeof item.classList.add === 'function') {
          item.classList.add('nav-track-folded');
        }
      });
    }
    window.closeCategoriesMenu = closeCategoriesMenu;

    function scheduleFooterCategoriesAutoClose() {
      cancelFooterCategoriesAutoClose();
      const dd = document.getElementById('footer-categories-dropdown');
      if (!dd || (dd.classList && typeof dd.classList.contains === 'function' && !dd.classList.contains('open'))) return;
      footerCategoriesAutoCloseTimer = setTimeout(() => {
        closeCategoriesMenu();
        footerCategoriesAutoCloseTimer = null;
      }, 320);
    }
    window.scheduleFooterCategoriesAutoClose = scheduleFooterCategoriesAutoClose;

    function toggleCategoriesMenu(event) {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
      cancelFooterCategoriesAutoClose();
      const dd = document.getElementById('footer-categories-dropdown');
      const hdr = document.getElementById('nav-hdr-tracks-item');
      const items = typeof document.querySelectorAll === 'function'
        ? document.querySelectorAll('#footer-categories-menu li.nav-track-item')
        : [];
      const nowExpanded = dd && dd.classList ? dd.classList.toggle('open') : false;
      items.forEach(item => {
        if (item && item.classList && typeof item.classList.toggle === 'function') {
          item.classList.toggle('nav-track-folded', !nowExpanded);
        }
      });
      if (hdr) {
        if (hdr.classList && typeof hdr.classList.toggle === 'function') {
          hdr.classList.toggle('expanded', nowExpanded);
        }
        if (typeof hdr.setAttribute === 'function') {
          hdr.setAttribute('aria-expanded', nowExpanded ? 'true' : 'false');
        }
      }
    }
    window.toggleCategoriesMenu = toggleCategoriesMenu;

    function selectFooterTrack(trackCode) {
      switchMainView('results');
      filterByTrack(trackCode);
      closeCategoriesMenu();
      const resultsEl = document.getElementById('view-results');
      if (resultsEl && typeof resultsEl.scrollIntoView === 'function') {
        resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    window.selectFooterTrack = selectFooterTrack;

    function openFooterCategoriesFromManual(event) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      const dd = document.getElementById('footer-categories-dropdown');
      const hdr = document.getElementById('nav-hdr-tracks-item');
      if (dd && typeof dd.scrollIntoView === 'function') {
        dd.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (dd && dd.classList && !dd.classList.contains('open')) {
        toggleCategoriesMenu();
      } else if (hdr && typeof hdr.focus === 'function') {
        hdr.focus();
      }
    }
    window.openFooterCategoriesFromManual = openFooterCategoriesFromManual;

    (function initFooterCategoriesHoverAutoClose() {
      const dd = document.getElementById('footer-categories-dropdown');
      if (dd && typeof dd.addEventListener === 'function') {
        dd.addEventListener('mouseenter', () => {
          if (supportsFineHover()) cancelFooterCategoriesAutoClose();
        });
        dd.addEventListener('mouseleave', () => {
          if (supportsFineHover()) scheduleFooterCategoriesAutoClose();
        });
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

    async function triggerOnDemandScan() {
      const t = I18N[userFilters.ui_lang] || I18N.es;
      const btn = document.getElementById('btn-scan-now');
      const lbl = document.getElementById('lbl-scan-now');
      btn.disabled = true;
      lbl.textContent = t.scanningNow;

      try {
        const resp = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters: userFilters })
        });
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data.opportunities)) {
            opportunitiesState = data.opportunities;
          }
          if (Array.isArray(data.platforms)) {
            platformsState = data.platforms;
          }
          lastScanAtState = data.lastScanAt || new Date().toISOString();
          recomputeAndRender();
          renderPlatformsDirectory();
        }
      } catch (e) {
        // Fallback when opened as local file without Worker backend
        lastScanAtState = new Date().toISOString();
        recomputeAndRender();
      } finally {
        btn.disabled = false;
        lbl.textContent = (I18N[userFilters.ui_lang] || I18N.es).scanNow;
      }
    }

    function closeScanFeedback() {
      const feedbackBox = document.getElementById('scan-feedback-box');
      if (!feedbackBox) return;
      feedbackBox.className = 'scan-alert';
      feedbackBox.style.display = 'none';
      feedbackBox.innerHTML = '';
    }

    function renderScanFeedback(platformName, counts, isDeadLead) {
      const feedbackBox = document.getElementById('scan-feedback-box');
      if (!feedbackBox) return;
      const c = counts || { apply: 0, possible: 0, skip: 0, geo: 0 };
      const dead = Boolean(isDeadLead);
      feedbackBox.className = 'scan-alert ' + (dead ? 'error' : 'success');
      feedbackBox.style.display = 'flex';
      const badgesHtml = dead
        ? '<span class="badge badge-GEO">DEAD LEAD</span>'
        : '<span class="badge badge-APPLY">POSTULAR: ' + Number(c.apply || 0) + '</span>' +
          ' &middot; <span class="badge badge-POSSIBLE">EXPLORAR: ' + Number(c.possible || 0) + '</span>' +
          ' &middot; <span class="badge badge-SKIP">BAJA COINCIDENCIA: ' + Number(c.skip || 0) + '</span>' +
          ' &middot; <span class="badge badge-GEO">BLOQUEADAS PA&Iacute;S: ' + Number(c.geo || 0) + '</span>';
      feedbackBox.innerHTML =
        '<div class="scan-alert-content">' +
          '<strong>' + escapeHtml(platformName || 'URL') + '</strong>' +
          '<span>' + badgesHtml + '</span>' +
        '</div>' +
        '<button type="button" class="scan-alert-close" onclick="closeScanFeedback()" aria-label="Cerrar" title="Cerrar">&times;</button>';
    }

    async function submitCustomPlatformScan(customArgs) {
      const t = I18N[userFilters.ui_lang] || I18N.es;
      const urlInput = document.getElementById('scan-url-input');
      const nameInput = document.getElementById('scan-name-input');
      const typeSelect = document.getElementById('scan-type-select');
      const submitBtn = document.getElementById('btn-submit-url');
      const submitLbl = document.getElementById('lbl-btn-submit-url');

      const url = customArgs ? customArgs.url : urlInput.value.trim();
      const name = customArgs ? customArgs.name : nameInput.value.trim();
      const type = customArgs ? customArgs.type : typeSelect.value;
      const track = customArgs && customArgs.track ? customArgs.track : 'Track F: Curated Remote-First & WFA Job Boards';

      if (!url) return;

      submitBtn.disabled = true;
      submitLbl.textContent = t.scanningUrl;
      closeScanFeedback();

      try {
        const resp = await fetch('/api/platforms/scan-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, name, type, track, persist: true, filters: userFilters })
        });
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || 'HTTP ' + resp.status);
        }
        const data = await resp.json();
        const evalList = Array.isArray(data.evaluated_opportunities) ? data.evaluated_opportunities : [];
        const counts = data.verdict_counts || {
          apply: evalList.filter(r => r.bolivia_eligible && r.verdict === 'APPLY').length,
          possible: evalList.filter(r => r.bolivia_eligible && r.verdict === 'POSSIBLE').length,
          skip: evalList.filter(r => r.bolivia_eligible && r.verdict === 'SKIP').length,
          geo: evalList.filter(r => !r.bolivia_eligible).length
        };
        const isDeadLead = Boolean(
          data.dead_lead ||
          !data.discovered_count ||
          (data.http_status && data.http_status >= 400)
        );

        if (!isDeadLead) {
          if (Array.isArray(data.all_opportunities)) {
            opportunitiesState = data.all_opportunities;
          } else if (Array.isArray(data.opportunities)) {
            const existingHashes = new Set(opportunitiesState.map(o => o.job_hash));
            for (const o of data.opportunities) {
              if (!existingHashes.has(o.job_hash)) {
                opportunitiesState.unshift(o);
              }
            }
          }
          if (Array.isArray(data.platforms)) {
            platformsState = data.platforms;
          } else if (data.platform) {
            const exists = platformsState.some(p => p.id === data.platform.id);
            if (!exists) platformsState.unshift(data.platform);
          }
          lastScanAtState = new Date().toISOString();
          recomputeAndRender();
          renderPlatformsDirectory();
          if (!customArgs) {
            urlInput.value = '';
            nameInput.value = '';
          }
        }

        renderScanFeedback((data.platform && data.platform.name) || name || url, counts, isDeadLead);
      } catch (err) {
        let fallbackName = name;
        if (!fallbackName) {
          try {
            const cleanUrl = /^https?:\\/\\//i.test(url) ? url : 'https://' + url;
            const parsed = new URL(cleanUrl);
            fallbackName = parsed.hostname.replace(/^www\\./i, '');
          } catch (e) {
            fallbackName = url;
          }
        }
        renderScanFeedback(fallbackName, { apply: 0, possible: 0, skip: 0, geo: 0 }, true);
      } finally {
        submitBtn.disabled = false;
        submitLbl.textContent = (I18N[userFilters.ui_lang] || I18N.es).btnSubmitUrl;
      }
    }
    window.closeScanFeedback = closeScanFeedback;
    window.renderScanFeedback = renderScanFeedback;
    window.submitCustomPlatformScan = submitCustomPlatformScan;

    function scanExistingPlatform(url, name, type, track) {
      switchMainView('results');
      submitCustomPlatformScan({ url, name, type, track });
    }

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

      const renderList = items =>
        items.length > 0
          ? '<ul>' + items.map(item => '<li>' + escapeHtml(String(item)) + '</li>').join('') + '</ul>'
          : '<p>Información detallada disponible en la oferta original.</p>';

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
        ]
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
    updateBackToTopPosition();
    updateNavbarStickyState();

    // Auto-trigger background sync every 15 minutes while page is open
    setInterval(() => {
      triggerOnDemandScan();
    }, 15 * 60 * 1000);
  </script>
</body>
</html>`;
}
