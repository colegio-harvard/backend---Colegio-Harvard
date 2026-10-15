CREATE TABLE "tbl_espacios_fisicos" (
  "id" SERIAL PRIMARY KEY, "nombre" VARCHAR(150) NOT NULL, "tipo" VARCHAR(30) NOT NULL DEFAULT 'OTRO', "capacidad" INTEGER, "ubicacion" VARCHAR(150), "activo" BOOLEAN NOT NULL DEFAULT TRUE, "observacion" VARCHAR(500), "creado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL, "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "actualizado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL, "actualizado_en" TIMESTAMPTZ
);
CREATE UNIQUE INDEX "uq_espacios_fisicos_nombre" ON "tbl_espacios_fisicos" (LOWER("nombre"));
ALTER TABLE "tbl_horario_detalles" ADD COLUMN "id_espacio_fisico" INTEGER REFERENCES "tbl_espacios_fisicos"("id") ON DELETE SET NULL;
CREATE INDEX "idx_horario_detalles_espacio" ON "tbl_horario_detalles" ("id_espacio_fisico");
