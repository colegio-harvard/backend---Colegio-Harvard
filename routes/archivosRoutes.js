const express = require('express');
const router = express.Router();
const { getFile } = require('../utils/storageService');
const {
  esContenidoAlmacenadoPermitido,
  sanitizarNombreDescarga,
  tipoContenidoPorClave,
  validarClaveArchivo,
} = require('../services/archivos/politicaArchivos');

const clavesDesdeReferencia = (referencia) => {
  const valor = String(referencia || '').trim();
  if (!valor || valor.length > 2048 || valor.includes('\0')) return [];

  let ruta = valor;
  try {
    ruta = new URL(valor).pathname;
  } catch {
    // Las rutas relativas historicas se procesan directamente.
  }

  for (let intento = 0; intento < 2; intento += 1) {
    try {
      const decodificada = decodeURIComponent(ruta);
      if (decodificada === ruta) break;
      ruta = decodificada;
    } catch {
      break;
    }
  }

  const segmentos = ruta.replace(/\\/g, '/').split('/').filter(Boolean);
  const candidatos = [];
  const indiceFotos = segmentos.findIndex(segmento => segmento.toLowerCase() === 'fotos');
  if (indiceFotos >= 0) candidatos.push(`fotos/${segmentos.slice(indiceFotos + 1).join('/')}`);

  // Versiones iniciales guardaron /uploads/<archivo> mientras Wasabi conservaba
  // el objeto en fotos/<archivo>. Este candidato recupera esas referencias.
  const nombre = segmentos.at(-1);
  if (nombre) candidatos.push(`fotos/${nombre}`);

  return [...new Set(candidatos.map(validarClaveArchivo).filter(Boolean))];
};

const obtenerPrimeraClaveExistente = async (claves) => {
  for (const clave of claves) {
    try {
      return { clave, file: await getFile(clave) };
    } catch (error) {
      if (error.name !== 'NoSuchKey' && error.$metadata?.httpStatusCode !== 404) throw error;
    }
  }
  return null;
};

router.get('/', async (req, res) => {
  const claves = req.query.ref
    ? clavesDesdeReferencia(req.query.ref)
    : [validarClaveArchivo(req.query.key)].filter(Boolean);

  if (!claves.length) {
    return res.status(400).json({ error: 'Archivo no valido' });
  }

  try {
    const resultado = await obtenerPrimeraClaveExistente(claves);
    if (!resultado) return res.status(404).json({ error: 'Archivo no encontrado' });
    const { clave: key, file } = resultado;
    if (!esContenidoAlmacenadoPermitido(key, file.ContentType)) {
      return res.status(415).json({ error: 'Tipo de archivo no permitido' });
    }
    // No se confía en el MIME histórico del objeto: se deriva de una extensión
    // previamente validada para que las fotos antiguas genéricas se visualicen.
    res.setHeader('Content-Type', tipoContenidoPorClave(key));
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
