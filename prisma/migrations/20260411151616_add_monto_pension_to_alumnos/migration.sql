-- AlterTable
ALTER TABLE "tbl_alumnos" ADD COLUMN     "monto_pension" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "tbl_eventos_asistencia" ALTER COLUMN "id_punto_escaneo" DROP NOT NULL;
