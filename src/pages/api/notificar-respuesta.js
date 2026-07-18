import {
  notificarConfirmado,
  notificarRechazado,
  notificarModificado,
  notificarCancelado,
  notificarSena,
} from '../../lib/whatsapp'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const {
    telefono, nombre, peluqueria_nombre, peluquero_nombre,
    accion,
    fecha_original, hora_original,
    fecha_propuesta, hora_propuesta,
    motivo,
    peluqueria_id,
    sena_monto, sena_alias, sena_horas, sena_correo,
  } = req.body

  if (!telefono) return res.status(400).json({ error: 'Falta teléfono' })

  try {
    let envio = { ok: true }

    if (accion === 'confirmado') {
      envio = await notificarConfirmado({
        telefono, nombre, peluqueria_nombre,
        fecha: fecha_original, hora: hora_original,
        peluqueria_id,
      })
    } else if (accion === 'rechazado') {
      envio = await notificarRechazado({ telefono, nombre, peluqueria_nombre, motivo, peluqueria_id })
    } else if (accion === 'modificado') {
      envio = await notificarModificado({
        telefono, nombre, peluquero_nombre,
        fecha_propuesta, hora_propuesta,
        peluqueria_id,
      })
    } else if (accion === 'cancelado') {
      envio = await notificarCancelado({ telefono, nombre, peluqueria_nombre, motivo, peluqueria_id })
    } else if (accion === 'esperando_sena') {
      envio = await notificarSena({
        telefono, nombre, peluqueria_nombre,
        sena_monto, sena_alias, sena_horas, sena_correo,
        peluqueria_id,
      })
    }

    // Antes esto devolvía siempre ok:true y un WhatsApp caído pasaba
    // desapercibido: el peluquero veía "confirmado" y el cliente no recibía nada.
    if (envio && envio.ok === false) {
      console.error('[notificar-respuesta] WhatsApp no enviado:', envio.error)
      return res.status(502).json({ ok: false, whatsapp: envio, error: 'No se pudo enviar el WhatsApp al cliente.' })
    }

    res.status(200).json({ ok: true, whatsapp: envio })
  } catch (e) {
    console.error('notificar-respuesta error:', e)
    res.status(500).json({ error: e.message })
  }
}
