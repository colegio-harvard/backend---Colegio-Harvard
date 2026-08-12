const multer = require('multer');
const {
  EXTENSIONES_ADJUNTOS,
  esCombinacionArchivoPermitida,
} = require('../services/archivos/politicaArchivos');

// P-07: Whitelist adjuntos (JPG, PNG, PDF)
// P-08: Limite 10MB
// Almacenamiento en memoria — el buffer se sube a Wasabi en el controller
const uploadAdjunto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (esCombinacionArchivoPermitida(file.originalname, file.mimetype, EXTENSIONES_ADJUNTOS)) cb(null, true);
    else cb(new Error('Solo se permiten archivos JPG, PNG o PDF'));
  },
});

module.exports = uploadAdjunto;
