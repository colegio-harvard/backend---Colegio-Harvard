ALTER TABLE "tbl_alumnos"
ADD COLUMN "siagie_inscrito" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "siagie_actualizado_por" INTEGER,
ADD COLUMN "siagie_actualizado_en" TIMESTAMPTZ(6);

ALTER TABLE "tbl_alumnos"
ADD CONSTRAINT "tbl_alumnos_siagie_actualizado_por_fkey"
FOREIGN KEY ("siagie_actualizado_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE INDEX "idx_alumnos_siagie_inscrito" ON "tbl_alumnos"("siagie_inscrito");
