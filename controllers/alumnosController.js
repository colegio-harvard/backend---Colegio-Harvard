const prisma = require('../config/prisma');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const path = require('path');
const XLSX = require('xlsx');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { validarContrasena } = require('../utils/validaciones');
const { uploadFile } = require('../utils/storageService');

const parseMonto = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
};

const extraerNumeroCodigoAlumno = (codigo) => {
  const match = /^H(\d+)$/i.exec(String(codigo || '').trim());
  return match ? parseInt(match[1], 10) : null;
};

const calcularSiguienteCodigoAlumno = async (tx = prisma) => {
  const alumnos = await tx.tbl_alumnos.findMany({
    where: {
      estado: { not: 'DELETED' },
      codigo_alumno: { startsWith: 'H', mode: 'insensitive' },
    },
    select: { codigo_alumno: true },
  });

  const usados = new Set(
    alumnos
      .map(a => extraerNumeroCodigoAlumno(a.codigo_alumno))
      .filter(n => Number.isInteger(n) && n > 0)
  );

  let siguiente = 1;
  while (usados.has(siguiente)) siguiente += 1;
  return `H${String(siguiente).padStart(3, '0')}`;
};

const listar = async (req, res) => {
  const { id_aula, estado } = req.query;
  try {
    const where = {};
    if (id_aula) where.id_aula = parseInt(id_aula);
    if (estado) where.estado = estado;
    else where.estado = { not: 'DELETED' };

    const alumnos = await prisma.tbl_alumnos.findMany({
      where,
      include: {
        tbl_aulas: { include: { tbl_grados: { include: { tbl_niveles: { select: { nombre: true } } } } } },
        tbl_padres_alumnos: { include: { tbl_padres: { select: { id: true, nombre_completo: true, dni: true, celular: true } } } },
        tbl_carnets: { select: { id: true, qr_token: true, version_carnet: true } },
      },
      orderBy: { nombre_completo: 'asc' },
    });

    const data = alumnos.map(a => ({
      id: a.id,
      codigo_alumno: a.codigo_alumno,
      dni: a.dni,
      nombre_completo: a.nombre_completo,
      foto_url: a.foto_url,
      monto_matricula: a.monto_matricula !== null && a.monto_matricula !== undefined ? Number(a.monto_matricula) : null,
      monto_materiales: a.monto_materiales !== null && a.monto_materiales !== undefined ? Number(a.monto_materiales) : null,
      monto_pension: a.monto_pension !== null && a.monto_pension !== undefined ? Number(a.monto_pension) : null,
      estado: a.estado,
      id_aula: a.id_aula,
      aula: a.tbl_aulas ? {
        id: a.tbl_aulas.id,
        seccion: a.tbl_aulas.seccion,
        grado: a.tbl_aulas.tbl_grados ? {
          id: a.tbl_aulas.tbl_grados.id,
          nombre: a.tbl_aulas.tbl_grados.nombre,
          nivel: a.tbl_aulas.tbl_grados.tbl_niveles?.nombre || null,
        } : null,
      } : null,
      padre_alumno: a.tbl_padres_alumnos ? [{
        padre: a.tbl_padres_alumnos.tbl_padres ? {
          id: a.tbl_padres_alumnos.tbl_padres.id,
          nombre_completo: a.tbl_padres_alumnos.tbl_padres.nombre_completo,
          dni: a.tbl_padres_alumnos.tbl_padres.dni,
          celular: a.tbl_padres_alumnos.tbl_padres.celular,
        } : null,
      }] : [],
      carnet: a.tbl_carnets ? {
        id: a.tbl_carnets.id,
        qr_token: a.tbl_carnets.qr_token,
        version: a.tbl_carnets.version_carnet,
      } : null,
    }));

    res.json({ data, total: data.length });
  } catch (error) {
    console.error('Error al listar alumnos:', error);
    res.status(500).json({ error: 'Error al listar alumnos' });
  }
};

