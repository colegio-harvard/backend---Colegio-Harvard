const crypto = require('crypto');
const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');

const DOCUMENTOS_BASE = [
  { clave: 'acta_compromiso', nombre: 'Acta de compromiso y aceptación de las condiciones del servicio educativo', obligatorio: true },
  { clave: 'contrato', nombre: 'Contrato de prestación del servicio educativo', obligatorio: true },
  { clave: 'reglamento', nombre: 'Reglamento interno', obligatorio: true },
  { clave: 'economico', nombre: 'Condiciones y compromiso económico', obligatorio: true },
  { clave: 'datos', nombre: 'Tratamiento de datos personales', obligatorio: true },
  { clave: 'convivencia', nombre: 'Normas de convivencia escolar', obligatorio: true },
  { clave: 'emergencia', nombre: 'Ficha de emergencia y personas autorizadas para recoger al estudiante', obligatorio: true },
];
const COMPROMISO_INSTITUCIONAL = 'Me comprometo a cumplir y promover las normas de la institución, enseñarlas y hacerlas respetar por el estudiante, involucrándome activamente en su proceso de aprendizaje y reconociendo que la educación es una responsabilidad compartida.';
const USO_IMAGEN_TEXTO = 'Autorización voluntaria para utilizar fotografías, grabaciones de audio o videos del estudiante con fines educativos, informativos o institucionales, respetando su dignidad, privacidad, integridad y bienestar. La negativa no afecta la matrícula ni la prestación del servicio educativo.';
const AUTORIZACIONES = {
  tratamiento_datos: 'Autorizo al Colegio Harvard a tratar los datos personales del representante legal y del estudiante para finalidades educativas, administrativas, estadísticas vinculadas al servicio y de cobranza. Los datos se conservarán durante la relación contractual y los plazos legales aplicables. He sido informado de que puedo ejercer mis derechos de acceso, rectificación, cancelación y oposición mediante los canales oficiales del colegio.',
  comunicaciones_contractuales: 'Autorizo el envío de notificaciones físicas al domicilio y de comunicaciones al teléfono fijo, teléfono móvil y correo electrónico registrados, para formalizar la matrícula y realizar actos administrativos o contractuales relacionados con el servicio educativo.',
  reporte_crediticio: 'Declaro haber sido informado y autorizo que, ante incumplimientos de pago y cuando corresponda conforme a la Ley N.° 27489, el colegio comunique información pertinente sobre la obligación y su historial de pago a centrales privadas de información de riesgos, respetando los límites y derechos establecidos por ley.',
  emergencia_medica: 'Autorizo que, ante una emergencia y cuando no sea posible esperar instrucciones, el colegio traslade al estudiante al centro de salud declarado en esta ficha o al establecimiento disponible más cercano, comunicándolo al contacto de emergencia.',
  comunicaciones_comerciales: 'Autorizo voluntariamente el uso de mis datos de contacto para recibir información comercial o promocional sobre servicios y actividades del Colegio Harvard. Puedo retirar esta autorización posteriormente sin afectar la matrícula ni el servicio educativo.',
};
const AUTORIZACIONES_OBLIGATORIAS = ['tratamiento_datos', 'comunicaciones_contractuales', 'reporte_crediticio', 'emergencia_medica'];
const ESTADOS_REVISION = new Set(['OBSERVADA', 'COMPLETADA']);
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const json = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};
const ipCliente = (req) => String(req.ip || req.headers['x-forwarded-for'] || '').slice(0, 80);
const agenteCliente = (req) => String(req.headers['user-agent'] || '').slice(0, 1000);
const fechaLima = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const fechaISO = (value) => value ? new Date(value).toISOString().slice(0, 10) : null;
const dentroDeCampana = (config) => (!config.fecha_inicio || fechaLima() >= fechaISO(config.fecha_inicio)) && (!config.fecha_fin || fechaLima() <= fechaISO(config.fecha_fin));

async function anioActivo() {
  return prisma.tbl_anios_escolares.findFirst({ where: { activo: true }, orderBy: { anio: 'desc' } });
}

