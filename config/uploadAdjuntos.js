const multer = require('multer');
const path = require('path');

// P-07: Whitelist adjuntos (JPG, PNG, PDF)
// P-08: Limite 10MB
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'adjuntos'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const prefix = req.baseUrl.includes('mensajes') ? 'msg' : 'desc';
    cb(null, `${prefix}-${req.user.id}-${Date.now()}${ext}`);
  },
});

const uploadAdjunto = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = ['image/jpeg', 'image/png', 'application/pdf'];
    if (tiposPermitidos.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten archivos JPG, PNG o PDF'));
  },
});

module.exports = uploadAdjunto;
