/**
 * Bolivia Remote Work — Curated Employer & Platform Reality Knowledge Graph Seed (v6.0.0)
 * 100% self-contained inside scout-analyst-pipeline (ADR-08 Air-Gapped).
 *
 * Automatically maps all 86 monitored platforms from INITIAL_PLATFORMS plus core remote
 * employers, EORs, payout rails, free upskilling bridges, and 12 bilingual Bolivia
 * contractor playbooks (es-BO / en).
 */

import { INITIAL_PLATFORMS } from './seed_data.js';
import { normalizeCompanySlug } from './privacy_guard.js';

export const CAREER_INTEL_SEED_VERSION = '6.0.0';

/**
 * Curated payout rails, EORs, and free learning bridges for Bolivia (UTC-4) contractors.
 */
export const CORE_INFRA_ENTITIES = [
  {
    entity_id: 'rail:airtm_usdc',
    entity_type: 'payout_rail',
    canonical_name: 'AirTM / USDC P2P QR (Bs)',
    domain: 'airtm.com',
    bolivia_tier: 'verified_friendly',
    confidence: 0.96,
    pagerank_score: 0.92,
    attributes: {
      rail_label: 'AirTM',
      supports_bolivia_onboarding: true,
      notes_es: 'Soporta retiros directos a cuentas bolivianas por P2P QR en Bolivianos (BOB) y USDC con alta liquidez.',
      notes_en: 'Supports direct withdrawals to Bolivian bank accounts via P2P QR in BOB and USDC with strong liquidity.'
    }
  },
  {
    entity_id: 'rail:payoneer',
    entity_type: 'payout_rail',
    canonical_name: 'Payoneer',
    domain: 'payoneer.com',
    bolivia_tier: 'verified_friendly',
    confidence: 0.92,
    pagerank_score: 0.88,
    attributes: {
      rail_label: 'Payoneer',
      supports_bolivia_onboarding: true,
      notes_es: 'Disponible para registros nuevos en Bolivia; ofrece cuentas receptoras ACH/SEPA y retiro bancario o tarjeta USD.',
      notes_en: 'Open for new registrations in Bolivia; provides ACH/SEPA receiving accounts plus bank withdrawal or USD card.'
    }
  },
  {
    entity_id: 'rail:wise',
    entity_type: 'payout_rail',
    canonical_name: 'Wise',
    domain: 'wise.com',
    bolivia_tier: 'caution_friction',
    confidence: 0.9,
    pagerank_score: 0.8,
    attributes: {
      rail_label: 'Wise',
      supports_bolivia_onboarding: false,
      caution_es: 'Wise mantiene restricciones para emitir tarjetas y abrir ciertos balances nuevos desde Bolivia; conviene validar alternativa Payoneer/AirTM/Deel.',
      caution_en: 'Wise restricts new card issuance and certain new multi-currency balances from Bolivia; verify Payoneer, AirTM, or Deel alternatives.'
    }
  },
  {
    entity_id: 'rail:deel_withdrawal',
    entity_type: 'payout_rail',
    canonical_name: 'Deel',
    domain: 'deel.com',
    bolivia_tier: 'verified_friendly',
    confidence: 0.95,
    pagerank_score: 0.9,
    attributes: {
      rail_label: 'Deel',
      supports_bolivia_onboarding: true,
      notes_es: 'Permite recibir pagos de contratistas W-8BEN en Bolivia y retirar hacia Payoneer, Coinbase/USDC, Binance o transferencia bancaria.',
      notes_en: 'Supports W-8BEN contractor payouts in Bolivia with withdrawals to Payoneer, USDC, or bank transfer.'
    }
  },
  {
    entity_id: 'rail:tipalti',
    entity_type: 'payout_rail',
    canonical_name: 'Tipalti',
    domain: 'tipalti.com',
    bolivia_tier: 'verified_friendly',
    confidence: 0.88,
    pagerank_score: 0.72,
    attributes: {
      rail_label: 'Tipalti',
      supports_bolivia_onboarding: true,
      notes_es: 'Pasarela empresarial usada por plataformas de IA y agencias; integra formulario W-8BEN digital y pagos hacia PayPal/Payoneer/SWIFT.',
      notes_en: 'Enterprise payout portal used by AI and staffing platforms; includes digital W-8BEN and Payoneer/SWIFT options.'
    }
  },
  {
    entity_id: 'rail:usdc_polygon_stellar',
    entity_type: 'payout_rail',
    canonical_name: 'USDC (Polygon / Stellar)',
    domain: 'circle.com',
    bolivia_tier: 'verified_friendly',
    confidence: 0.9,
    pagerank_score: 0.78,
    attributes: {
      rail_label: 'USDC',
      supports_bolivia_onboarding: true,
      notes_es: 'Comisiones de red mínimas y liquidación rápida en Bolivia a través de plataformas P2P reguladas o AirTM.',
      notes_en: 'Minimal network fees and fast settlement in Bolivia through regulated P2P rails or AirTM.'
    }
  },
  {
    entity_id: 'rail:swift_usd',
    entity_type: 'payout_rail',
    canonical_name: 'SWIFT USD Bancario',
    domain: '',
    bolivia_tier: 'caution_friction',
    confidence: 0.85,
    pagerank_score: 0.65,
    attributes: {
      rail_label: 'SWIFT USD',
      supports_bolivia_onboarding: true,
      caution_es: 'Las transferencias SWIFT directas a bancos bolivianos suelen aplicar comisiones intermediarias ($25-$60) y liquidación al tipo de cambio oficial.',
      caution_en: 'Direct SWIFT wires to Bolivian banks often incur $25-$60 intermediary fees and official exchange-rate settlement.'
    }
  },
  {
    entity_id: 'eor:deel',
    entity_type: 'eor',
    canonical_name: 'Deel',
    domain: 'deel.com',
    bolivia_tier: 'verified_friendly',
    confidence: 0.95,
    pagerank_score: 0.9,
    attributes: { eor_label: 'Deel' }
  },
  {
    entity_id: 'eor:ontop',
    entity_type: 'eor',
    canonical_name: 'Ontop',
    domain: 'getontop.com',
    bolivia_tier: 'verified_friendly',
    confidence: 0.92,
    pagerank_score: 0.82,
    attributes: { eor_label: 'Ontop' }
  },
  {
    entity_id: 'eor:remote_com',
    entity_type: 'eor',
    canonical_name: 'Remote.com',
    domain: 'remote.com',
    bolivia_tier: 'verified_friendly',
    confidence: 0.9,
    pagerank_score: 0.8,
    attributes: { eor_label: 'Remote.com' }
  },
  {
    entity_id: 'eor:plane',
    entity_type: 'eor',
    canonical_name: 'Plane',
    domain: 'plane.com',
    bolivia_tier: 'open_global',
    confidence: 0.84,
    pagerank_score: 0.7,
    attributes: { eor_label: 'Plane' }
  },
  {
    entity_id: 'eor:direct_w8ben',
    entity_type: 'eor',
    canonical_name: 'Direct W-8BEN Contractor',
    domain: '',
    bolivia_tier: 'verified_friendly',
    confidence: 0.94,
    pagerank_score: 0.88,
    attributes: { eor_label: 'Direct W-8BEN' }
  },
  {
    entity_id: 'resource:minkalab',
    entity_type: 'skill_bridge',
    canonical_name: 'Minka Lab',
    domain: 'minkalab.net',
    bolivia_tier: 'verified_friendly',
    confidence: 0.95,
    pagerank_score: 0.75,
    attributes: {
      url: 'https://minkalab.net',
      notes_es: 'Iniciativa educativa boliviana enfocada en competencias digitales, IA aplicada e idiomas.'
    }
  },
  {
    entity_id: 'resource:language_transfer',
    entity_type: 'skill_bridge',
    canonical_name: 'Language Transfer',
    domain: 'languagetransfer.org',
    bolivia_tier: 'verified_friendly',
    confidence: 0.94,
    pagerank_score: 0.7,
    attributes: {
      url: 'https://www.languagetransfer.org/',
      notes_es: 'Curso de audio gratuito para acelerar dominio práctico de inglés conversacional.'
    }
  },
  {
    entity_id: 'resource:freecodecamp',
    entity_type: 'skill_bridge',
    canonical_name: 'freeCodeCamp',
    domain: 'freecodecamp.org',
    bolivia_tier: 'verified_friendly',
    confidence: 0.94,
    pagerank_score: 0.72,
    attributes: {
      url: 'https://www.freecodecamp.org/',
      notes_es: 'Certificaciones gratuitas en JavaScript, Python, SQL, análisis de datos y desarrollo web.'
    }
  }
];

