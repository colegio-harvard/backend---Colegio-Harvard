const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { createZip } = require('../utils/simpleZip');
const fs = require('fs');
const path = require('path');

const TABLES = [
  'tbl_roles',
  'tbl_permisos',
  'tbl_roles_permisos',
  'tbl_usuarios',
  'tbl_colegio',
  'tbl_anios_escolares',
  'tbl_calendario_escolar',
  'tbl_niveles',
  'tbl_grados',
  'tbl_aulas',
  'tbl_horarios_nivel',
  'tbl_asignaciones_tutor',
  'tbl_padres',
  'tbl_alumnos',
  'tbl_padres_alumnos',
  'tbl_carnets',
  'tbl_puntos_escaneo',
  'tbl_asignaciones_porteria',
  'tbl_eventos_asistencia',
  'tbl_asistencia_dia',
  'tbl_correcciones_asistencia',
  'tbl_alertas',
  'tbl_plantillas_notificacion',
  'tbl_config_pension_reminder',
  'tbl_notificaciones',
  'tbl_entradas_agenda',
  'tbl_firmas_agenda',
  'tbl_respuestas_agenda',
  'tbl_reportes_semanales',
  'tbl_firmas_reporte_semanal',
  'tbl_hilos_mensaje',
  'tbl_mensajes',
  'tbl_comunicados',
  'tbl_lecturas_comunicado',
  'tbl_plantilla_pension',
  'tbl_estado_pension',
  'tbl_pagos_pension',
  'tbl_auditoria',
  'tbl_notificaciones_personalizadas',
  'tbl_destinatarios_notif_personalizada',
];

const FILE_REFERENCE_FIELDS = [
  'foto_url',
  'foto_alumno_url',
  'imagen_url',
  'archivo_url',
  'url',
  'ruta_archivo',
  'qr_url',
];

const jsonReplacer = (_key, value) => {
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  return value;
};

const toJson = (value) => JSON.stringify(value, jsonReplacer, 2);

const safeFindMany = async (modelName) => {
  const model = prisma[modelName];
  if (!model?.findMany) return [];

  try {
    return await model.findMany({ orderBy: { id: 'asc' } });
  } catch {
    return model.findMany();
  }
};

const collectFileReferences = (tableName, rows) => {
  const references = [];
  for (const row of rows) {
    for (const field of FILE_REFERENCE_FIELDS) {
      const value = row[field];
      if (typeof value === 'string' && value.trim()) {
        references.push({
          tabla: tableName,
          id: row.id ?? null,
          campo: field,
          valor: value,
        });
      }
    }
  }
  return references;
};

const addDirectoryFiles = (entries, baseDir, zipPrefix) => {
  if (!fs.existsSync(baseDir)) return 0;

  let count = 0;
  const walk = (currentDir) => {
    for (const item of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const itemPath = path.join(currentDir, item.name);
      if (item.isDirectory()) {
        walk(itemPath);
      } else if (item.isFile()) {
        const relative = path.relative(baseDir, itemPath).replace(/\\/g, '/');
        entries.push({ name: `${zipPrefix}/${relative}`, data: fs.readFileSync(itemPath) });
        count += 1;
      }
    }
  };

  walk(baseDir);
  return count;
};

const descargarSistema = async (req, res) => {
  const generatedAt = new Date();
  const stamp = generatedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const entries = [];
  const resumenTablas = [];
  const fileReferences = [];
  const errors = [];
  let localFileCount = 0;

  try {
    for (const tableName of TABLES) {
      try {
        const rows = await safeFindMany(tableName);
        resumenTablas.push({ tabla: tableName, registros: rows.length });
        fileReferences.push(...collectFileReferences(tableName, rows));
        entries.push({
          name: `database/${tableName}.json`,
          data: toJson(rows),
        });
      } catch (error) {
        errors.push({ tabla: tableName, error: error.message });
      }
    }

    let migrations = [];
    try {
      migrations = await prisma.$queryRawUnsafe('SELECT * FROM "_prisma_migrations" ORDER BY "finished_at" NULLS LAST, "started_at"');
      entries.push({ name: 'database/_prisma_migrations.json', data: toJson(migrations) });
    } catch (error) {
      errors.push({ tabla: '_prisma_migrations', error: error.message });
    }

    localFileCount = addDirectoryFiles(entries, path.join(__dirname, '..', 'uploads'), 'uploads');
    if (fs.existsSync(path.join(__dirname, '..', 'prisma', 'schema.prisma'))) {
      entries.push({
        name: 'schema/schema.prisma',
        data: fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.prisma')),
      });
    }

    const metadata = {
      generado_en: generatedAt.toISOString(),
      generado_por: {
        id: req.user?.id ?? null,
        rol: req.user?.rol_codigo ?? null,
      },
      sistema: 'Colegio Harvard',
      contenido: {
        tablas: resumenTablas,
        migraciones: migrations.length,
        referencias_archivos: fileReferences.length,
        archivos_locales: localFileCount,
        errores: errors,
      },
      seguridad: 'Las contrasenas no se exportan en texto legible; se conservan los hashes almacenados por el sistema.',
      nota_archivos: 'Los archivos locales de uploads se incluyen completos. Las fotos, carnets e imagenes que vivan en Wasabi u otro almacenamiento externo se incluyen como referencias/URLs y deben conservarse tambien en ese almacenamiento.',
    };

    entries.unshift({ name: 'metadata.json', data: toJson(metadata) });
    entries.push({ name: 'files/referencias_archivos.json', data: toJson(fileReferences) });
    entries.push({
      name: 'LEEME_RESTAURACION.txt',
      data: [
        'Respaldo completo del sistema Colegio Harvard',
        '',
        `Generado: ${generatedAt.toISOString()}`,
        '',
        'Contenido:',
        '- database/*.json: tablas completas del sistema.',
        '- database/_prisma_migrations.json: historial de migraciones Prisma.',
        '- files/referencias_archivos.json: enlaces o rutas de fotos, carnets, comunicados e imagenes.',
        '- uploads/: archivos locales guardados por el backend, cuando existan.',
        '- schema/schema.prisma: estructura tecnica de la base de datos.',
        '',
        'Importante:',
        '- Las contrasenas estan protegidas como hashes. No aparecen en texto legible.',
        '- Para recuperar fotos/carnets externos tambien se debe conservar el almacenamiento donde viven esos archivos.',
        '- La restauracion debe hacerla una persona tecnica para evitar sobrescribir datos actuales.',
      ].join('\n'),
    });

    const buffer = createZip(entries);
    await registrarAuditoria({
      userId: req.user.id,
      accion: 'BACKUP_SISTEMA_DESCARGADO',
      tipoEntidad: 'SISTEMA',
      idEntidad: null,
      resumen: `Descarga de respaldo completo (${resumenTablas.length} tablas, ${(buffer.length / 1024 / 1024).toFixed(2)} MB)`,
      req,
      meta: {
        generated_at: generatedAt.toISOString(),
        tablas: resumenTablas.length,
        referencias_archivos: fileReferences.length,
        archivos_locales: localFileCount,
        errores: errors.length,
      },
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=respaldo-sistema-${stamp}.zip`);
    res.send(buffer);
  } catch (error) {
    console.error('Error generando respaldo completo:', error);
    res.status(500).json({ error: 'Error al generar el respaldo del sistema' });
  }
};

module.exports = { descargarSistema };
