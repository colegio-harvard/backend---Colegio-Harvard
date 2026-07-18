const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');

const esSuper = req => req.user.rol_codigo === 'SUPER_ADMIN';
const notaValida = value => ['AD', 'A', 'B', 'C'].includes(String(value || '').toUpperCase());
const notaNumericaValida = value => value !== '' && value !== null && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 20;
const letraDesdeNumero = value => Number(value) >= 16 ? 'AD' : Number(value) >= 11 ? 'A' : Number(value) >= 6 ? 'B' : 'C';
const FRASE_INSTITUCIONAL_DEFAULT = '24 años formando generaciones, más de 2800 estudiantes y miles de historias que nos inspiran a seguir creciendo juntos.';

const anioActivo = () => prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });

const asegurarPeriodos = async (idAnio, userId) => {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "tbl_periodos_academicos" ("id_anio_escolar","numero","nombre","modificado_por")
    SELECT $1, n, CONCAT('Bimestre ', n), $2 FROM generate_series(1,4) n
    ON CONFLICT ("id_anio_escolar","numero") DO NOTHING`, idAnio, userId);
};

const obtenerAsignacion = async (id, req) => {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT aa.*, c.nombre curso, ar.nombre area, a.seccion, g.nombre grado,n.nombre nivel
    FROM "tbl_asignaciones_academicas" aa
    JOIN "tbl_cursos_academicos" c ON c.id=aa.id_curso
    JOIN "tbl_areas_academicas" ar ON ar.id=c.id_area
    JOIN "tbl_aulas" a ON a.id=aa.id_aula JOIN "tbl_grados" g ON g.id=a.id_grado JOIN "tbl_niveles" n ON n.id=g.id_nivel
    WHERE aa.id=$1 AND aa.activo=TRUE`, Number(id));
  const item = rows[0];
  if (!item) return null;
  if (!esSuper(req) && Number(item.id_docente) !== Number(req.user.id)) return null;
  return item;
};

const bootstrap = async (req, res) => {
  try {
    const anio = await anioActivo();
    if (!anio) return res.status(400).json({ error: 'No hay año escolar activo' });
    await asegurarPeriodos(anio.id, req.user.id);
    const filtroDocente = esSuper(req) ? '' : 'AND aa.id_docente=$2';
    const params = esSuper(req) ? [anio.id] : [anio.id, req.user.id];
    const [areas, cursos, periodos, catalogo, criterios, criteriosPadre, asignaciones] = await Promise.all([
      prisma.$queryRawUnsafe('SELECT * FROM "tbl_areas_academicas" WHERE activo=TRUE ORDER BY orden,nombre'),
      prisma.$queryRawUnsafe(`SELECT c.*, a.nombre area FROM "tbl_cursos_academicos" c JOIN "tbl_areas_academicas" a ON a.id=c.id_area WHERE c.activo=TRUE AND a.activo=TRUE ORDER BY a.orden,c.orden,c.nombre`),
      prisma.$queryRawUnsafe('SELECT * FROM "tbl_periodos_academicos" WHERE id_anio_escolar=$1 ORDER BY numero', anio.id),
      prisma.$queryRawUnsafe('SELECT * FROM "tbl_catalogo_libreta" WHERE activo=TRUE ORDER BY tipo,categoria,orden,texto'),
      prisma.$queryRawUnsafe('SELECT * FROM "tbl_criterios_conducta" WHERE activo=TRUE ORDER BY orden,nombre'),
      prisma.$queryRawUnsafe('SELECT * FROM "tbl_criterios_padre" WHERE activo=TRUE ORDER BY orden,nombre'),
      prisma.$queryRawUnsafe(`SELECT aa.id,aa.id_aula,aa.id_curso,aa.id_docente,c.nombre curso,ar.nombre area,
        g.nombre grado,a.seccion,n.nombre nivel,u.nombres docente
        FROM "tbl_asignaciones_academicas" aa JOIN "tbl_cursos_academicos" c ON c.id=aa.id_curso
        JOIN "tbl_areas_academicas" ar ON ar.id=c.id_area JOIN "tbl_aulas" a ON a.id=aa.id_aula
        JOIN "tbl_grados" g ON g.id=a.id_grado JOIN "tbl_niveles" n ON n.id=g.id_nivel JOIN "tbl_usuarios" u ON u.id=aa.id_docente
        WHERE aa.id_anio_escolar=$1 AND aa.activo=TRUE AND c.activo=TRUE AND ar.activo=TRUE ${filtroDocente}
        ORDER BY g.orden,a.seccion,ar.orden,c.orden`, ...params),
    ]);
    let aulas = [], docentes = [];
    if (esSuper(req)) {
      aulas = await prisma.$queryRawUnsafe(`SELECT a.id,g.nombre grado,a.seccion,n.nombre nivel FROM "tbl_aulas" a
        JOIN "tbl_grados" g ON g.id=a.id_grado JOIN "tbl_niveles" n ON n.id=g.id_nivel
        WHERE a.id_anio_escolar=$1 ORDER BY n.nombre,g.orden,a.seccion`, anio.id);
      docentes = await prisma.$queryRawUnsafe(`SELECT u.id,u.nombres,r.codigo rol FROM "tbl_usuarios" u JOIN "tbl_roles" r ON r.id=u.id_rol
        WHERE u.estado='ACTIVO' AND r.codigo IN ('TUTOR','DOCENTE') ORDER BY u.nombres`);
    }
    const configuracion = (await prisma.$queryRawUnsafe('SELECT frase_institucional FROM "tbl_configuracion_libreta" WHERE id_anio_escolar=$1', anio.id))[0];
    res.json({ data: { anio, rol: req.user.rol_codigo, fraseInstitucional: configuracion?.frase_institucional || FRASE_INSTITUCIONAL_DEFAULT, areas, cursos, periodos, catalogo, criterios, criteriosPadre, asignaciones, aulas, docentes } });
  } catch (error) {
    console.error('Error bootstrap libretas:', error);
    res.status(500).json({ error: 'No se pudo cargar el módulo de libretas' });
  }
};

