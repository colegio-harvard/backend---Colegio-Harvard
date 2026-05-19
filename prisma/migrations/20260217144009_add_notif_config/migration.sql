-- AlterTable
ALTER TABLE "tbl_plantillas_notificacion" ADD COLUMN     "tipo_entrega" VARCHAR(10) NOT NULL DEFAULT 'buzon';

-- CreateTable
CREATE TABLE "tbl_config_pension_reminder" (
    "id" SERIAL NOT NULL,
    "dia_inicio" INTEGER NOT NULL DEFAULT 25,
    "frecuencia_dias" INTEGER NOT NULL DEFAULT 5,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_config_pension_reminder_pkey" PRIMARY KEY ("id")
);
