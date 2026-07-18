CREATE TABLE IF NOT EXISTS "tbl_criterios_padre" (
  "id" SERIAL PRIMARY KEY,
  "nombre" VARCHAR(200) NOT NULL UNIQUE,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "activo" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "tbl_notas_padre" (
  "id" SERIAL PRIMARY KEY,
  "id_alumno" INTEGER NOT NULL REFERENCES "tbl_alumnos"("id") ON DELETE CASCADE,
  "id_periodo" INTEGER NOT NULL REFERENCES "tbl_periodos_academicos"("id") ON DELETE CASCADE,
  "id_criterio" INTEGER NOT NULL REFERENCES "tbl_criterios_padre"("id"),
  "calificacion" VARCHAR(2) NOT NULL CHECK ("calificacion" IN ('AD','A','B','C')),
  "creado_por" INTEGER NOT NULL REFERENCES "tbl_usuarios"("id"),
  "modificado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("id_alumno", "id_periodo", "id_criterio")
);

INSERT INTO "tbl_criterios_padre" ("nombre","orden") VALUES
('Ayuda al niño en sus tareas',1),
('Ayuda a corregir las malas conductas del niño',2),
('Asiste a los llamados del profesor',3),
('Cumple el Reglamento del Colegio',4),
('Participa en las actividades',5),
('Asiste a las reuniones',6),
('Conducta del padre',7)
ON CONFLICT ("nombre") DO UPDATE SET "orden"=EXCLUDED."orden", "activo"=TRUE;

CREATE INDEX IF NOT EXISTS "idx_notas_padre_alumno_periodo"
  ON "tbl_notas_padre"("id_alumno", "id_periodo");
