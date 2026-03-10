const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { parseDateOnly, MESES_KEYS, MES_LABELS } = require('../utils/dateUtils');

// --- ANIOS ESCOLARES ---
const listarAnios = async (req, res) => {
  try {
    const anios = await prisma.tbl_anios_escolares.findMany({ include: { tbl_colegio: { select: { nombre: true } } }, orderBy: { anio: 'desc' } });
    const data = anios.map(a => ({ ...a, colegio: a.tbl_colegio, tbl_colegio: undefined }));
    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al listar anios escolares' }); }
};

const crearAnio = async (req, res) => {
  const { id_colegio, anio, fecha_inicio, fecha_fin } = req.body;
  try {
    const existe = await prisma.tbl_anios_escolares.findFirst({ where: { id_colegio, anio } });
    if (existe) return res.status(409).json({ error: 'Ano escolar ya existe para este colegio' });

    const nuevo = await prisma.tbl_anios_escolares.create({
      data: { id_colegio, anio, fecha_inicio: parseDateOnly(fecha_inicio), fecha_fin: parseDateOnly(fecha_fin), activo: false, user_id_registration: req.user.id },
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'CREAR_ANIO_ESCOLAR', tipoEntidad: 'tbl_anios_escolares', idEntidad: nuevo.id, resumen: `Ano escolar ${anio} creado` });
    res.status(201).json(nuevo);
  } catch (error) { res.status(500).json({ error: 'Error al crear anio escolar' }); }
};

const activarAnio = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const anio = await prisma.tbl_anios_escolares.findUnique({ where: { id } });
    if (!anio) return res.status(404).json({ error: 'Ano escolar no encontrado' });

    await prisma.tbl_anios_escolares.updateMany({ where: { id_colegio: anio.id_colegio }, data: { activo: false } });
    await prisma.tbl_anios_escolares.update({ where: { id }, data: { activo: true, user_id_modification: req.user.id, date_time_modification: new Date() } });

    await registrarAuditoria({ userId: req.user.id, accion: 'ACTIVAR_ANIO_ESCOLAR', tipoEntidad: 'tbl_anios_escolares', idEntidad: id, resumen: `Ano escolar ${anio.anio} activado` });
    res.json({ mensaje: 'Ano escolar activado' });
  } catch (error) { res.status(500).json({ error: 'Error al activar anio escolar' }); }
};

