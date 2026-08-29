ALTER TABLE "tbl_matriculas_digitales"
ADD COLUMN "control_documental" JSONB NOT NULL DEFAULT '{}'::jsonb;

