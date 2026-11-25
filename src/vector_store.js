/**
 * Vectorial Database & Multilingual Semantic Search Engine (Phase 3)
 * Supports 3-tier hybrid vector indexing and search:
 *   1. Cloudflare Vectorize (`env.VECTORIZE`) with `@cf/baai/bge-m3` (1024-dim multilingual embeddings)
 *   2. Raspberry Pi 5 Qdrant Edge Bridge (`env.QDRANT_URL`, e.g. edge-rag-hub Qdrant v1.12)
 *   3. Cross-Lingual Edge Semantic Vector Index (128-dim ES/EN/PT concept + n-gram vectors)
 *      for zero-latency local / standalone fallback.
 */

import {
  DEFAULT_FILTERS,
  evaluateAllOpportunities,
  checkBoliviaRemoteEligibility,
  detectOfferAttributes
} from './evaluator.js';
import { stripHtml, computeJobHash } from './scanner.js';
import { normalizeCompanySlug, parseDateToEpochSeconds } from './privacy_guard.js';

export const EMBEDDING_MODEL = '@cf/baai/bge-m3';
const LOCAL_DIM = 128;

/**
 * Normalizes text for accent-insensitive, case-insensitive search and embedding.
 * Strips HTML, lowercases, decomposes Unicode accents (áéíóúüñ -> aeiouun), and collapses whitespace.
 */
export function normalizeSearchText(rawText) {
  return stripHtml(rawText || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¡¿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SEARCH_STOP_WORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'en', 'con', 'para', 'por',
  'un', 'una', 'unos', 'unas', 'y', 'o', 'a', 'al', 'sin', 'sobre',
  'desde', 'como', 'que', 'se', 'su', 'sus', 'mi', 'tu', 'trabajo',
  'trabajos', 'empleo', 'empleos', 'busco', 'buscar', 'oferta', 'ofertas',
  'puesto', 'puestos', 'vacante', 'vacantes', 'rol', 'roles',
  'the', 'and', 'for', 'with', 'in', 'of', 'to', 'on', 'or', 'at',
  'by', 'from', 'as', 'an', 'is', 'are', 'job', 'jobs', 'role', 'position'
]);

const SHORT_DOMAIN_ACRONYMS = new Set([
  'ia', 'ai', 'ui', 'ux', 'qa', 'hr', 'it', 'bi', 'ml',
  'pm', 'po', 'ti', 'va', 'go', 'js', 'ts', 'c#', 'db', '3d'
]);

/**
 * Cross-lingual ES <-> EN synonym expansion map (all keys and values accent-stripped).
 * Broadens semantic search so Spanish, English, colloquial, and adjacent role terms connect naturally.
 */
