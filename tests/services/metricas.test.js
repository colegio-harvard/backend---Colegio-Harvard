const {
  registrarPeticion,
  reiniciarMetricas,
  resumir,
} = require('../../services/monitoreo/metricas');

describe('metricas operativas', () => {
  beforeEach(reiniciarMetricas);

  test('resume tiempos y errores sin almacenar datos personales', () => {
    const fecha = new Date('2026-08-12T18:00:00.000Z');
    registrarPeticion({ duracionMs: 100, estado: 200, fecha });
    registrarPeticion({ duracionMs: 300, estado: 503, fecha });
    expect(resumir(15, fecha.getTime() + 1000)).toEqual({
      minutos: 15,
      peticiones: 2,
      errores_servidor: 1,
      porcentaje_error: 50,
      respuesta_promedio_ms: 200,
      respuesta_maxima_ms: 300,
    });
  });

  test('excluye intervalos fuera de la ventana solicitada', () => {
    registrarPeticion({
      duracionMs: 50,
      estado: 200,
      fecha: new Date('2026-08-12T16:00:00.000Z'),
    });
    expect(resumir(15, new Date('2026-08-12T18:00:00.000Z').getTime()).peticiones).toBe(0);
  });
});