const crearArea = async (req, res) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    if (!nombre) return res.status(400).json({ error: 'Ingrese el nombre del área' });
    const repetida = await prisma.$queryRawUnsafe(`SELECT id,activo FROM "tbl_areas_academicas" WHERE LOWER(TRIM(nombre))=LOWER(TRIM($1)) LIMIT 1`, nombre);
    if (repetida[0]?.activo) return res.status(409).json({ error: 'Esta área ya existe' });
    if (repetida[0]) {
      const rows = await prisma.$queryRawUnsafe(`UPDATE "tbl_areas_academicas" SET nombre=$1,activo=TRUE,orden=$2 WHERE id=$3 RETURNING *`, nombre, Number(req.body.orden || 0), repetida[0].id);
      return res.json({ data: rows[0] });
    }
    const rows = await prisma.$queryRawUnsafe(`INSERT INTO "tbl_areas_academicas" (nombre,orden,creado_por)
      VALUES ($1,$2,$3) ON CONFLICT (nombre) DO UPDATE SET activo=TRUE,orden=EXCLUDED.orden RETURNING *`, nombre, Number(req.body.orden || 0), req.user.id);
    res.status(201).json({ data: rows[0] });
  } catch { res.status(500).json({ error: 'No se pudo guardar el área' }); }
};

const crearCurso = async (req, res) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const nivel = String(req.body.nivel || 'INICIAL').toUpperCase();
    const idArea = Number(req.body.id_area);
    if (!nombre || !idArea) return res.status(400).json({ error: 'Área y curso son obligatorios' });
    const repetido = await prisma.$queryRawUnsafe(`SELECT id,activo FROM "tbl_cursos_academicos" WHERE id_area=$1 AND LOWER(TRIM(nombre))=LOWER(TRIM($2)) AND nivel=$3 LIMIT 1`, idArea, nombre, nivel);
    if (repetido[0]?.activo) return res.status(409).json({ error: 'Este curso ya existe dentro del área seleccionada' });
    if (repetido[0]) {
      const rows = await prisma.$queryRawUnsafe(`UPDATE "tbl_cursos_academicos" SET nombre=$1,activo=TRUE,orden=$2 WHERE id=$3 RETURNING *`, nombre, Number(req.body.orden || 0), repetido[0].id);
      return res.json({ data: rows[0] });
    }
    const rows = await prisma.$queryRawUnsafe(`INSERT INTO "tbl_cursos_academicos" (id_area,nombre,nivel,orden,creado_por)
      VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id_area,nombre,nivel) DO UPDATE SET activo=TRUE,orden=EXCLUDED.orden RETURNING *`, idArea, nombre, nivel, Number(req.body.orden || 0), req.user.id);
    res.status(201).json({ data: rows[0] });
  } catch { res.status(500).json({ error: 'No se pudo guardar el curso' }); }
};

