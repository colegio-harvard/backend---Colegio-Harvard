const prisma = require('../config/prisma');
const XLSX = require('xlsx');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { emitToUser, emitToAula } = require('../utils/socketEmitter');
const { enviarNotificacion } = require('../utils/notifUtils');
const { utcNow, toUtcIso, todayLima, currentLimaTimeMs, timeFieldToMs, parseDateOnly } = require('../utils/dateUtils');

// FLW-06/07: Registro automatico de ingreso/salida (QR o PIN)
const registrarEvento = async (req, res) => {
  const { qr_token, codigo_alumno } = req.body;

  // Auto-detect metodo
  let metodo;
  if (qr_token) metodo = 'QR';
  else if (codigo_alumno) metodo = 'CODIGO';
  else return res.status(400).json({ error: 'Debe enviar qr_token o codigo_alumno' });

  try {
    let alumno;
    if (metodo === 'QR') {
      const carnet = await prisma.tbl_carnets.findUnique({ where: { qr_token }, include: { tbl_alumnos: { include: { tbl_aulas: true } } } });
      if (!carnet) return res.status(404).json({ error: 'Carnet no reconocido. Verifique el QR.' });
      alumno = carnet.tbl_alumnos;
    } else {
      alumno = await prisma.tbl_alumnos.findUnique({ where: { codigo_alumno }, include: { tbl_aulas: true } });
      if (!alumno) return res.status(404).json({ error: 'Codigo de alumno incorrecto.' });
    }

    if (alumno.estado === 'RETIRADO') {
      return res.status(403).json({ error: 'Alumno retirado: registro bloqueado.' });
    }

    const anioActivo = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
    if (!anioActivo) return res.status(400).json({ error: 'No hay ano escolar activo' });

    const asignacion = await prisma.tbl_asignaciones_porteria.findUnique({ where: { id_usuario_porteria: req.user.id } });

    const ahora = utcNow();
    const { date: fechaHoy } = todayLima();

    const eventosHoy = await prisma.tbl_eventos_asistencia.findMany({
      where: { id_alumno: alumno.id, fecha_evento: fechaHoy, id_anio_escolar: anioActivo.id },
      orderBy: { fecha_hora_evento: 'asc' },
    });

    const tieneCheckin = eventosHoy.some(e => e.tipo_evento === 'CHECKIN');
    const tieneCheckout = eventosHoy.some(e => e.tipo_evento === 'CHECKOUT');

    let tipoEvento;
    if (!tieneCheckin) {
      tipoEvento = 'CHECKIN';
    } else if (tieneCheckin && !tieneCheckout) {
      tipoEvento = 'CHECKOUT';
    } else {
      return res.status(409).json({ error: 'El dia ya tiene ingreso y salida. Operacion bloqueada.' });
    }

    const evento = await prisma.tbl_eventos_asistencia.create({
      data: {
        id_anio_escolar: anioActivo.id, id_alumno: alumno.id,
        fecha_evento: fechaHoy, hora_evento: ahora, fecha_hora_evento: ahora,
        tipo_evento: tipoEvento, metodo,
        id_punto_escaneo: asignacion?.id_punto_escaneo || null,
        registrado_por: req.user.id, user_id_registration: req.user.id,
      },
    });

    if (tipoEvento === 'CHECKIN') {
      // Obtener horario del nivel (configuracion general por nivel)
      const grado = await prisma.tbl_grados.findUnique({ where: { id: alumno.tbl_aulas.id_grado } });
      const horarioNivel = grado ? await prisma.tbl_horarios_nivel.findUnique({
        where: { id_nivel_id_anio_escolar: { id_nivel: grado.id_nivel, id_anio_escolar: anioActivo.id } },
      }) : null;

      let estadoAsistencia = 'PRESENTE';
      if (horarioNivel) {
        const horaInicioMs = timeFieldToMs(horarioNivel.hora_inicio);
        const toleranciaMs = horarioNivel.tolerancia_tardanza_min * 60000;
        const horaActualMs = currentLimaTimeMs();
        estadoAsistencia = horaActualMs <= (horaInicioMs + toleranciaMs) ? 'PRESENTE' : 'TARDE';
      }

      await prisma.tbl_asistencia_dia.upsert({
        where: { id_alumno_fecha: { id_alumno: alumno.id, fecha: fechaHoy } },
        update: { estado: estadoAsistencia, id_evento_checkin: evento.id, user_id_modification: req.user.id, date_time_modification: ahora },
        create: { id_anio_escolar: anioActivo.id, id_alumno: alumno.id, fecha: fechaHoy, estado: estadoAsistencia, id_evento_checkin: evento.id, user_id_registration: req.user.id },
      });

      await prisma.tbl_alertas.updateMany({
        where: { id_alumno: alumno.id, fecha: fechaHoy, tipo: 'NO_LLEGO', estado: 'ABIERTA' },
        data: { estado: 'CERRADA', cerrada_en: ahora },
      });

      // Obtener vinculo con padre (se usa para cierre de alerta y notif tardanza)
      const vinculoPadre = await prisma.tbl_padres_alumnos.findUnique({
        where: { id_alumno: alumno.id },
        include: { tbl_padres: { select: { id_usuario: true } } },
      });
      if (vinculoPadre?.tbl_padres?.id_usuario) {
        emitToUser(vinculoPadre.tbl_padres.id_usuario, 'alerta:cerrada', { id_alumno: alumno.id });
      }

      // Notificar tardanza al padre (respeta plantilla configurada)
      if (estadoAsistencia === 'TARDE' && vinculoPadre?.tbl_padres?.id_usuario) {
        const limaTimeMs = currentLimaTimeMs();
        const horas = Math.floor(limaTimeMs / 3600000);
        const minutos = Math.floor((limaTimeMs % 3600000) / 60000);
        const horaStr = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
        await enviarNotificacion('TARDANZA', vinculoPadre.tbl_padres.id_usuario, {
          alumno: alumno.nombre_completo,
          fecha: todayLima().iso,
          hora: horaStr,
        }, { fecha: fechaHoy, referencia_id: alumno.id });
      }

    } else if (tipoEvento === 'CHECKOUT') {
      await prisma.tbl_asistencia_dia.update({
        where: { id_alumno_fecha: { id_alumno: alumno.id, fecha: fechaHoy } },
        data: { id_evento_checkout: evento.id, user_id_modification: req.user.id, date_time_modification: ahora },
      });
    }

    await registrarAuditoria({ userId: req.user.id, accion: 'REGISTRO_ASISTENCIA', tipoEntidad: 'tbl_eventos_asistencia', idEntidad: evento.id, resumen: `${tipoEvento} ${metodo} alumno ${alumno.nombre_completo}` });

    // Emitir evento de asistencia al aula del tutor
    emitToAula(alumno.id_aula, 'asistencia:evento', {
      alumno: alumno.nombre_completo,
      tipo_evento: tipoEvento,
      hora: toUtcIso(ahora),
    });

    res.json({
      data: {
        tipo_evento: tipoEvento,
        alumno: alumno.nombre_completo,
        dni: alumno.dni,
        foto: alumno.foto_url,
        aula: alumno.tbl_aulas.seccion,
        fecha_hora: toUtcIso(ahora),
        metodo,
      },
    });
  } catch (error) {
    console.error('Error al registrar evento:', error);
    res.status(500).json({ error: 'Error al registrar asistencia' });
  }
};

