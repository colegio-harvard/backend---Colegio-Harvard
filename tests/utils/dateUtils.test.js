const { todayLima, currentMesLima, parseDateOnly, parseClientDateTime } = require('../../utils/dateUtils');

describe('fechas civiles del colegio', () => {
  afterEach(() => jest.useRealTimers());

  test('mantiene el dia anterior en Lima cuando UTC ya cambio de fecha', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-13T02:30:00.000Z'));
    expect(todayLima().iso).toBe('2026-08-12');
    expect(currentMesLima()).toEqual({ key: 'AGO', label: 'Agosto' });
  });

  test('crea fechas civiles sin depender de la zona horaria del servidor', () => {
    expect(parseDateOnly('2026-08-12').toISOString()).toBe('2026-08-12T00:00:00.000Z');
  });

  test('rechaza fechas y horas sin zona explicita', () => {
    expect(parseClientDateTime('2026-08-12T08:00:00')).toBeNull();
    expect(parseClientDateTime('2026-08-12T08:00:00-05:00')).toBeInstanceOf(Date);
  });
});
