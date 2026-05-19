const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/anioEscolarController');

router.post('/migrar', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.migrar);
router.post('/clonar-aulas', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.clonarAulas);

module.exports = router;
