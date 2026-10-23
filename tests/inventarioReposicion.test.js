const fs = require('fs');
const path = require('path');

const controlador = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'inventarioController.js'), 'utf8');
const rutas = fs.readFileSync(path.join(__dirname, '..', 'routes', 'inventarioRoutes.js'), 'utf8');
const esquema = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');

describe('Inventario: plan de reposición', () => {
  test('mantiene una meta separada del stock y calcula faltante o exceso', () => {
    expect(esquema).toContain('meta_reposicion        Int?');
    expect(controlador).toContain('Math.max(0, variante.meta_reposicion - variante.stock)');
    expect(controlador).toContain('Math.max(0, variante.stock - variante.meta_reposicion)');
    expect(controlador).toContain('data: { meta_reposicion: meta }');
  });

  test('expone consulta y actualización protegidas por las rutas de inventario', () => {
    expect(rutas).toContain("router.get('/reposicion', ctrl.planReposicion)");
    expect(rutas).toContain("router.put('/variantes/:id/meta-reposicion', ctrl.actualizarMetaReposicion)");
    expect(rutas).toContain("router.use(verificarToken, verificarRol('SUPER_ADMIN', 'ADMIN'))");
    expect(controlador).toContain("entero(meta_reposicion, 'Meta de reposición')");
  });
});
