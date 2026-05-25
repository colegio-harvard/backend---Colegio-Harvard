const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { todayLima } = require('../utils/dateUtils');
const crypto = require('crypto');
const XLSX = require('xlsx');

const formatFechaIso = (fecha) => {
  if (!fecha) return null;
  return new Date(fecha).toISOString().split('T')[0];
};

const normalizarMesesPlantilla = (mesesRaw) => {
  const meses = Array.isArray(mesesRaw) ? mesesRaw : [];
  return meses.map(m => ({
    clave: m.clave || m.clave_mes || m.mes || '',
    nombre: m.nombre || m.label || m.clave || m.clave_mes || m.mes || '',
    tipo: m.tipo || 'mes',
    comentario: m.comentario || '',
  })).filter(m => m.clave);
};

const nombreConcepto = (plantilla, claveMes) => {
  const mes = normalizarMesesPlantilla(plantilla?.meses_json).find(m => m.clave === claveMes);
  return mes?.nombre || claveMes;
};

const normalizarTexto = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

const parseMontoExcel = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Number(value) : null;
  const limpio = String(value).replace(/[^\d.,-]/g, '').replace(',', '.');
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const obtenerValorPorEncabezado = (row, headerMap, nombres) => {
  for (const nombre of nombres) {
    const key = headerMap[normalizarTexto(nombre)];
    if (key && row[key] !== undefined) return row[key];
  }
  return null;
};

const crearMapaConceptosImportacion = (plantilla) => {
  const meses = normalizarMesesPlantilla(plantilla?.meses_json);
  const map = {};
  const alias = {
    MATRICULA: ['MATRICULA', 'MATRÍCULA'],
    MATERIALES: ['MATERIALES', 'MATERIAL'],
    MAR: ['MARZO'],
    ABR: ['ABRIL'],
    MAY: ['MAYO'],
    JUN: ['JUNIO'],
    JUL: ['JULIO'],
    AGO: ['AGOSTO'],
    SET: ['SETIEMBRE', 'SEPTIEMBRE'],
    SEP: ['SETIEMBRE', 'SEPTIEMBRE'],
    OCT: ['OCTUBRE'],
    NOV: ['NOVIEMBRE'],
    DIC: ['DICIEMBRE'],
  };

  for (const mes of meses) {
    const claves = [mes.clave, mes.nombre, ...(alias[mes.clave] || [])];
    for (const clave of claves) {
      map[normalizarTexto(clave)] = mes;
    }
  }
  return map;
};

const leerFilasPagosExcel = (buffer) => {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames.find(n => normalizarTexto(n) === 'PAGOS') || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('No se encontro la hoja Pagos');

  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  return { sheetName, rows };
};

