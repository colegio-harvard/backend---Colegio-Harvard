const {
  EXTENSIONES_ADJUNTOS,
  EXTENSIONES_FOTOS,
  esContenidoAlmacenadoPermitido,
  esCombinacionArchivoPermitida,
  normalizarExtension,
  sanitizarNombreDescarga,
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

  test('impide servir un objeto cuyo contenido no coincide con su clave', () => {
    expect(esContenidoAlmacenadoPermitido('fotos/alumno.png', 'image/png')).toBe(true);
    expect(esContenidoAlmacenadoPermitido('fotos/alumno.png', 'text/html')).toBe(false);
    expect(esContenidoAlmacenadoPermitido('adjuntos/reporte.pdf', 'application/pdf')).toBe(true);
  });

  test('normaliza extensiones y nombres visibles', () => {
    expect(normalizarExtension('FOTO.JPEG')).toBe('.jpeg');
    expect(sanitizarNombreDescarga('../../boleta\r\n.pdf')).toBe('boleta__.pdf');
  });
});
