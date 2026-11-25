import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import worker from './src/worker.js';
import { stripHtml, computeJobHash } from './src/scanner.js';
import { checkBoliviaRemoteEligibility, evaluateAllOpportunities } from './src/evaluator.js';
import { extractCompensationUsd } from './src/ai_enricher.js';
import { buildLocalSemanticVector, cosineSimilarity, deduplicateSemantically } from './src/vector_store.js';

const EMOJI_REGEX = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83d\ud83e][\ud000-\udfff]|[\u200d\u20e3\ufe0f]|[\u2600-\u26ff])/g;

async function runTests() {
  console.log('1. Testing GET / (Spanish Bolivia default UI, clean titles, platform categories, Dark Mode)...');
  const reqRoot = new Request('https://bolivia-remote-scout.workers.dev/');
  const respRoot = await worker.fetch(reqRoot, {}, {});
  assert.equal(respRoot.status, 200);
  const html = await respRoot.text();
  assert.ok(html.includes('lang="es-BO"'), 'Default language must be es-BO');
  assert.ok(html.includes('id="nav-brand-title">Bolivia Remote Work</span>'), 'Must include Bolivia Remote Work without (BO) in navbar brand');
  assert.ok(!html.includes('id="nav-brand-title">Bolivia Remote Work (BO)</span>'), 'Must NOT have (BO) in navbar brand');
  assert.ok(!html.includes('Bolivia Remoto'), 'Must NOT contain Bolivia Remoto anywhere in HTML');
  assert.ok(html.includes('Buscador y Evaluador de Empleos Remotos desde Bolivia'), 'Must include banner title without 100% and without (BO)');
  assert.ok(!html.includes('Buscador y Evaluador de Empleos 100% Remotos desde Bolivia (BO)'), 'Must remove 100% and (BO) from banner title');
  assert.ok(html.includes('id="nav-track-a">B2B Directo &amp; Freelance'), 'Must keep category name and remove Track A prefix in categories list');
  assert.ok(!html.includes('>Track A:'), 'Must NOT include Track A: in category links');
  assert.ok(html.includes('id="btn-theme-toggle"'), 'Must have discrete dark mode theme toggle button');
  assert.ok(html.includes('theme-symbol-moon'), 'Must have discrete moon symbol');
  assert.ok(html.includes('theme-symbol-sun'), 'Must have discrete sun symbol');
  assert.ok(!html.includes('id="theme-toggle-text"'), 'Must remove text label from theme toggle button');
  assert.ok(html.includes('body.dark-mode'), 'Must have dark mode stylesheet rules');
  assert.ok(html.includes('class="banner-header-block"'), 'Must have full-width banner-header-block so title and subtitle do not break');
  assert.ok(
    /<div class="banner-subtitle-line">\s*<h1 id="banner-title">Buscador y Evaluador de Empleos Remotos desde Bolivia<\/h1><span class="banner-inline-sep"[^>]*>·<\/span><span id="banner-subtitle">Filtra y evalúa ofertas globales y regionales que permiten trabajar remoto desde Bolivia\. Personaliza tus idiomas, área profesional, experiencia y modalidad de contrato\.<\/span>\s*<\/div>/.test(html) &&
    /\.top-banner h1,\s*#banner-title\s*\{[\s\S]*?display:\s*inline;[\s\S]*?font-size:\s*inherit;/.test(html),
    'Top banner title and subtitle must share .banner-subtitle-line styling inline on the same line'
  );
  assert.ok(!html.includes('id="btn-lang-en"') && !html.includes('id="btn-lang-es"'), 'Must remove site display language switcher buttons');
  assert.ok(!html.includes('id="man-btn-lang-en"') && !html.includes('id="man-btn-lang-es"'), 'Must remove language switcher buttons from User Manual');
  assert.ok(!html.includes("setUiLanguage('en')"), 'Must remove English site switcher');
  assert.ok(/<div class="navbar-header">[\s\S]*?class="navbar-header-actions"[\s\S]*?id="btn-theme-toggle"[\s\S]*?id="sidebar-unfold-btn"/.test(html), 'Light/dark mode switch button must sit right next to Información hamburger menu button');
  assert.ok(!html.includes('flex-wrap: nowrap !important'), 'Must not force nowrap so buttons and pills wrap responsively');
  assert.ok(html.includes('text-transform: capitalize'), 'Hamburger menu group headers must keep only the first letter of each word capitalized');
  assert.ok(!html.includes('text-transform: uppercase'), 'Hamburger menu group headers must be decapitalized from uppercase');
  assert.ok(html.includes('id="nav-hdr-tracks">Categorías De Plataformas</span>'), 'Must include Categorías De Plataformas with first letter of each word capitalized');
  assert.ok(!html.includes('id="banner-disclaimer"'), 'Must remove Notice from the main page banner');
  assert.ok(!html.includes('id="notice-overlay"'), 'Must remove Notice overlay from the main page');
  assert.ok(!html.includes('id="nav-hdr-notice-item"') && !html.includes('id="nav-notice-desc"'), 'Must remove Avisos section from the hamburger menu on all versions');
  const navListStart = html.indexOf('<ul id="navbar-menu-list">');
  const navListEnd = html.indexOf('</ul>', navListStart);
  const navListHtml = html.slice(navListStart, navListEnd);
  const idxManual = navListHtml.indexOf('id="nav-manual"');
  const idxLegalTax = navListHtml.indexOf('id="nav-legal-tax"');
  const idxPayments = navListHtml.indexOf('id="nav-hdr-payments-item"');
  const idxCreator = navListHtml.indexOf('id="nav-hdr-creator-item"');
  assert.ok(!navListHtml.includes('id="nav-results"'), 'Must remove Live Results item from Information hamburger menu');
  assert.ok(!navListHtml.includes('id="nav-hdr-tracks-item"'), 'Must move Categorías De Plataformas out of Información Útil menu');
  assert.ok(!navListHtml.includes('id="nav-platforms"'), 'Must move Plataformas Monitoreadas out of Información Útil menu');
  assert.ok(
    idxManual > -1 && idxLegalTax > idxManual && idxLegalTax < idxPayments && idxPayments < idxCreator,
    'Hamburger menu order must be: 1. Guía del Usuario, 2. Guía Legal y Fiscal (EE. UU. y Bolivia), 3. Información Financiera y de Pago, 4. Sobre el creador'
  );
  assert.ok(
    navListHtml.includes('id="nav-lbl-legal-tax">Guía Legal y Fiscal (EE. UU. y Bolivia)</span>') &&
    navListHtml.includes('href="/guia-legal-fiscal"'),
    'Hamburger menu must link to Guía Legal y Fiscal (EE. UU. y Bolivia) at /guia-legal-fiscal'
  );
  assert.ok(html.includes('<section id="view-legal-tax"'), 'Must include dedicated #view-legal-tax section');
  assert.ok(
    html.includes('26 U.S.C. &sect; 862(a)(3)') &&
    html.includes('Factura Comercial de Exportación sin Derecho a Crédito Fiscal') &&
    html.includes('Ley N° 1448') &&
    html.includes('Embajada de EE. UU. en La Paz') &&
    html.includes('Gestora Pública'),
    'Legal & Tax Guide must contain verified U.S. and Bolivia contractor tax, visa, and pension guidance'
  );
  assert.ok(!html.includes('Form 1040-NR-EZ') || html.includes('fue eliminado en 2020'), 'Must not recommend discontinued Form 1040-NR-EZ');
  assert.ok(/#navbar a#nav-manual\s*\{[\s\S]*?background:\s*#f1f5f9;/.test(html), 'Manual de Uso must share the same light-mode background color (#f1f5f9) as Aviso');
  assert.ok(/body\.dark-mode #navbar a#nav-manual\s*\{[\s\S]*?background:\s*#131d2e;/.test(html), 'Manual de Uso must share the same dark-mode background color (#131d2e) as Aviso');
  assert.ok(navListHtml.includes('id="nav-hdr-creator">Sobre el creador</span>') && navListHtml.includes('onclick="toggleCreatorMenu()"'), 'Hamburger menu must include collapsible Sobre el creador section');
  assert.ok(
    navListHtml.includes('id="nav-creator-desc"') &&
    navListHtml.includes('dedicada a la educación digital, las competencias en IA y el aprendizaje de idiomas.') &&
    !navListHtml.includes('espacios maker con IA e idiomas, y hardware abierto accesible') &&
    navListHtml.includes('https://minkalab.net') &&
    navListHtml.includes('mailto:contact@tsimon.me') &&
    navListHtml.includes('https://tsimon.me') &&
    navListHtml.includes('https://www.facebook.com/thomas.mathieu.simon') &&
    navListHtml.includes('https://www.linkedin.com/in/tsimonfreelance/') &&
    navListHtml.includes('https://github.com/t0m-a'),
    'Sobre el creador must describe Minka Lab with updated mission text and include minkalab.net, contact/site, Facebook, LinkedIn, and GitHub links'
  );
  assert.ok(/#sidebar-unfold-btn\s*\{[\s\S]*?border:\s*1px solid #10b981;[\s\S]*?background:\s*#ecfdf5;[\s\S]*?color:\s*#065f46;/.test(html), 'Información Utiles button must use the .bolivia-only-label green highlight design');
  assert.ok(!html.includes('Exporta tus Resultados y Sincroniza en Segundo Plano') && !html.includes('<!-- PASO 9 -->'), 'User Manual must remove section 9');
  const manualStartIdx = html.indexOf('<section id="view-manual"');
  const manualEndIdx = html.indexOf('</section>', manualStartIdx);
  const manualHtml = html.slice(manualStartIdx, manualEndIdx);
  assert.ok(
    manualHtml.includes('id="man-btn-back">Volver a la Página Principal</span>') &&
    !manualHtml.includes('Ver Resultados en Vivo'),
    'Manual de Uso back button must say Volver a la Página Principal'
  );
  const manualIntroStart = manualHtml.indexOf('<p id="man-p-intro"');
  const manualIntroEnd = manualHtml.indexOf('</p>', manualIntroStart);
  const manualIntroHtml = manualHtml.slice(manualIntroStart, manualIntroEnd);
  assert.ok(
    manualIntroHtml.includes('territoriales o visados extranjeros. Puedes verificar las fuentes por tipo en') &&
    !manualIntroHtml.includes('También puedes explorar') &&
    manualIntroHtml.includes('id="man-link-categories"') &&
    manualIntroHtml.includes('Categorías De Plataformas</a>') &&
    manualIntroHtml.includes('id="man-link-platforms"') &&
    manualIntroHtml.includes('Plataformas Monitoreadas</a>'),
    'Guía del Usuario intro paragraph must say Puedes verificar and include links to Categorías De Plataformas and Plataformas Monitoreadas right after territoriales o visados extranjeros.'
  );
  assert.ok(!manualHtml.includes('BLOQUEADAS PAÍS (GEO)'), 'Manual de Uso section 6 must remove BLOQUEADAS PAÍS (GEO)');
  assert.ok(
    manualHtml.includes('Aprovecha "Más información con IA" y "Buscar con IA"') &&
    manualHtml.includes('<strong>"Borrar búsqueda"</strong>') &&
    !manualHtml.includes('<strong>"Limpiar Vector"</strong>') &&
    !html.includes('Escanea tus Propias URLs de Plataformas o Empresas'),
    'User Manual section 8 must explain Más información con IA and Buscar con IA and reference Borrar búsqueda instead of Limpiar Vector'
  );
  assert.ok(!html.includes('body.view-manual-active footer'), 'Manual de Uso page must keep the same footer visible as the main page');
  assert.ok(
    html.includes('class="strict-pos-label"') &&
    /body\.dark-mode \.strict-pos-label\s*\{[\s\S]*?color:\s*#94a3b8;/.test(html),
    'Ocultar ofertas de otras áreas must use clear light muted color (#94a3b8) in dark mode'
  );
  assert.ok(
    manualHtml.includes('<p id="man-p-intro">') &&
    /body\.dark-mode #man-p-intro,\s*body\.dark-mode \.guide-step-body\s*\{[\s\S]*?color:\s*#cbd5e1;/.test(html),
    'Manual de Uso intro paragraph must share the same dark-mode text color (#cbd5e1) as .guide-step-body'
  );
  assert.ok(!html.includes('id="tab-view-platforms"'), 'Must move Monitored Platforms button out of toolbar into footer');
  assert.ok(!html.includes('id="tab-view-results"'), 'Must remove no-op Resultados button from toolbar');
  assert.ok(/<section class="toolbar">[\s\S]*?class="filter-group toolbar-scan-group"[\s\S]*?class="btn-tab btn-tab-scan" id="btn-scan-now"/.test(html), 'Toolbar must include Scan Offers Now button inside .toolbar-scan-group with green btn-tab styling');
  assert.ok(
    html.includes('grid-template-columns: repeat(2, minmax(0, 1fr))') &&
    html.includes('.toolbar-scan-group .btn-tab') &&
    html.includes('#verdictFilterBar .btn-tab'),
    'Mobile toolbar must use responsive full-width scan button, 2-column verdict button grid, and full-width search field'
  );
  assert.ok(html.includes('id="btn-v-all">Todas las Elegibles</button>'), 'Spanish toolbar filter must say Todas las Elegibles');
  assert.ok(!html.includes('Todos los Elegibles'), 'Must replace Todos los Elegibles with Todas las Elegibles');
  assert.ok(/\.btn-ai-info\s*\{[\s\S]*?background:\s*#ecfdf5;[\s\S]*?color:\s*#065f46 !important;[\s\S]*?border:\s*1px solid #10b981;/.test(html), 'Más información con IA button must use the same green design as Información Utiles');
  assert.ok(/body\.dark-mode \.btn-ai-info\s*\{[\s\S]*?background:\s*#064e3b;[\s\S]*?color:\s*#a7f3d0 !important;[\s\S]*?border-color:\s*#10b981;/.test(html), 'Más información con IA dark mode must match Información Utiles');
  assert.ok(/\.chip\.selected\s*\{[\s\S]*?background:\s*rgba\(2,\s*132,\s*199,\s*0\.12\);[\s\S]*?color:\s*#0369a1;[\s\S]*?border-color:\s*#0ea5e9;/.test(html), 'Selected language chips (Español/Inglés) must use light translucent blue tinted design');
  assert.ok(
    /@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.chip:hover\s*\{/.test(html) &&
    /@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?body\.dark-mode \.chip:hover\s*\{/.test(html),
    'Language chip :hover styles must be scoped to fine-pointer hover devices so touchscreens immediately revert deselected chips to grey'
  );
  assert.ok(/\.btn-tab:hover,\s*\.btn-tab\.active\s*\{[\s\S]*?background:\s*rgba\(2,\s*132,\s*199,\s*0\.12\);[\s\S]*?color:\s*#0369a1;[\s\S]*?border-color:\s*#0ea5e9;/.test(html), 'Toolbar tabs (Resultados, Todas las Elegibles, etc.) must use light translucent blue tinted design');
  assert.ok(/\.btn-tab\.btn-tab-scan\s*\{[\s\S]*?background:\s*rgba\(16,\s*185,\s*129,\s*0\.11\);[\s\S]*?color:\s*#065f46;[\s\S]*?border-color:\s*#10b981;/.test(html), 'Escanear Ofertas Ahora must use light translucent green tinted design');
  assert.ok(/\.btn-primary\s*\{[\s\S]*?background:\s*rgba\(2,\s*132,\s*199,\s*0\.12\);[\s\S]*?color:\s*#0369a1 !important;[\s\S]*?border:\s*1px solid #0ea5e9;/.test(html), 'Primary action buttons (Buscar con IA, Ver Oferta y Postular, etc.) must use light translucent blue tinted design');
  assert.ok(/body\.dark-mode \.btn-primary\s*\{[\s\S]*?background:\s*rgba\(14,\s*165,\s*233,\s*0\.18\);[\s\S]*?color:\s*#7dd3fc !important;[\s\S]*?border-color:\s*#0ea5e9;/.test(html), 'Dark mode primary action buttons must use matching translucent blue tinted design');
  assert.ok(html.includes('function foldAllNavbarSubsections()') && html.includes('foldAllNavbarSubsections();'), 'Closing Información Utiles menu must refold all subsections');
  assert.ok(!html.includes('Asistente IA de Perfil y Generador de Cartas de Postulación'), 'Must remove AI Profile Matcher & Cover Letter Generator feature');
  assert.ok(!html.includes('panel-collapsible-header'), 'Must mask/remove panel-collapsible-header from #ai-cv-panel');
  assert.ok(!html.includes('id="ai-cv-input"'), 'Must remove CV input form from #ai-cv-panel');
  assert.ok(!html.includes('Carta de Postulación Personalizada'), 'Must replace Carta de Postulación Personalizada');
  assert.ok(!html.includes('Recomendaciones para la posición'), 'Must replace Recomendaciones para la posición');
  assert.ok(!html.includes('id="lbl-ai-proposal-hdr"'), 'Must remove #lbl-ai-proposal-hdr heading wrapper');
  assert.ok(!html.includes('ai-cv-proposal-pre') && !html.includes('ai-proposal-pre'), 'Must remove unused #ai-cv-proposal-pre and .ai-proposal-pre');
  assert.ok(html.includes('id="ai-position-details" class="ai-position-details"'), 'Must include #ai-position-details container inside #ai-cv-result-box');
  assert.ok(html.includes('/api/ai/analyze-position') && !html.includes('/api/ai/match-cv'), 'Must use /api/ai/analyze-position instead of /api/ai/match-cv');
  assert.ok(
    html.includes('Requisitos de la posición') &&
    html.includes('Experiencia y habilidades útiles') &&
    html.includes('Compatibilidad horaria con Bolivia (UTC-4)') &&
    html.includes('Consejos para el candidato'),
    'Must render all 4 structured AI position detail sections'
  );
  assert.ok(!html.includes('id="ai-engine-badge"'), 'Must remove #ai-engine-badge from #ai-cv-result-box');
  assert.ok(html.includes('id="lbl-ai-analysis-hdr">Información sobre la Posición</strong>'), 'Must rename #lbl-ai-analysis-hdr to Información sobre la Posición');
  assert.ok(!html.includes('Diagnóstico de Compatibilidad Remota (Bolivia UTC-4)'), 'Must replace Diagnóstico de Compatibilidad Remota (Bolivia UTC-4)');
  assert.ok(html.includes("cardEl.insertAdjacentElement('afterend', panel)"), '#ai-cv-panel must open directly below the clicked .opp-card article');
  assert.ok(html.includes('handleAiPanelScrollAutoClose') && html.includes("addEventListener('scroll', handleAiPanelScrollAutoClose"), '#ai-cv-result-box must auto-close when scrolled out of viewport');
  assert.ok(!html.includes('Copiar Carta') && !html.includes('copyAiProposal'), 'Must remove Copiar Carta button');
  assert.ok(html.includes('#ai-cv-panel.ai-cv-folded {\r\n      display: none;') || html.includes('#ai-cv-panel.ai-cv-folded {\n      display: none;'), 'Must mask #ai-cv-panel.ai-cv-folded from displaying by default');
  assert.ok(html.includes("draftAiBtn: 'Más información con IA'"), 'Per-card AI button must be named Más información con IA');
  assert.ok(!html.includes("draftAiBtn: 'Redactar Carta IA'"), 'Must replace Redactar Carta IA on job cards');
  assert.ok(!html.includes('id="tab-view-manual"'), 'Must remove User Manual button from toolbar');
  assert.ok(!html.includes('data-verdict="GEO"'), 'Must remove Geo-Blocked button from verdictFilterBar');
  assert.ok(!html.includes('class="kpi-card geo"'), 'Must remove kpi-card geo from kpi-grid');
  assert.ok(!html.includes('id="kpi-total-cnt"') && !html.includes('id="kpi-report-title"'), 'Must remove Reporte de Resultados card from kpi-grid');
  assert.ok(html.includes('grid-template-columns: repeat(3, minmax(0, 1fr))'), 'kpi-grid must balance 3 cards across full width on desktop');
  assert.ok(html.includes('id="btn-back-to-top"'), 'Must include bottom-right translucent Top button');
  assert.ok(html.indexOf('id="btn-back-to-top"') > html.indexOf('</main>'), 'Top button must be outside </main> so it stays visible on both main page and User Manual');
  assert.ok(html.includes("btnTop: 'Arriba'"), 'Spanish Top button label must be Arriba');
  assert.ok(html.includes('scheduleNavbarAutoClose') && html.includes("addEventListener('mouseleave'") && html.includes('supportsFineHover()'), 'Hamburger menu must auto-close smoothly after fine pointer stops hovering without breaking touch taps');
  assert.ok(html.includes('scheduleFilterDropdownAutoClose') && html.includes('initFilterDropdownHoverAutoClose') && html.includes('handleFilterDropdownScrollAutoClose'), 'All filter dropdown menus must support hover auto-close and auto-close when scrolled out of view');
  assert.ok(html.includes('touch-action: manipulation;') && html.includes('function scheduleRecomputeAndRender()') && html.includes('data-opt-id="'), 'Filter controls must use touch-action: manipulation, in-place option syncing, and deferred recomputation for instant mobile reactivity');
  assert.ok(
    /#navbar\s*\{[\s\S]*?z-index:\s*1100;/.test(html) &&
    /@media only screen and \(max-width: 820px\)[\s\S]*?#navbar ul\s*\{[\s\S]*?position:\s*absolute;/.test(html) &&
    html.includes('onclick="toggleSidebar(event)"'),
    'Mobile hamburger menu must float cleanly above top filter panels at all scroll positions'
  );
  assert.ok(
    html.includes("rootMargin: '60px 0px 60px 0px'") &&
    html.includes('isFastScrolling') &&
    /\.opp-card\.card-reveal-pending[\s\S]*?opacity:\s*0\.28;/.test(html),
    'Scroll-reveal must pre-trigger smoothly with non-zero pending opacity and fast-scroll handling so offers never jump'
  );
  assert.ok(html.includes('class="toolbar-search-group"'), 'Search with AI input group must use responsive .toolbar-search-group');
  assert.ok(
    html.includes('class="search-input-wrap" id="search-input-wrap"') &&
    html.includes('class="btn-action btn-primary btn-clear-search-inline" id="btn-clear-search-input"') &&
    html.includes('id="lbl-btn-clear-search">Borrar búsqueda</span>'),
    'Search field must include inline Borrar búsqueda button inside .search-input-wrap with same btn-primary design as Buscar con IA'
  );
  assert.ok(html.includes('Management (8+ años)'), 'Experience option must be Management (8+ años)');
  assert.ok(!html.includes('Lead / Manager (8+ yrs)'), 'Must replace Lead / Manager (8+ yrs) with Management (8+ yrs)');
  assert.ok(html.includes('id="pos-dropdown"'), 'Position Type / Professional Area must use a multi-select dropdown');
  assert.ok(html.includes('id="pos-dropdown-toggle"'), 'Position dropdown must have toggle trigger button');
  assert.ok(html.includes('id="pos-dropdown-menu"') && html.includes('aria-multiselectable="true"'), 'Position dropdown menu must allow selecting one or more options');
  assert.ok(!html.includes('id="input-custom-keywords"'), 'Must remove #input-custom-keywords field');
  assert.ok(!html.includes('id="lbl-bolivia-only"') && !html.includes('id="chk-bolivia-only"'), 'Must remove Bolivia-only toggle button now that scouting/evaluation enforces 100% Bolivia eligibility');
  assert.ok(html.includes('"languages":["es"]'), 'Default language selected in 1. Tus Idiomas must be Spanish (es) only');
  assert.ok(html.includes('Ciberseguridad, Seguridad Informática & Auditoría TI'), 'Must include enriched Cybersecurity position category');
  assert.ok(html.includes('Gestión de Producto (Product Management & Product Owner)'), 'Must include enriched Product Management position category');
  assert.ok(html.includes('Ingeniería de IA, Machine Learning & Agentes LLM'), 'Must include enriched AI/ML Engineering position category');
  assert.ok(html.includes('Salud, Telemedicina & Facturación Médica'), 'Must include enriched Healthcare position category');
  assert.ok(html.includes('E-Commerce, Tiendas Online (Shopify / Amazon) & Logística'), 'Must include enriched E-Commerce position category');
  assert.ok(html.includes('Legal, Cumplimiento (Compliance) & Contratos'), 'Must include enriched Legal/Compliance position category');
  assert.ok(!html.includes('trabajar remoto desde Bolivia (UTC-4).'), 'Must remove (UTC-4) from Spanish banner subtitle');
  assert.ok(!/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/.test(html), 'Must NOT contain any flag emoji anywhere in HTML');
  assert.ok(!EMOJI_REGEX.test(html), 'Must NOT contain any emoji icons anywhere in HTML (excluding favicon)');
  assert.ok(!html.includes('id="tab-view-report"'), 'Must NOT have id="tab-view-report" in toolbar');
  assert.ok(html.includes('id="nav-platforms"'), 'Must have id="nav-platforms" in footer status pills');
  assert.ok(!html.includes('id="nav-hdr-views"'), 'Must NOT have Vistas Principales header in navbar');
  assert.ok(navListHtml.includes('id="nav-lbl-manual">Guía del Usuario: Bolivia Remote Work</span>'), 'Hamburger menu must label guide link as Guía del Usuario: Bolivia Remote Work');
  assert.ok(html.includes('id="nav-manual"'), 'Must have #nav-manual link in navbar');
  assert.ok(!html.includes('id="nav-report"'), 'Must NOT have id="nav-report" in navbar (removed as requested)');
  assert.ok(html.includes('id="sidebar-unfold-btn"'), 'Must have sidebar unfold button');
  assert.ok(
    /@keyframes boliviaHamburgerCycleLight\s*\{[\s\S]*?#ef4444[\s\S]*?#eab308[\s\S]*?#10b981/.test(html) &&
    /@keyframes boliviaHamburgerCycleDark\s*\{[\s\S]*?#ef4444[\s\S]*?#facc15[\s\S]*?#10b981/.test(html) &&
    /#sidebar-unfold-btn\s*\{[\s\S]*?animation:\s*boliviaHamburgerCycleLight 5\.4s ease-in-out infinite;/.test(html) &&
    /body\.dark-mode #sidebar-unfold-btn\s*\{[\s\S]*?animation:\s*boliviaHamburgerCycleDark 5\.4s ease-in-out infinite;/.test(html),
    'Información Útil hamburger button must cycle red -> vivid yellow -> green in harmonized button tones on both desktop and mobile (light and dark modes)'
  );
  assert.ok(html.includes('<body class="sidebar-collapsed">'), 'Navbar must start folded in hamburger menu by default');
  assert.ok(/<div class="navbar-header">[\s\S]*?id="nav-brand-title">Bolivia Remote Work<\/span>[\s\S]*?id="sidebar-unfold-btn"[\s\S]*?<span class="hamburger-label" id="lbl-unfold-nav">Información Útil<\/span>[\s\S]*?<span class="hamburger-icon">/.test(html), 'Hamburger button must be inside navbar-header on the right with Información Útil on the left of hamburger icon');
  assert.ok(!html.includes('Información Utiles'), 'Must replace Información Utiles with Información Útil');
  assert.ok(html.includes('id="exp-dropdown"') && html.includes('id="exp-dropdown-menu"'), 'Experience Level must use a multi-select dropdown');
  assert.ok(html.includes('id="contract-dropdown"') && html.includes('id="contract-dropdown-menu"'), 'Target Contract Types must use a multi-select dropdown');
  assert.ok(html.includes('onclick="toggleCategoriesMenu(event)"'), 'Categories button inside footer must be collapsible');
  assert.ok(html.includes('class="nav-track-item nav-track-folded"'), 'Categories inside footer menu must start folded');
  assert.ok(navListHtml.includes('id="nav-hdr-payments">Información Financiera y de Pago</span>'), 'Must include Información Financiera y de Pago section header in hamburger menu');
  assert.ok(
    html.includes('class="panel-header-actions filters-reset-actions"') &&
    /\.filters-reset-actions\s*\{[\s\S]*?order:\s*4;/.test(html) &&
    /@media only screen and \(max-width: 640px\)[\s\S]*?#custom-filters-panel \.panel-title\s*\{[\s\S]*?font-size:\s*0\.88em;/.test(html) &&
    /@media only screen and \(max-width: 820px\)[\s\S]*?\.filter-block-langs\s*\{[\s\S]*?flex:\s*1 1 100%;[\s\S]*?width:\s*100%;/.test(html),
    'Mobile layout must move Restablecer Filtros after section 4, match filter title size (0.88em) to banner title, and expand 1. Tus Idiomas to full width'
  );
  assert.ok(
    html.includes('handleOutsideInteraction') &&
    html.includes("addEventListener('pointerdown', handleOutsideInteraction") &&
    html.includes("addEventListener('touchstart', handleOutsideInteraction"),
    'Mobile hamburger menu must auto-close on outside tap/scroll and refold subsections via closeNavbarMenu()'
  );
  assert.ok(html.includes('href="https://www.airtm.com/"'), 'Must include AirTM link');
  assert.ok(html.includes('href="https://www.payoneer.com/"'), 'Must include Payoneer link');
  assert.ok(html.includes('href="https://wise.com/"'), 'Must include Wise link');
  assert.ok(html.includes('href="https://tipalti.com/"'), 'Must include Tipalti link');
  assert.ok(html.includes('href="https://dolarboliviahoy.com/"'), 'Must include dolarboliviahoy.com link');
  assert.ok(html.includes('Las empresas suelen liquidar mediante plataformas de nómina global como <strong>AirTM. Wise, Payoneer o Tipalti</strong>. Desde estas cuentas puedes transferir vía SWIFT O transferancia ACH hacia tu cuenta bancaria boliviana en Boliviano o en USD, usar tarjetas de débito internacionales, o liquidar honorarios a través de pasarelas reguladas entre tus cuentas globales y locales.'), 'Must include exact payment description paragraph');
  assert.ok(html.includes('@media only screen and (max-width: 820px)'), 'Must include tablet responsive media query');
  assert.ok(html.includes('@media only screen and (max-width: 640px)'), 'Must include mobile responsive media query');
  assert.ok(html.includes('overflow-wrap: break-word'), 'Must enforce proper text wrapping');
  assert.ok(html.includes('Designed, engineered and hosted by <a href="mailto:contact@tsimon.me">Thomas Simon</a>'), 'Must include footer attribution with mailto link');
  assert.ok(!html.includes('Thomas M. Simon'), 'Must remove middle initial M. from Thomas Simon in footer');
  assert.ok(html.includes("semanticBtn: 'Buscar con IA'"), 'Spanish AI search button must be named Buscar con IA');
  assert.ok(!html.includes("semanticBtn: 'AI Vector Search'"), 'Must replace AI Vector Search button label');
  assert.ok(html.includes('https://tsimon.me'), 'Must include footer attribution link to tsimon.me');
  assert.ok(html.includes('title="Thomas Mathieu Simon  · Cloud Systems Architect · NOC &amp; AI Engineer"'), 'Must include title attribute on tsimon.me link');
  assert.ok(html.includes('body.sidebar-collapsed #main-doc'), 'Must expand main-doc when collapsed');
  assert.ok(html.includes('body.sidebar-collapsed .top-banner'), 'Must expand sections to full width when collapsed');
  assert.ok(html.includes('body.view-manual-active .top-banner'), 'Must have CSS hiding preliminary sections when manual view is active');
  assert.ok(html.includes('id="man-btn-back"'), 'Must include back to results button in manual view');
  assert.ok(html.includes('Agregar y Escanear tu Propia URL de Plataforma'), 'Must include Custom Platform URL scanner');
  assert.ok(html.includes('id="ai-cv-panel"'), 'Must retain #ai-cv-panel container for Diagnóstico de Compatibilidad Remota');
  assert.ok(html.includes('class="panel-card ai-cv-folded" id="ai-cv-panel"'), '#ai-cv-panel must start masked via ai-cv-folded by default');
  assert.ok(!html.includes('(Cloudflare Workers AI)'), 'Must not contain (Cloudflare Workers AI)');
  const resultsIdx = html.indexOf('id="resultsCardsContainer"');
  const customUrlIdx = html.indexOf('id="custom-url-panel"');
  const footerIdx = html.indexOf('<footer id="footer-text">');
  const footerEndIdx = html.indexOf('</footer>', footerIdx);
  assert.ok(resultsIdx > -1 && customUrlIdx > resultsIdx && footerIdx > customUrlIdx, '#custom-url-panel must be placed at the bottom of the page after results and before footer');
  const footerHtml = html.slice(footerIdx, footerEndIdx);
  assert.ok(!html.includes('id="pill-bolivia"') && !html.includes('Filtro Base: 100% Remoto desde Bolivia (UTC-4)'), 'Filtro Base pill must be removed from footer on all pages');
  assert.ok(footerHtml.includes('id="pill-schedule"'), 'Schedule pill must be inside footer');
  assert.ok(footerHtml.includes('id="lbl-last-sync"') && footerHtml.includes('id="val-last-sync"'), 'Last synced pill must be inside footer');
  assert.ok(footerHtml.includes('id="lbl-monitored-count"') && footerHtml.includes('id="val-platforms-count"'), 'Active platforms pill must be inside footer');
  assert.ok(
    /\.btn-back-to-top\s*\{[\s\S]*?border:\s*1px solid #0ea5e9;[\s\S]*?background:\s*rgba\(2,\s*132,\s*199,\s*0\.12\);[\s\S]*?color:\s*#0369a1;/.test(html) &&
    /body\.dark-mode \.btn-back-to-top\s*\{[\s\S]*?background:\s*rgba\(14,\s*165,\s*233,\s*0\.18\);[\s\S]*?color:\s*#7dd3fc;[\s\S]*?border-color:\s*#0ea5e9;/.test(html),
    'Arriba button must use the same light translucent blue design as Buscar con IA in light and dark modes'
  );
  assert.ok(
    html.includes('class="filter-block filter-block-langs"') &&
    html.includes('class="filter-block filter-block-grow"') &&
    /\.filter-block-langs\s*\{[\s\S]*?flex:\s*0 1 auto;[\s\S]*?width:\s*fit-content;/.test(html),
    '1. Tus Idiomas must size to its actual content width while other panel-card filter blocks flex-wrap responsively'
  );
  const footerPillsStart = footerHtml.indexOf('<div class="footer-status-pills">');
  const footerPillsHtml = footerHtml.slice(footerPillsStart);
  assert.ok(
    footerPillsHtml.includes('class="banner-pill footer-pill-btn" id="nav-hdr-tracks-item"') &&
    footerPillsHtml.includes('id="nav-hdr-tracks">Categorías De Plataformas</span>') &&
    footerPillsHtml.includes('id="footer-categories-menu"'),
    'Categorías De Plataformas must be in footer-status-pills with banner-pill design and collapsible menu'
  );
  assert.ok(
    footerPillsHtml.includes('class="banner-pill footer-pill-btn" id="nav-platforms"') &&
    footerPillsHtml.includes('id="nav-lbl-platforms">Plataformas Monitoreadas</span>'),
    'Plataformas Monitoreadas must be in footer-status-pills with banner-pill design at the same level as Plataformas activas'
  );
  assert.ok(
    footerPillsHtml.includes('<span id="footer-credit" class="banner-pill footer-credit">Designed, engineered and hosted by <a href="mailto:contact@tsimon.me">Thomas Simon</a>'),
    'Footer attribution must sit inside .footer-status-pills using the same .banner-pill design on the same line'
  );
  assert.ok(
    /\.header-title\s*\{[\s\S]*?font-size:\s*1\.38em;[\s\S]*?font-weight:\s*500;[\s\S]*?letter-spacing:\s*0\.04em;/.test(html) &&
    /#nav-brand-title\s*\{[\s\S]*?background-clip:\s*text;/.test(html),
    'Bolivia Remote Work header title must stand out with refined lighter weight (500), larger size inside header height, and gradient styling'
  );
  assert.ok(
    html.includes('.opp-card.card-reveal-pending') &&
    html.includes('.opp-card.card-reveal-pending-up') &&
    html.includes('.opp-card.card-reveal-visible') &&
    html.includes('function initCardScrollReveal('),
    'Must include bidirectional IntersectionObserver scroll-reveal transition animation for scrolling down and back up'
  );
  assert.ok(
    html.includes('overflow-x: clip;') &&
    /#navbar\.navbar-scrolled\s*\{[\s\S]*?backdrop-filter:\s*blur\(12px\)/.test(html) &&
    /body\.dark-mode #navbar\.navbar-scrolled\s*\{[\s\S]*?backdrop-filter:\s*blur\(12px\)/.test(html) &&
    html.includes('function updateNavbarStickyState()'),
    'Navbar must stick on scroll (overflow-x: clip) with frosted translucent blur backdrop in light and dark modes'
  );
  assert.ok(!html.slice(0, footerIdx).includes('id="pill-bolivia"'), 'Status pills must be removed from top banner');
  assert.ok(!html.includes('Public Remote Job Scout & Evaluator from Bolivia (UTC-4)'), 'Must remove old English footer intro text');
  assert.ok(!html.includes('Buscador y Evaluador Público de Empleos Remotos desde Bolivia (UTC-4)'), 'Must remove old Spanish footer intro text');
  assert.ok(html.includes('openAiProposalForJob'), 'Must include per-card AI Cover Letter trigger');
  assert.ok(html.includes('rel="icon" type="image/svg+xml"'), 'Must have SVG favicon in head');
  assert.ok(html.includes('data:image/svg+xml'), 'Must have embedded data URI for offline support');
  assert.ok(!html.includes('Francés'), 'Must not contain French in UI filters');
  assert.ok(!html.includes('French'), 'Must not contain French in UI');
  const htmlNoFooter = html
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/footerText:[\s\S]*?<\/a>'/gi, '')
    .replace(/<div id="nav-creator-desc">[\s\S]*?<\/div>/gi, '')
    .toLowerCase();
  assert.ok(!htmlNoFooter.includes('thomas simon'), 'Must not contain personal name outside footer attribution and Sobre el creador');
  assert.ok(!htmlNoFooter.includes('tsimon.me'), 'Must not contain personal domain outside footer attribution and Sobre el creador');
  assert.ok(!html.toLowerCase().includes('burnout'), 'Must not contain burnout safety references');
  assert.ok(!html.toLowerCase().includes('proposals ready'), 'Must not contain pre-populated proposals');

  // Compile and execute all inline <script> blocks in node:vm to catch any syntax/escaping errors
  const allScripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(allScripts.length, 3, 'Must contain 3 script blocks (theme init, JSON payload, main client logic)');
  const domElements = {};
  const getMockEl = (id) => {
    if (!domElements[id]) {
      const classes = new Set();
      const attrs = {};
      domElements[id] = {
        id,
        textContent: id === 'initial-payload' ? allScripts[1][1] : '',
        innerHTML: '',
        value: '',
        checked: false,
        disabled: false,
        style: {},
        attributes: attrs,
        classList: {
          add(...cls) { cls.forEach(c => classes.add(c)); },
          remove(...cls) { cls.forEach(c => classes.delete(c)); },
          contains(c) { return classes.has(c); },
          toggle(c, force) {
            if (typeof force === 'boolean') {
              if (force) classes.add(c); else classes.delete(c);
              return force;
            }
            if (classes.has(c)) { classes.delete(c); return false; }
            classes.add(c); return true;
          }
        },
        setAttribute(k, v) { attrs[k] = String(v); },
        getAttribute(k) { return attrs[k] || ''; },
        querySelector() { return getMockEl('sub-' + id); },
        scrollIntoView() {}
      };
    }
    return domElements[id];
  };
  const vmSandbox = {
    window: { matchMedia: () => ({ matches: false }), scrollTo() {} },
    document: {
      title: '',
      documentElement: { lang: 'es-BO', classList: { add() {}, remove() {}, toggle() {} } },
      body: { classList: { add() {}, remove() {}, toggle() { return false; } } },
      getElementById: (id) => getMockEl(id),
      querySelector: (sel) => getMockEl(sel),
      querySelectorAll: () => []
    },
    localStorage: { getItem: () => null, setItem: () => {} },
    navigator: { clipboard: { writeText: async () => {} } },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    setInterval: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
    URL,
    Blob: class {},
    console
  };
  vm.createContext(vmSandbox);
  new vm.Script(allScripts[0][1], { filename: 'theme-init.js' }).runInContext(vmSandbox);
  new vm.Script(allScripts[2][1], { filename: 'client-main.js' }).runInContext(vmSandbox);
  assert.ok(domElements['chips-languages'].innerHTML.includes('toggleLanguageChip'), 'Must render interactive language chips on load');
  assert.ok(domElements['chips-languages'].innerHTML.includes("toggleLanguageChip('es')") && domElements['chips-languages'].innerHTML.includes("toggleLanguageChip('en')"), 'Languages filter must render Español and Inglés chips');
  assert.ok(!domElements['chips-languages'].innerHTML.includes("toggleLanguageChip('pt')") && !domElements['chips-languages'].innerHTML.includes('Portugués'), 'Must remove Portugués from languages filter');
  assert.equal(typeof vmSandbox.window.toggleLanguageChip, 'function', 'toggleLanguageChip must be bound on window');

  // Verify live language chip toggling refreshes KPI counts and rendered cards across ES-only, Both, and EN-only
  const countCards = () => (domElements['resultsCardsContainer'].innerHTML.match(/class="opp-card /g) || []).length;
  const esOnlyCards = countCards();
  const esOnlyApply = Number(domElements['kpi-apply-cnt'].textContent);
  assert.ok(esOnlyCards > 0, 'Initial Spanish-only mode must render Spanish-compatible job cards');

  // Toggle English ON -> Both ['es', 'en']
  vmSandbox.window.toggleLanguageChip('en');
  const bothCards = countCards();
  const bothApply = Number(domElements['kpi-apply-cnt'].textContent);
  assert.ok(bothCards > esOnlyCards, `Selecting both ES+EN must expand results (${bothCards} > ${esOnlyCards})`);
  assert.ok(bothApply >= esOnlyApply, `Selecting both ES+EN must not drop APPLY count (${bothApply} >= ${esOnlyApply})`);

  // Toggle Spanish OFF -> English-only ['en']
  vmSandbox.window.toggleLanguageChip('es');
  const enOnlyCards = countCards();
  const enOnlyApply = Number(domElements['kpi-apply-cnt'].textContent);
  assert.ok(enOnlyCards > esOnlyCards && enOnlyCards < bothCards, `Selecting EN-only must exclude Spanish-only offers (${esOnlyCards} < ${enOnlyCards} < ${bothCards})`);
  assert.ok(enOnlyApply > 0 && enOnlyApply <= bothApply, `EN-only APPLY count (${enOnlyApply}) must be positive and <= Both (${bothApply})`);

  // Attempt to deselect last active language ('en') -> must keep 'en' selected
  vmSandbox.window.toggleLanguageChip('en');
  assert.equal(countCards(), enOnlyCards, 'Cannot deselect the last remaining active language');

  // Switch back to Spanish-only ['es']
  vmSandbox.window.toggleLanguageChip('es');
  vmSandbox.window.toggleLanguageChip('en');
  assert.equal(countCards(), esOnlyCards, 'Switching back to Spanish-only must restore exact Spanish-only card count');
  assert.equal(Number(domElements['kpi-apply-cnt'].textContent), esOnlyApply, 'Switching back to Spanish-only must restore exact APPLY count');
  assert.ok(domElements['chips-experience'].innerHTML.includes('toggleExperienceChip'), 'Must render interactive experience options on load');
  assert.ok(domElements['chips-experience'].innerHTML.includes('type="checkbox"'), 'Experience dropdown options must be multi-select checkboxes');
  assert.ok(domElements['chips-contracts'].innerHTML.includes('toggleContractChip'), 'Must render interactive contract options on load');
  assert.ok(domElements['chips-contracts'].innerHTML.includes('type="checkbox"'), 'Contract dropdown options must be multi-select checkboxes');
  assert.equal(typeof vmSandbox.window.toggleFilterDropdown, 'function', 'toggleFilterDropdown must be bound');
  assert.equal(typeof vmSandbox.window.closeAllFilterDropdowns, 'function', 'closeAllFilterDropdowns must be bound');
  assert.equal(typeof vmSandbox.window.scheduleFilterDropdownAutoClose, 'function', 'scheduleFilterDropdownAutoClose must be bound');
  assert.equal(typeof vmSandbox.window.cancelFilterDropdownAutoClose, 'function', 'cancelFilterDropdownAutoClose must be bound');
  assert.ok(domElements['chips-positions'].innerHTML.includes('togglePositionChip'), 'Must render interactive position options on load');
  assert.ok(domElements['chips-positions'].innerHTML.includes('type="checkbox"'), 'Position dropdown options must be multi-select checkboxes');
  assert.equal(typeof vmSandbox.window.togglePositionsDropdown, 'function', 'togglePositionsDropdown must be bound');
  assert.equal(typeof vmSandbox.window.closePositionsDropdown, 'function', 'closePositionsDropdown must be bound');
  assert.ok(domElements['resultsCardsContainer'].innerHTML.includes('opp-card'), 'Must render job cards on load');
  assert.ok(domElements['resultsCardsContainer'].innerHTML.includes('class="btn-action btn-ai-info"'), 'Job card AI button must use btn-ai-info styling matching Información Utiles');
  assert.ok(domElements['resultsCardsContainer'].innerHTML.includes('Más información con IA'), 'Job card AI button must say Más información con IA');
  assert.ok(!domElements['resultsCardsContainer'].innerHTML.includes('Redactar Carta IA'), 'Job card AI button must not say Redactar Carta IA');
  assert.equal(typeof vmSandbox.window.switchMainView, 'function', 'switchMainView must be bound on window');
  vmSandbox.window.switchMainView('legal-tax');
  assert.equal(domElements['view-legal-tax'].style.display, '', 'switchMainView("legal-tax") must display #view-legal-tax');
  assert.equal(domElements['view-results'].style.display, 'none', 'switchMainView("legal-tax") must hide #view-results');
  assert.equal(domElements['nav-legal-tax'].classList.contains('active-nav'), true, 'switchMainView("legal-tax") must highlight #nav-legal-tax');
  vmSandbox.window.switchMainView('results');
  assert.equal(domElements['view-legal-tax'].style.display, 'none', 'switchMainView("results") must hide #view-legal-tax');
  assert.equal(domElements['view-results'].style.display, '', 'switchMainView("results") must restore #view-results');

  console.log('1b. Testing GET /guia-legal-fiscal dedicated Spanish Legal & Tax Guide route...');
  const respLegal = await worker.fetch(new Request('https://boliviaremote.work/guia-legal-fiscal'), {}, {});
  assert.equal(respLegal.status, 200);
  const legalHtml = await respLegal.text();
  assert.ok(legalHtml.includes('<title>Guía Legal y Fiscal (EE. UU. y Bolivia) — Bolivia Remote Work</title>'), 'GET /guia-legal-fiscal must set dedicated Spanish page title');
  assert.ok(legalHtml.includes('<body class="sidebar-collapsed view-manual-active">'), 'GET /guia-legal-fiscal must render dedicated page body class');
  assert.ok(legalHtml.includes('<section id="view-legal-tax">'), 'GET /guia-legal-fiscal must render #view-legal-tax visible server-side');
  assert.ok(legalHtml.includes('<section id="view-results" style="display:none;">'), 'GET /guia-legal-fiscal must hide #view-results server-side');

  assert.equal(typeof vmSandbox.window.toggleSidebar, 'function', 'Menu button handler toggleSidebar must be bound');
  assert.equal(typeof vmSandbox.window.foldAllNavbarSubsections, 'function', 'foldAllNavbarSubsections must be bound');
  assert.equal(typeof vmSandbox.window.closeNavbarMenu, 'function', 'closeNavbarMenu must be bound');
  domElements['nav-hdr-creator-item'] = getMockEl('nav-hdr-creator-item');
  domElements['nav-hdr-creator-item'].classList.add('expanded');
  domElements['nav-hdr-creator-item'].setAttribute('aria-expanded', 'true');
  vmSandbox.window.closeNavbarMenu();
  assert.equal(domElements['nav-hdr-creator-item'].classList.contains('expanded'), false, 'closeNavbarMenu must refold expanded subsections');
  assert.equal(domElements['nav-hdr-creator-item'].attributes['aria-expanded'], 'false', 'closeNavbarMenu must reset aria-expanded to false');
  assert.equal(typeof vmSandbox.window.scheduleNavbarAutoClose, 'function', 'scheduleNavbarAutoClose must be bound');
  assert.equal(typeof vmSandbox.window.cancelNavbarAutoClose, 'function', 'cancelNavbarAutoClose must be bound');
  assert.equal(typeof vmSandbox.window.scrollToTop, 'function', 'scrollToTop must be bound');
  assert.equal(typeof vmSandbox.window.updateBackToTopPosition, 'function', 'updateBackToTopPosition must be bound');
  vmSandbox.window.innerWidth = 390;
  vmSandbox.window.innerHeight = 800;
  domElements['footer-text'].getBoundingClientRect = () => ({ top: 700 });
  vmSandbox.window.updateBackToTopPosition();
  assert.equal(domElements['btn-back-to-top'].style.bottom, '110px', 'On mobile when footer enters viewport, Arriba button must stop cleanly in empty space above footer');
  vmSandbox.window.innerWidth = 1280;
  vmSandbox.window.updateBackToTopPosition();
  assert.equal(domElements['btn-back-to-top'].style.bottom, '', 'On desktop, Arriba button must reset custom bottom offset');
  assert.equal(typeof vmSandbox.window.initCardScrollReveal, 'function', 'initCardScrollReveal must be bound');
  assert.equal(typeof vmSandbox.window.scheduleRecomputeAndRender, 'function', 'scheduleRecomputeAndRender must be bound');
  assert.equal(typeof vmSandbox.window.handleFilterDropdownScrollAutoClose, 'function', 'handleFilterDropdownScrollAutoClose must be bound');
  domElements['pos-dropdown'] = getMockEl('pos-dropdown');
  domElements['pos-dropdown-toggle'] = getMockEl('pos-dropdown-toggle');
  domElements['pos-dropdown'].classList.add('open');
  domElements['pos-dropdown-toggle'].setAttribute('aria-expanded', 'true');
  domElements['pos-dropdown'].getBoundingClientRect = () => ({ top: -120, bottom: 20 });
  vmSandbox.window.handleFilterDropdownScrollAutoClose();
  assert.equal(domElements['pos-dropdown'].classList.contains('open'), false, 'Open filter dropdown must auto-close when scrolled above sticky navbar');
  assert.equal(domElements['pos-dropdown-toggle'].attributes['aria-expanded'], 'false', 'Scrolling filter dropdown out of view must reset aria-expanded to false');
  assert.equal(typeof vmSandbox.window.updateNavbarStickyState, 'function', 'updateNavbarStickyState must be bound');
  vmSandbox.window.scrollY = 40;
  vmSandbox.window.updateNavbarStickyState();
  assert.equal(domElements['navbar'].classList.contains('navbar-scrolled'), true, 'Scrolling down must add .navbar-scrolled frosted blur state to #navbar');
  vmSandbox.window.scrollY = 0;
  vmSandbox.window.updateNavbarStickyState();
  assert.equal(domElements['navbar'].classList.contains('navbar-scrolled'), false, 'Scrolling back to top must remove .navbar-scrolled from #navbar');
  assert.equal(typeof vmSandbox.window.toggleCreatorMenu, 'function', 'toggleCreatorMenu must be bound');
  assert.equal(typeof vmSandbox.window.toggleCategoriesMenu, 'function', 'toggleCategoriesMenu must be bound');
  assert.equal(typeof vmSandbox.window.closeCategoriesMenu, 'function', 'closeCategoriesMenu must be bound');
  assert.equal(typeof vmSandbox.window.selectFooterTrack, 'function', 'selectFooterTrack must be bound');
  assert.equal(typeof vmSandbox.window.openFooterCategoriesFromManual, 'function', 'openFooterCategoriesFromManual must be bound');
  vmSandbox.switchMainView('manual');
  assert.equal(domElements['footer-text'].style.display, '', 'switchMainView(manual) must keep #footer-text visible');
  vmSandbox.switchMainView('results');
  assert.equal(typeof vmSandbox.window.clearSearchInput, 'function', 'clearSearchInput must be bound');
  assert.equal(typeof vmSandbox.window.syncSearchClearButton, 'function', 'syncSearchClearButton must be bound');
  assert.equal(domElements['btn-clear-search-input'].style.display, 'none', 'Inline Borrar búsqueda button must start hidden when search field is empty');
  domElements['searchInput'].value = 'a';
  vmSandbox.window.onSearchInputChange('a');
  assert.equal(domElements['btn-clear-search-input'].style.display, 'inline-flex', 'Inline Borrar búsqueda button must appear as soon as 1 letter is entered');
  assert.equal(domElements['search-input-wrap'].classList.contains('has-value'), true, 'Search input wrapper must get has-value class when populated');
  vmSandbox.window.clearSearchInput();
  assert.equal(domElements['searchInput'].value, '', 'clearSearchInput must empty the search field');
  assert.equal(domElements['btn-clear-search-input'].style.display, 'none', 'clearSearchInput must hide Borrar búsqueda button');
  assert.equal(domElements['search-input-wrap'].classList.contains('has-value'), false, 'clearSearchInput must remove has-value class');
  vmSandbox.window.toggleCategoriesMenu();
  assert.equal(domElements['footer-categories-dropdown'].classList.contains('open'), true, 'toggleCategoriesMenu must open footer categories dropdown');
  assert.equal(domElements['nav-hdr-tracks-item'].attributes['aria-expanded'], 'true', 'toggleCategoriesMenu must set aria-expanded=true');
  vmSandbox.window.closeCategoriesMenu();
  assert.equal(domElements['footer-categories-dropdown'].classList.contains('open'), false, 'closeCategoriesMenu must close footer categories dropdown');
  assert.equal(domElements['nav-hdr-tracks-item'].attributes['aria-expanded'], 'false', 'closeCategoriesMenu must reset aria-expanded=false');
  assert.equal(typeof vmSandbox.window.closeAiDiagnosticPanel, 'function', 'closeAiDiagnosticPanel must be bound');
  assert.equal(typeof vmSandbox.window.handleAiPanelScrollAutoClose, 'function', 'handleAiPanelScrollAutoClose must be bound');
  assert.equal(typeof vmSandbox.window.setAiCvPanelFolded, 'function', 'setAiCvPanelFolded must be bound');
  assert.equal(typeof vmSandbox.window.renderScanFeedback, 'function', 'renderScanFeedback must be bound');
  assert.equal(typeof vmSandbox.window.closeScanFeedback, 'function', 'closeScanFeedback must be bound');

  // Verify #scan-feedback-box display:flex fix, verdict badges, DEAD LEAD, and close button
  vmSandbox.window.renderScanFeedback('Remotive', { apply: 6, possible: 9, skip: 3, geo: 6 }, false);
  assert.equal(domElements['scan-feedback-box'].style.display, 'flex', '#scan-feedback-box must set style.display = flex when visible');
  assert.ok(domElements['scan-feedback-box'].innerHTML.includes('Remotive'), 'Must show Platform Name');
  assert.ok(domElements['scan-feedback-box'].innerHTML.includes('POSTULAR: 6'), 'Must show POSTULAR badge count');
  assert.ok(domElements['scan-feedback-box'].innerHTML.includes('EXPLORAR: 9'), 'Must show EXPLORAR badge count');
  assert.ok(domElements['scan-feedback-box'].innerHTML.includes('BAJA COINCIDENCIA: 3'), 'Must show BAJA COINCIDENCIA badge count');
  assert.ok(domElements['scan-feedback-box'].innerHTML.includes('BLOQUEADAS PA&Iacute;S: 6'), 'Must show BLOQUEADAS PAIS badge count');
  assert.ok(domElements['scan-feedback-box'].innerHTML.includes('closeScanFeedback()'), 'Must include close button');

  vmSandbox.window.renderScanFeedback('BrokenBoard', { apply: 0, possible: 0, skip: 0, geo: 0 }, true);
  assert.equal(domElements['scan-feedback-box'].style.display, 'flex', '#scan-feedback-box must set style.display = flex on DEAD LEAD');
  assert.ok(domElements['scan-feedback-box'].className.includes('error'), 'DEAD LEAD must use error class');
  assert.ok(domElements['scan-feedback-box'].innerHTML.includes('BrokenBoard'), 'Must show Platform Name on DEAD LEAD');
  assert.ok(domElements['scan-feedback-box'].innerHTML.includes('DEAD LEAD'), 'Must show DEAD LEAD badge');

  vmSandbox.window.closeScanFeedback();
  assert.equal(domElements['scan-feedback-box'].style.display, 'none', 'closeScanFeedback must hide #scan-feedback-box');

  console.log('2. Testing GET /api/state (85+ platforms + 100% Bolivia-eligible opportunities only)...');
  const reqState = new Request('https://bolivia-remote-scout.workers.dev/api/state');
  const respState = await worker.fetch(reqState, {}, {});
  assert.equal(respState.status, 200);
  const stateData = await respState.json();
  assert.equal(stateData.schedule, '*/15 * * * *');
  assert.ok(stateData.platforms_count >= 85, `Expected >= 85 platforms, got ${stateData.platforms_count}`);
  assert.ok(stateData.opportunities_count >= 100, `Expected >= 100 Bolivia-eligible opportunities, got ${stateData.opportunities_count}`);
  for (const opp of stateData.opportunities) {
    assert.equal(
      checkBoliviaRemoteEligibility(opp).eligible,
      true,
      `Imported opportunity "${opp.title}" (${opp.location}) must be 100% remote eligible from Bolivia`
    );
  }
  const forcedEval = evaluateAllOpportunities(
    [
      { title: 'US Only Engineer', company: 'USCorp', location: 'USA Only', url: 'https://uscorp.example/1', description: 'W-2 US residents only' },
      { title: 'LATAM Engineer', company: 'GlobalCorp', location: 'LATAM Remote', url: 'https://globalcorp.example/1', description: 'Remote contractor W-8BEN' }
    ],
    { require_bolivia_remote: false, languages: ['es', 'en'] }
  );
  assert.equal(forcedEval.surfaced.length, 1, 'Evaluator must enforce 100% remote Bolivia eligibility even if require_bolivia_remote=false');
  assert.equal(forcedEval.all.length, 1, 'Evaluator all-list must contain only Bolivia-eligible offers');

  console.log('3. Testing POST /api/evaluate across Spanish-only, English-only, Both, and legacy Portuguese fallback...');
  const reqEvalEs = new Request('https://bolivia-remote-scout.workers.dev/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters: {
        ui_lang: 'es',
        require_bolivia_remote: true,
        languages: ['es']
      }
    })
  });
  const respEvalEs = await worker.fetch(reqEvalEs, {}, {});
  assert.equal(respEvalEs.status, 200);
  const evalEsData = await respEvalEs.json();
  assert.equal(evalEsData.ok, true);
  assert.ok(evalEsData.counts.surfaced > 0, 'Must surface Spanish offers');
  assert.ok(evalEsData.counts.skip > 0, 'English-only offers must be marked as skip');
  for (const opp of evalEsData.results) {
    assert.ok(
      opp.detected_languages.includes('es'),
      `Surfaced offer "${opp.title}" must be detected as Spanish-compatible, but got [${opp.detected_languages.join(', ')}]`
    );
  }

  // English-only ['en']
  const respEvalEn = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: { ui_lang: 'es', require_bolivia_remote: true, languages: ['en'] }
      })
    }),
    {},
    {}
  );
  assert.equal(respEvalEn.status, 200);
  const evalEnData = await respEvalEn.json();
  assert.equal(evalEnData.ok, true);
  assert.ok(evalEnData.counts.surfaced > evalEsData.counts.surfaced, 'English-only must surface English offers');
  for (const opp of evalEnData.results) {
    assert.ok(
      opp.detected_languages.includes('en'),
      `Surfaced offer "${opp.title}" under EN-only must include en, got [${opp.detected_languages.join(', ')}]`
    );
  }
  const primaryEnTop = evalEnData.results.find(r => r.primary_language === 'en');
  assert.ok(primaryEnTop && primaryEnTop.language_score === 20, 'Primary English offers must score 20/20 under EN-only');

  // Both Spanish & English ['es', 'en']
  const respEvalBoth = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: { ui_lang: 'es', require_bolivia_remote: true, languages: ['es', 'en'] }
      })
    }),
    {},
    {}
  );
  assert.equal(respEvalBoth.status, 200);
  const evalBothData = await respEvalBoth.json();
  assert.equal(evalBothData.ok, true);
  assert.ok(
    evalBothData.counts.surfaced > evalEnData.counts.surfaced && evalBothData.counts.surfaced > evalEsData.counts.surfaced,
    `Both ES+EN (${evalBothData.counts.surfaced}) must surface strictly more than EN-only (${evalEnData.counts.surfaced}) and ES-only (${evalEsData.counts.surfaced})`
  );
  assert.ok(
    evalBothData.counts.apply >= evalEnData.counts.apply && evalBothData.counts.apply >= evalEsData.counts.apply,
    'Selecting both ES+EN must yield >= APPLY offers than either single language alone'
  );

  // Legacy Portuguese-only ['pt'] falls back cleanly to ['es']
  const respEvalPtLegacy = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters: { languages: ['pt'] } })
    }),
    {},
    {}
  );
  assert.equal(respEvalPtLegacy.status, 200);
  const evalPtLegacyData = await respEvalPtLegacy.json();
  assert.equal(evalPtLegacyData.counts.surfaced, evalEsData.counts.surfaced, 'Legacy pt language filter must fall back cleanly to default Spanish-only');

  console.log('4. Testing POST /api/evaluate with Virtual Assistant, Coordinator, and Languages/Translation roles...');
  const reqEvalVA = new Request('https://bolivia-remote-scout.workers.dev/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters: {
        ui_lang: 'es',
        require_bolivia_remote: true,
        position_types: ['virtual_assistant', 'operations_coord', 'languages_translation']
      }
    })
  });
  const respEvalVA = await worker.fetch(reqEvalVA, {}, {});
  assert.equal(respEvalVA.status, 200);
  const evalVAData = await respEvalVA.json();
  assert.equal(evalVAData.ok, true);
  assert.ok(evalVAData.counts.apply > 0, 'Must surface matching VA, Coordinator, and Languages/Translation roles as APPLY');
  assert.ok(evalVAData.results.some(r => (r.detected_categories || []).includes('languages_translation')), 'Must detect languages_translation category');

  console.log('5. Testing GET /api/results.md in ES and EN...');
  const respMdEs = await worker.fetch(new Request('https://bolivia-remote-scout.workers.dev/api/results.md?lang=es'), {}, {});
  const mdEs = await respMdEs.text();
  assert.ok(mdEs.includes('Resultados de Empleos Remotos desde Bolivia (BO)'));
  assert.ok(mdEs.includes('POSTULAR (Puntaje >= 78):'));
  assert.ok(mdEs.includes('EXPLORAR (Puntaje 58–77):'));

  const respMdEn = await worker.fetch(new Request('https://bolivia-remote-scout.workers.dev/api/results.md?lang=en'), {}, {});
  const mdEn = await respMdEn.text();
  assert.ok(mdEn.includes('Bolivia (BO) 100% Remote Job Results'));
  assert.ok(mdEn.includes('APPLY (Score >= 78):'));
  assert.ok(mdEn.includes('POSSIBLE (Score 58–77):'));

  console.log('5b. Testing Phase 1 fixes (entity-encoded HTML stripping, geo-leak blocking, deduplication, score distribution)...');
  assert.equal(
    stripHtml('&lt;p&gt; &lt;strong&gt;Headquarters:&lt;/strong&gt; Remote &lt;/p&gt;'),
    'Headquarters: Remote',
    'stripHtml must decode &lt; and &gt; before stripping HTML tags'
  );
  assert.equal(
    checkBoliviaRemoteEligibility({ title: 'Senior Back-end Developer', location: 'Europe, USA, Canada, Australia, Singapore, Mexico, Saudi Arabia', description: '' }).eligible,
    false,
    'Must block multi-country location list that excludes Bolivia/LATAM/Worldwide'
  );
  assert.equal(
    checkBoliviaRemoteEligibility({ title: 'Tech Lead Rails Engineer', location: 'USA, Canada, USA timezones', description: '' }).eligible,
    false,
    'Must block USA, Canada, USA timezones'
  );
  assert.equal(
    checkBoliviaRemoteEligibility({ title: 'Quality Assurance Rater - German speakers in Germany', location: 'Global', description: '' }).eligible,
    false,
    'Must block country-specific speaker requirement outside Bolivia'
  );
  assert.equal(
    checkBoliviaRemoteEligibility({ title: 'English to Maltese Review Lead', location: 'Anywhere', description: '' }).eligible,
    false,
    'Must block rare non-target language translation pairs'
  );
  assert.equal(
    checkBoliviaRemoteEligibility({ title: 'Security Engineer', location: 'Anywhere in the World', description: 'Headquarters: Remote-Friendly (Travel Required) | San Francisco, CA' }).eligible,
    false,
    'Must block Remote-Friendly (Travel Required) roles'
  );

  const dupSample = [
    { job_hash: computeJobHash('Senior DevOps Engineer', 'Lemon.io', 'https://a.com/1'), title: 'Senior DevOps Engineer', company: 'Lemon.io', location: 'LATAM', url: 'https://a.com/1', description: 'Azure Cloud DevOps Python' },
    { job_hash: computeJobHash('Senior DevOps Engineer', 'Lemon.io', 'https://b.com/2'), title: 'Senior DevOps Engineer', company: 'Lemon.io', location: 'LATAM', url: 'https://b.com/2', description: 'Azure Cloud DevOps Python' }
  ];
  const dedupEval = evaluateAllOpportunities(dupSample, {});
  assert.equal(dedupEval.all.length, 1, 'Must deduplicate cross-platform reposts with identical (title, company)');

  console.log('6. Testing POST /api/platforms/scan-url (Custom URL addition & evaluation)...');
  const reqScanUrl = new Request('https://bolivia-remote-scout.workers.dev/api/platforms/scan-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss',
      name: 'WWR DevOps Custom Feed',
      type: 'rss_feed'
    })
  });
  const respScanUrl = await worker.fetch(reqScanUrl, {}, {});
  assert.equal(respScanUrl.status, 200);
  const scanUrlData = await respScanUrl.json();
  assert.equal(scanUrlData.ok, true);
  assert.ok(scanUrlData.platform.id.includes('weworkremotely'));
  assert.equal(typeof scanUrlData.dead_lead, 'boolean', 'scan-url must return dead_lead boolean');
  assert.ok(scanUrlData.verdict_counts && typeof scanUrlData.verdict_counts.apply === 'number', 'scan-url must return verdict_counts');

  console.log('6b. Testing GET /api/platforms/sync (Export custom_* platforms)...');
  const respSync = await worker.fetch(new Request('https://bolivia-remote-scout.workers.dev/api/platforms/sync'), {}, {});
  assert.equal(respSync.status, 200);
  const syncData = await respSync.json();
  assert.equal(syncData.ok, true);
  assert.ok(syncData.custom_platforms_count >= 1, 'Must export at least 1 custom_* platform');
  assert.ok(syncData.custom_platforms.some(p => p.id.startsWith('custom_')), 'Must include custom_* platform record');

  console.log('6c. Testing Phase 2 Cloudflare Workers AI (POST /api/ai/analyze-position, POST /api/ai/enrich) & D1 (env.DB) bindings...');
  assert.equal(
    extractCompensationUsd({ title: 'Senior Cloud Engineer', description: 'Compensation: $4,500 - $6,500/mo USD contractor' }),
    '$4,500 - $6,500/mo',
    'Must extract USD range compensation accurately'
  );

  // Test POST /api/ai/analyze-position with deterministic fallback (no env.AI)
  const reqPosFallback = new Request('https://bolivia-remote-scout.workers.dev/api/ai/analyze-position', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Senior Python & Cloud DevOps Engineer',
      company: 'Andes Cloud Labs',
      platform_name: 'We Work Remotely',
      location: 'Remote LATAM / Worldwide',
      description: 'We need 5+ years of experience with Python, AWS, Terraform, SQL, and CI/CD pipelines. Fluent English and Spanish preferred. Async collaboration across Americas.',
      tags: 'python, aws, terraform, devops, sql'
    })
  });
  const respPosFallback = await worker.fetch(reqPosFallback, {}, {});
  assert.equal(respPosFallback.status, 200);
  const posFallbackData = await respPosFallback.json();
  assert.equal(posFallbackData.ok, true);
  assert.equal(posFallbackData.ai_engine, 'edge-position-analyzer');
  assert.ok(posFallbackData.overview_es.includes('Andes Cloud Labs'), 'Overview must describe the target position and company');
  assert.ok(Array.isArray(posFallbackData.requirements_es) && posFallbackData.requirements_es.length >= 3, 'Must return position requirements');
  assert.ok(Array.isArray(posFallbackData.skills_experience_es) && posFallbackData.skills_experience_es.some(s => s.toLowerCase().includes('python')), 'Must highlight useful skills and experience');
  assert.ok(posFallbackData.timezone_compatibility_es.includes('UTC-4'), 'Must explain compatibility with Bolivia UTC-4 timezone');
  assert.ok(Array.isArray(posFallbackData.candidate_advice_es) && posFallbackData.candidate_advice_es.length >= 2, 'Must return helpful candidate advice');

  // Test POST /api/ai/analyze-position with mocked Cloudflare Workers AI binding (`env.AI`)
  const calledAiModels = [];
  const mockAiEnv = {
    AI: {
      async run(model, opts) {
        calledAiModels.push(model);
        return {
          response: JSON.stringify({
            overview_es: 'Análisis IA desde Cloudflare Workers: rol remoto de arquitectura cloud con alto potencial para Bolivia.',
            requirements_es: ['5+ años en arquitectura cloud', 'Inglés fluido para coordinación técnica', 'Disponibilidad remota internacional'],
            skills_experience_es: ['Python y automatización', 'Terraform e infraestructura como código', 'Kubernetes y SQL'],
            timezone_compatibility_es: 'Excelente compatibilidad desde Bolivia (UTC-4) con solapamiento directo con horario EST/EDT.',
            candidate_advice_es: ['Incluye métricas de disponibilidad y costos optimizados en tu CV.', 'Destaca tu experiencia trabajando en equipos distribuidos desde UTC-4.']
          })
        };
      }
    }
  };
  const reqPosAi = new Request('https://bolivia-remote-scout.workers.dev/api/ai/analyze-position', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Cloud Architect & DevOps Engineer',
      company: 'Global Infra Corp',
      location: 'Remote Worldwide',
      description: 'Looking for a Cloud Architect with Python, Terraform, Kubernetes, and SQL.'
    })
  });
  const respPosAi = await worker.fetch(reqPosAi, mockAiEnv, {});
  assert.equal(respPosAi.status, 200);
  const posAiData = await respPosAi.json();
  assert.equal(posAiData.ok, true);
  assert.deepEqual(calledAiModels, ['@cf/meta/llama-3.3-70b-instruct-fp8-fast'], 'Must invoke @cf/meta/llama-3.3-70b-instruct-fp8-fast exclusively');
  assert.equal(posAiData.ai_engine, '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'Must use Workers AI @cf/meta/llama-3.3-70b-instruct-fp8-fast model when env.AI is bound');
  assert.ok(posAiData.overview_es.includes('Cloudflare Workers'), 'Must return AI-generated Spanish position overview');
  assert.ok(posAiData.requirements_es.length === 3, 'Must return AI-generated requirements list');
  assert.ok(posAiData.skills_experience_es.length === 3, 'Must return AI-generated skills/experience list');
  assert.ok(posAiData.timezone_compatibility_es.includes('UTC-4'), 'Must return AI-generated Bolivia UTC-4 compatibility');
  assert.ok(posAiData.candidate_advice_es.length === 2, 'Must return AI-generated candidate advice list');

  // Test POST /api/ai/enrich with mocked `env.AI` (including pre-parsed JSON object response from Llama 3.3 70B) and `env.DB` (Cloudflare D1)
  let d1StatementsExecuted = 0;
  const mockD1Env = {
    AI: {
      async run(model) {
        assert.equal(model, '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'Enricher must invoke @cf/meta/llama-3.3-70b-instruct-fp8-fast');
        return {
          response: {
            bolivia_eligible: true,
            company: 'Acme Global Cloud',
            compensation_usd: '$5,000/mo',
            summary_es: 'Rol 100% remoto verificado con IA para Bolivia.',
            summary_en: '100% remote role verified by AI for Bolivia.'
          }
        };
      }
    },
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async run() {
                d1StatementsExecuted++;
                return { success: true };
              }
            };
          },
          async run() {
            d1StatementsExecuted++;
            return { success: true };
          },
          async all() {
            return { results: [] };
          }
        };
      }
    }
  };
  const reqEnrich = new Request('https://bolivia-remote-scout.workers.dev/api/ai/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ max_items: 2 })
  });
  const respEnrich = await worker.fetch(reqEnrich, mockD1Env, {});
  assert.equal(respEnrich.status, 200);
  const enrichData = await respEnrich.json();
  assert.equal(enrichData.ok, true);
  assert.equal(enrichData.ai_enabled, true);
  assert.equal(enrichData.enriched_count, 2);
  assert.equal(enrichData.opportunities[0].ai_verified, 1);
  assert.equal(enrichData.opportunities[0].compensation_usd, '$5,000/mo');
  assert.ok(d1StatementsExecuted > 0, 'Must persist enriched opportunities to Cloudflare D1 (env.DB)');

  console.log('6d. Testing Phase 3 Vectorial Database (Semantic Search, Cross-Lingual Embeddings, Vectorize & Semantic Deduplication)...');
  const esVec = buildLocalSemanticVector('asistente virtual atención al cliente soporte administrativo agenda');
  const enMatchVec = buildLocalSemanticVector('Bilingual Executive Virtual Assistant & Customer Support Specialist');
  const unrelatedVec = buildLocalSemanticVector('Senior Kernel Rust Embedded Firmware Engineer');
  assert.ok(
    cosineSimilarity(esVec, enMatchVec) > cosineSimilarity(esVec, unrelatedVec),
    'Cross-lingual Spanish query must have higher cosine similarity with English Virtual Assistant role than unrelated role'
  );

  // Test semantic deduplication
  const semDupRes = deduplicateSemantically([
    { title: 'Senior Cloud DevOps Engineer (AWS / Terraform)', company: 'Acme Cloud', description: 'Manage AWS Kubernetes Terraform CI/CD pipelines remotely from LATAM.' },
    { title: 'Sr. Cloud & DevOps Engineer - AWS/Terraform', company: 'Acme Cloud', description: 'Manage AWS Kubernetes Terraform CI/CD pipelines remotely from LATAM.' },
    { title: 'Bilingual Virtual Assistant', company: 'Virtual Latinos', description: 'Executive assistant and customer support in Spanish and English.' }
  ]);
  assert.equal(semDupRes.duplicates_removed, 1, 'Must semantically deduplicate near-identical role at same company');
  assert.equal(semDupRes.opportunities.length, 2);

  // Test GET /api/search/semantic with local multilingual vector engine
  const respSemLocal = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/api/search/semantic?q=asistente+virtual+atencion+al+cliente+espanol&limit=5'),
    {},
    {}
  );
  assert.equal(respSemLocal.status, 200);
  const semLocalData = await respSemLocal.json();
  assert.equal(semLocalData.ok, true);
  assert.equal(semLocalData.vector_backend, 'edge-multilingual-vectors');
  assert.ok(semLocalData.results.length > 0, 'Semantic search must return ranked results');
  assert.ok(typeof semLocalData.results[0].semantic_score === 'number', 'Results must include semantic_score');
  assert.ok(typeof semLocalData.results[0].blended_score === 'number', 'Results must include blended_score');

  // Test accent-insensitivity & forgiving typo/broad cross-lingual semantic search
  const accentedVec = buildLocalSemanticVector('diseño programación atención inglés administración');
  const plainVec = buildLocalSemanticVector('diseno programacion atencion ingles administracion');
  assert.ok(
    cosineSimilarity(accentedVec, plainVec) > 0.999,
    'Vector embeddings must be completely accent-insensitive'
  );
  const respSemAccented = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/api/search/semantic?q=' + encodeURIComponent('atención al cliente español') + '&limit=5'),
    {},
    {}
  );
  const respSemUnaccented = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/api/search/semantic?q=' + encodeURIComponent('atencion al cliente espanol') + '&limit=5'),
    {},
    {}
  );
  const semAccData = await respSemAccented.json();
  const semUnaccData = await respSemUnaccented.json();
  assert.equal(semAccData.results.length, semUnaccData.results.length, 'Accented and unaccented queries must return identical result counts');
  assert.equal(semAccData.results[0].job_hash, semUnaccData.results[0].job_hash, 'Accented and unaccented queries must return the exact same top match');

  const respSemTypo = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/api/search/semantic?q=' + encodeURIComponent('desarollador pyton') + '&limit=5'),
    {},
    {}
  );
  const semTypoData = await respSemTypo.json();
  assert.ok(semTypoData.results.length > 0, 'Forgiving semantic search must match minor typos like "desarollador pyton"');

  const respSemShort = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/api/search/semantic?q=ia&limit=5'),
    {},
    {}
  );
  const semShortData = await respSemShort.json();
  assert.ok(semShortData.results.length > 0, 'Forgiving semantic search must understand 2-letter acronyms like "ia"');

  // Test POST /api/search/semantic & POST /api/vectors/index with mocked Cloudflare Vectorize (`env.VECTORIZE`) & BGE-M3 (`env.AI`)
  let vectorizeUpsertedCount = 0;
  const mockVectorEnv = {
    AI: {
      async run(model, input) {
        return { data: [new Array(128).fill(0.08)] };
      }
    },
    VECTORIZE: {
      async upsert(records) {
        vectorizeUpsertedCount += records.length;
        return { count: records.length };
      },
      async query(vec, opts) {
        return {
          matches: [
            { id: stateData.opportunities[0].job_hash, score: 0.94, metadata: { job_hash: stateData.opportunities[0].job_hash } }
          ]
        };
      }
    }
  };

  const respVecIndex = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/api/vectors/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_items: 4, deduplicate: true })
    }),
    mockVectorEnv,
    {}
  );
  assert.equal(respVecIndex.status, 200);
  const vecIndexData = await respVecIndex.json();
  assert.equal(vecIndexData.ok, true);
  assert.equal(vecIndexData.indexed_count, 4);
  assert.ok(vecIndexData.backends.includes('cloudflare-vectorize'), 'Must report cloudflare-vectorize backend');
  assert.equal(vectorizeUpsertedCount, 4);

  const respSemVec = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/api/search/semantic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Senior Cloud Engineer Python AWS', topK: 5 })
    }),
    mockVectorEnv,
    {}
  );
  assert.equal(respSemVec.status, 200);
  const semVecData = await respSemVec.json();
  assert.equal(semVecData.ok, true);
  assert.equal(semVecData.vector_backend, 'cloudflare-vectorize');
  assert.equal(semVecData.embedding_model, '@cf/baai/bge-m3');

  console.log('6e. Testing Phase 4 Streamable HTTP MCP Server (/mcp and /.well-known/mcp.json)...');
  // 1. Fail-closed verification: even with empty env {}, public GET /mcp and /.well-known/mcp.json must return 401
  const respMcpPublicBlocked = await worker.fetch(new Request('https://bolivia-remote-scout.workers.dev/mcp'), {}, {});
  assert.equal(respMcpPublicBlocked.status, 401, 'GET /mcp must be blocked (401) by default without token');
  const respManifestPublicBlocked = await worker.fetch(new Request('https://bolivia-remote-scout.workers.dev/.well-known/mcp.json'), {}, {});
  assert.equal(respManifestPublicBlocked.status, 401, 'GET /.well-known/mcp.json must be blocked (401) by default without token');

  const lockedMcpEnv = { MCP_API_KEY: 'bolivia-secret-token-2026' };
  const mcpAuthHeaders = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer bolivia-secret-token-2026'
  };

  const respMcpManifest = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/.well-known/mcp.json', {
      headers: mcpAuthHeaders
    }),
    lockedMcpEnv,
    {}
  );
  assert.equal(respMcpManifest.status, 200);
  const mcpManifest = await respMcpManifest.json();
  assert.equal(mcpManifest.ok, true);
  assert.equal(mcpManifest.transport, 'streamable-http');
  assert.equal(mcpManifest.tools.length, 5);

  // JSON-RPC initialize
  const respMcpInit = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/mcp', {
      method: 'POST',
      headers: mcpAuthHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } })
    }),
    lockedMcpEnv,
    {}
  );
  assert.equal(respMcpInit.status, 200);
  const mcpInitData = await respMcpInit.json();
  assert.equal(mcpInitData.jsonrpc, '2.0');
  assert.equal(mcpInitData.id, 1);
  assert.equal(mcpInitData.result.serverInfo.name, 'bolivia-remote-mcp-server');

  // JSON-RPC tools/list
  const respMcpTools = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/mcp', {
      method: 'POST',
      headers: mcpAuthHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
    }),
    lockedMcpEnv,
    {}
  );
  const mcpToolsData = await respMcpTools.json();
  assert.equal(mcpToolsData.result.tools.length, 5);

  // JSON-RPC tools/call (search_bolivia_remote_jobs)
  const respMcpCallSearch = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/mcp', {
      method: 'POST',
      headers: mcpAuthHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'search_bolivia_remote_jobs',
          arguments: { languages: ['es', 'en'], verdict: 'APPLY', limit: 3 }
        }
      })
    }),
    lockedMcpEnv,
    {}
  );
  const mcpCallSearchData = await respMcpCallSearch.json();
  assert.equal(mcpCallSearchData.result.isError, false);
  const parsedToolOut = JSON.parse(mcpCallSearchData.result.content[0].text);
  assert.ok(Array.isArray(parsedToolOut.results) && parsedToolOut.results.length > 0, 'MCP search_bolivia_remote_jobs must return evaluated APPLY jobs');

  // JSON-RPC resources/read (bolivia://results/markdown)
  const respMcpRes = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/mcp', {
      method: 'POST',
      headers: mcpAuthHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'resources/read',
        params: { uri: 'bolivia://results/markdown' }
      })
    }),
    lockedMcpEnv,
    {}
  );
  const mcpResData = await respMcpRes.json();
  assert.ok(mcpResData.result.contents[0].text.includes('POSTULAR (Puntaje >= 78):'), 'MCP resource must return live Markdown report');

  // Test Private MCP Bearer Token / API Key Protection (env.MCP_API_KEY)
  const respMcpUnauth = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'ping' })
    }),
    lockedMcpEnv,
    {}
  );
  assert.equal(respMcpUnauth.status, 401, 'MCP server must reject unauthenticated request when MCP_API_KEY is set');

  const respMcpWrongKey = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer wrong-token'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 11, method: 'ping' })
    }),
    lockedMcpEnv,
    {}
  );
  assert.equal(respMcpWrongKey.status, 401, 'MCP server must reject invalid Bearer token');

  const respMcpValidBearer = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/mcp', {
      method: 'POST',
      headers: mcpAuthHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: 12, method: 'ping' })
    }),
    lockedMcpEnv,
    {}
  );
  assert.equal(respMcpValidBearer.status, 200, 'MCP server must allow valid Authorization: Bearer token');

  const respMcpValidQueryKey = await worker.fetch(
    new Request('https://bolivia-remote-scout.workers.dev/.well-known/mcp.json?key=bolivia-secret-token-2026'),
    lockedMcpEnv,
    {}
  );
  assert.equal(respMcpValidQueryKey.status, 200, 'MCP server must allow valid ?key= query parameter');

  console.log('7. Testing GET /favicon.svg and /favicon.ico (Earth with Bolivian flag colors)...');
  const respFavSvg = await worker.fetch(new Request('https://bolivia-remote-scout.workers.dev/favicon.svg'), {}, {});
  assert.equal(respFavSvg.status, 200);
  assert.equal(respFavSvg.headers.get('Content-Type'), 'image/svg+xml');
  const favSvgText = await respFavSvg.text();
  assert.ok(favSvgText.includes('<svg'), 'Must return valid SVG');
  assert.ok(favSvgText.includes('bol-red'), 'Must contain Bolivian red');
  assert.ok(favSvgText.includes('bol-yellow'), 'Must contain Bolivian yellow');
  assert.ok(favSvgText.includes('bol-green'), 'Must contain Bolivian green');

  const respFavIco = await worker.fetch(new Request('https://bolivia-remote-scout.workers.dev/favicon.ico'), {}, {});
  assert.equal(respFavIco.status, 200);

  console.log('7b. Testing GET /sitemap.xml and /robots.txt...');
  const respSitemap = await worker.fetch(new Request('https://boliviaremote.work/sitemap.xml'), {}, {});
  assert.equal(respSitemap.status, 200);
  assert.ok(respSitemap.headers.get('Content-Type').includes('application/xml'), 'sitemap.xml must return application/xml');
  const sitemapText = await respSitemap.text();
  assert.ok(sitemapText.includes('<urlset'), 'sitemap.xml must include <urlset');
  assert.ok(sitemapText.includes('https://boliviaremote.work/'), 'sitemap.xml must include canonical domain');
  assert.ok(sitemapText.includes('https://boliviaremote.work/guia-legal-fiscal'), 'sitemap.xml must include /guia-legal-fiscal guide URL');

  const respRobots = await worker.fetch(new Request('https://boliviaremote.work/robots.txt'), {}, {});
  assert.equal(respRobots.status, 200);
  const robotsText = await respRobots.text();
  assert.ok(robotsText.includes('Sitemap: https://boliviaremote.work/sitemap.xml'), 'robots.txt must reference sitemap.xml');
  assert.ok(robotsText.includes('Disallow: /mcp'), 'robots.txt must disallow /mcp');

  console.log('8. Testing zero personal references across all repository files...');
  const filesToCheck = [
    'README.md',
    'sitemap.xml',
    'robots.txt',
    'master_profile.json',
    'platforms_config.json',
    'scout_agent.py',
    'analyst_agent.py',
    'add_platforms.py',
    'index.html',
    'src/seed_data.js',
    'src/evaluator.js',
    'src/scanner.js',
    'src/ai_enricher.js',
    'src/vector_store.js',
    'src/mcp.js',
    'src/ui.js',
    'src/legal_tax_guide.js',
    'src/worker.js',
    'src/favicon.js'
  ];
  const forbiddenTerms = [
    'thomas simon',
    'tsimon.me',
    'pi.tsimon.me',
    'rag.tsimon.me',
    'simon_thomas@outlook.fr',
    '734 62133',
    'tsimonfreelance',
    'cnam france',
    'orange telecom',
    'teamlogic',
    'burnout',
    'low-fuel',
    'french',
    'français',
    'francophone'
  ];

  for (const relPath of filesToCheck) {
    const rawContent = fs.readFileSync(path.resolve(relPath), 'utf8');
    const flagMatches = rawContent.match(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g);
    assert.ok(!flagMatches, `Forbidden flag emoji found in ${relPath}`);
    const emojiMatches = rawContent.match(EMOJI_REGEX);
    assert.ok(!emojiMatches, `Forbidden emoji icon found in ${relPath}: ${emojiMatches?.join(' ')}`);
    const content = (relPath === 'src/ui.js' || relPath === 'index.html')
      ? rawContent
        .replace(/Designed, engineered and hosted by[\s\S]*?tsimon\.me<\/a>/gi, '')
        .replace(/<div id="nav-creator-desc">[\s\S]*?<\/div>/gi, '')
        .toLowerCase()
      : rawContent.toLowerCase();
    for (const term of forbiddenTerms) {
      assert.ok(!content.includes(term), `Forbidden personal term "${term}" found in ${relPath}`);
    }
  }

  console.log('ALL TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
