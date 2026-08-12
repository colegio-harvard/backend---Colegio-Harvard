const prisma = require('../config/prisma');
const { getBackupStatus } = require('../utils/backupService');
const { resumir } = require('../services/monitoreo/metricas');

const estadoSistema = async (req, res) => {
  const inicio = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const memoria = process.memoryUsage();
    res.json({
      data: {
        estado: 'SALUDABLE',
        generado_en: new Date().toISOString(),
        request_id: req.requestId,
        base_datos: { estado: 'ok', respuesta_ms: Date.now() - inicio },
        servicio: {
          activo_desde_segundos: Math.floor(process.uptime()),
          memoria_mb: {
            usada: Number((memoria.heapUsed / 1024 / 1024).toFixed(1)),
            reservada: Number((memoria.heapTotal / 1024 / 1024).toFixed(1)),
          },
        },
        trafico: { ultimos_15_minutos: resumir(15), ultima_hora: resumir(60) },
        respaldo: getBackupStatus(),
      },
    });
  } catch (error) {
    console.error(`[MONITOREO] ${req.requestId}:`, error.message);
    res.status(503).json({
      data: {
        estado: 'DEGRADADO',
        request_id: req.requestId,
        base_datos: { estado: 'error', respuesta_ms: Date.now() - inicio },
        trafico: { ultimos_15_minutos: resumir(15), ultima_hora: resumir(60) },
      },
    });
  }
};

module.exports = { estadoSistema };