async function registrarEvento(idMatricula, evento, detalle, req, creadoPor = null) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "tbl_eventos_matricula" ("id_matricula","evento","detalle_json","ip","agente","creado_por") VALUES ($1,$2,$3::jsonb,$4,$5,$6)`,
    Number(idMatricula), evento, JSON.stringify(detalle || {}), ipCliente(req), agenteCliente(req), creadoPor,
  );
}

function documentosConfigurados(config) {
  const configurados = json(config?.documentos_json, []);
  const docs = Array.isArray(configurados) ? configurados.filter((doc) => doc?.clave !== 'imagen') : [];
  if (!Array.isArray(docs) || !docs.length) return DOCUMENTOS_BASE;
  const claves = new Set(docs.map((doc) => doc.clave));
  return [...docs, ...DOCUMENTOS_BASE.filter((doc) => !claves.has(doc.clave))];
}

async function obtenerDeuda(idAlumno) {
  const filas = await prisma.$queryRawUnsafe(`
    SELECT COALESCE(SUM(GREATEST(COALESCE(ep.monto_total,0)-COALESCE(ep.monto_pagado,0),0)),0)::numeric deuda
    FROM "tbl_estado_pension" ep
    WHERE ep.id_alumno=$1 AND ep.estado IN ('PENDIENTE','PAGO_PARCIAL')`, Number(idAlumno));
  return Number(filas[0]?.deuda || 0);
}

async function bootstrap(req, res) {
  try {
    const anio = await anioActivo();
    if (!anio) return res.status(400).json({ error: 'No hay año escolar activo' });
    const [configRows, alumnos] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT * FROM "tbl_config_matricula" WHERE id_anio_escolar=$1`, anio.id),
      prisma.$queryRawUnsafe(`
        SELECT al.id,al.codigo_alumno,al.nombre_completo,al.dni,al.estado,
          al.monto_matricula,al.monto_materiales,al.monto_pension,
          p.id id_padre,p.nombre_completo apoderado,p.dni dni_apoderado,p.celular,
          g.nombre grado,a.seccion,n.nombre nivel,
          md.id id_matricula,md.codigo,md.estado estado_matricula,md.creado_en,md.aceptado_en,
          md.deuda_snapshot,md.costo_matricula_snapshot,md.observacion_revision,
          COALESCE(deuda.total,0)::numeric deuda_actual
        FROM "tbl_alumnos" al
        JOIN "tbl_aulas" a ON a.id=al.id_aula
        JOIN "tbl_grados" g ON g.id=a.id_grado
        JOIN "tbl_niveles" n ON n.id=g.id_nivel
        LEFT JOIN "tbl_padres_alumnos" pa ON pa.id_alumno=al.id
        LEFT JOIN "tbl_padres" p ON p.id=pa.id_padre
        LEFT JOIN "tbl_matriculas_digitales" md ON md.id_alumno=al.id AND md.id_anio_escolar=$1
        LEFT JOIN LATERAL (
          SELECT SUM(GREATEST(COALESCE(ep.monto_total,0)-COALESCE(ep.monto_pagado,0),0)) total
          FROM "tbl_estado_pension" ep WHERE ep.id_alumno=al.id AND ep.estado IN ('PENDIENTE','PAGO_PARCIAL')
        ) deuda ON TRUE
        WHERE a.id_anio_escolar=$1 AND al.estado='ACTIVO'
        ORDER BY al.nombre_completo`, anio.id),
    ]);
    const config = configRows[0] || { id_anio_escolar: anio.id, documentos_json: DOCUMENTOS_BASE, activo: true };
    res.json({ data: { anio, config: { ...config, documentos_json: documentosConfigurados(config) }, alumnos } });
  } catch (error) {
    console.error('Error bootstrap matrícula:', error);
    res.status(500).json({ error: 'No se pudo cargar Matrícula Digital' });
  }
}

