const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/alertasController');

router.post('/ejecutar', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.ejecutarAlertasManual);
router.get('/padre', verificarToken, verificarRol('PADRE'), ctrl.listarAlertasPadre);
router.get('/admin', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.listarAlertasAdmin);

module.exports = router;
