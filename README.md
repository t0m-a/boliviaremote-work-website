<div align="center">

# Buscador y Evaluador de Empleos Remotos desde Bolivia

**Plataforma pública, autónoma y auto-contenida para Cloudflare Workers diseñada para encontrar, filtrar y evaluar ofertas laborales internacionales 100% remotas elegibles para trabajar desde Bolivia (UTC-4).**

[![Versión](https://img.shields.io/badge/Versi%C3%B3n-v5.8.0%20Producci%C3%B3n-0284c7?style=for-the-badge&logo=cloudflare&logoColor=white)](src/worker.js)
[![Plataforma](https://img.shields.io/badge/Runtime-Cloudflare%20Workers-f38020?style=for-the-badge&logo=cloudflareworkers&logoColor=white)](wrangler.toml)
[![Automatización](https://img.shields.io/badge/Frecuencia-Cada%2015%20min%20%2B%20Bajo%20Demanda-10b981?style=for-the-badge&logo=clockify&logoColor=white)](wrangler.toml)
[![Idioma UI](https://img.shields.io/badge/Interfaz-Espa%C3%B1ol%20Bolivia-f59e0b?style=for-the-badge&logo=googletranslate&logoColor=white)](src/ui.js)
[![Licencia](https://img.shields.io/badge/Licencia-GPL%20v3.0-blue.svg?style=for-the-badge&logo=gnu&logoColor=white)](#licencia)

<p align="center">
  <a href="#manual-del-usuario-final"><b>Manual de Usuario</b></a> •
  <a href="#cómo-funciona-la-arquitectura-interna"><b>Arquitectura Interna</b></a> •
  <a href="#guía-de-instalación-y-auto-alojamiento-self-hosting"><b>Guía de Auto-Alojamiento</b></a> •
  <a href="#referencia-de-la-api-rest"><b>API REST</b></a>
</p>

</div>

---

## Tabla de Contenidos

1. [¿Qué es esta plataforma?](#qué-es-esta-plataforma)
2. [Manual del Usuario Final](#manual-del-usuario-final)
   - [Paso 1: Acceso, navegación y modo claro/oscuro](#paso-1-acceso-navegación-y-modo-clarooscuro)
   - [Paso 2: Configuración de tus filtros personalizados (25 Categorías)](#paso-2-configuración-de-tus-filtros-personalizados-25-categorías)
   - [Paso 3: Garantía de elegibilidad 100% Remoto desde Bolivia](#paso-3-garantía-de-elegibilidad-100-remoto-desde-bolivia)
   - [Paso 4: Semáforo de calificación e información enriquecida con IA](#paso-4-semáforo-de-calificación-e-información-enriquecida-con-ia)
   - [Paso 5: Escanear y evaluar URLs de plataformas personalizadas](#paso-5-escanear-y-evaluar-urls-de-plataformas-personalizadas)
   - [Paso 6: Sección interactiva "Manual de Uso" integrada](#paso-6-sección-interactiva-manual-de-uso-integrada)
   - [Paso 7: Generación y descarga de resultados en vivo](#paso-7-generación-y-descarga-de-resultados-en-vivo)
3. [Cómo Funciona la Arquitectura Interna](#cómo-funciona-la-arquitectura-interna)
   - [Diagrama de flujo del sistema](#diagrama-de-flujo-del-sistema)
   - [Motor de calificación y rúbrica dinámica de 100 puntos](#motor-de-calificación-y-rúbrica-dinámica-de-100-puntos)
   - [Motor de ingesta y 86 plataformas públicas monitoreadas](#motor-de-ingesta-y-86-plataformas-públicas-monitoreadas)
   - [Sincronización de plataformas personalizadas al código semilla](#sincronización-de-plataformas-personalizadas-al-código-semilla)
   - [Ciclo de ejecución bajo demanda y cron cada 15 minutos](#ciclo-de-ejecución-bajo-demanda-y-cron-cada-15-minutos)
4. [Guía de Instalación y Auto-Alojamiento (Self-Hosting)](#guía-de-instalación-y-auto-alojamiento-self-hosting)
   - [Requisitos previos](#requisitos-previos)
   - [Instalación local y pruebas](#instalación-local-y-pruebas)
   - [Despliegue público en Cloudflare Workers](#despliegue-público-en-cloudflare-workers)
   - [Generación de HTML autónomo (Standalone)](#generación-de-html-autónomo-standalone)
5. [Referencia de la API REST](#referencia-de-la-api-rest)
6. [Licencia](#licencia)

---

## ¿Qué es esta plataforma?

Buscar trabajo remoto internacional desde Bolivia suele ser frustrante: la mayoría de bolsas de empleo anuncian puestos como *"remotos"*, pero al leer las letras pequeñas exigen residencia física en Estados Unidos, permiso de trabajo en la Unión Europea o contratación exclusiva local.

Esta herramienta es una **solución pública y gratuita** en **Español (Bolivia)** que centraliza **86 plataformas globales y regionales** (incluyendo Torre.ai, GetOnBoard, Virtual Latinos, Workana, SoyFreelancer, NoDesk, DailyRemote, Jobspresso, Dynamite Jobs, LatinHire, HireLatam, SheWorks, Himalayas, We Work Remotely, Remotive, RemoteYeah, etc.), garantizando desde la ingesta que todas las ofertas importadas y evaluadas sean **100% remotas elegibles desde Bolivia**, y calificándolas en vivo frente a tus preferencias de **idiomas (`Español` / `Inglés`), área profesional (25 categorías), nivel de experiencia y modalidad de contrato**.

### Principales Características y Novedades (v5.8)

- **Interfaz 100% Español (Bolivia) y Diseño Responsivo:** Adaptación fluida a escritorio, tabletas (`<= 1200px`, `<= 820px`) y celulares (`<= 640px`), con botón flotante translúcido **Arriba** en la esquina inferior derecha, grillas KPI balanceadas de 3 tarjetas (`POSTULAR`, `EXPLORAR`, `BAJA COINCIDENCIA`) y cierre automático suave al retirar el puntero en todos los menús desplegables.
- **Menú Hamburguesa `Información Utiles` y Modo Claro/Oscuro:** La barra superior muestra **Bolivia Remote Work** a la izquierda y, a la derecha, el selector discreto de modo claro/oscuro junto al menú **Información Utiles**, organizado en orden: **Aviso** (con enlace directo a [Language Transfer](https://www.languagetransfer.org)), **Manual de Uso**, **Información Financiera** (AirTM, Wise, Payoneer, Tipalti y Dólar Bolivia Hoy), **Categorías De Plataformas** y **Plataformas Monitoreadas**.
- **Filtro Estricto de Idiomas (`Español` e `Inglés`):** Por defecto inicia con **Español** seleccionado. Soporta tres modos simétricos con refresco inmediato de resultados y tarjetas KPI:
  - **Solo Español:** Muestra y prioriza únicamente vacantes compatibles con español, descartando ofertas exclusivas en inglés.
  - **Solo Inglés:** Muestra y prioriza únicamente vacantes compatibles con inglés, descartando ofertas exclusivas en español.
  - **Ambos (`Español` + `Inglés`):** Muestra la unión completa de ofertas en español, inglés y bilingües con puntaje completo de idioma (`20/20`).
- **25 Categorías Profesionales Enriquecidas:** Desplegable responsivo multi-selección (`Tipo de Posición / Área Profesional`) ampliado para cubrir áreas técnicas, administrativas, comerciales, creativas, de salud, legales, e-commerce, producto, ciberseguridad, IA/ML y traducción.
- **Filtro 100% Remoto desde Bolivia Obligatorio en Toda la Tubería:** El escáner, el evaluador, el índice vectorial y el analizador IA filtran automáticamente cualquier restricción geográfica (`US Only`, `EU Only`, `W-2`, presencial/híbrido) antes de importar o mostrar vacantes.
- **Panel Contextual `Más información con IA` (Cloudflare Workers AI):** En cada tarjeta de oferta, el botón **Más información con IA** despliega un panel inmediatamente debajo de la vacante (y se cierra automáticamente al salir de la pantalla al hacer scroll) con análisis estructurado en español mediante Llama 3.1 y respaldo determinístico de borde (`POST /api/ai/analyze-position`):
  - Resumen informativo de la posición.
  - **Requisitos de la posición**.
  - **Experiencia y habilidades útiles**.
  - **Compatibilidad horaria con Bolivia (UTC-4)**.
  - **Consejos para el candidato**.
- **Búsqueda Semántica (`Buscar con IA`) y Barra de Herramientas Unificada:** Incluye botón verde **Escanear Ofertas Ahora**, filtro **Todos los Elegibles** y búsqueda vectorial multilingüe (`@cf/baai/bge-m3` + Cloudflare Vectorize / Qdrant / vectores locales).
- **Sincronización Automática de Nuevas Plataformas (`custom_*`):** Motor [`src/seed_sync.js`](src/seed_sync.js), script CLI [`sync_platforms.mjs`](sync_platforms.mjs) (`npm run sync-platforms`) y endpoint `/api/platforms/sync` para persistir plataformas personalizadas hacia [`platforms_config.json`](platforms_config.json) y [`src/seed_data.js`](src/seed_data.js).
- **Identidad y Favicon Patrio:** Favicon vectorial del planeta Tierra con los colores de la bandera de Bolivia (`#EF4444`, `#FDE047`, `#10B981`) disponible en `/favicon.svg`, `/favicon.ico` y `/favicon.png`.

> [!NOTE]
> Todo el procesamiento ocurre en tiempo real en los servidores perimetrales de **Cloudflare Workers** o localmente en tu navegador. Cero datos privados, cero cookies de rastreo y cero cuentas obligatorias.

---

## Manual del Usuario Final

Si estás utilizando la versión alojada públicamente en línea, esta guía te muestra cómo aprovecharla al máximo en menos de 3 minutos.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Elige tus Idiomas ──▶ 2. Ajusta tus Filtros ──▶ 3. Revisa tu Semáforo    │
│    (Español / Inglés)      (25 Áreas, Exp, Mod)      (Postular / Explorar)  │
│                                                                             │
│ 4. Más Info con IA   ──▶ 5. Escanea tu URL     ──▶ 6. Exporta tu Reporte    │
│    (Requisitos, UTC-4)     (Evaluación en vivo)      (Markdown / CSV)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Paso 1: Acceso, navegación y modo claro/oscuro

Al abrir el portal, la aplicación carga completamente en **Español (Bolivia)** (`es-BO`) bajo la marca **Bolivia Remote Work**.

- En la esquina superior derecha tienes el botón discreto de **Modo Claro / Modo Oscuro** junto al menú **Información Utiles** (que se cierra suavemente al retirar el puntero).
- Dentro de **Información Utiles** encontrarás:
  1. **Aviso** (con recomendación formativa y enlace a [Language Transfer](https://www.languagetransfer.org)).
  2. **Manual de Uso**.
  3. **Información Financiera** (plataformas de cobro internacional: AirTM, Wise, Payoneer, Tipalti y Dólar Bolivia Hoy).
  4. **Categorías De Plataformas** (acceso por categoría de fuente).
  5. **Plataformas Monitoreadas** (directorio completo de las 86 fuentes).

---

### Paso 2: Configuración de tus filtros personalizados (25 Categorías)

En la sección **"Personaliza tu Búsqueda y Criterios de Evaluación"**, puedes combinar tus criterios y ver el listado actualizarse al instante:

| Filtro | Opciones Disponibles | Cómo Influye en el Puntaje |
| :--- | :--- | :--- |
| **1. Tus Idiomas** | `Español` *(seleccionado por defecto)*, `Inglés` | Pondera hasta **20 puntos**. **Regla Estricta:** **Solo Español** excluye vacantes exclusivas en inglés; **Solo Inglés** excluye vacantes exclusivas en español; **Ambos** muestra toda la unión de vacantes en español, inglés y bilingües con puntaje máximo de idioma. |
| **2. Tu Nivel de Experiencia** | `Todos los niveles`, `Inicial / Sin Exp. (0-1 años)`, `Junior (1-2 años)`, `Semi-Senior / Mid (3-5 años)`, `Senior (5+ años)`, `Management (8+ años)` | Pondera dentro del bloque de contrato/experiencia (**20 puntos**). Menú desplegable multi-selección con cierre suave automático. |
| **3. Tipo de Contrato Buscado** | `Tiempo Completo (Full-Time)`, `Medio Tiempo / Part-Time`, `Por Proyectos / Freelance`, `Por Horas / Flexible / Asíncrono`, `Consultoría / Asesoría` | Puedes marcar uno, varios o todos. Pondera dentro del bloque de contrato (**20 puntos**). |
| **4. Tipo de Posición / Área Profesional (25 Categorías)** | Desplegable responsivo multi-selección que incluye: `Asistente Virtual & Soporte Ejecutivo`, `Coordinación de Operaciones & Proyectos`, `Atención al Cliente & Chat Support`, `Ventas Remotas, BDR & SDR`, `Marketing Digital & Contenidos`, `Recursos Humanos & Recruiting`, `Finanzas, Contabilidad & Bookkeeping`, `Diseño Gráfico, UI/UX & Video`, `Entrenamiento IA, RLHF & Anotación`, `Desarrollo de Software`, `Cloud, DevOps & Sistemas`, `Datos, BI & Machine Learning`, `Traducción, Interpretación & Idiomas`, `Ciberseguridad & Auditoría TI`, `Gestión de Producto (PM / PO)`, `Ingeniería de IA & Agentes LLM`, `QA, Testing & Automatización`, `E-Commerce & Logística`, `Legal, Compliance & Contratos`, `Salud, Telemedicina & Facturación Médica`, `Educación, Docencia & Tutorías`, `Redacción Técnica & Copywriting`, `Customer Success & Onboarding`, `Arquitectura, Ingeniería Civil & CAD` y `Banca, Seguros & Fintech`. | Pondera hasta **35 puntos**. Si lo dejas vacío o pulsas *"Ver todas las áreas"*, evalúa ofertas de todas las categorías. |

> [!TIP]
> **Casilla "Ocultar ofertas de otras áreas":**  
> Si marcas esta opción al elegir una o más categorías, el sistema filtra estrictamente cualquier vacante que no pertenezca a tus áreas seleccionadas.

---

### Paso 3: Garantía de elegibilidad 100% Remoto desde Bolivia

La elegibilidad **100% Remoto desde Bolivia** se aplica obligatoriamente en el motor de escaneo, en la evaluación, en la búsqueda vectorial y en el análisis IA. Todas las vacantes importadas y visibles pasan validación geográfica para descartar automáticamente:
- Puestos que exigen residir físicamente en Estados Unidos (*"US Only"*, *"Must reside in the US"*, contratos *W-2* exclusivos).
- Puestos restringidos a Europa (*"EU Only"*), Reino Unido (*"UK Only"*), Canadá, México u otros países locales.
- Empleos presenciales o híbridos (*"On-site"*, *"Hybrid"*, *"Travel Required"*).
- Posiciones que requieren visados o autorizaciones gubernamentales extranjeras (*"Security Clearance"*, *"TS/SCI"*).

Se conservan exclusivamente oportunidades abiertas a **Bolivia / LATAM / Sudamérica**, **100% Remoto Global (Work From Anywhere)** y esquemas internacionales por contrato independiente (*W-8BEN*) compatibles con `UTC-4`.

---

### Paso 4: Semáforo de calificación e información enriquecida con IA

Cada vacante elegible es calificada sobre **100 puntos** y agrupada en tres tarjetas KPI responsivas:

```mermaid
graph TD
    A["Oferta 100% Remota Bolivia"] --> B["Cálculo de Afinidad frente a tus Filtros (0-100 pts)"]
    B --> C{"Puntaje Final"}
    C -- "≥ 78 pts" --> D["POSTULAR (Máxima afinidad, postulación recomendada)"]
    C -- "58 a 77 pts" --> E["EXPLORAR (Afinidad intermedia / compatible)"]
    C -- "< 58 pts" --> F["BAJA COINCIDENCIA (Fuera de tus filtros de idioma, área o contrato)"]
```

1. **POSTULAR (Puntaje ≥ 78/100):** Alta afinidad con tus idiomas, área profesional, experiencia y modalidad. Incluye acceso directo **"Ver Oferta y Postular"** y el botón **"Más información con IA"**.
2. **EXPLORAR (Puntaje 58–77/100):** Vacantes compatibles con variaciones menores respecto a tus preferencias.
3. **BAJA COINCIDENCIA (< 58/100):** Ofertas válidas para Bolivia pero fuera de tus filtros activos.

Al hacer clic en **"Más información con IA"** sobre cualquier tarjeta, se despliega justo debajo de esa vacante el panel **Información sobre la Posición** con:
- Resumen general de la vacante.
- **Requisitos de la posición**.
- **Experiencia y habilidades útiles**.
- **Compatibilidad horaria con Bolivia (UTC-4)**.
- **Consejos para el candidato**.

El panel se cierra automáticamente al hacer clic en `×` o al desplazarte fuera de su área visible.

---

### Paso 5: Escanear y evaluar URLs de plataformas personalizadas

Al final de la página encontrarás el panel **"Agregar y Escanear tu Propia URL de Plataforma o Bolsa de Empleo"**:

1. Pega la URL (por ejemplo `https://empresa.com/careers` o `https://sitio.com/jobs.rss`).
2. *(Opcional)* Asigna un nombre descriptivo.
3. Selecciona el modo de escaneo (**Auto-detectar**, **Página Web / Bolsa HTML**, **Feed RSS / Atom XML** o **API JSON**).
4. Haz clic en **"Escanear y Evaluar URL"** para extraer, validar 100% elegibilidad para Bolivia e incorporar al instante las nuevas oportunidades a tus resultados.

---

### Paso 6: Sección interactiva "Manual de Uso" integrada

Desde **Información Utiles → Manual de Uso** accedes a la guía paso a paso integrada dentro de la propia aplicación, cubriendo configuración de idiomas (`Español` / `Inglés`), experiencia, contratos, áreas profesionales, interpretación del semáforo, análisis IA, escaneo de URLs personalizadas y exportación de reportes.

---

### Paso 7: Generación y descarga de resultados en vivo

- **Botón `Escanear Ofertas Ahora`:** Disponible en color verde directamente en la barra de herramientas principal para disparar una actualización en vivo desde Cloudflare Workers.
- **Búsqueda Semántica (`Buscar con IA`):** Ordena las vacantes elegibles por similitud vectorial frente a tu consulta en lenguaje natural.
- **Reporte Markdown Directo:** Disponible mediante `/api/results.md?lang=es` (o `?lang=en`).
- **Exportación CSV:** Descarga las ofertas filtradas con puntajes, idiomas detectados, modalidad y enlaces directos.

---

## Cómo Funciona la Arquitectura Interna

La solución está construida sobre una arquitectura **Serverless Zero-Dependency** en **Cloudflare Workers**, consumiendo únicamente estándares de la Web (Fetch API, Web Streams, Web Crypto, URL API, Cache API) junto con enlaces opcionales de **Cloudflare Workers AI**, **Vectorize** y **D1**.

### Diagrama de flujo del sistema

```mermaid
flowchart TD
    subgraph Cliente ["Navegador del Usuario"]
        UI["Interfaz Web Español (Bolivia)"]
        Filters["Filtros en LocalStorage (ES/EN, 25 Roles, Exp, Contrato)"]
        AiPanel["Panel Contextual Más información con IA"]
        URLScan["Formulario de Escaneo de URLs"]
    end

    subgraph CFWorker ["Cloudflare Worker (Edge Serverless)"]
        WorkerEntry["src/worker.js (Router, API & Cron Handler)"]
        ScannerEng["src/scanner.js (Parser JSON/RSS/HTML + Filtro Bolivia)"]
        EvaluatorEng["src/evaluator.js (Algoritmo 4 Ejes & Filtro Estricto ES/EN)"]
        AiEnricher["src/ai_enricher.js (Workers AI Llama 3.1 + Fallback Borde)"]
        VectorStore["src/vector_store.js (Búsqueda Semántica BGE-M3 / Vectorize)"]
        McpServer["src/mcp.js (Servidor MCP Streamable HTTP)"]
        SeedData["src/seed_data.js (86 Plataformas / 120+ Ofertas Bolivia)"]
        SeedSync["src/seed_sync.js (Exportador de Plataformas custom_*)"]
        EdgeCache["Cloudflare Cache API (caches.default)"]
    end

    subgraph Fuentes ["86 Fuentes Globales de Empleo"]
        APIs["APIs REST Públicas (Torre, GetOnBoard, Remotive, etc.)"]
        RSS["Feeds RSS / Atom (Himalayas, WWR, NoDesk, DailyRemote, etc.)"]
        HTMLPages["Bolsas Web LATAM & Globales (Workana, Virtual Latinos, RemoteYeah, etc.)"]
    end

    UI <-->|JSON / HTML| WorkerEntry
    AiPanel -->|POST /api/ai/analyze-position| WorkerEntry
    URLScan -->|POST /api/platforms/scan-url| WorkerEntry
    WorkerEntry --> ScannerEng
    ScannerEng -->|Fetch con Timeout| Fuentes
    ScannerEng --> EvaluatorEng
    WorkerEntry --> AiEnricher
    WorkerEntry --> VectorStore
    WorkerEntry --> McpServer
    EvaluatorEng --> WorkerEntry
    WorkerEntry <--> EdgeCache
    WorkerEntry --> SeedSync
    SeedData -.->|Fallback / Arranque en frío| WorkerEntry
```

---

### Motor de calificación y rúbrica dinámica de 100 puntos

El evaluador ([`src/evaluator.js`](src/evaluator.js)) analiza cada oportunidad elegible para Bolivia en 4 dimensiones ponderadas:

$$\text{Puntaje Total} = \text{Posición y Habilidades (35)} + \text{Elegibilidad Bolivia (25)} + \text{Contrato y Nivel (20)} + \text{Idiomas (20)}$$

```
  ┌───────────────────────────────────────────────────────────────┐
  │ Posición & Habilidades: 35 pts                                │
  │   - Coincidencia con las 25 categorías profesionales          │
  │                                                               │
  │ Elegibilidad Remota Bolivia: 25 pts                           │
  │   - 25 pts: Explícitamente Bolivia / LATAM / UTC-4            │
  │   - 23 pts: Remoto Global / Work From Anywhere                │
  │   - 19 pts: Remoto internacional con traslape horario         │
  │   -  0 pts: Restringido a país local (descartada en ingesta)  │
  │                                                               │
  │ Modalidad de Contrato & Experiencia: 20 pts                   │
  │   - Contrato buscado: Full-time, Half-time, Proyectos, Horas  │
  │   - Nivel de experiencia requerido vs declarado               │
  │                                                               │
  │ Idiomas Requeridos (Español / Inglés): 20 pts                 │
  │   - Solo Español: 20 pts primario ES, 17 pts bilingüe;        │
  │     excluye ofertas solo en inglés                            │
  │   - Solo Inglés: 20 pts primario EN, 17 pts bilingüe;         │
  │     excluye ofertas solo en español                           │
  │   - Ambos (ES + EN): 20 pts para todas las ofertas ES/EN      │
  └───────────────────────────────────────────────────────────────┘
```

---

### Motor de ingesta y 86 plataformas públicas monitoreadas

El escáner ([`src/scanner.js`](src/scanner.js)) monitorea 86 bolsas de empleo públicas agrupadas en 6 categorías:
- **B2B Directo & Freelance:** Arc.dev, Contra, Freelancer, Workana, SoyFreelancer.
- **Entrenamiento IA & RLHF:** Alignerr, DataAnnotation, Outlier, Mindrift, Remotasks.
- **Redes LATAM & Globales:** Torre.ai, GetOnBoard, Virtual Latinos, LatinHire, HireLatam, SheWorks, Turing, BairesDev.
- **Portales Europeos & Globales:** Welcome to the Jungle, WeLoveDevs, Malt, Emploi-Belgique.
- **Redes de Consultoría Experta:** GLG, AlphaSights, Dialectica, Guidepoint.
- **Bolsas de Empleo Remoto:** Himalayas, We Work Remotely, Remotive, NoDesk, DailyRemote, Jobspresso, Dynamite Jobs, RemoteOK, Working Nomads, RemoteYeah.

---

### Sincronización de plataformas personalizadas al código semilla

Cuando un usuario agrega y escanea una nueva URL mediante el panel interactivo (`POST /api/platforms/scan-url`), el sistema registra la plataforma con identificador `custom_<dominio>` en el estado vivo (`/api/state`) y en la caché perimetral.

Para incorporar de forma permanente las nuevas plataformas `custom_*` dentro de los archivos base del repositorio ([`platforms_config.json`](platforms_config.json), [`src/seed_data.js`](src/seed_data.js) e [`index.html`](index.html)):

```bash
npm run sync-platforms
```

También es posible registrar y sincronizar una nueva URL en un solo paso:

```bash
node sync_platforms.mjs --add-url https://remoteyeah.com --name "RemoteYeah" --type html_board
```

---

### Ciclo de ejecución bajo demanda y cron cada 15 minutos

La plataforma combina dos modos de refresco:

- **Automático en segundo plano (Cloudflare Cron Trigger):**  
  Declarado en [`wrangler.toml`](wrangler.toml) como `crons = ["*/15 * * * *"]`. Cada 15 minutos, el worker sondea un lote rotativo de plataformas y persiste únicamente las nuevas vacantes 100% elegibles para Bolivia en la caché perimetral.
- **Bajo demanda del usuario:**  
  La interfaz gráfica realiza llamadas a `/api/scan` y `/api/platforms/scan-url` permitiendo disparar una actualización instantánea en cualquier momento.

---

## Guía de Instalación y Auto-Alojamiento (Self-Hosting)

Puedes alojar tu propia instancia en Cloudflare en menos de 5 minutos utilizando una cuenta gratuita.

### Requisitos previos

- **Node.js** v20.0.0 o superior ([nodejs.org](https://nodejs.org/)).
- **Cuenta de Cloudflare** gratuita ([dash.cloudflare.com](https://dash.cloudflare.com/)).
- **Git** instalado en tu sistema.

---

### Instalación local y pruebas

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/t0m-a/scout-analyst-pipeline.git
   cd scout-analyst-pipeline
   ```

2. **Generar el HTML autónomo y verificar la suite de pruebas automatizadas:**
   ```bash
   npm run build-html && npm test
   ```
   *Ejecuta 8 grupos de prueba automáticos que validan:*
   - Interfaz web en Español (Bolivia), menú **Información Utiles**, auto-cierre suave de desplegables, botón **Arriba**, modo oscuro, panel contextual `#ai-position-details` y ejecución real en sandbox VM del cambio en vivo de idiomas (`Solo Español`, `Ambos`, `Solo Inglés`).
   - Estado general del servicio con 86 plataformas monitoreadas y garantía de elegibilidad 100% remota desde Bolivia.
   - Evaluación simétrica de idiomas (`['es']`, `['en']`, `['es', 'en']` y respaldo limpio de valores heredados).
   - Cobertura de las 25 categorías profesionales y filtro estricto de área (`strict_position_match`).
   - Generación instantánea del reporte de resultados en Markdown (`/api/results.md`).
   - Escaneo de URLs externas (`/api/platforms/scan-url`), exportación `custom_*` (`/api/platforms/sync`), enriquecimiento de posiciones con Workers AI (`/api/ai/analyze-position` y `/api/ai/enrich`), búsqueda vectorial (`/api/search/semantic`) y servidor MCP (`/mcp`).
   - Disponibilidad del favicon vectorial (`/favicon.svg`, `/favicon.ico`), `sitemap.xml` y `robots.txt`.
   - Auditoría estricta de integridad: cero datos privados no autorizados ni emojis en los archivos del repositorio.

3. **Iniciar el servidor local de desarrollo con Wrangler:**
   ```bash
   npm run dev
   ```
   Wrangler levantará la aplicación en `http://localhost:8787`, simulando de forma idéntica el entorno de Cloudflare Workers.

---

### Despliegue público en Cloudflare Workers

1. **Iniciar sesión en tu cuenta de Cloudflare desde la terminal:**
   ```bash
   npx wrangler login
   ```

2. **Publicar el Worker a nivel mundial:**
   ```bash
   npm run deploy
   ```

> [!IMPORTANT]
> **El Cron Trigger queda activo automáticamente:**  
> Al desplegar, Cloudflare programa la ejecución del escaneo cada 15 minutos sin que tengas que configurar tareas de cron en Linux ni administradores de tareas en Windows.

---

### Generación de HTML autónomo (Standalone)

Si deseas utilizar la interfaz como un archivo HTML único sin desplegar el Worker (por ejemplo, para abrirlo localmente en tu navegador o alojarlo en GitHub Pages / Nginx):

```bash
npm run build-html
```

Este comando empaqueta los datos base, el evaluador y el analizador determinístico de posiciones directamente dentro de [`index.html`](index.html), permitiendo abrir el archivo en cualquier navegador con doble clic.

---

## Referencia de la API REST

El worker expone endpoints HTTP estándar para integraciones externas:

| Método | Ruta | Parámetros / Cuerpo | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Ninguno | Retorna la aplicación web interactiva completa en Español (Bolivia) (HTML5/CSS3/JS). |
| `GET` | `/api/state` | Ninguno | Retorna el listado completo de plataformas registradas y ofertas 100% elegibles para Bolivia en JSON. |
| `POST` | `/api/evaluate` | JSON `{ filters: { languages, position_types, experience_levels, contract_types, strict_position_match } }` | Evalúa dinámicamente el catálogo frente a los filtros provistos (`languages`: `["es"]`, `["en"]` o `["es","en"]`) y retorna las ofertas ordenadas con sus puntajes. |
| `POST` | `/api/scan` | JSON opcional `{ track, platform }` | Ejecuta un escaneo de actualización bajo demanda sobre las plataformas monitoreadas. |
| `POST` | `/api/platforms/scan-url` | JSON `{ url, name, type, track, filters }` | Escanea cualquier URL ingresada por el usuario, extrae ofertas 100% elegibles para Bolivia y las añade a la base. |
| `GET` / `POST` | `/api/platforms/sync` | Ninguno | Exporta las plataformas personalizadas (`custom_*`) y sus oportunidades asociadas desde el estado vivo, sincronizándolas con los archivos semilla cuando el sistema de archivos local está disponible. |
| `POST` | `/api/ai/analyze-position` | JSON `{ target_job_hash, title, company, location, description, tags }` | Analiza la información disponible de una posición con Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast`, con respaldo `edge-position-analyzer`) y devuelve resumen, requisitos, habilidades/experiencia útiles, compatibilidad con Bolivia (`UTC-4`) y consejos para el candidato. |
| `POST` | `/api/ai/enrich` | JSON `{ job_hash, max_items }` | Enriquece oportunidades bajo demanda con Cloudflare Workers AI (`env.AI`), extrayendo remuneración referencial en USD y resúmenes ejecutivos. |
| `GET` / `POST` | `/api/search/semantic` | Query `?q=...` o JSON `{ query, filters, topK }` | Búsqueda semántica multilingüe (`@cf/baai/bge-m3` + Cloudflare Vectorize / puente Qdrant / vectores semánticos de borde) que ordena vacantes por similitud vectorial y puntaje híbrido. |
| `POST` | `/api/vectors/index` | JSON `{ max_items, deduplicate }` | Indexa vacantes elegibles en Cloudflare Vectorize (`env.VECTORIZE`) o Qdrant (`env.QDRANT_URL`) y ejecuta deduplicación semántica por similitud de coseno. |
| `GET` / `POST` | `/mcp` (`/.well-known/mcp.json`) | JSON-RPC 2.0 (`initialize`, `tools/list`, `tools/call`, `resources/read`) | Servidor **Model Context Protocol (MCP)** sobre Streamable HTTP (protegido por token Bearer) con 5 herramientas (`search_bolivia_remote_jobs`, `semantic_search_bolivia_jobs`, `scan_career_page_url`, `analyze_position_for_bolivia`, `list_monitored_platforms`) y 2 recursos en vivo. |
| `GET` | `/api/results.md` | Query: `?lang=es` o `?lang=en` | Genera y descarga el reporte de Resultados al instante en formato Markdown puro. |
| `GET` | `/favicon.svg` | Ninguno | Retorna el favicon vectorial en SVG del planeta Tierra con los colores de la bandera de Bolivia (`#EF4444`, `#FDE047`, `#10B981`). |
| `GET` | `/favicon.ico` | Ninguno | Favicon en formato ICO para compatibilidad universal con navegadores antiguos. |
| `GET` | `/favicon.png` | Ninguno | Favicon rasterizado en PNG para dispositivos móviles y Apple Touch Icon. |

#### Ejemplo con `curl`: Escaneo de una URL personalizada
```bash
curl -X POST https://bolivia-remote-scout.workers.dev/api/platforms/scan-url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://remotive.com/api/remote-jobs?category=devops&limit=10",
    "name": "Remotive DevOps Feed",
    "type": "json_api"
  }'
```

---

## Licencia

Este proyecto es software libre y de código abierto bajo la licencia **GNU General Public License v3.0 (GPL-3.0)**. Eres libre de usarlo, estudiarlo, compartirlo y mejorarlo para beneficiar a la comunidad.

---

<div align="center">
  <sub>Construido con tecnología de borde en Cloudflare Workers para impulsar oportunidades de empleo remoto desde Bolivia hacia el mundo.</sub>
</div>
