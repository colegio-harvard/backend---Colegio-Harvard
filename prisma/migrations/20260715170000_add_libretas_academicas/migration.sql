INSERT INTO "tbl_roles" ("codigo", "nombre", "descripcion")
VALUES ('DOCENTE', 'Docente', 'Registro de notas de cursos asignados')
ON CONFLICT ("codigo") DO NOTHING;

CREATE TABLE "tbl_areas_academicas" (
  "id" SERIAL PRIMARY KEY,
  "nombre" VARCHAR(120) NOT NULL UNIQUE,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "activo" BOOLEAN NOT NULL DEFAULT TRUE,
  "creado_por" INTEGER REFERENCES "tbl_usuarios"("id"),
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "tbl_cursos_academicos" (
  "id" SERIAL PRIMARY KEY,
  "id_area" INTEGER NOT NULL REFERENCES "tbl_areas_academicas"("id"),
  "nombre" VARCHAR(150) NOT NULL,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "activo" BOOLEAN NOT NULL DEFAULT TRUE,
  "creado_por" INTEGER REFERENCES "tbl_usuarios"("id"),
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("id_area", "nombre")
);

CREATE TABLE "tbl_periodos_academicos" (
  "id" SERIAL PRIMARY KEY,
  "id_anio_escolar" INTEGER NOT NULL REFERENCES "tbl_anios_escolares"("id") ON DELETE CASCADE,
  "numero" INTEGER NOT NULL CHECK ("numero" BETWEEN 1 AND 4),
  "nombre" VARCHAR(40) NOT NULL,
  "estado" VARCHAR(20) NOT NULL DEFAULT 'ABIERTO' CHECK ("estado" IN ('ABIERTO','REVISION','CERRADO')),
  "modificado_por" INTEGER REFERENCES "tbl_usuarios"("id"),
  "modificado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("id_anio_escolar", "numero")
);

CREATE TABLE "tbl_asignaciones_academicas" (
  "id" SERIAL PRIMARY KEY,
  "id_anio_escolar" INTEGER NOT NULL REFERENCES "tbl_anios_escolares"("id") ON DELETE CASCADE,
  "id_aula" INTEGER NOT NULL REFERENCES "tbl_aulas"("id") ON DELETE CASCADE,
  "id_curso" INTEGER NOT NULL REFERENCES "tbl_cursos_academicos"("id"),
  "id_docente" INTEGER NOT NULL REFERENCES "tbl_usuarios"("id"),
  "activo" BOOLEAN NOT NULL DEFAULT TRUE,
  "creado_por" INTEGER REFERENCES "tbl_usuarios"("id"),
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("id_anio_escolar", "id_aula", "id_curso")
);

CREATE TABLE "tbl_notas_academicas" (
  "id" SERIAL PRIMARY KEY,
  "id_asignacion" INTEGER NOT NULL REFERENCES "tbl_asignaciones_academicas"("id") ON DELETE CASCADE,
  "id_periodo" INTEGER NOT NULL REFERENCES "tbl_periodos_academicos"("id") ON DELETE CASCADE,
  "id_alumno" INTEGER NOT NULL REFERENCES "tbl_alumnos"("id") ON DELETE CASCADE,
  "calificacion" VARCHAR(2) NOT NULL CHECK ("calificacion" IN ('AD','A','B','C')),
  "creado_por" INTEGER NOT NULL REFERENCES "tbl_usuarios"("id"),
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "modificado_por" INTEGER REFERENCES "tbl_usuarios"("id"),
  "modificado_en" TIMESTAMPTZ,
  UNIQUE ("id_asignacion", "id_periodo", "id_alumno")
);

CREATE TABLE "tbl_auditoria_notas" (
  "id" BIGSERIAL PRIMARY KEY,
  "id_nota" INTEGER NOT NULL REFERENCES "tbl_notas_academicas"("id") ON DELETE CASCADE,
  "calificacion_anterior" VARCHAR(2),
  "calificacion_nueva" VARCHAR(2) NOT NULL,
  "motivo" TEXT,
  "id_usuario" INTEGER NOT NULL REFERENCES "tbl_usuarios"("id"),
  "fecha" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "tbl_catalogo_libreta" (
  "id" SERIAL PRIMARY KEY,
  "tipo" VARCHAR(30) NOT NULL CHECK ("tipo" IN ('COMENTARIO_DOCENTE','COMENTARIO_TUTOR','NOTA_PADRE')),
  "categoria" VARCHAR(50),
  "texto" VARCHAR(500) NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT TRUE,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "creado_por" INTEGER REFERENCES "tbl_usuarios"("id"),
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "tbl_criterios_conducta" (
  "id" SERIAL PRIMARY KEY,
  "nombre" VARCHAR(200) NOT NULL UNIQUE,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "activo" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE "tbl_notas_conducta" (
  "id" SERIAL PRIMARY KEY,
  "id_alumno" INTEGER NOT NULL REFERENCES "tbl_alumnos"("id") ON DELETE CASCADE,
  "id_periodo" INTEGER NOT NULL REFERENCES "tbl_periodos_academicos"("id") ON DELETE CASCADE,
  "id_criterio" INTEGER NOT NULL REFERENCES "tbl_criterios_conducta"("id"),
  "calificacion" VARCHAR(2) NOT NULL CHECK ("calificacion" IN ('AD','A','B','C')),
  "creado_por" INTEGER NOT NULL REFERENCES "tbl_usuarios"("id"),
  "modificado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("id_alumno", "id_periodo", "id_criterio")
);

CREATE TABLE "tbl_observaciones_libreta" (
  "id" SERIAL PRIMARY KEY,
  "id_alumno" INTEGER NOT NULL REFERENCES "tbl_alumnos"("id") ON DELETE CASCADE,
  "id_periodo" INTEGER NOT NULL REFERENCES "tbl_periodos_academicos"("id") ON DELETE CASCADE,
  "tipo" VARCHAR(30) NOT NULL CHECK ("tipo" IN ('COMENTARIO_DOCENTE','COMENTARIO_TUTOR','NOTA_PADRE')),
  "id_catalogo" INTEGER NOT NULL REFERENCES "tbl_catalogo_libreta"("id"),
  "id_asignacion" INTEGER REFERENCES "tbl_asignaciones_academicas"("id") ON DELETE CASCADE,
  "creado_por" INTEGER NOT NULL REFERENCES "tbl_usuarios"("id"),
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("id_alumno", "id_periodo", "tipo", "creado_por")
);

CREATE INDEX "idx_notas_alumno_periodo" ON "tbl_notas_academicas"("id_alumno", "id_periodo");
CREATE INDEX "idx_asignaciones_docente" ON "tbl_asignaciones_academicas"("id_docente", "activo");

INSERT INTO "tbl_areas_academicas" ("nombre", "orden") VALUES
('COMUNICACIÓN',1),('PERSONAL SOCIAL',2),('PSICOMOTRIZ',3),('CIENCIA Y TECNOLOGÍA',4),('MATEMÁTICA',5)
ON CONFLICT DO NOTHING;

INSERT INTO "tbl_cursos_academicos" ("id_area","nombre","orden")
SELECT a.id, x.nombre, x.orden FROM "tbl_areas_academicas" a JOIN (VALUES
('COMUNICACIÓN','Comunicación',1),('COMUNICACIÓN','Aprestamiento',2),('COMUNICACIÓN','Inglés',3),
('PERSONAL SOCIAL','Personal Social',1),('PERSONAL SOCIAL','Educación Religiosa',2),
('PSICOMOTRIZ','Psicomotricidad',1),('PSICOMOTRIZ','Arte',2),
('CIENCIA Y TECNOLOGÍA','Ciencia y Ambiente',1),('CIENCIA Y TECNOLOGÍA','Computación',2),
('MATEMÁTICA','Matemática',1),('MATEMÁTICA','Razonamiento Matemático',2)
) AS x(area,nombre,orden) ON x.area=a.nombre ON CONFLICT DO NOTHING;

INSERT INTO "tbl_criterios_conducta" ("nombre","orden") VALUES
('Orden e higiene',1),('Puntualidad y asistencia',2),('Responsabilidad en el trabajo escolar',3),
('Deseo de superación',4),('Compañerismo y ayuda mutua',5),('Respeto al derecho de los demás',6),
('Honradez y veracidad en todos sus actos',7),('Respeta las normas del Centro Educativo',8),
('Participa en las actividades del salón',9),('Conducta',10) ON CONFLICT DO NOTHING;

INSERT INTO "tbl_catalogo_libreta" ("tipo","categoria","texto","orden") VALUES
('COMENTARIO_TUTOR','FORTALEZA','Participa activamente en las actividades propuestas.',1),
('COMENTARIO_TUTOR','FORTALEZA','Demuestra autonomía y responsabilidad en sus actividades.',2),
('COMENTARIO_TUTOR','FORTALEZA','Mantiene una convivencia respetuosa con sus compañeros.',3),
('COMENTARIO_TUTOR','PROCESO','Se encuentra fortaleciendo su autonomía.',10),
('COMENTARIO_TUTOR','PROCESO','Necesita fortalecer su atención durante las actividades.',11),
('COMENTARIO_TUTOR','PROCESO','Requiere acompañamiento para culminar las actividades.',12),
('COMENTARIO_DOCENTE','FORTALEZA','Ha mostrado avances significativos durante el bimestre.',1),
('COMENTARIO_DOCENTE','PROCESO','Necesita practicar la expresión oral.',10),
('COMENTARIO_DOCENTE','PROCESO','Su rendimiento aún no es consistente.',11),
('COMENTARIO_DOCENTE','RECOMENDACION','Siga esforzándose, tiene mucho potencial.',20),
('NOTA_PADRE','POSITIVO','Acompaña oportunamente las actividades del estudiante.',1),
('NOTA_PADRE','POSITIVO','Mantiene comunicación permanente con el tutor.',2),
('NOTA_PADRE','POSITIVO','Asiste regularmente a reuniones y citaciones.',3),
('NOTA_PADRE','PROCESO','Requiere fortalecer el acompañamiento en casa.',10),
('NOTA_PADRE','PROCESO','Necesita mantener comunicación más frecuente con el tutor.',11);

INSERT INTO "tbl_periodos_academicos" ("id_anio_escolar","numero","nombre")
SELECT id, n, CONCAT('Bimestre ', n) FROM "tbl_anios_escolares" CROSS JOIN generate_series(1,4) n
ON CONFLICT DO NOTHING;
