const VENTANA_ANTIDUPLICADO_MS = 5000;

const evaluarMarcacionRepetida = (fechaUltimoEvento, ahoraMs = Date.now()) => {
  if (!fechaUltimoEvento) return { bloqueada: false, segundosRestantes: 0 };
  const eventoMs = new Date(fechaUltimoEvento).getTime();
  if (!Number.isFinite(eventoMs)) return { bloqueada: false, segundosRestantes: 0 };
  const transcurridoMs = ahoraMs - eventoMs;
  if (transcurridoMs < 0 || transcurridoMs >= VENTANA_ANTIDUPLICADO_MS) {
    return { bloqueada: false, segundosRestantes: 0 };
  }
  return {
    bloqueada: true,
    segundosRestantes: Math.max(1, Math.ceil((VENTANA_ANTIDUPLICADO_MS - transcurridoMs) / 1000)),
  };
};

module.exports = { VENTANA_ANTIDUPLICADO_MS, evaluarMarcacionRepetida };
