-- AlterTable
ALTER TABLE "tbl_notificaciones" ADD COLUMN     "lote_id" VARCHAR(36),
ADD COLUMN     "tipo" VARCHAR(10) NOT NULL DEFAULT 'sistema',
ADD COLUMN     "tipo_entrega" VARCHAR(10) NOT NULL DEFAULT 'buzon';
