const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/padresController');

router.get('/', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.listar);
router.get('/buscar', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.buscar);
router.get('/:id', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.obtenerPorId);
router.post('/', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.crear);
router.put('/:id', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.actualizar);
router.delete('/:id', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.eliminar);

module.exports = router;
