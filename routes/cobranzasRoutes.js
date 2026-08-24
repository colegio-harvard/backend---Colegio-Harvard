const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/cobranzasController');
const router = express.Router();
router.use(verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'));
router.get('/candidatos', ctrl.listarCandidatos);
router.post('/compromisos', ctrl.registrarCompromiso);
router.patch('/compromisos/:id', ctrl.actualizarCompromiso);
router.post('/mensajes/preparar', ctrl.prepararMensajes);
router.get('/mensajes/cola', ctrl.listarCola);
router.patch('/mensajes/:id/estado', ctrl.actualizarEstadoEnvio);
module.exports = router;



