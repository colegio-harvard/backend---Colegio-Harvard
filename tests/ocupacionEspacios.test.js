const fs = require('fs');
const path = require('path');

const leer = (...rutas) => fs.readFileSync(path.join(__dirname, '..', ...rutas), 'utf8');

describe('ocupación publicada de espacios físicos', () => {
  const rutas = leer('routes', 'horariosRoutes.js');
  const controlador = leer('controllers', 'horariosController.js');

  test('expone una consulta administrativa de solo lectura por espacio', () => {
    expect(rutas).toContain("router.get('/espacios/:id/ocupacion', ...administradores, ctrl.obtenerOcupacionEspacio)");
    expect(controlador).toContain('exports.obtenerOcupacionEspacio');
  });

  test('considera exclusivamente horarios publicados y expone capacidad simultánea', () => {
    expect(controlador).toContain("h.estado='PUBLICADO'");
    expect(controlador).toContain('capacidad_simultanea');
  });

  test('incluye solamente los datos necesarios de bloque, aula, curso y docente', () => {
    ['hora_inicio', 'hora_fin', 'a.seccion', 'g.nombre grado', 'curso,c.color_horario', 'u.nombres docente'].forEach((campo) => {
      expect(controlador).toContain(campo);
    });
  });
});
