const express = require('express');
const router = express.Router();
const { getFile } = require('../utils/storageService');
const {
  esContenidoAlmacenadoPermitido,
  sanitizarNombreDescarga,
  validarClaveArchivo,
} = require('../services/archivos/politicaArchivos');

router.get('/', async (req, res) => {
  const key = validarClaveArchivo(req.query.key);

  if (!key) {
    return res.status(400).json({ error: 'Archivo no valido' });
  }

  try {
    const file = await getFile(key);
    if (!esContenidoAlmacenadoPermitido(key, file.ContentType)) {
      return res.status(415).json({ error: 'Tipo de archivo no permitido' });
    }
    if (file.ContentType) res.setHeader('Content-Type', file.ContentType);
    if (file.ContentLength) res.setHeader('Content-Length', String(file.ContentLength));
    res.setHeader('Content-Disposition', `inline; filename="${sanitizarNombreDescarga(key)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300, must-revalidate');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    file.Body.once('error', streamError => {
      console.error('Error al transmitir archivo:', streamError);
      if (!res.headersSent) res.status(500).json({ error: 'Error al obtener archivo' });
      else res.destroy(streamError);
    });
    file.Body.pipe(res);
  } catch (error) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    console.error('Error al servir archivo:', error);
    res.status(500).json({ error: 'Error al obtener archivo' });
  }
});

module.exports = router;
