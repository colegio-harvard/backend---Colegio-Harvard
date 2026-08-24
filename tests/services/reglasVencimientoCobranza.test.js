const { fechaVencimientoConcepto, conceptoExigible } = require('../../services/cobranzas/reglasVencimiento');

describe('reglas de vencimiento de cobranza', () => {
  test.each([
    ['Pensión marzo', '2026-03-25'], ['Pensión julio', '2026-07-25'],
    ['Adicional julio', '2026-07-25'], ['Pensión diciembre', '2026-12-15'],
    ['Adicional diciembre', '2026-12-15'],
  ])('%s vence en la fecha institucional', (nombre, esperado) => {
    expect(fechaVencimientoConcepto({ concepto: { clave: nombre, nombre }, anio: 2026 }).toISOString().slice(0, 10)).toBe(esperado);
  });

  test('matrícula y materiales son exigibles desde el registro', () => {
    const fechaRegistro = new Date('2026-03-04T18:30:00Z');
    expect(fechaVencimientoConcepto({ concepto: { clave: 'MATRICULA' }, anio: 2026, fechaRegistro }).toISOString().slice(0, 10)).toBe('2026-03-04');
    expect(fechaVencimientoConcepto({ concepto: { clave: 'MATERIALES' }, anio: 2026, fechaRegistro }).toISOString().slice(0, 10)).toBe('2026-03-04');
  });

  test('un concepto aparece desde el propio día de vencimiento', () => {
    const concepto = { clave: 'AGO', nombre: 'Pensión agosto' };
    expect(conceptoExigible({ concepto, anio: 2026, hoy: new Date('2026-08-24T00:00:00Z') })).toBe(false);
    expect(conceptoExigible({ concepto, anio: 2026, hoy: new Date('2026-08-25T00:00:00Z') })).toBe(true);
  });
});

