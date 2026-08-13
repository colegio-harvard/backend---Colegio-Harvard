const path = require('path');

const PREFIJOS_PERMITIDOS = Object.freeze({
  'fotos/': new Set(['.jpg', '.jpeg', '.png', '.webp']),
  'adjuntos/': new Set(['.jpg', '.jpeg', '.png', '.pdf']),
});

const TIPOS_PERMITIDOS = Object.freeze({
  '.jpg': new Set(['image/jpeg']),
  '.jpeg': new Set(['image/jpeg']),
  '.png': new Set(['image/png']),
  '.webp': new Set(['image/webp']),
  '.pdf': new Set(['application/pdf']),
});

const TIPO_GENERICO_ALMACENAMIENTO = 'application/octet-stream';

const normalizarExtension = (nombre = '') => path.extname(String(nombre)).toLowerCase();

const esCombinacionArchivoPermitida = (nombre, mimetype, extensionesPermitidas) => {
  const extension = normalizarExtension(nombre);
  const tipos = TIPOS_PERMITIDOS[extension];
  return Boolean(
    extension
    && extensionesPermitidas.has(extension)
    && tipos
    && tipos.has(String(mimetype || '').toLowerCase()),
  );
};

const validarClaveArchivo = (valor) => {
  const clave = String(valor || '').trim();
  if (!clave || clave.length > 512 || clave.includes('\0') || clave.includes('\\')) return null;
  if (clave.startsWith('/') || clave.includes('..') || clave.includes('//')) return null;

  const prefijo = Object.keys(PREFIJOS_PERMITIDOS).find(item => clave.startsWith(item));
  if (!prefijo) return null;

  const extension = normalizarExtension(clave);
  if (!PREFIJOS_PERMITIDOS[prefijo].has(extension)) return null;
  return clave;
};

const sanitizarNombreDescarga = (nombre = 'archivo') => {
  const base = path.basename(String(nombre)).replace(/[\r\n"\\]/g, '_').trim();
  return base.slice(0, 180) || 'archivo';
};

const esContenidoAlmacenadoPermitido = (clave, mimetype) => {
  const prefijo = Object.keys(PREFIJOS_PERMITIDOS).find(item => String(clave).startsWith(item));
  const tipoNormalizado = String(mimetype || '').toLowerCase().trim();
  // Las fotos históricas fueron cargadas con distintos MIME (image/jpg,
  // binary/octet-stream, etc.). La clave ya se valida contra el prefijo fotos/
  // y una extensión de imagen permitida; además se sirve con MIME inferido y
  // nosniff, por lo que no se depende del metadato antiguo de Wasabi.
  if (prefijo === 'fotos/') return true;
  return Boolean(
    prefijo
    && (
      esCombinacionArchivoPermitida(clave, tipoNormalizado, PREFIJOS_PERMITIDOS[prefijo])
      // Algunos objetos históricos de Wasabi se guardaron sin un MIME específico.
      // La clave ya fue restringida a prefijos y extensiones seguras, por lo que se
      // permite únicamente el tipo binario genérico y se sirve con el MIME inferido.
      || tipoNormalizado === TIPO_GENERICO_ALMACENAMIENTO
      || !tipoNormalizado
    ),
  );
};

const tipoContenidoPorClave = (clave) => {
  const tipos = TIPOS_PERMITIDOS[normalizarExtension(clave)];
  return tipos ? [...tipos][0] : null;
};

module.exports = {
  EXTENSIONES_FOTOS: PREFIJOS_PERMITIDOS['fotos/'],
  EXTENSIONES_ADJUNTOS: PREFIJOS_PERMITIDOS['adjuntos/'],
  esContenidoAlmacenadoPermitido,
  esCombinacionArchivoPermitida,
  normalizarExtension,
  sanitizarNombreDescarga,
  tipoContenidoPorClave,
  validarClaveArchivo,
};
