const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/configEscolarController');

// Anios escolares
router.get('/anios', verificarToken, ctrl.listarAnios);
router.post('/anios', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.crearAnio);
router.put('/anios/:id/activar', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.activarAnio);

// Niveles
router.get('/niveles', verificarToken, ctrl.listarNiveles);
router.post('/niveles', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.crearNivel);

// Grados
router.get('/grados', verificarToken, ctrl.listarGrados);
router.post('/grados', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.crearGrado);

// Aulas
router.get('/aulas', verificarToken, ctrl.listarAulas);
router.post('/aulas/asignar-tutor', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.asignarTutor);
router.get('/aulas/:id', verificarToken, ctrl.obtenerAula);
router.post('/aulas', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.crearAula);
router.put('/aulas/:id', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.actualizarAula);

// Calendario escolar
router.get('/calendario/:id_anio_escolar', verificarToken, ctrl.listarCalendario);
router.post('/calendario', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.actualizarDiaCalendario);

// Puntos de escaneo
router.get('/puntos-escaneo', verificarToken, ctrl.listarPuntosEscaneo);
router.post('/puntos-escaneo', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.crearPuntoEscaneo);
router.post('/puntos-escaneo/asignar-porteria', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.asignarPorteria);

// Horarios por nivel
router.get('/horarios', verificarToken, ctrl.listarHorarios);
router.post('/horarios', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.guardarHorario);

// Meses escolares (fuente centralizada)
router.get('/meses', verificarToken, ctrl.listarMeses);

// Datos del colegio
router.get('/colegio', verificarToken, ctrl.obtenerColegio);
router.put('/colegio', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.actualizarColegio);

module.exports = router;