/**
 * Curated high-signal overrides for well-known platforms and remote employers.
 * Any platform from INITIAL_PLATFORMS not listed here receives structured track-based intelligence.
 */
const PLATFORM_CURATED_INTEL = {
  outlier_ai: {
    tier: 'verified_friendly',
    confidence: 0.93,
    rails: ['rail:airtm_usdc', 'rail:payoneer'],
    eors: ['eor:direct_w8ben'],
    assessment: 'Async Rubric Eval & Domain Screening',
    comp: '$15-$50/hr USD (especialistas STEM/código hasta $50+/hr)',
    note_es: 'Paga semanalmente vía AirTM o Payoneer en Bolivia; exige precisión estricta en rúbricas y cero uso no autorizado de IA externa.',
    note_en: 'Pays weekly via AirTM or Payoneer in Bolivia; enforces strict rubric accuracy and zero unauthorized external AI assistance.'
  },
  alignerr: {
    tier: 'verified_friendly',
    confidence: 0.9,
    rails: ['rail:deel_withdrawal', 'rail:payoneer'],
    eors: ['eor:deel'],
    assessment: 'Domain Certification & Rubric Assessment',
    comp: '$25-$80/hr USD',
    note_es: 'Onboarding mediante Deel; proyectos asíncronos por lotes para especialistas técnicos y bilingües.',
    note_en: 'Onboards contractors through Deel; batch-based async projects for technical and bilingual specialists.'
  },
  dataannotation: {
    tier: 'caution_friction',
    confidence: 0.82,
    rails: ['rail:payoneer', 'rail:airtm_usdc'],
    eors: ['eor:direct_w8ben'],
    assessment: 'Strict Logic & Coding Qualification Exam',
    comp: '$20-$45/hr USD',
    note_es: 'Alta exigencia en la evaluación inicial y disponibilidad de proyectos variable para Bolivia; prioriza perfiles bilingües y código.',
    note_en: 'Strict initial qualification exam and variable project availability for Bolivia; favors bilingual and coding specialists.'
  },
  mercor: {
    tier: 'verified_friendly',
    confidence: 0.91,
    rails: ['rail:deel_withdrawal', 'rail:payoneer'],
    eors: ['eor:deel', 'eor:direct_w8ben'],
    assessment: 'AI Video Interview & Technical Rubric Review',
    comp: '$35-$120/hr USD',
    note_es: 'Contratación rápida para especialistas senior (ingeniería, finanzas, derecho, datos) con pagos semanales/quincenales en USD.',
    note_en: 'Fast hiring for senior domain experts with weekly/biweekly USD payouts.'
  },
  mindrift: {
    tier: 'verified_friendly',
    confidence: 0.88,
    rails: ['rail:payoneer', 'rail:airtm_usdc'],
    eors: ['eor:direct_w8ben'],
    assessment: 'Writing & Domain Prompt Evaluation Test',
    comp: '$18-$45/hr USD',
    note_es: 'Plataforma de Toloka orientada a tutores de IA en español e inglés técnico con cobro mediante Payoneer/AirTM.',
    note_en: 'Toloka platform for Spanish and technical English AI tutors with Payoneer/AirTM payouts.'
  },
  oneforma: {
    tier: 'verified_friendly',
    confidence: 0.87,
    rails: ['rail:payoneer'],
    eors: ['eor:direct_w8ben'],
    assessment: 'CEFR Language & Guideline Certifications',
    comp: '$12-$35/hr USD',
    note_es: 'Paga principalmente vía Payoneer en ciclos mensuales; ofrece certificaciones internas que desbloquean proyectos en español e inglés.',
    note_en: 'Pays primarily via Payoneer on monthly cycles; internal certifications unlock Spanish and English projects.'
  },
  telus_digital: {
    tier: 'verified_friendly',
    confidence: 0.89,
    rails: ['rail:tipalti', 'rail:payoneer'],
    eors: ['eor:direct_w8ben'],
    assessment: 'Open-Book Search Quality Guidelines Exam',
    comp: '$10-$22/hr USD',
    note_es: 'Utiliza portal Hyperwallet/Tipalti; requiere aprobar examen basado en guías de calidad y mantiene alta estabilidad a medio tiempo.',
    note_en: 'Uses Tipalti/Hyperwallet payout portals; requires passing quality guidelines exam with steady part-time volume.'
  },
  welocalize: {
    tier: 'verified_friendly',
    confidence: 0.89,
    rails: ['rail:tipalti', 'rail:payoneer'],
    eors: ['eor:direct_w8ben'],
    assessment: 'Language & Localization Quality Test',
    comp: '$12-$28/hr USD',
    note_es: 'Paga vía Hyperwallet/Tipalti con facturación independiente W-8BEN; fuerte demanda de español LATAM e inglés.',
    note_en: 'Pays via Tipalti/Hyperwallet under W-8BEN independent contracting; strong LATAM Spanish and English demand.'
  },
  appen_crowdgen: {
    tier: 'caution_friction',
    confidence: 0.84,
    rails: ['rail:payoneer', 'rail:airtm_usdc'],
    eors: ['eor:direct_w8ben'],
    assessment: 'Project Qualification Quizzes',
    comp: '$8-$25/hr USD',
    note_es: 'Paga vía Payoneer/AirTM; algunos proyectos presentan periodos sin tareas activas, conviene diversificar con otras plataformas.',
    note_en: 'Pays via Payoneer/AirTM; project availability fluctuates, so pair with additional platforms.'
  },
  virtual_latinos: {
    tier: 'verified_friendly',
    confidence: 0.94,
    rails: ['rail:payoneer', 'rail:deel_withdrawal', 'rail:wise'],
    eors: ['eor:direct_w8ben', 'eor:deel'],
    assessment: 'Bilingual Video Intro, English Audio & Skills Test',
    comp: '$8-$20/hr USD ($1,200-$3,000/mo)',
    note_es: 'Enfocada explícitamente en talento latinoamericano incluyendo Bolivia; exige inglés B2+/C1 y buena conexión para clientes de EE. UU.',
    note_en: 'Explicitly built for Latin American talent including Bolivia; requires B2+/C1 English for US clients.'
  },
  getonboard: {
    tier: 'verified_friendly',
    confidence: 0.92,
    rails: ['rail:deel_withdrawal', 'rail:payoneer', 'rail:swift_usd'],
    eors: ['eor:deel', 'eor:ontop', 'eor:direct_w8ben'],
    assessment: 'Direct Employer Tech/Portfolio Screening',
    comp: '$1,500-$6,500/mo USD',
    note_es: 'Portal líder de empleo tech remoto en Latinoamérica; muchas startups pagan en USD vía Deel, Ontop o contrato directo.',
    note_en: 'Leading LATAM remote tech board; many startups pay in USD via Deel, Ontop, or direct contractor agreements.'
  },
  torre_ai: {
    tier: 'verified_friendly',
    confidence: 0.9,
    rails: ['rail:deel_withdrawal', 'rail:payoneer', 'rail:airtm_usdc'],
    eors: ['eor:deel', 'eor:ontop', 'eor:direct_w8ben'],
    assessment: 'Genome Profile & Async Screening',
    comp: '$1,000-$6,000/mo USD',
    note_es: 'Alta cobertura de vacantes remotas en español e inglés abiertas a Bolivia y Sudamérica.',
    note_en: 'Broad coverage of Spanish and English remote roles open to Bolivia and South America.'
  },
  toptal: {
    tier: 'verified_friendly',
    confidence: 0.92,
    rails: ['rail:payoneer', 'rail:deel_withdrawal', 'rail:swift_usd'],
    eors: ['eor:direct_w8ben'],
    assessment: '5-Stage English, Live Coding & Test Project Screening',
    comp: '$45-$110/hr USD',
    note_es: 'Paga puntualmente vía Payoneer o transferencia USD a contratistas en Bolivia tras superar el proceso de selección técnico.',
    note_en: 'Reliable Payoneer or USD wire payouts for Bolivian contractors after passing technical vetting.'
  },
  turing: {
    tier: 'verified_friendly',
    confidence: 0.88,
    rails: ['rail:payoneer', 'rail:deel_withdrawal'],
    eors: ['eor:deel', 'eor:direct_w8ben'],
    assessment: 'Algorithmic Coding & Tech Stack Challenges',
    comp: '$3,000-$7,500/mo USD',
    note_es: 'Contrata desarrolladores senior e ingenieros LLM en LATAM con pagos mensuales en USD vía Payoneer/Deel.',
    note_en: 'Hires senior developers and LLM engineers across LATAM with monthly USD payouts via Payoneer/Deel.'
  },
  revelo: {
    tier: 'verified_friendly',
    confidence: 0.9,
    rails: ['rail:deel_withdrawal', 'rail:payoneer'],
    eors: ['eor:deel', 'eor:ontop'],
    assessment: 'English Fluency & Live Engineering Interview',
    comp: '$3,500-$8,000/mo USD',
    note_es: 'Especializada en talento nearshore LATAM para empresas de EE. UU. con alineación directa a horario UTC-4.',
    note_en: 'Specialized in nearshore LATAM talent for US companies with direct UTC-4 timezone alignment.'
  },
  lemon_io: {
    tier: 'verified_friendly',
    confidence: 0.89,
    rails: ['rail:payoneer', 'rail:deel_withdrawal'],
    eors: ['eor:direct_w8ben', 'eor:deel'],
    assessment: 'Seniority Vetting & Live Technical Interview',
    comp: '$35-$75/hr USD',
    note_es: 'Acepta ingenieros senior de Latinoamérica con inglés fluido y facturación independiente.',
    note_en: 'Accepts senior LATAM engineers with fluent English and independent contractor invoicing.'
  },
  braintrust: {
    tier: 'verified_friendly',
    confidence: 0.87,
    rails: ['rail:usdc_polygon_stellar', 'rail:deel_withdrawal', 'rail:payoneer'],
    eors: ['eor:direct_w8ben'],
    assessment: 'Profile Verification & Technical Screening',
    comp: '$40-$100/hr USD',
    note_es: 'Red descentralizada sin comisión al talento; soporta pagos en USD o USDC compatibles con Bolivia.',
    note_en: 'Zero-fee talent network supporting USD or USDC payouts compatible with Bolivia.'
  },
  workana: {
    tier: 'verified_friendly',
    confidence: 0.93,
    rails: ['rail:payoneer', 'rail:airtm_usdc'],
    eors: ['eor:direct_w8ben'],
    assessment: 'Portfolio Review & Client Proposals',
    comp: '$12-$45/hr USD',
    note_es: 'Marketplace latinoamericano con retiro directo a Payoneer y fuerte volumen en español para diseño, desarrollo, soporte y finanzas.',
    note_en: 'Latin American freelance marketplace with Payoneer withdrawals and strong Spanish project volume.'
  },
  latinhire: {
    tier: 'verified_friendly',
    confidence: 0.9,
    rails: ['rail:payoneer', 'rail:airtm_usdc'],
    eors: ['eor:direct_w8ben'],
    assessment: 'Subject Matter & Bilingual Demo Lesson',
    comp: '$10-$22/hr USD',
    note_es: 'Conecta tutores y especialistas de soporte en Latinoamérica con horarios flexibles compatibles con Bolivia.',
    note_en: 'Connects Latin American tutors and support specialists with flexible schedules compatible with Bolivia.'
  },
  hirelatam: {
    tier: 'verified_friendly',
    confidence: 0.9,
    rails: ['rail:deel_withdrawal', 'rail:payoneer'],
    eors: ['eor:deel', 'eor:ontop'],
    assessment: 'Bilingual Interview & Role Challenge',
    comp: '$1,400-$4,500/mo USD',
    note_es: 'Agencia nearshore enfocada en roles bilingües de operaciones, marketing, soporte y finanzas en horario de EE. UU./UTC-4.',
    note_en: 'Nearshore agency focused on bilingual ops, marketing, support, and finance roles in US/UTC-4 hours.'
  }
};

