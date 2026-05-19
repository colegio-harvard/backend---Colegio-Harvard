const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/auditoriaController');

router.get('/', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.listar);
router.get('/acciones', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.listarAcciones);
router.get('/exportar-excel', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.exportarExcel);

module.exports = router;
