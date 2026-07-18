INSERT INTO "tbl_areas_academicas" ("nombre","orden") VALUES
('CIENCIAS SOCIALES',5),
('DESARROLLO PERSONAL, CIUDADANÍA Y CÍVICA',6),
('EDUCACIÓN PARA EL TRABAJO',10)
ON CONFLICT ("nombre") DO UPDATE SET "activo"=TRUE;

INSERT INTO "tbl_cursos_academicos" ("id_area","nombre","orden","nivel")
SELECT a.id,x.curso,x.orden,'SECUNDARIA' FROM "tbl_areas_academicas" a JOIN (VALUES
('MATEMÁTICA','Aritmética',1),('MATEMÁTICA','Álgebra',2),('MATEMÁTICA','Geometría',3),('MATEMÁTICA','Trigonometría',4),
('COMUNICACIÓN','Comunicación',1),('INGLÉS','Inglés',1),
('ARTE Y CULTURA','Arte',1),('ARTE Y CULTURA','Literatura',2),
('CIENCIAS SOCIALES','Historia',1),('CIENCIAS SOCIALES','Geografía',2),
('DESARROLLO PERSONAL, CIUDADANÍA Y CÍVICA','DPCC',1),
('EDUCACIÓN FÍSICA','Educación Física',1),('EDUCACIÓN RELIGIOSA','Formación Religiosa',1),
('CIENCIA Y TECNOLOGÍA','Química',1),('CIENCIA Y TECNOLOGÍA','Física',2),('CIENCIA Y TECNOLOGÍA','Biología',3),('CIENCIA Y TECNOLOGÍA','Computación',4),
('EDUCACIÓN PARA EL TRABAJO','Educación para el Trabajo',1)
) AS x(area,curso,orden) ON x.area=a.nombre
ON CONFLICT ("id_area","nombre","nivel") DO UPDATE SET "activo"=TRUE,"orden"=EXCLUDED."orden";
