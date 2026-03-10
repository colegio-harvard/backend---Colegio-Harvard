const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/notificacionesController');

router.get('/', verificarToken, ctrl.listar);
router.put('/:id/leida', verificarToken, ctrl.marcarLeida);
router.put('/todas-leidas', verificarToken, ctrl.marcarTodasLeidas);
router.get('/no-leidas', verificarToken, ctrl.contarNoLeidas);
router.get('/plantillas', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.listarPlantillas);
router.put('/plantillas/:id', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.actualizarPlantilla);
router.get('/config-pension', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.obtenerConfigPension);
router.put('/config-pension', verificarToken, verificarRol('SUPER_ADMIN'), ctrl.actualizarConfigPension);
router.get('/verificar-pension', verificarToken, verificarRol('PADRE'), ctrl.verificarPensionReminder);
router.get('/modal-pendiente', verificarToken, ctrl.obtenerModalPendiente);

module.exports = router;
