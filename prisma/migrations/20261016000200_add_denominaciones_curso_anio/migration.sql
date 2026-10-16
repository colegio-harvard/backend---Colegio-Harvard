CREATE TABLE "tbl_denominaciones_curso_anio" (
  "id" SERIAL PRIMARY KEY,
  "id_anio_escolar" INTEGER NOT NULL REFERENCES "tbl_anios_escolares"("id") ON DELETE CASCADE,
  "id_curso" INTEGER NOT NULL REFERENCES "tbl_cursos_academicos"("id") ON DELETE RESTRICT,
  "nombre_presentacion" VARCHAR(150) NOT NULL,
  "creado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "actualizado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL,
  "actualizado_en" TIMESTAMPTZ,
  CONSTRAINT "uq_denominaciones_curso_anio" UNIQUE ("id_anio_escolar", "id_curso")
);

CREATE INDEX "idx_denominaciones_curso_anio_anio" ON "tbl_denominaciones_curso_anio" ("id_anio_escolar");
CREATE INDEX "idx_denominaciones_curso_anio_curso" ON "tbl_denominaciones_curso_anio" ("id_curso");
