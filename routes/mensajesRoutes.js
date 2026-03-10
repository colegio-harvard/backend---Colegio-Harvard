const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const ctrl = require('../controllers/mensajesController');
const uploadAdjunto = require('../config/uploadAdjuntos');

router.get('/destinatarios', verificarToken, ctrl.listarDestinatarios);
router.get('/hilos', verificarToken, ctrl.listarHilos);
router.post('/hilos', verificarToken, uploadAdjunto.single('adjunto'), ctrl.crearHilo);
router.get('/hilos/:id_hilo', verificarToken, ctrl.obtenerMensajes);
router.post('/hilos/:id_hilo/responder', verificarToken, uploadAdjunto.single('adjunto'), ctrl.responder);

module.exports = router;
