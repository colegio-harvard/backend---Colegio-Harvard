const {
  normalizarMesesPlantilla,
  montoBaseConceptoAlumno,
  montoTotalVigente,
} = require('../../services/pensiones/calculoConceptos');

const alumno = {
  monto_matricula: 280,
  monto_materiales: 240,
  monto_pension: 430,
};

describe('calculo de conceptos de pago', () => {
  test('materiales nunca supera S/ 150', () => {
    expect(montoBaseConceptoAlumno(alumno, 'Materiales')).toBe(150);
  });

  test('matricula y pension usan la ficha del alumno', () => {
    expect(montoBaseConceptoAlumno(alumno, 'Matrícula')).toBe(280);
    expect(montoBaseConceptoAlumno(alumno, 'Julio')).toBe(430);
  });

  test('un concepto personalizado usa su propio monto', () => {
    expect(montoBaseConceptoAlumno(alumno, 'Adicional julio', 50)).toBe(50);
  });

  test('mantiene compatibilidad con adicionales antiguos de S/ 50', () => {
    const [concepto] = normalizarMesesPlantilla([
      { clave: 'ADICIONAL_JULIO', nombre: 'Adicional julio', tipo: 'personalizado' },
    ]);
    expect(concepto.monto).toBe(50);
  });

  test('una deuda abierta toma la tarifa vigente y no un total antiguo', () => {
    expect(montoTotalVigente(alumno, { clave: 'MATERIALES', nombre: 'Materiales' }, {
      estado: 'PENDIENTE', monto_total: 430,
    })).toBe(150);
  });

  test('un pago cerrado conserva su total historico', () => {
    expect(montoTotalVigente(alumno, { clave: 'JUL', nombre: 'Julio' }, {
      estado: 'PAGADO', monto_total: 400,
    })).toBe(400);
  });
});
