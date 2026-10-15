ALTER TABLE "tbl_asignaciones_academicas"
  ADD COLUMN "horas_semanales" INTEGER;

ALTER TABLE "tbl_asignaciones_academicas"
  ADD CONSTRAINT "chk_asignaciones_horas_semanales"
  CHECK ("horas_semanales" IS NULL OR ("horas_semanales" BETWEEN 1 AND 60));
