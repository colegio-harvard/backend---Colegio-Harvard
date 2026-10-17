-- Uso de un ambiente durante bloques institucionales (sin curso, carga ni nota).
CREATE TABLE "tbl_horario_usos_institucionales_espacios" (
  "id" SERIAL PRIMARY KEY,
  "id_horario_escolar" INTEGER NOT NULL REFERENCES "tbl_horarios_escolares"("id") ON DELETE CASCADE,
  "id_bloque_horario" INTEGER NOT NULL REFERENCES "tbl_bloques_horarios"("id") ON DELETE RESTRICT,
  "dia_semana" VARCHAR(15) NOT NULL,
  "id_espacio_fisico" INTEGER NOT NULL REFERENCES "tbl_espacios_fisicos"("id") ON DELETE RESTRICT,
  "descripcion" VARCHAR(200) NOT NULL,
  "creado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "actualizado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL,
  "actualizado_en" TIMESTAMPTZ,
  CONSTRAINT "uq_uso_institucional_horario_bloque_dia" UNIQUE ("id_horario_escolar", "id_bloque_horario", "dia_semana")
);

CREATE INDEX "idx_uso_institucional_espacio" ON "tbl_horario_usos_institucionales_espacios" ("id_espacio_fisico", "dia_semana", "id_bloque_horario");

-- Inicial 4 y 5 años: Aula de juegos lúdicos, lunes a viernes, en los dos
-- bloques institucionales previos a las clases académicas.
INSERT INTO "tbl_horario_usos_institucionales_espacios"
  ("id_horario_escolar", "id_bloque_horario", "dia_semana", "id_espacio_fisico", "descripcion", "creado_por")
SELECT horario.id, bloque.id, dia.dia_semana, 1, bloque.nombre, 1
FROM "tbl_horarios_escolares" AS horario
JOIN "tbl_bloques_horarios" AS bloque
  ON bloque.id_anio_escolar = horario.id_anio_escolar
 AND bloque.id_nivel = 1
 AND bloque.id IN (1, 2)
CROSS JOIN (VALUES ('LUNES'), ('MARTES'), ('MIERCOLES'), ('JUEVES'), ('VIERNES')) AS dia(dia_semana)
WHERE horario.id IN (1, 2)
  AND horario.id_anio_escolar = 1
  AND horario.id_aula IN (1, 2)
  AND horario.estado = 'PUBLICADO'
ON CONFLICT ("id_horario_escolar", "id_bloque_horario", "dia_semana") DO NOTHING;
