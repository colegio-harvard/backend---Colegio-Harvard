ALTER TABLE "tbl_matriculas_digitales"
  ADD COLUMN "complemento_administrativo" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "motivo_complemento" TEXT,
  ADD COLUMN "complementado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL,
  ADD COLUMN "complementado_en" TIMESTAMPTZ;
