const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { todayLima } = require('../utils/dateUtils');

// Obtener plantilla del año activo
const obtenerPlantilla = async (req, res) => {
  try {
    const anioActivo = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
    if (!anioActivo) return res.status(400).json({ error: 'No hay ano escolar activo' });

    const plantilla = await prisma.tbl_plantilla_pension.findFirst({ where: { id_anio_escolar: anioActivo.id } });
    if (!plantilla) return res.status(404).json({ error: 'No hay plantilla de pension configurada' });

    const mesesRaw = Array.isArray(plantilla.meses_json) ? plantilla.meses_json : [];

    // Normalizar cualquier formato viejo al nuevo formato { clave, nombre, tipo, comentario }
    const seen = new Set();
    const normalized = [];
    for (const m of mesesRaw) {
      // Soportar todos los nombres de campo historicos: clave, clave_mes, mes
      const clave = m.clave || m.clave_mes || m.mes || '';
      const nombre = m.nombre || m.label || clave;
      const isOldComposite = m.mes_base || (m.tipo !== 'personalizado' && /^[A-Z]{3}_\d+$/.test(clave));
      if (isOldComposite) {
        const base = m.mes_base || clave.replace(/_\d+$/, '');
        if (!seen.has(base)) {
          seen.add(base);
          normalized.push({ clave: base, nombre: m.nombre || m.label || base, tipo: 'mes', comentario: m.comentario || '' });
        }
      } else if (clave && !seen.has(clave)) {
        seen.add(clave);
        normalized.push({ clave, nombre, tipo: m.tipo || 'mes', comentario: m.comentario || '' });
      }
    }

    const data = normalized.map(m => ({
      clave: m.clave,
      nombre: m.nombre,
      tipo: m.tipo,
      comentario: m.comentario || '',
      id_plantilla: plantilla.id,
    }));

    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al obtener plantilla' }); }
};

// Obtener estado de pension — agrupado por hijo para padres
const obtenerEstado = async (req, res) => {
  const { id_alumno } = req.params;
  try {
    if (id_alumno === 'me') {
      // Padre: obtener hijos y agrupar por cada uno
      const padre = await prisma.tbl_padres.findUnique({ where: { id_usuario: req.user.id } });
      if (!padre) return res.json({ data: { hijos: [] } });

      const vinculos = await prisma.tbl_padres_alumnos.findMany({
        where: { id_padre: padre.id },
        include: { tbl_alumnos: { select: { id: true, nombre_completo: true } } },
      });

      const hijos = [];
      for (const v of vinculos) {
        const estados = await prisma.tbl_estado_pension.findMany({
          where: { id_alumno: v.id_alumno },
          include: { tbl_pagos_pension: { orderBy: { fecha_pago: 'asc' } } },
          orderBy: { clave_mes: 'asc' },
        });

        hijos.push({
          id: v.tbl_alumnos.id,
          nombre_completo: v.tbl_alumnos.nombre_completo,
          meses: estados.map(e => ({
            id: e.id,
            clave_mes: e.clave_mes,
            estado: e.estado,
            monto_total: e.monto_total ? Number(e.monto_total) : null,
            monto_pagado: Number(e.monto_pagado),
            pagos: e.tbl_pagos_pension.map(p => ({
              id: p.id,
              monto: Number(p.monto),
              fecha: p.fecha_pago.toISOString().split('T')[0],
              observacion: p.observacion,
            })),
          })),
        });
      }

      return res.json({ data: { hijos } });
    }

    // Alumno específico (admin)
    const estados = await prisma.tbl_estado_pension.findMany({
      where: { id_alumno: parseInt(id_alumno) },
      include: { tbl_pagos_pension: { orderBy: { fecha_pago: 'asc' } } },
      orderBy: { clave_mes: 'asc' },
    });

    const data = estados.map(e => ({
      id: e.id,
      id_alumno: e.id_alumno,
      clave_mes: e.clave_mes,
      estado: e.estado,
      monto_total: e.monto_total ? Number(e.monto_total) : null,
      monto_pagado: Number(e.monto_pagado),
      id_plantilla: e.id_plantilla,
    }));

    res.json({ data });
  } catch (error) {
    console.error('Error al obtener estado de pension:', error);
    res.status(500).json({ error: 'Error al obtener estado de pension' });
  }
};

// Detalle de un mes específico (admin)
const obtenerDetalleMes = async (req, res) => {
  const { id_alumno, clave_mes } = req.params;
  try {
    const estado = await prisma.tbl_estado_pension.findUnique({
      where: { id_alumno_clave_mes: { id_alumno: parseInt(id_alumno), clave_mes } },
      include: { tbl_pagos_pension: { orderBy: { fecha_pago: 'asc' } } },
    });

    if (!estado) {
      return res.json({ data: { estado: 'PENDIENTE', monto_total: null, monto_pagado: 0, pagos: [] } });
    }

    res.json({
      data: {
        id: estado.id,
        estado: estado.estado,
        monto_total: estado.monto_total ? Number(estado.monto_total) : null,
        monto_pagado: Number(estado.monto_pagado),
        pagos: estado.tbl_pagos_pension.map(p => ({
          id: p.id,
          monto: Number(p.monto),
          fecha: p.fecha_pago.toISOString().split('T')[0],
          observacion: p.observacion,
        })),
      },
    });
  } catch (error) {
    console.error('Error al obtener detalle:', error);
    res.status(500).json({ error: 'Error al obtener detalle de pension' });
  }
};

// Registrar pago
const registrarPago = async (req, res) => {
  const { id_alumno, clave_mes, estado, monto_total, monto_pago, observacion } = req.body;

  if (!id_alumno || !clave_mes || !estado) {
    return res.status(400).json({ error: 'id_alumno, clave_mes y estado son obligatorios' });
  }

  try {
    const anioActivo = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
    const plantilla = await prisma.tbl_plantilla_pension.findFirst({ where: { id_anio_escolar: anioActivo.id } });
    if (!plantilla) return res.status(404).json({ error: 'No hay plantilla de pension configurada' });

    const existente = await prisma.tbl_estado_pension.findUnique({
      where: { id_alumno_clave_mes: { id_alumno: parseInt(id_alumno), clave_mes: String(clave_mes) } },
    });

    const fechaHoy = todayLima().date;

    if (estado === 'PAGADO') {
      // Marcar como pagado completo
      const montoTotal = monto_total ? parseFloat(monto_total) : null;

      const ep = await prisma.tbl_estado_pension.upsert({
        where: { id_alumno_clave_mes: { id_alumno: parseInt(id_alumno), clave_mes: String(clave_mes) } },
        update: {
          estado: 'PAGADO',
          monto_total: montoTotal,
          monto_pagado: montoTotal || 0,
          actualizado_por: req.user.id,
          user_id_modification: req.user.id,
          date_time_modification: new Date(),
        },
        create: {
          id_plantilla: plantilla.id,
          id_alumno: parseInt(id_alumno),
          clave_mes: String(clave_mes),
          estado: 'PAGADO',
          monto_total: montoTotal,
          monto_pagado: montoTotal || 0,
          actualizado_por: req.user.id,
          user_id_registration: req.user.id,
        },
      });

      // Registrar pago en historial
      if (montoTotal) {
        const montoRegistrar = existente ? montoTotal - Number(existente.monto_pagado) : montoTotal;
        if (montoRegistrar > 0) {
          await prisma.tbl_pagos_pension.create({
            data: {
              id_estado_pension: ep.id,
              monto: montoRegistrar,
              fecha_pago: fechaHoy,
              observacion: observacion || 'Pago completo',
              registrado_por: req.user.id,
              user_id_registration: req.user.id,
            },
          });
        }
      }

    } else if (estado === 'PAGO_PARCIAL') {
      if (!monto_total || !monto_pago) {
        return res.status(400).json({ error: 'monto_total y monto_pago son obligatorios para pago parcial' });
      }

      const montoTotal = parseFloat(monto_total);
      const montoPago = parseFloat(monto_pago);
      const nuevoPagado = (existente ? Number(existente.monto_pagado) : 0) + montoPago;

      // Si el nuevo total pagado cubre o supera el monto total, marcar como PAGADO
      const nuevoEstado = nuevoPagado >= montoTotal ? 'PAGADO' : 'PAGO_PARCIAL';

      const ep = await prisma.tbl_estado_pension.upsert({
        where: { id_alumno_clave_mes: { id_alumno: parseInt(id_alumno), clave_mes: String(clave_mes) } },
        update: {
          estado: nuevoEstado,
          monto_total: montoTotal,
          monto_pagado: nuevoPagado,
          actualizado_por: req.user.id,
          user_id_modification: req.user.id,
          date_time_modification: new Date(),
        },
        create: {
          id_plantilla: plantilla.id,
          id_alumno: parseInt(id_alumno),
          clave_mes: String(clave_mes),
          estado: nuevoEstado,
          monto_total: montoTotal,
          monto_pagado: montoPago,
          actualizado_por: req.user.id,
          user_id_registration: req.user.id,
        },
      });

      await prisma.tbl_pagos_pension.create({
        data: {
          id_estado_pension: ep.id,
          monto: montoPago,
          fecha_pago: fechaHoy,
          observacion: observacion || null,
          registrado_por: req.user.id,
          user_id_registration: req.user.id,
        },
      });

    } else if (estado === 'PENDIENTE') {
      // Revertir a pendiente
      if (existente) {
        await prisma.tbl_pagos_pension.deleteMany({ where: { id_estado_pension: existente.id } });
        await prisma.tbl_estado_pension.update({
          where: { id: existente.id },
          data: {
            estado: 'PENDIENTE',
            monto_total: null,
            monto_pagado: 0,
            actualizado_por: req.user.id,
            user_id_modification: req.user.id,
            date_time_modification: new Date(),
          },
        });
      }
    } else {
      return res.status(400).json({ error: 'Estado invalido. Use: PAGADO, PAGO_PARCIAL o PENDIENTE' });
    }

    await registrarAuditoria({
      userId: req.user.id,
      accion: 'REGISTRAR_PAGO_PENSION',
      tipoEntidad: 'tbl_estado_pension',
      resumen: `Pension alumno ${id_alumno} mes ${clave_mes}: ${estado}${monto_pago ? ` - S/. ${monto_pago}` : ''}`,
    });

    res.json({ mensaje: 'Pension actualizada' });
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ error: 'Error al registrar pago de pension' });
  }
};

