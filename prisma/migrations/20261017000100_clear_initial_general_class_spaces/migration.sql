-- Corrección institucional puntual (Inicial 2026): las clases ordinarias no
-- ocupan un espacio físico compartido. Se preservan las clases de Computación
-- que usan el Laboratorio de cómputo (id_espacio_fisico = 2).
UPDATE "tbl_horario_detalles" AS detalle
SET
  "id_espacio_fisico" = NULL,
  "actualizado_por" = 1,
  "actualizado_en" = NOW()
FROM "tbl_horarios_escolares" AS horario
WHERE detalle."id_horario_escolar" = horario."id"
  AND horario."id" IN (1, 2)
  AND horario."id_anio_escolar" = 1
  AND horario."id_aula" IN (1, 2)
  AND horario."estado" = 'PUBLICADO'
  AND detalle."id_espacio_fisico" = 1;
