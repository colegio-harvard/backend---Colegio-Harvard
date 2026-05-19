-- CreateTable
CREATE TABLE "tbl_roles" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_permisos" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(100) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "tipo" VARCHAR(50) NOT NULL,
    "recurso" VARCHAR(200),
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_roles_permisos" (
    "id" SERIAL NOT NULL,
    "id_rol" INTEGER NOT NULL,
    "id_permiso" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_roles_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_usuarios" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "contrasena" VARCHAR(255) NOT NULL,
    "nombres" VARCHAR(200) NOT NULL,
    "id_rol" INTEGER NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMPTZ(6),
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_colegio" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'America/Lima',
    "telefono_whatsapp" VARCHAR(20),
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_colegio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_anios_escolares" (
    "id" SERIAL NOT NULL,
    "id_colegio" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_anios_escolares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_calendario_escolar" (
    "id" SERIAL NOT NULL,
    "id_anio_escolar" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "es_dia_lectivo" BOOLEAN NOT NULL DEFAULT true,
    "nota" TEXT,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_calendario_escolar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_niveles" (
    "id" SERIAL NOT NULL,
    "id_colegio" INTEGER NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_niveles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_grados" (
    "id" SERIAL NOT NULL,
    "id_nivel" INTEGER NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_grados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_aulas" (
    "id" SERIAL NOT NULL,
    "id_anio_escolar" INTEGER NOT NULL,
    "id_grado" INTEGER NOT NULL,
    "seccion" VARCHAR(10) NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_aulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_horarios_nivel" (
    "id" SERIAL NOT NULL,
    "id_nivel" INTEGER NOT NULL,
    "id_anio_escolar" INTEGER NOT NULL,
    "hora_inicio" TIME(6) NOT NULL,
    "tolerancia_tardanza_min" INTEGER NOT NULL DEFAULT 15,
    "hora_limite_no_ingreso" TIME(6) NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_horarios_nivel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_asignaciones_tutor" (
    "id" SERIAL NOT NULL,
    "id_aula" INTEGER NOT NULL,
    "id_usuario_tutor" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_asignaciones_tutor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_padres" (
    "id" SERIAL NOT NULL,
    "dni" VARCHAR(20) NOT NULL,
    "nombre_completo" VARCHAR(200) NOT NULL,
    "celular" VARCHAR(20) NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_padres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_alumnos" (
    "id" SERIAL NOT NULL,
    "codigo_alumno" VARCHAR(50) NOT NULL,
    "dni" VARCHAR(20),
    "nombre_completo" VARCHAR(200) NOT NULL,
    "foto_url" TEXT,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    "id_aula" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_alumnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_padres_alumnos" (
    "id" SERIAL NOT NULL,
    "id_padre" INTEGER NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_padres_alumnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_carnets" (
    "id" SERIAL NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "qr_token" TEXT NOT NULL,
    "version_carnet" INTEGER NOT NULL DEFAULT 1,
    "emitido_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emitido_por" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_carnets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_puntos_escaneo" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_puntos_escaneo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_asignaciones_porteria" (
    "id" SERIAL NOT NULL,
    "id_usuario_porteria" INTEGER NOT NULL,
    "id_punto_escaneo" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_asignaciones_porteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_eventos_asistencia" (
    "id" SERIAL NOT NULL,
    "id_anio_escolar" INTEGER NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "fecha_evento" DATE NOT NULL,
    "hora_evento" TIME(6) NOT NULL,
    "fecha_hora_evento" TIMESTAMPTZ(6) NOT NULL,
    "tipo_evento" VARCHAR(20) NOT NULL,
    "metodo" VARCHAR(10) NOT NULL,
    "id_punto_escaneo" INTEGER NOT NULL,
    "registrado_por" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_eventos_asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_asistencia_dia" (
    "id" SERIAL NOT NULL,
    "id_anio_escolar" INTEGER NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "id_evento_checkin" INTEGER,
    "id_evento_checkout" INTEGER,
    "id_alerta_no_llego" INTEGER,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_asistencia_dia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_correcciones_asistencia" (
    "id" SERIAL NOT NULL,
    "id_asistencia_dia" INTEGER NOT NULL,
    "campo_modificado" TEXT NOT NULL,
    "valor_anterior" TEXT,
    "valor_nuevo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "corregido_por" INTEGER NOT NULL,
    "corregido_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_correcciones_asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_alertas" (
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "id_anio_escolar" INTEGER NOT NULL,
    "id_alumno" INTEGER,
    "id_padre" INTEGER,
    "fecha" DATE NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ABIERTA',
    "cerrada_en" TIMESTAMPTZ(6),
    "payload_json" JSONB,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_alertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_plantillas_notificacion" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "habilitada" BOOLEAN NOT NULL DEFAULT true,
    "roles_destino" JSONB,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_plantillas_notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_notificaciones" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "codigo_plantilla" VARCHAR(50),
    "titulo" VARCHAR(200) NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_catalogo_checkbox_agenda" (
    "id" SERIAL NOT NULL,
    "etiqueta" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden_display" INTEGER NOT NULL DEFAULT 0,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_catalogo_checkbox_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_entradas_agenda" (
    "id" SERIAL NOT NULL,
    "id_anio_escolar" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "alcance" VARCHAR(10) NOT NULL,
    "id_aula" INTEGER,
    "id_alumno" INTEGER,
    "contenido_texto" TEXT NOT NULL,
    "requiere_firma" BOOLEAN NOT NULL DEFAULT true,
    "publicado_por" INTEGER NOT NULL,
    "publicado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "esta_publicado" BOOLEAN NOT NULL DEFAULT true,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_entradas_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_checkboxes_entrada_agenda" (
    "id" SERIAL NOT NULL,
    "id_entrada_agenda" INTEGER NOT NULL,
    "id_checkbox" INTEGER NOT NULL,
    "marcado" BOOLEAN NOT NULL DEFAULT false,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_checkboxes_entrada_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_firmas_agenda" (
    "id" SERIAL NOT NULL,
    "id_entrada_agenda" INTEGER NOT NULL,
    "id_padre" INTEGER NOT NULL,
    "firmado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_firmas_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_respuestas_agenda" (
    "id" SERIAL NOT NULL,
    "id_entrada_agenda" INTEGER NOT NULL,
    "id_padre" INTEGER NOT NULL,
    "mensaje" TEXT NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_respuestas_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_reportes_semanales" (
    "id" SERIAL NOT NULL,
    "inicio_semana" DATE NOT NULL,
    "fin_semana" DATE NOT NULL,
    "alcance" VARCHAR(10) NOT NULL,
    "id_aula" INTEGER,
    "id_alumno" INTEGER,
    "plantilla_json" JSONB,
    "contenido_json" JSONB,
    "publicado_por" INTEGER NOT NULL,
    "publicado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiere_firma" BOOLEAN NOT NULL DEFAULT true,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_reportes_semanales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_firmas_reporte_semanal" (
    "id" SERIAL NOT NULL,
    "id_reporte_semanal" INTEGER NOT NULL,
    "id_padre" INTEGER NOT NULL,
    "firmado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_firmas_reporte_semanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_hilos_mensaje" (
    "id" SERIAL NOT NULL,
    "id_anio_escolar" INTEGER NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "asunto" VARCHAR(200) NOT NULL,
    "creado_por" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_hilos_mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_mensajes" (
    "id" SERIAL NOT NULL,
    "id_hilo" INTEGER NOT NULL,
    "id_usuario_emisor" INTEGER NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "adjunto_url" TEXT,
    "adjunto_nombre" VARCHAR(255),
    "enviado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_comunicados" (
    "id" SERIAL NOT NULL,
    "id_anio_escolar" INTEGER NOT NULL,
    "creado_por" INTEGER NOT NULL,
    "prioridad" VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
    "titulo" VARCHAR(200) NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "tipo_audiencia" VARCHAR(20) NOT NULL,
    "id_ref_audiencia" INTEGER,
    "publicado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "esta_publicado" BOOLEAN NOT NULL DEFAULT true,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_comunicados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_lecturas_comunicado" (
    "id" SERIAL NOT NULL,
    "id_comunicado" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "leido_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_lecturas_comunicado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_plantilla_pension" (
    "id" SERIAL NOT NULL,
    "id_anio_escolar" INTEGER NOT NULL,
    "meses_json" JSONB NOT NULL,
    "creado_por" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_plantilla_pension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_estado_pension" (
    "id" SERIAL NOT NULL,
    "id_plantilla" INTEGER NOT NULL,
    "id_alumno" INTEGER NOT NULL,
    "clave_mes" VARCHAR(20) NOT NULL,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "actualizado_por" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_estado_pension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_auditoria" (
    "id" SERIAL NOT NULL,
    "id_usuario_actor" INTEGER NOT NULL,
    "codigo_accion" VARCHAR(100) NOT NULL,
    "tipo_entidad" VARCHAR(100) NOT NULL,
    "id_entidad" INTEGER,
    "marca_tiempo" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumen" TEXT NOT NULL,
    "meta_json" JSONB,

    CONSTRAINT "tbl_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_roles_codigo_key" ON "tbl_roles"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_roles_nombre_key" ON "tbl_roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_permisos_codigo_key" ON "tbl_permisos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "uq_rol_permiso" ON "tbl_roles_permisos"("id_rol", "id_permiso");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_usuarios_username_key" ON "tbl_usuarios"("username");

-- CreateIndex
CREATE UNIQUE INDEX "uq_colegio_anio" ON "tbl_anios_escolares"("id_colegio", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "uq_anio_fecha" ON "tbl_calendario_escolar"("id_anio_escolar", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "uq_anio_grado_seccion" ON "tbl_aulas"("id_anio_escolar", "id_grado", "seccion");

-- CreateIndex
CREATE UNIQUE INDEX "uq_horario_nivel_anio" ON "tbl_horarios_nivel"("id_nivel", "id_anio_escolar");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tutor_aula" ON "tbl_asignaciones_tutor"("id_aula");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_padres_dni_key" ON "tbl_padres"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_padres_id_usuario_key" ON "tbl_padres"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_alumnos_codigo_alumno_key" ON "tbl_alumnos"("codigo_alumno");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_alumnos_dni_key" ON "tbl_alumnos"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_padres_alumnos_id_alumno_key" ON "tbl_padres_alumnos"("id_alumno");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_carnets_id_alumno_key" ON "tbl_carnets"("id_alumno");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_carnets_qr_token_key" ON "tbl_carnets"("qr_token");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_asignaciones_porteria_id_usuario_porteria_key" ON "tbl_asignaciones_porteria"("id_usuario_porteria");

-- CreateIndex
CREATE UNIQUE INDEX "uq_alumno_fecha" ON "tbl_asistencia_dia"("id_alumno", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_plantillas_notificacion_codigo_key" ON "tbl_plantillas_notificacion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "uq_firma_agenda_padre" ON "tbl_firmas_agenda"("id_entrada_agenda", "id_padre");

-- CreateIndex
CREATE UNIQUE INDEX "uq_firma_reporte_padre" ON "tbl_firmas_reporte_semanal"("id_reporte_semanal", "id_padre");

-- CreateIndex
CREATE UNIQUE INDEX "uq_comunicado_usuario" ON "tbl_lecturas_comunicado"("id_comunicado", "id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "uq_alumno_mes" ON "tbl_estado_pension"("id_alumno", "clave_mes");

-- AddForeignKey
ALTER TABLE "tbl_roles_permisos" ADD CONSTRAINT "tbl_roles_permisos_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "tbl_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_roles_permisos" ADD CONSTRAINT "tbl_roles_permisos_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "tbl_permisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_usuarios" ADD CONSTRAINT "tbl_usuarios_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "tbl_roles"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_anios_escolares" ADD CONSTRAINT "tbl_anios_escolares_id_colegio_fkey" FOREIGN KEY ("id_colegio") REFERENCES "tbl_colegio"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_calendario_escolar" ADD CONSTRAINT "tbl_calendario_escolar_id_anio_escolar_fkey" FOREIGN KEY ("id_anio_escolar") REFERENCES "tbl_anios_escolares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_niveles" ADD CONSTRAINT "tbl_niveles_id_colegio_fkey" FOREIGN KEY ("id_colegio") REFERENCES "tbl_colegio"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_grados" ADD CONSTRAINT "tbl_grados_id_nivel_fkey" FOREIGN KEY ("id_nivel") REFERENCES "tbl_niveles"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_aulas" ADD CONSTRAINT "tbl_aulas_id_anio_escolar_fkey" FOREIGN KEY ("id_anio_escolar") REFERENCES "tbl_anios_escolares"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_aulas" ADD CONSTRAINT "tbl_aulas_id_grado_fkey" FOREIGN KEY ("id_grado") REFERENCES "tbl_grados"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_horarios_nivel" ADD CONSTRAINT "tbl_horarios_nivel_id_nivel_fkey" FOREIGN KEY ("id_nivel") REFERENCES "tbl_niveles"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_horarios_nivel" ADD CONSTRAINT "tbl_horarios_nivel_id_anio_escolar_fkey" FOREIGN KEY ("id_anio_escolar") REFERENCES "tbl_anios_escolares"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_asignaciones_tutor" ADD CONSTRAINT "tbl_asignaciones_tutor_id_aula_fkey" FOREIGN KEY ("id_aula") REFERENCES "tbl_aulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_asignaciones_tutor" ADD CONSTRAINT "tbl_asignaciones_tutor_id_usuario_tutor_fkey" FOREIGN KEY ("id_usuario_tutor") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_padres" ADD CONSTRAINT "tbl_padres_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_alumnos" ADD CONSTRAINT "tbl_alumnos_id_aula_fkey" FOREIGN KEY ("id_aula") REFERENCES "tbl_aulas"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_padres_alumnos" ADD CONSTRAINT "tbl_padres_alumnos_id_padre_fkey" FOREIGN KEY ("id_padre") REFERENCES "tbl_padres"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_padres_alumnos" ADD CONSTRAINT "tbl_padres_alumnos_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "tbl_alumnos"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_carnets" ADD CONSTRAINT "tbl_carnets_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "tbl_alumnos"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_carnets" ADD CONSTRAINT "tbl_carnets_emitido_por_fkey" FOREIGN KEY ("emitido_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_asignaciones_porteria" ADD CONSTRAINT "tbl_asignaciones_porteria_id_usuario_porteria_fkey" FOREIGN KEY ("id_usuario_porteria") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_asignaciones_porteria" ADD CONSTRAINT "tbl_asignaciones_porteria_id_punto_escaneo_fkey" FOREIGN KEY ("id_punto_escaneo") REFERENCES "tbl_puntos_escaneo"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_eventos_asistencia" ADD CONSTRAINT "tbl_eventos_asistencia_id_anio_escolar_fkey" FOREIGN KEY ("id_anio_escolar") REFERENCES "tbl_anios_escolares"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_eventos_asistencia" ADD CONSTRAINT "tbl_eventos_asistencia_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "tbl_alumnos"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_eventos_asistencia" ADD CONSTRAINT "tbl_eventos_asistencia_id_punto_escaneo_fkey" FOREIGN KEY ("id_punto_escaneo") REFERENCES "tbl_puntos_escaneo"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_eventos_asistencia" ADD CONSTRAINT "tbl_eventos_asistencia_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_asistencia_dia" ADD CONSTRAINT "tbl_asistencia_dia_id_anio_escolar_fkey" FOREIGN KEY ("id_anio_escolar") REFERENCES "tbl_anios_escolares"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_asistencia_dia" ADD CONSTRAINT "tbl_asistencia_dia_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "tbl_alumnos"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_asistencia_dia" ADD CONSTRAINT "tbl_asistencia_dia_id_evento_checkin_fkey" FOREIGN KEY ("id_evento_checkin") REFERENCES "tbl_eventos_asistencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_asistencia_dia" ADD CONSTRAINT "tbl_asistencia_dia_id_evento_checkout_fkey" FOREIGN KEY ("id_evento_checkout") REFERENCES "tbl_eventos_asistencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_asistencia_dia" ADD CONSTRAINT "tbl_asistencia_dia_id_alerta_no_llego_fkey" FOREIGN KEY ("id_alerta_no_llego") REFERENCES "tbl_alertas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_correcciones_asistencia" ADD CONSTRAINT "tbl_correcciones_asistencia_id_asistencia_dia_fkey" FOREIGN KEY ("id_asistencia_dia") REFERENCES "tbl_asistencia_dia"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_correcciones_asistencia" ADD CONSTRAINT "tbl_correcciones_asistencia_corregido_por_fkey" FOREIGN KEY ("corregido_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_alertas" ADD CONSTRAINT "tbl_alertas_id_anio_escolar_fkey" FOREIGN KEY ("id_anio_escolar") REFERENCES "tbl_anios_escolares"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_alertas" ADD CONSTRAINT "tbl_alertas_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "tbl_alumnos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_alertas" ADD CONSTRAINT "tbl_alertas_id_padre_fkey" FOREIGN KEY ("id_padre") REFERENCES "tbl_padres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_notificaciones" ADD CONSTRAINT "tbl_notificaciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_entradas_agenda" ADD CONSTRAINT "tbl_entradas_agenda_id_anio_escolar_fkey" FOREIGN KEY ("id_anio_escolar") REFERENCES "tbl_anios_escolares"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_entradas_agenda" ADD CONSTRAINT "tbl_entradas_agenda_id_aula_fkey" FOREIGN KEY ("id_aula") REFERENCES "tbl_aulas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_entradas_agenda" ADD CONSTRAINT "tbl_entradas_agenda_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "tbl_alumnos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_entradas_agenda" ADD CONSTRAINT "tbl_entradas_agenda_publicado_por_fkey" FOREIGN KEY ("publicado_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_checkboxes_entrada_agenda" ADD CONSTRAINT "tbl_checkboxes_entrada_agenda_id_entrada_agenda_fkey" FOREIGN KEY ("id_entrada_agenda") REFERENCES "tbl_entradas_agenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_checkboxes_entrada_agenda" ADD CONSTRAINT "tbl_checkboxes_entrada_agenda_id_checkbox_fkey" FOREIGN KEY ("id_checkbox") REFERENCES "tbl_catalogo_checkbox_agenda"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_firmas_agenda" ADD CONSTRAINT "tbl_firmas_agenda_id_entrada_agenda_fkey" FOREIGN KEY ("id_entrada_agenda") REFERENCES "tbl_entradas_agenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_firmas_agenda" ADD CONSTRAINT "tbl_firmas_agenda_id_padre_fkey" FOREIGN KEY ("id_padre") REFERENCES "tbl_padres"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_respuestas_agenda" ADD CONSTRAINT "tbl_respuestas_agenda_id_entrada_agenda_fkey" FOREIGN KEY ("id_entrada_agenda") REFERENCES "tbl_entradas_agenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_respuestas_agenda" ADD CONSTRAINT "tbl_respuestas_agenda_id_padre_fkey" FOREIGN KEY ("id_padre") REFERENCES "tbl_padres"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_reportes_semanales" ADD CONSTRAINT "tbl_reportes_semanales_publicado_por_fkey" FOREIGN KEY ("publicado_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_reportes_semanales" ADD CONSTRAINT "tbl_reportes_semanales_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "tbl_alumnos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_reportes_semanales" ADD CONSTRAINT "tbl_reportes_semanales_id_aula_fkey" FOREIGN KEY ("id_aula") REFERENCES "tbl_aulas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_firmas_reporte_semanal" ADD CONSTRAINT "tbl_firmas_reporte_semanal_id_reporte_semanal_fkey" FOREIGN KEY ("id_reporte_semanal") REFERENCES "tbl_reportes_semanales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_firmas_reporte_semanal" ADD CONSTRAINT "tbl_firmas_reporte_semanal_id_padre_fkey" FOREIGN KEY ("id_padre") REFERENCES "tbl_padres"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_hilos_mensaje" ADD CONSTRAINT "tbl_hilos_mensaje_id_anio_escolar_fkey" FOREIGN KEY ("id_anio_escolar") REFERENCES "tbl_anios_escolares"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_hilos_mensaje" ADD CONSTRAINT "tbl_hilos_mensaje_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "tbl_alumnos"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_hilos_mensaje" ADD CONSTRAINT "tbl_hilos_mensaje_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_mensajes" ADD CONSTRAINT "tbl_mensajes_id_hilo_fkey" FOREIGN KEY ("id_hilo") REFERENCES "tbl_hilos_mensaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_mensajes" ADD CONSTRAINT "tbl_mensajes_id_usuario_emisor_fkey" FOREIGN KEY ("id_usuario_emisor") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_comunicados" ADD CONSTRAINT "tbl_comunicados_id_anio_escolar_fkey" FOREIGN KEY ("id_anio_escolar") REFERENCES "tbl_anios_escolares"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_comunicados" ADD CONSTRAINT "tbl_comunicados_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_comunicados" ADD CONSTRAINT "tbl_comunicados_id_ref_audiencia_fkey" FOREIGN KEY ("id_ref_audiencia") REFERENCES "tbl_aulas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_lecturas_comunicado" ADD CONSTRAINT "tbl_lecturas_comunicado_id_comunicado_fkey" FOREIGN KEY ("id_comunicado") REFERENCES "tbl_comunicados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_lecturas_comunicado" ADD CONSTRAINT "tbl_lecturas_comunicado_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_plantilla_pension" ADD CONSTRAINT "tbl_plantilla_pension_id_anio_escolar_fkey" FOREIGN KEY ("id_anio_escolar") REFERENCES "tbl_anios_escolares"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_plantilla_pension" ADD CONSTRAINT "tbl_plantilla_pension_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_estado_pension" ADD CONSTRAINT "tbl_estado_pension_id_plantilla_fkey" FOREIGN KEY ("id_plantilla") REFERENCES "tbl_plantilla_pension"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_estado_pension" ADD CONSTRAINT "tbl_estado_pension_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "tbl_alumnos"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_estado_pension" ADD CONSTRAINT "tbl_estado_pension_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_auditoria" ADD CONSTRAINT "tbl_auditoria_id_usuario_actor_fkey" FOREIGN KEY ("id_usuario_actor") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
