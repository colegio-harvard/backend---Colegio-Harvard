const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { emitToUser } = require('../utils/socketEmitter');
const { enviarNotificacion, renderTemplate } = require('../utils/notifUtils');
const { utcNow, todayLima, currentLimaTimeMs, timeFieldToMs, parseDateOnly } = require('../utils/dateUtils');

// FLW-08: Ejecutar alertas "no llegó" (cron o manual)
const ejecutarAlertasNoLlego = async (idAnioEscolar) => {
  const ahora = utcNow();
  const { date: fechaHoy } = todayLima();

  // Verificar si es dia lectivo
  const diaCalendario = await prisma.tbl_calendario_escolar.findUnique({
    where: { id_anio_escolar_fecha: { id_anio_escolar: idAnioEscolar, fecha: fechaHoy } },
  });
  if (diaCalendario && !diaCalendario.es_dia_lectivo) return { generadas: 0 };

  // Obtener horarios por nivel
  const horariosNivel = await prisma.tbl_horarios_nivel.findMany({
    where: { id_anio_escolar: idAnioEscolar },
  });
  const horariosPorNivel = {};
  for (const h of horariosNivel) { horariosPorNivel[h.id_nivel] = h; }

  // Cargar plantilla NO_LLEGO una vez para renderizar mensajes del socket
  const plantillaNoLlego = await prisma.tbl_plantillas_notificacion.findUnique({ where: { codigo: 'NO_LLEGO' } });

  const aulas = await prisma.tbl_aulas.findMany({
    where: { id_anio_escolar: idAnioEscolar },
    include: {
      tbl_alumnos: { where: { estado: 'ACTIVO' } },
      tbl_grados: { select: { id_nivel: true, nombre: true } },
    },
  });

  let alertasGeneradas = 0;
  const horaActualMs = currentLimaTimeMs();

  for (const aula of aulas) {
    const idNivel = aula.tbl_grados?.id_nivel;
    const horario = idNivel ? horariosPorNivel[idNivel] : null;
    if (!horario) continue;

    const horaLimiteMs = timeFieldToMs(horario.hora_limite_no_ingreso);

    if (horaActualMs < horaLimiteMs) continue;

    for (const alumno of aula.tbl_alumnos) {
      const asistencia = await prisma.tbl_asistencia_dia.findUnique({
        where: { id_alumno_fecha: { id_alumno: alumno.id, fecha: fechaHoy } },
      });

      if (asistencia && asistencia.estado !== 'AUSENTE') continue;

      // Verificar evento CHECKIN real (fuente de verdad inmutable contra race conditions)
      const checkinHoy = await prisma.tbl_eventos_asistencia.findFirst({
        where: { id_alumno: alumno.id, fecha_evento: fechaHoy, tipo_evento: 'CHECKIN' },
      });
      if (checkinHoy) continue;

      const alertaExistente = await prisma.tbl_alertas.findFirst({
        where: { id_alumno: alumno.id, fecha: fechaHoy, tipo: 'NO_LLEGO' },
      });
      if (alertaExistente) continue;

      const alerta = await prisma.tbl_alertas.create({
        data: {
          tipo: 'NO_LLEGO', id_anio_escolar: idAnioEscolar, id_alumno: alumno.id,
          fecha: fechaHoy, estado: 'ABIERTA',
        },
      });

      // Transacción para no sobreescribir asistencia real (PRESENTE/TARDE)
      await prisma.$transaction(async (tx) => {
        const actual = await tx.tbl_asistencia_dia.findUnique({
          where: { id_alumno_fecha: { id_alumno: alumno.id, fecha: fechaHoy } },
        });
        if (actual && actual.id_evento_checkin) return;
        if (actual) {
          await tx.tbl_asistencia_dia.update({
            where: { id: actual.id },
            data: { estado: 'AUSENTE', id_alerta_no_llego: alerta.id },
          });
        } else {
          await tx.tbl_asistencia_dia.create({
            data: { id_anio_escolar: idAnioEscolar, id_alumno: alumno.id, fecha: fechaHoy, estado: 'AUSENTE', id_alerta_no_llego: alerta.id },
          });
        }
      });

      // Notificar al padre (respeta habilitada, tipo_entrega y cuerpo de la plantilla)
      const vinculo = await prisma.tbl_padres_alumnos.findUnique({
        where: { id_alumno: alumno.id },
        include: { tbl_padres: { select: { id_usuario: true, celular: true } } },
      });

      if (vinculo) {
        const padreUserId = vinculo.tbl_padres.id_usuario;
        const aulaLabel = `${aula.tbl_grados?.nombre || ''} ${aula.seccion || ''}`.trim();
        await enviarNotificacion('NO_LLEGO', padreUserId, {
          alumno: alumno.nombre_completo,
          fecha: todayLima().iso,
          aula: aulaLabel,
        }, { fecha: fechaHoy, referencia_id: alumno.id });
        const varsAlerta = { alumno: alumno.nombre_completo, fecha: todayLima().iso, aula: aulaLabel };
        const mensajeSocket = plantillaNoLlego
          ? renderTemplate(plantillaNoLlego.titulo, varsAlerta)
          : alumno.nombre_completo;
        emitToUser(padreUserId, 'alerta:nueva', { id: alerta.id, tipo: 'NO_LLEGO', estado: 'ABIERTA', fecha: fechaHoy, id_alumno: alumno.id, alumno: { nombre_completo: alumno.nombre_completo }, mensaje: mensajeSocket });
      }

      alertasGeneradas++;
    }
  }

  return { generadas: alertasGeneradas };
};