const analizarExcelPensiones = async (buffer) => {
  const anioActivo = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
  if (!anioActivo) throw new Error('No hay ano escolar activo');

  const plantilla = await prisma.tbl_plantilla_pension.findFirst({
    where: { id_anio_escolar: anioActivo.id },
    include: { tbl_anios_escolares: { select: { anio: true } } },
  });
  if (!plantilla) throw new Error('No hay plantilla de pension configurada');

  const { sheetName, rows } = leerFilasPagosExcel(buffer);
  const conceptos = crearMapaConceptosImportacion(plantilla);
  const alumnos = await prisma.tbl_alumnos.findMany({
    where: { estado: { not: 'DELETED' } },
    select: {
      id: true,
      codigo_alumno: true,
      dni: true,
      nombre_completo: true,
      monto_matricula: true,
      monto_materiales: true,
      monto_pension: true,
      tbl_estado_pension: { include: { tbl_pagos_pension: { select: { id: true } } } },
    },
  });

  const porCodigo = new Map();
  const porDni = new Map();
  const nombreCounts = new Map();
  const porNombre = new Map();
  for (const alumno of alumnos) {
    if (alumno.codigo_alumno) porCodigo.set(normalizarTexto(alumno.codigo_alumno), alumno);
    if (alumno.dni) porDni.set(normalizarTexto(alumno.dni), alumno);
    if (alumno.nombre_completo) {
      const nombreKey = normalizarTexto(alumno.nombre_completo);
      nombreCounts.set(nombreKey, (nombreCounts.get(nombreKey) || 0) + 1);
      porNombre.set(nombreKey, alumno);
    }
  }

  const coincidencias = [];
  const noEncontrados = [];
  const resumen = {
    hoja: sheetName,
    filas_excel: 0,
    alumnos_encontrados: 0,
    alumnos_no_encontrados: 0,
    cambios_montos: 0,
    pagos_nuevos: 0,
    pagos_omitidos_existentes: 0,
  };

  for (const row of rows) {
    const headerMap = {};
    for (const key of Object.keys(row)) headerMap[normalizarTexto(key)] = key;

    const codigo = obtenerValorPorEncabezado(row, headerMap, ['Cod. Alumno', 'Cód. Alumno', 'Codigo Alumno', 'Código Alumno']);
    const dni = obtenerValorPorEncabezado(row, headerMap, ['DNI Alumno', 'DNI']);
    const nombre = obtenerValorPorEncabezado(row, headerMap, ['Alumno', 'Nombre', 'Nombre Completo']);
    if (!codigo && !dni && !nombre) continue;

    resumen.filas_excel += 1;
    let matchBy = null;
    let alumno = null;
    if (codigo && porCodigo.has(normalizarTexto(codigo))) {
      alumno = porCodigo.get(normalizarTexto(codigo));
      matchBy = 'codigo';
    } else if (dni && porDni.has(normalizarTexto(dni))) {
      alumno = porDni.get(normalizarTexto(dni));
      matchBy = 'dni';
    } else if (nombre) {
      const nombreKey = normalizarTexto(nombre);
      if (nombreCounts.get(nombreKey) === 1) {
        alumno = porNombre.get(nombreKey);
        matchBy = 'nombre';
      }
    }

    if (!alumno) {
      noEncontrados.push({ codigo_alumno: codigo || '', dni: dni || '', nombre_completo: nombre || '' });
      continue;
    }

    const montoMatricula = parseMontoExcel(obtenerValorPorEncabezado(row, headerMap, ['Matricula', 'Matrícula']));
    const montoMateriales = parseMontoExcel(obtenerValorPorEncabezado(row, headerMap, ['Materiales']));
    const montoPension = parseMontoExcel(obtenerValorPorEncabezado(row, headerMap, ['Proyectada', 'Pension', 'Pensión']));

    const cambiosMontos = [];
    [
      ['monto_matricula', 'Matrícula', montoMatricula],
      ['monto_materiales', 'Materiales', montoMateriales],
      ['monto_pension', 'Pensión', montoPension],
    ].forEach(([campo, etiqueta, valorExcel]) => {
      if (valorExcel === null) return;
      const actual = alumno[campo] !== null && alumno[campo] !== undefined ? Number(alumno[campo]) : null;
      if (actual !== valorExcel) cambiosMontos.push({ campo, etiqueta, actual, nuevo: valorExcel });
    });

    const estadosPorClave = new Map((alumno.tbl_estado_pension || []).map(e => [e.clave_mes, e]));
    const pagosNuevos = [];
    const pagosOmitidos = [];
    for (const [headerNormalizado, headerOriginal] of Object.entries(headerMap)) {
      const concepto = conceptos[headerNormalizado];
      if (!concepto) continue;
      const monto = parseMontoExcel(row[headerOriginal]);
      if (monto === null || monto <= 0) continue;
      const existente = estadosPorClave.get(concepto.clave);
      const tienePago = existente && ((existente.tbl_pagos_pension || []).length > 0 || Number(existente.monto_pagado || 0) > 0 || existente.estado !== 'PENDIENTE');
      const item = { clave_mes: concepto.clave, concepto: concepto.nombre, monto };
      if (tienePago) pagosOmitidos.push(item);
      else pagosNuevos.push(item);
    }

    resumen.alumnos_encontrados += 1;
    resumen.cambios_montos += cambiosMontos.length;
    resumen.pagos_nuevos += pagosNuevos.length;
    resumen.pagos_omitidos_existentes += pagosOmitidos.length;
    coincidencias.push({
      alumno: {
        id: alumno.id,
        codigo_alumno: alumno.codigo_alumno,
        dni: alumno.dni,
        nombre_completo: alumno.nombre_completo,
      },
      coincidencia_por: matchBy,
      excel: { codigo_alumno: codigo || '', dni: dni || '', nombre_completo: nombre || '' },
      cambios_montos: cambiosMontos,
      pagos_nuevos: pagosNuevos,
      pagos_omitidos: pagosOmitidos,
    });
  }

  resumen.alumnos_no_encontrados = noEncontrados.length;
  return { resumen, coincidencias, noEncontrados };
};

