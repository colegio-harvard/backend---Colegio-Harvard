const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/auditoriaController');
const calidad = require('../controllers/calidadController');
const monitoreo = require('../controllers/monitoreoController');

router.get('/', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.listar);
router.get('/acciones', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.listarAcciones);
router.get('/exportar-excel', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.exportarExcel);
router.get('/calidad', verificarToken, verificarRol('SUPER_ADMIN'), calidad.diagnostico);
router.get('/estado-sistema', verificarToken, verificarRol('SUPER_ADMIN'), monitoreo.estadoSistema);

module.exports = router;
