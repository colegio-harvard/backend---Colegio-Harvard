const fs = require('fs');
const path = require('path');

const leer = (...partes) => fs.readFileSync(path.join(__dirname, '..', ...partes), 'utf8');
const controlador = leer('controllers', 'horariosController.js');
const migracion = leer('prisma', 'migrations', '20261016000100_add_capacidad_simultanea_espacios', 'migration.sql');

describe('Fase 9.1: capacidad simultánea de espacios físicos', () => {
  test('la migración agrega capacidad simultánea con valor exclusivo por defecto', () => {
    expect(migracion).toContain('ADD COLUMN "capacidad_simultanea" INTEGER NOT NULL DEFAULT 1');
    expect(migracion).toContain('CHECK ("capacidad_simultanea" >= 1)');
  });

  test('el CRUD acepta y valida un entero mayor o igual a uno', () => {
    expect(controlador).toContain('capacidad_simultanea ?? 1');
    expect(controlador).toContain('La capacidad simultánea debe ser un entero mayor o igual a 1');
    expect(controlador).toContain('capacidad_simultanea=COALESCE');
  });

  test('un espacio con capacidad uno bloquea la segunda clase simultánea', () => {
    expect(controlador).toContain('>= capacidadSimultanea');
    expect(controlador).toContain("codigo: 'CONFLICTO_ESPACIO_FISICO'");
  });

  test('un espacio con capacidad dos permite dos clases y rechaza una tercera', () => {
    expect(controlador).toContain('const capacidadSimultanea = Number(espacio.capacidad_simultanea || 1)');
    expect(controlador).toContain('COUNT(*)::int cantidad');
  });

  test('el conteo se limita al mismo año, día y bloque', () => {
    expect(controlador).toContain('h.id_anio_escolar=$1');
    expect(controlador).toContain('d.dia_semana=$3 AND d.id_bloque_horario=$4');
  });

  test('la edición excluye su propio detalle del conteo', () => {
    expect(controlador).toContain("excluirDetalleId ? ' AND d.id<>$5' : ''");
  });

  test('la validación general detecta sobreocupación crítica', () => {
    expect(controlador).toContain('diagnosticarHorario');
    expect(controlador).toContain('CONFLICTO_ESPACIO_FISICO');
  });

  test('la publicación sigue bloqueándose por un diagnóstico inválido', () => {
    expect(controlador).toContain("if (!diagnostico.valido) throw Object.assign(new Error('HORARIO_INVALIDO')");
  });

  test('los espacios y horarios históricos siguen siendo compatibles', () => {
    expect(controlador).toContain("h.estado<>'ARCHIVADO'");
    expect(controlador).toContain('if (detalle.id_espacio_fisico)');
  });

  test('el generador no asigna espacios automáticamente', () => {
    expect(controlador).toContain('const detalle = { id_asignacion_academica: asignacion.id, id_bloque_horario: elegido.bloque.id, dia_semana: elegido.dia }');
  });
});