// Vista cuadricula completa (admin)
const cuadricula = async (req, res) => {
  const { id_aula, id_grado, id_nivel } = req.query;
  try {
    const where = { estado: 'ACTIVO' };
    if (id_aula) {
      where.id_aula = parseInt(id_aula);
    } else if (id_grado) {
      where.tbl_aulas = { id_grado: parseInt(id_grado) };
    } else if (id_nivel) {
      where.tbl_aulas = { tbl_grados: { id_nivel: parseInt(id_nivel) } };
    }

    const alumnos = await prisma.tbl_alumnos.findMany({
      where,
      include: {
        tbl_aulas: { include: { tbl_grados: { include: { tbl_niveles: { select: { nombre: true } } } } } },
        tbl_padres_alumnos: { include: { tbl_padres: { select: { id: true, nombre_completo: true, dni: true } } } },
        tbl_estado_pension: true,
      },
      orderBy: { nombre_completo: 'asc' },
    });

    const data = alumnos.map(a => ({
      id: a.id,
      nombre_completo: a.nombre_completo,
      codigo_alumno: a.codigo_alumno,
      dni: a.dni || null,
      monto_pension: a.monto_pension ? Number(a.monto_pension) : null,
      aula: a.tbl_aulas ? {
        id: a.tbl_aulas.id,
        seccion: a.tbl_aulas.seccion,
        grado: a.tbl_aulas.tbl_grados ? {
          id: a.tbl_aulas.tbl_grados.id,
          nombre: a.tbl_aulas.tbl_grados.nombre,
          nivel: a.tbl_aulas.tbl_grados.tbl_niveles?.nombre || null,
        } : null,
      } : null,
      padre: a.tbl_padres_alumnos?.tbl_padres ? {
        id: a.tbl_padres_alumnos.tbl_padres.id,
        nombre_completo: a.tbl_padres_alumnos.tbl_padres.nombre_completo,
        dni: a.tbl_padres_alumnos.tbl_padres.dni,
      } : null,
      pensiones: (a.tbl_estado_pension || []).map(e => ({
        id: e.id,
        clave_mes: e.clave_mes,
        estado: e.estado,
        monto_total: e.monto_total ? Number(e.monto_total) : null,
        monto_pagado: Number(e.monto_pagado),
        id_plantilla: e.id_plantilla,
      })),
    }));

    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al obtener cuadricula' }); }
};

// Admin crea/actualiza plantilla de pension
const guardarPlantilla = async (req, res) => {
  const { meses } = req.body;
  if (!Array.isArray(meses) || meses.length === 0) {
    return res.status(400).json({ error: 'Debe enviar un array de pagos' });
  }

  const claves = meses.map(m => m.clave);
  if (new Set(claves).size !== claves.length) {
    return res.status(400).json({ error: 'Las claves de pago deben ser unicas' });
  }
  if (claves.some(c => !c || c.length > 20)) {
    return res.status(400).json({ error: 'Cada clave debe tener entre 1 y 20 caracteres' });
  }

  try {
    const anioActivo = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
    if (!anioActivo) return res.status(400).json({ error: 'No hay ano escolar activo' });

    const existente = await prisma.tbl_plantilla_pension.findFirst({ where: { id_anio_escolar: anioActivo.id } });

    let plantillaId;
    if (existente) {
      const mesAnterior = Array.isArray(existente.meses_json) ? existente.meses_json : [];
      const clavesAnteriores = mesAnterior.map(m => m.clave || m.clave_mes || m.mes || '').filter(Boolean);
      const clavesNuevas = new Set(claves);

      // Migracion inversa: claves compuestas (MAR_1) → claves simples (MAR)
      for (const claveVieja of clavesAnteriores) {
        if (!clavesNuevas.has(claveVieja) && claveVieja.includes('_')) {
          const base = claveVieja.split('_')[0];
          if (clavesNuevas.has(base)) {
            // Solo migrar si no hay conflicto de unique constraint
            const existeBase = await prisma.tbl_estado_pension.findFirst({
              where: { id_plantilla: existente.id, clave_mes: base },
            });
            if (!existeBase) {
              await prisma.tbl_estado_pension.updateMany({
                where: { id_plantilla: existente.id, clave_mes: claveVieja },
                data: { clave_mes: base },
              });
            }
          }
        }
      }

      await prisma.tbl_plantilla_pension.update({
        where: { id: existente.id },
        data: { meses_json: meses, user_id_modification: req.user.id, date_time_modification: new Date() },
      });
      plantillaId = existente.id;
    } else {
      const nueva = await prisma.tbl_plantilla_pension.create({
        data: { id_anio_escolar: anioActivo.id, meses_json: meses, creado_por: req.user.id, user_id_registration: req.user.id },
      });
      plantillaId = nueva.id;
    }

    // Limpiar estados huerfanos: claves removidas que estan PENDIENTE sin pagos
    await prisma.tbl_estado_pension.deleteMany({
      where: {
        id_plantilla: plantillaId,
        clave_mes: { notIn: claves },
        estado: 'PENDIENTE',
        monto_pagado: 0,
      },
    });

    await registrarAuditoria({ userId: req.user.id, accion: 'CONFIGURAR_PLANTILLA_PENSION', tipoEntidad: 'tbl_plantilla_pension', resumen: `Plantilla pension actualizada con ${meses.length} pagos` });
    res.json({ mensaje: 'Plantilla de pension guardada' });
  } catch (error) {
    console.error('Error al guardar plantilla:', error);
    res.status(500).json({ error: 'Error al guardar plantilla' });
  }
};

module.exports = { obtenerPlantilla, obtenerEstado, registrarPago, obtenerDetalleMes, cuadricula, guardarPlantilla };
