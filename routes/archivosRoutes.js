const express = require('express');
const path = require('path');
const router = express.Router();
const prisma = require('../config/prisma');
const { getFile, listFiles } = require('../utils/storageService');
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

const buscarClaveHistorica = async (referencia, codigoAlumno) => {
  const segmentos = String(referencia || '').replace(/\\/g, '/').split('/').filter(Boolean);
  const nombreEsperado = path.basename(segmentos.at(-1) || '').toLowerCase();
  const codigo = String(codigoAlumno || '').toLowerCase();
  const objetos = await listFiles('fotos/');

  const porNombre = objetos.find(objeto => path.basename(objeto.Key || '').toLowerCase() === nombreEsperado);
  if (porNombre) return porNombre.Key;

  const porCodigo = codigo
    ? objetos.filter(objeto => path.basename(objeto.Key || '').toLowerCase().includes(codigo))
    : [];
  return porCodigo.length === 1 ? porCodigo[0].Key : null;
};

router.get('/', async (req, res) => {
  // El frontend y el backend se publican en subdominios distintos de Railway.
  // Las fotos se usan como recursos <img> entre esos dos orígenes, por lo que
  // `same-site` hace que algunos navegadores las bloqueen aunque el archivo
  // exista y la petición responda correctamente.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  let referencia = req.query.ref;
  let alumno = null;
  if (req.query.alumno) {
    const id = Number.parseInt(req.query.alumno, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Alumno no valido' });
    alumno = await prisma.tbl_alumnos.findUnique({
      where: { id },
      select: { foto_url: true, codigo_alumno: true },
    });
    if (!alumno?.foto_url) return res.status(404).json({ error: 'El alumno no tiene foto registrada' });
    referencia = alumno.foto_url;
  }

  const claves = referencia
    ? clavesDesdeReferencia(referencia)
    : [validarClaveArchivo(req.query.key)].filter(Boolean);

  if (!claves.length) {
    return res.status(400).json({ error: 'Archivo no valido' });
  }

  try {
    let resultado = await obtenerPrimeraClaveExistente(claves);
    if (!resultado && alumno) {
      const claveHistorica = await buscarClaveHistorica(referencia, alumno.codigo_alumno);
      if (claveHistorica) resultado = await obtenerPrimeraClaveExistente([claveHistorica]);
    }
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
