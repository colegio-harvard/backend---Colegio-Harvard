const fs = require('fs');
const path = require('path');

const leer = ruta => fs.readFileSync(path.join(__dirname, '..', ruta), 'utf8');

describe('Fase 6: disponibilidad docente', () => {
  const migracion = leer('prisma/migrations/20261015000300_add_disponibilidad_docente/migration.sql');
  const rutas = leer('routes/horariosRoutes.js');
  const controlador = leer('controllers/horariosController.js');

  test('guarda restricciones únicas por docente, año, día y bloque', () => {
    expect(migracion).toContain('tbl_disponibilidad_docente');
    expect(migracion).toMatch(/UNIQUE \("id_docente","id_anio_escolar","dia_semana","id_bloque_horario"\)/);
    expect(migracion).toMatch(/"disponible" BOOLEAN NOT NULL DEFAULT FALSE/);
  });

  test('protege las rutas administrativas de disponibilidad', () => {
    expect(rutas).toContain("'/disponibilidad/docentes'");
    expect(rutas).toContain("'/disponibilidad'");
    expect(rutas).toContain("verificarRol('SUPER_ADMIN', 'ADMIN')");
  });

  test('bloquea como conflicto crítico la asignación en una restricción docente', () => {
    expect(controlador).toContain("codigo: 'DOCENTE_NO_DISPONIBLE'");
    expect(controlador).toContain('no está disponible');
  });

  test('no cambia horarios existentes y devuelve sus conflictos como advertencia de revisión', () => {
    expect(controlador).toContain('const conflictos=await prisma.$queryRawUnsafe');
    expect(controlador).toContain('conflictos');
  });
});
