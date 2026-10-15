const fs = require('fs');
const path = require('path');
const fuente = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'horariosController.js'), 'utf8');
const rutas = fs.readFileSync(path.join(__dirname, '..', 'routes', 'horariosRoutes.js'), 'utf8');

describe('Fase 7: generación asistida', () => {
  test('expone análisis y generación solo por rutas administrativas', () => { expect(rutas).toContain("'/generar/analizar'"); expect(rutas).toContain("'/generar'"); expect(rutas).toContain('...administradores'); });
  test('crea exclusivamente versiones en borrador', () => { expect(fuente).toContain("'BORRADOR'"); expect(fuente).toContain('COALESCE(MAX(version),0)+1'); });
  test('usa transacción y valida después de insertar la propuesta', () => { expect(fuente).toContain('prisma.$transaction'); expect(fuente).toContain('diagnosticarHorario(tx'); expect(fuente).toContain('GENERACION_INVALIDA'); });
  test('considera recreos, disponibilidad y conflictos mediante validarDetalle', () => { expect(fuente).toContain("tipo='CLASE'"); expect(fuente).toContain('validarDetalle(db'); expect(fuente).toContain('docentesOcupados'); });
  test('devuelve diagnóstico sin crear horarios cuando faltan precondiciones', () => { expect(fuente).toContain('GENERACION_NO_POSIBLE'); expect(fuente).toContain('carga semanal sin configurar'); });
});
