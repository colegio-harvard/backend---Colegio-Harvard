CREATE TABLE "tbl_config_matricula" (
  "id" SERIAL PRIMARY KEY,
  "id_anio_escolar" INTEGER NOT NULL UNIQUE REFERENCES "tbl_anios_escolares"("id") ON DELETE CASCADE,
  "fecha_inicio" DATE,
  "fecha_fin" DATE,
  "nombre_documentos" VARCHAR(200) NOT NULL DEFAULT 'Documentos oficiales de matrícula',
  "enlace_documentos" TEXT,
  "version_documentos" VARCHAR(50) NOT NULL DEFAULT '1.0',
  "documentos_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "activo" BOOLEAN NOT NULL DEFAULT TRUE,
  "creado_por" INTEGER NOT NULL REFERENCES "tbl_usuarios"("id"),
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "actualizado_por" INTEGER REFERENCES "tbl_usuarios"("id"),
  "actualizado_en" TIMESTAMPTZ
);

CREATE TABLE "tbl_matriculas_digitales" (
  "id" SERIAL PRIMARY KEY,
  "codigo" VARCHAR(40) UNIQUE,
  "id_anio_escolar" INTEGER NOT NULL REFERENCES "tbl_anios_escolares"("id") ON DELETE RESTRICT,
  "id_alumno" INTEGER NOT NULL REFERENCES "tbl_alumnos"("id") ON DELETE RESTRICT,
  "id_padre" INTEGER NOT NULL REFERENCES "tbl_padres"("id") ON DELETE RESTRICT,
  "estado" VARCHAR(30) NOT NULL DEFAULT 'BORRADOR',
  "token_hash" VARCHAR(64) UNIQUE,
  "otp_hash" VARCHAR(64),
  "otp_vence_en" TIMESTAMPTZ,
  "otp_intentos" INTEGER NOT NULL DEFAULT 0,
  "invitacion_vence_en" TIMESTAMPTZ,
  "datos_snapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "datos_formulario" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "documentos_snapshot" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "aceptaciones_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "deuda_snapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "costo_matricula_snapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "aceptado_en" TIMESTAMPTZ,
  "aceptado_ip" VARCHAR(80),
  "aceptado_agente" TEXT,
  "hash_evidencia" VARCHAR(64),
  "observacion_revision" TEXT,
  "creado_por" INTEGER NOT NULL REFERENCES "tbl_usuarios"("id"),
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "actualizado_por" INTEGER REFERENCES "tbl_usuarios"("id"),
  "actualizado_en" TIMESTAMPTZ,
  UNIQUE ("id_anio_escolar", "id_alumno")
);

CREATE INDEX "idx_matriculas_estado" ON "tbl_matriculas_digitales"("id_anio_escolar", "estado");
CREATE INDEX "idx_matriculas_padre" ON "tbl_matriculas_digitales"("id_padre");

CREATE TABLE "tbl_eventos_matricula" (
  "id" SERIAL PRIMARY KEY,
  "id_matricula" INTEGER NOT NULL REFERENCES "tbl_matriculas_digitales"("id") ON DELETE CASCADE,
  "evento" VARCHAR(60) NOT NULL,
  "detalle_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "ip" VARCHAR(80),
  "agente" TEXT,
  "creado_por" INTEGER REFERENCES "tbl_usuarios"("id"),
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_eventos_matricula_fecha" ON "tbl_eventos_matricula"("id_matricula", "creado_en");

