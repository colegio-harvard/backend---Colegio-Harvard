-- Regla institucional definitiva para los espacios físicos 2026.
-- Inicial (horarios 1 y 2): las clases ordinarias vuelven al Aula de juegos
-- lúdicos (espacio 1); Computación conserva el Laboratorio (espacio 2).
UPDATE "tbl_horario_detalles" AS detalle
SET
  "id_espacio_fisico" = 1,
  "actualizado_por" = 1,
  "actualizado_en" = NOW()
FROM "tbl_horarios_escolares" AS horario
WHERE detalle."id_horario_escolar" = horario."id"
  AND horario."id" IN (1, 2)
  AND horario."id_anio_escolar" = 1
  AND horario."id_aula" IN (1, 2)
  AND horario."estado" = 'PUBLICADO'
  AND detalle."id_espacio_fisico" IS NULL;

-- Educación Física no ocupa una instalación por inferencia: los detalles
-- publicados de Primaria y Secundaria quedan sin espacio hasta que un
-- administrador seleccione uno expresamente.
UPDATE "tbl_horario_detalles" AS detalle
SET
  "id_espacio_fisico" = NULL,
  "actualizado_por" = 1,
  "actualizado_en" = NOW()
FROM "tbl_horarios_escolares" AS horario,
     "tbl_asignaciones_academicas" AS asignacion,
     "tbl_cursos_academicos" AS curso
WHERE detalle."id_horario_escolar" = horario."id"
  AND asignacion."id" = detalle."id_asignacion_academica"
  AND curso."id" = asignacion."id_curso"
  AND horario."id" IN (3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13)
  AND horario."id_anio_escolar" = 1
  AND horario."estado" = 'PUBLICADO'
  AND detalle."id_espacio_fisico" = 3
  AND curso."nombre" = 'Educación Física';

-- Corrección ortográfica del ambiente, preservando su identificador y demás
-- atributos (tipo, estado, capacidad y relaciones históricas).
UPDATE "tbl_espacios_fisicos"
SET
  "nombre" = 'Losa deportiva externa',
  "actualizado_por" = 1,
  "actualizado_en" = NOW()
WHERE "id" = 3
  AND "nombre" = 'Loza deportiva externa';
