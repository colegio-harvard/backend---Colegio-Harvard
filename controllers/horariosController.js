const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');

const DIAS = new Set(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO']);
const TIPOS_BLOQUE = new Set(['CLASE', 'RECREO', 'OTRO']);
const EDITABLES = new Set(['BORRADOR', 'VALIDADO']);

const entero = value => {
  const numero = Number(value);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
};
const texto = (value, maximo = 500) => String(value || '').trim().slice(0, maximo);
const normalizarDia = value => texto(value, 12).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normalizarTipo = value => texto(value, 10).toUpperCase();
const horaValida = value => /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(value || ''));

async function obtenerCabecera(db, idHorario, bloquear = false) {
  const rows = await db.$queryRawUnsafe(`SELECT h.*,a.id_grado,g.id_nivel
    FROM "tbl_horarios_escolares" h
    JOIN "tbl_aulas" a ON a.id=h.id_aula
    JOIN "tbl_grados" g ON g.id=a.id_grado
    WHERE h.id=$1${bloquear ? ' FOR UPDATE' : ''}`, idHorario);
  return rows[0] || null;
}

async function validarDetalle(db, horario, detalle, excluirDetalleId = null) {
  const errores = [];
  const idBloque = entero(detalle.id_bloque_horario);
  const idAsignacion = entero(detalle.id_asignacion_academica);
  const dia = normalizarDia(detalle.dia_semana);
  if (!idBloque || !idAsignacion || !DIAS.has(dia)) {
    return { errores: [{ codigo: 'DETALLE_INVALIDO', mensaje: 'Bloque, asignación académica y día válido son obligatorios.' }], bloque: null, asignacion: null, dia };
  }
  const [bloques, asignaciones] = await Promise.all([
    db.$queryRawUnsafe('SELECT * FROM "tbl_bloques_horarios" WHERE id=$1', idBloque),
    db.$queryRawUnsafe(`SELECT aa.*,u.nombres docente,COALESCE(dca.nombre_presentacion,c.nombre) curso
      FROM "tbl_asignaciones_academicas" aa
      JOIN "tbl_usuarios" u ON u.id=aa.id_docente
      JOIN "tbl_cursos_academicos" c ON c.id=aa.id_curso
      LEFT JOIN "tbl_denominaciones_curso_anio" dca ON dca.id_anio_escolar=aa.id_anio_escolar AND dca.id_curso=aa.id_curso
      WHERE aa.id=$1`, idAsignacion),
  ]);
  const bloque = bloques[0] || null;
  const asignacion = asignaciones[0] || null;
  if (!bloque) errores.push({ codigo: 'BLOQUE_INEXISTENTE', mensaje: 'El bloque horario no existe.' });
  else {
    if (!bloque.activo) errores.push({ codigo: 'BLOQUE_INACTIVO', mensaje: 'El bloque horario está desactivado.' });
    if (bloque.tipo === 'RECREO') errores.push({ codigo: 'BLOQUE_RECREO', mensaje: 'No se puede asignar una clase durante un recreo.' });
    if (Number(bloque.id_anio_escolar) !== Number(horario.id_anio_escolar) || Number(bloque.id_nivel) !== Number(horario.id_nivel)) errores.push({ codigo: 'BLOQUE_INCOMPATIBLE', mensaje: 'El bloque no pertenece al mismo año y nivel del horario.' });
  }
  if (!asignacion) errores.push({ codigo: 'ASIGNACION_INEXISTENTE', mensaje: 'La asignación académica no existe.' });
  else if (!asignacion.activo || Number(asignacion.id_anio_escolar) !== Number(horario.id_anio_escolar) || Number(asignacion.id_aula) !== Number(horario.id_aula)) {
    errores.push({ codigo: 'ASIGNACION_INCOMPATIBLE', mensaje: 'La asignación académica no pertenece al aula o año escolar del horario.' });
  }
  if (!errores.length) {
    if (detalle.id_espacio_fisico) {
      const espacio = (await db.$queryRawUnsafe('SELECT * FROM "tbl_espacios_fisicos" WHERE id=$1', entero(detalle.id_espacio_fisico)))[0];
      if (!espacio) errores.push({ codigo: 'ESPACIO_INEXISTENTE', mensaje: 'El espacio físico no existe.' });
      else if (!espacio.activo) errores.push({ codigo: 'ESPACIO_INACTIVO', mensaje: `El espacio ${espacio.nombre} está inactivo.` });
      else {
        const ocupaciones = await db.$queryRawUnsafe(
          `SELECT COUNT(*)::int cantidad FROM "tbl_horario_detalles" d JOIN "tbl_horarios_escolares" h ON h.id=d.id_horario_escolar WHERE h.id_anio_escolar=$1 AND d.id_espacio_fisico=$2 AND d.dia_semana=$3 AND d.id_bloque_horario=$4 AND h.estado<>'ARCHIVADO'${excluirDetalleId ? ' AND d.id<>$5' : ''}`,
          ...(excluirDetalleId ? [horario.id_anio_escolar, espacio.id, dia, idBloque, excluirDetalleId] : [horario.id_anio_escolar, espacio.id, dia, idBloque]),
        );
        const capacidadSimultanea = Number(espacio.capacidad_simultanea || 1);
        if (Number(ocupaciones[0]?.cantidad || 0) >= capacidadSimultanea) {
          errores.push({ codigo: 'CONFLICTO_ESPACIO_FISICO', mensaje: `El ${espacio.nombre} alcanzó su capacidad de uso simultáneo en este día y bloque.` });
        }
      }
    }
    const noDisponible = await db.$queryRawUnsafe(`SELECT observacion FROM "tbl_disponibilidad_docente" WHERE id_docente=$1 AND id_anio_escolar=$2 AND id_bloque_horario=$3 AND dia_semana=$4 AND disponible=FALSE LIMIT 1`, asignacion.id_docente, horario.id_anio_escolar, idBloque, dia);
    if (noDisponible[0]) errores.push({ codigo: 'DOCENTE_NO_DISPONIBLE', mensaje: `El docente ${asignacion.docente} no está disponible el ${dia} de ${bloque.hora_inicio} a ${bloque.hora_fin}.` });
    const conflictoSeccion = await db.$queryRawUnsafe(`SELECT d.id FROM "tbl_horario_detalles" d
      WHERE d.id_horario_escolar=$1 AND d.dia_semana=$2 AND d.id_bloque_horario=$3${excluirDetalleId ? ' AND d.id<>$4' : ''} LIMIT 1`, ...(excluirDetalleId ? [horario.id, dia, idBloque, excluirDetalleId] : [horario.id, dia, idBloque]));
    if (conflictoSeccion[0]) errores.push({ codigo: 'CONFLICTO_SECCION', mensaje: 'La sección ya tiene una clase en ese día y bloque.' });
    const parametros = excluirDetalleId ? [horario.id_anio_escolar, dia, idBloque, asignacion.id_docente, excluirDetalleId] : [horario.id_anio_escolar, dia, idBloque, asignacion.id_docente];
    const conflictoDocente = await db.$queryRawUnsafe(`SELECT h.id id_horario,d.id id_detalle FROM "tbl_horario_detalles" d
      JOIN "tbl_horarios_escolares" h ON h.id=d.id_horario_escolar
      JOIN "tbl_asignaciones_academicas" aa ON aa.id=d.id_asignacion_academica
      WHERE h.id_anio_escolar=$1 AND h.estado <> 'ARCHIVADO' AND d.dia_semana=$2 AND d.id_bloque_horario=$3 AND aa.id_docente=$4${excluirDetalleId ? ' AND d.id<>$5' : ''} LIMIT 1`, ...parametros);
    if (conflictoDocente[0]) errores.push({ codigo: 'CONFLICTO_DOCENTE', mensaje: `El docente ${asignacion.docente} ya tiene una clase en ese día y bloque.` });
  }
  return { errores, bloque, asignacion, dia };
}

