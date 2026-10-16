const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'prisma', 'migrations', '20261016000300_add_color_horario_cursos', 'migration.sql'), 'utf8');
const horarios = fs.readFileSync(path.join(root, 'controllers', 'horariosController.js'), 'utf8');
const libretas = fs.readFileSync(path.join(root, 'controllers', 'libretasController.js'), 'utf8');

describe('Fase 10.9: colores de horario por curso', () => {
  test('agrega un color de horario nullable y restringido a HEX', () => {
    expect(migration).toContain('ADD COLUMN "color_horario" VARCHAR(7)');
    expect(migration).toContain('"color_horario" IS NULL OR "color_horario" ~');
  });

  test('asigna tonos iniciales suaves a los cursos de Inicial aprobados', () => {
    ['#DBEAFE', '#FEE2E2', '#FEF3C7', '#E5E7EB', '#D1FAE5', '#CCFBF1', '#FFEDD5', '#F5F0E6', '#EDE9FE']
      .forEach(color => expect(migration).toContain(color));
  });

  test('mantiene Arte y Razonamiento Matemático sin color inicial', () => {
    expect(migration).toContain('WHERE "id" IN (1,2,3,4,5,6,8,9,10)');
    expect(migration).not.toContain('WHEN 7 THEN');
    expect(migration).not.toContain('WHEN 11 THEN');
  });

  test('la API administrativa, docente y padre expone solo el color del curso', () => {
    expect(horarios).toContain('curso,c.color_horario,ar.nombre area,ef.nombre espacio_fisico');
    expect(horarios).toContain('curso,c.color_horario,n.nombre nivel');
  });

  test('la administración valida HEX y permite dejar el color opcional', () => {
    expect(libretas).toContain("/^#[0-9A-F]{6}$/i.test(color)");
    expect(libretas).toContain('color_horario=CASE WHEN $4 THEN $5 ELSE color_horario END');
  });

  test('permite cambiar solo el color aunque existan cursos históricos homónimos', () => {
    expect(libretas).toContain('const cambiaIdentidad');
    expect(libretas).toContain('if (cambiaIdentidad)');
  });

  test('la migración no toca notas, asignaciones, periodos ni libretas', () => {
    expect(migration).not.toMatch(/tbl_notas|tbl_asignaciones|tbl_periodos|tbl_libretas/);
  });
});
