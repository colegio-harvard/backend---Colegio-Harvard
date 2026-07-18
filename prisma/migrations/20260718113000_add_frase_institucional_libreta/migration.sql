CREATE TABLE IF NOT EXISTS "tbl_configuracion_libreta" (
  "id" SERIAL PRIMARY KEY,
  "id_anio_escolar" INTEGER NOT NULL UNIQUE REFERENCES "tbl_anios_escolares"("id") ON DELETE CASCADE,
  "frase_institucional" TEXT NOT NULL,
  "modificado_por" INTEGER REFERENCES "tbl_usuarios"("id"),
  "modificado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

