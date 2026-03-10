/**
 * Utilidades centralizadas de fecha/hora.
 *
 * Reglas del sistema:
 *   - Backend y DB operan SIEMPRE en UTC.
 *   - La zona civil del colegio es America/Lima (UTC-5).
 *   - Contrato API: ISO 8601 con "Z"  (ej: 2026-01-24T18:05:00.000Z).
 *   - Fechas civiles (Date en DB) viajan como "YYYY-MM-DD".
 */

const SCHOOL_TZ = 'America/Lima';
const SCHOOL_UTC_OFFSET_MS = -5 * 60 * 60 * 1000; // UTC-5

// ─── Instante actual ────────────────────────────────────────────
/** Retorna el instante actual (Date ya es UTC internamente). */
const utcNow = () => new Date();

// ─── Serialización ──────────────────────────────────────────────
/** Siempre ISO UTC con Z. */
const toUtcIso = (date) => date.toISOString();

// ─── Fecha civil "hoy" en Lima ──────────────────────────────────
/**
 * Retorna la fecha civil de Lima como string "YYYY-MM-DD" y como Date
 * apuntando a medianoche UTC de ese día (para queries @db.Date).
 *
 * Necesario porque toISOString().split('T')[0] devuelve la fecha UTC,
 * que difiere de Lima entre 19:00-23:59 hora local.
 */
const todayLima = () => {
  const now = new Date();
  const limaMs = now.getTime() + SCHOOL_UTC_OFFSET_MS;
  const limaDate = new Date(limaMs);
  const yyyy = limaDate.getUTCFullYear();
  const mm = String(limaDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(limaDate.getUTCDate()).padStart(2, '0');
  const iso = `${yyyy}-${mm}-${dd}`;
  return { iso, date: new Date(`${iso}T00:00:00Z`) };
};

// ─── Hora actual en Lima (ms desde medianoche) ──────────────────
/**
 * Retorna la hora actual en la zona de Lima expresada en milisegundos
 * desde medianoche.  Reemplaza el antipatrón getHours() que depende de TZ.
 */
const currentLimaTimeMs = () => {
  const now = new Date();
  const limaMs = now.getTime() + SCHOOL_UTC_OFFSET_MS;
  const limaDate = new Date(limaMs);
  return (
    limaDate.getUTCHours() * 3600000 +
    limaDate.getUTCMinutes() * 60000 +
    limaDate.getUTCSeconds() * 1000
  );
};

// ─── Convertir hora Time(6) a ms desde medianoche ───────────────
/**
 * Los campos @db.Time(6) se almacenan como 1970-01-01THHMM:00Z.
 * Prisma los devuelve como Date; extraemos hh:mm en UTC.
 */
const timeFieldToMs = (dateObj) => {
  return dateObj.getUTCHours() * 3600000 + dateObj.getUTCMinutes() * 60000;
};

// ─── Parsear fecha civil desde string ───────────────────────────
/**
 * Recibe "YYYY-MM-DD" y devuelve Date en medianoche UTC.
 * Seguro en cualquier TZ porque usa constructor explícito.
 */
const parseDateOnly = (str) => {
  if (!str || typeof str !== 'string') return null;
  return new Date(`${str}T00:00:00Z`);
};

/**
 * Rango inclusivo para filtros de timestamptz sobre una fecha civil.
 *   gte: inicio del día UTC   lte: fin del día UTC
 */
const dayRangeUtc = (dateStr) => ({
  gte: new Date(`${dateStr}T00:00:00Z`),
  lte: new Date(`${dateStr}T23:59:59.999Z`),
});

// ─── Validación de input (contrato API) ─────────────────────────
/**
 * Acepta ISO 8601 con Z/offset o epoch ms.
 * Rechaza strings naives (sin zona).
 */
const parseClientDateTime = (input) => {
  if (typeof input === 'number') {
    const d = new Date(input);
    if (isNaN(d.getTime())) return null;
    return d;
  }
  if (typeof input === 'string') {
    // Debe contener Z, + o - offset después de la hora
    if (!/[Zz]|[+-]\d{2}:\d{2}/.test(input)) return null;
    const d = new Date(input);
    if (isNaN(d.getTime())) return null;
    return d;
  }
  return null;
};

// ─── Claves y etiquetas de meses (single source of truth) ────
const MESES_KEYS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const MES_LABELS = {
  ENE: 'Enero', FEB: 'Febrero', MAR: 'Marzo', ABR: 'Abril',
  MAY: 'Mayo', JUN: 'Junio', JUL: 'Julio', AGO: 'Agosto',
  SEP: 'Septiembre', OCT: 'Octubre', NOV: 'Noviembre', DIC: 'Diciembre',
};

/** Retorna { key: 'FEB', label: 'Febrero' } para el mes actual en Lima. */
const currentMesLima = () => {
  const { iso } = todayLima();
  const monthIdx = parseInt(iso.split('-')[1]) - 1;
  const key = MESES_KEYS[monthIdx];
  return { key, label: MES_LABELS[key] };
};

module.exports = {
  SCHOOL_TZ,
  SCHOOL_UTC_OFFSET_MS,
  utcNow,
  toUtcIso,
  todayLima,
  currentLimaTimeMs,
  timeFieldToMs,
  parseDateOnly,
  dayRangeUtc,
  parseClientDateTime,
  MESES_KEYS,
  MES_LABELS,
  currentMesLima,
};
