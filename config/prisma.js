const { PrismaClient } = require('@prisma/client');

// --- Configuración de Prisma según entorno ---
// LOCAL: muestra warnings en consola para ayudar en el desarrollo
// RAILWAY: solo muestra errores para no saturar los logs
const isProduction = process.env.NODE_ENV === 'production';

const prisma = new PrismaClient({
  log: isProduction
    ? ['error']
    : ['warn', 'error'], // En local muestra warnings para detectar problemas
});

module.exports = prisma;
