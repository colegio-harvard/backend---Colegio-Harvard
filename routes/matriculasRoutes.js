const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const { createRateLimiter } = require('../middleware/securityMiddleware');
const ctrl = require('../controllers/matriculasController');

const router = express.Router();
const soloGestion = [verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN')];

router.get('/publica/:token', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 80, keyPrefix: 'matricula-publica' }), ctrl.obtenerPublica);
router.post('/publica/:token/aceptar', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 12, keyPrefix: 'matricula-otp' }), ctrl.aceptar);
router.get('/bootstrap', ...soloGestion, ctrl.bootstrap);
router.put('/configuracion', ...soloGestion, ctrl.guardarConfiguracion);
router.post('/invitar', ...soloGestion, ctrl.invitar);
router.get('/:id', ...soloGestion, ctrl.detalle);
router.put('/:id/borrador-asistido', ...soloGestion, ctrl.guardarBorradorAsistido);
router.put('/:id/control-documental', ...soloGestion, ctrl.guardarControlDocumental);
router.put('/:id/revisar', ...soloGestion, ctrl.revisar);

module.exports = router;

