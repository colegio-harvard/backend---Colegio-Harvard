const { crearMensaje, crearMensajeNivel, crearEnlace } = require('../utils/cobranzaMensajeria');
const datos = { canal: 'WHATSAPP', colegio: 'COLEGIO HARVARD', alumno: 'José Pérez', conceptos: [{ concepto: 'Julio', saldo: 280 }, { concepto: 'Adicional julio', saldo: 50 }, { concepto: 'Agosto', saldo: 280 }] };
test('nivel 1 conserva exactamente el mensaje estable', () => {
  expect(crearMensajeNivel(datos, 1)).toBe(crearMensaje(datos));
  expect(crearMensajeNivel({ ...datos, canal: 'SMS' }, 1)).toBe(crearMensaje({ ...datos, canal: 'SMS' }));
});
test.each([2, 3, 4])('nivel %i utiliza nombre, conceptos, total y saltos de línea reales', nivel => {
  const mensaje = crearMensajeNivel(datos, nivel);
  expect(mensaje).toContain('José Pérez');
  expect(mensaje).toContain('Julio: S/280\nAdicional julio: S/50\nAgosto: S/280');
  expect(mensaje).toContain('Total pendiente: S/610.');
  const enlace = new URL(crearEnlace('WHATSAPP', '51912345678', mensaje));
  expect(enlace.searchParams.get('text')).toBe(mensaje);
});
test('los niveles son progresivos y sin consecuencias añadidas', () => {
  expect(crearMensajeNivel(datos, 2)).not.toContain('obligatoria');
  expect(crearMensajeNivel(datos, 3)).toContain('de manera obligatoria');
  expect(crearMensajeNivel(datos, 4)).toContain('último aviso');
  expect(crearMensajeNivel(datos, 4)).toContain('carácter prioritario');
});
test('no mezcla estudiantes, excluye saldos cero y no modifica datos', () => {
  const copia = JSON.stringify(datos);
  const otro = crearMensajeNivel({ ...datos, alumno: 'María Díaz', conceptos: [{ concepto: 'Materiales', saldo: 40 }, { concepto: 'Marzo', saldo: 0 }] }, 4);
  expect(otro).toContain('María Díaz');
  expect(otro).not.toContain('José Pérez');
  expect(otro).not.toContain('Julio');
  expect(otro).not.toContain('Marzo');
  expect(otro).toContain('Total pendiente: S/40');
  expect(JSON.stringify(datos)).toBe(copia);
  expect(() => crearMensajeNivel(datos, 5)).toThrow();
});
