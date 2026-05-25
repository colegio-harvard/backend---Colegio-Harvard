const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/pensionesController');
const multer = require('multer');

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ].includes(file.mimetype) || /\.(xlsx|xls)$/i.test(file.originalname || '');
    if (ok) cb(null, true);
    else cb(new Error('Solo se permiten archivos Excel .xlsx o .xls'));
  },
});

router.get('/plantilla', verificarToken, ctrl.obtenerPlantilla);
router.get('/tickets', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.listarTickets);
router.get('/ticket/:codigo', ctrl.obtenerTicket);
router.get('/estado/:id_alumno', verificarToken, ctrl.obtenerEstado);
router.post('/registrar-pago', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.registrarPago);
router.get('/detalle/:id_alumno/:clave_mes', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.obtenerDetalleMes);
router.get('/cuadricula', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.cuadricula);
router.get('/reporte-pagos/exportar-excel', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.exportarReportePagosExcel);
router.post('/importar-excel/preview', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), uploadExcel.single('archivo'), ctrl.previewImportacionExcel);
router.post('/importar-excel/aplicar', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), uploadExcel.single('archivo'), ctrl.aplicarImportacionExcel);
router.post('/plantilla', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'), ctrl.guardarPlantilla);

module.exports = router;
