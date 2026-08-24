const { normalizarTelefonoPeru, saldoPension, compromisoVigente, crearMensaje, crearEnlace } = require('../utils/cobranzaMensajeria');
describe('cobranzaMensajeria', () => {
  test('normaliza celulares peruanos', () => { expect(normalizarTelefonoPeru('946 413 462')).toBe('51946413462'); expect(normalizarTelefonoPeru('+51 946-413-462')).toBe('51946413462'); expect(normalizarTelefonoPeru('123')).toBeNull(); });
  test('calcula saldo', () => { expect(saldoPension({ monto_total: '450', monto_pagado: '100' })).toBe(350); expect(saldoPension({ monto_total: '450', monto_pagado: '500' })).toBe(0); });
  test('respeta compromisos vigentes', () => { const now = new Date('2026-08-24T12:00:00-05:00'); expect(compromisoVigente([{ estado: 'VIGENTE', fecha_compromiso: '2026-08-25' }], now)).toBeTruthy(); expect(compromisoVigente([{ estado: 'VIGENTE', fecha_compromiso: '2026-08-23' }], now)).toBeNull(); });
  test('crea enlaces WhatsApp y SMS', () => { const mensaje = crearMensaje({ canal: 'SMS', colegio: 'COLEGIO HARVARD', alumno: 'Juan Perez', mes: 'AGO', saldo: 450 }); expect(mensaje).toContain('S/450'); expect(crearEnlace('WHATSAPP', '51946413462', 'Hola')).toBe('https://wa.me/51946413462?text=Hola'); expect(crearEnlace('SMS', '51946413462', 'Hola')).toBe('sms:+51946413462?body=Hola'); });
});



