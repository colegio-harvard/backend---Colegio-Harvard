-- CreateTable
CREATE TABLE "tbl_notificaciones_personalizadas" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "tipo_entrega" VARCHAR(10) NOT NULL,
    "tipo_audiencia" VARCHAR(20) NOT NULL,
    "id_ref_audiencia" INTEGER,
    "total_destinatarios" INTEGER NOT NULL DEFAULT 0,
    "creado_por" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_notificaciones_personalizadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_destinatarios_notif_personalizada" (
    "id" SERIAL NOT NULL,
    "id_notif_personalizada" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "aceptada_modal" BOOLEAN NOT NULL DEFAULT false,
    "fecha_lectura_buzon" TIMESTAMPTZ(6),
    "fecha_aceptacion_modal" TIMESTAMPTZ(6),
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_destinatarios_notif_personalizada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_notif_personal_usuario" ON "tbl_destinatarios_notif_personalizada"("id_notif_personalizada", "id_usuario");

-- AddForeignKey
ALTER TABLE "tbl_notificaciones_personalizadas" ADD CONSTRAINT "tbl_notificaciones_personalizadas_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_destinatarios_notif_personalizada" ADD CONSTRAINT "tbl_destinatarios_notif_personalizada_id_notif_personalizad_fkey" FOREIGN KEY ("id_notif_personalizada") REFERENCES "tbl_notificaciones_personalizadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_destinatarios_notif_personalizada" ADD CONSTRAINT "tbl_destinatarios_notif_personalizada_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
