const { PrismaClient } = require('@prisma/client');

// --- Configuración de Prisma según entorno ---
// LOCAL: muestra warnings en consola para ayudar en el desarrollo
// RAILWAY: solo muestra errores para no saturar los logs
const isProduction = process.env.NODE_ENV === 'production';

// ─── Forzar timezone UTC en TODAS las conexiones Prisma ────────────
//
// CRITICO: Sin esto, si PostgreSQL tiene timezone != UTC (ej: America/Bogota),
// los campos @db.Time(6) sufren doble conversión de zona al escribir/leer:
//   - Escribir hora_inicio "07:30" → PostgreSQL convierte a "02:30" (-5h)
//   - Leer devuelve "02:30" → comparación con hora Lima siempre da TARDE
//
// El pool pg (db.js) ya hace SET timezone='UTC', pero Prisma usa conexiones
// propias. Esta opción inyecta timezone=UTC a nivel de sesión PostgreSQL
// en cada conexión del pool de Prisma, igualando el comportamiento.
//
const rawUrl = process.env.DATABASE_URL || '';
const tzOption = 'options=-c%20timezone%3DUTC';
let dbUrl = rawUrl;
if (rawUrl && !rawUrl.includes('timezone')) {
  const sep = rawUrl.includes('?') ? '&' : '?';
  dbUrl = `${rawUrl}${sep}${tzOption}`;
}

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
  log: isProduction
    ? ['error']
    : ['warn', 'error'],
});

module.exports = prisma;