// --- NIVELES ---
const listarNiveles = async (req, res) => {
  try {
    const niveles = await prisma.tbl_niveles.findMany({ include: { tbl_grados: { orderBy: { orden: 'asc' } } }, orderBy: { id: 'asc' } });
    const data = niveles.map(n => ({
      ...n,
      grados: (n.tbl_grados || []).map(g => ({ id: g.id, nombre: g.nombre, orden: g.orden })),
      tbl_grados: undefined,
    }));
    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al listar niveles' }); }
};

const crearNivel = async (req, res) => {
  const { id_colegio, nombre } = req.body;
  try {
    const nivel = await prisma.tbl_niveles.create({ data: { id_colegio, nombre, user_id_registration: req.user.id } });
    res.status(201).json(nivel);
  } catch (error) { res.status(500).json({ error: 'Error al crear nivel' }); }
};

// --- GRADOS ---
const listarGrados = async (req, res) => {
  try {
    const grados = await prisma.tbl_grados.findMany({ include: { tbl_niveles: { select: { id: true, nombre: true } } }, orderBy: [{ id_nivel: 'asc' }, { orden: 'asc' }] });
    const data = grados.map(g => ({
      ...g,
      nivel: g.tbl_niveles,
      tbl_niveles: undefined,
    }));
    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al listar grados' }); }
};

const crearGrado = async (req, res) => {
  const { id_nivel, nombre, orden } = req.body;
  try {
    const grado = await prisma.tbl_grados.create({ data: { id_nivel, nombre, orden: orden || 0, user_id_registration: req.user.id } });
    res.status(201).json(grado);
  } catch (error) { res.status(500).json({ error: 'Error al crear grado' }); }
};

// --- AULAS ---
const listarAulas = async (req, res) => {
  const { id_anio_escolar } = req.query;
  try {
    const where = id_anio_escolar ? { id_anio_escolar: parseInt(id_anio_escolar) } : {};
    const aulas = await prisma.tbl_aulas.findMany({
      where,
      include: {
        tbl_grados: { include: { tbl_niveles: { select: { id: true, nombre: true } } } },
        tbl_asignaciones_tutor: { include: { tbl_usuarios: { select: { id: true, nombres: true } } } },
        _count: { select: { tbl_alumnos: true } },
      },
      orderBy: { id: 'asc' },
    });

    const data = aulas.map(a => ({
      id: a.id,
      id_anio_escolar: a.id_anio_escolar,
      id_grado: a.id_grado,
      seccion: a.seccion,
      grado: a.tbl_grados ? {
        id: a.tbl_grados.id,
        nombre: a.tbl_grados.nombre,
        nivel: a.tbl_grados.tbl_niveles,
      } : null,
      asignacion_tutor: a.tbl_asignaciones_tutor ? [{
        id: a.tbl_asignaciones_tutor.id,
        id_usuario_tutor: a.tbl_asignaciones_tutor.id_usuario_tutor,
        tutor: a.tbl_asignaciones_tutor.tbl_usuarios,
      }] : [],
      total_alumnos: a._count?.tbl_alumnos || 0,
    }));

    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al listar aulas' }); }
};

const obtenerAula = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const aula = await prisma.tbl_aulas.findUnique({
      where: { id },
      include: {
        tbl_grados: { include: { tbl_niveles: { select: { id: true, nombre: true } } } },
        tbl_asignaciones_tutor: { include: { tbl_usuarios: { select: { id: true, nombres: true } } } },
        tbl_alumnos: {
          include: {
            tbl_padres_alumnos: { include: { tbl_padres: { select: { id: true, nombre_completo: true, dni: true, celular: true } } } },
            tbl_carnets: { select: { id: true, qr_token: true, version_carnet: true } },
          },
          orderBy: { nombre_completo: 'asc' },
        },
      },
    });

    if (!aula) return res.status(404).json({ error: 'Aula no encontrada' });

    const data = {
      id: aula.id,
      seccion: aula.seccion,
      grado: aula.tbl_grados ? {
        id: aula.tbl_grados.id,
        nombre: aula.tbl_grados.nombre,
        nivel: aula.tbl_grados.tbl_niveles,
      } : null,
      tutor: aula.tbl_asignaciones_tutor?.tbl_usuarios || null,
      alumnos: aula.tbl_alumnos.map(a => ({
        id: a.id,
        codigo_alumno: a.codigo_alumno,
        dni: a.dni,
        nombre_completo: a.nombre_completo,
        foto_url: a.foto_url,
        estado: a.estado,
        padre: a.tbl_padres_alumnos?.tbl_padres || null,
        carnet: a.tbl_carnets ? {
          qr_token: a.tbl_carnets.qr_token,
          version: a.tbl_carnets.version_carnet,
        } : null,
      })),
      total_alumnos: aula.tbl_alumnos.length,
    };

    res.json({ data });
  } catch (error) {
    console.error('Error al obtener aula:', error);
    res.status(500).json({ error: 'Error al obtener detalle del aula' });
  }
};

const crearAula = async (req, res) => {
  const { id_anio_escolar, id_grado, seccion } = req.body;
  try {
    const existe = await prisma.tbl_aulas.findFirst({ where: { id_anio_escolar, id_grado, seccion } });
    if (existe) return res.status(409).json({ error: 'Aula ya existe para este grado/seccion/ano' });

    const aula = await prisma.tbl_aulas.create({
      data: { id_anio_escolar, id_grado, seccion, user_id_registration: req.user.id },
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'CREAR_AULA', tipoEntidad: 'tbl_aulas', idEntidad: aula.id, resumen: `Aula ${seccion} creada` });
    res.status(201).json(aula);
  } catch (error) { res.status(500).json({ error: 'Error al crear aula' }); }
};

const actualizarAula = async (req, res) => {
  const id = parseInt(req.params.id);
  const { seccion } = req.body;
  try {
    const data = { user_id_modification: req.user.id, date_time_modification: new Date() };
    if (seccion) data.seccion = seccion;

    await prisma.tbl_aulas.update({ where: { id }, data });
    res.json({ mensaje: 'Aula actualizada' });
  } catch (error) { res.status(500).json({ error: 'Error al actualizar aula' }); }
};

// --- ASIGNACION TUTOR ---
const asignarTutor = async (req, res) => {
  const { id_aula, id_usuario_tutor } = req.body;
  try {
    const existente = await prisma.tbl_asignaciones_tutor.findUnique({ where: { id_aula } });
    if (existente) {
      await prisma.tbl_asignaciones_tutor.update({ where: { id: existente.id }, data: { id_usuario_tutor, user_id_modification: req.user.id, date_time_modification: new Date() } });
    } else {
      await prisma.tbl_asignaciones_tutor.create({ data: { id_aula, id_usuario_tutor, user_id_registration: req.user.id } });
    }
    await registrarAuditoria({ userId: req.user.id, accion: 'ASIGNAR_TUTOR', tipoEntidad: 'tbl_asignaciones_tutor', idEntidad: id_aula, resumen: `Tutor ${id_usuario_tutor} asignado a aula ${id_aula}` });
    res.json({ mensaje: 'Tutor asignado' });
  } catch (error) { res.status(500).json({ error: 'Error al asignar tutor' }); }
};

// --- CALENDARIO ESCOLAR ---
const listarCalendario = async (req, res) => {
  const { id_anio_escolar } = req.params;
  try {
    const dias = await prisma.tbl_calendario_escolar.findMany({ where: { id_anio_escolar: parseInt(id_anio_escolar) }, orderBy: { fecha: 'asc' } });
    res.json({ data: dias });
  } catch (error) { res.status(500).json({ error: 'Error al listar calendario' }); }
};

const actualizarDiaCalendario = async (req, res) => {
  const { id_anio_escolar, fecha, es_dia_lectivo, nota } = req.body;
  try {
    const dia = await prisma.tbl_calendario_escolar.upsert({
      where: { id_anio_escolar_fecha: { id_anio_escolar, fecha: parseDateOnly(fecha) } },
      update: { es_dia_lectivo, nota, user_id_modification: req.user.id, date_time_modification: new Date() },
      create: { id_anio_escolar, fecha: parseDateOnly(fecha), es_dia_lectivo, nota, user_id_registration: req.user.id },
    });
    res.json(dia);
  } catch (error) { res.status(500).json({ error: 'Error al actualizar dia del calendario' }); }
};

// --- PUNTOS DE ESCANEO ---
const listarPuntosEscaneo = async (req, res) => {
  try {
    const puntos = await prisma.tbl_puntos_escaneo.findMany({ orderBy: { id: 'asc' } });
    res.json({ data: puntos });
  } catch (error) { res.status(500).json({ error: 'Error al listar puntos de escaneo' }); }
};

const crearPuntoEscaneo = async (req, res) => {
  const { nombre } = req.body;
  try {
    const punto = await prisma.tbl_puntos_escaneo.create({ data: { nombre, activo: true, user_id_registration: req.user.id } });
    res.status(201).json(punto);
  } catch (error) { res.status(500).json({ error: 'Error al crear punto de escaneo' }); }
};

const asignarPorteria = async (req, res) => {
  const { id_usuario_porteria, id_punto_escaneo } = req.body;
  try {
    const existente = await prisma.tbl_asignaciones_porteria.findUnique({ where: { id_usuario_porteria } });
    if (existente) {
      await prisma.tbl_asignaciones_porteria.update({ where: { id: existente.id }, data: { id_punto_escaneo, user_id_modification: req.user.id, date_time_modification: new Date() } });
    } else {
      await prisma.tbl_asignaciones_porteria.create({ data: { id_usuario_porteria, id_punto_escaneo, user_id_registration: req.user.id } });
    }
    res.json({ mensaje: 'Porteria asignada' });
  } catch (error) { res.status(500).json({ error: 'Error al asignar porteria' }); }
};

// --- DATOS DEL COLEGIO ---
const obtenerColegio = async (req, res) => {
  try {
    const colegio = await prisma.tbl_colegio.findFirst();
    if (!colegio) return res.status(404).json({ error: 'Colegio no configurado' });
    res.json({ data: {
      id: colegio.id, nombre: colegio.nombre, timezone: colegio.timezone,
      telefono_whatsapp: colegio.telefono_whatsapp,
      lema: colegio.lema, descripcion: colegio.descripcion,
      direccion: colegio.direccion, email: colegio.email, telefono: colegio.telefono,
    }});
  } catch (error) { res.status(500).json({ error: 'Error al obtener datos del colegio' }); }
};

const actualizarColegio = async (req, res) => {
  const { telefono_whatsapp, lema, descripcion, direccion, email, telefono } = req.body;
  try {
    const colegio = await prisma.tbl_colegio.findFirst();
    if (!colegio) return res.status(404).json({ error: 'Colegio no configurado' });
    const data = { user_id_modification: req.user.id, date_time_modification: new Date() };
    if (telefono_whatsapp !== undefined) data.telefono_whatsapp = telefono_whatsapp ? telefono_whatsapp.replace(/\D/g, '') : telefono_whatsapp;
    if (lema !== undefined) data.lema = lema;
    if (descripcion !== undefined) data.descripcion = descripcion;
    if (direccion !== undefined) data.direccion = direccion;
    if (email !== undefined) data.email = email;
    if (telefono !== undefined) data.telefono = telefono;
    await prisma.tbl_colegio.update({ where: { id: colegio.id }, data });
    res.json({ mensaje: 'Datos del colegio actualizados' });
  } catch (error) { res.status(500).json({ error: 'Error al actualizar datos del colegio' }); }
};

// --- HORARIOS POR NIVEL ---
const listarHorarios = async (req, res) => {
  const { id_anio_escolar } = req.query;
  try {
    const where = id_anio_escolar ? { id_anio_escolar: parseInt(id_anio_escolar) } : {};
    const horarios = await prisma.tbl_horarios_nivel.findMany({
      where,
      include: { tbl_niveles: { select: { id: true, nombre: true } } },
      orderBy: { id_nivel: 'asc' },
    });
    const data = horarios.map(h => ({
      id: h.id,
      id_nivel: h.id_nivel,
      id_anio_escolar: h.id_anio_escolar,
      nivel: h.tbl_niveles?.nombre || '',
      hora_inicio: h.hora_inicio,
      tolerancia_tardanza_min: h.tolerancia_tardanza_min,
      hora_limite_no_ingreso: h.hora_limite_no_ingreso,
    }));
    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al listar horarios' }); }
};

const guardarHorario = async (req, res) => {
  const { id_nivel, id_anio_escolar, hora_inicio, tolerancia_tardanza_min, hora_limite_no_ingreso } = req.body;
  if (!id_nivel || !id_anio_escolar || !hora_inicio || !hora_limite_no_ingreso) {
    return res.status(400).json({ error: 'Nivel, ano escolar, hora inicio y hora limite son obligatorios' });
  }
  try {
    const horario = await prisma.tbl_horarios_nivel.upsert({
      where: { id_nivel_id_anio_escolar: { id_nivel, id_anio_escolar } },
      update: {
        hora_inicio: new Date(`1970-01-01T${hora_inicio}:00Z`),
        tolerancia_tardanza_min: tolerancia_tardanza_min || 15,
        hora_limite_no_ingreso: new Date(`1970-01-01T${hora_limite_no_ingreso}:00Z`),
        user_id_modification: req.user.id,
        date_time_modification: new Date(),
      },
      create: {
        id_nivel, id_anio_escolar,
        hora_inicio: new Date(`1970-01-01T${hora_inicio}:00Z`),
        tolerancia_tardanza_min: tolerancia_tardanza_min || 15,
        hora_limite_no_ingreso: new Date(`1970-01-01T${hora_limite_no_ingreso}:00Z`),
        user_id_registration: req.user.id,
      },
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'GUARDAR_HORARIO_NIVEL', tipoEntidad: 'tbl_horarios_nivel', idEntidad: horario.id, resumen: `Horario guardado para nivel ${id_nivel}` });
    res.json({ mensaje: 'Horario guardado', id: horario.id });
  } catch (error) {
    console.error('Error al guardar horario:', error);
    res.status(500).json({ error: 'Error al guardar horario' });
  }
};

// --- MESES ESCOLARES (fuente centralizada) ---
const listarMeses = async (req, res) => {
  try {
    const data = MESES_KEYS.map(key => ({ clave_mes: key, nombre: MES_LABELS[key] }));
    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al listar meses' }); }
};

module.exports = {
  listarAnios, crearAnio, activarAnio,
  listarNiveles, crearNivel,
  listarGrados, crearGrado,
  listarAulas, obtenerAula, crearAula, actualizarAula, asignarTutor,
  listarCalendario, actualizarDiaCalendario,
  listarPuntosEscaneo, crearPuntoEscaneo, asignarPorteria,
  obtenerColegio, actualizarColegio,
  listarHorarios, guardarHorario,
  listarMeses,
};
