const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'prisma',
    'migrations',
    '20261017000300_clear_initial_classroom_space_from_0800',
    'migration.sql'
  ),
  'utf8'
);

describe('espacios de Inicial desde las 08:00', () => {
  test('libera solamente el Aula de juegos de las dos aulas publicadas de Inicial 2026', () => {
    expect(migration).toMatch(/horario\."id" IN \(1, 2\)/);
    expect(migration).toMatch(/horario\."id_anio_escolar" = 1/);
    expect(migration).toMatch(/horario\."id_aula" IN \(1, 2\)/);
    expect(migration).toMatch(/horario\."estado" = 'PUBLICADO'/);
    expect(migration).toMatch(/detalle\."id_espacio_fisico" = 1/);
    expect(migration).toMatch(/bloque\."hora_inicio" >= TIME '08:00:00'/);
  });

  test('no altera Computación, cursos, asignaciones ni estados de horario', () => {
    expect(migration).not.toMatch(/id_espacio_fisico"\s*=\s*2/);
    expect(migration).not.toMatch(/id_asignacion_academica\s*=/i);
    expect(migration).not.toMatch(/UPDATE "tbl_horarios_escolares"/);
  });
});
