const express = require('express');
const router = express.Router();
const { getFile } = require('../utils/storageService');

const ALLOWED_PREFIXES = ['fotos/', 'adjuntos/'];

router.get('/', async (req, res) => {
  const key = String(req.query.key || '');

  if (!key || key.includes('..') || key.startsWith('/') || !ALLOWED_PREFIXES.some(prefix => key.startsWith(prefix))) {
    return res.status(400).json({ error: 'Archivo no valido' });
  }

  try {
    const file = await getFile(key);
    if (file.ContentType) res.setHeader('Content-Type', file.ContentType);
    if (file.ContentLength) res.setHeader('Content-Length', String(file.ContentLength));
    res.setHeader('Cache-Control', 'public, max-age=86400');
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