export const CROSS_LINGUAL_SYNONYMS = {
  asistente: ['assistant', 'virtual', 'admin', 'administrative', 'executive', 'backoffice', 'secretary'],
  secretaria: ['assistant', 'administrative', 'executive', 'office', 'scheduling'],
  secretario: ['assistant', 'administrative', 'executive', 'office', 'scheduling'],
  administrativo: ['administrative', 'admin', 'operations', 'backoffice', 'office', 'assistant'],
  administracion: ['administration', 'administrative', 'operations', 'management', 'office'],
  digitador: ['data entry', 'typing', 'administrative', 'backoffice'],
  soporte: ['support', 'customer', 'helpdesk', 'service', 'technical', 'tickets', 'chat'],
  atencion: ['customer', 'support', 'service', 'client', 'helpdesk', 'success', 'call center'],
  cliente: ['customer', 'client', 'support', 'service', 'success', 'account'],
  clientes: ['customer', 'client', 'support', 'service', 'success', 'account'],
  servicio: ['service', 'customer', 'support', 'client'],
  ventas: ['sales', 'sdr', 'bdr', 'account', 'business development', 'closer', 'crm', 'outbound'],
  vendedor: ['sales', 'sdr', 'bdr', 'account executive', 'commercial', 'closer'],
  comercial: ['sales', 'commercial', 'business development', 'account', 'crm'],
  prospeccion: ['outbound', 'lead generation', 'sdr', 'bdr', 'sales'],
  mercadeo: ['marketing', 'digital', 'seo', 'sem', 'social media', 'growth', 'ads'],
  publicidad: ['marketing', 'advertising', 'ads', 'meta ads', 'google ads', 'media'],
  redes: ['social media', 'community', 'network', 'networking', 'marketing'],
  contenido: ['content', 'copywriter', 'writing', 'social media', 'marketing'],
  redactor: ['copywriter', 'writer', 'content', 'copywriting', 'editorial'],
  redaccion: ['copywriting', 'writing', 'content', 'copywriter', 'technical writer'],
  escritor: ['writer', 'copywriter', 'content', 'editorial'],
  comunicacion: ['communications', 'marketing', 'content', 'pr', 'community'],
  reclutador: ['recruiter', 'recruiting', 'talent', 'hr', 'sourcer', 'human resources'],
  reclutamiento: ['recruiting', 'recruitment', 'talent acquisition', 'hr', 'hiring'],
  rrhh: ['hr', 'human resources', 'people ops', 'recruiting', 'talent'],
  talento: ['talent', 'recruiting', 'hr', 'people'],
  finanzas: ['finance', 'financial', 'accounting', 'fp&a', 'analyst', 'treasury'],
  financiero: ['financial', 'finance', 'accounting', 'analyst', 'banking'],
  contabilidad: ['accounting', 'bookkeeping', 'accountant', 'finance', 'quickbooks', 'payroll', 'tax'],
  contador: ['accountant', 'accounting', 'bookkeeper', 'finance', 'quickbooks', 'cpa'],
  contable: ['accounting', 'bookkeeping', 'accountant', 'finance', 'payroll'],
  nomina: ['payroll', 'accounting', 'hr', 'finance', 'billing'],
  impuestos: ['tax', 'accounting', 'finance', 'audit'],
  facturacion: ['billing', 'invoicing', 'accounting', 'medical billing', 'finance'],
  banca: ['banking', 'fintech', 'finance', 'insurance'],
  seguros: ['insurance', 'banking', 'finance', 'claims'],
  diseno: ['design', 'designer', 'ui', 'ux', 'graphic', 'figma', 'canva', 'creative'],
  disenador: ['designer', 'design', 'ui', 'ux', 'graphic', 'figma', 'visual'],
  grafico: ['graphic', 'design', 'designer', 'visual', 'illustrator', 'photoshop', 'canva'],
  video: ['video editor', 'editing', 'motion graphics', 'audiovisual', 'premiere'],
  edicion: ['editing', 'editor', 'video', 'content', 'postproduction'],
  animacion: ['animation', 'motion graphics', '3d', 'design', 'video'],
  ia: ['ai', 'artificial intelligence', 'llm', 'ml', 'rlhf', 'prompt', 'machine learning', 'trainer'],
  ai: ['ia', 'artificial intelligence', 'llm', 'ml', 'rlhf', 'prompt', 'machine learning', 'trainer'],
  inteligencia: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'bi'],
  entrenamiento: ['trainer', 'training', 'rlhf', 'ai', 'annotator', 'evaluator'],
  anotacion: ['annotation', 'annotator', 'data labeling', 'ai trainer', 'rlhf'],
  programador: ['developer', 'software', 'engineer', 'programmer', 'fullstack', 'backend', 'frontend'],
  programacion: ['programming', 'software', 'developer', 'coding', 'engineer'],
  desarrollador: ['developer', 'software', 'engineer', 'programmer', 'fullstack', 'frontend', 'backend', 'web'],
  desarrollo: ['development', 'developer', 'software', 'engineer', 'web', 'mobile'],
  ingeniero: ['engineer', 'engineering', 'developer', 'architect', 'software', 'cloud', 'data'],
  ingenieria: ['engineering', 'engineer', 'software', 'cloud', 'data', 'systems'],
  sistemas: ['systems', 'software', 'it', 'sysadmin', 'infrastructure', 'engineer', 'developer'],
  informatica: ['it', 'computer science', 'software', 'systems', 'technology', 'developer'],
  tecnologia: ['tech', 'technology', 'it', 'software', 'systems', 'engineering'],
  ti: ['it', 'tech', 'systems', 'support', 'infrastructure', 'sysadmin'],
  it: ['ti', 'tech', 'systems', 'support', 'infrastructure', 'sysadmin'],
  movil: ['mobile', 'ios', 'android', 'flutter', 'react native'],
  nube: ['cloud', 'aws', 'azure', 'gcp', 'devops', 'infrastructure', 'sre'],
  infraestructura: ['infrastructure', 'cloud', 'devops', 'sre', 'sysadmin', 'linux', 'network'],
  servidores: ['servers', 'linux', 'sysadmin', 'cloud', 'devops', 'infrastructure'],
  datos: ['data', 'analytics', 'analyst', 'sql', 'bi', 'machine learning', 'etl', 'python'],
  analista: ['analyst', 'analytics', 'data', 'bi', 'business', 'sql', 'excel'],
  analisis: ['analytics', 'analysis', 'analyst', 'data', 'bi', 'reporting'],
  estadistica: ['statistics', 'data science', 'analytics', 'data', 'ml'],
  traductor: ['translator', 'translation', 'bilingual', 'localization', 'interpreter', 'spanish'],
  traduccion: ['translation', 'translator', 'localization', 'bilingual', 'interpreter'],
  interprete: ['interpreter', 'interpretation', 'bilingual', 'spanish', 'english'],
  interpretacion: ['interpretation', 'interpreter', 'bilingual', 'translation'],
  transcripcion: ['transcription', 'transcriber', 'subtitling', 'audio', 'translation'],
  idiomas: ['languages', 'bilingual', 'translation', 'interpreter', 'esl', 'tutor'],
  bilingue: ['bilingual', 'spanish', 'english', 'translator', 'interpreter', 'support'],
  espanol: ['spanish', 'bilingual', 'latam', 'esl'],
  ingles: ['english', 'bilingual', 'esl'],
  seguridad: ['security', 'cybersecurity', 'infosec', 'soc', 'pentest', 'devsecops'],
  ciberseguridad: ['cybersecurity', 'security', 'infosec', 'soc', 'pentest', 'audit'],
  pruebas: ['testing', 'qa', 'quality assurance', 'tester', 'automation'],
  calidad: ['quality', 'qa', 'testing', 'tester', 'assurance'],
  automatizacion: ['automation', 'qa', 'devops', 'python', 'rpa', 'workflows'],
  proyectos: ['project', 'project manager', 'pm', 'scrum', 'agile', 'coordinator', 'pmo'],
  coordinador: ['coordinator', 'project', 'operations', 'manager', 'admin'],
  operaciones: ['operations', 'ops', 'coordinator', 'logistics', 'project', 'admin'],
  gestion: ['management', 'manager', 'project', 'operations', 'product', 'coordinator'],
  producto: ['product', 'product manager', 'product owner', 'pm', 'roadmap'],
  gerente: ['manager', 'director', 'head', 'lead', 'management'],
  lider: ['lead', 'manager', 'principal', 'senior', 'head'],
  consultor: ['consultant', 'consulting', 'advisor', 'specialist', 'expert'],
  abogado: ['lawyer', 'legal', 'attorney', 'counsel', 'compliance', 'contracts'],
  abogada: ['lawyer', 'legal', 'attorney', 'counsel', 'compliance', 'contracts'],
  derecho: ['legal', 'law', 'lawyer', 'paralegal', 'compliance', 'contracts'],
  juridico: ['legal', 'law', 'lawyer', 'paralegal', 'compliance', 'contracts'],
  cumplimiento: ['compliance', 'legal', 'regulatory', 'audit', 'risk'],
  salud: ['healthcare', 'health', 'medical', 'clinical', 'telemedicine', 'nurse'],
  medico: ['medical', 'doctor', 'healthcare', 'clinical', 'telemedicine', 'billing'],
  medica: ['medical', 'doctor', 'healthcare', 'clinical', 'telemedicine', 'billing'],
  enfermeria: ['nurse', 'nursing', 'healthcare', 'medical', 'clinical'],
  profesor: ['teacher', 'tutor', 'instructor', 'education', 'teaching', 'esl'],
  profesora: ['teacher', 'tutor', 'instructor', 'education', 'teaching', 'esl'],
  docente: ['teacher', 'instructor', 'educator', 'education', 'tutor', 'teaching'],
  maestro: ['teacher', 'tutor', 'education', 'instructor', 'teaching'],
  educacion: ['education', 'teaching', 'teacher', 'tutor', 'elearning', 'instructional'],
  tutor: ['tutor', 'teacher', 'education', 'teaching', 'esl', 'mentor'],
  clases: ['teaching', 'tutor', 'teacher', 'education', 'esl', 'instructor'],
  logistica: ['logistics', 'supply chain', 'operations', 'ecommerce', 'inventory'],
  comercio: ['ecommerce', 'commerce', 'retail', 'shopify', 'amazon', 'sales'],
  tienda: ['ecommerce', 'shopify', 'woocommerce', 'amazon', 'store'],
  arquitectura: ['architecture', 'architect', 'cad', 'revit', 'bim', 'civil', 'cloud'],
  arquitecto: ['architect', 'architecture', 'cloud', 'cad', 'revit', 'bim', 'senior'],
  planos: ['cad', 'autocad', 'revit', 'bim', 'architecture', 'drafting'],
  remoto: ['remote', 'worldwide', 'latam', 'anywhere', 'work from anywhere'],
  pasante: ['intern', 'internship', 'trainee', 'junior', 'entry level'],
  practicante: ['intern', 'internship', 'trainee', 'junior', 'entry level'],
  developer: ['desarrollador', 'programador', 'software', 'engineer'],
  engineer: ['ingeniero', 'developer', 'software', 'architect'],
  designer: ['disenador', 'diseno', 'ui', 'ux', 'graphic'],
  support: ['soporte', 'atencion', 'customer', 'helpdesk', 'service'],
  sales: ['ventas', 'vendedor', 'comercial', 'sdr', 'bdr', 'account'],
  accountant: ['contador', 'contabilidad', 'finanzas', 'bookkeeper', 'finance'],
  assistant: ['asistente', 'administrativo', 'virtual', 'secretaria'],
  translator: ['traductor', 'traduccion', 'bilingual', 'interpreter', 'spanish'],
  teacher: ['profesor', 'docente', 'tutor', 'educacion', 'esl'],
  lawyer: ['abogado', 'legal', 'paralegal', 'compliance', 'contracts']
};

