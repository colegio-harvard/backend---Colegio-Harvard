const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helpers de fecha (timezone Lima UTC-5)
const d = (s) => new Date(s + 'T00:00:00-05:00');
const t = (hm) => new Date('1970-01-01T' + hm + ':00Z');
const dt = (s, hm) => new Date(s + 'T' + hm + ':00-05:00');

// IDs de referencia
const ANIO = 1, PUNTO = 1, PORTERIA_USER = 7, ADMIN_USER = 2, SUPER_USER = 1;
const TUTOR1 = 3, TUTOR2 = 4, PADRE1_USER = 5, PADRE2_USER = 6;
const PADRE1 = 1, PADRE2 = 2;
const JUAN = 1, LUCIA = 2, CARLOS = 3, MARIA = 4;
const PLANTILLA_PENSION = 1;

async function main() {
  console.log('Insertando data transaccional completa...\n');

  // ============================================================
  // 1. EVENTOS DE ASISTENCIA (CHECKIN / CHECKOUT)
  // ============================================================
  console.log('1. Eventos de asistencia...');

  // [alumno, fecha, estado, checkin_hora, checkout_hora]
  // null = AUSENTE sin eventos
  const asistenciaRaw = [
    // JUAN (aula 1: inicio 7:45, tolerancia 15min)
    [JUAN, '2026-03-02', 'PRESENTE', '07:40', '13:00'],
    [JUAN, '2026-03-03', 'TARDE',    '08:05', '13:00'],
    [JUAN, '2026-03-04', 'AUSENTE',  null,    null],
    [JUAN, '2026-03-05', 'PRESENTE', '07:30', '13:05'],
    [JUAN, '2026-03-06', 'PRESENTE', '07:44', '12:55'],
    [JUAN, '2026-03-09', 'PRESENTE', '07:44', '13:00'], // corregido de TARDE a PRESENTE
    [JUAN, '2026-03-10', 'PRESENTE', '07:35', '13:10'],
    [JUAN, '2026-03-11', 'PRESENTE', '07:42', '13:00'],
    [JUAN, '2026-03-12', 'AUSENTE',  null,    null],
    [JUAN, '2026-03-13', 'PRESENTE', '07:38', '13:05'],
    // LUCIA (aula 3: inicio 7:30, tolerancia 10min)
    [LUCIA, '2026-03-02', 'PRESENTE', '07:25', '13:00'],
    [LUCIA, '2026-03-03', 'PRESENTE', '07:28', '13:00'],
    [LUCIA, '2026-03-04', 'PRESENTE', '07:20', '13:05'],
    [LUCIA, '2026-03-05', 'TARDE',    '07:50', '13:00'],
    [LUCIA, '2026-03-06', 'PRESENTE', '07:15', '12:50'],
    [LUCIA, '2026-03-09', 'AUSENTE',  null,    null],
    [LUCIA, '2026-03-10', 'PRESENTE', '07:22', '13:00'],
    [LUCIA, '2026-03-11', 'PRESENTE', '07:29', '13:10'],
    [LUCIA, '2026-03-12', 'PRESENTE', '07:18', '13:00'],
    [LUCIA, '2026-03-13', 'TARDE',    '07:45', '13:05'],
    // CARLOS (aula 1: inicio 7:45, tolerancia 15min)
    [CARLOS, '2026-03-02', 'PRESENTE', '07:35', '13:00'],
    [CARLOS, '2026-03-03', 'PRESENTE', '07:40', '13:05'],
    [CARLOS, '2026-03-04', 'TARDE',    '08:05', '13:00'],
    [CARLOS, '2026-03-05', 'PRESENTE', '07:38', '13:00'],
    [CARLOS, '2026-03-06', 'AUSENTE',  null,    null],
    [CARLOS, '2026-03-09', 'PRESENTE', '07:42', '13:05'],
    [CARLOS, '2026-03-10', 'PRESENTE', '07:30', '13:00'],
    [CARLOS, '2026-03-11', 'TARDE',    '08:12', '13:00'],
    [CARLOS, '2026-03-12', 'PRESENTE', '07:44', '13:10'],
    [CARLOS, '2026-03-13', 'PRESENTE', '07:35', '13:00'],
    // MARIA (aula 5: inicio 7:15, tolerancia 10min)
    [MARIA, '2026-03-02', 'PRESENTE', '07:10', '12:30'],
    [MARIA, '2026-03-03', 'TARDE',    '07:35', '12:30'],
    [MARIA, '2026-03-04', 'PRESENTE', '07:05', '12:35'],
    [MARIA, '2026-03-05', 'PRESENTE', '07:12', '12:30'],
    [MARIA, '2026-03-06', 'PRESENTE', '07:08', '12:30'],
    [MARIA, '2026-03-09', 'PRESENTE', '07:14', '12:35'],
    [MARIA, '2026-03-10', 'AUSENTE',  null,    null],
    [MARIA, '2026-03-11', 'PRESENTE', '07:10', '12:30'],
    [MARIA, '2026-03-12', 'PRESENTE', '07:13', '12:35'],
    [MARIA, '2026-03-13', 'PRESENTE', '07:09', '12:30'],
  ];

  // Crear eventos y guardar IDs
  const checkinMap = {};  // `${alumno}_${fecha}` -> event id
  const checkoutMap = {};

  for (const [alumno, fecha, estado, checkinH, checkoutH] of asistenciaRaw) {
    if (checkinH) {
      const metodo = Math.random() > 0.5 ? 'QR' : 'PIN';
      const ev = await prisma.tbl_eventos_asistencia.create({
        data: {
          id_anio_escolar: ANIO, id_alumno: alumno,
          fecha_evento: d(fecha), hora_evento: t(checkinH),
          fecha_hora_evento: dt(fecha, checkinH),
          tipo_evento: 'CHECKIN', metodo, id_punto_escaneo: PUNTO,
          registrado_por: PORTERIA_USER, user_id_registration: PORTERIA_USER,
        },
      });
      checkinMap[`${alumno}_${fecha}`] = ev.id;
    }
    if (checkoutH) {
      const metodo = Math.random() > 0.5 ? 'QR' : 'PIN';
      const ev = await prisma.tbl_eventos_asistencia.create({
        data: {
          id_anio_escolar: ANIO, id_alumno: alumno,
          fecha_evento: d(fecha), hora_evento: t(checkoutH),
          fecha_hora_evento: dt(fecha, checkoutH),
          tipo_evento: 'CHECKOUT', metodo, id_punto_escaneo: PUNTO,
          registrado_por: PORTERIA_USER, user_id_registration: PORTERIA_USER,
        },
      });
      checkoutMap[`${alumno}_${fecha}`] = ev.id;
    }
  }
  console.log(`  ${Object.keys(checkinMap).length} checkins, ${Object.keys(checkoutMap).length} checkouts`);

  // ============================================================
  // 2. ALERTAS NO_LLEGO (para ausentes)
  // ============================================================
  console.log('2. Alertas...');

  // Alertas: [alumno, padre, fecha, estado_alerta]
  const alertasRaw = [
    [JUAN, PADRE1, '2026-03-04', 'CERRADA'],
    [JUAN, PADRE1, '2026-03-12', 'ABIERTA'],
    [LUCIA, PADRE1, '2026-03-09', 'CERRADA'],
    [CARLOS, PADRE2, '2026-03-06', 'CERRADA'],
    [MARIA, PADRE2, '2026-03-10', 'ABIERTA'],
  ];

  const alertaMap = {};
  for (const [alumno, padre, fecha, estado] of alertasRaw) {
    const alerta = await prisma.tbl_alertas.create({
      data: {
        tipo: 'NO_LLEGO', id_anio_escolar: ANIO,
        id_alumno: alumno, id_padre: padre,
        fecha: d(fecha), estado,
        cerrada_en: estado === 'CERRADA' ? dt(fecha, '10:00') : null,
        payload_json: { alumno_id: alumno, motivo: 'No registro ingreso' },
        user_id_registration: 1,
      },
    });
    alertaMap[`${alumno}_${fecha}`] = alerta.id;
  }
  console.log(`  ${Object.keys(alertaMap).length} alertas creadas`);

  // ============================================================
  // 3. ASISTENCIA_DIA
  // ============================================================
  console.log('3. Asistencia dia...');

  const asistenciaDiaMap = {};
  for (const [alumno, fecha, estado] of asistenciaRaw) {
    const key = `${alumno}_${fecha}`;
    const rec = await prisma.tbl_asistencia_dia.create({
      data: {
        id_anio_escolar: ANIO, id_alumno: alumno,
        fecha: d(fecha), estado,
        id_evento_checkin: checkinMap[key] || null,
        id_evento_checkout: checkoutMap[key] || null,
        id_alerta_no_llego: alertaMap[key] || null,
        user_id_registration: PORTERIA_USER,
      },
    });
    asistenciaDiaMap[key] = rec.id;
  }
  console.log(`  ${Object.keys(asistenciaDiaMap).length} registros de asistencia`);

  // ============================================================
  // 4. CORRECCIONES ASISTENCIA
  // ============================================================
  console.log('4. Correcciones de asistencia...');

  await prisma.tbl_correcciones_asistencia.create({
    data: {
      id_asistencia_dia: asistenciaDiaMap[`${JUAN}_2026-03-09`],
      campo_modificado: 'estado',
      valor_anterior: 'TARDE',
      valor_nuevo: 'PRESENTE',
      motivo: 'Se verifico con porteria que el alumno llegó a las 7:44, dentro del horario',
      corregido_por: ADMIN_USER,
      user_id_registration: ADMIN_USER,
    },
  });
  console.log('  1 correccion creada');

  // ============================================================
  // 5. ENTRADAS DE AGENDA
  // ============================================================
  console.log('5. Agenda...');

  const agenda1 = await prisma.tbl_entradas_agenda.create({
    data: {
      id_anio_escolar: ANIO, fecha: d('2026-03-02'), alcance: 'AULA',
      id_aula: 1, contenido_texto: 'Tarea de matematicas pagina 15. Traer colores para la proxima clase. Revisar ejercicios del 1 al 10.',
      requiere_firma: true, publicado_por: TUTOR1, user_id_registration: TUTOR1,
    },
  });
  const agenda2 = await prisma.tbl_entradas_agenda.create({
    data: {
      id_anio_escolar: ANIO, fecha: d('2026-03-03'), alcance: 'AULA',
      id_aula: 1, contenido_texto: 'Examen de comunicacion el viernes 6 de marzo. Estudiar los temas vistos en clase: comprension lectora, sinonimos y antonimos.',
      requiere_firma: true, publicado_por: TUTOR1, user_id_registration: TUTOR1,
    },
  });
  const agenda3 = await prisma.tbl_entradas_agenda.create({
    data: {
      id_anio_escolar: ANIO, fecha: d('2026-03-04'), alcance: 'ALUMNO',
      id_alumno: JUAN, contenido_texto: 'Juan tuvo un excelente comportamiento hoy. Participo activamente en todas las actividades.',
      requiere_firma: true, publicado_por: TUTOR1, user_id_registration: TUTOR1,
    },
  });
  const agenda4 = await prisma.tbl_entradas_agenda.create({
    data: {
      id_anio_escolar: ANIO, fecha: d('2026-03-05'), alcance: 'AULA',
      id_aula: 3, contenido_texto: 'Revisar lectura del libro "Mi primer cuento". Traer cuaderno de practica forrado. Tarea: escribir 5 oraciones sobre la lectura.',
      requiere_firma: true, publicado_por: TUTOR2, user_id_registration: TUTOR2,
    },
  });
  const agenda5 = await prisma.tbl_entradas_agenda.create({
    data: {
      id_anio_escolar: ANIO, fecha: d('2026-03-09'), alcance: 'AULA',
      id_aula: 1, contenido_texto: 'Preparar materiales para proyecto de ciencias: cartulina, goma, tijeras y revistas para recortar.',
      requiere_firma: true, publicado_por: TUTOR1, user_id_registration: TUTOR1,
    },
  });
  const agenda6 = await prisma.tbl_entradas_agenda.create({
    data: {
      id_anio_escolar: ANIO, fecha: d('2026-03-10'), alcance: 'AULA',
      id_aula: 3, contenido_texto: 'Evaluacion de lectura programada para el jueves 12 de marzo. Repasar capitulos 1 al 3.',
      requiere_firma: true, publicado_por: TUTOR2, user_id_registration: TUTOR2,
    },
  });
  const agenda7 = await prisma.tbl_entradas_agenda.create({
    data: {
      id_anio_escolar: ANIO, fecha: d('2026-03-11'), alcance: 'ALUMNO',
      id_alumno: CARLOS, contenido_texto: 'Carlos necesita reforzar en lectura comprensiva. Se recomienda practicar lectura diaria en casa por 15 minutos.',
      requiere_firma: true, publicado_por: TUTOR1, user_id_registration: TUTOR1,
    },
  });
  console.log('  7 entradas de agenda');

  // Firmas de agenda
  await prisma.tbl_firmas_agenda.createMany({
    data: [
      // Agenda 1 (aula 1): padre1 y padre2 firmaron (ambos tienen hijos en aula 1)
      { id_entrada_agenda: agenda1.id, id_padre: PADRE1, firmado_en: dt('2026-03-02', '20:30'), user_id_registration: PADRE1_USER },
      { id_entrada_agenda: agenda1.id, id_padre: PADRE2, firmado_en: dt('2026-03-02', '21:15'), user_id_registration: PADRE2_USER },
      // Agenda 2 (aula 1): solo padre1 firmo
      { id_entrada_agenda: agenda2.id, id_padre: PADRE1, firmado_en: dt('2026-03-03', '19:45'), user_id_registration: PADRE1_USER },
      // Agenda 3 (alumno JUAN): padre1 firmo
      { id_entrada_agenda: agenda3.id, id_padre: PADRE1, firmado_en: dt('2026-03-04', '20:00'), user_id_registration: PADRE1_USER },
      // Agenda 4 (aula 3): padre1 firmo (LUCIA esta en aula 3)
      { id_entrada_agenda: agenda4.id, id_padre: PADRE1, firmado_en: dt('2026-03-05', '21:00'), user_id_registration: PADRE1_USER },
      // Agenda 5,6,7: sin firmas
    ],
  });

  // Respuestas de agenda
  await prisma.tbl_respuestas_agenda.createMany({
    data: [
      { id_entrada_agenda: agenda1.id, id_padre: PADRE1, mensaje: 'Entendido, gracias miss. Juan llevara los colores manana.', user_id_registration: PADRE1_USER },
      { id_entrada_agenda: agenda2.id, id_padre: PADRE1, mensaje: 'Mi hijo estudiara los temas. Gracias por el aviso con anticipacion.', user_id_registration: PADRE1_USER },
      { id_entrada_agenda: agenda4.id, id_padre: PADRE1, mensaje: 'Lucia llevara el cuaderno forrado manana sin falta. Disculpe la demora.', user_id_registration: PADRE1_USER },
    ],
  });
  console.log('  5 firmas, 3 respuestas');

  // ============================================================
  // 6. REPORTES SEMANALES
  // ============================================================
  console.log('6. Reportes semanales...');

  const reporte1 = await prisma.tbl_reportes_semanales.create({
    data: {
      inicio_semana: d('2026-03-02'), fin_semana: d('2026-03-06'),
      alcance: 'AULA', id_aula: 1,
      contenido_json: {
        resumen: 'Primera semana del ano escolar. Los alumnos se adaptaron bien a la rutina.',
        logros: ['Completaron la evaluacion diagnostica', 'Conocieron las reglas del aula', 'Iniciaron el proyecto de ciencias'],
        pendientes: ['Algunos alumnos aun no traen todos los materiales', 'Reforzar habitos de lectura'],
        observaciones: 'En general, buen inicio de ano. Juan destaco por su participacion activa.',
      },
      publicado_por: TUTOR1, requiere_firma: true, user_id_registration: TUTOR1,
    },
  });
  const reporte2 = await prisma.tbl_reportes_semanales.create({
    data: {
      inicio_semana: d('2026-03-02'), fin_semana: d('2026-03-06'),
      alcance: 'AULA', id_aula: 3,
      contenido_json: {
        resumen: 'Semana de adaptacion en 1ro Primaria A. Se realizo evaluacion diagnostica de lectura.',
        logros: ['Evaluacion diagnostica completada', 'Organizacion de cuadernos', 'Primera lectura grupal'],
        pendientes: ['Forrar cuadernos pendientes', 'Completar ficha de datos personales'],
        observaciones: 'Lucia Fernandez muestra buen nivel de lectura. Se trabajara comprension lectora.',
      },
      publicado_por: TUTOR2, requiere_firma: true, user_id_registration: TUTOR2,
    },
  });

  // Firmas de reportes
  await prisma.tbl_firmas_reporte_semanal.createMany({
    data: [
      { id_reporte_semanal: reporte1.id, id_padre: PADRE1, firmado_en: dt('2026-03-07', '10:00'), user_id_registration: PADRE1_USER },
      { id_reporte_semanal: reporte1.id, id_padre: PADRE2, firmado_en: dt('2026-03-07', '14:30'), user_id_registration: PADRE2_USER },
      { id_reporte_semanal: reporte2.id, id_padre: PADRE1, firmado_en: dt('2026-03-07', '10:05'), user_id_registration: PADRE1_USER },
      // padre2 NO firmo reporte2 (no tiene hijos en aula 3)
    ],
  });
  console.log('  2 reportes, 3 firmas');

  // ============================================================
  // 7. HILOS DE MENSAJES Y MENSAJES
  // ============================================================
  console.log('8. Mensajeria...');

  // Hilo 1: padre1 <-> tutor1 sobre JUAN
  const hilo1 = await prisma.tbl_hilos_mensaje.create({
    data: {
      id_anio_escolar: ANIO, id_alumno: JUAN,
      asunto: 'Consulta sobre tarea de matematicas',
      creado_por: PADRE1_USER, user_id_registration: PADRE1_USER,
    },
  });
  await prisma.tbl_mensajes.createMany({
    data: [
      { id_hilo: hilo1.id, id_usuario_emisor: PADRE1_USER, cuerpo: 'Buenos dias miss, queria consultarle sobre la tarea de matematicas. Juan no entendio bien los ejercicios de la pagina 15. Podria explicarle nuevamente?', enviado_en: dt('2026-02-17', '20:00'), user_id_registration: PADRE1_USER },
      { id_hilo: hilo1.id, id_usuario_emisor: TUTOR1, cuerpo: 'Buenas noches senor Fernandez. Claro, manana le explicare los ejercicios nuevamente a Juan en clase. Son sumas con llevada, puede practicar en casa con objetos.', enviado_en: dt('2026-02-17', '20:45'), user_id_registration: TUTOR1 },
      { id_hilo: hilo1.id, id_usuario_emisor: PADRE1_USER, cuerpo: 'Muchas gracias miss, esta noche practicaremos con los juguetes. Agradezco su paciencia.', enviado_en: dt('2026-02-17', '21:00'), user_id_registration: PADRE1_USER },
    ],
  });

  // Hilo 2: padre2 <-> tutor1 sobre CARLOS
  const hilo2 = await prisma.tbl_hilos_mensaje.create({
    data: {
      id_anio_escolar: ANIO, id_alumno: CARLOS,
      asunto: 'Justificacion de inasistencia del viernes',
      creado_por: PADRE2_USER, user_id_registration: PADRE2_USER,
    },
  });
  await prisma.tbl_mensajes.createMany({
    data: [
      { id_hilo: hilo2.id, id_usuario_emisor: PADRE2_USER, cuerpo: 'Miss buenas tardes. Le escribo para informarle que Carlos no podra asistir el viernes 6 por una emergencia familiar. Tuvimos un fallecimiento y debemos viajar.', enviado_en: dt('2026-02-19', '16:00'), user_id_registration: PADRE2_USER },
      { id_hilo: hilo2.id, id_usuario_emisor: TUTOR1, cuerpo: 'Lamento mucho su perdida senora Rodriguez. No se preocupe, Carlos puede ponerse al dia la proxima semana. Mis condolencias para toda la familia.', enviado_en: dt('2026-02-19', '17:30'), user_id_registration: TUTOR1 },
    ],
  });

  // Hilo 3: padre1 <-> tutor2 sobre LUCIA
  const hilo3 = await prisma.tbl_hilos_mensaje.create({
    data: {
      id_anio_escolar: ANIO, id_alumno: LUCIA,
      asunto: 'Consulta sobre uniforme escolar',
      creado_por: PADRE1_USER, user_id_registration: PADRE1_USER,
    },
  });
  await prisma.tbl_mensajes.createMany({
    data: [
      { id_hilo: hilo3.id, id_usuario_emisor: PADRE1_USER, cuerpo: 'Buenas tardes profesor Martinez. Queria consultar si hay algun cambio en el uniforme de primaria este ano. Lucia aun tiene el del ano pasado.', enviado_en: dt('2026-02-18', '14:00'), user_id_registration: PADRE1_USER },
      { id_hilo: hilo3.id, id_usuario_emisor: TUTOR2, cuerpo: 'Buenas tardes senor Fernandez. El uniforme es el mismo, no hay cambios este ano. Solo verificar que este en buen estado y con el nombre bordado.', enviado_en: dt('2026-02-18', '15:30'), user_id_registration: TUTOR2 },
      { id_hilo: hilo3.id, id_usuario_emisor: PADRE1_USER, cuerpo: 'Perfecto, el uniforme esta en buen estado. Solo necesitamos actualizar el bordado del grado. Lo tendremos listo para el lunes.', enviado_en: dt('2026-02-18', '16:00'), user_id_registration: PADRE1_USER },
      { id_hilo: hilo3.id, id_usuario_emisor: TUTOR2, cuerpo: 'Muy bien, no hay apuro. Lo importante es que Lucia siga viniendo con buena disposicion como hasta ahora. Saludos!', enviado_en: dt('2026-02-18', '16:30'), user_id_registration: TUTOR2 },
    ],
  });
  console.log('  3 hilos, 9 mensajes');

  // ============================================================
  // 9. COMUNICADOS
  // ============================================================
  console.log('9. Comunicados...');

  const com1 = await prisma.tbl_comunicados.create({
    data: {
      id_anio_escolar: ANIO, creado_por: ADMIN_USER, prioridad: 'NORMAL',
      titulo: 'Bienvenida al ano escolar 2026',
      cuerpo: 'Estimados padres de familia, les damos la mas cordial bienvenida al ano escolar 2026 del Colegio Fernando. Este ano viene lleno de retos y oportunidades para el crecimiento academico y personal de sus hijos. Los horarios de clase inician el lunes 2 de marzo. Recordamos que la puntualidad es fundamental. Cualquier consulta, no duden en comunicarse con el tutor de aula.',
      tipo_audiencia: 'COLEGIO', esta_publicado: true, user_id_registration: ADMIN_USER,
    },
  });
  const com2 = await prisma.tbl_comunicados.create({
    data: {
      id_anio_escolar: ANIO, creado_por: ADMIN_USER, prioridad: 'ALTA',
      titulo: 'Reunion de padres - 3 Anios A',
      cuerpo: 'Se convoca a reunion de padres del aula 3 Anios A para el dia viernes 13 de marzo a las 3:00 PM en el salon de actos. Temas a tratar: presentacion de la tutora, plan de trabajo anual, materiales requeridos y eleccion del comite de aula. La asistencia es obligatoria. En caso de no poder asistir, enviar un representante con carta poder.',
      tipo_audiencia: 'AULA', id_ref_audiencia: 1, esta_publicado: true, user_id_registration: ADMIN_USER,
    },
  });
  const com3 = await prisma.tbl_comunicados.create({
    data: {
      id_anio_escolar: ANIO, creado_por: ADMIN_USER, prioridad: 'NORMAL',
      titulo: 'Actividad especial de lectura - 1ro Primaria A',
      cuerpo: 'Informamos que el jueves 12 de marzo se realizara una actividad especial de lectura en el aula 1ro Primaria A. Los alumnos deberan traer su libro favorito para compartir con sus companeros. Esta actividad busca fomentar el habito de lectura desde temprana edad.',
      tipo_audiencia: 'AULA', id_ref_audiencia: 3, esta_publicado: true, user_id_registration: ADMIN_USER,
    },
  });
  const com4 = await prisma.tbl_comunicados.create({
    data: {
      id_anio_escolar: ANIO, creado_por: SUPER_USER, prioridad: 'NORMAL',
      titulo: 'Horario de atencion en secretaria',
      cuerpo: 'Se informa a todos los padres de familia que el horario de atencion en secretaria es de lunes a viernes de 8:00 AM a 1:00 PM y de 2:30 PM a 4:30 PM. Para tramites de certificados y constancias, acercarse con DNI del padre y del alumno. Tiempo de entrega: 3 dias habiles.',
      tipo_audiencia: 'COLEGIO', esta_publicado: true, user_id_registration: SUPER_USER,
    },
  });

  // Lecturas de comunicados
  await prisma.tbl_lecturas_comunicado.createMany({
    data: [
      { id_comunicado: com1.id, id_usuario: PADRE1_USER, leido_en: dt('2026-03-02', '08:00'), user_id_registration: PADRE1_USER },
      // padre2 NO leyo com1
      { id_comunicado: com2.id, id_usuario: PADRE1_USER, leido_en: dt('2026-03-03', '09:00'), user_id_registration: PADRE1_USER },
      { id_comunicado: com2.id, id_usuario: PADRE2_USER, leido_en: dt('2026-03-03', '12:00'), user_id_registration: PADRE2_USER },
      // com3 no leido por nadie
      { id_comunicado: com4.id, id_usuario: PADRE1_USER, leido_en: dt('2026-03-04', '10:00'), user_id_registration: PADRE1_USER },
    ],
  });
  console.log('  4 comunicados, 4 lecturas');

  // ============================================================
  // 10. ESTADO DE PENSIONES
  // ============================================================
  console.log('10. Pensiones...');

  const estadosPension = await prisma.tbl_estado_pension.createManyAndReturn({
    data: [
      // JUAN: marzo pagado completo
      { id_plantilla: PLANTILLA_PENSION, id_alumno: JUAN, clave_mes: 'MAR', estado: 'PAGADO', monto_total: 450, monto_pagado: 450, actualizado_por: ADMIN_USER, user_id_registration: ADMIN_USER },
      // LUCIA: marzo pago parcial
      { id_plantilla: PLANTILLA_PENSION, id_alumno: LUCIA, clave_mes: 'MAR', estado: 'PAGO_PARCIAL', monto_total: 450, monto_pagado: 250, actualizado_por: ADMIN_USER, user_id_registration: ADMIN_USER },
      // CARLOS: marzo pagado, abril pagado
      { id_plantilla: PLANTILLA_PENSION, id_alumno: CARLOS, clave_mes: 'MAR', estado: 'PAGADO', monto_total: 400, monto_pagado: 400, actualizado_por: ADMIN_USER, user_id_registration: ADMIN_USER },
      { id_plantilla: PLANTILLA_PENSION, id_alumno: CARLOS, clave_mes: 'ABR', estado: 'PAGADO', monto_total: 400, monto_pagado: 400, actualizado_por: ADMIN_USER, user_id_registration: ADMIN_USER },
      // MARIA: marzo pendiente
      { id_plantilla: PLANTILLA_PENSION, id_alumno: MARIA, clave_mes: 'MAR', estado: 'PENDIENTE', monto_total: null, monto_pagado: 0, actualizado_por: ADMIN_USER, user_id_registration: ADMIN_USER },
    ],
  });

  // Historial de pagos de ejemplo
  const epJuan = estadosPension.find(e => e.id_alumno === JUAN && e.clave_mes === 'MAR');
  const epLucia = estadosPension.find(e => e.id_alumno === LUCIA && e.clave_mes === 'MAR');
  const epCarlosMar = estadosPension.find(e => e.id_alumno === CARLOS && e.clave_mes === 'MAR');
  const epCarlosAbr = estadosPension.find(e => e.id_alumno === CARLOS && e.clave_mes === 'ABR');

  await prisma.tbl_pagos_pension.createMany({
    data: [
      { id_estado_pension: epJuan.id, monto: 450, fecha_pago: new Date('2026-03-05'), observacion: 'Pago completo', registrado_por: ADMIN_USER, user_id_registration: ADMIN_USER },
      { id_estado_pension: epLucia.id, monto: 250, fecha_pago: new Date('2026-03-10'), observacion: 'Primer pago', registrado_por: ADMIN_USER, user_id_registration: ADMIN_USER },
      { id_estado_pension: epCarlosMar.id, monto: 400, fecha_pago: new Date('2026-03-03'), observacion: 'Pago completo', registrado_por: ADMIN_USER, user_id_registration: ADMIN_USER },
      { id_estado_pension: epCarlosAbr.id, monto: 400, fecha_pago: new Date('2026-03-03'), observacion: 'Pago adelantado', registrado_por: ADMIN_USER, user_id_registration: ADMIN_USER },
    ],
  });
  console.log('  5 registros de pension + 4 pagos en historial');

  // ============================================================
  // 11. NOTIFICACIONES
  // ============================================================
  console.log('11. Notificaciones...');

  await prisma.tbl_notificaciones.createMany({
    data: [
      // Padre1: alerta JUAN Mar 4 (leida)
      { id_usuario: PADRE1_USER, codigo_plantilla: 'NO_LLEGO', titulo: 'Alumno no llegó', cuerpo: 'El alumno JUAN FERNANDEZ RIOS no registro ingreso el dia 04/03/2026 en el aula 3 Anios A.', fecha: d('2026-03-04'), leida: true, user_id_registration: 1 },
      // Padre1: alerta JUAN Mar 12 (no leida)
      { id_usuario: PADRE1_USER, codigo_plantilla: 'NO_LLEGO', titulo: 'Alumno no llegó', cuerpo: 'El alumno JUAN FERNANDEZ RIOS no registro ingreso el dia 12/03/2026 en el aula 3 Anios A.', fecha: d('2026-03-12'), leida: false, user_id_registration: 1 },
      // Padre1: nueva agenda Mar 2 (leida)
      { id_usuario: PADRE1_USER, codigo_plantilla: 'NUEVA_AGENDA', titulo: 'Nueva entrada de agenda', cuerpo: 'Se ha publicado una nueva entrada de agenda para JUAN FERNANDEZ RIOS del dia 02/03/2026. Requiere su firma.', fecha: d('2026-03-02'), leida: true, user_id_registration: 1 },
      // Padre1: comunicado bienvenida (leida)
      { id_usuario: PADRE1_USER, codigo_plantilla: 'NUEVO_COMUNICADO', titulo: 'Nuevo comunicado', cuerpo: 'Se ha publicado el comunicado: Bienvenida al ano escolar 2026.', fecha: d('2026-03-02'), leida: true, user_id_registration: 1 },
      // Padre1: nuevo mensaje en hilo (no leida)
      { id_usuario: PADRE1_USER, codigo_plantilla: 'NUEVO_MENSAJE', titulo: 'Nuevo mensaje', cuerpo: 'Tiene un nuevo mensaje en el hilo "Consulta sobre tarea de matematicas" sobre el alumno JUAN FERNANDEZ RIOS.', fecha: d('2026-03-02'), leida: false, user_id_registration: 1 },
      // Padre2: alerta CARLOS Mar 6 (leida)
      { id_usuario: PADRE2_USER, codigo_plantilla: 'NO_LLEGO', titulo: 'Alumno no llegó', cuerpo: 'El alumno CARLOS RODRIGUEZ SILVA no registro ingreso el dia 06/03/2026 en el aula 3 Anios A.', fecha: d('2026-03-06'), leida: true, user_id_registration: 1 },
      // Padre2: alerta MARIA Mar 10 (no leida)
      { id_usuario: PADRE2_USER, codigo_plantilla: 'NO_LLEGO', titulo: 'Alumno no llegó', cuerpo: 'El alumno MARIA RODRIGUEZ SILVA no registro ingreso el dia 10/03/2026 en el aula 1ro Secundaria A.', fecha: d('2026-03-10'), leida: false, user_id_registration: 1 },
      // Padre2: comunicado bienvenida (no leida)
      { id_usuario: PADRE2_USER, codigo_plantilla: 'NUEVO_COMUNICADO', titulo: 'Nuevo comunicado', cuerpo: 'Se ha publicado el comunicado: Bienvenida al ano escolar 2026.', fecha: d('2026-03-02'), leida: false, user_id_registration: 1 },
      // Padre2: nuevo mensaje hilo CARLOS (leida)
      { id_usuario: PADRE2_USER, codigo_plantilla: 'NUEVO_MENSAJE', titulo: 'Nuevo mensaje', cuerpo: 'Tiene un nuevo mensaje en el hilo "Justificacion de inasistencia del viernes" sobre el alumno CARLOS RODRIGUEZ SILVA.', fecha: d('2026-03-05'), leida: true, user_id_registration: 1 },
      // Padre1: recordatorio pension (leida)
      { id_usuario: PADRE1_USER, codigo_plantilla: 'PENSION_25_30', titulo: 'Recordatorio de pension', cuerpo: 'Recuerde que la pension del mes Marzo aun no ha sido registrada como pagada.', fecha: d('2026-03-02'), leida: true, user_id_registration: 1 },
      // Padre2: recordatorio pension MARIA (no leida)
      { id_usuario: PADRE2_USER, codigo_plantilla: 'PENSION_25_30', titulo: 'Recordatorio de pension', cuerpo: 'Recuerde que la pension del mes Marzo para MARIA RODRIGUEZ SILVA aun no ha sido registrada como pagada.', fecha: d('2026-03-10'), leida: false, user_id_registration: 1 },
    ],
  });
  console.log('  11 notificaciones');

  // ============================================================
  // 12. AUDITORIA
  // ============================================================
  console.log('12. Auditoria...');

  await prisma.tbl_auditoria.createMany({
    data: [
      { id_usuario_actor: SUPER_USER, codigo_accion: 'SEED_SISTEMA', tipo_entidad: 'sistema', resumen: 'Inicializacion del sistema con datos base', marca_tiempo: dt('2026-03-01', '08:00') },
      { id_usuario_actor: ADMIN_USER, codigo_accion: 'CREAR_COMUNICADO', tipo_entidad: 'tbl_comunicados', id_entidad: com1.id, resumen: 'Comunicado: Bienvenida al ano escolar 2026', marca_tiempo: dt('2026-03-02', '07:00') },
      { id_usuario_actor: ADMIN_USER, codigo_accion: 'CREAR_COMUNICADO', tipo_entidad: 'tbl_comunicados', id_entidad: com2.id, resumen: 'Comunicado: Reunion de padres - 3 Anios A', marca_tiempo: dt('2026-03-03', '08:00') },
      { id_usuario_actor: ADMIN_USER, codigo_accion: 'CREAR_COMUNICADO', tipo_entidad: 'tbl_comunicados', id_entidad: com3.id, resumen: 'Comunicado: Actividad especial de lectura', marca_tiempo: dt('2026-03-05', '09:00') },
      { id_usuario_actor: SUPER_USER, codigo_accion: 'CREAR_COMUNICADO', tipo_entidad: 'tbl_comunicados', id_entidad: com4.id, resumen: 'Comunicado: Horario de atencion en secretaria', marca_tiempo: dt('2026-03-04', '10:00') },
      { id_usuario_actor: TUTOR1, codigo_accion: 'PUBLICAR_AGENDA', tipo_entidad: 'tbl_entradas_agenda', id_entidad: agenda1.id, resumen: 'Agenda aula 3 Anios A: tarea matematicas', marca_tiempo: dt('2026-03-02', '13:30') },
      { id_usuario_actor: TUTOR1, codigo_accion: 'PUBLICAR_AGENDA', tipo_entidad: 'tbl_entradas_agenda', id_entidad: agenda2.id, resumen: 'Agenda aula 3 Anios A: examen comunicacion', marca_tiempo: dt('2026-03-03', '13:30') },
      { id_usuario_actor: TUTOR1, codigo_accion: 'PUBLICAR_AGENDA', tipo_entidad: 'tbl_entradas_agenda', id_entidad: agenda3.id, resumen: 'Agenda alumno JUAN: buen comportamiento', marca_tiempo: dt('2026-03-04', '13:00') },
      { id_usuario_actor: TUTOR2, codigo_accion: 'PUBLICAR_AGENDA', tipo_entidad: 'tbl_entradas_agenda', id_entidad: agenda4.id, resumen: 'Agenda aula 1ro Primaria A: lectura', marca_tiempo: dt('2026-03-05', '13:30') },
      { id_usuario_actor: PADRE1_USER, codigo_accion: 'FIRMAR_AGENDA', tipo_entidad: 'tbl_firmas_agenda', resumen: 'Padre1 firmo agenda del 02/03/2026', marca_tiempo: dt('2026-03-02', '20:30') },
      { id_usuario_actor: PADRE2_USER, codigo_accion: 'FIRMAR_AGENDA', tipo_entidad: 'tbl_firmas_agenda', resumen: 'Padre2 firmo agenda del 02/03/2026', marca_tiempo: dt('2026-03-02', '21:15') },
      { id_usuario_actor: ADMIN_USER, codigo_accion: 'MARCAR_PENSION', tipo_entidad: 'tbl_estado_pension', resumen: 'Pension alumno JUAN mes MAR: PAGADO', marca_tiempo: dt('2026-03-05', '10:00') },
      { id_usuario_actor: ADMIN_USER, codigo_accion: 'MARCAR_PENSION', tipo_entidad: 'tbl_estado_pension', resumen: 'Pension alumno LUCIA mes MAR: PAGADO', marca_tiempo: dt('2026-03-05', '10:01') },
      { id_usuario_actor: ADMIN_USER, codigo_accion: 'MARCAR_PENSION', tipo_entidad: 'tbl_estado_pension', resumen: 'Pension alumno CARLOS mes MAR: PAGADO', marca_tiempo: dt('2026-03-06', '09:00') },
      { id_usuario_actor: ADMIN_USER, codigo_accion: 'MARCAR_PENSION', tipo_entidad: 'tbl_estado_pension', resumen: 'Pension alumno CARLOS mes ABR: PAGADO', marca_tiempo: dt('2026-03-06', '09:01') },
      { id_usuario_actor: ADMIN_USER, codigo_accion: 'CORREGIR_ASISTENCIA', tipo_entidad: 'tbl_asistencia_dia', resumen: 'Correccion asistencia JUAN 09/03: TARDE -> PRESENTE', marca_tiempo: dt('2026-03-10', '08:00') },
      { id_usuario_actor: PADRE1_USER, codigo_accion: 'ENVIAR_MENSAJE', tipo_entidad: 'tbl_hilos_mensaje', id_entidad: hilo1.id, resumen: 'Nuevo hilo: Consulta sobre tarea de matematicas', marca_tiempo: dt('2026-02-17', '20:00') },
      { id_usuario_actor: PADRE2_USER, codigo_accion: 'ENVIAR_MENSAJE', tipo_entidad: 'tbl_hilos_mensaje', id_entidad: hilo2.id, resumen: 'Nuevo hilo: Justificacion de inasistencia', marca_tiempo: dt('2026-02-19', '16:00') },
      { id_usuario_actor: PADRE1_USER, codigo_accion: 'ENVIAR_MENSAJE', tipo_entidad: 'tbl_hilos_mensaje', id_entidad: hilo3.id, resumen: 'Nuevo hilo: Consulta sobre uniforme escolar', marca_tiempo: dt('2026-02-18', '14:00') },
      { id_usuario_actor: TUTOR1, codigo_accion: 'PUBLICAR_REPORTE', tipo_entidad: 'tbl_reportes_semanales', id_entidad: reporte1.id, resumen: 'Reporte semanal aula 3 Anios A semana 02-06 Mar', marca_tiempo: dt('2026-03-06', '14:00') },
      { id_usuario_actor: TUTOR2, codigo_accion: 'PUBLICAR_REPORTE', tipo_entidad: 'tbl_reportes_semanales', id_entidad: reporte2.id, resumen: 'Reporte semanal aula 1ro Primaria A semana 02-06 Mar', marca_tiempo: dt('2026-03-06', '15:00') },
    ],
  });
  console.log('  21 registros de auditoria');

  // ============================================================
  // RESUMEN
  // ============================================================
  console.log('\n========================================');
  console.log('DATA TRANSACCIONAL INSERTADA CON EXITO');
  console.log('========================================');
  console.log('Eventos asistencia:  ~64 (checkins + checkouts)');
  console.log('Alertas:             5 (3 CERRADA, 2 ABIERTA)');
  console.log('Asistencia dia:      40 (PRESENTE/TARDE/AUSENTE)');
  console.log('Correcciones:        1');
  console.log('Agenda:              7 entradas');
  console.log('  Firmas:            5');
  console.log('  Respuestas:        3');
  console.log('Reportes semanales:  2');
  console.log('  Firmas reporte:    3');
  console.log('Hilos mensaje:       3');
  console.log('Mensajes:            9');
  console.log('Comunicados:         4');
  console.log('  Lecturas:          4');
  console.log('Pensiones:           5 registros');
  console.log('Notificaciones:      11');
  console.log('Auditoria:           21');
}

main()
  .catch((e) => { console.error('Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
