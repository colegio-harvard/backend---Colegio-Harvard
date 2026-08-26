const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/alumnosController');
const retirosCtrl = require('../controllers/retirosAlumnosController');
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
router.get('/siguiente-codigo', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.siguienteCodigo);
router.get('/exportar-aulas-excel', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.exportarAulasExcel);
router.post('/', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), upload.single('foto'), ctrl.crear);
router.post('/vincular', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.vincularPadre);
router.get('/carnet/:id_alumno', verificarToken, ctrl.obtenerCarnet);
router.get('/:id/retiro', verificarToken, verificarRol('SUPER_ADMIN'), retirosCtrl.obtenerInfoRetiro);
router.post('/:id/retirar', verificarToken, verificarRol('SUPER_ADMIN'), retirosCtrl.retirar);
router.post('/:id/reactivar', verificarToken, verificarRol('SUPER_ADMIN'), retirosCtrl.reactivar);
router.delete('/desvincular/:id_alumno', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.desvincularPadre);
router.post('/reemitir-carnet/:id_alumno', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.reemitirCarnet);
router.get('/:id', verificarToken, ctrl.obtenerPorId);
router.put('/:id', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), upload.single('foto'), ctrl.actualizar);
router.post('/:id/foto', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), upload.single('foto'), ctrl.subirFoto);
router.delete('/:id', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.eliminar);

module.exports = router;

