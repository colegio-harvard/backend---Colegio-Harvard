const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/libretasController');

const accesoAcademico = verificarRol('SUPER_ADMIN', 'TUTOR', 'DOCENTE');

router.use(verificarToken);
router.get('/bootstrap', accesoAcademico, ctrl.bootstrap);
router.get('/notas', accesoAcademico, ctrl.obtenerNotas);
router.post('/notas', accesoAcademico, ctrl.guardarNotas);
router.post('/comentarios-docente', accesoAcademico, ctrl.guardarComentarioDocente);
router.post('/acompanamiento', verificarRol('SUPER_ADMIN', 'TUTOR'), ctrl.guardarAcompanamiento);

router.post('/areas', verificarRol('SUPER_ADMIN'), ctrl.crearArea);
router.put('/areas/:id', verificarRol('SUPER_ADMIN'), ctrl.actualizarArea);
router.delete('/areas/:id', verificarRol('SUPER_ADMIN'), ctrl.eliminarArea);
router.post('/cursos', verificarRol('SUPER_ADMIN'), ctrl.crearCurso);
router.put('/cursos/:id', verificarRol('SUPER_ADMIN'), ctrl.actualizarCurso);
router.delete('/cursos/:id', verificarRol('SUPER_ADMIN'), ctrl.eliminarCurso);
router.post('/asignaciones', verificarRol('SUPER_ADMIN'), ctrl.asignarCurso);
router.put('/periodos/:id', verificarRol('SUPER_ADMIN'), ctrl.cambiarPeriodo);
router.post('/catalogo', verificarRol('SUPER_ADMIN'), ctrl.guardarCatalogo);
router.patch('/catalogo/:id', verificarRol('SUPER_ADMIN'), ctrl.cambiarCatalogo);
router.get('/merito', verificarRol('SUPER_ADMIN'), ctrl.merito);
router.get('/auditoria', verificarRol('SUPER_ADMIN'), ctrl.auditoriaNotas);
router.get('/libreta/:id', verificarRol('SUPER_ADMIN'), ctrl.libreta);

module.exports = router;
