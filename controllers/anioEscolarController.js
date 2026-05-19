const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');

// FLW-22: Migrar alumnos al nuevo ano escolar
const migrar = async (req, res) => {
  const { id_anio_nuevo, migraciones } = req.body;
  // migraciones: [{ id_alumno, accion: 'PASA' | 'REPITENTE' | 'RETIRADO', id_aula_destino }]

  if (!id_anio_nuevo || !migraciones || migraciones.length === 0) {
    return res.status(400).json({ error: 'Ano nuevo y migraciones son obligatorios' });
  }

  try {
    const anioNuevo = await prisma.tbl_anios_escolares.findUnique({ where: { id: id_anio_nuevo } });
    if (!anioNuevo) return res.status(404).json({ error: 'Ano escolar destino no encontrado' });

    let migrados = 0;
    let retirados = 0;
    let repitentes = 0;

    for (const m of migraciones) {
      const alumno = await prisma.tbl_alumnos.findUnique({ where: { id: m.id_alumno } });
      if (!alumno) continue;

      if (m.accion === 'RETIRADO') {
        await prisma.tbl_alumnos.update({ where: { id: m.id_alumno }, data: { estado: 'RETIRADO', user_id_modification: req.user.id, date_time_modification: new Date() } });
        retirados++;
      } else if (m.accion === 'PASA' && m.id_aula_destino) {
        await prisma.tbl_alumnos.update({ where: { id: m.id_alumno }, data: { id_aula: m.id_aula_destino, user_id_modification: req.user.id, date_time_modification: new Date() } });
        migrados++;
      } else if (m.accion === 'REPITENTE' && m.id_aula_destino) {
        await prisma.tbl_alumnos.update({ where: { id: m.id_alumno }, data: { id_aula: m.id_aula_destino, user_id_modification: req.user.id, date_time_modification: new Date() } });
        repitentes++;
      }
    }

    await registrarAuditoria({
      userId: req.user.id, accion: 'MIGRACION_ANIO_ESCOLAR', tipoEntidad: 'tbl_anios_escolares', idEntidad: id_anio_nuevo,
      resumen: `Migracion: ${migrados} promovidos, ${repitentes} repitentes, ${retirados} retirados`,
      meta: { id_anio_nuevo, migrados, repitentes, retirados },
    });

    res.json({ mensaje: 'Migracion completada', migrados, repitentes, retirados });
  } catch (error) {
    console.error('Error en migracion:', error);
    res.status(500).json({ error: 'Error al migrar alumnos' });
  }
};

// Clonar estructura de aulas para nuevo ano
const clonarAulas = async (req, res) => {
  const { id_anio_origen, id_anio_destino } = req.body;

  try {
    const aulasOrigen = await prisma.tbl_aulas.findMany({ where: { id_anio_escolar: id_anio_origen } });

    for (const aula of aulasOrigen) {
      const existe = await prisma.tbl_aulas.findFirst({
        where: { id_anio_escolar: id_anio_destino, id_grado: aula.id_grado, seccion: aula.seccion },
      });
      if (!existe) {
        await prisma.tbl_aulas.create({
          data: {
            id_anio_escolar: id_anio_destino, id_grado: aula.id_grado, seccion: aula.seccion,
            user_id_registration: req.user.id,
          },
        });
      }
    }

    // Clonar horarios por nivel
    const horariosOrigen = await prisma.tbl_horarios_nivel.findMany({ where: { id_anio_escolar: id_anio_origen } });
    for (const horario of horariosOrigen) {
      const existeH = await prisma.tbl_horarios_nivel.findUnique({
        where: { id_nivel_id_anio_escolar: { id_nivel: horario.id_nivel, id_anio_escolar: id_anio_destino } },
      });
      if (!existeH) {
        await prisma.tbl_horarios_nivel.create({
          data: {
            id_nivel: horario.id_nivel, id_anio_escolar: id_anio_destino,
            hora_inicio: horario.hora_inicio, tolerancia_tardanza_min: horario.tolerancia_tardanza_min,
            hora_limite_no_ingreso: horario.hora_limite_no_ingreso, user_id_registration: req.user.id,
          },
        });
      }
    }

    await registrarAuditoria({ userId: req.user.id, accion: 'CLONAR_AULAS', tipoEntidad: 'tbl_aulas', resumen: `Aulas y horarios clonados de ano ${id_anio_origen} a ${id_anio_destino}` });
    res.json({ mensaje: 'Aulas y horarios clonados' });
  } catch (error) { res.status(500).json({ error: 'Error al clonar aulas' }); }
};

module.exports = { migrar, clonarAulas };