const generarCodigoTicket = async () => {
  for (let i = 0; i < 8; i += 1) {
    const codigo = `R${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const existe = await prisma.tbl_pagos_pension.findUnique({ where: { codigo_ticket: codigo } });
    if (!existe) return codigo;
  }
  return `R${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

const buildTicket = ({ codigo, pago, alumno, plantilla, estadoPension, concepto, montoTotal, montoPagadoAcumulado, observacion, usuario }) => {
  const aula = alumno?.tbl_aulas;
  const aulaTexto = aula ? `${aula.tbl_grados?.nombre || ''} ${aula.seccion || ''}`.trim() : '';
  const total = Number(montoTotal || 0);
  const pagado = Number(montoPagadoAcumulado || 0);
  const monto = Number(pago.monto || 0);

  return {
    codigo,
    emitido_en: new Date().toISOString(),
    fecha_pago: formatFechaIso(pago.fecha_pago),
    alumno: {
      id: alumno?.id || null,
      nombre_completo: alumno?.nombre_completo || '',
      codigo_alumno: alumno?.codigo_alumno || '',
      dni: alumno?.dni || null,
      aula: aulaTexto,
      nivel: aula?.tbl_grados?.tbl_niveles?.nombre || null,
    },
    pension: {
      anio_escolar: plantilla?.tbl_anios_escolares?.anio || null,
      clave_mes: estadoPension.clave_mes,
      concepto,
      estado: estadoPension.estado,
      monto_total: total,
      monto_pagado_en_ticket: monto,
      monto_pagado_acumulado: pagado,
      saldo_pendiente: Math.max(total - pagado, 0),
    },
    observacion: observacion || null,
    registrado_por: {
      id: usuario?.id || null,
      nombre: usuario?.nombres || '',
      rol: usuario?.tbl_roles?.codigo || usuario?.tbl_roles?.nombre || '',
    },
  };
};

const selectAlumnoTicket = {
  id: true,
  nombre_completo: true,
  codigo_alumno: true,
  dni: true,
  tbl_aulas: {
    select: {
      seccion: true,
      tbl_grados: { select: { nombre: true, tbl_niveles: { select: { nombre: true } } } },
    },
  },
};

const crearPagoConTicket = async ({ estadoPension, monto, fechaPago, observacion, alumno, plantilla, usuario, montoTotal, montoPagadoAcumulado }) => {
  const codigo = await generarCodigoTicket();
  const pago = await prisma.tbl_pagos_pension.create({
    data: {
      id_estado_pension: estadoPension.id,
      monto,
      fecha_pago: fechaPago,
      observacion,
      codigo_ticket: codigo,
      registrado_por: usuario.id,
      user_id_registration: usuario.id,
    },
  });

  const ticket = buildTicket({
    codigo,
    pago,
    alumno,
    plantilla,
    estadoPension,
    concepto: nombreConcepto(plantilla, estadoPension.clave_mes),
    montoTotal,
    montoPagadoAcumulado,
    observacion,
    usuario,
  });

  await prisma.tbl_pagos_pension.update({
    where: { id: pago.id },
    data: { ticket_json: { ...ticket, id_pago: pago.id } },
  });

  return { ...pago, ticket_json: { ...ticket, id_pago: pago.id } };
};

const asegurarTicketPagoExistente = async ({ pago, estadoPension, alumno, plantilla, usuario, montoPagadoAcumulado }) => {
  if (pago.codigo_ticket && pago.ticket_json) return pago;

  const codigo = pago.codigo_ticket || await generarCodigoTicket();
  const ticket = buildTicket({
    codigo,
    pago,
    alumno,
    plantilla,
    estadoPension,
    concepto: nombreConcepto(plantilla, estadoPension.clave_mes),
    montoTotal: estadoPension.monto_total,
    montoPagadoAcumulado,
    observacion: pago.observacion,
    usuario,
  });

  const actualizado = await prisma.tbl_pagos_pension.update({
    where: { id: pago.id },
    data: {
      codigo_ticket: codigo,
      ticket_json: { ...ticket, id_pago: pago.id },
    },
  });

  return { ...actualizado, ticket_json: { ...ticket, id_pago: pago.id } };
};

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
            observacion_no_corresponde: e.observacion_no_corresponde || null,
            pagos: e.tbl_pagos_pension.map(p => ({
              id: p.id,
              monto: Number(p.monto),
              fecha: p.fecha_pago.toISOString().split('T')[0],
              observacion: p.observacion,
              codigo_ticket: p.codigo_ticket,
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
      observacion_no_corresponde: e.observacion_no_corresponde || null,
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
      include: {
        tbl_alumnos: { select: selectAlumnoTicket },
        tbl_plantilla_pension: { include: { tbl_anios_escolares: { select: { anio: true } } } },
        tbl_pagos_pension: {
          include: { tbl_usuarios: { select: { id: true, nombres: true, tbl_roles: { select: { codigo: true, nombre: true } } } } },
          orderBy: { fecha_pago: 'asc' },
        },
      },
    });

    if (!estado) {
      return res.json({ data: { estado: 'PENDIENTE', monto_total: null, monto_pagado: 0, pagos: [] } });
    }

    let acumulado = 0;
    const pagos = [];
    for (const pago of estado.tbl_pagos_pension) {
      acumulado += Number(pago.monto || 0);
      const pagoConTicket = await asegurarTicketPagoExistente({
        pago,
        estadoPension: estado,
        alumno: estado.tbl_alumnos,
        plantilla: estado.tbl_plantilla_pension,
        usuario: pago.tbl_usuarios,
        montoPagadoAcumulado: acumulado,
      });
      pagos.push(pagoConTicket);
    }

    res.json({
      data: {
        id: estado.id,
        estado: estado.estado,
        monto_total: estado.monto_total ? Number(estado.monto_total) : null,
        monto_pagado: Number(estado.monto_pagado),
        observacion_no_corresponde: estado.observacion_no_corresponde || null,
        pagos: pagos.map(p => ({
          id: p.id,
          monto: Number(p.monto),
          fecha: p.fecha_pago.toISOString().split('T')[0],
          observacion: p.observacion,
          codigo_ticket: p.codigo_ticket,
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
    if (!anioActivo) return res.status(400).json({ error: 'No hay ano escolar activo' });
    const plantilla = await prisma.tbl_plantilla_pension.findFirst({
      where: { id_anio_escolar: anioActivo.id },
      include: { tbl_anios_escolares: { select: { anio: true } } },
    });
    if (!plantilla) return res.status(404).json({ error: 'No hay plantilla de pension configurada' });

    const alumno = await prisma.tbl_alumnos.findUnique({
      where: { id: parseInt(id_alumno) },
      select: selectAlumnoTicket,
    });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    const usuario = await prisma.tbl_usuarios.findUnique({
      where: { id: req.user.id },
      select: { id: true, nombres: true, tbl_roles: { select: { codigo: true, nombre: true } } },
    });

    const existente = await prisma.tbl_estado_pension.findUnique({
      where: { id_alumno_clave_mes: { id_alumno: parseInt(id_alumno), clave_mes: String(clave_mes) } },
    });

    const fechaHoy = todayLima().date;
    let ticketEmitido = null;

    if (estado === 'PAGADO') {
      // Marcar como pagado completo
      const montoTotal = monto_total ? parseFloat(monto_total) : null;

      const ep = await prisma.tbl_estado_pension.upsert({
        where: { id_alumno_clave_mes: { id_alumno: parseInt(id_alumno), clave_mes: String(clave_mes) } },
        update: {
          estado: 'PAGADO',
          monto_total: montoTotal,
          monto_pagado: montoTotal || 0,
          observacion_no_corresponde: null,
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
          observacion_no_corresponde: null,
          actualizado_por: req.user.id,
          user_id_registration: req.user.id,
        },
      });

      // Registrar pago en historial
      if (montoTotal) {
        const montoRegistrar = existente ? montoTotal - Number(existente.monto_pagado) : montoTotal;
        if (montoRegistrar > 0) {
          ticketEmitido = await crearPagoConTicket({
            estadoPension: ep,
            monto: montoRegistrar,
            fechaPago: fechaHoy,
            observacion: observacion || 'Pago completo',
            alumno,
            plantilla,
            usuario,
            montoTotal,
            montoPagadoAcumulado: montoTotal,
          });
        }
      }

    } else if (estado === 'PAGO_PARCIAL') {
      if (monto_total === undefined || monto_total === null || monto_total === '' || monto_pago === undefined || monto_pago === null || monto_pago === '') {
        return res.status(400).json({ error: 'monto_total y monto_pago son obligatorios para pago parcial' });
      }

      const montoTotal = parseFloat(monto_total);
      const montoPago = parseFloat(monto_pago);
      if (Number.isNaN(montoTotal) || montoTotal <= 0 || Number.isNaN(montoPago) || montoPago < 0) {
        return res.status(400).json({ error: 'Montos invalidos para pago parcial' });
      }
      const nuevoPagado = (existente ? Number(existente.monto_pagado) : 0) + montoPago;

      // Si el nuevo total pagado cubre o supera el monto total, marcar como PAGADO
      const nuevoEstado = nuevoPagado >= montoTotal ? 'PAGADO' : 'PAGO_PARCIAL';

      const ep = await prisma.tbl_estado_pension.upsert({
        where: { id_alumno_clave_mes: { id_alumno: parseInt(id_alumno), clave_mes: String(clave_mes) } },
        update: {
          estado: nuevoEstado,
          monto_total: montoTotal,
          monto_pagado: nuevoPagado,
          observacion_no_corresponde: null,
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
          observacion_no_corresponde: null,
          actualizado_por: req.user.id,
          user_id_registration: req.user.id,
        },
      });

      ticketEmitido = await crearPagoConTicket({
        estadoPension: ep,
        monto: montoPago,
        fechaPago: fechaHoy,
        observacion: observacion || null,
        alumno,
        plantilla,
        usuario,
        montoTotal,
        montoPagadoAcumulado: nuevoPagado,
      });

    } else if (estado === 'NO_CORRESPONDE') {
      const observacionNoCorresponde = String(observacion || '').trim();
      if (!observacionNoCorresponde) {
        return res.status(400).json({ error: 'La observacion es obligatoria para No Corresponde Pago' });
      }

      const ep = await prisma.tbl_estado_pension.upsert({
        where: { id_alumno_clave_mes: { id_alumno: parseInt(id_alumno), clave_mes: String(clave_mes) } },
        update: {
          estado: 'NO_CORRESPONDE',
          monto_total: null,
          monto_pagado: 0,
          observacion_no_corresponde: observacionNoCorresponde,
          actualizado_por: req.user.id,
          user_id_modification: req.user.id,
          date_time_modification: new Date(),
        },
        create: {
          id_plantilla: plantilla.id,
          id_alumno: parseInt(id_alumno),
          clave_mes: String(clave_mes),
          estado: 'NO_CORRESPONDE',
          monto_total: null,
          monto_pagado: 0,
          observacion_no_corresponde: observacionNoCorresponde,
          actualizado_por: req.user.id,
          user_id_registration: req.user.id,
        },
      });

      await prisma.tbl_pagos_pension.deleteMany({ where: { id_estado_pension: ep.id } });

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
            observacion_no_corresponde: null,
            actualizado_por: req.user.id,
            user_id_modification: req.user.id,
            date_time_modification: new Date(),
          },
        });
      }
    } else {
      return res.status(400).json({ error: 'Estado invalido. Use: PAGADO, PAGO_PARCIAL, NO_CORRESPONDE o PENDIENTE' });
    }

    await registrarAuditoria({
      userId: req.user.id,
      accion: 'REGISTRAR_PAGO_PENSION',
      tipoEntidad: 'tbl_estado_pension',
      resumen: `Pension alumno ${id_alumno} mes ${clave_mes}: ${estado}${monto_pago !== undefined && monto_pago !== null && monto_pago !== '' ? ` - S/. ${monto_pago}` : ''}`,
    });

    res.json({
      mensaje: 'Pension actualizada',
      data: ticketEmitido?.ticket_json ? { ticket: ticketEmitido.ticket_json } : null,
    });
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ error: 'Error al registrar pago de pension' });
  }
};

// Consultar ticket por codigo unico (para reimpresion/verificacion)
const obtenerTicket = async (req, res) => {
  const codigo = String(req.params.codigo || '').trim().toUpperCase();
  if (!codigo) return res.status(400).json({ error: 'Codigo de ticket requerido' });

  try {
    const pago = await prisma.tbl_pagos_pension.findUnique({
      where: { codigo_ticket: codigo },
      include: {
        tbl_usuarios: { select: { id: true, nombres: true, tbl_roles: { select: { codigo: true, nombre: true } } } },
        tbl_estado_pension: {
          include: {
            tbl_alumnos: { select: selectAlumnoTicket },
            tbl_plantilla_pension: { include: { tbl_anios_escolares: { select: { anio: true } } } },
          },
        },
      },
    });

    if (!pago) return res.status(404).json({ error: 'Ticket no encontrado' });

    if (pago.ticket_json) {
      return res.json({ data: pago.ticket_json });
    }

    const estadoPension = pago.tbl_estado_pension;
    const ticket = buildTicket({
      codigo,
      pago,
      alumno: estadoPension.tbl_alumnos,
      plantilla: estadoPension.tbl_plantilla_pension,
      estadoPension,
      concepto: nombreConcepto(estadoPension.tbl_plantilla_pension, estadoPension.clave_mes),
      montoTotal: estadoPension.monto_total,
      montoPagadoAcumulado: estadoPension.monto_pagado,
      observacion: pago.observacion,
      usuario: pago.tbl_usuarios,
    });

    return res.json({ data: { ...ticket, id_pago: pago.id } });
  } catch (error) {
    console.error('Error al obtener ticket:', error);
    res.status(500).json({ error: 'Error al obtener ticket' });
  }
};

// Listar tickets emitidos para impresion por lotes
const listarTickets = async (req, res) => {
  const { fecha_desde, fecha_hasta, buscar, id_nivel, id_grado, id_aula } = req.query;

  try {
    const where = {};
    if (fecha_desde || fecha_hasta) {
      where.fecha_pago = {};
      if (fecha_desde) where.fecha_pago.gte = new Date(`${fecha_desde}T00:00:00Z`);
      if (fecha_hasta) where.fecha_pago.lte = new Date(`${fecha_hasta}T00:00:00Z`);
    }

    const alumnoWhere = {};
    if (id_aula) {
      alumnoWhere.id_aula = parseInt(id_aula);
    } else if (id_grado) {
      alumnoWhere.tbl_aulas = { id_grado: parseInt(id_grado) };
    } else if (id_nivel) {
      alumnoWhere.tbl_aulas = { tbl_grados: { id_nivel: parseInt(id_nivel) } };
    }

    const term = String(buscar || '').trim();
    if (term) {
      where.OR = [
        { codigo_ticket: { contains: term, mode: 'insensitive' } },
        { observacion: { contains: term, mode: 'insensitive' } },
        { tbl_estado_pension: { tbl_alumnos: { nombre_completo: { contains: term, mode: 'insensitive' } } } },
        { tbl_estado_pension: { tbl_alumnos: { codigo_alumno: { contains: term, mode: 'insensitive' } } } },
        { tbl_estado_pension: { tbl_alumnos: { dni: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    if (Object.keys(alumnoWhere).length > 0) {
      where.tbl_estado_pension = { tbl_alumnos: alumnoWhere };
    }

    const pagos = await prisma.tbl_pagos_pension.findMany({
      where,
      orderBy: [{ fecha_pago: 'desc' }, { id: 'desc' }],
      take: 300,
      include: {
        tbl_usuarios: { select: { id: true, nombres: true, tbl_roles: { select: { codigo: true, nombre: true } } } },
        tbl_estado_pension: {
          include: {
            tbl_alumnos: { select: selectAlumnoTicket },
            tbl_plantilla_pension: { include: { tbl_anios_escolares: { select: { anio: true } } } },
          },
        },
      },
    });

    const data = [];
    for (const pago of pagos) {
      const estadoPension = pago.tbl_estado_pension;
      let ticket = pago.ticket_json;

      if (!ticket || !pago.codigo_ticket) {
        const pagosEstado = await prisma.tbl_pagos_pension.findMany({
          where: { id_estado_pension: pago.id_estado_pension },
          orderBy: [{ fecha_pago: 'asc' }, { id: 'asc' }],
          select: { id: true, monto: true },
        });
        let acumulado = 0;
        for (const p of pagosEstado) {
          acumulado += Number(p.monto || 0);
          if (p.id === pago.id) break;
        }

        const pagoConTicket = await asegurarTicketPagoExistente({
          pago,
          estadoPension,
          alumno: estadoPension.tbl_alumnos,
          plantilla: estadoPension.tbl_plantilla_pension,
          usuario: pago.tbl_usuarios,
          montoPagadoAcumulado: acumulado,
        });
        ticket = pagoConTicket.ticket_json;
      }

      const alumno = estadoPension.tbl_alumnos;
      const aula = alumno?.tbl_aulas;
      data.push({
        id_pago: pago.id,
        codigo: ticket?.codigo || pago.codigo_ticket,
        fecha_pago: formatFechaIso(pago.fecha_pago),
        monto: Number(pago.monto),
        observacion: pago.observacion || null,
        alumno: ticket?.alumno || {
          id: alumno?.id || null,
          nombre_completo: alumno?.nombre_completo || '',
          codigo_alumno: alumno?.codigo_alumno || '',
          dni: alumno?.dni || null,
          aula: aula ? `${aula.tbl_grados?.nombre || ''} ${aula.seccion || ''}`.trim() : '',
          nivel: aula?.tbl_grados?.tbl_niveles?.nombre || null,
        },
        concepto: ticket?.pension?.concepto || nombreConcepto(estadoPension.tbl_plantilla_pension, estadoPension.clave_mes),
        estado: ticket?.pension?.estado || estadoPension.estado,
        ticket,
      });
    }

    res.json({ data });
  } catch (error) {
    console.error('Error al listar tickets:', error);
    res.status(500).json({ error: 'Error al listar tickets de pension' });
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
      monto_matricula: a.monto_matricula !== null && a.monto_matricula !== undefined ? Number(a.monto_matricula) : null,
      monto_materiales: a.monto_materiales !== null && a.monto_materiales !== undefined ? Number(a.monto_materiales) : null,
      monto_pension: a.monto_pension !== null && a.monto_pension !== undefined ? Number(a.monto_pension) : null,
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
        observacion_no_corresponde: e.observacion_no_corresponde || null,
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

const previewImportacionExcel = async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ error: 'Debe subir un archivo Excel' });
    const data = await analizarExcelPensiones(req.file.buffer);
    res.json({ data });
  } catch (error) {
    console.error('Error al analizar Excel de pensiones:', error);
    res.status(500).json({ error: error.message || 'Error al analizar Excel de pensiones' });
  }
};

const aplicarImportacionExcel = async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ error: 'Debe subir un archivo Excel' });

    const analisis = await analizarExcelPensiones(req.file.buffer);
    const anioActivo = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
    if (!anioActivo) return res.status(400).json({ error: 'No hay ano escolar activo' });

    const plantilla = await prisma.tbl_plantilla_pension.findFirst({
      where: { id_anio_escolar: anioActivo.id },
      include: { tbl_anios_escolares: { select: { anio: true } } },
    });
    if (!plantilla) return res.status(404).json({ error: 'No hay plantilla de pension configurada' });

    const usuario = await prisma.tbl_usuarios.findUnique({
      where: { id: req.user.id },
      select: { id: true, nombres: true, tbl_roles: { select: { codigo: true, nombre: true } } },
    });

    const resultado = {
      alumnos_actualizados: 0,
      campos_montos_actualizados: 0,
      pagos_creados: 0,
      pagos_omitidos_existentes: analisis.resumen.pagos_omitidos_existentes,
      alumnos_no_encontrados: analisis.noEncontrados.length,
    };

    for (const item of analisis.coincidencias) {
      if (item.cambios_montos.length > 0) {
        const data = {};
        for (const cambio of item.cambios_montos) data[cambio.campo] = cambio.nuevo;
        data.user_id_modification = req.user.id;
        data.date_time_modification = new Date();
        await prisma.tbl_alumnos.update({ where: { id: item.alumno.id }, data });
        resultado.alumnos_actualizados += 1;
        resultado.campos_montos_actualizados += item.cambios_montos.length;
      }

      for (const pagoExcel of item.pagos_nuevos) {
        const alumno = await prisma.tbl_alumnos.findUnique({
          where: { id: item.alumno.id },
          select: {
            ...selectAlumnoTicket,
            monto_matricula: true,
            monto_materiales: true,
            monto_pension: true,
          },
        });
        if (!alumno) continue;

        const totalBase = pagoExcel.clave_mes === 'MATRICULA'
          ? alumno.monto_matricula
          : pagoExcel.clave_mes === 'MATERIALES'
            ? alumno.monto_materiales
            : alumno.monto_pension;
        const montoTotal = totalBase !== null && totalBase !== undefined ? Number(totalBase) : pagoExcel.monto;
        const estado = pagoExcel.monto >= montoTotal ? 'PAGADO' : 'PAGO_PARCIAL';

        const ep = await prisma.tbl_estado_pension.upsert({
          where: { id_alumno_clave_mes: { id_alumno: alumno.id, clave_mes: pagoExcel.clave_mes } },
          create: {
            id_plantilla: plantilla.id,
            id_alumno: alumno.id,
            clave_mes: pagoExcel.clave_mes,
            estado,
            monto_total: montoTotal,
            monto_pagado: pagoExcel.monto,
            actualizado_por: req.user.id,
            user_id_registration: req.user.id,
          },
          update: {
            estado,
            monto_total: montoTotal,
            monto_pagado: pagoExcel.monto,
            actualizado_por: req.user.id,
            user_id_modification: req.user.id,
            date_time_modification: new Date(),
          },
        });

        await crearPagoConTicket({
          estadoPension: ep,
          monto: pagoExcel.monto,
          fechaPago: todayLima().date,
          observacion: 'Importado desde Excel',
          alumno,
          plantilla,
          usuario,
          montoTotal,
          montoPagadoAcumulado: pagoExcel.monto,
        });
        resultado.pagos_creados += 1;
      }
    }

    await registrarAuditoria({
      userId: req.user.id,
      accion: 'IMPORTAR_PENSIONES_EXCEL',
      tipoEntidad: 'tbl_estado_pension',
      resumen: `Importacion Excel: ${resultado.campos_montos_actualizados} montos y ${resultado.pagos_creados} pagos creados`,
      meta: resultado,
    });

    res.json({ data: { mensaje: 'Importacion aplicada', resultado } });
  } catch (error) {
    console.error('Error al aplicar Excel de pensiones:', error);
    res.status(500).json({ error: error.message || 'Error al aplicar Excel de pensiones' });
  }
};

module.exports = { obtenerPlantilla, obtenerEstado, registrarPago, obtenerTicket, listarTickets, obtenerDetalleMes, cuadricula, guardarPlantilla, previewImportacionExcel, aplicarImportacionExcel };
