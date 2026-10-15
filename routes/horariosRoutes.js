const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/horariosController');

const router = express.Router();
const administradores = [verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN')];

router.get('/padre/mis-horarios', verificarToken, verificarRol('PADRE'), ctrl.misHorariosPadre);

router.get('/bloques', ...administradores, ctrl.listarBloques);
router.post('/bloques', ...administradores, ctrl.crearBloque);
router.put('/bloques/:id', ...administradores, ctrl.actualizarBloque);
router.patch('/bloques/:id/desactivar', ...administradores, ctrl.desactivarBloque);
router.get('/asignaciones', ...administradores, ctrl.listarAsignaciones);
router.get('/:id/carga-horaria', ...administradores, ctrl.obtenerCargaHoraria);
router.put('/asignaciones/:id/carga-horaria', ...administradores, ctrl.actualizarCargaHoraria);
router.get('/disponibilidad/docentes', ...administradores, ctrl.listarDocentesDisponibilidad);
router.get('/disponibilidad', ...administradores, ctrl.obtenerDisponibilidad);
router.put('/disponibilidad', ...administradores, ctrl.guardarDisponibilidad);
router.delete('/disponibilidad', ...administradores, ctrl.restaurarDisponibilidad);

router.get('/', ...administradores, ctrl.listarHorarios);
router.post('/', ...administradores, ctrl.crearBorrador);
router.get('/:id', ...administradores, ctrl.obtenerHorario);
router.put('/:id', ...administradores, ctrl.actualizarBorrador);
router.post('/:id/clases', ...administradores, ctrl.agregarClase);
router.put('/:id/clases/:idDetalle', ...administradores, ctrl.modificarClase);
router.delete('/:id/clases/:idDetalle', ...administradores, ctrl.eliminarClase);
router.post('/:id/validar', ...administradores, ctrl.validarHorario);
router.post('/:id/publicar', ...administradores, ctrl.publicarHorario);
router.post('/:id/archivar', ...administradores, ctrl.archivarHorario);

module.exports = router;
