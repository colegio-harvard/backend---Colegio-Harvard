CREATE TABLE "tbl_alertas_operativas_alumno" (
    "id" SERIAL NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "mensaje" VARCHAR(250) NOT NULL,
    "prioridad" VARCHAR(20) NOT NULL DEFAULT 'URGENTE',
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
    "creado_por" INTEGER NOT NULL,
    "resuelto_por" INTEGER,
    "resuelta_en" TIMESTAMPTZ(6),
    "ultima_accion" VARCHAR(30),
    "ultima_accion_por" INTEGER,
    "ultima_accion_en" TIMESTAMPTZ(6),
    "date_time_registration" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_time_modification" TIMESTAMPTZ(6),
    CONSTRAINT "tbl_alertas_operativas_alumno_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_alerta_operativa_alumno_estado" ON "tbl_alertas_operativas_alumno"("id_alumno", "estado");
ALTER TABLE "tbl_alertas_operativas_alumno" ADD CONSTRAINT "tbl_alertas_operativas_alumno_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "tbl_alumnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tbl_alertas_operativas_alumno" ADD CONSTRAINT "tbl_alertas_operativas_alumno_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "tbl_alertas_operativas_alumno" ADD CONSTRAINT "tbl_alertas_operativas_alumno_resuelto_por_fkey" FOREIGN KEY ("resuelto_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "tbl_alertas_operativas_alumno" ADD CONSTRAINT "tbl_alertas_operativas_alumno_ultima_accion_por_fkey" FOREIGN KEY ("ultima_accion_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
