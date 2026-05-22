ALTER TABLE "tbl_notificaciones_personalizadas"
ADD COLUMN IF NOT EXISTS "imagen_url" TEXT;

ALTER TABLE "tbl_notificaciones"
ADD COLUMN IF NOT EXISTS "imagen_url" TEXT;
