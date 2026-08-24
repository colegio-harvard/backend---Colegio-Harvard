const CANALES = new Set(['WHATSAPP', 'SMS']);
const ESTADOS_ENVIO = new Set(['PREPARADO', 'ABIERTO', 'CONFIRMADO', 'NO_ENVIADO', 'OMITIDO', 'FALLIDO']);
const ESTADOS_COMPROMISO = new Set(['VIGENTE', 'CUMPLIDO', 'VENCIDO', 'CANCELADO']);
function alumnoActivo(alumno) { return String(alumno?.estado || '').toUpperCase() === 'ACTIVO'; }
function normalizarTelefonoPeru(value) { const digits = String(value || '').replace(/\D/g, ''); if (/^9\d{8}$/.test(digits)) return `51${digits}`; if (/^519\d{8}$/.test(digits)) return digits; return null; }
function saldoPension(estado) { return Math.max(0, Number((Number(estado.monto_total || 0) - Number(estado.monto_pagado || 0)).toFixed(2))); }
function compromisoVigente(compromisos, now = new Date()) { const hoy = new Date(now); hoy.setHours(0, 0, 0, 0); return (compromisos || []).find((c) => { const fecha = new Date(c.fecha_compromiso); fecha.setHours(0, 0, 0, 0); return c.estado === 'VIGENTE' && fecha >= hoy; }) || null; }
function formatoMonto(value) { return Number(value).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function crearMensaje({ canal, colegio, alumno, mes, saldo, telefonoContacto }) { if (!CANALES.has(canal)) throw new Error('Canal no valido'); const monto = formatoMonto(saldo); if (canal === 'SMS') return `${colegio}: Pension ${mes} de ${alumno} pendiente: S/${monto}. Si ya pago, ignore este SMS. Consultas: ${telefonoContacto || ''}`.trim(); return `Estimado(a) apoderado(a), le recordamos que se encuentra pendiente la pension ${mes} de ${alumno} por S/${monto}. Si ya realizo el pago, ignore este mensaje o envienos su comprobante. ${colegio}.`; }
function crearEnlace(canal, telefono, mensaje) { const encoded = encodeURIComponent(mensaje); if (canal === 'WHATSAPP') return `https://wa.me/${telefono}?text=${encoded}`; if (canal === 'SMS') return `sms:+${telefono}?body=${encoded}`; throw new Error('Canal no valido'); }
module.exports = { CANALES, ESTADOS_ENVIO, ESTADOS_COMPROMISO, alumnoActivo, normalizarTelefonoPeru, saldoPension, compromisoVigente, crearMensaje, crearEnlace };


