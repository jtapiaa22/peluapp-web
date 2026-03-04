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

  try {
    const { data: vencidos } = await supabase
      .from('turnos_web')
      .select('*')
      .eq('estado', 'modificado')
      .lt('expira_confirmacion_at', new Date().toISOString())

    if (!vencidos?.length) return res.status(200).json({ cancelados: 0 })

    for (const turno of vencidos) {
      await supabase.from('turnos_web').update({
        estado: 'cancelado',
        motivo: (turno.motivo || '') + ' | Cancelado automáticamente: el cliente no confirmó en 12hs.'
      }).eq('id', turno.id)

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://servicio-turno-web-peluapp.xyz'

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
      })
    }

    res.status(200).json({ cancelados: vencidos.length })
  } catch (e) {
    console.error('Cron error:', e)
    res.status(500).json({ error: e.message })
  }
}
