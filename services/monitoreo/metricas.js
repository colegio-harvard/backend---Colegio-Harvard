const VENTANA_MAXIMA_MINUTOS = 60;
const intervalos = new Map();

const claveMinuto = (fecha = new Date()) => fecha.toISOString().slice(0, 16);

const limpiarIntervalos = (ahora = Date.now()) => {
  const limite = ahora - VENTANA_MAXIMA_MINUTOS * 60 * 1000;
  for (const [clave, valor] of intervalos) {
    if (valor.inicio < limite) intervalos.delete(clave);
  }
};

const registrarPeticion = ({ duracionMs, estado, fecha = new Date() }) => {
  const clave = claveMinuto(fecha);
  const actual = intervalos.get(clave) || {
    inicio: fecha.getTime(),
    peticiones: 0,
    errores: 0,
    duracion_total_ms: 0,
    duracion_maxima_ms: 0,
  };
  actual.peticiones += 1;
  actual.errores += Number(estado) >= 500 ? 1 : 0;
  actual.duracion_total_ms += Math.max(0, Number(duracionMs) || 0);
  actual.duracion_maxima_ms = Math.max(actual.duracion_maxima_ms, Number(duracionMs) || 0);
  intervalos.set(clave, actual);
  limpiarIntervalos(fecha.getTime());
};

const resumir = (minutos = 15, ahora = Date.now()) => {
  const limite = ahora - minutos * 60 * 1000;
  const valores = [...intervalos.values()].filter(item => item.inicio >= limite);
  const totales = valores.reduce((total, item) => ({
    peticiones: total.peticiones + item.peticiones,
    errores: total.errores + item.errores,
    duracion_total_ms: total.duracion_total_ms + item.duracion_total_ms,
    duracion_maxima_ms: Math.max(total.duracion_maxima_ms, item.duracion_maxima_ms),
  }), { peticiones: 0, errores: 0, duracion_total_ms: 0, duracion_maxima_ms: 0 });

  return {
    minutos,
    peticiones: totales.peticiones,
    errores_servidor: totales.errores,
    porcentaje_error: totales.peticiones
      ? Number(((totales.errores / totales.peticiones) * 100).toFixed(2))
      : 0,
    respuesta_promedio_ms: totales.peticiones
      ? Math.round(totales.duracion_total_ms / totales.peticiones)
      : 0,
    respuesta_maxima_ms: Math.round(totales.duracion_maxima_ms),
  };
};

const reiniciarMetricas = () => intervalos.clear();

module.exports = { registrarPeticion, reiniciarMetricas, resumir };