/**
 * Cross-lingual concept clusters mapping Spanish and English terms (accent-stripped)
 * to shared semantic dimensions (indices 0..27 of the 128-dim local vector).
 */
const SEMANTIC_CONCEPT_CLUSTERS = [
  // 0: Virtual Assistant & Executive Admin
  /\b(asistente|virtual\s+assistant|executive\s+assistant|secretari[oa]?|administrativ[oa]?|administracion|admin\s+support|calendar|scheduling|agenda|data\s+entry|back\s*office|digitador|recepcion|oficina|va)\b/gi,
  // 1: Project, Product & Operations Coordination
  /\b(project\s+manager|gestion\s+de\s+proyectos|proyectos|operations|operaciones|coordinador[a]?|coordinacion|coordinator|scrum|agile|pmo|notion|asana|jira|clickup|product\s+manager|product\s+owner|producto|pm|po)\b/gi,
  // 2: Customer Support & Success
  /\b(customer\s+support|atencion\s+al\s+cliente|atencion|soporte\s+al\s+cliente|soporte|servicio\s+al\s+cliente|customer\s+service|customer\s+success|onboarding|help\s*desk|chat\s+support|zendesk|intercom|call\s+center|contact\s+center|mesa\s+de\s+ayuda|tickets)\b/gi,
  // 3: Sales, SDR, BDR & Account Management
  /\b(sales|venta|ventas|vendedor[a]?|comercial|sdr|bdr|account\s+executive|ejecutivo\s+de\s+cuentas|business\s+development|desarrollo\s+de\s+negocios|outbound|inbound|closing|closer|prospeccion|hubspot|salesforce|crm|lead\s+generation|telemarketing)\b/gi,
  // 4: Digital Marketing, SEO, Content & Social Media
  /\b(marketing|mercadeo|publicidad|seo|sem|social\s+media|redes\s+sociales|community\s+manager|copywriter|copywriting|content|contenid[oa]s?|redactor[a]?|redaccion|escritor[a]?|writer|google\s+ads|meta\s+ads|email\s+marketing|growth|comunicacion|periodista)\b/gi,
  // 5: HR, Talent Acquisition & Recruiting
  /\b(recruiter|recruiting|reclutador[a]?|reclutamiento|seleccion|recursos\s+humanos|rrhh|human\s+resources|talent\s+acquisition|talento|sourcer|hr|people\s+ops|headhunter|psicolog[oa]?)\b/gi,
  // 6: Finance, Accounting, Banking & Bookkeeping
  /\b(finance|finanzas|financier[oa]|accounting|contabilidad|contador[a]?|contable|accountant|bookkeeper|bookkeeping|quickbooks|xero|excel|payroll|nomina|auditor[a]?|auditoria|impuestos|tax|fp&a|facturacion|billing|tesoreria|banca|fintech|seguros|insurance)\b/gi,
  // 7: Design, UI/UX & Video Editing
  /\b(design|diseno|disenador[a]?|designer|grafic[oa]|graphic|ui|ux|figma|canva|photoshop|illustrator|adobe|video\s+editor|editor\s+de\s+video|edicion\s+de\s+video|motion\s+graphics|audiovisual|animacion|3d|branding|ilustrador[a]?)\b/gi,
  // 8: AI Training, RLHF & Data Annotation
  /\b(ai\s+trainer|entrenamiento\s+ia|inteligencia\s+artificial|ia|ai|rlhf|llm|prompt|annotator|anotacion|anotador[a]?|data\s+labeling|etiquetado|evaluador\s+ia|rater|search\s+quality|genai|openai|claude|gemini)\b/gi,
  // 9: Software Engineering (Frontend / Backend / Fullstack / Mobile)
  /\b(software|engineer|ingenier[oa]|developer|desarrollador[a]?|desarrollo|programador[a]?|programacion|coding|fullstack|full-stack|frontend|front-end|backend|back-end|web\s+developer|web|mobile|movil|ios|android|flutter|sistemas|informatica|tecnologia|it|ti)\b/gi,
  // 10: JavaScript / TypeScript / React / Node Ecosystem
  /\b(javascript|js|typescript|ts|react|nextjs|next\.js|nodejs|node\.js|vue|angular|svelte|express|nestjs|graphql|html|css|tailwind|wordpress)\b/gi,
  // 11: Python / Backend / APIs
  /\b(python|django|fastapi|flask|golang|go|rust|java|spring|c#|csharp|dotnet|\.net|php|laravel|ruby|rails|c\+\+|api|apis|microservicios|microservices)\b/gi,
  // 12: Cloud, DevOps, SRE & Infrastructure
  /\b(cloud|nube|devops|sre|aws|azure|gcp|cloudflare|kubernetes|k8s|docker|terraform|ansible|linux|ci\/cd|sysadmin|infrastructure|infraestructura|noc|network|redes|servidores)\b/gi,
  // 13: Data Science, Analytics, BI & Machine Learning
  /\b(data\s+analyst|analista\s+de\s+datos|datos|data|data\s+engineer|ingeniero\s+de\s+datos|data\s+scientist|cientific[oa]\s+de\s+datos|analytics|analitica|analisis|estadistica|sql|power\s*bi|powerbi|tableau|looker|snowflake|dbt|spark|etl|bi|machine\s+learning|ml)\b/gi,
  // 14: Translation, Interpretation & Localization
  /\b(translator|traductor[a]?|traduccion|translation|interpreter|interprete|interpretacion|localization|localizacion|subtitling|subtitulaje|transcription|transcripcion|transcriptor[a]?|bilingual|bilingue|espanol|spanish|ingles|english|idiomas|languages)\b/gi,
  // 15: Cybersecurity & InfoSec
  /\b(security|seguridad|cybersecurity|ciberseguridad|infosec|pentest|soc|vulnerability|vulnerabilidades|iam|devsecops|siem|firewall)\b/gi,
  // 16: QA & Testing
  /\b(qa|quality\s+assurance|calidad|tester|testing|pruebas|automation|automatizacion|cypress|playwright|selenium)\b/gi,
  // 17: E-commerce, Shopify & Logistics
  /\b(shopify|woocommerce|ecommerce|e-commerce|comercio\s+electronico|tienda\s+online|amazon|mercado\s*libre|dropshipping|catalog|catalogo|logistics|logistica|supply\s+chain|inventario|procurement)\b/gi,
  // 18: Legal, Compliance & Contracts
  /\b(legal|abogad[oa]|derecho|juridic[oa]|paralegal|compliance|cumplimiento|contrat[oa]s?|contracts|regulatorio|privacidad|gdpr)\b/gi,
  // 19: Healthcare, Telemedicine & Medical Billing
  /\b(salud|health|healthcare|medic[oa]|doctor[a]?|enfermer[oaia]+|nurse|clinical|clinic[oa]|telemedicina|telemedicine|medical\s+billing|facturacion\s+medica|farmacia|pharma)\b/gi,
  // 20: Education, Teaching & Tutoring
  /\b(educacion|education|profesor[a]?|docente|maestr[oa]|teacher|teaching|tutor[a]?|tutoria|instructor[a]?|capacitacion|training|esl|clases|e-learning|instruccional)\b/gi,
  // 21: Architecture, Civil Engineering & CAD
  /\b(arquitectura|arquitect[oa]|architecture|civil|autocad|cad|revit|bim|planos|construccion|construction|estructural)\b/gi,
  // 22: Senior / Lead Experience
  /\b(senior|sr\.?|lead|lider|principal|staff|architect|arquitect[oa]|director[a]?|head\s+of|manager|gerente|jefe|especialista|consultor[a]?|consultant)\b/gi,
  // 23: Entry / Junior Experience
  /\b(junior|jr\.?|entry\s*level|trainee|pasante|pasantia|intern|internship|sin\s+experiencia|inicial|principiante|assistant|associate|auxiliar|practicante)\b/gi,
  // 24: Part-Time / Flexible / Hourly
  /\b(part-time|part\s+time|medio\s+tiempo|freelance|independiente|por\s+horas|hourly|flexible|async|asincrono|fractional|contractor)\b/gi,
  // 25: Full-Time Dedicated
  /\b(full-time|full\s+time|tiempo\s+completo|dedicado|dedicated|40\s*h|permanente)\b/gi,
  // 26: Bolivia / LATAM / South America / UTC-4
  /\b(bolivia|latam|latin\s+america|latinoamerica|america\s+latina|south\s+america|sudamerica|utc-4|est|americas)\b/gi,
  // 27: Worldwide / Work From Anywhere
  /\b(worldwide|global|anywhere|work\s+from\s+anywhere|wfa|100%\s+remote|remoto|remote|teletrabajo)\b/gi
];

const CLUSTER_DIM_COUNT = SEMANTIC_CONCEPT_CLUSTERS.length;

/**
 * Extracts normalized tokens suitable for forgiving lexical/fuzzy search.
 */
export function extractQueryTokens(normalizedText) {
  const rawTokens = normalizedText
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const filtered = rawTokens.filter(
    t => (t.length >= 3 || SHORT_DOMAIN_ACRONYMS.has(t)) && !SEARCH_STOP_WORDS.has(t)
  );
  if (filtered.length > 0) return Array.from(new Set(filtered));
  return Array.from(new Set(rawTokens.filter(t => t.length >= 2)));
}

/**
 * Expands a normalized query with cross-lingual ES <-> EN synonyms for broader recall.
 */
export function expandQueryTerms(tokens) {
  const expanded = new Set();
  for (const tok of tokens) {
    if (CROSS_LINGUAL_SYNONYMS[tok]) {
      for (const syn of CROSS_LINGUAL_SYNONYMS[tok]) {
        expanded.add(syn);
      }
    }
    // Stem-based synonym lookup for plurals / feminine / verb inflections (e.g. "disenadores" -> "disenador")
    if (tok.length >= 5) {
      for (const [key, syns] of Object.entries(CROSS_LINGUAL_SYNONYMS)) {
        if (key.length >= 5 && (tok.startsWith(key) || key.startsWith(tok.slice(0, 6)))) {
          for (const syn of syns) {
            expanded.add(syn);
          }
        }
      }
    }
  }
  return Array.from(expanded);
}

/**
 * Fast bounded Levenshtein distance (returns maxDist + 1 if distance exceeds maxDist).
 */
function boundedLevenshtein(a, b, maxDist) {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDist) return maxDist + 1;
  if (a === b) return 0;

  let prev = new Array(lb + 1);
  let curr = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const val = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[lb];
}

