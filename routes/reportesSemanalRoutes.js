const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/reportesSemanalController');

router.get('/', verificarToken, ctrl.listar);
router.post('/', verificarToken, verificarRol('TUTOR', 'SUPER_ADMIN'), ctrl.crear);
router.post('/firmar', verificarToken, verificarRol('PADRE'), ctrl.firmar);

module.exports = router;
