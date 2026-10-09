ALTER TABLE "tbl_matriculas_digitales"
  ADD COLUMN "modalidad" VARCHAR(20) NOT NULL DEFAULT 'FISICA',
  ADD COLUMN "firma_fisica" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "documento_fisico_recibido_en" TIMESTAMP(3),
  ADD COLUMN "documento_fisico_referencia" VARCHAR(500);

ALTER TABLE "tbl_matriculas_digitales"
  ADD CONSTRAINT "chk_matricula_modalidad" CHECK ("modalidad" IN ('FISICA', 'ELECTRONICA'));