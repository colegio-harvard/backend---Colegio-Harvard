ALTER TABLE "tbl_cursos_academicos"
  ADD COLUMN "color_horario" VARCHAR(7);

ALTER TABLE "tbl_cursos_academicos"
  ADD CONSTRAINT "ck_cursos_academicos_color_horario_hex"
  CHECK ("color_horario" IS NULL OR "color_horario" ~ '^#[0-9A-Fa-f]{6}$');

UPDATE "tbl_cursos_academicos"
SET "color_horario" = CASE "id"
  WHEN 10 THEN '#DBEAFE'
  WHEN 1 THEN '#FEE2E2'
  WHEN 4 THEN '#FEF3C7'
  WHEN 6 THEN '#E5E7EB'
  WHEN 8 THEN '#D1FAE5'
  WHEN 9 THEN '#CCFBF1'
  WHEN 3 THEN '#FFEDD5'
  WHEN 5 THEN '#F5F0E6'
  WHEN 2 THEN '#EDE9FE'
  ELSE "color_horario"
END
WHERE "id" IN (1,2,3,4,5,6,8,9,10);
