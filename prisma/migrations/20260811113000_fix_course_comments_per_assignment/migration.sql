-- Cada curso conserva su propio comentario por alumno y bimestre.
-- La restriccion anterior incluia al autor, pero no al curso, por lo que
-- guardar un segundo curso reemplazaba el comentario del primero.
DO $$
DECLARE
  restriccion RECORD;
BEGIN
  FOR restriccion IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = '"tbl_observaciones_libreta"'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE "tbl_observaciones_libreta" DROP CONSTRAINT %I', restriccion.conname);
  END LOOP;
END $$;

-- Si excepcionalmente varios autores comentaron la misma asignacion,
-- se conserva el registro mas reciente antes de crear la nueva unicidad.
DELETE FROM "tbl_observaciones_libreta" anterior
USING "tbl_observaciones_libreta" reciente
WHERE anterior.tipo = 'COMENTARIO_DOCENTE'
  AND reciente.tipo = 'COMENTARIO_DOCENTE'
  AND anterior.id_alumno = reciente.id_alumno
  AND anterior.id_periodo = reciente.id_periodo
  AND anterior.id_asignacion = reciente.id_asignacion
  AND anterior.id < reciente.id;

CREATE UNIQUE INDEX "uq_observacion_curso_alumno_periodo"
  ON "tbl_observaciones_libreta" ("id_alumno", "id_periodo", "tipo", "id_asignacion")
  WHERE "tipo" = 'COMENTARIO_DOCENTE';

CREATE UNIQUE INDEX "uq_observacion_tutoria_autor"
  ON "tbl_observaciones_libreta" ("id_alumno", "id_periodo", "tipo", "creado_por")
  WHERE "tipo" <> 'COMENTARIO_DOCENTE';

