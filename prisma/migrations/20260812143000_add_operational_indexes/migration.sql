CREATE INDEX IF NOT EXISTS "idx_alumnos_aula_estado"
  ON "tbl_alumnos" ("id_aula", "estado");
CREATE INDEX IF NOT EXISTS "idx_alumnos_nombre"
  ON "tbl_alumnos" ("nombre_completo");

CREATE INDEX IF NOT EXISTS "idx_eventos_alumno_fecha_hora"
  ON "tbl_eventos_asistencia" ("id_alumno", "fecha_evento", "fecha_hora_evento");
CREATE INDEX IF NOT EXISTS "idx_eventos_anio_fecha"
  ON "tbl_eventos_asistencia" ("id_anio_escolar", "fecha_evento");
CREATE INDEX IF NOT EXISTS "idx_asistencia_anio_fecha_estado"
  ON "tbl_asistencia_dia" ("id_anio_escolar", "fecha", "estado");

CREATE INDEX IF NOT EXISTS "idx_estado_pension_plantilla_estado_clave"
  ON "tbl_estado_pension" ("id_plantilla", "estado", "clave_mes");
CREATE INDEX IF NOT EXISTS "idx_pagos_estado_fecha"
  ON "tbl_pagos_pension" ("id_estado_pension", "fecha_pago");
CREATE INDEX IF NOT EXISTS "idx_pagos_fecha"
  ON "tbl_pagos_pension" ("fecha_pago");

CREATE INDEX IF NOT EXISTS "idx_auditoria_fecha"
  ON "tbl_auditoria" ("marca_tiempo");
CREATE INDEX IF NOT EXISTS "idx_auditoria_usuario_fecha"
  ON "tbl_auditoria" ("id_usuario_actor", "marca_tiempo");
CREATE INDEX IF NOT EXISTS "idx_auditoria_accion_fecha"
  ON "tbl_auditoria" ("codigo_accion", "marca_tiempo");
