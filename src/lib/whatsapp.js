import { normalizarTelefono } from './telefono'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://servicio-turno-web-peluapp.xyz'

// Las plantillas están dadas de alta en Meta como es_AR, NO como es. Con 'es'
// la API responde 132001 "Template name does not exist in the translation" y no
// se envía nada. Configurable por si se agregan plantillas en otro idioma.
const WA_LANG = process.env.WA_TEMPLATE_LANG || 'es_AR'

function linkTurno(peluqueria_id, telefono) {
  return `${APP_URL}/mi-turno?p=${peluqueria_id}&tel=${encodeURIComponent(telefono)}`
}

function formatFecha(f) {
  if (!f) return ''
  const [, m, d] = f.split('-')
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${parseInt(d)} de ${meses[parseInt(m) - 1]}`
}

async function enviarTemplate(telefono, nombre_template, params) {
  const phoneId = process.env.WA_PHONE_NUMBER_ID
  const token   = process.env.WA_ACCESS_TOKEN

  if (!phoneId || !token) {
    console.log('[WhatsApp] No configurado — template:', nombre_template, '| params:', params)
    return { ok: false, error: 'not_configured' }
  }

  const numero = normalizarTelefono(telefono)

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numero,
        type: 'template',
        template: {
          name: nombre_template,
          language: { code: WA_LANG },
          components: [{
            type: 'body',
            parameters: params.map(p => ({ type: 'text', text: String(p) }))
          }]
        }
      })
    })
    const data = await res.json()
    if (data.error) {
      console.error('[WhatsApp] Error API:', data.error)
      return { ok: false, error: data.error.message }
    }
    return { ok: true }
  } catch (e) {
    console.error('[WhatsApp] Error de red:', e.message)
    return { ok: false, error: e.message }
  }
}

/*
 * TEMPLATES necesarios en Meta Business Manager:
 *
 * peluapp_confirmado  → "Hola {{1}}, tu turno en {{2}} fue *confirmado* ✅ Te esperamos el {{3}} a las {{4}}hs. Ver detalle: {{5}}"
 * peluapp_rechazado   → "Hola {{1}}, tu turno en {{2}} no pudo ser confirmado ❌{{3}} Podés pedir otro: {{4}}"
 * peluapp_modificado  → "Hola {{1}}, {{2}} propuso un cambio en tu turno 📅 Nueva fecha: {{3}} a las {{4}}hs. Tenés 12hs para responder: {{5}}"
 * peluapp_cancelado   → "Hola {{1}}, tu turno en {{2}} fue cancelado ❌{{3}} Podés pedir otro: {{4}}"
 * peluapp_sena        → "Hola {{1}}, tu turno en {{2}} está casi listo 💸 Para confirmarlo, pagá ${{3}} al alias {{4}}. Tenés {{5}} horas. Ver detalle: {{6}}. 📧 Enviá el comprobante a {{7}} con el asunto: {{8}}. ¡Gracias!"
 *
 * Categoría: UTILITY | Idioma: es_AR (Spanish - Argentina)
 */

export async function notificarConfirmado({ telefono, nombre, peluqueria_nombre, fecha, hora, peluqueria_id }) {
  return enviarTemplate(telefono, 'peluapp_confirmado', [
    nombre,
    peluqueria_nombre,
    formatFecha(fecha),
    hora,
    linkTurno(peluqueria_id, telefono),
  ])
}

export async function notificarRechazado({ telefono, nombre, peluqueria_nombre, motivo, peluqueria_id }) {
  return enviarTemplate(telefono, 'peluapp_rechazado', [
    nombre,
    peluqueria_nombre,
    motivo ? ` Motivo: ${motivo}.` : '',
    linkTurno(peluqueria_id, telefono),
  ])
}

export async function notificarModificado({ telefono, nombre, peluquero_nombre, fecha_propuesta, hora_propuesta, peluqueria_id }) {
  return enviarTemplate(telefono, 'peluapp_modificado', [
    nombre,
    peluquero_nombre,
    formatFecha(fecha_propuesta),
    hora_propuesta,
    linkTurno(peluqueria_id, telefono),
  ])
}

export async function notificarCancelado({ telefono, nombre, peluqueria_nombre, motivo, peluqueria_id }) {
  return enviarTemplate(telefono, 'peluapp_cancelado', [
    nombre,
    peluqueria_nombre,
    motivo ? ` Motivo: ${motivo}.` : '',
    linkTurno(peluqueria_id, telefono),
  ])
}

export async function notificarSena({ telefono, nombre, peluqueria_nombre, sena_monto, sena_alias, sena_horas, peluqueria_id, sena_correo }) {
  return enviarTemplate(telefono, 'peluapp_sena', [
    nombre,
    peluqueria_nombre,
    Number(sena_monto).toLocaleString('es-AR'),
    sena_alias,
    String(sena_horas),
    linkTurno(peluqueria_id, telefono),
    sena_correo || '—',
    `${nombre} - ${telefono} - COMPROBANTE`,
  ])
}
