const express = require('express');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('../config/wasabi');

const router = express.Router();
const BUCKET = process.env.WASABI_BUCKET || 'colegio-fernando-storage';

// Proxy: sirve archivos de Wasabi sin requerir acceso público al bucket.
// GET /api/archivos?key=fotos/alumno-123.jpg  →  stream desde Wasabi
router.get('/', async (req, res) => {
  const key = req.query.key;
  if (!key) return res.status(400).json({ error: 'Key requerida' });

  try {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const data = await s3.send(command);

    res.set('Content-Type', data.ContentType || 'application/octet-stream');
    res.set('Content-Length', data.ContentLength);
    res.set('Cache-Control', 'public, max-age=86400'); // cache 24h
    res.set('Access-Control-Allow-Origin', '*');

    data.Body.pipe(res);
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    console.error('[ARCHIVOS] Error al obtener archivo:', err.message);
    res.status(500).json({ error: 'Error al obtener archivo' });
  }
});

module.exports = router;