/**
 * Curated major remote-first global employers (beyond the 86 job boards/platforms).
 */
const MAJOR_REMOTE_EMPLOYERS = [
  {
    entity_id: 'company:deel',
    canonical_name: 'Deel',
    domain: 'deel.com',
    bolivia_tier: 'verified_friendly',
    confidence: 0.96,
    rails: ['rail:deel_withdrawal', 'rail:payoneer', 'rail:usdc_polygon_stellar'],
    eors: ['eor:deel'],
    assessment: 'Role Case Study & Async/Live Interviews',
    comp: '$3,000-$9,000/mo USD',
    note_es: 'Empresa global 100% remota que opera su propia infraestructura de contratación y pagos internacionales en Bolivia.',
    note_en: '100% remote global company operating its own international contractor and payout infrastructure in Bolivia.'
  },
  {
    entity_id: 'company:gitlab',
    canonical_name: 'GitLab',
    domain: 'gitlab.com',
    bolivia_tier: 'verified_friendly',
    confidence: 0.93,
    rails: ['rail:deel_withdrawal', 'rail:swift_usd'],
    eors: ['eor:remote_com', 'eor:direct_w8ben'],
    assessment: 'Async Handbook-First & Technical Interviews',
    comp: '$4,000-$10,000/mo USD',
    note_es: 'Referente en trabajo asíncrono global; publica escalas transparentes y contrata mediante EOR/contratista en LATAM.',
    note_en: 'Global async-first leader with transparent compensation bands and LATAM EOR/contractor hiring.'
  },
  {
    entity_id: 'company:canonical',
    canonical_name: 'Canonical',
    domain: 'canonical.com',
    bolivia_tier: 'verified_friendly',
    confidence: 0.91,
    rails: ['rail:payoneer', 'rail:swift_usd'],
    eors: ['eor:direct_w8ben'],
    assessment: 'Written Technical Essay, Thomas Psychometric & Panel Interviews',
    comp: '$4,500-$9,500/mo USD',
    note_es: 'Contrata globalmente incluyendo Bolivia bajo modalidad 100% remota; proceso de selección riguroso con ensayo escrito inicial.',
    note_en: 'Hires globally including Bolivia 100% remotely; thorough hiring process starting with a written technical essay.'
  },
  {
    entity_id: 'company:automattic',
    canonical_name: 'Automattic',
    domain: 'automattic.com',
    bolivia_tier: 'verified_friendly',
    confidence: 0.92,
    rails: ['rail:payoneer', 'rail:deel_withdrawal'],
    eors: ['eor:direct_w8ben'],
    assessment: 'Paid Async Trial Project',
    comp: '$4,000-$9,000/mo USD',
    note_es: 'Organización distribuida globalmente (WordPress.com, WooCommerce) con prueba pagada asíncrona y contratación en LATAM.',
    note_en: 'Globally distributed company (WordPress.com, WooCommerce) with paid async trial and LATAM contracting.'
  },
  {
    entity_id: 'company:zapier',
    canonical_name: 'Zapier',
    domain: 'zapier.com',
    bolivia_tier: 'open_global',
    confidence: 0.87,
    rails: ['rail:deel_withdrawal', 'rail:payoneer'],
    eors: ['eor:deel', 'eor:remote_com'],
    assessment: 'Async Skills Assignment & Panel Interviews',
    comp: '$4,500-$9,500/mo USD',
    note_es: 'Empresa 100% remota con apertura en América/UTC-4; validar elegibilidad de país específica en cada vacante.',
    note_en: '100% remote company open across Americas/UTC-4; verify country list on each specific requisition.'
  },
  {
    entity_id: 'company:doist',
    canonical_name: 'Doist',
    domain: 'doist.com',
    bolivia_tier: 'verified_friendly',
    confidence: 0.91,
    rails: ['rail:payoneer', 'rail:deel_withdrawal'],
    eors: ['eor:direct_w8ben'],
    assessment: 'Async Paid Test Project',
    comp: '$4,000-$8,500/mo USD',
    note_es: 'Creadores de Todoist; cultura asíncrona real con contratación independiente internacional abierta a Bolivia.',
    note_en: 'Makers of Todoist; authentic async culture with international contractor hiring open to Bolivia.'
  },
  {
    entity_id: 'company:cloudflare',
    canonical_name: 'Cloudflare',
    domain: 'cloudflare.com',
    bolivia_tier: 'open_global',
    confidence: 0.86,
    rails: ['rail:deel_withdrawal', 'rail:swift_usd'],
    eors: ['eor:remote_com', 'eor:direct_w8ben'],
    assessment: 'System Design, Coding & Architecture Interviews',
    comp: '$4,500-$10,000/mo USD',
    note_es: 'Publica roles remotos regionales en LATAM/Américas; verificar en cada oferta si permite contratación desde Bolivia.',
    note_en: 'Posts regional LATAM/Americas remote roles; check each requisition for Bolivia contracting eligibility.'
  },
  {
    entity_id: 'company:ontop',
    canonical_name: 'Ontop',
    domain: 'getontop.com',
    bolivia_tier: 'verified_friendly',
    confidence: 0.93,
    rails: ['rail:usdc_polygon_stellar', 'rail:payoneer', 'rail:airtm_usdc'],
    eors: ['eor:ontop'],
    assessment: 'Role Challenge & Cultural Fit Interviews',
    comp: '$2,000-$6,500/mo USD',
    note_es: 'Fintech enfocada en nómina remota para Latinoamérica; alta compatibilidad con contratistas bolivianos.',
    note_en: 'Fintech focused on LATAM remote payroll with strong compatibility for Bolivian contractors.'
  },
  {
    entity_id: 'company:bairesdev',
    canonical_name: 'BairesDev',
    domain: 'bairesdev.com',
    bolivia_tier: 'verified_friendly',
    confidence: 0.9,
    rails: ['rail:payoneer', 'rail:deel_withdrawal', 'rail:swift_usd'],
    eors: ['eor:direct_w8ben'],
    assessment: 'English C1 Check, Timed Technical Test & Client Interview',
    comp: '$2,500-$6,500/mo USD',
    note_es: 'Una de las mayores consultoras nearshore en Bolivia y LATAM; paga en USD vía Payoneer/transferencia.',
    note_en: 'Major nearshore consultancy hiring in Bolivia and LATAM with USD payouts via Payoneer/wire.'
  }
];

