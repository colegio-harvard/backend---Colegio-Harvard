jest.mock('../config/prisma', () => ({ tbl_estado_pension: { findMany: jest.fn() }, tbl_colegio: { findFirst: jest.fn() }, tbl_anios_escolares: { findFirst: jest.fn() }, tbl_cobranza_envios: { create: jest.fn() } }));
jest.mock('../middleware/auditMiddleware', () => ({ registrarAuditoria: jest.fn() }));
jest.mock('../services/pensiones/calculoConceptos', () => ({ normalizarMesesPlantilla: () => [{ clave: 'AGO', nombre: 'Agosto' }], montoTotalVigente: () => 170 }));
jest.mock('../services/cobranzas/reglasVencimiento', () => ({ conceptoExigible: () => true, fechaVencimientoConcepto: () => new Date('2026-08-25') }));
const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { prepararMensajes } = require('../controllers/cobranzasController');
const req = body => ({ body: { canal: 'WHATSAPP', ids_estado_pension: [1], nivel: 2, ...body }, user: { id: 1 } });
const res = () => { const r = { json: jest.fn(), status: jest.fn() }; r.status.mockReturnValue(r); return r; };
beforeEach(() => {
  jest.clearAllMocks();
  prisma.tbl_estado_pension.findMany.mockResolvedValue([{ id: 1, id_alumno: 7, clave_mes: 'AGO', monto_pagado: 60, tbl_plantilla_pension: {}, tbl_compromisos_pago: [], tbl_alumnos: { estado: 'ACTIVO', nombre_completo: 'José Pérez', tbl_padres_alumnos: { tbl_padres: { id: 9, celular: '912345678', nombre_completo: 'Ana' } } } }]);
  prisma.tbl_colegio.findFirst.mockResolvedValue({});
  prisma.tbl_anios_escolares.findFirst.mockResolvedValue({ anio: 2026 });
  prisma.tbl_cobranza_envios.create.mockResolvedValue({ id: 15 });
});
test('vista previa recalcula saldo sin guardar, auditar ni generar enlaces', async () => {
  const r = res(); await prepararMensajes(req({ vista_previa: true }), r);
  const mensaje = r.json.mock.calls[0][0].data.preparados[0];
  expect(mensaje.total).toBe(110); expect(mensaje.mensaje).toContain('Agosto: S/110');
  expect(mensaje.enlace_apertura).toBeUndefined();
  expect(prisma.tbl_cobranza_envios.create).not.toHaveBeenCalled(); expect(registrarAuditoria).not.toHaveBeenCalled();
});
test('rechaza confirmación desactualizada sin registrar mensajes', async () => {
  const r = res(); await prepararMensajes(req({ revisados: [{ id_alumno: 7, mensaje: 'texto anterior' }] }), r);
  expect(r.status).toHaveBeenCalledWith(409); expect(prisma.tbl_cobranza_envios.create).not.toHaveBeenCalled();
});
test('confirmación conserva el texto revisado y registra nivel y total', async () => {
  const previa = res(); await prepararMensajes(req({ vista_previa: true }), previa);
  const revisados = previa.json.mock.calls[0][0].data.preparados;
  const r = res(); await prepararMensajes(req({ revisados }), r);
  expect(prisma.tbl_cobranza_envios.create).toHaveBeenCalledTimes(1);
  expect(registrarAuditoria).toHaveBeenCalledWith(expect.objectContaining({ accion: 'NIVEL_COBRANZA_PREPARADO', meta: expect.objectContaining({ nivel: 2, total: 110, id_alumno: 7, id_padre: 9 }) }));
});
