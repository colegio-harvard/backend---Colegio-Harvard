ALTER TABLE "tbl_catalogo_libreta"
ADD COLUMN IF NOT EXISTS "subcategoria" VARCHAR(40);

UPDATE "tbl_catalogo_libreta" SET categoria='PARTICIPACION_RELACIONES', subcategoria='FORTALEZA'
WHERE tipo='COMENTARIO_TUTOR' AND categoria='FORTALEZA' AND orden=1;
UPDATE "tbl_catalogo_libreta" SET categoria='RESPONSABILIDAD_AUTONOMIA', subcategoria='FORTALEZA'
WHERE tipo='COMENTARIO_TUTOR' AND categoria='FORTALEZA' AND orden=2;
UPDATE "tbl_catalogo_libreta" SET categoria='CONVIVENCIA_COMPORTAMIENTO', subcategoria='FORTALEZA'
WHERE tipo='COMENTARIO_TUTOR' AND categoria='FORTALEZA' AND orden=3;
UPDATE "tbl_catalogo_libreta" SET categoria='RESPONSABILIDAD_AUTONOMIA', subcategoria='EN_PROGRESO'
WHERE tipo='COMENTARIO_TUTOR' AND categoria='PROCESO' AND orden=10;
UPDATE "tbl_catalogo_libreta" SET categoria='ATENCION_ORGANIZACION', subcategoria='REQUIERE_APOYO'
WHERE tipo='COMENTARIO_TUTOR' AND categoria='PROCESO' AND orden=11;
UPDATE "tbl_catalogo_libreta" SET categoria='RESPONSABILIDAD_AUTONOMIA', subcategoria='REQUIERE_APOYO'
WHERE tipo='COMENTARIO_TUTOR' AND categoria='PROCESO' AND orden=12;

