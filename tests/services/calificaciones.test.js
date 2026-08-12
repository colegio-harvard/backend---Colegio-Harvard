const { notaValida, notaNumericaValida, letraDesdeNumero } = require('../../services/libretas/calificaciones');

describe('reglas de calificación', () => {
  test.each(['AD', 'A', 'B', 'C', 'ad'])('acepta %s', (nota) => expect(notaValida(nota)).toBe(true));
  test.each([-1, 21, '', null, 'texto'])('rechaza %s', (nota) => expect(notaNumericaValida(nota)).toBe(false));
  test.each([[20, 'AD'], [16, 'AD'], [15, 'A'], [11, 'A'], [10, 'B'], [6, 'B'], [5, 'C'], [0, 'C']])(
    'convierte %s en %s', (numero, letra) => expect(letraDesdeNumero(numero)).toBe(letra),
  );
});