async function guardarConfiguracion(req, res) {
  try {
    const anio = await anioActivo();
    if (!anio) return res.status(400).json({ error: 'No hay año escolar activo' });
    const enlace = String(req.body.enlace_documentos || '').trim();
    if (enlace && !/^https:\/\//i.test(enlace)) return res.status(400).json({ error: 'El enlace debe comenzar con https://' });
    const documentos = Array.isArray(req.body.documentos_json) ? req.body.documentos_json : DOCUMENTOS_BASE;
    const rows = await prisma.$queryRawUnsafe(`
      INSERT INTO "tbl_config_matricula" ("id_anio_escolar","fecha_inicio","fecha_fin","nombre_documentos","enlace_documentos","version_documentos","documentos_json","activo","creado_por")
      VALUES ($1,$2::date,$3::date,$4,$5,$6,$7::jsonb,$8,$9)
      ON CONFLICT ("id_anio_escolar") DO UPDATE SET
        "fecha_inicio"=EXCLUDED."fecha_inicio","fecha_fin"=EXCLUDED."fecha_fin",
        "nombre_documentos"=EXCLUDED."nombre_documentos","enlace_documentos"=EXCLUDED."enlace_documentos",
        "version_documentos"=EXCLUDED."version_documentos","documentos_json"=EXCLUDED."documentos_json",
        "activo"=EXCLUDED."activo","actualizado_por"=$9,"actualizado_en"=NOW()
      RETURNING *`, anio.id, req.body.fecha_inicio || null, req.body.fecha_fin || null,
      String(req.body.nombre_documentos || 'Documentos oficiales de matrícula').trim(), enlace || null,
      String(req.body.version_documentos || '1.0').trim(), JSON.stringify(documentos), req.body.activo !== false, req.user.id);
    await registrarAuditoria({ userId: req.user.id, accion: 'CONFIGURAR_MATRICULA_DIGITAL', tipoEntidad: 'tbl_config_matricula', idEntidad: rows[0].id, resumen: `Configuración de matrícula ${anio.anio}`, req });
    res.json({ data: { ...rows[0], documentos_json: documentosConfigurados(rows[0]) } });
  } catch (error) {
    console.error('Error configuración matrícula:', error);
    res.status(500).json({ error: 'No se pudo guardar la configuración' });
  }
}

async function invitar(req, res) {
  try {
    const anio = await anioActivo();
    if (!anio) return res.status(400).json({ error: 'No hay año escolar activo' });
    const idAlumno = Number(req.body.id_alumno);
    const datos = await prisma.$queryRawUnsafe(`
      SELECT al.id,al.codigo_alumno,al.nombre_completo,al.dni,al.monto_matricula,al.monto_materiales,al.monto_pension,
        p.id id_padre,p.nombre_completo apoderado,p.dni dni_apoderado,p.celular,
        g.nombre grado,a.seccion,n.nombre nivel
      FROM "tbl_alumnos" al
      JOIN "tbl_aulas" a ON a.id=al.id_aula JOIN "tbl_grados" g ON g.id=a.id_grado JOIN "tbl_niveles" n ON n.id=g.id_nivel
      JOIN "tbl_padres_alumnos" pa ON pa.id_alumno=al.id JOIN "tbl_padres" p ON p.id=pa.id_padre
      WHERE al.id=$1 AND al.estado='ACTIVO'`, idAlumno);
    if (!datos[0]) return res.status(404).json({ error: 'El alumno activo debe tener un apoderado vinculado' });
    const configRows = await prisma.$queryRawUnsafe(`SELECT * FROM "tbl_config_matricula" WHERE id_anio_escolar=$1`, anio.id);
    const config = configRows[0];
    if (!config?.activo) return res.status(409).json({ error: 'Configure y active primero la campaña de matrícula' });
    if (!dentroDeCampana(config)) return res.status(409).json({ error: 'La campaña de matrícula está fuera de sus fechas de inicio y cierre' });
    const matriculasExistentes = await prisma.$queryRawUnsafe(`
      SELECT id,estado FROM "tbl_matriculas_digitales"
      WHERE id_anio_escolar=$1 AND id_alumno=$2`, anio.id, idAlumno);
    if (['ACEPTADA', 'COMPLETADA'].includes(matriculasExistentes[0]?.estado)) {
      return res.status(409).json({ error: 'La matrícula ya fue aceptada. Abra el expediente para revisarla; no necesita reenviar la invitación.' });
    }
    const alumno = datos[0];
    const deuda = await obtenerDeuda(idAlumno);
    const token = crypto.randomBytes(32).toString('hex');
    const otp = String(crypto.randomInt(100000, 1000000));
    const tokenHash = sha256(token);
    const otpHash = sha256(`${token}:${otp}`);
    const snapshot = { alumno: { id: alumno.id, codigo: alumno.codigo_alumno, nombre: alumno.nombre_completo, dni: alumno.dni, nivel: alumno.nivel, grado: alumno.grado, seccion: alumno.seccion }, apoderado: { id: alumno.id_padre, nombre: alumno.apoderado, dni: alumno.dni_apoderado, celular: alumno.celular }, anio: anio.anio };
    const documentos = documentosConfigurados(config).map((d) => ({ ...d, version: config.version_documentos, enlace: config.enlace_documentos }));
    const rows = await prisma.$queryRawUnsafe(`
      INSERT INTO "tbl_matriculas_digitales" ("id_anio_escolar","id_alumno","id_padre","estado","token_hash","otp_hash","otp_vence_en","invitacion_vence_en","datos_snapshot","documentos_snapshot","deuda_snapshot","costo_matricula_snapshot","creado_por")
      VALUES ($1,$2,$3,'ENVIADA',$4,$5,NOW()+INTERVAL '24 hours',NOW()+INTERVAL '7 days',$6::jsonb,$7::jsonb,$8,$9,$10)
      ON CONFLICT ("id_anio_escolar","id_alumno") DO UPDATE SET
        "id_padre"=EXCLUDED."id_padre","estado"='ENVIADA',"token_hash"=EXCLUDED."token_hash","otp_hash"=EXCLUDED."otp_hash",
        "otp_vence_en"=EXCLUDED."otp_vence_en","invitacion_vence_en"=EXCLUDED."invitacion_vence_en","otp_intentos"=0,
        "datos_snapshot"=EXCLUDED."datos_snapshot","documentos_snapshot"=EXCLUDED."documentos_snapshot",
        "deuda_snapshot"=EXCLUDED."deuda_snapshot","costo_matricula_snapshot"=EXCLUDED."costo_matricula_snapshot",
        "aceptaciones_json"='{}'::jsonb,"aceptado_en"=NULL,"hash_evidencia"=NULL,"observacion_revision"=NULL,
        "actualizado_por"=$10,"actualizado_en"=NOW()
      RETURNING *`, anio.id, idAlumno, alumno.id_padre, tokenHash, otpHash, JSON.stringify(snapshot), JSON.stringify(documentos), deuda, Number(alumno.monto_matricula || 0), req.user.id);
    const matricula = rows[0];
    const codigo = matricula.codigo || `M${anio.anio}-${String(matricula.id).padStart(5, '0')}`;
    if (!matricula.codigo) await prisma.$executeRawUnsafe(`UPDATE "tbl_matriculas_digitales" SET codigo=$1 WHERE id=$2`, codigo, matricula.id);
    await registrarEvento(matricula.id, 'INVITACION_GENERADA', { canal: 'WHATSAPP_SEMIAUTOMATICO', telefono: String(alumno.celular).replace(/.(?=.{3})/g, '*') }, req, req.user.id);
    const frontend = String(process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');
    const enlace = `${frontend}/matricula/${token}`;
    const mensaje = `COLEGIO HARVARD\nMatrícula digital ${anio.anio} de ${alumno.nombre_completo}.\nEnlace personal: ${enlace}\nCódigo de verificación: ${otp}\nVálido por 24 horas. No comparta este mensaje.`;
    await registrarAuditoria({ userId: req.user.id, accion: 'INVITAR_MATRICULA_DIGITAL', tipoEntidad: 'tbl_matriculas_digitales', idEntidad: matricula.id, resumen: `Invitación ${codigo} para ${alumno.nombre_completo}`, req });
    res.status(201).json({ data: { id: matricula.id, codigo, enlace, otp, telefono: alumno.celular, mensaje } });
  } catch (error) {
    console.error('Error invitación matrícula:', error);
    res.status(500).json({ error: 'No se pudo generar la invitación' });
  }
}

async function obtenerPublica(req, res) {
  try {
    const tokenHash = sha256(req.params.token);
    const rows = await prisma.$queryRawUnsafe(`SELECT md.*,ae.anio,cm.fecha_inicio,cm.fecha_fin,cm.activo campana_activa FROM "tbl_matriculas_digitales" md JOIN "tbl_anios_escolares" ae ON ae.id=md.id_anio_escolar JOIN "tbl_config_matricula" cm ON cm.id_anio_escolar=md.id_anio_escolar WHERE md.token_hash=$1`, tokenHash);
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'Invitación no encontrada' });
    if ((!item.campana_activa || !dentroDeCampana(item)) && !['ACEPTADA','COMPLETADA'].includes(item.estado)) return res.status(410).json({ error: 'La campaña de matrícula no se encuentra habilitada en este momento.' });
    if (item.invitacion_vence_en && new Date(item.invitacion_vence_en) < new Date() && !['ACEPTADA','COMPLETADA'].includes(item.estado)) return res.status(410).json({ error: 'La invitación venció. Solicite una nueva al colegio.' });
    if (item.estado === 'ENVIADA') {
      await prisma.$executeRawUnsafe(`UPDATE "tbl_matriculas_digitales" SET estado='ABIERTA',actualizado_en=NOW() WHERE id=$1`, item.id);
      await registrarEvento(item.id, 'INVITACION_ABIERTA', {}, req);
      item.estado = 'ABIERTA';
    }
    const borrador = json(item.borrador_asistido, {});
    const formularioGuardado = json(item.datos_formulario, {});
    res.json({ data: { codigo: item.codigo, estado: item.estado, anio: item.anio, datos: json(item.datos_snapshot, {}), formulario: { ...borrador, ...formularioGuardado }, preparado_por_colegio: Object.keys(borrador).length > 0, borrador_preparado_en: item.borrador_preparado_en, documentos: json(item.documentos_snapshot, []), aceptaciones: json(item.aceptaciones_json, {}), deuda: Number(item.deuda_snapshot || 0), matricula: Number(item.costo_matricula_snapshot || 0), aceptado_en: item.aceptado_en, hash_evidencia: item.hash_evidencia, observacion_revision: item.observacion_revision } });
  } catch (error) {
    console.error('Error consulta matrícula pública:', error);
    res.status(500).json({ error: 'No se pudo consultar la matrícula' });
  }
}