/**
 * Forgiving single-term match score in [0, 1] against a normalized opportunity text blob & token list.
 * Supports exact substring, stem prefix, and minor typo tolerance (Levenshtein 1-2).
 */
export function scoreForgivingTermMatch(term, normalizedBlob, blobTokens) {
  if (!term) return 0;
  if (normalizedBlob.includes(term)) return 1.0;

  // Stem prefix match for morphological/plural/cognate variants (e.g. "contabilidad" <-> "contable", "programadores" <-> "programador")
  if (term.length >= 5) {
    const stemLen = Math.min(term.length - 1, 5);
    const stem = term.slice(0, stemLen);
    for (let i = 0; i < blobTokens.length; i++) {
      const bt = blobTokens[i];
      if (bt.length >= stemLen && bt.startsWith(stem)) {
        return 0.84;
      }
    }
  }

  // Typo tolerance via bounded Levenshtein
  if (term.length >= 4) {
    const maxDist = term.length >= 7 ? 2 : 1;
    for (let i = 0; i < blobTokens.length; i++) {
      const bt = blobTokens[i];
      if (bt.length < 3) continue;
      if (Math.abs(bt.length - term.length) > maxDist) continue;
      const d = boundedLevenshtein(term, bt, maxDist);
      if (d <= maxDist) {
        return d === 1 ? 0.78 : 0.68;
      }
    }
  }

  return 0;
}

