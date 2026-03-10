const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/pensionesController');

router.get('/plantilla', verificarToken, ctrl.obtenerPlantilla);
router.get('/estado/:id_alumno', verificarToken, ctrl.obtenerEstado);
router.post('/registrar-pago', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.registrarPago);
router.get('/detalle/:id_alumno/:clave_mes', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.obtenerDetalleMes);
router.get('/cuadricula', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.cuadricula);
router.post('/plantilla', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.guardarPlantilla);

module.exports = router;
