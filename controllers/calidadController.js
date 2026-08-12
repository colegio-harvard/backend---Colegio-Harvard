const prisma = require('../config/prisma');

const ejecutarConsulta = async (nombre, nivel, sql) => {
  try {
    const filas = await prisma.$queryRawUnsafe(sql);
    return { nombre, nivel, cantidad: filas.length, muestras: filas.slice(0, 20) };
  } catch (error) {
    return { nombre, nivel: 'ADVERTENCIA', cantidad: null, muestras: [], error: error.message };
  }
};

const diagnostico = async (_req, res) => {
  try {
    const controles = await Promise.all([
      ejecutarConsulta('Materiales mayores a S/ 150', 'ALTO', `
        SELECT codigo_alumno, nombre_completo, monto_materiales
        FROM "tbl_alumnos"
        WHERE estado='ACTIVO' AND monto_materiales > 150
        ORDER BY monto_materiales DESC`),
      ejecutarConsulta('Alumnos activos sin montos configurados', 'ALTO', `
        SELECT codigo_alumno, nombre_completo, monto_matricula, monto_materiales, monto_pension
        FROM "tbl_alumnos"
        WHERE estado='ACTIVO'
          AND (monto_matricula IS NULL OR monto_materiales IS NULL OR monto_pension IS NULL)
        ORDER BY codigo_alumno`),
      ejecutarConsulta('Deudas abiertas con saldo negativo o excedido', 'ALTO', `
        SELECT a.codigo_alumno, ep.clave_mes, ep.estado, ep.monto_total, ep.monto_pagado
        FROM "tbl_estado_pension" ep
        JOIN "tbl_alumnos" a ON a.id=ep.id_alumno
        WHERE ep.estado IN ('PENDIENTE','PAGO_PARCIAL')
          AND (COALESCE(ep.monto_total,0) < 0 OR COALESCE(ep.monto_pagado,0) < 0
            OR COALESCE(ep.monto_pagado,0) > COALESCE(ep.monto_total,0))
        ORDER BY a.codigo_alumno, ep.clave_mes`),
      ejecutarConsulta('Pagos negativos o sin estado asociado', 'ALTO', `
        SELECT p.id, p.id_estado_pension, p.monto, p.fecha_pago
        FROM "tbl_pagos_pension" p
        LEFT JOIN "tbl_estado_pension" ep ON ep.id=p.id_estado_pension
        WHERE p.monto < 0 OR ep.id IS NULL
        ORDER BY p.id DESC`),
      ejecutarConsulta('Marcaciones repetidas en menos de 5 segundos', 'MEDIO', `
        WITH eventos AS (
          SELECT id, id_alumno, fecha_evento, fecha_hora_evento,
            LAG(fecha_hora_evento) OVER (
              PARTITION BY id_alumno, fecha_evento ORDER BY fecha_hora_evento
            ) AS anterior
          FROM "tbl_eventos_asistencia"
        )
        SELECT a.codigo_alumno, e.fecha_evento, e.anterior, e.fecha_hora_evento
        FROM eventos e JOIN "tbl_alumnos" a ON a.id=e.id_alumno
        WHERE e.anterior IS NOT NULL
          AND EXTRACT(EPOCH FROM (e.fecha_hora_evento-e.anterior)) BETWEEN 0 AND 4.999
        ORDER BY e.fecha_evento DESC, e.fecha_hora_evento DESC`),
      ejecutarConsulta('Notas sin responsable identificable', 'ALTO', `
        SELECT n.id, a.codigo_alumno, n.id_asignacion, n.id_periodo
        FROM "tbl_notas_academicas" n
        JOIN "tbl_alumnos" a ON a.id=n.id_alumno
        LEFT JOIN "tbl_usuarios" u ON u.id=COALESCE(n.modificado_por,n.creado_por)
        WHERE u.id IS NULL
        ORDER BY n.id DESC`),
      ejecutarConsulta('Comentarios académicos duplicados', 'MEDIO', `
        SELECT a.codigo_alumno, o.id_periodo, o.tipo, o.id_asignacion, COUNT(*)::int cantidad
        FROM "tbl_observaciones_libreta" o
        JOIN "tbl_alumnos" a ON a.id=o.id_alumno
        GROUP BY a.codigo_alumno, o.id_periodo, o.tipo, o.id_asignacion
        HAVING COUNT(*) > 1
        ORDER BY cantidad DESC`),
      ejecutarConsulta('Alumnos retirados sin fecha o último cobro', 'MEDIO', `
        SELECT codigo_alumno, nombre_completo, fecha_retiro, ultima_clave_cobro
        FROM "tbl_alumnos"
        WHERE estado='RETIRADO' AND (fecha_retiro IS NULL OR ultima_clave_cobro IS NULL)
        ORDER BY codigo_alumno`),
    ]);

    const totalHallazgos = controles.reduce((total, control) => total + (control.cantidad || 0), 0);
    const controlesConError = controles.filter((control) => control.error).length;
    res.json({
      data: {
        generado_en: new Date().toISOString(),
        estado: controlesConError ? 'INCOMPLETO' : totalHallazgos ? 'REVISAR' : 'SALUDABLE',
        total_hallazgos: totalHallazgos,
        controles_con_error: controlesConError,
        controles,
      },
    });
  } catch (error) {
    console.error('Error en diagnóstico de calidad:', error);
    res.status(500).json({ error: 'No se pudo ejecutar el diagnóstico de calidad' });
  }
};

module.exports = { diagnostico };