async function diagnosticarHorario(db, horario) {
  const detalles = await db.$queryRawUnsafe('SELECT * FROM "tbl_horario_detalles" WHERE id_horario_escolar=$1 ORDER BY dia_semana,id_bloque_horario', horario.id);
  const errores = [];
  for (const detalle of detalles) {
    const resultado = await validarDetalle(db, horario, detalle, detalle.id);
    errores.push(...resultado.errores.map(error => ({ ...error, id_detalle: detalle.id })));
  }
  const unicos = [...new Map(errores.map(error => [`${error.codigo}:${error.id_detalle}`, error])).values()];
  const advertencias = detalles.length ? [] : [{ codigo: 'SIN_CLASES', mensaje: 'El horario aún no tiene clases registradas.' }];
  const carga = await calcularCargaHoraria(db, horario);
  carga.forEach(item => {
    if (item.estado === 'SIN_CONFIGURAR') advertencias.push({ codigo: 'CARGA_SIN_CONFIGURAR', tipo: 'CARGA_SIN_CONFIGURAR', curso: item.curso, docente: item.docente, requeridas: null, asignadas: item.asignadas, mensaje: `${item.curso}: carga semanal sin configurar.` });
    if (item.estado === 'FALTANTE') advertencias.push({ codigo: 'CARGA_FALTANTE', tipo: 'CARGA_FALTANTE', curso: item.curso, docente: item.docente, requeridas: item.requeridas, asignadas: item.asignadas, mensaje: `${item.curso}: faltan ${item.diferencia} bloque(s) pedagógico(s).` });
    if (item.estado === 'EXCEDIDO') advertencias.push({ codigo: 'CARGA_EXCEDIDA', tipo: 'CARGA_EXCEDIDA', curso: item.curso, docente: item.docente, requeridas: item.requeridas, asignadas: item.asignadas, mensaje: `${item.curso}: excede ${Math.abs(item.diferencia)} bloque(s) pedagógico(s).` });
  });
  return { valido: unicos.length === 0, errores: unicos, advertencias, carga };
}

async function calcularCargaHoraria(db, horario) {
  const rows = await db.$queryRawUnsafe(`SELECT aa.id id_asignacion_academica,aa.horas_semanales,COALESCE(dca.nombre_presentacion,c.nombre) curso,u.nombres docente,
    COUNT(d.id) FILTER (WHERE b.tipo='CLASE')::int asignadas
    FROM "tbl_asignaciones_academicas" aa
    JOIN "tbl_cursos_academicos" c ON c.id=aa.id_curso LEFT JOIN "tbl_denominaciones_curso_anio" dca ON dca.id_anio_escolar=aa.id_anio_escolar AND dca.id_curso=aa.id_curso JOIN "tbl_usuarios" u ON u.id=aa.id_docente
    LEFT JOIN "tbl_horario_detalles" d ON d.id_asignacion_academica=aa.id AND d.id_horario_escolar=$1
    LEFT JOIN "tbl_bloques_horarios" b ON b.id=d.id_bloque_horario
    WHERE aa.id_anio_escolar=$2 AND aa.id_aula=$3 AND aa.activo=TRUE
    GROUP BY aa.id,aa.horas_semanales,c.nombre,dca.nombre_presentacion,u.nombres ORDER BY c.nombre,u.nombres`, horario.id, horario.id_anio_escolar, horario.id_aula);
  return rows.map(x => {
    const requeridas = x.horas_semanales === null ? null : Number(x.horas_semanales); const asignadas = Number(x.asignadas || 0);
    const diferencia = requeridas === null ? null : requeridas - asignadas;
    return { ...x, requeridas, asignadas, diferencia, estado: requeridas === null ? 'SIN_CONFIGURAR' : diferencia === 0 ? 'COMPLETO' : diferencia > 0 ? 'FALTANTE' : 'EXCEDIDO' };
  });
}

// Generador determinista: programa primero las asignaciones con mayor carga y
// elige la celda legal con menor repetición del curso en ese día.
async function contextoGeneracion(db, idAnio, idAula) {
  const aulas = await db.$queryRawUnsafe(`SELECT a.id,a.id_anio_escolar,g.id_nivel FROM "tbl_aulas" a JOIN "tbl_grados" g ON g.id=a.id_grado WHERE a.id=$1 AND a.id_anio_escolar=$2`, idAula, idAnio);
  const aula = aulas[0];
  if (!aula) return { errores: ['La sección no pertenece al año escolar indicado.'] };
  const [bloques, asignaciones] = await Promise.all([
    db.$queryRawUnsafe(`SELECT * FROM "tbl_bloques_horarios" WHERE id_anio_escolar=$1 AND id_nivel=$2 AND activo=TRUE AND tipo='CLASE' ORDER BY orden`, idAnio, aula.id_nivel),
    db.$queryRawUnsafe(`SELECT aa.*,COALESCE(dca.nombre_presentacion,c.nombre) curso,u.nombres docente,u.estado estado_docente FROM "tbl_asignaciones_academicas" aa JOIN "tbl_cursos_academicos" c ON c.id=aa.id_curso LEFT JOIN "tbl_denominaciones_curso_anio" dca ON dca.id_anio_escolar=aa.id_anio_escolar AND dca.id_curso=aa.id_curso JOIN "tbl_usuarios" u ON u.id=aa.id_docente WHERE aa.id_anio_escolar=$1 AND aa.id_aula=$2 AND aa.activo=TRUE ORDER BY aa.horas_semanales DESC,c.nombre`, idAnio, idAula),
  ]);
  const errores = [];
  if (!bloques.length) errores.push('No existen bloques de clase activos para esta sección.');
  if (!asignaciones.length) errores.push('No existen asignaciones académicas activas para esta sección.');
  asignaciones.forEach(a => { if (!a.horas_semanales) errores.push(`${a.curso}: carga semanal sin configurar.`); if (a.estado_docente !== 'ACTIVO') errores.push(`${a.curso}: docente no activo.`); });
  const requeridos = asignaciones.reduce((total, a) => total + (Number(a.horas_semanales) || 0), 0);
  const disponibles = bloques.length * 5;
  if (requeridos > disponibles) errores.push(`Solo existen ${disponibles} bloques disponibles y se requieren ${requeridos}.`);
  return { aula, bloques, asignaciones, requeridos, disponibles, errores };
}

async function proponerDetalles(db, contexto, horario) {
  const dias = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
  const propuestos = []; const ocupados = new Set(); const docentesOcupados = new Set(); const porDia = new Map();
  for (const asignacion of contexto.asignaciones) {
    for (let numero = 0; numero < Number(asignacion.horas_semanales); numero += 1) {
      const candidatos = [];
      for (const dia of dias) for (const bloque of contexto.bloques) {
        const celda = `${dia}:${bloque.id}`;
        if (ocupados.has(celda) || docentesOcupados.has(`${asignacion.id_docente}:${celda}`)) continue;
        const resultado = await validarDetalle(db, horario, { id_asignacion_academica: asignacion.id, id_bloque_horario: bloque.id, dia_semana: dia });
        if (resultado.errores.length) continue;
        const mismoDia = porDia.get(`${asignacion.id}:${dia}`) || 0;
        const consecutivos = propuestos.filter(x => x.id_asignacion_academica === asignacion.id && x.dia_semana === dia).length;
        candidatos.push({ dia, bloque, penalidad: mismoDia * 20 + consecutivos * 5 + Number(bloque.orden) / 100 });
      }
      candidatos.sort((a, b) => a.penalidad - b.penalidad || a.dia.localeCompare(b.dia) || a.bloque.orden - b.bloque.orden);
      const elegido = candidatos[0];
      if (!elegido) return { error: `No se encontró una celda válida para ${asignacion.curso}.`, propuestos };
      const detalle = { id_asignacion_academica: asignacion.id, id_bloque_horario: elegido.bloque.id, dia_semana: elegido.dia };
      propuestos.push(detalle); ocupados.add(`${elegido.dia}:${elegido.bloque.id}`); docentesOcupados.add(`${asignacion.id_docente}:${elegido.dia}:${elegido.bloque.id}`); porDia.set(`${asignacion.id}:${elegido.dia}`, (porDia.get(`${asignacion.id}:${elegido.dia}`) || 0) + 1);
    }
  }
  return { propuestos };
}