/**
 * 12 Curated Bilingual (es-BO / en) Bolivia Contractor Playbooks
 */
export const BOLIVIA_CONTRACTOR_PLAYBOOKS = [
  {
    playbook_id: 'pb_w8ben_bolivia',
    category: 'tax_contracts',
    title_es: 'Formulario W-8BEN desde Bolivia: 0% retención en EE. UU.',
    title_en: 'Form W-8BEN from Bolivia: 0% US Tax Withholding',
    summary_es: 'Cómo llenar el W-8BEN como contratista independiente residente en Bolivia sin retención federal de EE. UU. por servicios prestados 100% fuera de territorio estadounidense.',
    summary_en: 'How to complete Form W-8BEN as a Bolivian resident independent contractor for 0% US federal withholding on foreign-sourced services.',
    content_es: 'El formulario IRS W-8BEN certifica que eres una persona natural no residente fiscal en EE. UU. Al prestar servicios remotos íntegramente desde Bolivia, las empresas estadounidenses aplican 0% de retención federal (foreign-sourced income). En la Parte I coloca tu nombre completo, país de ciudadanía (Bolivia), dirección residencial boliviana y tu número de identificación tributaria/CI en la casilla 6a (FTIN). No necesitas SSN ni ITIN ni visa de trabajo estadounidense para facturar como contratista independiente. Deja vacía la Parte II (Bolivia no tiene tratado fiscal bilateral con EE. UU., pero el ingreso por servicios prestados fuera de EE. UU. no está sujeto a retención).',
    content_en: 'IRS Form W-8BEN certifies non-US individual status. For remote services performed 100% from Bolivia, US payers apply 0% federal withholding (foreign-sourced services). Complete Part I with your legal name, Bolivia citizenship, Bolivian residential address, and your Bolivian NIT or CI as FTIN in line 6a. Neither an SSN, ITIN, nor US work visa is required. Leave Part II treaty claims blank since foreign-performed independent services are already non-US-source.',
    tags: 'w-8ben, w8ben, impuestos, tax, contratista, contractor, usa, ee uu, factura, invoice, ssn, itin'
  },
  {
    playbook_id: 'pb_airtm_usdc_bob',
    category: 'payout_rails',
    title_es: 'Cobro en Bolivia con AirTM y USDC hacia QR Bancario en Bs',
    title_en: 'Getting Paid in Bolivia via AirTM & USDC to Local BOB QR',
    summary_es: 'Ruta práctica para cobrar honorarios internacionales vía AirTM o USDC (Polygon/Stellar) y liquidar a bancos bolivianos con liquidez rápida y tipo de cambio de mercado.',
    summary_en: 'Practical pathway to receive international contractor fees via AirTM or USDC (Polygon/Stellar) and settle into Bolivian banks at market liquidity.',
    content_es: 'AirTM y las transferencias en USDC sobre redes de bajo costo (Polygon, Stellar) son de las vías más ágiles para trabajadores remotos en Bolivia. Plataformas como Outlier AI, Mindrift, Appen y clientes directos B2B liquidan en AirTM o billeteras USDC con comisiones mínimas. Desde allí puedes convertir a Bolivianos (BOB) mediante P2P hacia QR bancario local (BNB, Mercantil, Bisa, Banco Unión, Económico) manteniendo acceso a liquidez real y evitando comisiones fijas de $35-$60 de transferencias SWIFT tradicionales.',
    content_en: 'AirTM and low-fee USDC rails (Polygon, Stellar) are among the fastest payout pathways for remote contractors in Bolivia. Platforms such as Outlier AI, Mindrift, Appen, and direct B2B clients settle into AirTM or USDC wallets with low fees, allowing conversion to BOB via local P2P bank QR rails without $35-$60 SWIFT wire deductions.',
    tags: 'airtm, usdc, crypto, polygon, stellar, qr, bolivianos, bob, cobro, pago, payout, outlier, mindrift'
  },
  {
    playbook_id: 'pb_payoneer_bolivia',
    category: 'payout_rails',
    title_es: 'Payoneer en Bolivia: cuentas receptoras USD/EUR y retiros',
    title_en: 'Payoneer in Bolivia: USD/EUR Receiving Accounts & Withdrawals',
    summary_es: 'Uso de Payoneer para recibir pagos ACH de empresas de EE. UU. y plataformas (Workana, Toptal, OneForma, Virtual Latinos) desde Bolivia.',
    summary_en: 'Using Payoneer to receive US ACH payments and platform payouts (Workana, Toptal, OneForma, Virtual Latinos) from Bolivia.',
    content_es: 'Payoneer sigue permitiendo apertura de cuentas nuevas para residentes en Bolivia. Proporciona datos bancarios receptores locales en EE. UU. (ACH), Europa (SEPA) y Reino Unido para recibir pagos como si tuvieras cuenta local. Verifica el porcentaje de comisión por recepción (0% a 1% según origen) y las condiciones de retiro a banco boliviano o uso de tarjeta USD digital/física. Es una alternativa sólida y ampliamente aceptada por clientes corporativos que no operan con stablecoins.',
    content_en: 'Payoneer supports new account onboarding for Bolivian residents and provides US ACH, EU SEPA, and UK receiving details. Review incoming fee schedules (typically 0%-1% depending on source) and withdrawal/card options. It is widely accepted by corporate clients that do not use stablecoin rails.',
    tags: 'payoneer, ach, sepa, usd, cobro, pago, workana, toptal, oneforma, virtual latinos, tarjeta'
  },
  {
    playbook_id: 'pb_wise_caution_bolivia',
    category: 'payout_rails',
    title_es: 'Advertencia sobre Wise en Bolivia: cuentas nuevas vs. alternativas',
    title_en: 'Wise Caution in Bolivia: New Account Limits & Alternatives',
    summary_es: 'Qué verificar si una empresa propone pagar por Wise desde Bolivia y cómo negociar Payoneer, Deel o AirTM antes de firmar.',
    summary_en: 'What to check when an employer proposes Wise payouts in Bolivia and how to negotiate Payoneer, Deel, or AirTM upfront.',
    content_es: 'Wise aplica restricciones geográficas para abrir nuevos balances multidivisa y emitir tarjetas de débito a direcciones registradas en Bolivia. Quienes ya cuentan con cuentas verificadas antiguas pueden operar con límites, pero si es tu primera cuenta conviene confirmar con el empleador antes de firmar si puede liquidar mediante Deel, Ontop, Payoneer o AirTM/USDC. En la negociación final menciona directamente: "Facturo internacionalmente bajo W-8BEN y recibo vía Deel, Payoneer o AirTM sin fricción bancaria".',
    content_en: 'Wise restricts new multi-currency balances and debit card issuance for addresses registered in Bolivia. Before signing an offer specifying Wise, ask whether the employer supports Deel, Ontop, Payoneer, or AirTM/USDC instead.',
    tags: 'wise, caution, advertencia, restriccion, bolivia, cobro, banco, alternativa, payoneer, deel'
  },
  {
    playbook_id: 'pb_deel_ontop_eor',
    category: 'payout_rails',
    title_es: 'Cobro mediante EOR: Deel, Ontop, Plane y Remote.com',
    title_en: 'Getting Paid via EORs: Deel, Ontop, Plane & Remote.com',
    summary_es: 'Ventajas de trabajar con plataformas EOR/Contractor Management que automatizan contratos, W-8BEN y múltiples vías de retiro en Bolivia.',
    summary_en: 'Benefits of EOR and contractor management platforms automating contracts, W-8BEN forms, and flexible withdrawal methods in Bolivia.',
    content_es: 'Cuando una empresa internacional contrata en Bolivia mediante Deel, Ontop, Plane o Remote.com, el proceso legal se simplifica notablemente: el contrato de servicios independientes y el W-8BEN se generan automáticamente en plataforma. Deel y Ontop destacan en Bolivia por permitir retirar el saldo USD hacia múltiples canales (Payoneer, billeteras USDC, cuentas locales o tarjetas internacionales) con comprobantes de ingresos útiles para respaldo financiero.',
    content_en: 'When global employers hire in Bolivia through Deel, Ontop, Plane, or Remote.com, contractor agreements and W-8BEN filings are automated. Deel and Ontop stand out in Bolivia for flexible USD withdrawal channels (Payoneer, USDC, bank rails) and downloadable income statements.',
    tags: 'deel, ontop, plane, remote.com, eor, contrato, nomina, payroll, bolivia, w-8ben'
  },
  {
    playbook_id: 'pb_tipalti_swift_usd',
    category: 'payout_rails',
    title_es: 'Tipalti y transferencias SWIFT USD a bancos bolivianos',
    title_en: 'Tipalti & Direct SWIFT USD Wires to Bolivian Banks',
    summary_es: 'Cómo configurar Tipalti en empresas de IA/localización y qué costos ocultos evaluar antes de usar transferencia bancaria SWIFT directa.',
    summary_en: 'Setting up Tipalti for AI/localization vendors and evaluating intermediary fees and FX spreads on direct SWIFT wires.',
    content_es: 'Empresas como TELUS Digital y Welocalize utilizan Tipalti o Hyperwallet para pagos globales. Durante el registro selecciona Payoneer o método de menor comisión si está habilitado en tu perfil. Si el único método disponible es transferencia bancaria SWIFT directa a un banco boliviano, considera dos factores: bancos corresponsales suelen descontar entre $25 y $60 por giro y varios bancos locales abonan al tipo de cambio oficial o aplican comisiones de retiro en efectivo USD. Cuando el monto mensual es menor a $1,000, agrupa ciclos o solicita una pasarela digital.',
    content_en: 'Vendors like TELUS Digital and Welocalize rely on Tipalti or Hyperwallet. Prefer digital rails (such as Payoneer) when enabled. For direct SWIFT wires to Bolivian banks, account for $25-$60 correspondent fees and local USD settlement spreads; consolidate smaller payouts when possible.',
    tags: 'tipalti, hyperwallet, swift, banco, wire, comisiones, telus, welocalize, usd'
  },
  {
    playbook_id: 'pb_utc4_overlap',
    category: 'timezone_strategy',
    title_es: 'Ventaja horaria de Bolivia (UTC-4 fijo sin cambio de horario)',
    title_en: 'Bolivia Timezone Advantage (Fixed UTC-4 Year-Round, No DST)',
    summary_es: 'Tabla exacta de solapamiento desde America/La_Paz (UTC-4) con EE. UU. (EST/EDT, CST, PST) y Europa (CET/CEST) durante todo el año.',
    summary_en: 'Exact working-hour overlap windows from America/La_Paz (UTC-4, zero DST shifts) with US and European teams year-round.',
    content_es: 'Bolivia (America/La_Paz, UTC-4) no aplica horario de verano (DST), lo que otorga una ventaja competitiva enorme para roles remotos: 1) Con US Eastern (EDT, marzo-noviembre): 0 horas de diferencia (misma hora exacta). 2) Con US Eastern (EST, noviembre-marzo): solo +1 hora delante de Nueva York/Miami. 3) Con US Central (CST/CDT): +1 a +2 horas. 4) Con Europa Central (CET/CEST): 5 a 6 horas de diferencia, logrando 4 a 5 horas de solapamiento limpio en la mañana boliviana (08:00-13:00 BOT). Destaca esta coincidencia directa en tus postulaciones.',
    content_en: 'Bolivia (America/La_Paz, UTC-4) observes no daylight saving shifts year-round: 0h difference with US EDT (Mar-Nov), +1h ahead of US EST (Nov-Mar), +1h/+2h ahead of US Central, and a clean 4-5h morning overlap (08:00-13:00 BOT) with European CET/CEST teams.',
    tags: 'utc-4, horario, timezone, est, edt, cst, pst, cet, europa, americas, latam, solapamiento, overlap'
  },
  {
    playbook_id: 'pb_ats_geo_survival',
    category: 'application_strategy',
    title_es: 'Cómo superar filtros ATS (Greenhouse/Lever/Workday) desde Bolivia',
    title_en: 'Passing ATS Geo-Filters (Greenhouse/Lever/Workday) from Bolivia',
    summary_es: 'Cómo responder preguntas de autorización laboral y ubicación para evitar rechazos automáticos cuando postulas como contratista internacional.',
    summary_en: 'How to answer work-authorization and location questions without triggering auto-rejections when applying as an international contractor.',
    content_es: 'Muchos portales ATS (Greenhouse, Lever, Ashby, Workday) tienen preguntas diseñadas por defecto para empleados W-2 en EE. UU. Antes de postular, verifica que la oferta mencione "Worldwide", "LATAM", "Americas" o "Remote Contractor". En tu CV coloca en el encabezado: "Bolivia (UTC-4 · US Eastern Alignment) | Independent International Contractor (W-8BEN)". Si un formulario pregunta por sponsorship de visa para un rol global remoto, recuerda que los contratistas internacionales NO requieren sponsorship de visa estadounidense.',
    content_en: 'Many ATS forms (Greenhouse, Lever, Ashby) default to US W-2 phrasing. Confirm the posting accepts Worldwide, LATAM, Americas, or International Contractors, and place "Bolivia (UTC-4 · US Eastern Overlap) | International Contractor (W-8BEN)" in your CV header. Remote international contractors do not require US visa sponsorship.',
    tags: 'ats, greenhouse, lever, workday, visa, sponsorship, w-2, cv, postulacion, filtros, rechazo'
  },
  {
    playbook_id: 'pb_rlhf_track_b_guide',
    category: 'category_strategy',
    title_es: 'Guía de ingreso a plataformas RLHF y Evaluación de IA (Track B)',
    title_en: 'Onboarding Strategy for RLHF & AI Evaluation Platforms (Track B)',
    summary_es: 'Cómo aprobar exámenes de calificación en Outlier, Alignerr, Mercor y Mindrift y acceder a tarifas especializadas de $25-$80+/hr.',
    summary_en: 'How to pass qualification assessments on Outlier, Alignerr, Mercor, and Mindrift to unlock $25-$80+/hr specialist rates.',
    content_es: 'Las plataformas de entrenamiento de IA (Track B) pagan tarifas sustancialmente mayores a especialistas de dominio (programación, cloud, matemáticas, finanzas, medicina, derecho o español técnico) que a evaluadores generalistas. Al registrarte: 1) Etiqueta explícitamente tus especialidades técnicas y bilingües. 2) Lee la rúbrica oficial completa antes de enviar cada prueba de calificación. 3) Nunca pegues respuestas generadas por otro LLM durante el examen (detectores de telemetría descalifican la cuenta de inmediato). 4) Diversifica en al menos 2-3 plataformas para compensar pausas entre proyectos.',
    content_en: 'Track B AI evaluation platforms pay far higher rates to domain specialists (coding, cloud, STEM, finance, legal, technical Spanish) than generalists. Tag domain skills on signup, follow rubrics verbatim, never paste external LLM output during assessments, and diversify across 2-3 platforms.',
    tags: 'rlhf, ia, ai trainer, outlier, alignerr, mercor, dataannotation, mindrift, evaluador, prompt, track b'
  },
  {
    playbook_id: 'pb_bilingual_ops_va',
    category: 'category_strategy',
    title_es: 'Estrategia para Asistencia Virtual, Soporte y Operaciones Bilingües',
    title_en: 'Strategy for Bilingual Virtual Assistant, Support & Ops Roles',
    summary_es: 'Qué portafolio breve, pruebas de audio y herramientas (CRM, Notion, Zendesk, HubSpot) multiplican entrevistas desde Bolivia.',
    summary_en: 'Short portfolio assets, audio intros, and SaaS tools (CRM, Notion, Zendesk, HubSpot) that double interview conversion from Bolivia.',
    content_es: 'En roles bilingües de Asistencia Virtual, Customer Support, Operations Coordinator y SDR (Virtual Latinos, HireLatam, Torre), los reclutadores priorizan dos pruebas concretas: 1) Fluidez comunicativa demostrable mediante un video/audio breve de 60 segundos en inglés y español claro. 2) Manejo operativo de herramientas estándar (HubSpot, Zendesk, Intercom, Notion, Asana, Slack, Google Workspace/Excel). Resalta métricas como tiempo de respuesta (SLA), satisfacción CSAT, agendas gestionadas o leads calificados.',
    content_en: 'For bilingual VA, Customer Support, Operations, and SDR roles, recruiters look for a clear 60-second bilingual audio/video intro and operational fluency in HubSpot, Zendesk, Intercom, Notion, Asana, Slack, and spreadsheets. Highlight SLA, CSAT, and measurable workflow metrics.',
    tags: 'asistente virtual, virtual assistant, soporte, customer support, operaciones, sdr, ventas, hubspot, zendesk, bilingue'
  },
  {
    playbook_id: 'pb_tech_interviews_latam',
    category: 'category_strategy',
    title_es: 'Entrevistas técnicas y pruebas asíncronas para roles Tech/Cloud/Data',
    title_en: 'Technical & Async Take-Home Interviews for Tech, Cloud & Data Roles',
    summary_es: 'Buenas prácticas para pruebas de código, diseño de sistemas y repositorios públicos que destacan talento boliviano en el mercado global.',
    summary_en: 'Best practices for coding challenges, system design, and public repos helping Bolivian engineers stand out globally.',
    content_es: 'Para vacantes remotas en Desarrollo de Software, Cloud/DevOps, Datos y Ciberseguridad (GetOnBoard, Revelo, Toptal, GitLab, Canonical), combina código limpio con documentación asíncrona clara. En pruebas take-home incluye siempre un README con decisiones de arquitectura, instrucciones reproducibles y pruebas automatizadas. Practica explicar tus soluciones técnicas en inglés claro enfocándote en trade-offs, observabilidad, seguridad y costos.',
    content_en: 'For remote Software, Cloud/DevOps, Data, and Security roles, pair clean implementation with strong async documentation. Include architecture trade-offs, reproducible run instructions, and automated tests in take-home projects, and practice concise English explanations.',
    tags: 'software, developer, devops, cloud, data, sql, python, aws, azure, entrevista, tecnica, github, portfolio'
  },
  {
    playbook_id: 'pb_upskilling_bridges',
    category: 'upskilling',
    title_es: 'Puentes gratuitos de capacitación en Inglés, IA y Tecnología',
    title_en: 'Free High-Impact Upskilling Bridges in English, AI & Tech',
    summary_es: 'Recursos abiertos y gratuitos (Minka Lab, Language Transfer, freeCodeCamp) para elevar elegibilidad salarial en dólares desde Bolivia.',
    summary_en: 'Open free resources (Minka Lab, Language Transfer, freeCodeCamp) to unlock higher USD remote compensation bands from Bolivia.',
    content_es: 'El salto de ingresos más grande para profesionales remotos en Bolivia proviene de combinar una habilidad digital verificable con inglés funcional B2+. Recursos gratuitos recomendados: 1) Minka Lab (minkalab.net): formación enfocada en competencias digitales, IA aplicada e idiomas para talento boliviano. 2) Language Transfer (languagetransfer.org): curso de audio gratuito para acelerar fluidez hablada en inglés. 3) freeCodeCamp y roadmap.sh: rutas prácticas con proyectos de portafolio en SQL, Python, desarrollo web, DevOps y análisis de datos.',
    content_en: 'The highest USD compensation jump from Bolivia comes from pairing a verifiable digital skill with B2+ English. Recommended free bridges: Minka Lab (minkalab.net) for digital/AI/language skills, Language Transfer for spoken English fluency, and freeCodeCamp / roadmap.sh for hands-on SQL, Python, web, and DevOps portfolios.',
    tags: 'capacitacion, cursos, gratis, ingles, english, minkalab, language transfer, freecodecamp, upskilling, aprender'
  }
];

