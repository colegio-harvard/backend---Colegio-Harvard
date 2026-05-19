const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/asistenciaController');

router.post('/registrar', verificarToken, verificarRol('PORTERIA'), ctrl.registrarEvento);
router.get('/calendario', verificarToken, verificarRol('PADRE', 'TUTOR', 'SUPER_ADMIN', 'ADMIN'), ctrl.calendarioPadre);
router.get('/hijos', verificarToken, verificarRol('PADRE'), ctrl.obtenerHijosPadre);
router.get('/hoy', verificarToken, verificarRol('TUTOR', 'SUPER_ADMIN', 'ADMIN'), ctrl.asistenciaHoyTutor);
router.get('/aulas-tutor', verificarToken, verificarRol('TUTOR'), ctrl.obtenerAulasTutor);
router.get('/dashboard-admin', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.dashboardAdmin);
router.get('/global', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.asistenciaGlobal);
router.get('/exportar-excel', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.exportarExcel);
router.post('/corregir', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.corregirAsistencia);
router.get('/historial-porteria', verificarToken, verificarRol('PORTERIA'), ctrl.historialPorteria);

module.exports = router;
