ALTER TABLE "tbl_alumnos"
  ADD COLUMN IF NOT EXISTS "fecha_retiro" DATE,
  ADD COLUMN IF NOT EXISTS "ultima_clave_cobro" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "motivo_retiro" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "observacion_retiro" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "retirado_por" INTEGER;