exports.analizarGeneracion = async (req, res) => {
  try { const idAnio = entero(req.body.id_anio_escolar), idAula = entero(req.body.id_aula); if (!idAnio || !idAula) return res.status(400).json({ error: 'Año escolar y sección son obligatorios.' }); const contexto = await contextoGeneracion(prisma, idAnio, idAula); if (contexto.errores.length) return res.json({ posible: false, errores: contexto.errores, bloquesDisponibles: contexto.disponibles || 0, bloquesRequeridos: contexto.requeridos || 0 }); const propuesta = await proponerDetalles(prisma, contexto, { id: -1, id_anio_escolar: idAnio, id_aula: idAula, id_nivel: contexto.aula.id_nivel }); res.json({ posible: !propuesta.error, errores: propuesta.error ? [propuesta.error] : [], bloquesDisponibles: contexto.disponibles, bloquesRequeridos: contexto.requeridos, asignaciones: contexto.asignaciones.length, restriccionesRespetadas: true }); }
  catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo analizar la generación.' }); }
};

exports.generarHorario = async (req, res) => {
  try {
    const idAnio = entero(req.body.id_anio_escolar), idAula = entero(req.body.id_aula); if (!idAnio || !idAula) return res.status(400).json({ error: 'Año escolar y sección son obligatorios.' });
    const horario = await prisma.$transaction(async tx => {
      const contexto = await contextoGeneracion(tx, idAnio, idAula); if (contexto.errores.length) throw Object.assign(new Error('GENERACION_NO_POSIBLE'), { errores: contexto.errores });
      const siguiente = await tx.$queryRawUnsafe('SELECT COALESCE(MAX(version),0)+1 siguiente FROM "tbl_horarios_escolares" WHERE id_anio_escolar=$1 AND id_aula=$2', idAnio, idAula);
      const creado = (await tx.$queryRawUnsafe('INSERT INTO "tbl_horarios_escolares" (id_anio_escolar,id_aula,version,estado,creado_por) VALUES ($1,$2,$3,\'BORRADOR\',$4) RETURNING *', idAnio, idAula, siguiente[0].siguiente, req.user.id))[0];
      const propuesta = await proponerDetalles(tx, contexto, { ...creado, id_nivel: contexto.aula.id_nivel }); if (propuesta.error) throw Object.assign(new Error('GENERACION_NO_POSIBLE'), { errores: [propuesta.error] });
      for (const detalle of propuesta.propuestos) await tx.$queryRawUnsafe('INSERT INTO "tbl_horario_detalles" (id_horario_escolar,id_bloque_horario,dia_semana,id_asignacion_academica,creado_por) VALUES ($1,$2,$3,$4,$5)', creado.id, detalle.id_bloque_horario, detalle.dia_semana, detalle.id_asignacion_academica, req.user.id);
      const diagnostico = await diagnosticarHorario(tx, { ...creado, id_nivel: contexto.aula.id_nivel }); if (!diagnostico.valido) throw Object.assign(new Error('GENERACION_INVALIDA'), { errores: diagnostico.errores.map(x => x.mensaje) });
      return { ...creado, resumen: { bloquesAsignados: propuesta.propuestos.length, cursos: contexto.asignaciones.length, conflictos: 0 } };
    });
    await registrarAuditoria({ userId:req.user.id, accion:'GENERAR_HORARIO_AUTOMATICO', tipoEntidad:'tbl_horarios_escolares', idEntidad:horario.id, resumen:`Horario automático borrador v${horario.version}`, req }); res.status(201).json({ data: horario });
  } catch (error) { const status = ['GENERACION_NO_POSIBLE','GENERACION_INVALIDA'].includes(error.message) ? 409 : 500; res.status(status).json({ error: error.message === 'GENERACION_INVALIDA' ? 'La propuesta no pasó la validación final.' : error.message === 'GENERACION_NO_POSIBLE' ? 'No se puede generar el horario.' : 'No se pudo generar el horario.', errores: error.errores || [] }); }
};