/**
 * Normalizes a vector in-place to unit L2 norm.
 */
export function normalizeVector(vec) {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm > 1e-9) {
    for (let i = 0; i < vec.length; i++) {
      vec[i] = vec[i] / norm;
    }
  }
  return vec;
}

/**
 * Computes cosine similarity between two numeric vectors in [0, 1].
 */
export function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }
  const len = Math.min(vecA.length, vecB.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    const a = Number(vecA[i]) || 0;
    const b = Number(vecB[i]) || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom <= 1e-9) return 0;
  return Math.max(0, Math.min(1, dot / denom));
}

/**
 * Builds a deterministic 128-dimensional cross-lingual semantic vector
 * combining concept cluster activations (dims 0..27) and hashed token/stem/trigram projections (dims 28..127).
 * Fully accent-insensitive and tolerant to plurals and minor spelling variations.
 */
export function buildLocalSemanticVector(rawText) {
  const vec = new Array(LOCAL_DIM).fill(0);
  const clean = normalizeSearchText(rawText);

  if (!clean) return vec;

  // 1. Concept cluster dimensions (dims 0..CLUSTER_DIM_COUNT-1) with high semantic weight
  for (let c = 0; c < CLUSTER_DIM_COUNT; c++) {
    const matches = clean.match(SEMANTIC_CONCEPT_CLUSTERS[c]);
    if (matches && matches.length > 0) {
      vec[c] = 2.4 * Math.min(1 + Math.log1p(matches.length), 3.0);
    }
  }

  // 2. Token + stem + character 3-gram feature hashing into dims CLUSTER_DIM_COUNT..127
  const span = LOCAL_DIM - CLUSTER_DIM_COUNT;
  const tokens = clean
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2 && !SEARCH_STOP_WORDS.has(t));

  const hashInto = (str, weight, signed = true) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = CLUSTER_DIM_COUNT + (Math.abs(h) % span);
    const sign = signed ? ((h & 1) === 0 ? 1 : -1) : 1;
    vec[idx] += sign * weight;
  };

  for (const tok of tokens) {
    hashInto(tok, 1.0, true);

    // 4-char & 5-char stem prefixes for morphological/cognate matching across ES/EN
    if (tok.length >= 4) {
      hashInto('s4:' + tok.slice(0, 4), 0.45, false);
    }
    if (tok.length >= 5) {
      hashInto('s5:' + tok.slice(0, 5), 0.65, false);
    }

    // Character 3-grams for forgiving typo & partial-word matching
    if (tok.length >= 4 && tok.length <= 18) {
      for (let g = 0; g <= tok.length - 3; g++) {
        hashInto('g3:' + tok.slice(g, g + 3), 0.18, true);
      }
    }
  }

  return normalizeVector(vec);
}

