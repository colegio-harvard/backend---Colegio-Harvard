const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('./prisma');

let io = null;

// --- CORS para Socket.IO según entorno ---
// LOCAL: permite cualquier origen para desarrollo sin restricciones
// RAILWAY: restringe al origen definido en CORS_ORIGIN (dashboard de Railway)
const isProduction = process.env.NODE_ENV === 'production';
const socketCorsOrigin = isProduction && process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : '*'; // <-- En desarrollo local permite todo

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: socketCorsOrigin, credentials: true },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Optimizacion de memoria: liberar referencia HTTP inicial
  io.engine.on('connection', (rawSocket) => {
    rawSocket.request = null;
  });

  // Middleware de autenticacion JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('auth_error'));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.user = payload;
      next();
    } catch (err) {
      next(new Error('auth_error'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.data.user;
    console.log(`[Socket.IO] Conectado: usuario ${user.id} (${user.rol_codigo})`);

    // Todos los usuarios se unen a su room personal
    socket.join(`user:${user.id}`);

    // Tutores se unen a las rooms de sus aulas
    if (user.rol_codigo === 'TUTOR') {
      try {
        const asignaciones = await prisma.tbl_asignaciones_tutor.findMany({
          where: { id_usuario_tutor: user.id },
          select: { id_aula: true },
        });
        for (const asig of asignaciones) {
          socket.join(`aula:${asig.id_aula}`);
          console.log(`[Socket.IO] Tutor ${user.id} unido a aula:${asig.id_aula}`);
        }
      } catch (err) {
        console.error('[Socket.IO] Error al obtener aulas del tutor:', err.message);
      }
    }

    // Rooms dinámicos para hilos de mensajes
    socket.on('join:hilo', (id_hilo) => {
      if (id_hilo) socket.join(`hilo:${id_hilo}`);
    });

    socket.on('leave:hilo', (id_hilo) => {
      if (id_hilo) socket.leave(`hilo:${id_hilo}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Desconectado: usuario ${user.id} (${reason})`);
    });
  });

  console.log('[Socket.IO] Inicializado correctamente');
  return io;
};

const getIO = () => io;

module.exports = { initSocket, getIO };