async function aceptar(req, res) {
  try {
    const token = req.params.token;
    const tokenHash = sha256(token);
    const rows = await prisma.$queryRawUnsafe(`SELECT md.*,cm.fecha_inicio,cm.fecha_fin,cm.activo campana_activa FROM "tbl_matriculas_digitales" md JOIN "tbl_config_matricula" cm ON cm.id_anio_escolar=md.id_anio_escolar WHERE md.token_hash=$1 FOR UPDATE OF md`, tokenHash);
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'Invitación no encontrada' });
    if (['ACEPTADA','COMPLETADA'].includes(item.estado)) return res.status(409).json({ error: 'Esta matrícula ya fue aceptada' });
    if (!item.campana_activa || !dentroDeCampana(item)) return res.status(410).json({ error: 'La campaña de matrícula no se encuentra habilitada en este momento.' });
    if (new Date(item.invitacion_vence_en) < new Date() || new Date(item.otp_vence_en) < new Date()) return res.status(410).json({ error: 'El código venció. Solicite una nueva invitación.' });
    if (Number(item.otp_intentos) >= 5) return res.status(429).json({ error: 'Se agotaron los intentos. Solicite una nueva invitación.' });
    const otpValido = crypto.timingSafeEqual(Buffer.from(item.otp_hash), Buffer.from(sha256(`${token}:${String(req.body.otp || '')}`)));
    if (!otpValido) {
      await prisma.$executeRawUnsafe(`UPDATE "tbl_matriculas_digitales" SET otp_intentos=otp_intentos+1 WHERE id=$1`, item.id);
      await registrarEvento(item.id, 'OTP_INVALIDO', {}, req);
      return res.status(400).json({ error: 'Código incorrecto' });
    }
    const documentos = json(item.documentos_snapshot, []);
    const aceptacionesRecibidas = req.body.aceptaciones || {};
    const aceptaciones = {
      ...aceptacionesRecibidas,
      ...Object.fromEntries(Object.entries(AUTORIZACIONES).flatMap(([clave, texto]) => [
        [clave, aceptacionesRecibidas[clave] === true],
        [`${clave}_texto`, texto],
      ])),
      compromiso_institucional: aceptacionesRecibidas.compromiso_institucional === true,
      compromiso_institucional_texto: COMPROMISO_INSTITUCIONAL,
      uso_imagen_decision: ['AUTORIZO', 'NO_AUTORIZO'].includes(aceptacionesRecibidas.uso_imagen_decision) ? aceptacionesRecibidas.uso_imagen_decision : null,
      uso_imagen_texto: USO_IMAGEN_TEXTO,
    };
    const faltantes = documentos.filter((d) => d.obligatorio !== false && aceptaciones[d.clave] !== true);
    if (faltantes.length) return res.status(400).json({ error: 'Debe aceptar todos los documentos obligatorios' });
    const autorizacionesFaltantes = AUTORIZACIONES_OBLIGATORIAS.filter((clave) => aceptaciones[clave] !== true);
    if (autorizacionesFaltantes.length) return res.status(400).json({ error: 'Debe aceptar todas las autorizaciones obligatorias' });
    if (aceptaciones.compromiso_institucional !== true) return res.status(400).json({ error: 'Debe aceptar el compromiso con la formación del estudiante' });
    if (!aceptaciones.uso_imagen_decision) return res.status(400).json({ error: 'Indique si autoriza o no el uso institucional de imagen' });
    if (aceptaciones.declaracion !== true) return res.status(400).json({ error: 'Debe confirmar la declaración final' });
    const formulario = req.body.formulario || {};
    const autorizado = formulario.persona_autorizada_1 || {};
    if (!String(formulario.representante_apellido_paterno || '').trim() || !String(formulario.representante_apellido_materno || '').trim() || !String(formulario.representante_nombres || '').trim() || !String(formulario.vinculo_representante || '').trim() || !String(formulario.celular || '').trim() || !String(formulario.direccion || '').trim() || !String(formulario.contacto_emergencia || '').trim() || !String(formulario.centro_salud_emergencia || '').trim()) return res.status(400).json({ error: 'Complete los datos del representante legal y los datos obligatorios de emergencia' });
    if (!/^\d{8}$/.test(String(formulario.representante_dni || ''))) return res.status(400).json({ error: 'El DNI del representante debe contener exactamente 8 dígitos' });
    const tiposIngreso = ['PROMOCION_INTERNA', 'TRASLADO', 'INGRESO_INICIAL', 'REPITENCIA'];
    const condicionesPromocion = ['PROMOVIDO', 'REPITE', 'PENDIENTE'];
    if (!tiposIngreso.includes(formulario.tipo_ingreso)) return res.status(400).json({ error: 'Seleccione el tipo de ingreso del estudiante' });
    if (formulario.tipo_ingreso !== 'INGRESO_INICIAL') {
      if (!condicionesPromocion.includes(formulario.condicion_promocion) || !/^\d{4}$/.test(String(formulario.anio_escolar_anterior || '')) || !String(formulario.nivel_anterior || '').trim() || !String(formulario.grado_anterior || '').trim()) return res.status(400).json({ error: 'Complete la condición de promoción y el antecedente escolar' });
      if (formulario.tipo_ingreso === 'TRASLADO' && !String(formulario.institucion_procedencia || '').trim()) return res.status(400).json({ error: 'Indique la institución educativa de procedencia' });
    }
    if (!String(autorizado.nombre || '').trim() || !String(autorizado.dni || '').trim() || !String(autorizado.parentesco || '').trim() || !String(autorizado.celular || '').trim()) return res.status(400).json({ error: 'Registre por lo menos una persona autorizada con nombre, DNI, parentesco y celular' });
    const aceptadoEn = new Date();
    const evidencia = { codigo: item.codigo, datos: json(item.datos_snapshot, {}), formulario, documentos, aceptaciones, aceptado_en: aceptadoEn.toISOString() };
    const hashEvidencia = sha256(JSON.stringify(evidencia));
    await prisma.$executeRawUnsafe(`UPDATE "tbl_matriculas_digitales" SET estado='ACEPTADA',datos_formulario=$1::jsonb,aceptaciones_json=$2::jsonb,aceptado_en=$3,aceptado_ip=$4,aceptado_agente=$5,hash_evidencia=$6,actualizado_en=NOW() WHERE id=$7`, JSON.stringify(formulario), JSON.stringify(aceptaciones), aceptadoEn, ipCliente(req), agenteCliente(req), hashEvidencia, item.id);
    await registrarEvento(item.id, 'OTP_VERIFICADO_Y_ACEPTADO', { hash_evidencia: hashEvidencia, documentos: documentos.map((d) => ({ clave: d.clave, version: d.version })) }, req);
    res.json({ data: { codigo: item.codigo, estado: 'ACEPTADA', aceptado_en: aceptadoEn, hash_evidencia: hashEvidencia } });
  } catch (error) {
    console.error('Error aceptación matrícula:', error);
    res.status(500).json({ error: 'No se pudo registrar la aceptación' });
  }
}

