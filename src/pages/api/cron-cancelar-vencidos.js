import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://servicio-turno-web-peluapp.xyz'
  const ahora  = new Date().toISOString()
  let cancelados = 0

  try {

    // ── 1. Cancelar turnos 'modificado' que el cliente no respondió a tiempo ──
    const { data: vencidosModificado } = await supabase
      .from('turnos_web')
      .select('*')
      .eq('estado', 'modificado')
      .lt('expira_confirmacion_at', ahora)

    for (const turno of vencidosModificado || []) {
      await supabase.from('turnos_web').update({
        estado: 'cancelado',
        motivo: (turno.motivo || '') + ' | Cancelado automáticamente: el cliente no confirmó en 12hs.'
      }).eq('id', turno.id)

      await resend.emails.send({
        from: 'PeluApp <turnos@servicio-turno-web-peluapp.xyz>',
        to:      turno.cliente_email,
        subject: '⏰ Tu turno fue cancelado automáticamente',
        html: `
          <div style="font-family:Inter,sans-serif;background:#0f0f0f;color:#f5f5f5;padding:40px;max-width:480px;margin:0 auto;border-radius:16px;">
            <div style="text-align:center;margin-bottom:24px;">
              <div style="font-size:40px;margin-bottom:12px;">⏰</div>
              <h2 style="margin:0;font-size:20px;">Turno cancelado</h2>
            </div>
            <p style="font-size:15px;margin-bottom:20px;line-height:1.6;">
              Hola <strong>${turno.cliente_nombre}</strong>, tu turno con <strong>${turno.peluquero_nombre}</strong>
              fue cancelado automáticamente porque no confirmaste el cambio de horario en las 12 horas disponibles.
            </p>
            <div style="text-align:center;">
              <a href="${appUrl}/reservar?p=${turno.peluqueria_id}" style="display:inline-block;background:#7c3aed;color:white;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
                Reservar nuevo turno →
              </a>
            </div>
          </div>
        `
      }).catch(() => {})

      cancelados++
    }

    // ── 2. Cancelar turnos 'esperando_sena' cuyo tiempo de pago venció ──
    const { data: vencidosSena } = await supabase
      .from('turnos_web')
      .select('*')
      .eq('estado', 'esperando_sena')
      .lt('sena_vence_at', ahora)

    for (const turno of vencidosSena || []) {
      await supabase.from('turnos_web').update({
        estado: 'cancelado',
        motivo: 'Cancelado automáticamente: seña no recibida a tiempo.'
      }).eq('id', turno.id)

      await resend.emails.send({
        from: 'PeluApp <turnos@servicio-turno-web-peluapp.xyz>',
        to:      turno.cliente_email,
        subject: '⏰ Tu reserva fue cancelada — no se recibió la seña',
        html: `
          <div style="font-family:Inter,sans-serif;background:#0f0f0f;color:#f5f5f5;padding:40px;max-width:480px;margin:0 auto;border-radius:16px;">
            <div style="text-align:center;margin-bottom:24px;">
              <div style="font-size:40px;margin-bottom:12px;">⏰</div>
              <h2 style="margin:0;font-size:20px;">Reserva cancelada</h2>
            </div>
            <p style="font-size:15px;margin-bottom:20px;line-height:1.6;">
              Hola <strong>${turno.cliente_nombre}</strong>, tu reserva con <strong>${turno.peluquero_nombre}</strong>
              para el <strong>${turno.fecha}</strong> a las <strong>${turno.hora?.substring(0,5)}hs</strong>
              fue cancelada porque no se recibió el pago de la seña dentro del tiempo límite.
            </p>
            <p style="color:#737373;font-size:13px;margin-bottom:24px;line-height:1.5;">
              Si querés, podés hacer una nueva reserva cuando quieras.
            </p>
            <div style="text-align:center;">
              <a href="${appUrl}/reservar?p=${turno.peluqueria_id}" style="display:inline-block;background:#7c3aed;color:white;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
                Reservar nuevo turno →
              </a>
            </div>
          </div>
        `
      }).catch(() => {})

      cancelados++
    }

    res.status(200).json({ cancelados })

  } catch (e) {
    console.error('Cron error:', e)
    res.status(500).json({ error: e.message })
  }
}
