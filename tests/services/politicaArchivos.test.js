const {
  EXTENSIONES_ADJUNTOS,
  EXTENSIONES_FOTOS,
  esContenidoAlmacenadoPermitido,
  esCombinacionArchivoPermitida,
  normalizarExtension,
  sanitizarNombreDescarga,
  tipoContenidoPorClave,
  validarClaveArchivo,
} = require('../../services/archivos/politicaArchivos');

describe('politica de archivos', () => {
  test('acepta claves validas de fotos y adjuntos', () => {
    expect(validarClaveArchivo('fotos/alumno-123.webp')).toBe('fotos/alumno-123.webp');
    expect(validarClaveArchivo('adjuntos/msg-10-20.pdf')).toBe('adjuntos/msg-10-20.pdf');
  });

  test.each([
    '../secreto.pdf',
    '/fotos/alumno.jpg',
    'fotos\\alumno.jpg',
    'fotos//alumno.jpg',
    'otros/archivo.pdf',
    'fotos/documento.pdf',
    'adjuntos/programa.exe',
  ])('rechaza una clave insegura: %s', clave => {
    expect(validarClaveArchivo(clave)).toBeNull();
  });

  test('valida de forma conjunta extension y tipo declarado', () => {
    expect(esCombinacionArchivoPermitida('foto.JPG', 'image/jpeg', EXTENSIONES_FOTOS)).toBe(true);
    expect(esCombinacionArchivoPermitida('foto.exe', 'image/jpeg', EXTENSIONES_FOTOS)).toBe(false);
    expect(esCombinacionArchivoPermitida('reporte.pdf', 'image/png', EXTENSIONES_ADJUNTOS)).toBe(false);
    expect(esCombinacionArchivoPermitida('reporte.pdf', 'application/pdf', EXTENSIONES_ADJUNTOS)).toBe(true);
  });

  test('acepta metadatos historicos de fotos y mantiene adjuntos estrictos', () => {
    expect(esContenidoAlmacenadoPermitido('fotos/alumno.png', 'image/png')).toBe(true);
    expect(esContenidoAlmacenadoPermitido('fotos/alumno.png', 'text/html')).toBe(true);
    expect(esContenidoAlmacenadoPermitido('adjuntos/reporte.pdf', 'application/pdf')).toBe(true);
    expect(esContenidoAlmacenadoPermitido('fotos/alumno.jpg', 'application/octet-stream')).toBe(true);
    expect(esContenidoAlmacenadoPermitido('fotos/alumno.webp', undefined)).toBe(true);
    expect(esContenidoAlmacenadoPermitido('adjuntos/reporte.pdf', 'text/html')).toBe(false);
  });

  test('deriva un tipo seguro desde la extension validada', () => {
    expect(tipoContenidoPorClave('fotos/alumno.JPG')).toBe('image/jpeg');
    expect(tipoContenidoPorClave('fotos/alumno.webp')).toBe('image/webp');
    expect(tipoContenidoPorClave('adjuntos/reporte.pdf')).toBe('application/pdf');
  });

  test('normaliza extensiones y nombres visibles', () => {
    expect(normalizarExtension('FOTO.JPEG')).toBe('.jpeg');
    expect(sanitizarNombreDescarga('../../boleta\r\n.pdf')).toBe('boleta__.pdf');
  });
});
