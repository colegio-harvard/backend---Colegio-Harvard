const {
  parseMontoExcel,
  normalizarSeccion,
  normalizarGradoImportacion,
  aulaKey,
  obtenerValorPorEncabezado,
  crearMapaConceptosImportacion,
} = require('../../services/pensiones/validacionImportacion');

describe('validacion de importacion financiera', () => {
  test.each([
    [150, 150], ['S/. 150.50', 150.5], ['50,25', 50.25], ['S/ 1,250.50', 1250.5],
    ['1.250,50', 1250.5], ['', null], [-1, null], ['abc', null],
  ])('normaliza el monto %p como %p', (entrada, esperado) => {
    expect(parseMontoExcel(entrada)).toBe(esperado);
  });

  test('normaliza grados y secciones historicos', () => {
    expect(normalizarGradoImportacion('Primer grado')).toBe('1RO');
    expect(normalizarGradoImportacion('3er grado')).toBe('3RO');
    expect(normalizarGradoImportacion('4 años')).toBe('4 ANIOS');
    expect(normalizarSeccion('Sección b')).toBe('B');
    expect(aulaKey('Primaria', 'Primer grado', 'a')).toBe('PRIMARIA|1RO|A');
  });

  test('encuentra encabezados aunque tengan tildes o variantes', () => {
    const row = { 'Matrícula': 250, 'Código Alumno': 'H001' };
    const headerMap = Object.fromEntries(Object.keys(row).map((key) => [
      key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(), key,
    ]));
    expect(obtenerValorPorEncabezado(row, headerMap, ['Matricula'])).toBe(250);
    expect(obtenerValorPorEncabezado(row, headerMap, ['Codigo Alumno'])).toBe('H001');
  });

  test('mapea conceptos mensuales sin confundir pagos personalizados', () => {
    const map = crearMapaConceptosImportacion({ meses_json: [
      { clave: 'MATRICULA', nombre: 'Matrícula', tipo: 'concepto' },
      { clave: 'JUL', nombre: 'Julio', tipo: 'mes' },
      { clave: 'ADICIONAL_JULIO', nombre: 'Adicional julio', tipo: 'personalizado', monto: 50 },
    ] });
    expect(map.MATRICULA.clave).toBe('MATRICULA');
    expect(map.JULIO.clave).toBe('JUL');
    expect(map['ADICIONAL JULIO']).toMatchObject({ clave: 'ADICIONAL_JULIO', monto: 50 });
  });
});
