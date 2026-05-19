const multer = require('multer');

// P-07: Whitelist adjuntos (JPG, PNG, PDF)
// P-08: Limite 10MB
// Almacenamiento en memoria — el buffer se sube a Wasabi en el controller
const uploadAdjunto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = ['image/jpeg', 'image/png', 'application/pdf'];
    if (tiposPermitidos.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten archivos JPG, PNG o PDF'));
  },
});

module.exports = uploadAdjunto;
