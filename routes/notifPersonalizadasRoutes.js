const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/notifPersonalizadasController');

router.post('/', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.crear);
router.get('/', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.listar);
router.delete('/:id', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.eliminar);
router.put('/:id/aceptar-modal', verificarToken, ctrl.aceptarModal);

module.exports = router;
