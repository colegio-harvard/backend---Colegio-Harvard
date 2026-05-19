const express = require('express');
const router = express.Router();
const { obtenerDatosLanding } = require('../controllers/landingController');

router.get('/', obtenerDatosLanding);

module.exports = router;
