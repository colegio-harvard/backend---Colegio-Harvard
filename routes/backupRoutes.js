const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/backupController');

router.get('/sistema', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.descargarSistema);

module.exports = router;
