const { getIO } = require('../config/socket');
const prisma = require('../config/prisma');

const emitToUser = (userId, evento, data) => {
  const io = getIO();
  if (!io) return;
  io.to(`user:${userId}`).emit(evento, data);
};

const emitToAula = (aulaId, evento, data) => {
  const io = getIO();
  if (!io) return;
  io.to(`aula:${aulaId}`).emit(evento, data);
};

const emitToHilo = (hiloId, evento, data) => {
  const io = getIO();
  if (!io) return;
  io.to(`hilo:${hiloId}`).emit(evento, data);
};

const emitNotificacion = async (userId, notifData) => {
  const io = getIO();
  if (!io) return;

  // Emitir la notificacion nueva
  io.to(`user:${userId}`).emit('notificacion:nueva', notifData);

  // Contar no leidas y emitir el conteo actualizado
  try {
    const no_leidas = await prisma.tbl_notificaciones.count({
      where: { id_usuario: userId, leida: false },
    });
    io.to(`user:${userId}`).emit('notificacion:conteo', { no_leidas });
  } catch (err) {
    console.error('[SocketEmitter] Error contando notificaciones:', err.message);
  }
};

module.exports = { emitToUser, emitToAula, emitToHilo, emitNotificacion };
