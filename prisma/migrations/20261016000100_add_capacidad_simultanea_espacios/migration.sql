ALTER TABLE "tbl_espacios_fisicos"
  ADD COLUMN "capacidad_simultanea" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "tbl_espacios_fisicos"
  ADD CONSTRAINT "chk_espacios_capacidad_simultanea_positiva"
  CHECK ("capacidad_simultanea" >= 1);
