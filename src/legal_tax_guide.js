/**
 * Spanish Legal & Tax Guide Page Markup for Bolivian Remote Independent Contractors
 * Integrated into #view-legal-tax and accessible via "Información Útil" menu and /guia-legal-fiscal.
 * Zero emojis, zero traditional U.S. W-2 employee content, verified primary sources (Nov 2026).
 */

export const LEGAL_TAX_GUIDE_HTML = `
      <div class="manual-container">
        <article class="manual-card">
          <div class="doc-view-header">
            <h3 id="legal-h-intro" style="margin:0;">Guía Legal y Fiscal: Contratistas Remotos desde Bolivia (Clientes en EE. UU.)</h3>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <button type="button" class="btn-action btn-primary" onclick="switchMainView('results')"><span id="legal-btn-back">Volver a la Página Principal</span></button>
            </div>
          </div>

          <p id="legal-p-intro">
            Esta guía práctica y verificada (actualizada en <strong>noviembre de 2026</strong>) reúne exclusivamente la información legal, fiscal y migratoria relevante para <strong>contratistas independientes y profesionales remotos que viven en Bolivia</strong> y prestan servicios a empresas de Estados Unidos <strong>desde fuera del territorio estadounidense</strong>. No cubre relaciones laborales tradicionales en EE. UU. (W-2) ni trabajo ejecutado dentro de Estados Unidos.
          </p>

          <div class="info-callout warning" id="legal-box-disclaimer">
            <strong>Aviso informativo:</strong> Este contenido tiene fines estrictamente informativos y resume normativa pública de EE. UU. y Bolivia. No constituye asesoramiento legal ni contable personalizado; consulta con un <em>contador público</em> autorizado en Bolivia o un especialista tributario para tu caso particular.
          </div>

          <div class="info-callout" id="legal-box-summary">
            <strong>Resumen clave para trabajo 100% remoto desde Bolivia:</strong>
            <ul style="margin:6px 0 0 18px;padding:0;">
              <li><strong>Impuesto federal en EE. UU.:</strong> <strong>0%</strong> (<em>IRC &sect; 862(a)(3)</em> — ingresos de fuente extranjera, sin retención del 30% ni impuestos de Seguro Social/Medicare de EE. UU.).</li>
              <li><strong>Documento para tu cliente en EE. UU.:</strong> Entrega el <strong>Formulario W-8BEN</strong> (individual) o <strong>W-8BEN-E</strong> (entidad boliviana) firmado directamente al cliente (no se envía al IRS).</li>
              <li><strong>Tratado fiscal EE. UU.–Bolivia:</strong> <strong>No existe</strong>; deja en blanco la <strong>Parte II</strong> del Formulario W-8BEN.</li>
              <li><strong>Visa estadounidense:</strong> <strong>No se requiere</strong> para trabajar remotamente desde Bolivia.</li>
              <li><strong>Impuestos en Bolivia:</strong> El trabajo ejecutado físicamente en Bolivia es <strong>ingreso de fuente boliviana</strong> (<em>Ley N° 843</em>); tu cumplimiento principal corresponde al <strong>SIN</strong> (NIT, SIAT y RC-IVA trimestral).</li>
            </ul>
          </div>

          <h4 style="margin:20px 0 14px 0;font-size:1.08em;display:flex;align-items:center;gap:8px;padding-bottom:8px;">
            Marco Legal y Tributario Paso a Paso
          </h4>

          <!-- SECCION 1 -->
          <div class="guide-step">
            <div class="guide-step-header">
              <span class="guide-step-num">1</span>
              <h5 class="guide-step-title">Reglas Fiscales de EE. UU.: Ubicación Física y Fuente Extranjera</h5>
            </div>
            <div class="guide-step-body">
              Bajo el Código de Rentas Internas de EE. UU., el criterio decisivo para servicios personales prestados por un extranjero no residente es el <strong>lugar físico donde ejecutas el trabajo</strong>, y no dónde está domiciliado el cliente ni dónde recibes el pago:
              <ul>
                <li><strong>Servicios ejecutados 100% fuera de EE. UU. (<code>26 U.S.C. &sect; 862(a)(3)</code>):</strong> Se clasifican como <strong>ingresos de fuente extranjera</strong>. No generas impuesto federal estadounidense, no corresponde retención del 30% (con W-8 vigente), no pagas impuestos estadounidenses de autoempleo/Seguro Social/Medicare, no recibes <strong>Formulario 1099-NEC</strong> y tu cliente <strong>no está obligado a presentar el Formulario 1042-S</strong>.</li>
                <li><strong>Si tu cliente reporta voluntariamente en Form 1042-S:</strong> Las instrucciones del IRS indican usar el <strong>Código de Exención 03</strong> (<em>"Income is not from U.S. sources"</em>) con $0 retenido.</li>
                <li><strong>Ausencia de tratado fiscal EE. UU.–Bolivia:</strong> No existe convenio bilateral de doble tributación. Para trabajo 100% remoto desde Bolivia esto <strong>no</strong> genera impuestos en EE. UU., porque tu exención nace de la ley interna de fuente extranjera (<em>IRC &sect; 862(a)(3)</em>), no de un tratado. No uses el Formulario 8233 ni completes la Parte II del W-8BEN.</li>
              </ul>
              <div class="guide-tip">
                <strong>Atención si viajas a EE. UU. (<code>26 U.S.C. &sect; 861(a)(3)</code>):</strong> Si ejecutas trabajo facturable mientras estás físicamente en suelo estadounidense, esos días se consideran <strong>ingreso de fuente estadounidense</strong> sujetos a <strong>30% de retención</strong>, reporte obligatorio en <strong>Form 1042-S</strong> (presentado vía el sistema <strong>IRIS</strong> del IRS tras el retiro del sistema heredado FIRE), solicitud de <strong>ITIN (Form W-7)</strong> y declaración mediante <strong>Form 1040-NR</strong> (el antiguo Form 1040-NR-EZ fue eliminado en 2020). La excepción estrecha de 90 días / $3,000 no aplica cuando contratas directamente con una empresa domiciliada en EE. UU.
              </div>
            </div>
          </div>

          <!-- SECCION 2 -->
          <div class="guide-step">
            <div class="guide-step-header">
              <span class="guide-step-num">2</span>
              <h5 class="guide-step-title">Formularios W-8BEN, W-8BEN-E e ITIN</h5>
            </div>
            <div class="guide-step-body">
              Para respaldar la ausencia de retención en EE. UU., entrega el formulario correspondiente (revisión vigente <strong>octubre de 2021</strong>) directamente a tu cliente o plataforma de pagos:
              <ul>
                <li><strong>Form W-8BEN:</strong> Para personas naturales que contratan como profesionales independientes o <em>freelancers</em>.</li>
                <li><strong>Form W-8BEN-E:</strong> Si facturas y contratas mediante una sociedad boliviana constituida (p. ej., <em>S.R.L.</em> o <em>S.A.</em>).</li>
                <li><strong>¿Necesitas ITIN?</strong> <strong>No</strong>, si el 100% de tu trabajo se ejecuta fuera de EE. UU. y no tienes otros ingresos gravados de fuente estadounidense.</li>
              </ul>
              <div class="legal-table-wrap">
                <table class="legal-table">
                  <thead>
                    <tr>
                      <th>Campo del Form W-8BEN</th>
                      <th>Cómo completarlo desde Bolivia</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Líneas 1 y 2</strong> (Nombre y ciudadanía)</td>
                      <td>Tu nombre legal completo (como en pasaporte) y <code>Bolivia</code> (o tu país de ciudadanía).</td>
                    </tr>
                    <tr>
                      <td><strong>Línea 3</strong> (Residencia permanente)</td>
                      <td>Tu dirección física real en Bolivia (sin casillas postales ni direcciones en EE. UU.).</td>
                    </tr>
                    <tr>
                      <td><strong>Línea 5</strong> (U.S. SSN / ITIN)</td>
                      <td><strong>Dejar en blanco</strong> si no tienes SSN ni ITIN.</td>
                    </tr>
                    <tr>
                      <td><strong>Líneas 6a y 6b</strong> (FTIN)</td>
                      <td>Ingresa tu <strong>NIT</strong> boliviano (o CI si la plataforma lo solicita) en 6a; o marca la casilla <strong>6b</strong> si no estás legalmente obligado a proporcionar un FTIN para servicios sin reclamo de tratado.</td>
                    </tr>
                    <tr>
                      <td><strong>Parte II (Líneas 9–10)</strong></td>
                      <td><strong>Dejar completamente en blanco</strong> (no existe tratado tributario EE. UU.–Bolivia).</td>
                    </tr>
                    <tr>
                      <td><strong>Parte III (Certificación)</strong></td>
                      <td>Firma, nombre impreso y fecha en formato estadounidense <code>MM-DD-AAAA</code>.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="guide-tip">
                <strong>Vigencia oficial:</strong> El Formulario W-8BEN es válido desde su firma <strong>hasta el 31 de diciembre del tercer año calendario siguiente</strong> (por ejemplo, firmado en 2026 vence el <strong>31 de diciembre de 2029</strong>). Si cambia tu residencia o estatus fiscal antes de esa fecha, debes notificar al cliente en un plazo máximo de <strong>30 días</strong>.
              </div>
            </div>
          </div>

          <!-- SECCION 3 -->
          <div class="guide-step">
            <div class="guide-step-header">
              <span class="guide-step-num">3</span>
              <h5 class="guide-step-title">Visas de EE. UU. y Viajes Cortos de Negocios desde Bolivia</h5>
            </div>
            <div class="guide-step-body">
              <ul>
                <li><strong>Trabajo remoto desde Bolivia:</strong> <strong>No requieres visa de trabajo estadounidense</strong> ni autorización de USCIS; la ley migratoria de EE. UU. solo rige actividades físicas dentro de sus fronteras.</li>
                <li><strong>Visitas breves a EE. UU. (Visa B-1 / B-1/B-2):</strong> Bolivia <strong>no</strong> forma parte del programa ESTA (<em>Visa Waiver Program</em>). Si un cliente te invita a reuniones o conferencias, debes solicitar una visa <strong>B-1/B-2</strong> ante la <strong>Embajada de EE. UU. en La Paz</strong> y demostrar lazos sólidos con Bolivia (<em>INA &sect; 214(b)</em>).</li>
                <li><strong>Permitido bajo <code>9 FAM 402.2-5(B)</code>:</strong> Asistir a reuniones, consultas con clientes, negociaciones contractuales y conferencias profesionales.</li>
                <li><strong>Estrictamente prohibido con visa B-1/B-2:</strong> Ejecutar trabajo operativo o entregables facturables dentro de territorio estadounidense o recibir pagos de fuente estadounidense por labores hechas en EE. UU. (solo se permiten reembolsos de gastos de viaje y estadía).</li>
              </ul>
            </div>
          </div>

          <!-- SECCION 4 -->
          <div class="guide-step">
            <div class="guide-step-header">
              <span class="guide-step-num">4</span>
              <h5 class="guide-step-title">Impuestos y Cumplimiento en Bolivia (SIN, SIAT y Gestora Pública)</h5>
            </div>
            <div class="guide-step-body">
              Bolivia aplica un <strong>sistema tributario territorial</strong>, pero conforme al <strong>Artículo 21 de la Ley N° 843</strong>, cualquier servicio <strong>prestado físicamente dentro de territorio boliviano</strong> genera <strong>ingresos de fuente boliviana</strong>, independientemente de que el cliente resida en EE. UU. o pague en cuentas del exterior. Para operar formalmente te inscribes en el <strong>SIN</strong> con <strong>NIT (Régimen General)</strong> y gestionas facturación en <strong>SIAT en Línea</strong>:
              <div class="legal-table-wrap">
                <table class="legal-table">
                  <thead>
                    <tr>
                      <th>Tributo / Aporte</th>
                      <th>Alícuota</th>
                      <th>Aplicación para Contratistas Remotos en Bolivia</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>IVA</strong> (Exportación de Servicios)</td>
                      <td><strong>0%</strong> (Exento de débito fiscal; tasa general 13%)</td>
                      <td>Bajo el <strong>Art. 11 de la Ley N° 843</strong> y la <strong>RND N° 102100000011</strong>, los servicios prestados en Bolivia aprovechados económicamente en el exterior están liberados del IVA. Se respaldan emitiendo una <strong>Factura Comercial de Exportación sin Derecho a Crédito Fiscal</strong> vía SIAT.</td>
                    </tr>
                    <tr>
                      <td><strong>RC-IVA</strong> (Profesionales Independientes)</td>
                      <td><strong>13%</strong> (Trimestral, <strong>Form. 610</strong>)</td>
                      <td>Desde enero de 2023 (<strong>Ley N° 1448</strong> y <strong>DS N° 4850</strong>), los <em>profesionales liberales u oficios</em> pasaron del antiguo IUE (25%) al <strong>RC-IVA directo trimestral</strong> sobre el <strong>87%</strong> de los ingresos brutos facturados, deduciendo aportes a la seguridad social y compensando con el 13% de facturas de compras personales (hasta 120 días de antigüedad) mediante el <strong>Formulario 110</strong>.</td>
                    </tr>
                    <tr>
                      <td><strong>IT</strong> (Impuesto a las Transacciones)</td>
                      <td><strong>3%</strong> mensual (<strong>Form. 400</strong>)</td>
                      <td><strong>Matiz normativo:</strong> El Art. 76 inc. c) de la Ley N° 843 exime expresamente la exportación de <em>mercaderías</em> físicas aduaneras, dejando un vacío legal para servicios intangibles. Valida el tratamiento vigente del IT para tu actividad económica con un <em>contador</em> boliviano.</td>
                    </tr>
                    <tr>
                      <td><strong>IUE</strong> (Utilidades de Empresas)</td>
                      <td><strong>25%</strong> anual (<strong>Form. 500</strong>)</td>
                      <td>Ya no aplica a <em>profesionales liberales u oficios</em> (que tributan RC-IVA). Sigue aplicando si operas constituido como sociedad comercial (p. ej., <em>S.R.L.</em>).</td>
                    </tr>
                    <tr>
                      <td><strong>Gestora Pública</strong> (Pensiones — Ley N° 065)</td>
                      <td><strong>Voluntario</strong> (~14,42% si eliges aportar)</td>
                      <td>Para contratistas independientes privados del exterior los aportes al SIP son <strong>voluntarios</strong>. Si decides afiliarte como independiente (base entre 1 y 60 SMN), los aportes pagados son <strong>deducibles en tu RC-IVA trimestral</strong>.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="guide-tip">
                <strong>Respaldo bancario (SWIFT / AML):</strong> Conservar tu contrato internacional firmado junto con tus <strong>Facturas Comerciales de Exportación en SIAT</strong> facilita los controles de cumplimiento de los bancos bolivianos al recibir transferencias internacionales.
              </div>
            </div>
          </div>

          <!-- SECCION 5 -->
          <div class="guide-step">
            <div class="guide-step-header">
              <span class="guide-step-num">5</span>
              <h5 class="guide-step-title">Cláusulas Clave para Protegerte en tu Contrato Internacional</h5>
            </div>
            <div class="guide-step-body">
              Como contratista independiente fuera de EE. UU. (donde las leyes laborales estadounidenses como la FLSA no aplican por exclusión expresa de <code>29 U.S.C. &sect; 213(f)</code>), tu contrato escrito define todas tus garantías. Verifica siempre estos puntos antes de firmar:
              <ul>
                <li><strong>Autonomía e independencia:</strong> Confirma que operas como contratista independiente desde Bolivia, con control sobre tus herramientas, horarios y derecho a trabajar con otros clientes.</li>
                <li><strong>Alcance y entregables claros:</strong> Define hitos, entregables y criterios de aprobación concretos para evitar ampliaciones no remuneradas.</li>
                <li><strong>Pagos en USD y comisiones:</strong> Especifica tarifa en <strong>USD</strong>, calendario de facturación, plazo de pago (p. ej., Net 15/30), pasarela (SWIFT, Wise, Payoneer, AirTM, Tipalti, Deel) y <strong>quién cubre las comisiones de transferencia</strong>.</li>
                <li><strong>Cláusula fiscal y cero retención en EE. UU.:</strong> Deja sentado que asumes tus impuestos en Bolivia y que el cliente no retendrá impuestos estadounidenses al contar con tu W-8BEN/W-8BEN-E vigente.</li>
                <li><strong>Propiedad Intelectual (PI) y herramientas propias:</strong> Condiciona la cesión de PI de los entregables al <strong>pago completo</strong> y excluye expresamente tus herramientas, código o metodologías previas (<em>Background IP</em>).</li>
                <li><strong>Terminación y pago proporcional:</strong> Incluye preaviso mutuo (14–30 días) y obligación de liquidar todo trabajo o hito ejecutado hasta la fecha de cierre.</li>
                <li><strong>Ley aplicable y disputas:</strong> Frente a litigios costosos en tribunales de EE. UU., negocia <strong>mediación o arbitraje comercial en línea</strong> (referencia: <em>Principios HCCH sobre Elección del Derecho Aplicable</em>) y, si lo requieres para trámites en Bolivia, una versión bilingüe inglés/español.</li>
              </ul>
            </div>
          </div>

          <!-- SECCION 6 -->
          <div class="guide-step" style="margin-bottom:0;">
            <div class="guide-step-header">
              <span class="guide-step-num">6</span>
              <h5 class="guide-step-title">Fuentes Oficiales Verificadas</h5>
            </div>
            <div class="guide-step-body">
              Todas las referencias legales y fiscales de esta guía fueron verificadas directamente en normativa y portales oficiales:
              <ul class="legal-sources-list">
                <li><strong>EE. UU. — Código Tributario (Fuente de ingresos):</strong> <a href="https://www.law.cornell.edu/uscode/text/26/862" target="_blank" rel="noopener noreferrer">26 U.S.C. &sect; 862 (Fuente extranjera)</a> · <a href="https://www.law.cornell.edu/uscode/text/26/861" target="_blank" rel="noopener noreferrer">26 U.S.C. &sect; 861 (Fuente estadounidense)</a> · <a href="https://www.law.cornell.edu/uscode/text/29/213" target="_blank" rel="noopener noreferrer">29 U.S.C. &sect; 213(f) (Exclusión territorial FLSA)</a></li>
                <li><strong>IRS — Servicios y Formularios W-8:</strong> <a href="https://www.irs.gov/individuals/international-taxpayers/pay-for-personal-services-performed" target="_blank" rel="noopener noreferrer">Pay for Personal Services Performed</a> · <a href="https://www.irs.gov/forms-pubs/about-form-w-8-ben" target="_blank" rel="noopener noreferrer">About Form W-8BEN</a> · <a href="https://www.irs.gov/instructions/iw8ben" target="_blank" rel="noopener noreferrer">Instrucciones W-8BEN</a> · <a href="https://www.irs.gov/forms-pubs/about-form-w-8-ben-e" target="_blank" rel="noopener noreferrer">About Form W-8BEN-E</a></li>
                <li><strong>IRS — Tratados, 1042-S, IRIS, 1040-NR e ITIN:</strong> <a href="https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z" target="_blank" rel="noopener noreferrer">U.S. Income Tax Treaties A–Z</a> · <a href="https://www.irs.gov/instructions/i1042s" target="_blank" rel="noopener noreferrer">Instrucciones Form 1042-S</a> · <a href="https://www.irs.gov/filing/e-file-information-returns-with-iris" target="_blank" rel="noopener noreferrer">Sistema IRIS (Retiro FIRE)</a> · <a href="https://www.irs.gov/forms-pubs/about-form-1040-nr" target="_blank" rel="noopener noreferrer">About Form 1040-NR</a> · <a href="https://www.irs.gov/forms-pubs/about-form-w-7" target="_blank" rel="noopener noreferrer">About Form W-7 (ITIN)</a></li>
                <li><strong>Visas de EE. UU. para Bolivia:</strong> <a href="https://fam.state.gov/fam/09FAM/09FAM040202.html" target="_blank" rel="noopener noreferrer">Departamento de Estado — 9 FAM 402.2 (Visas B-1/B-2)</a> · <a href="https://bo.usembassy.gov/visas/" target="_blank" rel="noopener noreferrer">Embajada de EE. UU. en Bolivia (La Paz)</a></li>
                <li><strong>Bolivia — Tributación, Pensiones y Contratos:</strong> <a href="https://www.impuestos.gob.bo/" target="_blank" rel="noopener noreferrer">Servicio de Impuestos Nacionales (SIN / SIAT)</a> · <a href="https://taxsummaries.pwc.com/bolivia/individual/taxes-on-personal-income" target="_blank" rel="noopener noreferrer">PwC Worldwide Tax Summaries — Bolivia (Personas)</a> · <a href="https://taxsummaries.pwc.com/bolivia/individual/foreign-tax-relief-and-tax-treaties" target="_blank" rel="noopener noreferrer">PwC Bolivia — Tratados</a> · <a href="https://www.gestora.bo/" target="_blank" rel="noopener noreferrer">Gestora Pública (Ley N° 065)</a> · <a href="https://www.hcch.net/en/instruments/conventions/full-text/?cid=135" target="_blank" rel="noopener noreferrer">HCCH — Principios de Elección de Ley</a></li>
              </ul>
            </div>
          </div>
        </article>
      </div>
`;
