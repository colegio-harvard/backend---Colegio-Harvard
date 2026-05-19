const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/alumnosController');
const multer = require('multer');

// Multer en memoria — el buffer se sube a Wasabi en el controller
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const tipos = ['image/jpeg', 'image/png', 'image/webp'];
    if (tipos.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imagenes JPG, PNG o WEBP'));
  },
});

router.get('/', verificarToken, ctrl.listar);
router.post('/', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), upload.single('foto'), ctrl.crear);
router.post('/vincular', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.vincularPadre);
router.get('/carnet/:id_alumno', verificarToken, ctrl.obtenerCarnet);
router.delete('/desvincular/:id_alumno', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.desvincularPadre);
router.post('/reemitir-carnet/:id_alumno', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.reemitirCarnet);
router.get('/:id', verificarToken, ctrl.obtenerPorId);
router.put('/:id', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), upload.single('foto'), ctrl.actualizar);
router.post('/:id/foto', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), upload.single('foto'), ctrl.subirFoto);

module.exports = router;