const ordenNivel = (nombre) => {
  const n = String(nombre || '').toLowerCase();
  if (n.includes('inicial')) return 1;
  if (n.includes('primaria')) return 2;
  if (n.includes('secundaria')) return 3;
  return 99;
};

const ordenGrado = (nombre) => {
  const n = String(nombre || '').toLowerCase();
  if (n.includes('4 a')) return 1;
  if (n.includes('5 a')) return 2;
  const map = [
    ['1', '1ro', 'primer'], ['2', '2do', 'segundo'], ['3', '3ro', 'tercer'],
    ['4', '4to', 'cuarto'], ['5', '5to', 'quinto'], ['6', '6to', 'sexto'],
  ];
  for (let i = 0; i < map.length; i += 1) {
    if (map[i].some(v => n.includes(v))) return i + 1;
  }
  return 99;
};

const safeSheetName = (base, usados) => {
  let name = String(base || 'Aula').replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Aula';
  let finalName = name;
  let i = 2;
  while (usados.has(finalName)) {
    const suffix = ` ${i}`;
    finalName = `${name.slice(0, 31 - suffix.length)}${suffix}`;
    i += 1;
  }
  usados.add(finalName);
  return finalName;
};

const exportarAulasExcel = async (req, res) => {
  try {
    const aulas = await prisma.tbl_aulas.findMany({
      include: {
        tbl_grados: { include: { tbl_niveles: { select: { nombre: true } } } },
        tbl_alumnos: {
          where: { estado: { not: 'DELETED' } },
          include: {
            tbl_padres_alumnos: { include: { tbl_padres: { select: { nombre_completo: true, dni: true, celular: true } } } },
          },
          orderBy: { nombre_completo: 'asc' },
        },
      },
    });

    const aulasOrdenadas = aulas.sort((a, b) => {
      const na = a.tbl_grados?.tbl_niveles?.nombre || '';
      const nb = b.tbl_grados?.tbl_niveles?.nombre || '';
      return ordenNivel(na) - ordenNivel(nb)
        || ordenGrado(a.tbl_grados?.nombre) - ordenGrado(b.tbl_grados?.nombre)
        || String(a.seccion || '').localeCompare(String(b.seccion || ''), 'es');
    });

    const wb = XLSX.utils.book_new();
    const usados = new Set();

    const resumen = aulasOrdenadas.map(aula => ({
      Nivel: aula.tbl_grados?.tbl_niveles?.nombre || '',
      Grado: aula.tbl_grados?.nombre || '',
      Seccion: aula.seccion || '',
      Aula: `${aula.tbl_grados?.nombre || ''} ${aula.seccion || ''}`.trim(),
      Alumnos: aula.tbl_alumnos.length,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen');
    usados.add('Resumen');

    aulasOrdenadas.forEach((aula) => {
      const rows = aula.tbl_alumnos.map((alumno, index) => {
        const padre = alumno.tbl_padres_alumnos?.tbl_padres;
        return {
          N: index + 1,
          Codigo: alumno.codigo_alumno || '',
          DNI: alumno.dni || '',
          Alumno: alumno.nombre_completo || '',
          Nivel: aula.tbl_grados?.tbl_niveles?.nombre || '',
          Grado: aula.tbl_grados?.nombre || '',
          Seccion: aula.seccion || '',
          Estado: alumno.estado || '',
          Matricula: alumno.monto_matricula !== null && alumno.monto_matricula !== undefined ? Number(alumno.monto_matricula) : '',
          Materiales: alumno.monto_materiales !== null && alumno.monto_materiales !== undefined ? Number(alumno.monto_materiales) : '',
          Pension: alumno.monto_pension !== null && alumno.monto_pension !== undefined ? Number(alumno.monto_pension) : '',
          Padre: padre?.nombre_completo || '',
          DNI_Padre: padre?.dni || '',
          Celular_Padre: padre?.celular || '',
        };
      });
      const sheetName = safeSheetName(`${aula.tbl_grados?.nombre || 'Aula'} ${aula.seccion || ''}`, usados);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
    });

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    await registrarAuditoria({
      userId: req.user.id,
      accion: 'EXPORTAR_AULAS_EXCEL',
      tipoEntidad: 'tbl_alumnos',
      resumen: `Exportacion de aulas a Excel (${aulasOrdenadas.length} aulas)`,
      req,
    });
    res.setHeader('Content-Disposition', `attachment; filename=aulas-alumnos-${new Date().toISOString().slice(0, 10)}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error al exportar aulas:', error);
    res.status(500).json({ error: 'Error al exportar aulas' });
  }
};

const obtenerPorId = async (req, res) => {
  try {
    const alumno = await prisma.tbl_alumnos.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        tbl_aulas: { include: { tbl_grados: { include: { tbl_niveles: true } } } },
        tbl_padres_alumnos: { include: { tbl_padres: true } },
        tbl_carnets: true,
      },
    });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
    res.json({ data: alumno });
  } catch (error) { res.status(500).json({ error: 'Error al obtener alumno' }); }
};

const siguienteCodigo = async (_req, res) => {
  try {
    const codigo = await calcularSiguienteCodigoAlumno();
    res.json({ data: { codigo_alumno: codigo } });
  } catch (error) {
    console.error('Error al calcular siguiente codigo:', error);
    res.status(500).json({ error: 'Error al calcular siguiente codigo de alumno' });
  }
};

const crear = async (req, res) => {
  const { codigo_alumno, dni, nombre_completo, monto_matricula, monto_materiales, monto_pension, id_aula, padre_dni, padre_nombre, padre_celular, padre_username, padre_contrasena } = req.body;

  if (!nombre_completo || !id_aula) {
    return res.status(400).json({ error: 'Nombre y aula son obligatorios' });
  }

  try {
    const montoMatriculaValue = parseMonto(monto_matricula);
    const montoMaterialesValue = parseMonto(monto_materiales);
    const montoPensionValue = parseMonto(monto_pension);
    if (Number.isNaN(montoMatriculaValue)) return res.status(400).json({ error: 'Monto de matricula invalido' });
    if (Number.isNaN(montoMaterialesValue)) return res.status(400).json({ error: 'Monto de materiales invalido' });
    if (Number.isNaN(montoPensionValue)) return res.status(400).json({ error: 'Monto de pension invalido' });

    const codigoFinal = codigo_alumno?.trim() || await calcularSiguienteCodigoAlumno();
    const codigoExiste = await prisma.tbl_alumnos.findFirst({
      where: { codigo_alumno: { equals: codigoFinal, mode: 'insensitive' } },
    });
    if (codigoExiste) return res.status(409).json({ error: 'Codigo de alumno ya existe' });

    if (dni) {
      const dniAlumnoExiste = await prisma.tbl_alumnos.findFirst({
        where: { dni: { equals: dni, mode: 'insensitive' } },
      });
      if (dniAlumnoExiste) return res.status(409).json({ error: 'DNI de alumno ya registrado' });
    }

    const aulaExiste = await prisma.tbl_aulas.findUnique({ where: { id: parseInt(id_aula) } });
    if (!aulaExiste) return res.status(404).json({ error: 'Aula no encontrada' });

    // Subir foto a Wasabi si se envio archivo
    let foto_url = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const key = `fotos/alumno-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
      foto_url = await uploadFile(req.file.buffer, key, req.file.mimetype);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Crear alumno
      const alumno = await tx.tbl_alumnos.create({
        data: {
          codigo_alumno: codigoFinal,
          dni: dni || null,
          nombre_completo,
          monto_matricula: montoMatriculaValue ?? null,
          monto_materiales: montoMaterialesValue ?? null,
          monto_pension: montoPensionValue ?? null,
          foto_url,
          estado: 'ACTIVO',
          id_aula: parseInt(id_aula),
          user_id_registration: req.user.id,
        },
      });

      // Generar carnet automaticamente
      await tx.tbl_carnets.create({
        data: { id_alumno: alumno.id, qr_token: uuidv4(), version_carnet: 1, emitido_por: req.user.id, user_id_registration: req.user.id },
      });

      // Registrar/vincular padre si se proporciono DNI de padre
      if (padre_dni) {
        let padre = await tx.tbl_padres.findUnique({ where: { dni: padre_dni } });

        if (!padre) {
          // Crear padre nuevo: requiere datos completos
          if (!padre_nombre || !padre_celular || !padre_username || !padre_contrasena) {
            throw new Error('PADRE_DATOS_INCOMPLETOS');
          }

          const usernameExiste = await tx.tbl_usuarios.findUnique({ where: { username: padre_username } });
          if (usernameExiste) throw new Error('PADRE_USERNAME_EXISTE');

          const validacion = validarContrasena(padre_contrasena);
          if (!validacion.valida) throw new Error('PADRE_CONTRASENA_INVALIDA:' + validacion.mensaje);

          const rolPadre = await tx.tbl_roles.findUnique({ where: { codigo: 'PADRE' } });
          const hash = await bcrypt.hash(padre_contrasena, 10);

          const usuario = await tx.tbl_usuarios.create({
            data: { username: padre_username, contrasena: hash, nombres: padre_nombre, id_rol: rolPadre.id, estado: 'ACTIVO', user_id_registration: req.user.id },
          });

          padre = await tx.tbl_padres.create({
            data: { dni: padre_dni, nombre_completo: padre_nombre, celular: padre_celular, id_usuario: usuario.id, user_id_registration: req.user.id },
          });
        }

        // Vincular padre-alumno
        await tx.tbl_padres_alumnos.create({
          data: { id_padre: padre.id, id_alumno: alumno.id, user_id_registration: req.user.id },
        });
      }

      return alumno;
    });

    await registrarAuditoria({ userId: req.user.id, accion: 'CREAR_ALUMNO', tipoEntidad: 'tbl_alumnos', idEntidad: result.id, resumen: `Alumno ${nombre_completo} (${codigoFinal}) creado` });
    res.status(201).json({ data: { mensaje: 'Alumno creado con carnet', id: result.id } });
  } catch (error) {
    if (error.message === 'PADRE_DATOS_INCOMPLETOS') {
      return res.status(400).json({ error: 'Para registrar un padre nuevo se requiere nombre, celular, username y contrasena' });
    }
    if (error.message === 'PADRE_USERNAME_EXISTE') {
      return res.status(409).json({ error: 'El username del padre ya existe en el sistema' });
    }
    if (error.message?.startsWith('PADRE_CONTRASENA_INVALIDA:')) {
      return res.status(400).json({ error: error.message.split(':')[1] });
    }
    console.error('Error al crear alumno:', error);
    res.status(500).json({ error: 'Error al crear alumno' });
  }
};

const actualizar = async (req, res) => {
  const id = parseInt(req.params.id);
  const { nombre_completo, dni, monto_matricula, monto_materiales, monto_pension, id_aula, estado } = req.body;

  try {
    const montoMatriculaValue = parseMonto(monto_matricula);
    const montoMaterialesValue = parseMonto(monto_materiales);
    const montoPensionValue = parseMonto(monto_pension);
    if (Number.isNaN(montoMatriculaValue)) return res.status(400).json({ error: 'Monto de matricula invalido' });
    if (Number.isNaN(montoMaterialesValue)) return res.status(400).json({ error: 'Monto de materiales invalido' });
    if (Number.isNaN(montoPensionValue)) return res.status(400).json({ error: 'Monto de pension invalido' });

    // Validar duplicado de DNI (excluyendo al alumno actual)
    if (dni) {
      const dniDuplicado = await prisma.tbl_alumnos.findFirst({
        where: { dni: { equals: dni, mode: 'insensitive' }, id: { not: id } },
      });
      if (dniDuplicado) return res.status(409).json({ error: 'DNI de alumno ya registrado' });
    }

    const data = { user_id_modification: req.user.id, date_time_modification: new Date() };
    if (nombre_completo) data.nombre_completo = nombre_completo;
    if (dni !== undefined) data.dni = dni || null;
    if (montoMatriculaValue !== undefined) data.monto_matricula = montoMatriculaValue;
    if (montoMaterialesValue !== undefined) data.monto_materiales = montoMaterialesValue;
    if (montoPensionValue !== undefined) data.monto_pension = montoPensionValue;
    if (id_aula) data.id_aula = parseInt(id_aula);
    if (estado) data.estado = estado;

    // Si se subio nueva foto, subirla a Wasabi
    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const key = `fotos/alumno-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
      data.foto_url = await uploadFile(req.file.buffer, key, req.file.mimetype);
    }

    const alumnoAntes = await prisma.tbl_alumnos.findUnique({ where: { id } });
    await prisma.tbl_alumnos.update({ where: { id }, data });

    if (id_aula && alumnoAntes.id_aula !== parseInt(id_aula)) {
      await registrarAuditoria({ userId: req.user.id, accion: 'CAMBIO_AULA_ALUMNO', tipoEntidad: 'tbl_alumnos', idEntidad: id, resumen: `Alumno ${id} cambiado de aula ${alumnoAntes.id_aula} a ${id_aula}`, meta: { aula_anterior: alumnoAntes.id_aula, aula_nueva: parseInt(id_aula) } });
    }

    res.json({ data: { mensaje: 'Alumno actualizado' } });
  } catch (error) { res.status(500).json({ error: 'Error al actualizar alumno' }); }
};

const eliminar = async (req, res) => {
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID de alumno invalido' });

  try {
    const alumno = await prisma.tbl_alumnos.findUnique({ where: { id } });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    if (alumno.estado === 'DELETED') {
      return res.json({ data: { mensaje: 'Alumno ya estaba eliminado' } });
    }

    const suffix = `_DELETED_${id}`;
    await prisma.tbl_alumnos.update({
      where: { id },
      data: {
        estado: 'DELETED',
        codigo_alumno: alumno.codigo_alumno && !alumno.codigo_alumno.includes('_DELETED_')
          ? `${alumno.codigo_alumno}${suffix}`
          : alumno.codigo_alumno,
        dni: alumno.dni && !alumno.dni.includes('_DELETED_')
          ? `${alumno.dni}${suffix}`
          : alumno.dni,
        user_id_modification: req.user.id,
        date_time_modification: new Date(),
      },
    });

    await registrarAuditoria({
      userId: req.user.id,
      accion: 'ELIMINAR_ALUMNO',
      tipoEntidad: 'tbl_alumnos',
      idEntidad: id,
      resumen: `Alumno ${alumno.nombre_completo} eliminado (soft)`,
    });

    res.json({ data: { mensaje: 'Alumno eliminado' } });
  } catch (error) {
    console.error('Error al eliminar alumno:', error);
    res.status(500).json({ error: 'Error al eliminar alumno' });
  }
};

// Subir foto del alumno (endpoint separado para cambiar foto existente)
const subirFoto = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    if (!req.file) return res.status(400).json({ error: 'No se envio ninguna imagen' });

    const ext = path.extname(req.file.originalname);
    const key = `fotos/alumno-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    const foto_url = await uploadFile(req.file.buffer, key, req.file.mimetype);
    await prisma.tbl_alumnos.update({
      where: { id },
      data: { foto_url, user_id_modification: req.user.id, date_time_modification: new Date() },
    });

    await registrarAuditoria({ userId: req.user.id, accion: 'SUBIR_FOTO_ALUMNO', tipoEntidad: 'tbl_alumnos', idEntidad: id, resumen: `Foto subida para alumno ${id}` });
    res.json({ data: { mensaje: 'Foto subida', foto_url } });
  } catch (error) {
    console.error('Error al subir foto:', error);
    res.status(500).json({ error: 'Error al subir foto' });
  }
};

// Obtener datos del carnet (para descargar/imprimir)
const obtenerCarnet = async (req, res) => {
  const id_alumno = parseInt(req.params.id_alumno);
  try {
    const alumno = await prisma.tbl_alumnos.findUnique({
      where: { id: id_alumno },
      include: {
        tbl_carnets: true,
        tbl_aulas: { select: { seccion: true, tbl_grados: { select: { nombre: true, tbl_niveles: { select: { nombre: true } } } } } },
      },
    });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
    if (!alumno.tbl_carnets) return res.status(404).json({ error: 'Carnet no encontrado' });
    if (!alumno.foto_url) return res.status(400).json({ error: 'El alumno no tiene foto registrada. La foto es obligatoria para el carnet.' });

    res.json({
      data: {
        alumno: {
          nombre_completo: alumno.nombre_completo,
          codigo_alumno: alumno.codigo_alumno,
          foto_url: alumno.foto_url,
          aula: `${alumno.tbl_aulas?.tbl_grados?.nombre || ''} ${alumno.tbl_aulas?.seccion || ''}`.trim(),
          nivel: alumno.tbl_aulas?.tbl_grados?.tbl_niveles?.nombre || '',
        },
        carnet: {
          qr_token: alumno.tbl_carnets.qr_token,
          version: alumno.tbl_carnets.version_carnet,
          emitido_en: alumno.tbl_carnets.emitido_en,
        },
      },
    });
  } catch (error) { res.status(500).json({ error: 'Error al obtener carnet' }); }
};

// Vincular padre-alumno
const vincularPadre = async (req, res) => {
  const { id_padre, id_alumno } = req.body;
  try {
    const existeVinculo = await prisma.tbl_padres_alumnos.findUnique({ where: { id_alumno: parseInt(id_alumno) } });
    if (existeVinculo) return res.status(409).json({ error: 'Este alumno ya tiene un padre vinculado' });

    await prisma.tbl_padres_alumnos.create({ data: { id_padre: parseInt(id_padre), id_alumno: parseInt(id_alumno), user_id_registration: req.user.id } });
    await registrarAuditoria({ userId: req.user.id, accion: 'VINCULAR_PADRE_ALUMNO', tipoEntidad: 'tbl_padres_alumnos', resumen: `Padre ${id_padre} vinculado a alumno ${id_alumno}` });
    res.status(201).json({ data: { mensaje: 'Vinculo creado' } });
  } catch (error) { res.status(500).json({ error: 'Error al vincular padre-alumno' }); }
};

const desvincularPadre = async (req, res) => {
  const id_alumno = parseInt(req.params.id_alumno);
  try {
    await prisma.tbl_padres_alumnos.delete({ where: { id_alumno } });
    await registrarAuditoria({ userId: req.user.id, accion: 'DESVINCULAR_PADRE_ALUMNO', tipoEntidad: 'tbl_padres_alumnos', resumen: `Vinculo eliminado para alumno ${id_alumno}` });
    res.json({ data: { mensaje: 'Vinculo eliminado' } });
  } catch (error) { res.status(500).json({ error: 'Error al desvincular' }); }
};

// Reemitir carnet
const reemitirCarnet = async (req, res) => {
  const id_alumno = parseInt(req.params.id_alumno);
  try {
    const carnet = await prisma.tbl_carnets.findUnique({ where: { id_alumno } });
    if (!carnet) return res.status(404).json({ error: 'Carnet no encontrado' });

    await prisma.tbl_carnets.update({
      where: { id_alumno },
      data: { version_carnet: carnet.version_carnet + 1, emitido_en: new Date(), emitido_por: req.user.id, user_id_modification: req.user.id, date_time_modification: new Date() },
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'REEMITIR_CARNET', tipoEntidad: 'tbl_carnets', idEntidad: carnet.id, resumen: `Carnet reemitido para alumno ${id_alumno}, version ${carnet.version_carnet + 1}` });
    res.json({ data: { mensaje: 'Carnet reemitido' } });
  } catch (error) { res.status(500).json({ error: 'Error al reemitir carnet' }); }
};

module.exports = { listar, obtenerPorId, siguienteCodigo, exportarAulasExcel, crear, actualizar, eliminar, subirFoto, obtenerCarnet, vincularPadre, desvincularPadre, reemitirCarnet };