/**
 * Generates an embedding vector using Cloudflare Workers AI (`@cf/baai/bge-m3`)
 * or falls back to `buildLocalSemanticVector`.
 */
export async function generateEmbedding(text, env) {
  const clean = stripHtml(text || '').slice(0, 1200);
  if (env && env.AI && typeof env.AI.run === 'function') {
    try {
      const resp = await env.AI.run(EMBEDDING_MODEL, { text: [clean] });
      const vec = resp && Array.isArray(resp.data) && Array.isArray(resp.data[0])
        ? resp.data[0]
        : (Array.isArray(resp) ? resp : null);
      if (vec && vec.length >= 64) {
        return {
          vector: normalizeVector([...vec]),
          model: EMBEDDING_MODEL,
          dimensions: vec.length
        };
      }
    } catch {
      // Fallback to local semantic vector
    }
  }

  const localVec = buildLocalSemanticVector(clean);
  return {
    vector: localVec,
    model: 'edge-multilingual-128d',
    dimensions: localVec.length
  };
}

/**
 * Converts a job_hash string into a deterministic positive integer ID for Qdrant points.
 */
function hashToQdrantPointId(jobHash) {
  const clean = String(jobHash || '');
  let h = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0) || 1;
}

/**
 *Builds canonical text representation of an opportunity for vector embedding.
 */
export function buildOpportunityEmbeddingText(item) {
  return [
    item.title || '',
    item.company || '',
    item.platform_name || '',
    item.location || '',
    item.tags || '',
    item.ai_summary_es || '',
    item.ai_summary_en || '',
    stripHtml(item.description || '').slice(0, 600)
  ]
    .filter(Boolean)
    .join(' | ');
}

/**
 * Generates embeddings for a batch of texts in a single `@cf/baai/bge-m3` call per chunk (max 25),
 * falling back cleanly to 128d local vectors when `env.AI` is unavailable.
 */
async function generateEmbeddingsBatch(texts, env) {
  const cleanTexts = texts.map(t => stripHtml(t || '').slice(0, 1200));
  if (env && env.AI && typeof env.AI.run === 'function' && cleanTexts.length > 0) {
    const out = [];
    let allNeural = true;
    for (let i = 0; i < cleanTexts.length; i += 25) {
      const chunk = cleanTexts.slice(i, i + 25);
      try {
        const resp = await env.AI.run(EMBEDDING_MODEL, { text: chunk });
        const rows = resp && Array.isArray(resp.data) ? resp.data : null;
        if (rows && rows.length === chunk.length && Array.isArray(rows[0]) && rows[0].length >= 64) {
          for (const vec of rows) {
            out.push({
              vector: normalizeVector([...vec]),
              model: EMBEDDING_MODEL,
              dimensions: vec.length
            });
          }
          continue;
        }
      } catch {
        // Fallback per item below
      }
      allNeural = false;
      for (const itemText of chunk) {
        out.push(await generateEmbedding(itemText, env));
      }
    }
    if (out.length === cleanTexts.length && (allNeural || out.every(e => e.dimensions >= 64))) {
      return out;
    }
  }
  return cleanTexts.map(t => {
    const localVec = buildLocalSemanticVector(t);
    return {
      vector: localVec,
      model: 'edge-multilingual-128d',
      dimensions: localVec.length
    };
  });
}

/**
 * Indexes a batch of opportunities into Cloudflare Vectorize (`env.VECTORIZE`)
 * and/or the Raspberry Pi 5 Qdrant Edge Bridge (`env.QDRANT_URL`).
 */
