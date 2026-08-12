const notaValida = (value) => ['AD', 'A', 'B', 'C'].includes(String(value || '').toUpperCase());
const notaNumericaValida = (value) => value !== '' && value !== null
  && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 20;

const letraDesdeNumero = (value) => {
  const numero = Number(value);
  if (numero >= 16) return 'AD';
  if (numero >= 11) return 'A';
  if (numero >= 6) return 'B';
  return 'C';
};

module.exports = { notaValida, notaNumericaValida, letraDesdeNumero };
