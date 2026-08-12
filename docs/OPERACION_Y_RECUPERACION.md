# Operación segura y recuperación

## Publicación por etapas

1. Ejecutar las pruebas automáticas del backend.
2. Validar el esquema de la base de datos.
3. Compilar y revisar el frontend.
4. Publicar primero en el entorno de prueba.
5. Verificar inicio de sesión, pagos, asistencia y notas.
6. Publicar en producción y comprobar `/api/health`.

## Respaldo

- La base de datos se respalda diariamente a las 02:00, hora de Lima.
- El superadministrador puede descargar un respaldo lógico completo.
- El resultado del respaldo programado debe aparecer como `OK` en los registros.
- Un archivo vacío o una subida fallida se consideran un respaldo fallido.

## Prueba de restauración mensual

1. Crear una base de datos temporal vacía, nunca usar producción.
2. Descargar el respaldo seleccionado desde Wasabi.
3. Restaurarlo en la base temporal.
4. Verificar usuarios, alumnos, pagos, asistencias y notas mediante conteos.
5. Registrar fecha, responsable, respaldo usado y resultado.
6. Eliminar la base temporal al terminar.

## Incidente en producción

1. Anotar la hora y el identificador de solicitud mostrado por el sistema.
2. Detener nuevas publicaciones.
3. Revisar `/api/health` y los registros del despliegue.
4. Si la versión nueva es responsable, volver a la versión anterior.
5. Restaurar datos únicamente cuando exista evidencia de pérdida o corrupción.