/**
 * Generates default track-level intelligence for any of the 86 monitored platforms
 * that does not have a custom override in PLATFORM_CURATED_INTEL.
 */
function inferPlatformDefaults(platform) {
  const track = String(platform.track || '').toLowerCase();
  const notes = String(platform.notes || '');
  const id = String(platform.id || '');

  if (track.includes('track b') || track.includes('ai evaluation') || track.includes('rlhf')) {
    return {
      tier: 'verified_friendly',
      confidence: 0.82,
      rails: ['rail:payoneer', 'rail:airtm_usdc'],
      eors: ['eor:direct_w8ben'],
      assessment: 'Async AI Rubric / Domain Qualification',
      comp: '$15-$45/hr USD',
      note_es: notes || 'Plataforma de evaluación de IA y entrenamiento asíncrono compatible con contratistas en Bolivia.',
      note_en: notes || 'Async AI training and evaluation platform compatible with contractors in Bolivia.'
    };
  }
  if (track.includes('track c') || track.includes('nearshore') || track.includes('latam')) {
    return {
      tier: 'verified_friendly',
      confidence: 0.85,
      rails: ['rail:deel_withdrawal', 'rail:payoneer'],
      eors: ['eor:deel', 'eor:direct_w8ben'],
      assessment: 'Bilingual & Technical Vetting',
      comp: '$1,500-$6,000/mo USD',
      note_es: notes || 'Red nearshore/global orientada a talento latinoamericano con pagos en USD.',
      note_en: notes || 'Nearshore/global vetted talent network serving LATAM professionals in USD.'
    };
  }
  if (track.includes('track a') || track.includes('b2b') || track.includes('freelance')) {
    return {
      tier: 'verified_friendly',
      confidence: 0.84,
      rails: ['rail:payoneer', 'rail:airtm_usdc'],
      eors: ['eor:direct_w8ben'],
      assessment: 'Client Proposal & Portfolio Screening',
      comp: '$15-$65/hr USD',
      note_es: notes || 'Portal de contratación directa B2B o proyectos freelance con facturación independiente.',
      note_en: notes || 'Direct B2B or freelance project marketplace supporting independent contractor invoicing.'
    };
  }
  if (track.includes('track e') || track.includes('expert')) {
    return {
      tier: 'open_global',
      confidence: 0.8,
      rails: ['rail:payoneer', 'rail:swift_usd'],
      eors: ['eor:direct_w8ben'],
      assessment: 'Senior Industry Profile Verification',
      comp: '$60-$250/hr USD (consultas puntuales)',
      note_es: notes || 'Red de expertos para consultorías remuneradas por hora o proyectos especializados.',
      note_en: notes || 'Expert network for paid hourly advisory calls and specialist engagements.'
    };
  }
  return {
    tier: 'open_global',
    confidence: 0.78,
    rails: ['rail:deel_withdrawal', 'rail:payoneer'],
    eors: ['eor:direct_w8ben', 'eor:deel'],
    assessment: 'Direct Employer Application & Screening',
    comp: '',
    note_es: notes || `Bolsa de empleo remoto monitoreada (${platform.name || id}); validar método de pago en USD durante la entrevista.`,
    note_en: notes || `Monitored remote job board (${platform.name || id}); confirm USD contractor payout rail during interviews.`
  };
}

