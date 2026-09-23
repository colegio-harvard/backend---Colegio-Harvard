ALTER TABLE "tbl_alertas_operativas_alumno"
ADD COLUMN "accion_confirmada_por" INTEGER,
ADD COLUMN "accion_confirmada_en" TIMESTAMPTZ(6);

ALTER TABLE "tbl_alertas_operativas_alumno"
ADD CONSTRAINT "tbl_alertas_operativas_alumno_accion_confirmada_por_fkey"
FOREIGN KEY ("accion_confirmada_por") REFERENCES "tbl_usuarios"("id")
ON DELETE NO ACTION ON UPDATE NO ACTION;
