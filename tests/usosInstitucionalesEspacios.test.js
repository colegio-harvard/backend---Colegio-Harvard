const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
  path.join(__dirname, '..', 'prisma', 'migrations', '20261017000400_add_institutional_space_uses', 'migration.sql'),
  'utf8',
);

describe('usos institucionales de espacios', () => {
  test('crea una entidad separada de los detalles de clase', () => {
    expect(migration).toContain('CREATE TABLE "tbl_horario_usos_institucionales_espacios"');
    expect(migration).toContain('"descripcion" VARCHAR(200) NOT NULL');
    expect(migration).not.toMatch(/ALTER TABLE "tbl_horario_detalles"/);
  });

  test('registra los dos bloques de Inicial para ambas aulas y todos los días', () => {
    expect(migration).toContain('horario.id IN (1, 2)');
    expect(migration).toContain('bloque.id IN (1, 2)');
    expect(migration).toContain("('LUNES'), ('MARTES'), ('MIERCOLES'), ('JUEVES'), ('VIERNES')");
    expect(migration).toContain('"id_espacio_fisico", "descripcion", "creado_por")');
  });
});