exports.listarEspacios = async (req,res)=>{try{const data=await prisma.$queryRawUnsafe(`SELECT * FROM "tbl_espacios_fisicos" ${req.query.incluir_inactivos==='true'?'':'WHERE activo=TRUE'} ORDER BY nombre`);res.json({data});}catch(e){res.status(500).json({error:'No se pudieron listar espacios'});}};
exports.crearEspacio = async (req,res)=>{try{const nombre=texto(req.body.nombre,150),capacidadSimultanea=entero(req.body.capacidad_simultanea ?? 1);if(!nombre)return res.status(400).json({error:'Nombre obligatorio'});if(!capacidadSimultanea)return res.status(400).json({error:'La capacidad simultánea debe ser un entero mayor o igual a 1'});const r=await prisma.$queryRawUnsafe('INSERT INTO "tbl_espacios_fisicos" (nombre,tipo,capacidad,capacidad_simultanea,ubicacion,observacion,creado_por) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',nombre,texto(req.body.tipo,30)||'OTRO',entero(req.body.capacidad)||null,capacidadSimultanea,texto(req.body.ubicacion,150)||null,texto(req.body.observacion)||null,req.user.id);await registrarAuditoria({userId:req.user.id,accion:'CREAR_ESPACIO_FISICO',tipoEntidad:'tbl_espacios_fisicos',idEntidad:r[0].id,resumen:nombre,req});res.status(201).json({data:r[0]});}catch(e){res.status(e.code==='23505'?409:500).json({error:'No se pudo crear espacio'});}};
exports.actualizarEspacio = async (req,res)=>{try{const id=entero(req.params.id),nombre=texto(req.body.nombre,150),capacidadSimultanea=req.body.capacidad_simultanea===undefined?null:entero(req.body.capacidad_simultanea);if(req.body.capacidad_simultanea!==undefined&&!capacidadSimultanea)return res.status(400).json({error:'La capacidad simultánea debe ser un entero mayor o igual a 1'});const r=await prisma.$queryRawUnsafe('UPDATE "tbl_espacios_fisicos" SET nombre=$1,tipo=$2,capacidad=$3,capacidad_simultanea=COALESCE($4,capacidad_simultanea),ubicacion=$5,observacion=$6,actualizado_por=$7,actualizado_en=NOW() WHERE id=$8 RETURNING *',nombre,texto(req.body.tipo,30)||'OTRO',entero(req.body.capacidad)||null,capacidadSimultanea,texto(req.body.ubicacion,150)||null,texto(req.body.observacion)||null,req.user.id,id);if(!r[0])return res.status(404).json({error:'Espacio no encontrado'});await registrarAuditoria({userId:req.user.id,accion:'EDITAR_ESPACIO_FISICO',tipoEntidad:'tbl_espacios_fisicos',idEntidad:id,resumen:nombre,req});res.json({data:r[0]});}catch(e){res.status(500).json({error:'No se pudo editar espacio'});}};
exports.cambiarEstadoEspacio = async (req,res)=>{try{const id=entero(req.params.id),activo=!!req.body.activo;const r=await prisma.$queryRawUnsafe('UPDATE "tbl_espacios_fisicos" SET activo=$1,actualizado_por=$2,actualizado_en=NOW() WHERE id=$3 RETURNING *',activo,req.user.id,id);if(!r[0])return res.status(404).json({error:'Espacio no encontrado'});await registrarAuditoria({userId:req.user.id,accion:activo?'ACTIVAR_ESPACIO_FISICO':'DESACTIVAR_ESPACIO_FISICO',tipoEntidad:'tbl_espacios_fisicos',idEntidad:id,resumen:r[0].nombre,req});res.json({data:r[0]});}catch(e){res.status(500).json({error:'No se pudo actualizar espacio'});}};
exports.listarBloques = async (req, res) => {
  try {
    const where = []; const params = [];
    if (req.query.id_anio_escolar) { params.push(entero(req.query.id_anio_escolar)); where.push(`b.id_anio_escolar=$${params.length}`); }
    if (req.query.id_nivel) { params.push(entero(req.query.id_nivel)); where.push(`b.id_nivel=$${params.length}`); }
    if (req.query.incluir_inactivos !== 'true') where.push('b.activo=TRUE');
    const data = await prisma.$queryRawUnsafe(`SELECT b.*,ae.anio,n.nombre nivel FROM "tbl_bloques_horarios" b JOIN "tbl_anios_escolares" ae ON ae.id=b.id_anio_escolar JOIN "tbl_niveles" n ON n.id=b.id_nivel ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ae.anio,n.nombre,b.orden`, ...params);
    res.json({ data });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudieron listar los bloques horarios' }); }
};

exports.crearBloque = async (req, res) => {
  try {
    const idAnio = entero(req.body.id_anio_escolar); const idNivel = entero(req.body.id_nivel); const nombre = texto(req.body.nombre, 100); const orden = entero(req.body.orden); const tipo = normalizarTipo(req.body.tipo || 'CLASE');
    if (!idAnio || !idNivel || !nombre || !orden || !TIPOS_BLOQUE.has(tipo) || !horaValida(req.body.hora_inicio) || !horaValida(req.body.hora_fin) || req.body.hora_fin <= req.body.hora_inicio) return res.status(400).json({ error: 'Datos de bloque inválidos' });
    const data = await prisma.$queryRawUnsafe(`INSERT INTO "tbl_bloques_horarios" (id_anio_escolar,id_nivel,nombre,orden,hora_inicio,hora_fin,tipo,creado_por) VALUES ($1,$2,$3,$4,$5::time,$6::time,$7,$8) RETURNING *`, idAnio, idNivel, nombre, orden, req.body.hora_inicio, req.body.hora_fin, tipo, req.user.id);
    await registrarAuditoria({ userId: req.user.id, accion: 'CREAR_BLOQUE_HORARIO', tipoEntidad: 'tbl_bloques_horarios', idEntidad: data[0].id, resumen: `Bloque creado: ${nombre}`, req });
    res.status(201).json({ data: data[0] });
  } catch (error) { console.error(error); res.status(error.code === '23505' ? 409 : 400).json({ error: error.code === '23505' ? 'Ya existe un bloque con ese orden para el año y nivel.' : 'No se pudo crear el bloque horario' }); }
};

exports.actualizarBloque = async (req, res) => {
  try {
    const id = entero(req.params.id); const actual = (await prisma.$queryRawUnsafe('SELECT * FROM "tbl_bloques_horarios" WHERE id=$1', id))[0];
    if (!actual) return res.status(404).json({ error: 'Bloque no encontrado' });
    const nombre = texto(req.body.nombre ?? actual.nombre, 100); const orden = entero(req.body.orden ?? actual.orden); const tipo = normalizarTipo(req.body.tipo ?? actual.tipo); const inicio = req.body.hora_inicio ?? actual.hora_inicio; const fin = req.body.hora_fin ?? actual.hora_fin;
    if (!nombre || !orden || !TIPOS_BLOQUE.has(tipo) || !horaValida(inicio) || !horaValida(fin) || fin <= inicio) return res.status(400).json({ error: 'Datos de bloque inválidos' });
    const data = await prisma.$queryRawUnsafe(`UPDATE "tbl_bloques_horarios" SET nombre=$1,orden=$2,hora_inicio=$3::time,hora_fin=$4::time,tipo=$5,actualizado_por=$6,actualizado_en=NOW() WHERE id=$7 RETURNING *`, nombre, orden, inicio, fin, tipo, req.user.id, id);
    await registrarAuditoria({ userId: req.user.id, accion: 'ACTUALIZAR_BLOQUE_HORARIO', tipoEntidad: 'tbl_bloques_horarios', idEntidad: id, resumen: `Bloque actualizado: ${nombre}`, req });
    res.json({ data: data[0] });
  } catch (error) { console.error(error); res.status(error.code === '23505' ? 409 : 400).json({ error: error.code === '23505' ? 'Ya existe un bloque con ese orden para el año y nivel.' : 'No se pudo actualizar el bloque horario' }); }
};

exports.desactivarBloque = async (req, res) => {
  try {
    const id = entero(req.params.id); const data = await prisma.$queryRawUnsafe('UPDATE "tbl_bloques_horarios" SET activo=FALSE,actualizado_por=$1,actualizado_en=NOW() WHERE id=$2 RETURNING *', req.user.id, id);
    if (!data[0]) return res.status(404).json({ error: 'Bloque no encontrado' });
    await registrarAuditoria({ userId: req.user.id, accion: 'DESACTIVAR_BLOQUE_HORARIO', tipoEntidad: 'tbl_bloques_horarios', idEntidad: id, resumen: `Bloque desactivado: ${data[0].nombre}`, req });
    res.json({ data: data[0] });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo desactivar el bloque horario' }); }
};

// Configuración anual y reversible de la denominación visible de un curso.
// El catálogo, las asignaciones y las notas conservan siempre sus IDs originales.
exports.guardarDenominacionCursoAnio = async (req, res) => {
  try {
    const idAnio = entero(req.body.id_anio_escolar);
    const idCurso = entero(req.params.idCurso);
    const nombre = texto(req.body.nombre_presentacion, 150);
    if (!idAnio || !idCurso || !nombre) return res.status(400).json({ error: 'Año escolar, curso y nombre de presentación son obligatorios.' });
    const [anio, curso] = await Promise.all([
      prisma.$queryRawUnsafe('SELECT id FROM "tbl_anios_escolares" WHERE id=$1', idAnio),
      prisma.$queryRawUnsafe('SELECT id FROM "tbl_cursos_academicos" WHERE id=$1', idCurso),
    ]);
    if (!anio[0] || !curso[0]) return res.status(404).json({ error: 'Año escolar o curso no encontrado.' });
    const rows = await prisma.$queryRawUnsafe(`INSERT INTO "tbl_denominaciones_curso_anio" (id_anio_escolar,id_curso,nombre_presentacion,creado_por)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (id_anio_escolar,id_curso) DO UPDATE SET nombre_presentacion=EXCLUDED.nombre_presentacion,actualizado_por=$4,actualizado_en=NOW()
      RETURNING *`, idAnio, idCurso, nombre, req.user.id);
    await registrarAuditoria({ userId: req.user.id, accion: 'GUARDAR_DENOMINACION_CURSO_ANIO', tipoEntidad: 'tbl_denominaciones_curso_anio', idEntidad: rows[0].id, resumen: `Curso ${idCurso}, año ${idAnio}: ${nombre}`, req });
    res.json({ data: rows[0] });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo guardar la denominación anual del curso.' }); }
};

// Selector administrativo: evita exponer IDs sin contexto y limita las opciones
// al aula y año que el editor ya seleccionó.
exports.listarAsignaciones = async (req, res) => {
  try {
    const idAnio = entero(req.query.id_anio_escolar);
    const idAula = entero(req.query.id_aula);
    const where = ['aa.activo=TRUE']; const params = [];
    if (idAnio) { params.push(idAnio); where.push(`aa.id_anio_escolar=$${params.length}`); }
    if (idAula) { params.push(idAula); where.push(`aa.id_aula=$${params.length}`); }
    const data = await prisma.$queryRawUnsafe(`SELECT aa.id,aa.id_anio_escolar,aa.id_aula,aa.id_curso,aa.id_docente,aa.horas_semanales,COALESCE(dca.nombre_presentacion,c.nombre) curso,c.color_horario,ar.nombre area,u.nombres docente
      FROM "tbl_asignaciones_academicas" aa
      JOIN "tbl_cursos_academicos" c ON c.id=aa.id_curso
      LEFT JOIN "tbl_denominaciones_curso_anio" dca ON dca.id_anio_escolar=aa.id_anio_escolar AND dca.id_curso=aa.id_curso
      JOIN "tbl_areas_academicas" ar ON ar.id=c.id_area
      JOIN "tbl_usuarios" u ON u.id=aa.id_docente
      WHERE ${where.join(' AND ')} ORDER BY ar.nombre,c.nombre,u.nombres`, ...params);
    res.json({ data });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudieron listar las asignaciones académicas' }); }
};

exports.obtenerCargaHoraria = async (req, res) => {
  try { const horario = await obtenerCabecera(prisma, entero(req.params.id)); if (!horario) return res.status(404).json({ error: 'Horario no encontrado' }); res.json({ data: await calcularCargaHoraria(prisma, horario) }); }
  catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo obtener la carga horaria' }); }
};

exports.actualizarCargaHoraria = async (req, res) => {
  try {
    const id = entero(req.params.id); const horas = entero(req.body.horas_semanales);
    if (!id || !horas || horas > 60) return res.status(400).json({ error: 'Las horas semanales deben ser un entero entre 1 y 60.' });
    const rows = await prisma.$queryRawUnsafe('UPDATE "tbl_asignaciones_academicas" SET horas_semanales=$1 WHERE id=$2 RETURNING *', horas, id);
    if (!rows[0]) return res.status(404).json({ error: 'Asignación académica no encontrada' });
    await registrarAuditoria({ userId: req.user.id, accion: 'ACTUALIZAR_CARGA_HORARIA', tipoEntidad: 'tbl_asignaciones_academicas', idEntidad: id, resumen: `Carga semanal configurada: ${horas} bloque(s)`, req });
    res.json({ data: rows[0] });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo actualizar la carga horaria' }); }
};

exports.listarDocentesDisponibilidad = async (req, res) => {
  try {
    const data = await prisma.$queryRawUnsafe(`SELECT DISTINCT u.id,u.nombres
      FROM "tbl_usuarios" u
      JOIN "tbl_roles" r ON r.id=u.id_rol
      LEFT JOIN "tbl_usuarios_permisos" upu ON upu.id_usuario=u.id
      LEFT JOIN "tbl_permisos" p ON p.id=upu.id_permiso AND p.codigo='ACADEMICO_DOCENTE'
      WHERE u.estado='ACTIVO' AND (r.codigo='DOCENTE' OR p.codigo='ACADEMICO_DOCENTE')
      ORDER BY u.nombres`);
    res.json({ data });
  }
  catch (error) { console.error(error); res.status(500).json({ error: 'No se pudieron listar docentes' }); }
};

exports.listarNivelesDocenteDisponibilidad = async (req, res) => {
  try {
    const docente = entero(req.query.id_docente); const anio = entero(req.query.id_anio_escolar);
    if (!docente || !anio) return res.status(400).json({ error: 'Docente y año escolar son obligatorios' });
    const data = await prisma.$queryRawUnsafe(`SELECT DISTINCT n.id,n.nombre
      FROM "tbl_asignaciones_academicas" aa
      JOIN "tbl_aulas" a ON a.id=aa.id_aula
      JOIN "tbl_grados" g ON g.id=a.id_grado
      JOIN "tbl_niveles" n ON n.id=g.id_nivel
      WHERE aa.id_docente=$1 AND aa.id_anio_escolar=$2 AND aa.activo=TRUE
      ORDER BY n.nombre`, docente, anio);
    res.json({ data });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudieron obtener los niveles del docente' }); }
};

exports.obtenerDisponibilidad = async (req, res) => {
  try {
    const docente=entero(req.query.id_docente), anio=entero(req.query.id_anio_escolar);
    if(!docente||!anio) return res.status(400).json({error:'Docente y año escolar son obligatorios'});
    const [data, ocupaciones] = await Promise.all([
      prisma.$queryRawUnsafe('SELECT * FROM "tbl_disponibilidad_docente" WHERE id_docente=$1 AND id_anio_escolar=$2 ORDER BY dia_semana,id_bloque_horario',docente,anio),
      prisma.$queryRawUnsafe(`SELECT d.id_bloque_horario,d.dia_semana,COALESCE(dca.nombre_presentacion,c.nombre) curso,g.nombre grado,a.seccion
        FROM "tbl_horario_detalles" d
        JOIN "tbl_horarios_escolares" h ON h.id=d.id_horario_escolar
        JOIN "tbl_asignaciones_academicas" aa ON aa.id=d.id_asignacion_academica
        JOIN "tbl_cursos_academicos" c ON c.id=aa.id_curso
        JOIN "tbl_aulas" a ON a.id=h.id_aula
        JOIN "tbl_grados" g ON g.id=a.id_grado
        LEFT JOIN "tbl_denominaciones_curso_anio" dca ON dca.id_anio_escolar=h.id_anio_escolar AND dca.id_curso=aa.id_curso
        WHERE aa.id_docente=$1 AND h.id_anio_escolar=$2 AND h.estado='PUBLICADO'
        ORDER BY d.dia_semana,d.id_bloque_horario`,docente,anio),
    ]);
    res.json({data,ocupaciones});
  }
  catch(error){console.error(error);res.status(500).json({error:'No se pudo obtener disponibilidad'});}
};

exports.guardarDisponibilidad = async (req,res) => {
  try { const docente=entero(req.body.id_docente),anio=entero(req.body.id_anio_escolar),bloque=entero(req.body.id_bloque_horario),dia=normalizarDia(req.body.dia_semana); if(!docente||!anio||!bloque||!DIAS.has(dia)) return res.status(400).json({error:'Datos de disponibilidad inválidos'}); const conflictos=await prisma.$queryRawUnsafe(`SELECT h.estado,COALESCE(dca.nombre_presentacion,c.nombre) curso,a.seccion,b.hora_inicio,b.hora_fin FROM "tbl_horario_detalles" d JOIN "tbl_horarios_escolares" h ON h.id=d.id_horario_escolar JOIN "tbl_asignaciones_academicas" aa ON aa.id=d.id_asignacion_academica JOIN "tbl_cursos_academicos" c ON c.id=aa.id_curso LEFT JOIN "tbl_denominaciones_curso_anio" dca ON dca.id_anio_escolar=h.id_anio_escolar AND dca.id_curso=aa.id_curso JOIN "tbl_aulas" a ON a.id=h.id_aula JOIN "tbl_bloques_horarios" b ON b.id=d.id_bloque_horario WHERE aa.id_docente=$1 AND h.id_anio_escolar=$2 AND d.id_bloque_horario=$3 AND d.dia_semana=$4 AND h.estado<>'ARCHIVADO'`,docente,anio,bloque,dia); const rows=await prisma.$queryRawUnsafe(`INSERT INTO "tbl_disponibilidad_docente" (id_docente,id_anio_escolar,id_bloque_horario,dia_semana,disponible,observacion,creado_por) VALUES ($1,$2,$3,$4,FALSE,$5,$6) ON CONFLICT (id_docente,id_anio_escolar,dia_semana,id_bloque_horario) DO UPDATE SET disponible=FALSE,observacion=EXCLUDED.observacion,actualizado_por=$6,actualizado_en=NOW() RETURNING *`,docente,anio,bloque,dia,texto(req.body.observacion)||null,req.user.id); await registrarAuditoria({userId:req.user.id,accion:'MARCAR_DOCENTE_NO_DISPONIBLE',tipoEntidad:'tbl_disponibilidad_docente',idEntidad:rows[0].id,resumen:`Indisponibilidad ${dia}`,req}); res.json({data:rows[0],conflictos}); }
  catch(error){console.error(error);res.status(500).json({error:'No se pudo guardar disponibilidad'});}
};

exports.restaurarDisponibilidad = async (req,res) => { try { const docente=entero(req.body.id_docente),anio=entero(req.body.id_anio_escolar),bloque=entero(req.body.id_bloque_horario),dia=normalizarDia(req.body.dia_semana); const rows=await prisma.$queryRawUnsafe('DELETE FROM "tbl_disponibilidad_docente" WHERE id_docente=$1 AND id_anio_escolar=$2 AND id_bloque_horario=$3 AND dia_semana=$4 RETURNING *',docente,anio,bloque,dia); if(rows[0]) await registrarAuditoria({userId:req.user.id,accion:'RESTAURAR_DISPONIBILIDAD_DOCENTE',tipoEntidad:'tbl_disponibilidad_docente',idEntidad:rows[0].id,resumen:`Disponibilidad restaurada ${dia}`,req}); res.json({data:rows[0]||null}); } catch(error){console.error(error);res.status(500).json({error:'No se pudo restaurar disponibilidad'});} };

exports.listarHorarios = async (req, res) => {
  try {
    const where = []; const params = [];
    for (const [campo, columna] of [['id_anio_escolar', 'h.id_anio_escolar'], ['id_aula', 'h.id_aula'], ['estado', 'h.estado']]) if (req.query[campo]) { params.push(campo === 'estado' ? texto(req.query[campo], 12).toUpperCase() : entero(req.query[campo])); where.push(`${columna}=$${params.length}`); }
    const data = await prisma.$queryRawUnsafe(`SELECT h.*,ae.anio,a.seccion,g.nombre grado,n.nombre nivel,COUNT(d.id)::int total_clases FROM "tbl_horarios_escolares" h JOIN "tbl_anios_escolares" ae ON ae.id=h.id_anio_escolar JOIN "tbl_aulas" a ON a.id=h.id_aula JOIN "tbl_grados" g ON g.id=a.id_grado JOIN "tbl_niveles" n ON n.id=g.id_nivel LEFT JOIN "tbl_horario_detalles" d ON d.id_horario_escolar=h.id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} GROUP BY h.id,ae.anio,a.seccion,g.nombre,n.nombre ORDER BY ae.anio DESC,n.nombre,g.nombre,a.seccion,h.version DESC`, ...params);
    res.json({ data });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudieron listar los horarios' }); }
};

exports.crearBorrador = async (req, res) => {
  try {
    const idAnio = entero(req.body.id_anio_escolar); const idAula = entero(req.body.id_aula);
    if (!idAnio || !idAula) return res.status(400).json({ error: 'Año escolar y aula son obligatorios' });
    const data = await prisma.$transaction(async tx => {
      const aula = (await tx.$queryRawUnsafe('SELECT id FROM "tbl_aulas" WHERE id=$1 AND id_anio_escolar=$2', idAula, idAnio))[0];
      if (!aula) throw new Error('AULA_ANIO_INVALIDOS');
      const siguiente = await tx.$queryRawUnsafe('SELECT COALESCE(MAX(version),0)+1 siguiente FROM "tbl_horarios_escolares" WHERE id_anio_escolar=$1 AND id_aula=$2', idAnio, idAula);
      return (await tx.$queryRawUnsafe('INSERT INTO "tbl_horarios_escolares" (id_anio_escolar,id_aula,version,creado_por) VALUES ($1,$2,$3,$4) RETURNING *', idAnio, idAula, siguiente[0].siguiente, req.user.id))[0];
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'CREAR_HORARIO_ESCOLAR', tipoEntidad: 'tbl_horarios_escolares', idEntidad: data.id, resumen: `Horario borrador v${data.version} creado`, req });
    res.status(201).json({ data });
  } catch (error) { console.error(error); res.status(error.message === 'AULA_ANIO_INVALIDOS' ? 400 : 500).json({ error: error.message === 'AULA_ANIO_INVALIDOS' ? 'El aula no pertenece al año escolar indicado.' : 'No se pudo crear el horario' }); }
};

exports.obtenerHorario = async (req, res) => {
  try {
    const horario = await obtenerCabecera(prisma, entero(req.params.id));
    if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });
    const [detalles, bloques] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT d.*,b.nombre bloque,b.orden,b.hora_inicio,b.hora_fin,b.tipo,aa.id_docente,u.nombres docente,COALESCE(dca.nombre_presentacion,c.nombre) curso,c.color_horario,ar.nombre area,ef.nombre espacio_fisico FROM "tbl_horario_detalles" d JOIN "tbl_bloques_horarios" b ON b.id=d.id_bloque_horario JOIN "tbl_asignaciones_academicas" aa ON aa.id=d.id_asignacion_academica JOIN "tbl_usuarios" u ON u.id=aa.id_docente JOIN "tbl_cursos_academicos" c ON c.id=aa.id_curso JOIN "tbl_areas_academicas" ar ON ar.id=c.id_area LEFT JOIN "tbl_denominaciones_curso_anio" dca ON dca.id_anio_escolar=$2 AND dca.id_curso=aa.id_curso LEFT JOIN "tbl_espacios_fisicos" ef ON ef.id=d.id_espacio_fisico WHERE d.id_horario_escolar=$1 ORDER BY d.dia_semana,b.orden`, horario.id, horario.id_anio_escolar),
      prisma.$queryRawUnsafe('SELECT * FROM "tbl_bloques_horarios" WHERE id_anio_escolar=$1 AND id_nivel=$2 ORDER BY orden', horario.id_anio_escolar, horario.id_nivel),
    ]);
    res.json({ data: { ...horario, detalles, bloques } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo obtener el horario' }); }
};

exports.actualizarBorrador = async (req, res) => {
  try {
    const horario = await prisma.$transaction(async tx => {
      const actual = await obtenerCabecera(tx, entero(req.params.id), true);
      if (!actual) throw new Error('HORARIO_NO_ENCONTRADO');
      if (!EDITABLES.has(actual.estado)) throw new Error('HORARIO_NO_EDITABLE');
      await tx.$queryRawUnsafe('UPDATE "tbl_horarios_escolares" SET estado=$1,actualizado_por=$2,actualizado_en=NOW() WHERE id=$3', 'BORRADOR', req.user.id, actual.id);
      return { ...actual, estado: 'BORRADOR' };
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'ACTUALIZAR_HORARIO_ESCOLAR', tipoEntidad: 'tbl_horarios_escolares', idEntidad: horario.id, resumen: `Horario v${horario.version} actualizado como borrador`, req });
    res.json({ data: horario });
  } catch (error) {
    console.error(error);
    const mapa = { HORARIO_NO_ENCONTRADO: [404, 'Horario no encontrado'], HORARIO_NO_EDITABLE: [409, 'Solo se puede actualizar un horario borrador o validado.'] };
    const [status, mensaje] = mapa[error.message] || [500, 'No se pudo actualizar el horario'];
    res.status(status).json({ error: mensaje });
  }
};

async function guardarDetalle(req, res, esActualizacion) {
  try {
    const idHorario = entero(req.params.id); const idDetalle = esActualizacion ? entero(req.params.idDetalle) : null;
    const resultado = await prisma.$transaction(async tx => {
      const horario = await obtenerCabecera(tx, idHorario, true);
      if (!horario) throw new Error('HORARIO_NO_ENCONTRADO');
      if (!EDITABLES.has(horario.estado)) throw new Error('HORARIO_NO_EDITABLE');
      let base = req.body;
      if (idDetalle) {
        const detalleActual = (await tx.$queryRawUnsafe('SELECT * FROM "tbl_horario_detalles" WHERE id=$1 AND id_horario_escolar=$2 FOR UPDATE', idDetalle, idHorario))[0];
        if (!detalleActual) throw new Error('DETALLE_NO_ENCONTRADO');
        base = { ...detalleActual, ...req.body };
      }
      const validacion = await validarDetalle(tx, horario, base, idDetalle);
      if (validacion.errores.length) throw Object.assign(new Error('DETALLE_INVALIDO'), { validacion });
      const observacion = texto(base.observacion, 500) || null;
      let detalle;
      if (idDetalle) detalle = (await tx.$queryRawUnsafe(`UPDATE "tbl_horario_detalles" SET id_bloque_horario=$1,dia_semana=$2,id_asignacion_academica=$3,id_espacio_fisico=$4,observacion=$5,actualizado_por=$6,actualizado_en=NOW() WHERE id=$7 RETURNING *`, entero(base.id_bloque_horario), validacion.dia, entero(base.id_asignacion_academica), entero(base.id_espacio_fisico)||null, observacion, req.user.id, idDetalle))[0];
      else detalle = (await tx.$queryRawUnsafe(`INSERT INTO "tbl_horario_detalles" (id_horario_escolar,id_bloque_horario,dia_semana,id_asignacion_academica,id_espacio_fisico,observacion,creado_por) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, idHorario, entero(base.id_bloque_horario), validacion.dia, entero(base.id_asignacion_academica), entero(base.id_espacio_fisico)||null, observacion, req.user.id))[0];
      await tx.$queryRawUnsafe('UPDATE "tbl_horarios_escolares" SET estado=$1,actualizado_por=$2,actualizado_en=NOW() WHERE id=$3', 'BORRADOR', req.user.id, idHorario);
      return detalle;
    });
    await registrarAuditoria({ userId: req.user.id, accion: esActualizacion ? 'MODIFICAR_CLASE_HORARIO' : 'AGREGAR_CLASE_HORARIO', tipoEntidad: 'tbl_horario_detalles', idEntidad: resultado.id, resumen: `Clase ${esActualizacion ? 'modificada' : 'agregada'} en horario ${idHorario}`, req });
    res.status(esActualizacion ? 200 : 201).json({ data: resultado });
  } catch (error) {
    console.error(error);
    const estados = { HORARIO_NO_ENCONTRADO: [404, 'Horario no encontrado'], HORARIO_NO_EDITABLE: [409, 'El horario publicado o archivado no se puede editar'], DETALLE_NO_ENCONTRADO: [404, 'Clase no encontrada'], DETALLE_INVALIDO: [409, 'La clase no cumple las validaciones'] };
    const [status, mensaje] = estados[error.message] || [500, 'No se pudo guardar la clase'];
    res.status(status).json({ error: mensaje, validacion: error.validacion || undefined });
  }
}
exports.agregarClase = (req, res) => guardarDetalle(req, res, false);
exports.modificarClase = (req, res) => guardarDetalle(req, res, true);

exports.eliminarClase = async (req, res) => {
  try {
    const idHorario = entero(req.params.id); const idDetalle = entero(req.params.idDetalle);
    const detalle = await prisma.$transaction(async tx => {
      const horario = await obtenerCabecera(tx, idHorario, true);
      if (!horario) throw new Error('HORARIO_NO_ENCONTRADO');
      if (!EDITABLES.has(horario.estado)) throw new Error('HORARIO_NO_EDITABLE');
      const rows = await tx.$queryRawUnsafe('DELETE FROM "tbl_horario_detalles" WHERE id=$1 AND id_horario_escolar=$2 RETURNING *', idDetalle, idHorario);
      if (!rows[0]) throw new Error('DETALLE_NO_ENCONTRADO');
      await tx.$queryRawUnsafe('UPDATE "tbl_horarios_escolares" SET estado=$1,actualizado_por=$2,actualizado_en=NOW() WHERE id=$3', 'BORRADOR', req.user.id, idHorario);
      return rows[0];
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'ELIMINAR_CLASE_HORARIO', tipoEntidad: 'tbl_horario_detalles', idEntidad: detalle.id, resumen: `Clase eliminada del horario ${idHorario}`, req });
    res.json({ data: detalle });
  } catch (error) { const mapa = { HORARIO_NO_ENCONTRADO: [404, 'Horario no encontrado'], HORARIO_NO_EDITABLE: [409, 'El horario publicado o archivado no se puede editar'], DETALLE_NO_ENCONTRADO: [404, 'Clase no encontrada'] }; const [status, mensaje] = mapa[error.message] || [500, 'No se pudo eliminar la clase']; res.status(status).json({ error: mensaje }); }
};

exports.validarHorario = async (req, res) => {
  try {
    const id = entero(req.params.id);
    const resultado = await prisma.$transaction(async tx => {
      const horario = await obtenerCabecera(tx, id, true);
      if (!horario) throw new Error('HORARIO_NO_ENCONTRADO');
      if (!EDITABLES.has(horario.estado)) throw new Error('HORARIO_NO_VALIDABLE');
      const diagnostico = await diagnosticarHorario(tx, horario);
      if (diagnostico.valido && horario.estado !== 'PUBLICADO') await tx.$queryRawUnsafe('UPDATE "tbl_horarios_escolares" SET estado=$1,actualizado_por=$2,actualizado_en=NOW() WHERE id=$3', 'VALIDADO', req.user.id, id);
      return diagnostico;
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'VALIDAR_HORARIO_ESCOLAR', tipoEntidad: 'tbl_horarios_escolares', idEntidad: id, resumen: resultado.valido ? 'Horario validado correctamente' : `Horario con ${resultado.errores.length} error(es)`, req });
    res.json(resultado);
  } catch (error) {
    console.error(error);
    const mapa = { HORARIO_NO_ENCONTRADO: [404, 'Horario no encontrado'], HORARIO_NO_VALIDABLE: [409, 'Solo un horario borrador o validado puede validarse'] };
    const [status, mensaje] = mapa[error.message] || [500, 'No se pudo validar el horario'];
    res.status(status).json({ error: mensaje });
  }
};

exports.publicarHorario = async (req, res) => {
  try {
    const id = entero(req.params.id);
    const publicado = await prisma.$transaction(async tx => {
      const horario = await obtenerCabecera(tx, id, true);
      if (!horario) throw new Error('HORARIO_NO_ENCONTRADO');
      if (!EDITABLES.has(horario.estado)) throw new Error('ESTADO_NO_PUBLICABLE');
      const diagnostico = await diagnosticarHorario(tx, horario);
      if (!diagnostico.valido) throw Object.assign(new Error('HORARIO_INVALIDO'), { diagnostico });
      await tx.$queryRawUnsafe(`UPDATE "tbl_horarios_escolares" SET estado='ARCHIVADO',actualizado_por=$1,actualizado_en=NOW() WHERE id_anio_escolar=$2 AND id_aula=$3 AND estado='PUBLICADO' AND id<>$4`, req.user.id, horario.id_anio_escolar, horario.id_aula, horario.id);
      return (await tx.$queryRawUnsafe(`UPDATE "tbl_horarios_escolares" SET estado='PUBLICADO',publicado_por=$1,publicado_en=NOW(),actualizado_por=$1,actualizado_en=NOW() WHERE id=$2 RETURNING *`, req.user.id, id))[0];
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'PUBLICAR_HORARIO_ESCOLAR', tipoEntidad: 'tbl_horarios_escolares', idEntidad: id, resumen: `Horario v${publicado.version} publicado`, req });
    res.json({ data: publicado });
  } catch (error) { console.error(error); const mapa = { HORARIO_NO_ENCONTRADO: [404, 'Horario no encontrado'], ESTADO_NO_PUBLICABLE: [409, 'Solo un horario borrador o validado puede publicarse'], HORARIO_INVALIDO: [409, 'El horario tiene errores críticos'] }; const [status, mensaje] = mapa[error.message] || [500, 'No se pudo publicar el horario']; res.status(status).json({ error: mensaje, validacion: error.diagnostico || undefined }); }
};

exports.archivarHorario = async (req, res) => {
  try {
    const id = entero(req.params.id); const data = await prisma.$queryRawUnsafe(`UPDATE "tbl_horarios_escolares" SET estado='ARCHIVADO',actualizado_por=$1,actualizado_en=NOW() WHERE id=$2 RETURNING *`, req.user.id, id);
    if (!data[0]) return res.status(404).json({ error: 'Horario no encontrado' });
    await registrarAuditoria({ userId: req.user.id, accion: 'ARCHIVAR_HORARIO_ESCOLAR', tipoEntidad: 'tbl_horarios_escolares', idEntidad: id, resumen: `Horario v${data[0].version} archivado`, req });
    res.json({ data: data[0] });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo archivar el horario' }); }
};

exports.misHorariosPadre = async (req, res) => {
  try {
    const hijos = await prisma.$queryRawUnsafe(`SELECT al.id id_alumno,al.codigo_alumno,al.nombre_completo,a.id id_aula,a.seccion,g.nombre grado,n.id id_nivel,n.nombre nivel,ae.id id_anio_escolar,ae.anio
      FROM "tbl_padres" p JOIN "tbl_padres_alumnos" pa ON pa.id_padre=p.id JOIN "tbl_alumnos" al ON al.id=pa.id_alumno JOIN "tbl_aulas" a ON a.id=al.id_aula JOIN "tbl_grados" g ON g.id=a.id_grado JOIN "tbl_niveles" n ON n.id=g.id_nivel JOIN "tbl_anios_escolares" ae ON ae.id=a.id_anio_escolar
      WHERE p.id_usuario=$1 AND al.estado='ACTIVO' ORDER BY al.nombre_completo`, req.user.id);
    const data = await Promise.all(hijos.map(async hijo => {
      const horario = (await prisma.$queryRawUnsafe(`SELECT id,version,publicado_en FROM "tbl_horarios_escolares" WHERE id_anio_escolar=$1 AND id_aula=$2 AND estado='PUBLICADO'`, hijo.id_anio_escolar, hijo.id_aula))[0];
      if (!horario) return { alumno: { id: hijo.id_alumno, codigo: hijo.codigo_alumno, nombre: hijo.nombre_completo }, aula: { id: hijo.id_aula, seccion: hijo.seccion, grado: hijo.grado, nivel: hijo.nivel, anio: hijo.anio }, horarioPublicado: false, bloques: [], clases: [] };
      const [bloques, clases] = await Promise.all([
        prisma.$queryRawUnsafe('SELECT id,nombre,orden,hora_inicio,hora_fin,tipo FROM "tbl_bloques_horarios" WHERE id_anio_escolar=$1 AND id_nivel=$2 AND activo=TRUE ORDER BY orden', hijo.id_anio_escolar, hijo.id_nivel),
        prisma.$queryRawUnsafe(`SELECT d.id,d.dia_semana,d.id_bloque_horario,d.observacion,COALESCE(dca.nombre_presentacion,c.nombre) curso,c.color_horario,ar.nombre area,u.nombres docente,ef.nombre espacio_fisico FROM "tbl_horario_detalles" d JOIN "tbl_horarios_escolares" h ON h.id=d.id_horario_escolar JOIN "tbl_asignaciones_academicas" aa ON aa.id=d.id_asignacion_academica JOIN "tbl_cursos_academicos" c ON c.id=aa.id_curso JOIN "tbl_areas_academicas" ar ON ar.id=c.id_area JOIN "tbl_usuarios" u ON u.id=aa.id_docente LEFT JOIN "tbl_denominaciones_curso_anio" dca ON dca.id_anio_escolar=h.id_anio_escolar AND dca.id_curso=aa.id_curso LEFT JOIN "tbl_espacios_fisicos" ef ON ef.id=d.id_espacio_fisico WHERE d.id_horario_escolar=$1 ORDER BY d.dia_semana,d.id_bloque_horario`, horario.id),
      ]);
      return { alumno: { id: hijo.id_alumno, codigo: hijo.codigo_alumno, nombre: hijo.nombre_completo }, aula: { id: hijo.id_aula, seccion: hijo.seccion, grado: hijo.grado, nivel: hijo.nivel, anio: hijo.anio }, horarioPublicado: true, horario: { id: horario.id, version: horario.version, publicado_en: horario.publicado_en }, bloques, clases };
    }));
    res.json({ data });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudieron obtener los horarios de sus hijos' }); }
};

exports.miHorarioDocente = async (req, res) => {
  try {
    const clases = await prisma.$queryRawUnsafe(`SELECT d.dia_semana,d.observacion,b.nombre bloque,b.hora_inicio,b.hora_fin,b.tipo,COALESCE(dca.nombre_presentacion,c.nombre) curso,c.color_horario,n.nombre nivel,g.nombre grado,a.seccion,ae.anio,u.nombres docente,ef.nombre espacio_fisico
      FROM "tbl_horario_detalles" d JOIN "tbl_horarios_escolares" h ON h.id=d.id_horario_escolar JOIN "tbl_asignaciones_academicas" aa ON aa.id=d.id_asignacion_academica JOIN "tbl_bloques_horarios" b ON b.id=d.id_bloque_horario JOIN "tbl_cursos_academicos" c ON c.id=aa.id_curso JOIN "tbl_aulas" a ON a.id=h.id_aula JOIN "tbl_grados" g ON g.id=a.id_grado JOIN "tbl_niveles" n ON n.id=g.id_nivel JOIN "tbl_anios_escolares" ae ON ae.id=h.id_anio_escolar JOIN "tbl_usuarios" u ON u.id=aa.id_docente LEFT JOIN "tbl_denominaciones_curso_anio" dca ON dca.id_anio_escolar=h.id_anio_escolar AND dca.id_curso=aa.id_curso LEFT JOIN "tbl_espacios_fisicos" ef ON ef.id=d.id_espacio_fisico WHERE aa.id_docente=$1 AND h.estado='PUBLICADO' ORDER BY ae.anio DESC,b.hora_inicio,d.dia_semana`, req.user.id);
    res.json({ data: { docente: clases[0]?.docente || req.user.nombres || '', anio: clases[0]?.anio || null, clases } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo obtener el horario docente' }); }
};
