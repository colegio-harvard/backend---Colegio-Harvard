-- DropForeignKey
ALTER TABLE "tbl_comunicados" DROP CONSTRAINT "tbl_comunicados_id_ref_audiencia_fkey";

-- AlterTable
ALTER TABLE "tbl_comunicados" ADD COLUMN     "ids_alumnos" JSONB;
