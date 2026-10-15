const fs = require('fs');
const path = require('path');

jest.mock('../services/capacidadesService', () => ({
  CAPACIDAD_ACADEMICO_DOCENTE: 'ACADEMICO_DOCENTE',
  tieneCapacidadUsuario: jest.fn(),
}));

const { tieneCapacidadUsuario } = require('../services/capacidadesService');
const verificarRolOCapacidad = require('../middleware/rbacCapacidadesMiddleware');

const leer = ruta => fs.readFileSync(path.join(__dirname, '..', ruta), 'utf8');
const ejecutar = async (user, roles = ['DOCENTE'], capacidades = ['ACADEMICO_DOCENTE']) => {
  const req = { user };
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  const next = jest.fn();
  await verificarRolOCapacidad(roles, capacidades)(req, { status, json }, next);
  return { status, json, next };
};

describe('Fase 10.4: capacidades académicas docentes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('DOCENTE accede a Mi horario por su rol principal', async () => {
    const { next } = await ejecutar({ id: 10, rol_codigo: 'DOCENTE' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(tieneCapacidadUsuario).not.toHaveBeenCalled();
  });

  test('TUTOR sin capacidad no accede', async () => {
    tieneCapacidadUsuario.mockResolvedValue(false);
    const { next, status } = await ejecutar({ id: 11, rol_codigo: 'TUTOR' });
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  test('TUTOR con ACADEMICO_DOCENTE sí accede', async () => {
    tieneCapacidadUsuario.mockResolvedValue(true);
    const { next } = await ejecutar({ id: 12, rol_codigo: 'TUTOR' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(tieneCapacidadUsuario).toHaveBeenCalledWith(12, ['ACADEMICO_DOCENTE']);
  });

  test('PADRE no accede aunque no posea capacidad', async () => {
    tieneCapacidadUsuario.mockResolvedValue(false);
    const { next, status } = await ejecutar({ id: 13, rol_codigo: 'PADRE' });
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  test('la ruta docente acepta rol o capacidad, sin id_docente arbitrario', () => {
    const rutas = leer('routes/horariosRoutes.js');
    const controlador = leer('controllers/horariosController.js');
    expect(rutas).toContain("verificarRolOCapacidad(['DOCENTE'], [CAPACIDAD_ACADEMICO_DOCENTE])");
    expect(controlador).toContain('aa.id_docente=$1');
    expect(controlador).toContain('req.user.id');
  });

  test('el listado de disponibilidad incluye DOCENTE y capacidad sin duplicar', () => {
    const controlador = leer('controllers/horariosController.js');
    expect(controlador).toContain('SELECT DISTINCT u.id,u.nombres');
    expect(controlador).toContain("r.codigo='DOCENTE' OR p.codigo='ACADEMICO_DOCENTE'");
  });

  test('los usuarios sin rol DOCENTE ni capacidad no aparecen en disponibilidad', () => {
    const controlador = leer('controllers/horariosController.js');
    expect(controlador).toContain("u.estado='ACTIVO' AND (r.codigo='DOCENTE' OR p.codigo='ACADEMICO_DOCENTE')");
  });

  test('ADMIN y SUPER_ADMIN pueden administrar la capacidad', () => {
    const rutas = leer('routes/usuariosRoutes.js');
    expect(rutas).toContain("router.put('/:id/capacidades/academico-docente', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN')");
    expect(rutas).toContain("router.delete('/:id/capacidades/academico-docente', verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN')");
  });

  test('DOCENTE y PADRE no reciben ruta de asignación de capacidad', () => {
    const rutas = leer('routes/usuariosRoutes.js');
    expect(rutas).not.toContain("capacidades/academico-docente', verificarToken, verificarRol('DOCENTE'");
    expect(rutas).not.toContain("capacidades/academico-docente', verificarToken, verificarRol('PADRE'");
  });

  test('asignar y retirar no cambian el rol principal del usuario', () => {
    const controlador = leer('controllers/usuariosController.js');
    expect(controlador).toContain('tbl_usuarios_permisos.upsert');
    expect(controlador).toContain('tbl_usuarios_permisos.deleteMany');
    expect(controlador).not.toContain('data: { id_rol: CAPACIDAD_ACADEMICO_DOCENTE }');
  });

  test('la auditoría registra asignación y retiro de capacidad', () => {
    const controlador = leer('controllers/usuariosController.js');
    expect(controlador).toContain("'ASIGNAR_CAPACIDAD_ACADEMICO_DOCENTE'");
    expect(controlador).toContain("'RETIRAR_CAPACIDAD_ACADEMICO_DOCENTE'");
    expect(controlador).toContain('usuario_afectado: id');
  });

  test('la migración conserva el rol principal y evita capacidades duplicadas', () => {
    const migracion = leer('prisma/migrations/20261015000500_add_capacidades_academicas_docentes/migration.sql');
    expect(migracion).toContain('tbl_usuarios_permisos');
    expect(migracion).toContain('UNIQUE ("id_usuario", "id_permiso")');
    expect(migracion).toContain("'ACADEMICO_DOCENTE'");
  });

  test('la revocación se consulta en base de datos y no queda delegada al JWT', () => {
    const middleware = leer('middleware/rbacCapacidadesMiddleware.js');
    expect(middleware).toContain('tieneCapacidadUsuario(req.user.id, capacidadesPermitidas)');
    expect(middleware).toContain('efecto inmediato');
  });
});