export async function indexOpportunitiesInVectorStore(opportunities, env, maxItems = 25) {
  if (!Array.isArray(opportunities) || opportunities.length === 0) {
    return { indexed_count: 0, backends: [] };
  }

  const eligibleOpportunities = opportunities.filter(opp => checkBoliviaRemoteEligibility(opp).eligible);
  const slice = eligibleOpportunities.slice(0, maxItems);
  const backends = [];
  const vectorRecords = [];

  const texts = slice.map(opp => buildOpportunityEmbeddingText(opp));
  const embeddings = await generateEmbeddingsBatch(texts, env);

  for (let i = 0; i < slice.length; i++) {
    const opp = slice[i];
    const emb = embeddings[i];
    const id = opp.job_hash || computeJobHash(opp.title, opp.company, opp.url);
    const attrs = detectOfferAttributes(opp);
    const langs = attrs.languages || ['en'];
    const langMask = langs.includes('es') && langs.includes('en')
      ? 'es_en'
      : (langs.includes('es') ? 'es' : 'en');
    const companySlug = opp.company_slug || normalizeCompanySlug(opp.company || opp.platform_name, 'company');
    const publishedEpoch = Number(opp.published_epoch) || parseDateToEpochSeconds(opp.published_at || opp.discovered_at);

    vectorRecords.push({
      id,
      values: emb.vector,
      dimensions: emb.dimensions,
      metadata: {
        job_hash: id,
        title: String(opp.title || '').slice(0, 140),
        company: String(opp.company || '').slice(0, 80),
        company_slug: companySlug.slice(0, 80),
        platform_name: String(opp.platform_name || '').slice(0, 80),
        track: String(opp.track || '').slice(0, 80),
        status: String(opp.status || 'ACTIVE'),
        lang_mask: langMask,
        published_epoch: publishedEpoch,
        bolivia_eligible: 1,
        published_at: String(opp.published_at || '').slice(0, 10)
      }
    });
  }

  // 1. Cloudflare Vectorize (`env.VECTORIZE`) — guard against dimension mismatch & chunk upserts
  let vectorizeMutationId = null;
  let vectorizeError = null;
  if (env && env.VECTORIZE && typeof env.VECTORIZE.upsert === 'function') {
    try {
      const targetDim = vectorRecords[0] ? vectorRecords[0].dimensions : 1024;
      const cleanPayload = vectorRecords
        .filter(r => Array.isArray(r.values) && r.values.length === targetDim)
        .map(({ id, values, metadata }) => ({ id, values, metadata }));

      if (cleanPayload.length > 0) {
        for (let i = 0; i < cleanPayload.length; i += 100) {
          const res = await env.VECTORIZE.upsert(cleanPayload.slice(i, i + 100));
          if (res && res.mutationId) vectorizeMutationId = res.mutationId;
        }
        backends.push('cloudflare-vectorize');
      }
    } catch (err) {
      vectorizeError = err && err.message ? err.message : String(err);
    }
  }

  // 2. Raspberry Pi 5 Qdrant Edge Bridge (`env.QDRANT_URL`)
  if (env && env.QDRANT_URL) {
    try {
      const baseUrl = String(env.QDRANT_URL).replace(/\/+$/, '');
      const collection = env.QDRANT_COLLECTION || 'bolivia_remote_jobs';
      const headers = { 'Content-Type': 'application/json' };
      if (env.QDRANT_API_KEY) {
        headers['api-key'] = String(env.QDRANT_API_KEY);
      }
      const points = vectorRecords.map(r => ({
        id: hashToQdrantPointId(r.id),
        vector: r.values,
        payload: r.metadata
      }));
      const resp = await fetch(`${baseUrl}/collections/${collection}/points?wait=true`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ points })
      });
      if (resp.ok) {
        backends.push('qdrant-edge-bridge');
      }
    } catch {
      // Ignore Qdrant bridge network error
    }
  }

  if (backends.length === 0) {
    backends.push('edge-in-memory-index');
  }

  return {
    indexed_count: vectorRecords.length,
    embedding_dimensions: vectorRecords[0] ? vectorRecords[0].dimensions : 0,
    mutation_id: vectorizeMutationId,
    vectorize_error: vectorizeError,
    backends
  };
}

/**
 * Semantic deduplication across job postings using vector cosine similarity.
 * Removes cross-platform reposts that describe the same position with >= threshold similarity.
 */
