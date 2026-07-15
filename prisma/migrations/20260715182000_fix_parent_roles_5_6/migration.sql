-- Corrige dos padres que fueron convertidos accidentalmente en tutores.
UPDATE "tbl_usuarios"
SET "id_rol" = (SELECT "id" FROM "tbl_roles" WHERE "codigo" = 'PADRE'),
    "date_time_modification" = NOW()
WHERE "id" IN (5, 6);

-- Un padre no debe conservar acceso académico creado durante el error.
UPDATE "tbl_asignaciones_academicas"
SET "activo" = FALSE
WHERE "id_docente" IN (5, 6);

DELETE FROM "tbl_asignaciones_tutor"
WHERE "id_usuario_tutor" IN (5, 6);
