const { normalizarTexto } = require('../pensiones/calculoConceptos');

const MESES = {
  ENE: 1, ENERO: 1, FEB: 2, FEBRERO: 2, MAR: 3, MARZO: 3,
  ABR: 4, ABRIL: 4, MAY: 5, MAYO: 5, JUN: 6, JUNIO: 6,
  JUL: 7, JULIO: 7, AGO: 8, AGOSTO: 8, SEP: 9, SEPTIEMBRE: 9,
  OCT: 10, OCTUBRE: 10, NOV: 11, NOVIEMBRE: 11, DIC: 12, DICIEMBRE: 12,
};

const descriptorConcepto = (concepto) => normalizarTexto(`${concepto?.clave || ''} ${concepto?.nombre || ''}`);

const mesConcepto = (concepto) => {
  const descriptor = descriptorConcepto(concepto);
  for (const [token, mes] of Object.entries(MESES)) {
    if (new RegExp(`(^|[^A-Z])${token}([^A-Z]|$)`).test(descriptor)) return mes;
  }
  return null;
};

const fechaVencimientoConcepto = ({ concepto, anio, fechaRegistro }) => {
  const descriptor = descriptorConcepto(concepto);
  if (descriptor.includes('MATRICULA') || descriptor.includes('MATERIAL')) {
    const fecha = fechaRegistro ? new Date(fechaRegistro) : new Date(`${anio}-01-01T00:00:00Z`);
    return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  }
  const mes = mesConcepto(concepto);
  if (!mes) return null;
  const dia = mes === 12 ? 15 : 25;
  return new Date(Date.UTC(Number(anio), mes - 1, dia));
};

const conceptoExigible = ({ concepto, anio, fechaRegistro, hoy }) => {
  const vencimiento = fechaVencimientoConcepto({ concepto, anio, fechaRegistro });
  return Boolean(vencimiento && vencimiento.getTime() <= hoy.getTime());
};

module.exports = { descriptorConcepto, mesConcepto, fechaVencimientoConcepto, conceptoExigible };