// FLW-09: Ejecutar alertas manualmente
const ejecutarAlertasManual = async (req, res) => {
  try {
    const anioActivo = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
    if (!anioActivo) return res.status(400).json({ error: 'No hay ano escolar activo' });

    const resultado = await ejecutarAlertasNoLlego(anioActivo.id);
    await registrarAuditoria({ userId: req.user.id, accion: 'EJECUTAR_ALERTAS_MANUAL', tipoEntidad: 'tbl_alertas', resumen: `Alertas ejecutadas manualmente: ${resultado.generadas} generadas` });

    res.json({ data: { mensaje: `Alertas ejecutadas: ${resultado.generadas} generadas`, generadas: resultado.generadas } });
  } catch (error) {
    console.error('Error al ejecutar alertas:', error);
    res.status(500).json({ error: 'Error al ejecutar alertas' });
  }
};

// Listar alertas del padre (con datos limpios)
const listarAlertasPadre = async (req, res) => {
  try {
    const padre = await prisma.tbl_padres.findUnique({ where: { id_usuario: req.user.id } });
    if (!padre) return res.status(404).json({ error: 'Padre no encontrado' });

    const hijos = await prisma.tbl_padres_alumnos.findMany({ where: { id_padre: padre.id }, select: { id_alumno: true } });
    const idsAlumnos = hijos.map(h => h.id_alumno);

    const [alertas, plantillas] = await Promise.all([
      prisma.tbl_alertas.findMany({
        where: { id_alumno: { in: idsAlumnos } },
        include: {
          tbl_alumnos: { select: { nombre_completo: true, codigo_alumno: true } },
        },
        orderBy: { date_time_registration: 'desc' },
        take: 50,
      }),
      prisma.tbl_plantillas_notificacion.findMany(),
    ]);

    const plantillaMap = {};
    for (const p of plantillas) plantillaMap[p.codigo] = p;

    const data = alertas.map(a => {
      const plantilla = plantillaMap[a.tipo];
      const vars = { alumno: a.tbl_alumnos?.nombre_completo || '' };
      const mensaje = plantilla
        ? renderTemplate(plantilla.titulo, vars)
        : a.tipo;
      return {
        id: a.id,
        tipo: a.tipo,
        estado: a.estado,
        fecha: a.fecha,
        id_alumno: a.id_alumno,
        date_time_registration: a.date_time_registration,
        alumno: a.tbl_alumnos ? {
          nombre_completo: a.tbl_alumnos.nombre_completo,
          codigo_alumno: a.tbl_alumnos.codigo_alumno,
        } : null,
        mensaje,
      };
    });

    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al listar alertas' }); }
};

// Listar alertas para admin con filtros de scope
const listarAlertasAdmin = async (req, res) => {
  const { fecha, id_aula, id_nivel, estado } = req.query;
  try {
    const where = {};
    if (fecha) where.fecha = parseDateOnly(fecha);
    if (estado) where.estado = estado;

    const alertas = await prisma.tbl_alertas.findMany({
      where,
      include: {
        tbl_alumnos: {
          select: {
            nombre_completo: true, codigo_alumno: true,
            tbl_aulas: { select: { id: true, seccion: true, tbl_grados: { select: { nombre: true, tbl_niveles: { select: { id: true, nombre: true } } } } } },
          },
        },
      },
      orderBy: { date_time_registration: 'desc' },
      take: 200,
    });

    let resultado = alertas;
    if (id_aula) resultado = resultado.filter(a => a.tbl_alumnos?.tbl_aulas?.id === parseInt(id_aula));
    if (id_nivel) resultado = resultado.filter(a => a.tbl_alumnos?.tbl_aulas?.tbl_grados?.tbl_niveles?.id === parseInt(id_nivel));

    const data = resultado.map(a => ({
      id: a.id,
      tipo: a.tipo,
      estado: a.estado,
      fecha: a.fecha,
      date_time_registration: a.date_time_registration,
      alumno: a.tbl_alumnos ? {
        nombre_completo: a.tbl_alumnos.nombre_completo,
        codigo_alumno: a.tbl_alumnos.codigo_alumno,
        aula: a.tbl_alumnos.tbl_aulas ? {
          seccion: a.tbl_alumnos.tbl_aulas.seccion,
          grado: a.tbl_alumnos.tbl_aulas.tbl_grados?.nombre,
          nivel: a.tbl_alumnos.tbl_aulas.tbl_grados?.tbl_niveles?.nombre,
        } : null,
      } : null,
    }));

    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al listar alertas' }); }
};

module.exports = { ejecutarAlertasNoLlego, ejecutarAlertasManual, listarAlertasPadre, listarAlertasAdmin };
