const normalizarTexto = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

const normalizarMesesPlantilla = (mesesRaw) => {
  const meses = Array.isArray(mesesRaw) ? mesesRaw : [];
  return meses.map((m) => {
    const clave = m.clave || m.clave_mes || m.mes || '';
    const nombre = m.nombre || m.label || clave;
    const tipo = m.tipo || 'mes';
    let monto = m.monto !== undefined && m.monto !== null && m.monto !== ''
      ? Number(m.monto)
      : null;
    if (tipo === 'personalizado' && monto === null
        && ['ADICIONAL JULIO', 'ADICIONAL DICIEMBRE'].includes(normalizarTexto(nombre))) {
      monto = 50;
    }
    return { clave, nombre, tipo, comentario: m.comentario || '', monto };
  }).filter((m) => m.clave);
};

const montoBaseConceptoAlumno = (alumno, claveMes, montoPersonalizado = null) => {
  const clave = normalizarTexto(claveMes);
  if (clave.includes('MATRICULA')) return alumno.monto_matricula;
  if (clave.includes('MATERIAL')) {
    if (alumno.monto_materiales === null || alumno.monto_materiales === undefined) return null;
    return Math.min(Number(alumno.monto_materiales), 150);
  }
  if (montoPersonalizado !== null && montoPersonalizado !== undefined
      && Number.isFinite(Number(montoPersonalizado))) {
    return Number(montoPersonalizado);
  }
  return alumno.monto_pension;
};

const montoTotalVigente = (alumno, concepto, estado) => {
  const estadoTexto = estado?.estado || 'PENDIENTE';
  const descriptor = typeof concepto === 'object'
    ? `${concepto.clave || ''} ${concepto.nombre || ''}`
    : concepto;
  const montoPersonalizado = typeof concepto === 'object' && concepto.tipo === 'personalizado'
    ? concepto.monto
    : null;
  const montoActual = montoBaseConceptoAlumno(alumno, descriptor, montoPersonalizado);
  if (['PENDIENTE', 'PAGO_PARCIAL'].includes(estadoTexto)
      && montoActual !== null && montoActual !== undefined) {
    return Number(montoActual);
  }
  return Number(estado?.monto_total ?? montoActual ?? 0);
};

module.exports = {
  normalizarTexto,
  normalizarMesesPlantilla,
  montoBaseConceptoAlumno,
  montoTotalVigente,
};
