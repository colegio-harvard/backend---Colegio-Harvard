CREATE TABLE "tbl_disponibilidad_docente" (
  "id" SERIAL PRIMARY KEY,
  "id_docente" INTEGER NOT NULL REFERENCES "tbl_usuarios"("id") ON DELETE CASCADE,
  "id_anio_escolar" INTEGER NOT NULL REFERENCES "tbl_anios_escolares"("id") ON DELETE CASCADE,
  "id_bloque_horario" INTEGER NOT NULL REFERENCES "tbl_bloques_horarios"("id") ON DELETE CASCADE,
  "dia_semana" VARCHAR(12) NOT NULL,
  "disponible" BOOLEAN NOT NULL DEFAULT FALSE,
  "observacion" VARCHAR(500),
  "creado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "actualizado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL,
  "actualizado_en" TIMESTAMPTZ,
  CONSTRAINT "chk_disponibilidad_dia" CHECK ("dia_semana" IN ('LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO')),
  CONSTRAINT "uq_disponibilidad_docente_bloque" UNIQUE ("id_docente","id_anio_escolar","dia_semana","id_bloque_horario")
);
CREATE INDEX "idx_disponibilidad_docente_anio" ON "tbl_disponibilidad_docente" ("id_docente","id_anio_escolar");
