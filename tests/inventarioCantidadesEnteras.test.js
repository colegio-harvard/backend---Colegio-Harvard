const fs = require('fs');
const path = require('path');

const controlador = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'inventarioController.js'),
  'utf8',
);

describe('Inventario: cantidades enteras', () => {
  test('rechaza decimales antes de guardar stock, movimientos o ventas', () => {
    expect(controlador).toContain('const entero = (valor, nombre, minimo = 0)');
    expect(controlador).toContain('Number.isInteger(value)');
    expect(controlador).toContain('debe ser un número entero');
    expect(controlador).toContain("entero(cantidad, 'Cantidad', 1)");
    expect(controlador).toContain("entero(item.cantidad, 'Cantidad', 1)");
  });

  test('no trunca silenciosamente cantidades de inventario', () => {
    expect(controlador).not.toContain("Math.trunc(numero(cantidad, 'Cantidad', 1))");
    expect(controlador).not.toContain("Math.trunc(numero(item.cantidad, 'Cantidad', 1))");
  });
});
