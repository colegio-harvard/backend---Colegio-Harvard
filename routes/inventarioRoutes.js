const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/inventarioController');

const router = express.Router();
router.use(verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'));
router.get('/resumen', ctrl.resumen);
router.get('/productos', ctrl.listarProductos);
router.post('/productos', ctrl.crearProducto);
router.put('/productos/:id', ctrl.actualizarProducto);
router.get('/movimientos', ctrl.listarMovimientos);
router.post('/movimientos', ctrl.registrarMovimiento);
router.get('/ventas', ctrl.listarVentas);
router.post('/ventas', ctrl.crearVenta);
router.get('/exportar', ctrl.exportar);

module.exports = router;
