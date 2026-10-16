const fs = require('fs');
const path = require('path');

const leer = (...partes) => fs.readFileSync(path.join(__dirname, '..', ...partes), 'utf8');
const controlador = leer('controllers', 'horariosController.js');
const rutas = leer('routes', 'horariosRoutes.js');
const migracion = leer('prisma', 'migrations', '20261015000400_add_espacios_fisicos', 'migration.sql');

describe('Fase 9: espacios físicos', () => {
  test('la migración crea los espacios físicos y la relación opcional', () => {
    expect(migracion).toContain('CREATE TABLE "tbl_espacios_fisicos"');
    expect(migracion).toContain('ADD COLUMN "id_espacio_fisico" INTEGER');
    expect(migracion).toContain('ON DELETE SET NULL');
  });

  test('las rutas de espacios son exclusivas de administradores', () => {
    expect(rutas).toContain("router.get('/espacios', ...administradores");
    expect(rutas).toContain("router.post('/espacios', ...administradores");
    expect(rutas).toContain("router.put('/espacios/:id', ...administradores");
    expect(rutas).toContain("router.patch('/espacios/:id/activo', ...administradores");
    expect(rutas).toContain("verificarRol('SUPER_ADMIN', 'ADMIN')");
  });

  test('incluye CRUD lógico y auditoría de espacios', () => {
    ['listarEspacios', 'crearEspacio', 'actualizarEspacio', 'cambiarEstadoEspacio'].forEach((nombre) => {
      expect(controlador).toContain(`exports.${nombre}`);
    });
    ['CREAR_ESPACIO_FISICO', 'EDITAR_ESPACIO_FISICO', 'ACTIVAR_ESPACIO_FISICO', 'DESACTIVAR_ESPACIO_FISICO'].forEach((accion) => {
      expect(controlador).toContain(accion);
    });
  });

  test('mantiene el espacio opcional al crear y editar una clase', () => {
    expect(controlador).toContain('id_espacio_fisico,observacion,creado_por');
    expect(controlador).toContain('id_espacio_fisico=$4,observacion=$5');
    expect(controlador).toContain('entero(base.id_espacio_fisico)||null');
  });

  test('una clase sin espacio sigue siendo válida', () => {
    expect(controlador).toContain('if (detalle.id_espacio_fisico)');
  });

  test('rechaza un espacio inexistente o inactivo en nuevas asignaciones', () => {
    expect(controlador).toContain("codigo: 'ESPACIO_INEXISTENTE'");
    expect(controlador).toContain("codigo: 'ESPACIO_INACTIVO'");
  });

  test('rechaza dos clases simultáneas en el mismo espacio', () => {
    expect(controlador).toContain("codigo: 'CONFLICTO_ESPACIO_FISICO'");
    expect(controlador).toContain('d.id_espacio_fisico=$2');
    expect(controlador).toContain('d.dia_semana=$3 AND d.id_bloque_horario=$4');
  });

  test('permite reutilizar el espacio en otro día o bloque', () => {
    expect(controlador).toContain('d.dia_semana=$3 AND d.id_bloque_horario=$4');
  });

  test('excluye la propia clase al editar', () => {
    expect(controlador).toContain("AND d.id<>$5");
    expect(controlador).toContain('excluirDetalleId');
  });

  test('la validación general vuelve a evaluar el conflicto crítico', () => {
    expect(controlador).toContain('diagnosticarHorario');
    expect(controlador).toContain('validarDetalle(db, horario, detalle, detalle.id)');
  });

  test('la publicación se bloquea ante errores críticos', () => {
    expect(controlador).toContain("if (!diagnostico.valido) throw Object.assign(new Error('HORARIO_INVALIDO')");
    expect(controlador).toContain("HORARIO_INVALIDO: [409, 'El horario tiene errores críticos']");
  });

  test('el generador conserva compatibilidad con espacios nulos', () => {
    expect(controlador).toContain('const detalle = { id_asignacion_academica: asignacion.id, id_bloque_horario: elegido.bloque.id, dia_semana: elegido.dia }');
  });

  test('la respuesta docente entrega solo el nombre del espacio', () => {
    expect(controlador).toContain('ef.nombre espacio_fisico');
    expect(controlador).toContain("LEFT JOIN \"tbl_espacios_fisicos\" ef ON ef.id=d.id_espacio_fisico");
  });

  test('la respuesta padre entrega solo el nombre del espacio', () => {
    const inicioPadre = controlador.indexOf('exports.misHorariosPadre');
    const finPadre = controlador.indexOf('exports.miHorarioDocente');
    const padre = controlador.slice(inicioPadre, finPadre);
    expect(padre).toContain('ef.nombre espacio_fisico');
    expect(padre).not.toContain('ef.capacidad');
    expect(padre).not.toContain('ef.observacion');
  });

  test('los espacios inactivos históricos continúan siendo legibles', () => {
    const inicioPadre = controlador.indexOf('exports.misHorariosPadre');
    const lector = controlador.slice(inicioPadre);
    expect(lector).toContain('LEFT JOIN "tbl_espacios_fisicos" ef');
    expect(lector).not.toContain('ef.activo=TRUE');
  });
});