/**
 * Builds the complete deterministic seed pack (entities + directed edges + 12 playbooks)
 * covering all 86 monitored platforms from INITIAL_PLATFORMS plus core remote employers.
 */
export function buildCareerIntelSeedPack() {
  const entities = [...CORE_INFRA_ENTITIES];
  const edges = [];
  const seenEntityIds = new Set(entities.map(e => e.entity_id));

  const addEdge = (sourceId, targetId, relation, weight, confidence, evidenceNote) => {
    edges.push({
      source_id: sourceId,
      target_id: targetId,
      relation,
      weight,
      confidence,
      evidence_note: evidenceNote || ''
    });
  };

  // 1. Seed all 86 monitored platforms from INITIAL_PLATFORMS
  for (const p of INITIAL_PLATFORMS) {
    const entityId = `platform:${p.id}`;
    const intel = PLATFORM_CURATED_INTEL[p.id] || inferPlatformDefaults(p);

    if (!seenEntityIds.has(entityId)) {
      seenEntityIds.add(entityId);
      entities.push({
        entity_id: entityId,
        entity_type: 'platform',
        canonical_name: p.name,
        domain: p.domain || '',
        bolivia_tier: intel.tier,
        confidence: intel.confidence,
        pagerank_score: PLATFORM_CURATED_INTEL[p.id] ? 0.78 : 0.55,
        attributes: {
          platform_id: p.id,
          track: p.track || '',
          contract_caveat: p.contract_caveat || '',
          assessment: intel.assessment || '',
          typical_comp: intel.comp || '',
          note_es: intel.note_es || '',
          note_en: intel.note_en || '',
          caution_es: intel.tier === 'caution_friction' ? intel.note_es : '',
          caution_en: intel.tier === 'caution_friction' ? intel.note_en : '',
          aliases: [normalizeCompanySlug(p.name, 'company')].filter(Boolean)
        }
      });
    }

    const bolRelation = intel.tier === 'caution_friction' ? 'GEO_FRICTION_BOLIVIA' : 'HIRES_IN_BOLIVIA';
    addEdge(entityId, 'geo:bolivia', bolRelation, intel.tier === 'verified_friendly' ? 1.0 : 0.75, intel.confidence, intel.note_es);

    for (const railId of (intel.rails || [])) {
      addEdge(entityId, railId, 'PAYS_VIA', 0.9, intel.confidence, `${p.name} soporta pagos compatibles con ${railId.replace('rail:', '')}.`);
    }
    for (const eorId of (intel.eors || [])) {
      addEdge(entityId, eorId, 'USES_EOR', 0.85, intel.confidence, `Modalidad contractual usual en ${p.name}.`);
    }
    if (intel.assessment) {
      addEdge(entityId, `assessment:${p.id}`, 'REQUIRES_ASSESSMENT', 0.8, intel.confidence, intel.assessment);
    }
    if (intel.comp) {
      addEdge(entityId, `comp:${p.id}`, 'TYPICAL_COMPENSATION', 0.8, intel.confidence, intel.comp);
    }
  }

  // 2. Seed major remote-first global employers
  for (const emp of MAJOR_REMOTE_EMPLOYERS) {
    if (!seenEntityIds.has(emp.entity_id)) {
      seenEntityIds.add(emp.entity_id);
      entities.push({
        entity_id: emp.entity_id,
        entity_type: 'company',
        canonical_name: emp.canonical_name,
        domain: emp.domain || '',
        bolivia_tier: emp.bolivia_tier,
        confidence: emp.confidence,
        pagerank_score: 0.84,
        attributes: {
          assessment: emp.assessment || '',
          typical_comp: emp.comp || '',
          note_es: emp.note_es || '',
          note_en: emp.note_en || '',
          caution_es: emp.bolivia_tier === 'caution_friction' ? emp.note_es : '',
          caution_en: emp.bolivia_tier === 'caution_friction' ? emp.note_en : ''
        }
      });
    }
    addEdge(emp.entity_id, 'geo:bolivia', 'HIRES_IN_BOLIVIA', 0.95, emp.confidence, emp.note_es);
    for (const railId of (emp.rails || [])) {
      addEdge(emp.entity_id, railId, 'PAYS_VIA', 0.92, emp.confidence, `${emp.canonical_name} liquida mediante ${railId.replace('rail:', '')}.`);
    }
    for (const eorId of (emp.eors || [])) {
      addEdge(emp.entity_id, eorId, 'USES_EOR', 0.88, emp.confidence, `Contratación internacional en ${emp.canonical_name}.`);
    }
    if (emp.assessment) {
      addEdge(emp.entity_id, `assessment:${emp.entity_id}`, 'REQUIRES_ASSESSMENT', 0.8, emp.confidence, emp.assessment);
    }
    if (emp.comp) {
      addEdge(emp.entity_id, `comp:${emp.entity_id}`, 'TYPICAL_COMPENSATION', 0.8, emp.confidence, emp.comp);
    }
  }

  // 3. Skill upskilling bridge edges
  addEdge('category:languages_translation', 'resource:language_transfer', 'UPSKILL_WITH', 0.9, 0.94, 'Refuerzo gratuito de inglés conversacional.');
  addEdge('category:ai_rlhf', 'resource:minkalab', 'UPSKILL_WITH', 0.95, 0.95, 'Competencias digitales e IA aplicada desde Bolivia.');
  addEdge('category:software', 'resource:freecodecamp', 'UPSKILL_WITH', 0.9, 0.94, 'Certificaciones prácticas en JavaScript, Python y SQL.');
  addEdge('category:data', 'resource:freecodecamp', 'UPSKILL_WITH', 0.9, 0.94, 'Rutas gratuitas de SQL y análisis de datos.');

  return {
    seed_version: CAREER_INTEL_SEED_VERSION,
    entities,
    edges,
    playbooks: BOLIVIA_CONTRACTOR_PLAYBOOKS
  };
}
