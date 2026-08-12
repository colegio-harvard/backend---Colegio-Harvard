const { registrarPeticion } = require('../services/monitoreo/metricas');

const medirPeticiones = (req, res, next) => {
  const inicio = process.hrtime.bigint();
  res.once('finish', () => {
    const duracionMs = Number(process.hrtime.bigint() - inicio) / 1e6;
    registrarPeticion({ duracionMs, estado: res.statusCode });
  });
  next();
};

module.exports = medirPeticiones;
