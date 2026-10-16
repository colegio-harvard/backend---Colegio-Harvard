-- Colores visuales suaves para el catálogo de cursos de Primaria.
-- No modifica nombres, asignaciones, horarios, notas ni libretas.
UPDATE "tbl_cursos_academicos"
SET "color_horario" = CASE "id"
  WHEN 18 THEN '#DBEAFE' -- Matemática
  WHEN 13 THEN '#FDE2E2' -- Comunicación
  WHEN 16 THEN '#DCFCE7' -- Ciencia y Tecnología
  WHEN 14 THEN '#FEF3C7' -- Personal Social
  WHEN 17 THEN '#EDE9FE' -- Razonamiento Matemático
  WHEN 12 THEN '#E0F2FE' -- Razonamiento Verbal
  WHEN 15 THEN '#CCFBF1' -- Computación
  WHEN 21 THEN '#FFEDD5' -- Arte
  WHEN 19 THEN '#FFE4D6' -- Inglés
  WHEN 20 THEN '#FDE68A' -- Caligrafía y Plan Lector
  WHEN 22 THEN '#F3E8D5' -- Educación Física
  WHEN 23 THEN '#F5F0E6' -- Educación Religiosa
  ELSE "color_horario"
END
WHERE "id" IN (12,13,14,15,16,17,18,19,20,21,22,23);
