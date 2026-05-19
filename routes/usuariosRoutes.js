const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/usuariosController');

router.get('/roles', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.listarRoles);
router.get('/', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.listar);
router.get('/:id', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.obtenerPorId);
router.post('/', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.crear);
router.put('/:id', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.actualizar);
router.put('/:id/reset-password', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.resetearContrasena);
router.delete('/:id', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.eliminar);

module.exports = router;
