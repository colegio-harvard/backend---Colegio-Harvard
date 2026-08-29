ALTER TABLE "tbl_matriculas_digitales"
ADD COLUMN "borrador_asistido" JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN "borrador_preparado_por" INTEGER REFERENCES "tbl_usuarios"("id"),
ADD COLUMN "borrador_preparado_en" TIMESTAMPTZ;

