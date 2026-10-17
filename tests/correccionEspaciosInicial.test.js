const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'prisma',
    'migrations',
    '20261017000100_clear_initial_general_class_spaces',
    'migration.sql'
  ),
  'utf8'
);

describe('corrección de espacios en Inicial 2026', () => {
  test('solo libera Aula de juegos lúdicos de los dos horarios publicados de Inicial', () => {
    expect(migration).toMatch(/horario\."id" IN \(1, 2\)/);
    expect(migration).toMatch(/horario\."id_anio_escolar" = 1/);
    expect(migration).toMatch(/horario\."id_aula" IN \(1, 2\)/);
    expect(migration).toMatch(/horario\."estado" = 'PUBLICADO'/);
    expect(migration).toMatch(/detalle\."id_espacio_fisico" = 1/);
    expect(migration).toMatch(/"id_espacio_fisico" = NULL/);
  });

  test('no altera asignaciones académicas ni la referencia al laboratorio', () => {
    expect(migration).not.toMatch(/id_asignacion_academica\s*=/i);
    expect(migration).not.toMatch(/id_espacio_fisico"\s*=\s*2/);
  });
});
