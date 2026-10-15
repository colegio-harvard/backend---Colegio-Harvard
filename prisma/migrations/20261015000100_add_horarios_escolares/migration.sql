CREATE TABLE "tbl_bloques_horarios" (
  "id" SERIAL PRIMARY KEY,
  "id_anio_escolar" INTEGER NOT NULL REFERENCES "tbl_anios_escolares"("id") ON DELETE CASCADE,
  "id_nivel" INTEGER NOT NULL REFERENCES "tbl_niveles"("id") ON DELETE RESTRICT,
  "nombre" VARCHAR(100) NOT NULL,
  "orden" INTEGER NOT NULL,
  "hora_inicio" TIME NOT NULL,
  "hora_fin" TIME NOT NULL,
  "tipo" VARCHAR(10) NOT NULL DEFAULT 'CLASE',
  "activo" BOOLEAN NOT NULL DEFAULT TRUE,
  "creado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "actualizado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL,
  "actualizado_en" TIMESTAMPTZ,
  CONSTRAINT "chk_bloque_tipo" CHECK ("tipo" IN ('CLASE', 'RECREO', 'OTRO')),
  CONSTRAINT "chk_bloque_horas" CHECK ("hora_fin" > "hora_inicio"),
  CONSTRAINT "uq_bloque_anio_nivel_orden" UNIQUE ("id_anio_escolar", "id_nivel", "orden")
);

CREATE INDEX "idx_bloques_anio_nivel_activo" ON "tbl_bloques_horarios" ("id_anio_escolar", "id_nivel", "activo");

CREATE TABLE "tbl_horarios_escolares" (
  "id" SERIAL PRIMARY KEY,
  "id_anio_escolar" INTEGER NOT NULL REFERENCES "tbl_anios_escolares"("id") ON DELETE CASCADE,
  "id_aula" INTEGER NOT NULL REFERENCES "tbl_aulas"("id") ON DELETE CASCADE,
  "estado" VARCHAR(12) NOT NULL DEFAULT 'BORRADOR',
  "version" INTEGER NOT NULL DEFAULT 1,
  "publicado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL,
  "publicado_en" TIMESTAMPTZ,
  "creado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "actualizado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL,
  "actualizado_en" TIMESTAMPTZ,
  CONSTRAINT "chk_horario_estado" CHECK ("estado" IN ('BORRADOR', 'VALIDADO', 'PUBLICADO', 'ARCHIVADO')),
  CONSTRAINT "chk_horario_version" CHECK ("version" > 0),
  CONSTRAINT "uq_horario_anio_aula_version" UNIQUE ("id_anio_escolar", "id_aula", "version")
);

CREATE UNIQUE INDEX "uq_horario_publicado_por_aula" ON "tbl_horarios_escolares" ("id_anio_escolar", "id_aula") WHERE "estado" = 'PUBLICADO';
CREATE INDEX "idx_horarios_anio_aula_estado" ON "tbl_horarios_escolares" ("id_anio_escolar", "id_aula", "estado");

CREATE TABLE "tbl_horario_detalles" (
  "id" SERIAL PRIMARY KEY,
  "id_horario_escolar" INTEGER NOT NULL REFERENCES "tbl_horarios_escolares"("id") ON DELETE CASCADE,
  "id_bloque_horario" INTEGER NOT NULL REFERENCES "tbl_bloques_horarios"("id") ON DELETE RESTRICT,
  "dia_semana" VARCHAR(12) NOT NULL,
  "id_asignacion_academica" INTEGER NOT NULL REFERENCES "tbl_asignaciones_academicas"("id") ON DELETE RESTRICT,
  "observacion" VARCHAR(500),
  "creado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "actualizado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL,
  "actualizado_en" TIMESTAMPTZ,
  CONSTRAINT "chk_horario_dia_semana" CHECK ("dia_semana" IN ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO')),
  CONSTRAINT "uq_horario_dia_bloque" UNIQUE ("id_horario_escolar", "dia_semana", "id_bloque_horario")
);

CREATE INDEX "idx_horario_detalles_bloque_dia" ON "tbl_horario_detalles" ("id_bloque_horario", "dia_semana");
CREATE INDEX "idx_horario_detalles_asignacion" ON "tbl_horario_detalles" ("id_asignacion_academica");
