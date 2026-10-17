const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'prisma',
    'migrations',
    '20261017000200_correct_initial_and_physical_education_spaces',
    'migration.sql'
  ),
  'utf8'
);

describe('regla definitiva de espacios físicos 2026', () => {
  test('restaura solo las clases ordinarias de los dos horarios publicados de Inicial', () => {
    expect(migration).toMatch(/horario\."id" IN \(1, 2\)/);
    expect(migration).toMatch(/detalle\."id_espacio_fisico" IS NULL/);
    expect(migration).toMatch(/"id_espacio_fisico" = 1/);
  });

  test('libera únicamente Educación Física publicada de Primaria y Secundaria', () => {
    expect(migration).toMatch(/horario\."id" IN \(3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13\)/);
    expect(migration).toMatch(/detalle\."id_espacio_fisico" = 3/);
    expect(migration).toMatch(/curso\."nombre" = 'Educación Física'/);
    expect(migration).toMatch(/"id_espacio_fisico" = NULL/);
  });

  test('corrige la ortografía del espacio conservando el ID 3', () => {
    expect(migration).toMatch(/WHERE "id" = 3/);
    expect(migration).toMatch(/'Losa deportiva externa'/);
  });

  test('no altera cursos, asignaciones, cargas, horarios ni notas', () => {
    expect(migration).not.toMatch(/UPDATE "tbl_cursos_academicos"/);
    expect(migration).not.toMatch(/UPDATE "tbl_asignaciones_academicas"/);
    expect(migration).not.toMatch(/UPDATE "tbl_horarios_escolares"/);
    expect(migration).not.toMatch(/tbl_notas/i);
  });
});