export function deduplicateSemantically(opportunities, similarityThreshold = 0.92) {
  if (!Array.isArray(opportunities) || opportunities.length <= 1) {
    return {
      opportunities: opportunities || [],
      duplicates_removed: 0
    };
  }

  const kept = [];
  const keptVectors = [];
  let duplicatesRemoved = 0;

  for (const opp of opportunities) {
    if (!opp || !opp.title) continue;
    const vec = buildLocalSemanticVector(`${opp.title} ${opp.company} ${opp.description || ''}`);
    let isDuplicate = false;

    for (let i = 0; i < kept.length; i++) {
      const sameCompany =
        String(opp.company || '').toLowerCase().trim() ===
        String(kept[i].company || '').toLowerCase().trim();
      const sim = cosineSimilarity(vec, keptVectors[i]);
      const effectiveThreshold = sameCompany ? Math.min(similarityThreshold, 0.86) : similarityThreshold;
      if (sim >= effectiveThreshold) {
        isDuplicate = true;
        duplicatesRemoved++;
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(opp);
      keptVectors.push(vec);
    }
  }

  return {
    opportunities: kept,
    duplicates_removed: duplicatesRemoved
  };
}

/**
 * Performs hybrid semantic search over all opportunities using:
 *   - Cloudflare Vectorize (`env.VECTORIZE.query`) if bound
 *   - Raspberry Pi 5 Qdrant Bridge (`env.QDRANT_URL`) if configured
 *   - Edge Multilingual Semantic Vectors + 4-axis Bolivia Remote Evaluator
 */
export async function semanticSearchOpportunities(query, opportunities, filters = DEFAULT_FILTERS, env = {}, options = {}) {
  const cleanQuery = stripHtml(query || '').trim();
  if (!cleanQuery) {
    throw new Error('Por favor ingresa una consulta de búsqueda semántica. / Please enter a semantic search query.');
  }

  const topK = Math.min(Math.max(Number(options.topK) || 25, 1), 100);
  const evalResult = evaluateAllOpportunities(opportunities, { ...filters, require_bolivia_remote: true });
  const pool = evalResult.surfaced;

  const externalScoresByHash = new Map();
  let activeBackend = 'edge-multilingual-vectors';

  // Generate query embedding (uses @cf/baai/bge-m3 if env.AI is bound)
  const queryEmb = await generateEmbedding(cleanQuery, env);
  if (queryEmb.model === EMBEDDING_MODEL) {
    activeBackend = 'workers-ai-bge-m3';
  }

  // 1. Query Cloudflare Vectorize if bound
  if (env && env.VECTORIZE && typeof env.VECTORIZE.query === 'function') {
    try {
      const vecMatches = await env.VECTORIZE.query(queryEmb.vector, {
        topK,
        returnMetadata: 'all'
      });
      const matchList = (vecMatches && Array.isArray(vecMatches.matches)) ? vecMatches.matches : [];
      for (const m of matchList) {
        const hash = (m.metadata && m.metadata.job_hash) || m.id;
        if (hash && typeof m.score === 'number') {
          externalScoresByHash.set(hash, Math.max(0, Math.min(1, m.score)));
        }
      }
      if (matchList.length > 0) {
        activeBackend = 'cloudflare-vectorize';
      }
    } catch {
      // Fallback to Qdrant or local semantic scoring
    }
  }

  // 2. Query Qdrant Edge Bridge if configured and Vectorize didn't populate
  if (externalScoresByHash.size === 0 && env && env.QDRANT_URL) {
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
        for (const h of hits) {
          const hash = h.payload && h.payload.job_hash;
          if (hash && typeof h.score === 'number') {
            externalScoresByHash.set(hash, Math.max(0, Math.min(1, h.score)));
          }
        }
        if (hits.length > 0) {
          activeBackend = 'qdrant-edge-bridge';
        }
      }
    } catch {
      // Fallback to local semantic scoring
    }
  }

  // 3. Score candidate opportunities using accent-insensitive cross-lingual vector + fuzzy/synonym overlap
  const normalizedQuery = normalizeSearchText(cleanQuery);
  const queryTerms = extractQueryTokens(normalizedQuery);
  const expandedSynonyms = expandQueryTerms(queryTerms);
  const expandedQueryText = expandedSynonyms.length > 0
    ? `${normalizedQuery} ${expandedSynonyms.join(' ')}`
    : normalizedQuery;

  const localQueryVec = buildLocalSemanticVector(expandedQueryText);

  const scoreCandidatePool = (candidates) => {
    const scored = candidates.map(opp => {
      const oppText = buildOpportunityEmbeddingText(opp);
      const normalizedBlob = normalizeSearchText(oppText);
      const blobTokens = normalizedBlob
        .replace(/[^a-z0-9+#.\s-]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 2);
      const localOppVec = buildLocalSemanticVector(normalizedBlob);
      const localSim = cosineSimilarity(localQueryVec, localOppVec);

      // Accent-insensitive, stem-aware & typo-forgiving lexical overlap boost
      let termScoreSum = 0;
      for (const term of queryTerms) {
        termScoreSum += scoreForgivingTermMatch(term, normalizedBlob, blobTokens);
      }
      const lexicalBoost = queryTerms.length > 0
        ? (termScoreSum / queryTerms.length) * 0.30
        : 0;

      // Cross-lingual synonym overlap boost for broader conceptual understanding
      let synHits = 0;
      if (expandedSynonyms.length > 0) {
        for (const syn of expandedSynonyms) {
          if (normalizedBlob.includes(syn)) {
            synHits++;
          }
        }
      }
      const synonymBoost = expandedSynonyms.length > 0
        ? Math.min(1, synHits / Math.min(expandedSynonyms.length, 3)) * 0.18
        : 0;

      const extSim = externalScoresByHash.has(opp.job_hash)
        ? externalScoresByHash.get(opp.job_hash)
        : null;

      const rawSim = extSim !== null
        ? Math.min(1, extSim * 0.65 + localSim * 0.35 + lexicalBoost + synonymBoost * 0.5)
        : Math.min(1, localSim * 0.80 + lexicalBoost + synonymBoost);

      // Scale similarity into an intuitive 0..100 semantic score
      const semanticScore = Math.min(100, Math.round(Math.pow(rawSim, 0.62) * 100));
      const blendedScore = Math.min(100, Math.round(semanticScore * 0.58 + opp.total_score * 0.42));

      return {
        ...opp,
        semantic_similarity: Number(rawSim.toFixed(4)),
        semantic_score: semanticScore,
        blended_score: blendedScore
      };
    });

    scored.sort((a, b) => {
      if (b.blended_score !== a.blended_score) return b.blended_score - a.blended_score;
      return b.semantic_score - a.semantic_score;
    });

    return scored;
  };

  let scoredResults = scoreCandidatePool(pool);
  let filteredTop = scoredResults
    .filter(r => r.semantic_score >= 10)
    .slice(0, topK);

  // Forgiving broad fallback: if current filtered view yielded 0 matches, search across all Bolivia-eligible offers
  if (filteredTop.length === 0 && Array.isArray(evalResult.all) && evalResult.all.length > pool.length) {
    scoredResults = scoreCandidatePool(evalResult.all);
    filteredTop = scoredResults
      .filter(r => r.semantic_score >= 10)
      .slice(0, topK);
  }

  return {
    ok: true,
    query: cleanQuery,
    vector_backend: activeBackend,
    embedding_model: queryEmb.model,
    count: filteredTop.length,
    results: filteredTop
  };
}
