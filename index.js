require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const prisma = require('./config/prisma');
const { initSocket } = require('./config/socket');

// --- Rutas ---
const authRoutes = require('./routes/authRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const configEscolarRoutes = require('./routes/configEscolarRoutes');
const padresRoutes = require('./routes/padresRoutes');
const alumnosRoutes = require('./routes/alumnosRoutes');
const asistenciaRoutes = require('./routes/asistenciaRoutes');
const alertasRoutes = require('./routes/alertasRoutes');
const agendaRoutes = require('./routes/agendaRoutes');
const mensajesRoutes = require('./routes/mensajesRoutes');
const comunicadosRoutes = require('./routes/comunicadosRoutes');
const pensionesRoutes = require('./routes/pensionesRoutes');
const notificacionesRoutes = require('./routes/notificacionesRoutes');
const reportesSemanalRoutes = require('./routes/reportesSemanalRoutes');
const anioEscolarRoutes = require('./routes/anioEscolarRoutes');
const auditoriaRoutes = require('./routes/auditoriaRoutes');
const landingRoutes = require('./routes/landingRoutes');
const notifPersonalizadasRoutes = require('./routes/notifPersonalizadasRoutes');

// --- Controller para cron ---
const { ejecutarAlertasNoLlego } = require('./controllers/alertasController');
const { ejecutarProgramadas } = require('./controllers/notifPersonalizadasController');
const { ejecutarBackup } = require('./utils/backupService');

const app = express();
const PORT = process.env.PORT || 4000;

// --- Detección de entorno ---
// LOCAL: NODE_ENV=development (viene del .env local)
// RAILWAY: NODE_ENV=production (se configura en el dashboard de Railway)
const isProduction = process.env.NODE_ENV === 'production';

// --- CORS ---
// LOCAL: permite cualquier origen para facilitar el desarrollo
// RAILWAY: restringe al origen definido en CORS_ORIGIN (dashboard de Railway)
const corsOptions = {
  origin: isProduction && process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : '*', // <-- En desarrollo local permite todo
  credentials: true,
};

// --- Middleware global ---
app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Registro de rutas ---
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/config-escolar', configEscolarRoutes);
app.use('/api/padres', padresRoutes);
app.use('/api/alumnos', alumnosRoutes);
app.use('/api/asistencia', asistenciaRoutes);
app.use('/api/alertas', alertasRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/mensajes', mensajesRoutes);
app.use('/api/comunicados', comunicadosRoutes);
app.use('/api/pensiones', pensionesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/reportes-semanales', reportesSemanalRoutes);
app.use('/api/anio-escolar', anioEscolarRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/landing', landingRoutes);
app.use('/api/notificaciones-personalizadas', notifPersonalizadasRoutes);

// --- Ruta de prueba ---
app.get('/api/ping', async (req, res) => {
  try {
    const result = await prisma.$queryRaw`SELECT NOW()`;
    res.json({ status: 'ok', time: result[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// --- Cron: Alertas "no llegó" cada minuto de lunes a viernes 7:00-14:00 ---
cron.schedule('* 7-13 * * 1-5', async () => {
  try {
    const anioActivo = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
    if (!anioActivo) return;
    console.log(`[CRON] Ejecutando alertas "No llegó" - ${new Date().toISOString()}`);
    await ejecutarAlertasNoLlego(anioActivo.id);
  } catch (err) {
    console.error('[CRON] Error ejecutando alertas:', err.message);
  }
}, {
  timezone: 'America/Lima'
});

// --- Cron: Notificaciones personalizadas programadas — 8:00 AM Lima ---
cron.schedule('0 8 * * *', async () => {
  try {
    console.log(`[CRON] Ejecutando notificaciones programadas - ${new Date().toISOString()}`);
    await ejecutarProgramadas();
  } catch (err) {
    console.error('[CRON] Error ejecutando notificaciones programadas:', err.message);
  }
}, {
  timezone: 'America/Lima'
});

// --- Cron: Backup de BD a Wasabi — todos los dias a las 2:00 AM Lima ---
cron.schedule('0 2 * * *', async () => {
  try {
    console.log(`[CRON] Ejecutando backup de BD - ${new Date().toISOString()}`);
    await ejecutarBackup();
  } catch (err) {
    console.error('[CRON] Error ejecutando backup:', err.message);
  }
}, {
  timezone: 'America/Lima'
});

// --- Inicio del servidor con Socket.IO ---
const server = http.createServer(app);
initSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  // Banner de inicio — muestra claramente en qué entorno estamos
  console.log('='.repeat(55));
  if (isProduction) {
    console.log('  ENTORNO: PRODUCCIÓN (Railway)');
  } else {
    console.log('  ENTORNO: DESARROLLO LOCAL');
    console.log('  Base de datos: PostgreSQL LOCAL (db_colegio_fernando)');
  }
  console.log(`  Puerto: ${PORT}`);
  console.log(`  Timezone del proceso: ${process.env.TZ || 'no definido'}`);
  console.log(`  CORS origen: ${corsOptions.origin === '*' ? '* (cualquier origen — modo local)' : corsOptions.origin}`);
  console.log('='.repeat(55));
});
