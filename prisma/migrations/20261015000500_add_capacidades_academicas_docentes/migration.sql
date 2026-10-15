-- Fase 10.4: capacidades directas por usuario.
-- El rol principal se mantiene en tbl_usuarios.id_rol; esta relación solo
-- concede capacidades puntuales aprobadas por administración.
CREATE TABLE "tbl_usuarios_permisos" (
  "id" SERIAL PRIMARY KEY,
  "id_usuario" INTEGER NOT NULL REFERENCES "tbl_usuarios"("id") ON DELETE CASCADE,
  "id_permiso" INTEGER NOT NULL REFERENCES "tbl_permisos"("id") ON DELETE CASCADE,
  "asignado_por" INTEGER REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL,
  "asignado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_usuario_permiso" UNIQUE ("id_usuario", "id_permiso")
);

CREATE INDEX "idx_usuarios_permisos_usuario" ON "tbl_usuarios_permisos" ("id_usuario");

INSERT INTO "tbl_permisos" ("codigo", "nombre", "descripcion", "tipo", "recurso")
VALUES (
  'ACADEMICO_DOCENTE',
  'Capacidad académica docente',
  'Permite funciones docentes personales de Horarios sin cambiar el rol principal.',
  'capacidad',
  'horarios.docente'
)
ON CONFLICT ("codigo") DO UPDATE
SET "nombre" = EXCLUDED."nombre",
    "descripcion" = EXCLUDED."descripcion",
    "tipo" = EXCLUDED."tipo",
    "recurso" = EXCLUDED."recurso";
