const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/agendaController');

router.get('/', verificarToken, ctrl.listar);
router.post('/', verificarToken, verificarRol('TUTOR', 'SUPER_ADMIN'), ctrl.publicar);
router.post('/masivo', verificarToken, verificarRol('TUTOR', 'SUPER_ADMIN'), ctrl.publicarMasivo);
router.post('/firmar', verificarToken, verificarRol('PADRE'), ctrl.firmar);
router.post('/responder', verificarToken, verificarRol('PADRE'), ctrl.responder);

module.exports = router;
