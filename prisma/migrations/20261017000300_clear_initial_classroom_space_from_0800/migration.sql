-- Inicial 2026: desde las 08:00 las clases ordinarias se desarrollan en el
-- aula regular. Computación no se ve afectada porque conserva el Laboratorio
-- de cómputo (espacio 2), no el Aula de juegos lúdicos (espacio 1).
UPDATE "tbl_horario_detalles" AS detalle
SET
  "id_espacio_fisico" = NULL,
  "actualizado_por" = 1,
  "actualizado_en" = NOW()
FROM "tbl_horarios_escolares" AS horario,
     "tbl_bloques_horarios" AS bloque
WHERE detalle."id_horario_escolar" = horario."id"
  AND bloque."id" = detalle."id_bloque_horario"
  AND horario."id" IN (1, 2)
  AND horario."id_anio_escolar" = 1
  AND horario."id_aula" IN (1, 2)
  AND horario."estado" = 'PUBLICADO'
  AND bloque."hora_inicio" >= TIME '08:00:00'
  AND detalle."id_espacio_fisico" = 1;
