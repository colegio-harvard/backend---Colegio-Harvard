-- DropForeignKey
ALTER TABLE "tbl_checkboxes_entrada_agenda" DROP CONSTRAINT "tbl_checkboxes_entrada_agenda_id_checkbox_fkey";

-- DropForeignKey
ALTER TABLE "tbl_checkboxes_entrada_agenda" DROP CONSTRAINT "tbl_checkboxes_entrada_agenda_id_entrada_agenda_fkey";

-- AlterTable
ALTER TABLE "tbl_alertas" DROP COLUMN "payload_json";

-- AlterTable
ALTER TABLE "tbl_notificaciones" DROP COLUMN "lote_id",
DROP COLUMN "tipo",
DROP COLUMN "tipo_entrega";

-- DropTable
DROP TABLE "tbl_catalogo_checkbox_agenda";

-- DropTable
DROP TABLE "tbl_checkboxes_entrada_agenda";

-- RenameForeignKey
ALTER TABLE "tbl_destinatarios_notif_personalizada" RENAME CONSTRAINT "tbl_destinatarios_notif_personalizada_id_notif_personalizad_fke" TO "tbl_destinatarios_notif_personalizada_id_notif_personaliza_fkey";
