const { VENTANA_ANTIDUPLICADO_MS, evaluarMarcacionRepetida } = require('../../services/asistencia/reglaMarcacion');

describe('protección de marcación repetida', () => {
  const ahora = new Date('2026-08-12T13:00:05.000Z').getTime();
  test('bloquea dentro de los cinco segundos', () => {
    expect(evaluarMarcacionRepetida('2026-08-12T13:00:02.000Z', ahora))
      .toEqual({ bloqueada: true, segundosRestantes: 2 });
  });
  test('permite al cumplir cinco segundos', () => {
    expect(evaluarMarcacionRepetida(new Date(ahora - VENTANA_ANTIDUPLICADO_MS), ahora).bloqueada).toBe(false);
  });
  test('ignora fechas ausentes o inválidas', () => {
    expect(evaluarMarcacionRepetida(null, ahora).bloqueada).toBe(false);
    expect(evaluarMarcacionRepetida('fecha-invalida', ahora).bloqueada).toBe(false);
  });
});