WITH opciones(categoria,subcategoria,texto,orden) AS (VALUES
('APRENDIZAJE_COMPRENSION','FORTALEZA','Comprende con facilidad los contenidos desarrollados.',101),
('APRENDIZAJE_COMPRENSION','FORTALEZA','Demuestra interés constante por aprender.',102),
('APRENDIZAJE_COMPRENSION','FORTALEZA','Comprende conceptos de mayor complejidad.',103),
('APRENDIZAJE_COMPRENSION','FORTALEZA','Expresa sus ideas con claridad.',104),
('APRENDIZAJE_COMPRENSION','FORTALEZA','Posee un vocabulario amplio y adecuado.',105),
('APRENDIZAJE_COMPRENSION','FORTALEZA','Aplica correctamente lo aprendido en nuevas situaciones.',106),
('APRENDIZAJE_COMPRENSION','EN_PROGRESO','Su comprensión de los contenidos mejora progresivamente.',107),
('APRENDIZAJE_COMPRENSION','EN_PROGRESO','Está fortaleciendo su expresión oral.',108),
('APRENDIZAJE_COMPRENSION','EN_PROGRESO','Su lectura muestra avances importantes.',109),
('APRENDIZAJE_COMPRENSION','EN_PROGRESO','Está desarrollando mayor seguridad para comunicar sus ideas.',110),
('APRENDIZAJE_COMPRENSION','EN_PROGRESO','Progresa favorablemente con el acompañamiento recibido.',111),
('APRENDIZAJE_COMPRENSION','REQUIERE_APOYO','Necesita reforzar algunos contenidos para consolidar sus aprendizajes.',112),
('APRENDIZAJE_COMPRENSION','REQUIERE_APOYO','Requiere practicar diariamente la expresión oral.',113),
('APRENDIZAJE_COMPRENSION','REQUIERE_APOYO','Necesita apoyo para comprender instrucciones escritas.',114),
('APRENDIZAJE_COMPRENSION','REQUIERE_APOYO','Requiere acompañamiento para retener algunos procedimientos.',115),
('APRENDIZAJE_COMPRENSION','REQUIERE_APOYO','Necesita fortalecer su comprensión lectora.',116),
('APRENDIZAJE_COMPRENSION','REQUIERE_APOYO','Requiere mayor práctica para desarrollar las actividades de manera independiente.',117),

('ATENCION_ORGANIZACION','FORTALEZA','Mantiene sus materiales ordenados y en buen estado.',201),
('ATENCION_ORGANIZACION','FORTALEZA','Sigue las indicaciones de manera adecuada.',202),
('ATENCION_ORGANIZACION','FORTALEZA','Utiliza responsablemente el tiempo destinado a sus actividades.',203),
('ATENCION_ORGANIZACION','FORTALEZA','Trabaja de manera limpia y ordenada.',204),
('ATENCION_ORGANIZACION','FORTALEZA','Demuestra buenos hábitos de trabajo.',205),
('ATENCION_ORGANIZACION','EN_PROGRESO','Está mejorando su capacidad de concentración.',206),
('ATENCION_ORGANIZACION','EN_PROGRESO','Está aprendiendo a organizar mejor sus materiales.',207),
('ATENCION_ORGANIZACION','EN_PROGRESO','Muestra avances en el cumplimiento oportuno de sus actividades.',208),
('ATENCION_ORGANIZACION','EN_PROGRESO','Está desarrollando mayor cuidado al revisar sus trabajos.',209),
('ATENCION_ORGANIZACION','EN_PROGRESO','Mejora progresivamente el uso de su tiempo.',210),
('ATENCION_ORGANIZACION','REQUIERE_APOYO','Necesita escuchar las indicaciones con mayor atención.',211),
('ATENCION_ORGANIZACION','REQUIERE_APOYO','Requiere fortalecer la organización de sus materiales.',212),
('ATENCION_ORGANIZACION','REQUIERE_APOYO','Necesita mejorar su concentración durante las actividades.',213),
('ATENCION_ORGANIZACION','REQUIERE_APOYO','Requiere administrar mejor el tiempo destinado a sus trabajos.',214),
('ATENCION_ORGANIZACION','REQUIERE_APOYO','Necesita revisar sus actividades antes de entregarlas.',215),
('ATENCION_ORGANIZACION','REQUIERE_APOYO','Requiere recordar con mayor frecuencia sus materiales escolares.',216),
('ATENCION_ORGANIZACION','REQUIERE_APOYO','Necesita trabajar con más calma para evitar errores por descuido.',217),

('RESPONSABILIDAD_AUTONOMIA','FORTALEZA','Cumple responsablemente con sus actividades.',301),
('RESPONSABILIDAD_AUTONOMIA','FORTALEZA','Asume adecuadamente las responsabilidades asignadas.',302),
('RESPONSABILIDAD_AUTONOMIA','FORTALEZA','Trabaja con autonomía y seguridad.',303),
('RESPONSABILIDAD_AUTONOMIA','FORTALEZA','Demuestra compromiso con su aprendizaje.',304),
('RESPONSABILIDAD_AUTONOMIA','FORTALEZA','Finaliza oportunamente las actividades propuestas.',305),
('RESPONSABILIDAD_AUTONOMIA','FORTALEZA','Cuida responsablemente los materiales del aula.',306),
('RESPONSABILIDAD_AUTONOMIA','EN_PROGRESO','Está desarrollando mayor autonomía en sus actividades.',307),
('RESPONSABILIDAD_AUTONOMIA','EN_PROGRESO','Muestra avances en el cumplimiento de sus responsabilidades.',308),
('RESPONSABILIDAD_AUTONOMIA','EN_PROGRESO','Está aprendiendo a solicitar ayuda cuando la necesita.',309),
('RESPONSABILIDAD_AUTONOMIA','EN_PROGRESO','Mejora progresivamente su capacidad para trabajar de manera independiente.',310),
('RESPONSABILIDAD_AUTONOMIA','EN_PROGRESO','Demuestra disposición para asumir nuevas responsabilidades.',311),
('RESPONSABILIDAD_AUTONOMIA','REQUIERE_APOYO','Necesita asumir con mayor constancia sus responsabilidades.',312),
('RESPONSABILIDAD_AUTONOMIA','REQUIERE_APOYO','Necesita fortalecer su autonomía durante el trabajo escolar.',313),
('RESPONSABILIDAD_AUTONOMIA','REQUIERE_APOYO','Requiere mayor constancia en la entrega de sus actividades.',314),
('RESPONSABILIDAD_AUTONOMIA','REQUIERE_APOYO','Necesita perseverar cuando encuentra alguna dificultad.',315),
('RESPONSABILIDAD_AUTONOMIA','REQUIERE_APOYO','Requiere supervisión para organizar y concluir sus trabajos.',316),

('CONVIVENCIA_COMPORTAMIENTO','FORTALEZA','Respeta las normas establecidas en el aula.',401),
('CONVIVENCIA_COMPORTAMIENTO','FORTALEZA','Se relaciona de manera amable y respetuosa.',402),
('CONVIVENCIA_COMPORTAMIENTO','FORTALEZA','Demuestra consideración por las opiniones de los demás.',403),
('CONVIVENCIA_COMPORTAMIENTO','FORTALEZA','Cuida los materiales y espacios de la institución.',404),
('CONVIVENCIA_COMPORTAMIENTO','FORTALEZA','Resuelve sus diferencias mediante el diálogo.',405),
('CONVIVENCIA_COMPORTAMIENTO','EN_PROGRESO','Está aprendiendo a escuchar y respetar diferentes opiniones.',406),
('CONVIVENCIA_COMPORTAMIENTO','EN_PROGRESO','Muestra avances en el cumplimiento de las normas de convivencia.',407),
('CONVIVENCIA_COMPORTAMIENTO','EN_PROGRESO','Está desarrollando mayor autocontrol en sus acciones.',408),
('CONVIVENCIA_COMPORTAMIENTO','EN_PROGRESO','Mejora progresivamente su relación con sus compañeros.',409),
('CONVIVENCIA_COMPORTAMIENTO','EN_PROGRESO','Está aprendiendo a expresar sus desacuerdos de manera adecuada.',410),
('CONVIVENCIA_COMPORTAMIENTO','REQUIERE_APOYO','Necesita respetar los turnos para participar.',411),
('CONVIVENCIA_COMPORTAMIENTO','REQUIERE_APOYO','Requiere fortalecer el respeto hacia las opiniones de sus compañeros.',412),
('CONVIVENCIA_COMPORTAMIENTO','REQUIERE_APOYO','Necesita reflexionar antes de actuar.',413),
('CONVIVENCIA_COMPORTAMIENTO','REQUIERE_APOYO','Requiere mejorar el cumplimiento de las normas del aula.',414),
('CONVIVENCIA_COMPORTAMIENTO','REQUIERE_APOYO','Necesita expresar sus emociones y desacuerdos mediante el diálogo.',415),
('CONVIVENCIA_COMPORTAMIENTO','REQUIERE_APOYO','Requiere fortalecer el respeto por los materiales y espacios comunes.',416),
('CONVIVENCIA_COMPORTAMIENTO','REQUIERE_APOYO','Necesita evitar interrupciones durante la participación de sus compañeros.',417),

('PARTICIPACION_RELACIONES','FORTALEZA','Colabora espontáneamente con sus compañeros.',501),
('PARTICIPACION_RELACIONES','FORTALEZA','Muestra disposición para ayudar a los demás.',502),
('PARTICIPACION_RELACIONES','FORTALEZA','Trabaja adecuadamente en equipo.',503),
('PARTICIPACION_RELACIONES','FORTALEZA','Se integra con facilidad en las actividades grupales.',504),
('PARTICIPACION_RELACIONES','FORTALEZA','Demuestra iniciativa y capacidad de liderazgo.',505),
('PARTICIPACION_RELACIONES','FORTALEZA','Participa con entusiasmo y seguridad.',506),
('PARTICIPACION_RELACIONES','EN_PROGRESO','Está desarrollando mayor confianza para participar.',507),
('PARTICIPACION_RELACIONES','EN_PROGRESO','Muestra avances en su integración al trabajo grupal.',508),
('PARTICIPACION_RELACIONES','EN_PROGRESO','Participa cuando recibe orientación y motivación.',509),
('PARTICIPACION_RELACIONES','EN_PROGRESO','Está aprendiendo a compartir y colaborar con sus compañeros.',510),
('PARTICIPACION_RELACIONES','EN_PROGRESO','Demuestra progresivamente mayor iniciativa.',511),
('PARTICIPACION_RELACIONES','REQUIERE_APOYO','Necesita participar con mayor frecuencia en las actividades.',512),
('PARTICIPACION_RELACIONES','REQUIERE_APOYO','Requiere fortalecer su confianza para expresar sus ideas.',513),
('PARTICIPACION_RELACIONES','REQUIERE_APOYO','Necesita integrarse de manera más activa al trabajo grupal.',514),
('PARTICIPACION_RELACIONES','REQUIERE_APOYO','Requiere solicitar ayuda cuando encuentra dificultades.',515),
('PARTICIPACION_RELACIONES','REQUIERE_APOYO','Necesita desarrollar mayor disposición para colaborar.',516),
('PARTICIPACION_RELACIONES','REQUIERE_APOYO','Requiere respetar los acuerdos establecidos durante el trabajo en equipo.',517),

('PROGRESO_ACTITUD','FORTALEZA','Mantiene una actitud positiva frente al aprendizaje.',601),
('PROGRESO_ACTITUD','FORTALEZA','Demuestra orgullo y dedicación en sus trabajos.',602),
('PROGRESO_ACTITUD','FORTALEZA','Se esfuerza constantemente por mejorar.',603),
('PROGRESO_ACTITUD','FORTALEZA','Recibe favorablemente las orientaciones brindadas.',604),
('PROGRESO_ACTITUD','FORTALEZA','Demuestra perseverancia ante las dificultades.',605),
('PROGRESO_ACTITUD','FORTALEZA','Evidencia avances significativos durante el bimestre.',606),
('PROGRESO_ACTITUD','EN_PROGRESO','Mejora progresivamente en el desarrollo de sus actividades.',607),
('PROGRESO_ACTITUD','EN_PROGRESO','Ha mostrado avances gracias a su esfuerzo constante.',608),
('PROGRESO_ACTITUD','EN_PROGRESO','Está fortaleciendo su confianza y seguridad personal.',609),
('PROGRESO_ACTITUD','EN_PROGRESO','Responde positivamente al reconocimiento de sus logros.',610),
('PROGRESO_ACTITUD','EN_PROGRESO','Su desempeño mejora con el acompañamiento recibido.',611),
('PROGRESO_ACTITUD','EN_PROGRESO','Está desarrollando una actitud más constante frente al trabajo escolar.',612),
('PROGRESO_ACTITUD','REQUIERE_APOYO','Necesita mantener mayor constancia en sus actividades.',613),
('PROGRESO_ACTITUD','REQUIERE_APOYO','Requiere esforzarse de manera sostenida para alcanzar sus objetivos.',614),
('PROGRESO_ACTITUD','REQUIERE_APOYO','Necesita confiar más en sus capacidades.',615),
('PROGRESO_ACTITUD','REQUIERE_APOYO','Requiere mostrar mayor disposición frente a las actividades propuestas.',616),
('PROGRESO_ACTITUD','REQUIERE_APOYO','Necesita perseverar y evitar abandonar las tareas ante una dificultad.',617),
('PROGRESO_ACTITUD','REQUIERE_APOYO','Requiere aprovechar mejor las orientaciones proporcionadas.',618),

('FORTALEZAS_DESTACADAS','RENDIMIENTO_ACADEMICO','Demuestra un desempeño académico destacado.',701),
('FORTALEZAS_DESTACADAS','RENDIMIENTO_ACADEMICO','Utiliza eficazmente sus habilidades y conocimientos.',702),
('FORTALEZAS_DESTACADAS','RENDIMIENTO_ACADEMICO','Resuelve las actividades con claridad y precisión.',703),
('FORTALEZAS_DESTACADAS','RENDIMIENTO_ACADEMICO','Aprende con rapidez y aplica correctamente lo aprendido.',704),
('FORTALEZAS_DESTACADAS','RENDIMIENTO_ACADEMICO','Destaca por su capacidad de razonamiento.',705),
('FORTALEZAS_DESTACADAS','CREATIVIDAD_TRABAJO','Presenta trabajos ordenados, originales y creativos.',706),
('FORTALEZAS_DESTACADAS','CREATIVIDAD_TRABAJO','Demuestra creatividad en el desarrollo de sus actividades.',707),
('FORTALEZAS_DESTACADAS','CREATIVIDAD_TRABAJO','Aporta ideas valiosas durante el trabajo grupal.',708),
('FORTALEZAS_DESTACADAS','CREATIVIDAD_TRABAJO','Trabaja con dedicación y atención a los detalles.',709),
('FORTALEZAS_DESTACADAS','HABILIDADES_PERSONALES','Demuestra excelentes habilidades para relacionarse con los demás.',710),
('FORTALEZAS_DESTACADAS','HABILIDADES_PERSONALES','Posee cualidades favorables para ejercer liderazgo.',711),
('FORTALEZAS_DESTACADAS','HABILIDADES_PERSONALES','Destaca por su responsabilidad y compromiso.',712),
('FORTALEZAS_DESTACADAS','HABILIDADES_PERSONALES','Demuestra especial habilidad en las actividades psicomotrices.',713),
('FORTALEZAS_DESTACADAS','HABILIDADES_PERSONALES','Mantiene una actitud solidaria y colaborativa.',714),

('ACOMPANAMIENTO_FAMILIAR','FORTALEZA','El acompañamiento familiar favorece positivamente su aprendizaje.',801),
('ACOMPANAMIENTO_FAMILIAR','FORTALEZA','El apoyo recibido en casa se refleja en sus avances.',802),
('ACOMPANAMIENTO_FAMILIAR','FORTALEZA','La comunicación constante con la familia contribuye a su desarrollo.',803),
('ACOMPANAMIENTO_FAMILIAR','FORTALEZA','Agradecemos el compromiso y apoyo brindado desde casa.',804),
('ACOMPANAMIENTO_FAMILIAR','FORTALEZA','El seguimiento familiar ha permitido fortalecer su desempeño.',805),
('ACOMPANAMIENTO_FAMILIAR','RECOMENDACION','Se recomienda continuar reforzando en casa los aprendizajes desarrollados.',806),
('ACOMPANAMIENTO_FAMILIAR','RECOMENDACION','Es importante mantener el acompañamiento familiar en sus actividades.',807),
('ACOMPANAMIENTO_FAMILIAR','RECOMENDACION','Se recomienda fortalecer el hábito de lectura diaria en casa.',808),
('ACOMPANAMIENTO_FAMILIAR','RECOMENDACION','Es necesario mantener una comunicación frecuente con el tutor.',809),
('ACOMPANAMIENTO_FAMILIAR','RECOMENDACION','Se recomienda apoyar la organización de sus materiales y horarios.',810),
('ACOMPANAMIENTO_FAMILIAR','RECOMENDACION','Es importante reconocer sus avances y motivarlo a continuar mejorando.',811),
('ACOMPANAMIENTO_FAMILIAR','RECOMENDACION','Se recomienda establecer rutinas que favorezcan el cumplimiento de sus actividades.',812)
)
INSERT INTO "tbl_catalogo_libreta" (tipo,categoria,subcategoria,texto,orden)
SELECT 'COMENTARIO_TUTOR',o.categoria,o.subcategoria,o.texto,o.orden
FROM opciones o
WHERE NOT EXISTS (
  SELECT 1 FROM "tbl_catalogo_libreta" c
  WHERE c.tipo='COMENTARIO_TUTOR' AND c.texto=o.texto
);
