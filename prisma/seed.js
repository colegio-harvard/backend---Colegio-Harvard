const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin2026', 10);

  // 1. ROLES (6 roles del sistema)
  await prisma.tbl_roles.createMany({
    data: [
      { codigo: 'SUPER_ADMIN', nombre: 'Super Administrador', descripcion: 'Control total del sistema, configuracion global y auditoria', user_id_registration: 1 },
      { codigo: 'ADMIN', nombre: 'Administrador', descripcion: 'Gestion de alumnos, padres, aulas, asistencia, comunicados, pensiones y ano escolar', user_id_registration: 1 },
      { codigo: 'TUTOR', nombre: 'Tutor', descripcion: 'Agenda, mensajeria, asistencia de su aula', user_id_registration: 1 },
      { codigo: 'PADRE', nombre: 'Padre', descripcion: 'Ver asistencia, agenda, comunicados, mensajeria, pensiones de sus hijos', user_id_registration: 1 },
      { codigo: 'PORTERIA', nombre: 'Porteria', descripcion: 'Registro de ingreso/salida QR y PIN', user_id_registration: 1 },
      { codigo: 'PSICOLOGIA', nombre: 'Psicología', descripcion: 'Acceso a comunicados del colegio', user_id_registration: 1 },
    ],
    skipDuplicates: true,
  });

  // 2. USUARIO SUPER_ADMIN (bootstrap - unico usuario inicial)
  await prisma.tbl_usuarios.createMany({
    data: [
      { username: 'superadmin', contrasena: hash, nombres: 'ADMINISTRADOR DEL SISTEMA', id_rol: 1, estado: 'ACTIVO', user_id_registration: 1 },
    ],
    skipDuplicates: true,
  });

  // 3. PERMISOS por modulo (rutas del frontend por rol)
  const permisosData = [
    // SUPER ADMIN
    { codigo: 'super.dashboard', nombre: 'Dashboard Super Admin', tipo: 'ruta', recurso: '/super-admin/dashboard' },
    { codigo: 'super.usuarios', nombre: 'Gestion Usuarios', tipo: 'ruta', recurso: '/super-admin/usuarios' },
    { codigo: 'super.aulas', nombre: 'Gestion Aulas/Niveles/Reglas', tipo: 'ruta', recurso: '/super-admin/aulas' },
    { codigo: 'super.padres', nombre: 'Gestion Padres', tipo: 'ruta', recurso: '/super-admin/padres' },
    { codigo: 'super.alumnos', nombre: 'Gestion Alumnos', tipo: 'ruta', recurso: '/super-admin/alumnos' },
    { codigo: 'super.carnets', nombre: 'Gestion Carnets', tipo: 'ruta', recurso: '/super-admin/carnets' },
    { codigo: 'super.asistencia', nombre: 'Asistencia Global', tipo: 'ruta', recurso: '/super-admin/asistencia' },
    { codigo: 'super.agenda', nombre: 'Agenda', tipo: 'ruta', recurso: '/super-admin/agenda' },
    { codigo: 'super.mensajes', nombre: 'Mensajes', tipo: 'ruta', recurso: '/super-admin/mensajes' },
    { codigo: 'super.comunicados', nombre: 'Comunicados', tipo: 'ruta', recurso: '/super-admin/comunicados' },
    { codigo: 'super.pensiones', nombre: 'Pensiones', tipo: 'ruta', recurso: '/super-admin/pensiones' },
    { codigo: 'super.anio_escolar', nombre: 'Ano Escolar', tipo: 'ruta', recurso: '/super-admin/anio-escolar' },
    { codigo: 'super.notificaciones', nombre: 'Plantillas Notificaciones', tipo: 'ruta', recurso: '/super-admin/notificaciones' },
    { codigo: 'super.auditoria', nombre: 'Auditoria', tipo: 'ruta', recurso: '/super-admin/auditoria' },
    { codigo: 'super.configuracion', nombre: 'Configuracion', tipo: 'ruta', recurso: '/super-admin/configuracion' },
    // ADMIN
    { codigo: 'admin.dashboard', nombre: 'Dashboard Admin', tipo: 'ruta', recurso: '/admin/dashboard' },
    { codigo: 'admin.padres', nombre: 'Padres', tipo: 'ruta', recurso: '/admin/padres' },
    { codigo: 'admin.alumnos', nombre: 'Alumnos', tipo: 'ruta', recurso: '/admin/alumnos' },
    { codigo: 'admin.carnets', nombre: 'Carnets', tipo: 'ruta', recurso: '/admin/carnets' },
    { codigo: 'admin.aulas', nombre: 'Aulas', tipo: 'ruta', recurso: '/admin/aulas' },
    { codigo: 'admin.asistencia', nombre: 'Asistencia Global', tipo: 'ruta', recurso: '/admin/asistencia' },
    { codigo: 'admin.comunicados', nombre: 'Comunicados', tipo: 'ruta', recurso: '/admin/comunicados' },
    { codigo: 'admin.pensiones', nombre: 'Pensiones', tipo: 'ruta', recurso: '/admin/pensiones' },
    { codigo: 'admin.anio_escolar', nombre: 'Ano Escolar', tipo: 'ruta', recurso: '/admin/anio-escolar' },
    // TUTOR
    { codigo: 'tutor.dashboard', nombre: 'Dashboard Tutor', tipo: 'ruta', recurso: '/tutor/dashboard' },
    { codigo: 'tutor.mi_aula', nombre: 'Mi Aula', tipo: 'ruta', recurso: '/tutor/mi-aula' },
    { codigo: 'tutor.asistencia', nombre: 'Asistencia Hoy', tipo: 'ruta', recurso: '/tutor/asistencia' },
    { codigo: 'tutor.agenda', nombre: 'Agenda', tipo: 'ruta', recurso: '/tutor/agenda' },
    { codigo: 'tutor.reporte_semanal', nombre: 'Reporte Semanal', tipo: 'ruta', recurso: '/tutor/reporte-semanal' },
    { codigo: 'tutor.mensajes', nombre: 'Mensajes', tipo: 'ruta', recurso: '/tutor/mensajes' },
    // PADRE
    { codigo: 'padre.dashboard', nombre: 'Dashboard Padre', tipo: 'ruta', recurso: '/padre/dashboard' },
    { codigo: 'padre.asistencia', nombre: 'Asistencia', tipo: 'ruta', recurso: '/padre/asistencia' },
    { codigo: 'padre.agenda', nombre: 'Agenda', tipo: 'ruta', recurso: '/padre/agenda' },
    { codigo: 'padre.reporte_semanal', nombre: 'Reporte Semanal', tipo: 'ruta', recurso: '/padre/reporte-semanal' },
    { codigo: 'padre.mensajes', nombre: 'Mensajes', tipo: 'ruta', recurso: '/padre/mensajes' },
    { codigo: 'padre.comunicados', nombre: 'Comunicados', tipo: 'ruta', recurso: '/padre/comunicados' },
    { codigo: 'padre.pensiones', nombre: 'Pensiones', tipo: 'ruta', recurso: '/padre/pensiones' },
    // PORTERIA
    { codigo: 'porteria.escaneo', nombre: 'Escaneo QR/PIN', tipo: 'ruta', recurso: '/porteria/escaneo' },
    { codigo: 'porteria.historial', nombre: 'Historial Corto', tipo: 'ruta', recurso: '/porteria/historial' },
    // PSICOLOGIA
    { codigo: 'psicologia.dashboard', nombre: 'Dashboard Psicologia', tipo: 'ruta', recurso: '/psicologia/dashboard' },
    { codigo: 'psicologia.comunicados', nombre: 'Comunicados', tipo: 'ruta', recurso: '/psicologia/comunicados' },
  ];

  await prisma.tbl_permisos.createMany({
    data: permisosData.map(p => ({ ...p, user_id_registration: 1 })),
    skipDuplicates: true,
  });

  // 4. ROLES_PERMISOS (mapeo dinamico por prefijo de codigo)
  const permisos = await prisma.tbl_permisos.findMany();
  const roles = await prisma.tbl_roles.findMany();
  const rolMap = {};
  roles.forEach(r => { rolMap[r.codigo] = r.id; });

  const rpData = [];
  const prefijoPorRol = {
    SUPER_ADMIN: null, // recibe todos
    ADMIN: 'admin.',
    TUTOR: 'tutor.',
    PADRE: 'padre.',
    PORTERIA: 'porteria.',
    PSICOLOGIA: 'psicologia.',
  };

  for (const [rolCodigo, prefijo] of Object.entries(prefijoPorRol)) {
    const idRol = rolMap[rolCodigo];
    const permisosFiltrados = prefijo ? permisos.filter(p => p.codigo.startsWith(prefijo)) : permisos;
    permisosFiltrados.forEach(p => rpData.push({ id_rol: idRol, id_permiso: p.id, user_id_registration: 1 }));
  }

  await prisma.tbl_roles_permisos.createMany({ data: rpData, skipDuplicates: true });

  // 5. COLEGIO (registro unico, requerido por GET /config-escolar/colegio y landing)
  await prisma.tbl_colegio.create({
    data: { nombre: 'Colegio Fernando', timezone: 'America/Lima', user_id_registration: 1 },
  });

  // 6. PLANTILLAS DE NOTIFICACION (buscadas por codigo en alertas y notificaciones)
  await prisma.tbl_plantillas_notificacion.createMany({
    data: [
      { codigo: 'NO_LLEGO', titulo: 'Alumno no llego', cuerpo: 'El alumno {{alumno}} no registro ingreso el dia {{fecha}} en el aula {{aula}}.', habilitada: true, roles_destino: ['PADRE'], tipo_entrega: 'buzon', user_id_registration: 1 },
      { codigo: 'TARDANZA', titulo: 'Alumno llego tarde', cuerpo: 'El alumno {{alumno}} registro ingreso con tardanza el dia {{fecha}} a las {{hora}}.', habilitada: true, roles_destino: ['PADRE'], tipo_entrega: 'buzon', user_id_registration: 1 },
      { codigo: 'NUEVO_MENSAJE', titulo: 'Nuevo mensaje', cuerpo: 'Tiene un nuevo mensaje en el hilo "{{asunto}}" sobre el alumno {{alumno}}.', habilitada: true, roles_destino: ['PADRE', 'TUTOR'], tipo_entrega: 'buzon', user_id_registration: 1 },
      { codigo: 'NUEVO_COMUNICADO', titulo: 'Nuevo comunicado', cuerpo: 'Se ha publicado el comunicado: {{titulo}}.', habilitada: true, roles_destino: ['PADRE'], tipo_entrega: 'buzon', user_id_registration: 1 },
      { codigo: 'PENSION_25_30', titulo: 'Recordatorio de pension', cuerpo: 'Recuerde que la pension del mes {{mes}} aun no ha sido registrada como pagada.', habilitada: true, roles_destino: ['PADRE'], tipo_entrega: 'modal', user_id_registration: 1 },
      { codigo: 'NUEVA_AGENDA', titulo: 'Nueva entrada de agenda', cuerpo: 'Se ha publicado una nueva entrada de agenda para {{alumno}} del dia {{fecha}}. Requiere su firma.', habilitada: true, roles_destino: ['PADRE'], tipo_entrega: 'buzon', user_id_registration: 1 },
      { codigo: 'NUEVO_REPORTE', titulo: 'Nuevo reporte semanal', cuerpo: 'Se ha publicado un nuevo reporte semanal para {{alumno}} (semana {{semana}}). Requiere su firma.', habilitada: true, roles_destino: ['PADRE'], tipo_entrega: 'buzon', user_id_registration: 1 },
    ],
    skipDuplicates: true,
  });

  // 7. CONFIG PENSION REMINDER (singleton, requerido por GET /notificaciones/config-pension)
  await prisma.tbl_config_pension_reminder.upsert({
    where: { id: 1 },
    update: {},
    create: { dia_inicio: 25, frecuencia_dias: 5, activa: false, user_id_registration: 1 },
  });

  console.log('Seed de produccion ejecutado correctamente');
  console.log('  Usuario inicial: superadmin / admin2026');
  console.log('  Cambie la contrasena despues del primer inicio de sesion');
}

main()
  .catch((e) => {
    console.error('Error en el seeder:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
