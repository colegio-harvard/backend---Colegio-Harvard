const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'prisma', 'migrations', '20261016000200_add_denominaciones_curso_anio', 'migration.sql'), 'utf8');
const horarios = fs.readFileSync(path.join(root, 'controllers', 'horariosController.js'), 'utf8');
const libretas = fs.readFileSync(path.join(root, 'controllers', 'libretasController.js'), 'utf8');

describe('Fase 10.7: denominaciones anuales de cursos', () => {
  test('crea la tabla anual con las referencias y auditoría requeridas', () => {
    expect(migration).toContain('CREATE TABLE "tbl_denominaciones_curso_anio"');
    expect(migration).toContain('"id_anio_escolar" INTEGER NOT NULL REFERENCES "tbl_anios_escolares"');
    expect(migration).toContain('"id_curso" INTEGER NOT NULL REFERENCES "tbl_cursos_academicos"');
    expect(migration).toContain('"nombre_presentacion" VARCHAR(150) NOT NULL');
    expect(migration).toContain('"creado_por" INTEGER REFERENCES "tbl_usuarios"');
  });

  test('impide duplicar una denominación para el mismo curso y año', () => {
    expect(migration).toContain('CONSTRAINT "uq_denominaciones_curso_anio" UNIQUE ("id_anio_escolar", "id_curso")');
  });

  test('sin denominación anual, las consultas conservan el nombre del catálogo', () => {
    expect(horarios).toContain('COALESCE(dca.nombre_presentacion,c.nombre) curso');
    expect(libretas).toContain('COALESCE(dca.nombre_presentacion,c.nombre) curso');
  });

  test('las denominaciones se resuelven por año y curso, sin cambiar el id del curso', () => {
    const joins = `${horarios}\n${libretas}`;
    expect(joins).toContain('dca.id_anio_escolar=aa.id_anio_escolar AND dca.id_curso=aa.id_curso');
    expect(joins).toContain('dca.id_anio_escolar=h.id_anio_escolar AND dca.id_curso=aa.id_curso');
  });

  test('las notas conservan su vínculo con las asignaciones existentes', () => {
    expect(libretas).toContain('JOIN "tbl_asignaciones_academicas" aa ON aa.id=n.id_asignacion');
    expect(migration).not.toMatch(/ALTER TABLE "tbl_notas_academicas"|UPDATE "tbl_notas_academicas"|INSERT INTO "tbl_notas_academicas"/);
  });

  test('las libretas usan la denominación del año de la asignación', () => {
    expect(libretas).toContain('dca.id_anio_escolar=$2 AND dca.id_curso=c.id');
    expect(libretas).toContain('dca.id_anio_escolar=asignacion.id_anio_escolar AND dca.id_curso=asignacion.id_curso');
  });

  test('los horarios administrativo, docente y padre resuelven el nombre anual', () => {
    expect(horarios).toContain('dca.id_anio_escolar=$2 AND dca.id_curso=aa.id_curso');
    expect(horarios).toContain('dca.id_anio_escolar=h.id_anio_escolar AND dca.id_curso=aa.id_curso');
  });

  test('la carga horaria agrupa la denominación anual sin romper el fallback del catálogo', () => {
    expect(horarios).toContain('COALESCE(dca.nombre_presentacion,c.nombre) curso');
    expect(horarios).toContain('GROUP BY aa.id,aa.horas_semanales,c.nombre,dca.nombre_presentacion,u.nombres');
  });

  test('la migración es solo estructural y no altera cursos, asignaciones ni períodos', () => {
    expect(migration).not.toMatch(/INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE/);
  });
});
