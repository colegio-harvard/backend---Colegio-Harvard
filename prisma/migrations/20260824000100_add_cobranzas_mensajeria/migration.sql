CREATE TABLE "tbl_compromisos_pago" (
  "id" SERIAL NOT NULL, "id_estado_pension" INTEGER NOT NULL, "fecha_compromiso" DATE NOT NULL,
  "monto" DECIMAL(10,2), "estado" VARCHAR(20) NOT NULL DEFAULT 'VIGENTE', "observacion" VARCHAR(255),
  "creado_por" INTEGER NOT NULL, "user_id_registration" INTEGER, "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  "user_id_modification" INTEGER, "date_time_modification" TIMESTAMPTZ(6), CONSTRAINT "tbl_compromisos_pago_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "tbl_cobranza_envios" (
  "id" SERIAL NOT NULL, "id_estado_pension" INTEGER NOT NULL, "id_padre" INTEGER NOT NULL, "canal" VARCHAR(20) NOT NULL,
  "telefono" VARCHAR(20) NOT NULL, "mensaje" TEXT NOT NULL, "estado" VARCHAR(20) NOT NULL DEFAULT 'PREPARADO', "enlace_apertura" TEXT,
  "error" VARCHAR(255), "creado_por" INTEGER NOT NULL, "preparado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enviado_en" TIMESTAMPTZ(6), "user_id_registration" INTEGER, "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  "user_id_modification" INTEGER, "date_time_modification" TIMESTAMPTZ(6), CONSTRAINT "tbl_cobranza_envios_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tbl_compromisos_pago_id_estado_pension_estado_idx" ON "tbl_compromisos_pago"("id_estado_pension", "estado");
CREATE INDEX "tbl_compromisos_pago_fecha_compromiso_idx" ON "tbl_compromisos_pago"("fecha_compromiso");
CREATE INDEX "tbl_cobranza_envios_estado_canal_idx" ON "tbl_cobranza_envios"("estado", "canal");
CREATE INDEX "tbl_cobranza_envios_id_estado_pension_idx" ON "tbl_cobranza_envios"("id_estado_pension");
ALTER TABLE "tbl_compromisos_pago" ADD CONSTRAINT "tbl_compromisos_pago_id_estado_pension_fkey" FOREIGN KEY ("id_estado_pension") REFERENCES "tbl_estado_pension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tbl_compromisos_pago" ADD CONSTRAINT "tbl_compromisos_pago_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "tbl_cobranza_envios" ADD CONSTRAINT "tbl_cobranza_envios_id_estado_pension_fkey" FOREIGN KEY ("id_estado_pension") REFERENCES "tbl_estado_pension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tbl_cobranza_envios" ADD CONSTRAINT "tbl_cobranza_envios_id_padre_fkey" FOREIGN KEY ("id_padre") REFERENCES "tbl_padres"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "tbl_cobranza_envios" ADD CONSTRAINT "tbl_cobranza_envios_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;