const actualizarArea = async (req, res) => {
  try {
    const id = Number(req.params.id), nombre = String(req.body.nombre || '').trim();
    if (!id || !nombre) return res.status(400).json({ error: 'Ingrese el nombre del área' });
    const repetida = await prisma.$queryRawUnsafe(`SELECT id FROM "tbl_areas_academicas" WHERE id<>$1 AND activo=TRUE AND LOWER(TRIM(nombre))=LOWER(TRIM($2)) LIMIT 1`, id, nombre);
    if (repetida[0]) return res.status(409).json({ error: 'Ya existe otra área con ese nombre' });
    const rows = await prisma.$queryRawUnsafe(`UPDATE "tbl_areas_academicas" SET nombre=$1,orden=$2 WHERE id=$3 RETURNING *`, nombre, Number(req.body.orden || 0), id);
    if (!rows[0]) return res.status(404).json({ error: 'Área no encontrada' });
    res.json({ data: rows[0] });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo editar el área' }); }
};

const eliminarArea = async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`UPDATE "tbl_areas_academicas" SET activo=FALSE WHERE id=$1`, id);
      await tx.$executeRawUnsafe(`UPDATE "tbl_cursos_academicos" SET activo=FALSE WHERE id_area=$1`, id);
    });
    await registrarAuditoria({ userId:req.user.id, accion:'DESACTIVAR_AREA_ACADEMICA', tipoEntidad:'tbl_areas_academicas', idEntidad:id, resumen:'Área académica desactivada; se conserva su historial', req });
    res.json({ mensaje: 'Área retirada de la configuración. Su historial se conserva.' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo retirar el área' }); }
};

const actualizarCurso = async (req, res) => {
  try {
    const id = Number(req.params.id), nombre = String(req.body.nombre || '').trim(), idArea = Number(req.body.id_area);
    if (!id || !nombre || !idArea) return res.status(400).json({ error: 'Área y curso son obligatorios' });
    const repetido = await prisma.$queryRawUnsafe(`SELECT id FROM "tbl_cursos_academicos" WHERE id<>$1 AND id_area=$2 AND activo=TRUE AND LOWER(TRIM(nombre))=LOWER(TRIM($3)) LIMIT 1`, id, idArea, nombre);
    if (repetido[0]) return res.status(409).json({ error: 'Ya existe otro curso con ese nombre dentro del área' });
    const rows = await prisma.$queryRawUnsafe(`UPDATE "tbl_cursos_academicos" SET nombre=$1,id_area=$2,orden=$3 WHERE id=$4 RETURNING *`, nombre, idArea, Number(req.body.orden || 0), id);
    if (!rows[0]) return res.status(404).json({ error: 'Curso no encontrado' });
    res.json({ data: rows[0] });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo editar el curso' }); }
};

const eliminarCurso = async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.$executeRawUnsafe(`UPDATE "tbl_cursos_academicos" SET activo=FALSE WHERE id=$1`, id);
    await registrarAuditoria({ userId:req.user.id, accion:'DESACTIVAR_CURSO_ACADEMICO', tipoEntidad:'tbl_cursos_academicos', idEntidad:id, resumen:'Curso académico desactivado; se conserva su historial', req });
    res.json({ mensaje: 'Curso retirado de la configuración. Sus notas históricas se conservan.' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo retirar el curso' }); }
};

const asignarCurso = async (req, res) => {
  try {
    const anio = await anioActivo();
    const { id_aula, id_docente } = req.body;
    const seleccion = Array.isArray(req.body.id_cursos) && req.body.id_cursos.length ? req.body.id_cursos : [req.body.id_curso];
    const idsCursos = [...new Set(seleccion.map(Number).filter(Boolean))];
    if (!anio || !id_aula || !idsCursos.length || !id_docente) return res.status(400).json({ error: 'Complete aula, uno o más cursos y docente' });
    const cursosValidos = await prisma.$queryRawUnsafe(`SELECT id FROM "tbl_cursos_academicos" WHERE activo=TRUE AND id=ANY($1::int[])`, idsCursos);
    if (cursosValidos.length !== idsCursos.length) return res.status(400).json({ error: 'Uno de los cursos seleccionados ya no está activo' });
    const rows = await prisma.$transaction(async tx => {
      const guardadas = [];
      for (const idCurso of idsCursos) {
        const result = await tx.$queryRawUnsafe(`INSERT INTO "tbl_asignaciones_academicas"
          (id_anio_escolar,id_aula,id_curso,id_docente,creado_por) VALUES ($1,$2,$3,$4,$5)
          ON CONFLICT (id_anio_escolar,id_aula,id_curso) DO UPDATE SET id_docente=EXCLUDED.id_docente,activo=TRUE
          RETURNING *`, anio.id, Number(id_aula), idCurso, Number(id_docente), req.user.id);
        guardadas.push(result[0]);
      }
      return guardadas;
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'ASIGNAR_CURSOS_DOCENTE', tipoEntidad: 'tbl_asignaciones_academicas', idEntidad: rows[0]?.id, resumen: `${idsCursos.length} curso(s) asignado(s) al docente ${id_docente} en el aula ${id_aula}`, req });
    res.json({ data: rows, mensaje: `${rows.length} curso(s) asignado(s) correctamente` });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo guardar la asignación' }); }
};

const cambiarPeriodo = async (req, res) => {
  try {
    const estado = String(req.body.estado || '');
    if (!['ABIERTO','REVISION','CERRADO'].includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
    await prisma.$executeRawUnsafe(`UPDATE "tbl_periodos_academicos" SET estado=$1,modificado_por=$2,modificado_en=NOW() WHERE id=$3`, estado, req.user.id, Number(req.params.id));
    await registrarAuditoria({ userId: req.user.id, accion: 'CAMBIAR_ESTADO_BIMESTRE', tipoEntidad: 'tbl_periodos_academicos', idEntidad: Number(req.params.id), resumen: `Bimestre cambiado a ${estado}` });
    res.json({ mensaje: 'Periodo actualizado' });
  } catch { res.status(500).json({ error: 'No se pudo actualizar el periodo' }); }
};

const obtenerNotas = async (req, res) => {
  try {
    const asignacion = await obtenerAsignacion(req.query.id_asignacion, req);
    if (!asignacion) return res.status(403).json({ error: 'No tiene acceso a esta asignación' });
    const periodo = await prisma.$queryRawUnsafe('SELECT * FROM "tbl_periodos_academicos" WHERE id=$1', Number(req.query.id_periodo));
    if (!periodo[0] || Number(periodo[0].id_anio_escolar) !== Number(asignacion.id_anio_escolar)) return res.status(400).json({ error: 'Periodo inválido' });
    const filtroAutor = esSuper(req) ? '' : `AND (n.creado_por=$3 OR n.creado_por IS NULL OR EXISTS (
      SELECT 1 FROM "tbl_usuarios" creador
      JOIN "tbl_roles" rol_creador ON rol_creador.id=creador.id_rol
      WHERE creador.id=n.creado_por AND rol_creador.codigo='SUPER_ADMIN'
    ))`;
    const params = esSuper(req) ? [asignacion.id_aula, Number(req.query.id_periodo)] : [asignacion.id_aula, Number(req.query.id_periodo), req.user.id];
    const alumnos = await prisma.$queryRawUnsafe(`SELECT al.id,al.codigo_alumno,al.nombre_completo,al.foto_url,
      n.id id_nota,n.calificacion,n.nota_numerica,n.creado_por,n.modificado_por,n.modificado_en
      FROM "tbl_alumnos" al LEFT JOIN "tbl_notas_academicas" n ON n.id_alumno=al.id
        AND n.id_asignacion=${Number(asignacion.id)} AND n.id_periodo=$2 ${filtroAutor}
      WHERE al.id_aula=$1 AND al.estado='ACTIVO' ORDER BY al.nombre_completo`, ...params);
    res.json({ data: { asignacion, periodo: periodo[0], alumnos } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudieron cargar las notas' }); }
};

const guardarNotas = async (req, res) => {
  try {
    const idAsignacion = Number(req.body.id_asignacion);
    const idPeriodo = Number(req.body.id_periodo);
    const asignacion = await obtenerAsignacion(idAsignacion, req);
    if (!asignacion) return res.status(403).json({ error: 'No tiene acceso a esta asignación' });
    const periodo = (await prisma.$queryRawUnsafe('SELECT * FROM "tbl_periodos_academicos" WHERE id=$1', idPeriodo))[0];
    if (!periodo) return res.status(400).json({ error: 'Periodo inválido' });
    if (!esSuper(req) && periodo.estado !== 'ABIERTO') return res.status(409).json({ error: 'El bimestre no está abierto' });
    const notas = Array.isArray(req.body.notas) ? req.body.notas : [];
    const nivelAsignacion = String(asignacion.nivel || '').toUpperCase();
    const esNumerica = nivelAsignacion.includes('PRIMARIA') || nivelAsignacion.includes('SECUNDARIA');
    if (esNumerica && notas.some(n => !notaNumericaValida(n.nota_numerica))) return res.status(400).json({ error: 'Las notas numéricas deben estar entre 00 y 20' });
    if (!esNumerica && notas.some(n => !notaValida(n.calificacion))) return res.status(400).json({ error: 'Todas las calificaciones deben ser AD, A, B o C' });
    await prisma.$transaction(async tx => {
      for (const item of notas) {
        const notaNumerica = esNumerica ? Number(item.nota_numerica) : null;
        const calificacion = esNumerica ? letraDesdeNumero(notaNumerica) : String(item.calificacion).toUpperCase();
        const alumno = await tx.$queryRawUnsafe('SELECT id FROM "tbl_alumnos" WHERE id=$1 AND id_aula=$2', Number(item.id_alumno), Number(asignacion.id_aula));
        if (!alumno[0]) throw new Error('ALUMNO_NO_AUTORIZADO');
        const anterior = await tx.$queryRawUnsafe(`SELECT n.*,r.codigo rol_creador
          FROM "tbl_notas_academicas" n
          LEFT JOIN "tbl_usuarios" u ON u.id=n.creado_por
          LEFT JOIN "tbl_roles" r ON r.id=u.id_rol
          WHERE n.id_asignacion=$1 AND n.id_periodo=$2 AND n.id_alumno=$3`, idAsignacion, idPeriodo, Number(item.id_alumno));
        const puedeEditarNota = !anterior[0] || esSuper(req) || anterior[0].creado_por == null ||
          Number(anterior[0].creado_por) === Number(req.user.id) || anterior[0].rol_creador === 'SUPER_ADMIN';
        if (!puedeEditarNota) throw new Error('NOTA_AJENA');
        const modificada = anterior[0] && (anterior[0].calificacion !== calificacion || Number(anterior[0].nota_numerica ?? -1) !== Number(notaNumerica ?? -1));
        if (modificada && esSuper(req) && !String(req.body.motivo || '').trim()) throw new Error('MOTIVO_REQUERIDO');
        const rows = await tx.$queryRawUnsafe(`INSERT INTO "tbl_notas_academicas"
          (id_asignacion,id_periodo,id_alumno,calificacion,nota_numerica,creado_por) VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (id_asignacion,id_periodo,id_alumno) DO UPDATE SET calificacion=EXCLUDED.calificacion,nota_numerica=EXCLUDED.nota_numerica,
          modificado_por=$6,modificado_en=NOW() RETURNING *`, idAsignacion, idPeriodo, Number(item.id_alumno), calificacion, notaNumerica, req.user.id);
        if (!anterior[0] || modificada) {
          await tx.$executeRawUnsafe(`INSERT INTO "tbl_auditoria_notas" (id_nota,calificacion_anterior,calificacion_nueva,nota_numerica_anterior,nota_numerica_nueva,motivo,id_usuario)
            VALUES ($1,$2,$3,$4,$5,$6,$7)`, rows[0].id, anterior[0]?.calificacion || null, calificacion, anterior[0]?.nota_numerica ?? null, notaNumerica, String(req.body.motivo || '').trim() || null, req.user.id);
        }
      }
    });
    res.json({ mensaje: 'Notas guardadas correctamente' });
  } catch (error) {
    if (error.message === 'MOTIVO_REQUERIDO') return res.status(400).json({ error: 'El Superadministrador debe indicar el motivo de la modificación' });
    if (['ALUMNO_NO_AUTORIZADO','NOTA_AJENA'].includes(error.message)) return res.status(403).json({ error: 'No puede modificar esta nota' });
    console.error(error); res.status(500).json({ error: 'No se pudieron guardar las notas' });
  }
};

const guardarAcompanamiento = async (req, res) => {
  try {
    const { id_alumno, id_periodo, conducta = [], nota_padre = [], observaciones = [] } = req.body;
    const aulaTutor = await prisma.$queryRawUnsafe(`SELECT al.id_aula FROM "tbl_alumnos" al
      JOIN "tbl_asignaciones_tutor" t ON t.id_aula=al.id_aula WHERE al.id=$1 AND t.id_usuario_tutor=$2`, Number(id_alumno), req.user.id);
    if (!esSuper(req) && !aulaTutor[0]) return res.status(403).json({ error: 'Solo el tutor del aula puede registrar este apartado' });
    const periodo = (await prisma.$queryRawUnsafe('SELECT * FROM "tbl_periodos_academicos" WHERE id=$1', Number(id_periodo)))[0];
    if (!periodo || (!esSuper(req) && periodo.estado !== 'ABIERTO')) return res.status(409).json({ error: 'El bimestre no está abierto' });
    await prisma.$transaction(async tx => {
      for (const c of conducta) if (notaValida(c.calificacion)) await tx.$executeRawUnsafe(`INSERT INTO "tbl_notas_conducta"
        (id_alumno,id_periodo,id_criterio,calificacion,creado_por) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id_alumno,id_periodo,id_criterio) DO UPDATE SET calificacion=EXCLUDED.calificacion,creado_por=$5,modificado_en=NOW()`, Number(id_alumno), Number(id_periodo), Number(c.id_criterio), c.calificacion, req.user.id);
      for (const c of nota_padre) if (notaValida(c.calificacion)) await tx.$executeRawUnsafe(`INSERT INTO "tbl_notas_padre"
        (id_alumno,id_periodo,id_criterio,calificacion,creado_por) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id_alumno,id_periodo,id_criterio) DO UPDATE SET calificacion=EXCLUDED.calificacion,creado_por=$5,modificado_en=NOW()`, Number(id_alumno), Number(id_periodo), Number(c.id_criterio), c.calificacion, req.user.id);
      for (const o of observaciones) await tx.$executeRawUnsafe(`INSERT INTO "tbl_observaciones_libreta"
        (id_alumno,id_periodo,tipo,id_catalogo,creado_por) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id_alumno,id_periodo,tipo,creado_por) DO UPDATE SET id_catalogo=EXCLUDED.id_catalogo,creado_en=NOW()`, Number(id_alumno), Number(id_periodo), o.tipo, Number(o.id_catalogo), req.user.id);
    });
    res.json({ mensaje: 'Conducta y comentarios guardados' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo guardar el acompañamiento' }); }
};

const guardarComentarioDocente = async (req, res) => {
  try {
    const idAsignacion = Number(req.body.id_asignacion);
    const idPeriodo = Number(req.body.id_periodo);
    const idAlumno = Number(req.body.id_alumno);
    const idCatalogo = Number(req.body.id_catalogo);
    const asignacion = await obtenerAsignacion(idAsignacion, req);
    if (!asignacion) return res.status(403).json({ error: 'No tiene acceso a este curso' });
    const periodo = (await prisma.$queryRawUnsafe('SELECT * FROM "tbl_periodos_academicos" WHERE id=$1', idPeriodo))[0];
    if (!periodo || (!esSuper(req) && periodo.estado !== 'ABIERTO')) return res.status(409).json({ error: 'El bimestre no estÃ¡ abierto' });
    const alumno = await prisma.$queryRawUnsafe('SELECT id FROM "tbl_alumnos" WHERE id=$1 AND id_aula=$2', idAlumno, Number(asignacion.id_aula));
    const catalogo = await prisma.$queryRawUnsafe(`SELECT id FROM "tbl_catalogo_libreta" WHERE id=$1 AND tipo='COMENTARIO_DOCENTE' AND activo=TRUE`, idCatalogo);
    if (!alumno[0] || !catalogo[0]) return res.status(400).json({ error: 'Alumno o comentario invÃ¡lido' });
    await prisma.$executeRawUnsafe(`INSERT INTO "tbl_observaciones_libreta"
      (id_alumno,id_periodo,tipo,id_catalogo,id_asignacion,creado_por) VALUES ($1,$2,'COMENTARIO_DOCENTE',$3,$4,$5)
      ON CONFLICT (id_alumno,id_periodo,tipo,creado_por) DO UPDATE SET id_catalogo=EXCLUDED.id_catalogo,id_asignacion=EXCLUDED.id_asignacion,creado_en=NOW()`,
      idAlumno, idPeriodo, idCatalogo, idAsignacion, req.user.id);
    res.json({ mensaje: 'Comentario guardado' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo guardar el comentario' }); }
};

const guardarFraseInstitucional = async (req, res) => {
  try {
    const frase = String(req.body.frase || '').trim();
    if (!frase) return res.status(400).json({ error: 'La frase institucional es obligatoria' });
    if (frase.length > 500) return res.status(400).json({ error: 'La frase no puede superar los 500 caracteres' });
    const anio = await anioActivo();
    if (!anio) return res.status(400).json({ error: 'No hay año escolar activo' });
    await prisma.$executeRawUnsafe(`INSERT INTO "tbl_configuracion_libreta" (id_anio_escolar,frase_institucional,modificado_por)
      VALUES ($1,$2,$3) ON CONFLICT (id_anio_escolar) DO UPDATE SET frase_institucional=EXCLUDED.frase_institucional,
      modificado_por=EXCLUDED.modificado_por,modificado_en=NOW()`, anio.id, frase, req.user.id);
    res.json({ mensaje: 'Frase institucional actualizada', data: { fraseInstitucional: frase } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo actualizar la frase institucional' }); }
};

const guardarCatalogo = async (req, res) => {
  try {
    const tipo = String(req.body.tipo || '');
    const texto = String(req.body.texto || '').trim();
    if (!['COMENTARIO_DOCENTE','COMENTARIO_TUTOR','NOTA_PADRE'].includes(tipo) || !texto) return res.status(400).json({ error: 'Tipo y texto son obligatorios' });
    const rows = await prisma.$queryRawUnsafe(`INSERT INTO "tbl_catalogo_libreta" (tipo,categoria,texto,orden,creado_por)
      VALUES ($1,$2,$3,$4,$5) RETURNING *`, tipo, String(req.body.categoria || '').trim() || null, texto, Number(req.body.orden || 0), req.user.id);
    res.status(201).json({ data: rows[0] });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo guardar la opciÃ³n' }); }
};

const cambiarCatalogo = async (req, res) => {
  try {
    await prisma.$executeRawUnsafe(`UPDATE "tbl_catalogo_libreta" SET activo=$1 WHERE id=$2`, Boolean(req.body.activo), Number(req.params.id));
    res.json({ mensaje: 'CatÃ¡logo actualizado' });
  } catch { res.status(500).json({ error: 'No se pudo actualizar el catÃ¡logo' }); }
};

const auditoriaNotas = async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT au.id,au.fecha,au.calificacion_anterior,au.calificacion_nueva,au.nota_numerica_anterior,au.nota_numerica_nueva,au.motivo,
      u.nombres usuario,al.codigo_alumno,al.nombre_completo alumno,c.nombre curso,p.nombre periodo
      FROM "tbl_auditoria_notas" au JOIN "tbl_usuarios" u ON u.id=au.id_usuario
      JOIN "tbl_notas_academicas" n ON n.id=au.id_nota JOIN "tbl_alumnos" al ON al.id=n.id_alumno
      JOIN "tbl_asignaciones_academicas" aa ON aa.id=n.id_asignacion JOIN "tbl_cursos_academicos" c ON c.id=aa.id_curso
      JOIN "tbl_periodos_academicos" p ON p.id=n.id_periodo ORDER BY au.fecha DESC LIMIT 500`);
    res.json({ data: rows });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo cargar la auditorÃ­a de notas' }); }
};

const merito = async (req, res) => {
  try {
    const idAula = Number(req.query.id_aula), idPeriodo = req.query.id_periodo ? Number(req.query.id_periodo) : null;
    const filtro = idPeriodo ? 'AND n.id_periodo=$2' : '';
    const params = idPeriodo ? [idAula,idPeriodo] : [idAula];
    const anio = await anioActivo();
    if (!anio) return res.status(400).json({ error: 'No hay aÃ±o escolar activo' });
    const rows = await prisma.$queryRawUnsafe(`SELECT al.id,al.codigo_alumno,al.nombre_completo,
      ROUND(AVG(COALESCE(n.nota_numerica,CASE n.calificacion WHEN 'AD' THEN 4 WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 END))::numeric,2) puntaje,
      COUNT(n.id)::int evaluaciones
      FROM "tbl_alumnos" al LEFT JOIN "tbl_notas_academicas" n ON n.id_alumno=al.id ${filtro}
        AND EXISTS (SELECT 1 FROM "tbl_asignaciones_academicas" aa WHERE aa.id=n.id_asignacion AND aa.id_anio_escolar=${Number(anio.id)})
      WHERE al.id_aula=$1 AND al.estado='ACTIVO' GROUP BY al.id ORDER BY puntaje DESC NULLS LAST,al.nombre_completo`, ...params);
    let posicion=0, previo=null;
    const data=rows.map((r,i)=>{ const p=Number(r.puntaje||0); if(previo===null||p!==previo) posicion=i+1; previo=p; return {...r,puntaje:p,posicion}; });
    res.json({ data });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo calcular el orden de mérito' }); }
};

const libreta = async (req, res) => {
  try {
    const idAlumno=Number(req.params.id);
    const alumno=(await prisma.$queryRawUnsafe(`SELECT al.id,al.codigo_alumno,al.nombre_completo,al.foto_url,
      g.nombre grado,a.seccion,n.nombre nivel,p.celular,u.nombres tutor,ae.anio,ae.id id_anio_escolar
      FROM "tbl_alumnos" al JOIN "tbl_aulas" a ON a.id=al.id_aula JOIN "tbl_grados" g ON g.id=a.id_grado
      JOIN "tbl_niveles" n ON n.id=g.id_nivel JOIN "tbl_anios_escolares" ae ON ae.id=a.id_anio_escolar
      LEFT JOIN "tbl_padres_alumnos" pa ON pa.id_alumno=al.id LEFT JOIN "tbl_padres" p ON p.id=pa.id_padre
      LEFT JOIN "tbl_asignaciones_tutor" t ON t.id_aula=a.id LEFT JOIN "tbl_usuarios" u ON u.id=t.id_usuario_tutor WHERE al.id=$1`,idAlumno))[0];
    if(!alumno) return res.status(404).json({error:'Alumno no encontrado'});
    const nivelAlumno = String(alumno.nivel || '').toUpperCase();
    const nivelCatalogo = nivelAlumno.includes('PRIMARIA') ? 'PRIMARIA' : nivelAlumno.includes('SECUNDARIA') ? 'SECUNDARIA' : null;
    const consultaNotas = nivelCatalogo
      ? prisma.$queryRawUnsafe(`SELECT ar.nombre area,c.nombre curso,p.numero,n.calificacion,n.nota_numerica
        FROM "tbl_cursos_academicos" c JOIN "tbl_areas_academicas" ar ON ar.id=c.id_area
        LEFT JOIN "tbl_asignaciones_academicas" aa ON aa.id_curso=c.id AND aa.id_aula=(SELECT id_aula FROM "tbl_alumnos" WHERE id=$1)
          AND aa.id_anio_escolar=$2 AND aa.activo=TRUE
        LEFT JOIN "tbl_notas_academicas" n ON n.id_asignacion=aa.id AND n.id_alumno=$1
        LEFT JOIN "tbl_periodos_academicos" p ON p.id=n.id_periodo
        WHERE c.activo=TRUE AND ar.activo=TRUE AND c.nivel=$3 ORDER BY ar.orden,c.orden,p.numero`,idAlumno,Number(alumno.id_anio_escolar || 0),nivelCatalogo)
      : prisma.$queryRawUnsafe(`SELECT ar.nombre area,c.nombre curso,p.numero,n.calificacion,n.nota_numerica
        FROM "tbl_notas_academicas" n JOIN "tbl_asignaciones_academicas" aa ON aa.id=n.id_asignacion
        JOIN "tbl_cursos_academicos" c ON c.id=aa.id_curso JOIN "tbl_areas_academicas" ar ON ar.id=c.id_area
        JOIN "tbl_periodos_academicos" p ON p.id=n.id_periodo WHERE n.id_alumno=$1 AND aa.id_anio_escolar=$2 ORDER BY ar.orden,c.orden,p.numero`,idAlumno,Number(alumno.id_anio_escolar || 0));
    const [notas, conducta, notasPadre, observaciones, criterios, criteriosPadre] = await Promise.all([
      consultaNotas,
      prisma.$queryRawUnsafe(`SELECT c.nombre,p.numero,n.calificacion FROM "tbl_notas_conducta" n
      JOIN "tbl_criterios_conducta" c ON c.id=n.id_criterio JOIN "tbl_periodos_academicos" p ON p.id=n.id_periodo
      WHERE n.id_alumno=$1 ORDER BY c.orden,p.numero`,idAlumno),
      prisma.$queryRawUnsafe(`SELECT c.nombre,c.id id_criterio,p.numero,n.calificacion FROM "tbl_notas_padre" n
      JOIN "tbl_criterios_padre" c ON c.id=n.id_criterio JOIN "tbl_periodos_academicos" p ON p.id=n.id_periodo
      WHERE n.id_alumno=$1 ORDER BY c.orden,p.numero`,idAlumno),
      prisma.$queryRawUnsafe(`SELECT o.tipo,p.numero,c.texto,u.nombres autor,o.id_asignacion,curso.nombre curso FROM "tbl_observaciones_libreta" o
      JOIN "tbl_catalogo_libreta" c ON c.id=o.id_catalogo JOIN "tbl_periodos_academicos" p ON p.id=o.id_periodo
      JOIN "tbl_usuarios" u ON u.id=o.creado_por
      LEFT JOIN "tbl_asignaciones_academicas" asignacion ON asignacion.id=o.id_asignacion
      LEFT JOIN "tbl_cursos_academicos" curso ON curso.id=asignacion.id_curso
      WHERE o.id_alumno=$1 ORDER BY p.numero,o.tipo`,idAlumno),
      prisma.$queryRawUnsafe(`SELECT nombre FROM "tbl_criterios_conducta" WHERE activo=TRUE ORDER BY orden,nombre`),
      prisma.$queryRawUnsafe(`SELECT id,nombre FROM "tbl_criterios_padre" WHERE activo=TRUE ORDER BY orden,nombre`),
    ]);
    const configuracion = (await prisma.$queryRawUnsafe('SELECT frase_institucional FROM "tbl_configuracion_libreta" WHERE id_anio_escolar=$1', Number(alumno.id_anio_escolar || 0)))[0];
    res.json({data:{alumno,fraseInstitucional:configuracion?.frase_institucional || FRASE_INSTITUCIONAL_DEFAULT,notas,conducta,notasPadre,observaciones,criterios,criteriosPadre}});
  } catch(error){console.error(error);res.status(500).json({error:'No se pudo generar la libreta'});}
};

module.exports={bootstrap,crearArea,actualizarArea,eliminarArea,crearCurso,actualizarCurso,eliminarCurso,asignarCurso,cambiarPeriodo,obtenerNotas,guardarNotas,guardarComentarioDocente,guardarAcompanamiento,guardarFraseInstitucional,guardarCatalogo,cambiarCatalogo,auditoriaNotas,merito,libreta};
