const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/comunicadosController');

router.get('/', verificarToken, ctrl.listar);
router.post('/', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN', 'PSICOLOGIA'), ctrl.crear);
router.get('/alumno/:id', verificarToken, ctrl.listarPorAlumno);
router.put('/:id/leido', verificarToken, ctrl.marcarLeido);

module.exports = router;
