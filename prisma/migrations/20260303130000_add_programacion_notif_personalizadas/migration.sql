-- AlterTable: add scheduling fields
ALTER TABLE "tbl_notificaciones_personalizadas"
  ADD COLUMN "estado" VARCHAR(15) NOT NULL DEFAULT 'ENVIADA',
  ADD COLUMN "fecha_programada" DATE;