// FLW-10: Vista padre - asistencia calendario mensual (auto-detecta hijos)
const calendarioPadre = async (req, res) => {
  let { id_alumno, mes, anio } = req.query;
  try {
    // Auto-detectar hijo si no se envia id_alumno
    if (!id_alumno) {
      const padre = await prisma.tbl_padres.findUnique({ where: { id_usuario: req.user.id } });
      if (!padre) return res.status(404).json({ error: 'Padre no encontrado' });
      const vinculos = await prisma.tbl_padres_alumnos.findMany({ where: { id_padre: padre.id }, select: { id_alumno: true } });
      if (vinculos.length === 0) return res.json({ data: [], hijos: [] });
      id_alumno = vinculos[0].id_alumno;
    }

    const fechaInicio = parseDateOnly(`${anio}-${String(mes).padStart(2, '0')}-01`);
    const lastDay = new Date(Date.UTC(parseInt(anio), parseInt(mes), 0)).getUTCDate();
    const fechaFin = parseDateOnly(`${anio}-${String(mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);

    const asistencias = await prisma.tbl_asistencia_dia.findMany({
      where: { id_alumno: parseInt(id_alumno), fecha: { gte: fechaInicio, lte: fechaFin } },
      include: {
        tbl_evento_checkin: { select: { hora_evento: true, metodo: true, id_punto_escaneo: true, tbl_puntos_escaneo: { select: { nombre: true } } } },
        tbl_evento_checkout: { select: { hora_evento: true } },
      },
      orderBy: { fecha: 'asc' },
    });

    // Construir calendario con dias del mes
    const diasEnMes = new Date(Date.UTC(parseInt(anio), parseInt(mes), 0)).getUTCDate();
    const primerDia = new Date(Date.UTC(parseInt(anio), parseInt(mes) - 1, 1)).getUTCDay();
    const diasCalendario = [];

    // Rellenar dias vacios antes del primer dia
    const offsetDia = primerDia === 0 ? 6 : primerDia - 1;
    for (let i = 0; i < offsetDia; i++) {
      diasCalendario.push({ dia: null, estado: null });
    }

    for (let d = 1; d <= diasEnMes; d++) {
      const fechaDia = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const asistenciaDia = asistencias.find(a => {
        const f = new Date(a.fecha);
        return f.getUTCDate() === d;
      });

      if (asistenciaDia) {
        diasCalendario.push({
          dia: d,
          fecha: fechaDia,
          estado: asistenciaDia.estado,
          hora_ingreso: asistenciaDia.tbl_evento_checkin?.hora_evento || null,
          metodo_ingreso: asistenciaDia.tbl_evento_checkin?.metodo || null,
          punto_escaneo: asistenciaDia.tbl_evento_checkin?.tbl_puntos_escaneo?.nombre || null,
          hora_salida: asistenciaDia.tbl_evento_checkout?.hora_evento || null,
          salida_no_registrada: asistenciaDia.id_evento_checkin && !asistenciaDia.id_evento_checkout,
        });
      } else {
        diasCalendario.push({ dia: d, fecha: fechaDia, estado: null });
      }
    }

    res.json({ data: diasCalendario });
  } catch (error) {
    console.error('Error calendario padre:', error);
    res.status(500).json({ error: 'Error al obtener calendario' });
  }
};

// Obtener hijos del padre autenticado
const obtenerHijosPadre = async (req, res) => {
  try {
    const padre = await prisma.tbl_padres.findUnique({ where: { id_usuario: req.user.id } });
    if (!padre) return res.status(404).json({ error: 'Padre no encontrado' });

    const vinculos = await prisma.tbl_padres_alumnos.findMany({
      where: { id_padre: padre.id },
      include: {
        tbl_alumnos: {
          select: { id: true, nombre_completo: true, codigo_alumno: true, foto_url: true, estado: true,
            tbl_aulas: { select: { seccion: true, tbl_grados: { select: { nombre: true, tbl_niveles: { select: { nombre: true } } } } } } },
        },
      },
    });

    const data = vinculos.map(v => {
      const a = v.tbl_alumnos;
      return {
        id: a.id,
        nombre_completo: a.nombre_completo,
        codigo_alumno: a.codigo_alumno,
        foto_url: a.foto_url,
        estado: a.estado,
        aula: a.tbl_aulas ? {
          seccion: a.tbl_aulas.seccion,
          grado: a.tbl_aulas.tbl_grados ? {
            nombre: a.tbl_aulas.tbl_grados.nombre,
            nivel: a.tbl_aulas.tbl_grados.tbl_niveles?.nombre || null,
          } : null,
        } : null,
      };
    });
    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al obtener hijos' }); }
};

// FLW-11: Vista tutor - asistencia hoy (auto-detecta aula)
const asistenciaHoyTutor = async (req, res) => {
  let { id_aula } = req.query;
  try {
    // Auto-detectar aula del tutor si no se envia
    if (!id_aula) {
      const asignaciones = await prisma.tbl_asignaciones_tutor.findMany({ where: { id_usuario_tutor: req.user.id }, select: { id_aula: true } });
      if (asignaciones.length === 0) return res.json({ data: [] });
      id_aula = asignaciones[0].id_aula;
    }

    const { date: hoy } = todayLima();
    const alumnos = await prisma.tbl_alumnos.findMany({
      where: { id_aula: parseInt(id_aula), estado: 'ACTIVO' },
      include: {
        tbl_asistencia_dia: {
          where: { fecha: hoy },
          include: {
            tbl_evento_checkin: { select: { hora_evento: true, metodo: true } },
            tbl_evento_checkout: { select: { hora_evento: true } },
          },
        },
      },
      orderBy: { nombre_completo: 'asc' },
    });

    const data = alumnos.map(a => {
      const asis = a.tbl_asistencia_dia[0];
      return {
        id: a.id,
        nombre_completo: a.nombre_completo,
        codigo_alumno: a.codigo_alumno,
        foto_url: a.foto_url,
        estado: asis?.estado || null,
        hora_ingreso: asis?.tbl_evento_checkin?.hora_evento || null,
        hora_salida: asis?.tbl_evento_checkout?.hora_evento || null,
        salida_no_registrada: asis?.id_evento_checkin && !asis?.id_evento_checkout,
      };
    });

    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al obtener asistencia de hoy' }); }
};

// Obtener aulas del tutor autenticado
const obtenerAulasTutor = async (req, res) => {
  try {
    const asignaciones = await prisma.tbl_asignaciones_tutor.findMany({
      where: { id_usuario_tutor: req.user.id },
      include: { tbl_aulas: { select: { id: true, seccion: true, tbl_grados: { select: { nombre: true, tbl_niveles: { select: { nombre: true } } } } } } },
    });
    const data = asignaciones.map(a => ({
      id: a.tbl_aulas.id,
      seccion: a.tbl_aulas.seccion,
      grado: a.tbl_aulas.tbl_grados ? {
        nombre: a.tbl_aulas.tbl_grados.nombre,
        nivel: a.tbl_aulas.tbl_grados.tbl_niveles?.nombre || null,
      } : null,
    }));
    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al obtener aulas' }); }
};

// FLW-12: Asistencia global admin (acepta fecha, fecha_inicio/fecha_fin, filtros completos)
const asistenciaGlobal = async (req, res) => {
  const { fecha, fecha_inicio, fecha_fin, id_aula, id_nivel, id_grado, estado: estadoFiltro } = req.query;
  try {
    const where = {};

    if (fecha) {
      where.fecha = parseDateOnly(fecha);
    } else if (fecha_inicio && fecha_fin) {
      where.fecha = { gte: parseDateOnly(fecha_inicio), lte: parseDateOnly(fecha_fin) };
    }

    if (estadoFiltro) where.estado = estadoFiltro;

    const asistencias = await prisma.tbl_asistencia_dia.findMany({
      where,
      include: {
        tbl_alumnos: {
          select: {
            id: true, nombre_completo: true, codigo_alumno: true,
            tbl_aulas: { select: { id: true, seccion: true, tbl_grados: { select: { id: true, nombre: true, tbl_niveles: { select: { id: true, nombre: true } } } } } },
          },
        },
        tbl_evento_checkin: { select: { hora_evento: true, metodo: true } },
        tbl_evento_checkout: { select: { hora_evento: true } },
      },
      orderBy: [{ fecha: 'desc' }, { id_alumno: 'asc' }],
    });

    let resultado = asistencias;
    if (id_aula) {
      resultado = resultado.filter(a => a.tbl_alumnos?.tbl_aulas?.id === parseInt(id_aula));
    }
    if (id_nivel) {
      resultado = resultado.filter(a => a.tbl_alumnos?.tbl_aulas?.tbl_grados?.tbl_niveles?.id === parseInt(id_nivel));
    }
    if (id_grado) {
      resultado = resultado.filter(a => a.tbl_alumnos?.tbl_aulas?.tbl_grados?.id === parseInt(id_grado));
    }

    const data = resultado.map(r => ({
      id: r.id,
      fecha: r.fecha,
      estado: r.estado,
      alumno: r.tbl_alumnos ? {
        id: r.tbl_alumnos.id,
        nombre_completo: r.tbl_alumnos.nombre_completo,
        codigo_alumno: r.tbl_alumnos.codigo_alumno,
        aula: r.tbl_alumnos.tbl_aulas ? {
          id: r.tbl_alumnos.tbl_aulas.id,
          seccion: r.tbl_alumnos.tbl_aulas.seccion,
          grado: r.tbl_alumnos.tbl_aulas.tbl_grados,
        } : null,
      } : null,
      hora_ingreso: r.tbl_evento_checkin?.hora_evento || null,
      metodo: r.tbl_evento_checkin?.metodo || null,
      hora_salida: r.tbl_evento_checkout?.hora_evento || null,
      salida_no_registrada: r.id_evento_checkin && !r.id_evento_checkout,
    }));

    res.json({ data });
  } catch (error) {
    console.error('Error asistencia global:', error);
    res.status(500).json({ error: 'Error al obtener asistencia global' });
  }
};

// FLW-12: Export Excel
const exportarExcel = async (req, res) => {
  const { fecha, fecha_inicio, fecha_fin, id_aula, id_nivel, estado: estadoFiltro } = req.query;
  try {
    const where = {};
    if (fecha) {
      where.fecha = parseDateOnly(fecha);
    } else if (fecha_inicio && fecha_fin) {
      where.fecha = { gte: parseDateOnly(fecha_inicio), lte: parseDateOnly(fecha_fin) };
    }
    if (estadoFiltro) where.estado = estadoFiltro;

    const asistencias = await prisma.tbl_asistencia_dia.findMany({
      where,
      include: {
        tbl_alumnos: {
          select: { nombre_completo: true, codigo_alumno: true,
            tbl_aulas: { select: { seccion: true, tbl_grados: { select: { nombre: true, tbl_niveles: { select: { id: true, nombre: true } } } } } } },
        },
        tbl_evento_checkin: { select: { hora_evento: true, metodo: true } },
        tbl_evento_checkout: { select: { hora_evento: true } },
      },
      orderBy: [{ fecha: 'desc' }, { id_alumno: 'asc' }],
    });

    let resultado = asistencias;
    if (id_aula) resultado = resultado.filter(a => a.tbl_alumnos?.tbl_aulas?.id === parseInt(id_aula));
    if (id_nivel) resultado = resultado.filter(a => a.tbl_alumnos?.tbl_aulas?.tbl_grados?.tbl_niveles?.id === parseInt(id_nivel));

    const rows = resultado.map(r => ({
      Fecha: r.fecha ? new Date(r.fecha).toLocaleDateString('es-PE', { timeZone: 'UTC' }) : '',
      Codigo: r.tbl_alumnos?.codigo_alumno || '',
      Alumno: r.tbl_alumnos?.nombre_completo || '',
      Nivel: r.tbl_alumnos?.tbl_aulas?.tbl_grados?.tbl_niveles?.nombre || '',
      Grado: r.tbl_alumnos?.tbl_aulas?.tbl_grados?.nombre || '',
      Seccion: r.tbl_alumnos?.tbl_aulas?.seccion || '',
      Estado: r.estado === 'PRESENTE' ? 'Asistió' : r.estado === 'TARDE' ? 'Tardanza' : r.estado === 'AUSENTE' ? 'Faltó' : r.estado,
      Metodo: r.tbl_evento_checkin?.metodo || '',
      'Hora Ingreso': r.tbl_evento_checkin?.hora_evento ? new Date(r.tbl_evento_checkin.hora_evento).toLocaleTimeString('es-PE', { timeZone: 'America/Lima' }) : '',
      'Hora Salida': r.tbl_evento_checkout?.hora_evento ? new Date(r.tbl_evento_checkout.hora_evento).toLocaleTimeString('es-PE', { timeZone: 'America/Lima' }) : 'No registrada',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=asistencia.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error al exportar Excel:', error);
    res.status(500).json({ error: 'Error al exportar asistencia' });
  }
};

// FLW-13: Correccion de asistencia (simplificado)
const corregirAsistencia = async (req, res) => {
  const { id_asistencia_dia, nuevo_estado, motivo } = req.body;
  if (!motivo) return res.status(400).json({ error: 'Motivo obligatorio.' });
  if (!nuevo_estado) return res.status(400).json({ error: 'Nuevo estado obligatorio.' });
  if (!['PRESENTE', 'TARDE', 'AUSENTE'].includes(nuevo_estado)) {
    return res.status(400).json({ error: 'Estado debe ser PRESENTE, TARDE o AUSENTE' });
  }

  try {
    const asistencia = await prisma.tbl_asistencia_dia.findUnique({ where: { id: id_asistencia_dia } });
    if (!asistencia) return res.status(404).json({ error: 'Registro de asistencia no encontrado' });

    const valorAnterior = asistencia.estado;

    await prisma.tbl_asistencia_dia.update({
      where: { id: id_asistencia_dia },
      data: { estado: nuevo_estado, user_id_modification: req.user.id, date_time_modification: new Date() },
    });

    await prisma.tbl_correcciones_asistencia.create({
      data: { id_asistencia_dia, campo_modificado: 'estado', valor_anterior: valorAnterior, valor_nuevo: nuevo_estado, motivo, corregido_por: req.user.id, user_id_registration: req.user.id },
    });

    await registrarAuditoria({ userId: req.user.id, accion: 'CORRECCION_ASISTENCIA', tipoEntidad: 'tbl_asistencia_dia', idEntidad: id_asistencia_dia, resumen: `Correccion: estado de "${valorAnterior}" a "${nuevo_estado}". Motivo: ${motivo}` });

    res.json({ mensaje: 'Asistencia corregida' });
  } catch (error) { res.status(500).json({ error: 'Error al corregir asistencia' }); }
};

// Historial porteria (ultimos 20)
const historialPorteria = async (req, res) => {
  try {
    const eventos = await prisma.tbl_eventos_asistencia.findMany({
      where: { registrado_por: req.user.id },
      include: { tbl_alumnos: { select: { nombre_completo: true, foto_url: true, tbl_aulas: { select: { seccion: true } } } } },
      orderBy: { fecha_hora_evento: 'desc' },
      take: 20,
    });
    const data = eventos.map(e => ({
      id: e.id,
      tipo_evento: e.tipo_evento,
      metodo: e.metodo,
      fecha_hora: e.fecha_hora_evento,
      alumno: e.tbl_alumnos ? {
        nombre_completo: e.tbl_alumnos.nombre_completo,
        foto_url: e.tbl_alumnos.foto_url,
        aula: e.tbl_alumnos.tbl_aulas?.seccion || null,
      } : null,
    }));
    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al obtener historial' }); }
};

// Dashboard Admin: resumen general del dia
const dashboardAdmin = async (req, res) => {
  try {
    const anioActivo = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
    if (!anioActivo) return res.json({ data: { sinAnioActivo: true } });

    const { date: hoy } = todayLima();

    // Obtener todas las aulas con sus alumnos y asistencia de hoy
    const aulas = await prisma.tbl_aulas.findMany({
      where: { id_anio_escolar: anioActivo.id },
      include: {
        tbl_grados: { select: { nombre: true, tbl_niveles: { select: { nombre: true } } } },
        tbl_asignaciones_tutor: { include: { tbl_usuarios: { select: { nombres: true } } } },
        tbl_alumnos: {
          where: { estado: 'ACTIVO' },
          select: {
            id: true,
            nombre_completo: true,
            codigo_alumno: true,
            tbl_asistencia_dia: {
              where: { fecha: hoy },
              select: {
                estado: true,
                tbl_evento_checkin: { select: { hora_evento: true } },
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    // Construir resumen por aula
    let totalPresentes = 0, totalTardes = 0, totalAusentes = 0, totalSinRegistro = 0, totalAlumnos = 0;
    const ausentes = [];
    const tardes = [];

    const resumenAulas = aulas.map(aula => {
      const alumnos = aula.tbl_alumnos;
      const total = alumnos.length;
      let presentes = 0, tardanzas = 0, ausentesAula = 0, sinRegistro = 0;

      alumnos.forEach(alumno => {
        const asis = alumno.tbl_asistencia_dia[0];
        if (!asis) {
          sinRegistro++;
        } else if (asis.estado === 'PRESENTE') {
          presentes++;
        } else if (asis.estado === 'TARDE') {
          tardanzas++;
          tardes.push({
            nombre: alumno.nombre_completo,
            codigo: alumno.codigo_alumno,
            aula: `${aula.tbl_grados.nombre} - ${aula.seccion}`,
            hora_ingreso: asis.tbl_evento_checkin?.hora_evento || null,
          });
        } else if (asis.estado === 'AUSENTE') {
          ausentesAula++;
          ausentes.push({
            nombre: alumno.nombre_completo,
            codigo: alumno.codigo_alumno,
            aula: `${aula.tbl_grados.nombre} - ${aula.seccion}`,
          });
        }
      });

      totalPresentes += presentes;
      totalTardes += tardanzas;
      totalAusentes += ausentesAula;
      totalSinRegistro += sinRegistro;
      totalAlumnos += total;

      const nivel = aula.tbl_grados?.tbl_niveles?.nombre || '';
      const grado = aula.tbl_grados?.nombre || '';
      const tutor = aula.tbl_asignaciones_tutor?.[0]?.tbl_usuarios?.nombres || 'Sin tutor';

      return {
        id: aula.id,
        nombre: `${grado} - ${aula.seccion}`,
        nivel,
        tutor,
        total,
        presentes,
        tardes: tardanzas,
        ausentes: ausentesAula,
        sinRegistro,
        porcentaje: total > 0 ? Math.round(((presentes + tardanzas) / total) * 100) : 0,
      };
    });

    // Alertas abiertas hoy
    const alertasAbiertas = await prisma.tbl_alertas.count({ where: { fecha: hoy, estado: 'ABIERTA' } });

    // Conteos generales
    const [totalUsuarios, totalAlumnosDB, totalPadresDB] = await Promise.all([
      prisma.tbl_usuarios.count({ where: { estado: 'ACTIVO' } }),
      prisma.tbl_alumnos.count({ where: { estado: 'ACTIVO' } }),
      prisma.tbl_padres.count(),
    ]);

    const porcentajeGeneral = totalAlumnos > 0 ? Math.round(((totalPresentes + totalTardes) / totalAlumnos) * 100) : 0;

    res.json({
      data: {
        resumenHoy: {
          totalAlumnos,
          presentes: totalPresentes,
          tardes: totalTardes,
          ausentes: totalAusentes,
          sinRegistro: totalSinRegistro,
          porcentaje: porcentajeGeneral,
        },
        resumenAulas,
        ausentes,
        tardes,
        alertasAbiertas,
        conteos: { totalUsuarios, totalAlumnos: totalAlumnosDB, totalPadres: totalPadresDB },
      },
    });
  } catch (error) {
    console.error('Error dashboard admin:', error);
    res.status(500).json({ error: 'Error al obtener datos del dashboard' });
  }
};

module.exports = { registrarEvento, calendarioPadre, obtenerHijosPadre, asistenciaHoyTutor, obtenerAulasTutor, asistenciaGlobal, exportarExcel, corregirAsistencia, historialPorteria, dashboardAdmin };
