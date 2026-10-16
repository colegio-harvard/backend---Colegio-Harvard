const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'migrations', '20261016000400_seed_color_horario_primaria', 'migration.sql'), 'utf8');

describe('Ajuste visual de Primaria: colores por curso', () => {
  test('asigna colores HEX suaves a los doce cursos de Primaria', () => {
    expect(migration).toContain('WHERE "id" IN (12,13,14,15,16,17,18,19,20,21,22,23)');
    [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].forEach(id => expect(migration).toContain(`WHEN ${id} THEN '#`));
  });

  test('solo modifica el campo visual color_horario', () => {
    expect(migration).toContain('SET "color_horario" = CASE "id"');
    expect(migration).not.toMatch(/tbl_horarios_escolares|tbl_horario_detalles|tbl_notas_academicas|tbl_asignaciones_academicas/);
  });
});
