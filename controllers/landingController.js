const prisma = require('../config/prisma');

const obtenerDatosLanding = async (req, res) => {
  try {
    const colegio = await prisma.tbl_colegio.findFirst({
      select: {
        nombre: true,
        lema: true,
        descripcion: true,
        direccion: true,
        email: true,
        telefono: true,
        telefono_whatsapp: true,
      },
    });
    if (!colegio) return res.status(404).json({ error: 'Colegio no configurado' });
    res.json({ data: colegio });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener datos del landing' });
  }
};

module.exports = { obtenerDatosLanding };