async function detalle(req, res) {
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT md.*,ae.anio FROM "tbl_matriculas_digitales" md JOIN "tbl_anios_escolares" ae ON ae.id=md.id_anio_escolar WHERE md.id=$1`, Number(req.params.id));
    if (!rows[0]) return res.status(404).json({ error: 'Matrícula no encontrada' });
    const eventos = await prisma.$queryRawUnsafe(`SELECT * FROM "tbl_eventos_matricula" WHERE id_matricula=$1 ORDER BY creado_en`, Number(req.params.id));
    res.json({ data: { ...rows[0], deuda_snapshot: Number(rows[0].deuda_snapshot || 0), costo_matricula_snapshot: Number(rows[0].costo_matricula_snapshot || 0), datos_snapshot: json(rows[0].datos_snapshot, {}), datos_formulario: json(rows[0].datos_formulario, {}), borrador_asistido: json(rows[0].borrador_asistido, {}), documentos_snapshot: json(rows[0].documentos_snapshot, []), aceptaciones_json: json(rows[0].aceptaciones_json, {}), control_documental: json(rows[0].control_documental, {}), eventos } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo cargar el expediente' }); }
}

function limpiarBorradorAsistido(input = {}) {
  const campos = ['representante_apellido_paterno', 'representante_apellido_materno', 'representante_nombres', 'representante_dni', 'vinculo_representante', 'celular', 'email', 'direccion', 'contacto_emergencia', 'telefono_emergencia', 'centro_salud_emergencia', 'observaciones_salud', 'tipo_ingreso', 'condicion_promocion', 'anio_escolar_anterior', 'nivel_anterior', 'grado_anterior', 'institucion_procedencia', 'codigo_modular_procedencia', 'ubicacion_procedencia'];
  const limpio = Object.fromEntries(campos.map((campo) => [campo, String(input[campo] || '').trim().slice(0, 500)]));
  for (const clave of ['persona_autorizada_1', 'persona_autorizada_2']) {
    const persona = input[clave] || {};
    limpio[clave] = { nombre: String(persona.nombre || '').trim().slice(0, 200), dni: String(persona.dni || '').trim().slice(0, 20), parentesco: String(persona.parentesco || '').trim().slice(0, 80), celular: String(persona.celular || '').trim().slice(0, 30) };
  }
  return limpio;
}

async function guardarBorradorAsistido(req, res) {
  try {
    const matriculaId = Number(req.params.id);
    if (!Number.isInteger(matriculaId) || matriculaId <= 0) return res.status(400).json({ error: 'Matrícula inválida' });
    const borrador = limpiarBorradorAsistido(req.body.borrador || {});
    const rows = await prisma.$queryRawUnsafe(`UPDATE "tbl_matriculas_digitales" SET borrador_asistido=$1::jsonb,borrador_preparado_por=$2,borrador_preparado_en=NOW(),actualizado_por=$2,actualizado_en=NOW() WHERE id=$3 AND estado IN ('ENVIADA','ABIERTA','OBSERVADA') RETURNING id,codigo,borrador_asistido,borrador_preparado_en`, JSON.stringify(borrador), req.user.id, matriculaId);
    if (!rows[0]) return res.status(409).json({ error: 'Solo puede preparar matrículas pendientes de aceptación' });
    await registrarEvento(matriculaId, 'BORRADOR_ASISTIDO_PREPARADO', {}, req, req.user.id);
    await registrarAuditoria({ userId: req.user.id, accion: 'PREPARAR_BORRADOR_MATRICULA', tipoEntidad: 'tbl_matriculas_digitales', idEntidad: matriculaId, resumen: `Borrador asistido de ${rows[0].codigo}`, req });
    res.json({ data: { ...rows[0], borrador_asistido: json(rows[0].borrador_asistido, {}) } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo guardar el borrador asistido' }); }
}

const DOCUMENTOS_CONTROL = new Set(['certificado_estudios', 'ficha_unica_matricula', 'libreta_anterior', 'dni_alumno', 'dni_apoderado', 'foto_alumno', 'foto_apoderado']);
const ESTADOS_DOCUMENTO = new Set(['PENDIENTE', 'ENTREGADO', 'NO_APLICA']);

async function guardarControlDocumental(req, res) {
  try {
    const matriculaId = Number(req.params.id);
    if (!Number.isInteger(matriculaId) || matriculaId <= 0) return res.status(400).json({ error: 'Matrícula inválida' });
    const recibido = req.body.control_documental || {};
    const control = {};
    for (const [clave, valor] of Object.entries(recibido)) {
      if (!DOCUMENTOS_CONTROL.has(clave) || !ESTADOS_DOCUMENTO.has(valor?.estado)) return res.status(400).json({ error: 'Control documental inválido' });
      control[clave] = { estado: valor.estado, observacion: String(valor.observacion || '').trim().slice(0, 500) || null, actualizado_en: new Date().toISOString(), actualizado_por: req.user.id };
    }
    const rows = await prisma.$queryRawUnsafe(`UPDATE "tbl_matriculas_digitales" SET control_documental=$1::jsonb,actualizado_por=$2,actualizado_en=NOW() WHERE id=$3 RETURNING id,codigo,control_documental`, JSON.stringify(control), req.user.id, matriculaId);
    if (!rows[0]) return res.status(404).json({ error: 'Matrícula no encontrada' });
    await registrarEvento(matriculaId, 'CONTROL_DOCUMENTAL_ACTUALIZADO', { documentos: Object.fromEntries(Object.entries(control).map(([clave, valor]) => [clave, valor.estado])) }, req, req.user.id);
    await registrarAuditoria({ userId: req.user.id, accion: 'ACTUALIZAR_CONTROL_DOCUMENTAL', tipoEntidad: 'tbl_matriculas_digitales', idEntidad: matriculaId, resumen: `Control documental de ${rows[0].codigo}`, req });
    res.json({ data: { ...rows[0], control_documental: json(rows[0].control_documental, {}) } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo guardar el control documental' }); }
}

async function revisar(req, res) {
  const estado = String(req.body.estado || '').toUpperCase();
  if (!ESTADOS_REVISION.has(estado)) return res.status(400).json({ error: 'Estado de revisión inválido' });
  try {
    const rows = await prisma.$queryRawUnsafe(`UPDATE "tbl_matriculas_digitales" SET estado=$1,observacion_revision=$2,actualizado_por=$3,actualizado_en=NOW() WHERE id=$4 AND estado IN ('ACEPTADA','OBSERVADA') RETURNING *`, estado, String(req.body.observacion || '').trim() || null, req.user.id, Number(req.params.id));
    if (!rows[0]) return res.status(409).json({ error: 'La matrícula aún no puede revisarse' });
    await registrarEvento(rows[0].id, estado === 'COMPLETADA' ? 'MATRICULA_COMPLETADA' : 'MATRICULA_OBSERVADA', { observacion: req.body.observacion || null }, req, req.user.id);
    await registrarAuditoria({ userId: req.user.id, accion: `MATRICULA_${estado}`, tipoEntidad: 'tbl_matriculas_digitales', idEntidad: rows[0].id, resumen: `${rows[0].codigo}: ${estado}`, req });
    res.json({ data: rows[0] });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo revisar la matrícula' }); }
}

module.exports = { bootstrap, guardarConfiguracion, invitar, obtenerPublica, aceptar, detalle, guardarBorradorAsistido, guardarControlDocumental, revisar };

