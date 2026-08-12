const { normalizarTexto, normalizarMesesPlantilla } = require('./calculoConceptos');

const parseMontoExcel = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Number(value) : null;
  let limpio = String(value).trim().replace(/^S\s*\/?\.?\s*/i, '').replace(/[^\d.,-]/g, '');
  if (!limpio) return null;
  const ultimaComa = limpio.lastIndexOf(',');
  const ultimoPunto = limpio.lastIndexOf('.');
  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    const decimal = Math.max(ultimaComa, ultimoPunto);
    limpio = `${limpio.slice(0, decimal).replace(/[.,]/g, '')}.${limpio.slice(decimal + 1)}`;
  } else if (ultimaComa >= 0) {
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  } else if ((limpio.match(/\./g) || []).length > 1) {
    const decimal = limpio.lastIndexOf('.');
    limpio = `${limpio.slice(0, decimal).replace(/\./g, '')}.${limpio.slice(decimal + 1)}`;
  }
  const numero = Number(limpio);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
};

const normalizarSeccion = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 'A';
  return raw.replace(/^SECCI[OÓ]N\s+/i, '').trim().toUpperCase();
};

const normalizarGradoImportacion = (value) => normalizarTexto(value)
  .replace(/\bGRADO\b/g, '')
  .replace(/\b(ANOS|AÑOS|ANIO|AÑO)\b/g, 'ANIOS')
  .replace(/\bPRIMERO\b/g, '1RO')
  .replace(/\bPRIMER\b/g, '1RO')
  .replace(/\bSEGUNDO\b/g, '2DO')
  .replace(/\bTERCERO\b/g, '3RO')
  .replace(/\bCUARTO\b/g, '4TO')
  .replace(/\bQUINTO\b/g, '5TO')
  .replace(/\bSEXTO\b/g, '6TO')
  .replace(/\b1(ER|ERO)\b/g, '1RO')
  .replace(/\b3ER\b/g, '3RO')
  .replace(/\s+/g, ' ')
  .trim();

const aulaKey = (nivel, grado, seccion) => [
  normalizarTexto(nivel),
  normalizarGradoImportacion(grado),
  normalizarSeccion(seccion),
].join('|');

const obtenerValorPorEncabezado = (row, headerMap, nombres) => {
  for (const nombre of nombres) {
    const key = headerMap[normalizarTexto(nombre)];
    if (key && row[key] !== undefined) return row[key];
  }
  return null;
};

const crearMapaConceptosImportacion = (plantilla) => {
  const map = {};
  const alias = {
    MATRICULA: ['MATRICULA'], MATERIALES: ['MATERIALES', 'MATERIAL'],
    MAR: ['MARZO'], ABR: ['ABRIL'], MAY: ['MAYO'], JUN: ['JUNIO'], JUL: ['JULIO'],
    AGO: ['AGOSTO'], SET: ['SETIEMBRE', 'SEPTIEMBRE'], SEP: ['SETIEMBRE', 'SEPTIEMBRE'],
    OCT: ['OCTUBRE'], NOV: ['NOVIEMBRE'], DIC: ['DICIEMBRE'],
  };
  for (const mes of normalizarMesesPlantilla(plantilla?.meses_json)) {
    for (const clave of [mes.clave, mes.nombre, ...(alias[mes.clave] || [])]) {
      map[normalizarTexto(clave)] = mes;
    }
  }
  return map;
};

module.exports = {
  parseMontoExcel,
  normalizarSeccion,
  normalizarGradoImportacion,
  aulaKey,
  obtenerValorPorEncabezado,
  crearMapaConceptosImportacion,
};
