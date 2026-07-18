ALTER TABLE "tbl_notas_academicas"
  ADD COLUMN IF NOT EXISTS "nota_numerica" NUMERIC(4,2)
  CHECK ("nota_numerica" BETWEEN 0 AND 20);

ALTER TABLE "tbl_auditoria_notas"
  ADD COLUMN IF NOT EXISTS "nota_numerica_anterior" NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS "nota_numerica_nueva" NUMERIC(4,2);

ALTER TABLE "tbl_cursos_academicos" ADD COLUMN IF NOT EXISTS "nivel" VARCHAR(20) NOT NULL DEFAULT 'INICIAL';
ALTER TABLE "tbl_cursos_academicos" DROP CONSTRAINT IF EXISTS "tbl_cursos_academicos_id_area_nombre_key";
ALTER TABLE "tbl_cursos_academicos" DROP CONSTRAINT IF EXISTS "uq_curso_area_nivel";
ALTER TABLE "tbl_cursos_academicos" ADD CONSTRAINT "uq_curso_area_nivel" UNIQUE ("id_area","nombre","nivel");

INSERT INTO "tbl_areas_academicas" ("nombre","orden") VALUES
('INGLÉS',3),('ARTE Y CULTURA',5),('EDUCACIÓN FÍSICA',7),('EDUCACIÓN RELIGIOSA',8)
ON CONFLICT ("nombre") DO UPDATE SET "activo"=TRUE,"orden"=EXCLUDED."orden";

INSERT INTO "tbl_cursos_academicos" ("id_area","nombre","orden","nivel")
SELECT a.id,x.curso,x.orden,'PRIMARIA' FROM "tbl_areas_academicas" a JOIN (VALUES
('MATEMÁTICA','Lógico Matemático',1),('MATEMÁTICA','Razonamiento Matemático',2),
('COMUNICACIÓN','Comunicación',1),('COMUNICACIÓN','Razonamiento Verbal',2),
('INGLÉS','Inglés',1),('PERSONAL SOCIAL','Personal Social',1),
('ARTE Y CULTURA','Arte',1),('ARTE Y CULTURA','Plan Lector',2),
('CIENCIA Y TECNOLOGÍA','Ciencia y Ambiente',1),('CIENCIA Y TECNOLOGÍA','Computación',2),
('EDUCACIÓN FÍSICA','Educación Física',1),('EDUCACIÓN RELIGIOSA','Formación Religiosa',1)
) AS x(area,curso,orden) ON x.area=a.nombre
ON CONFLICT ("id_area","nombre","nivel") DO UPDATE SET "activo"=TRUE,"orden"=EXCLUDED."orden";
