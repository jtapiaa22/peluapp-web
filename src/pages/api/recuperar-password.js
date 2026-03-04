import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, peluqueriaId } = req.body
  if (!email) return res.status(400).json({ error: 'Falta el email.' })

  const emailNorm = email.toLowerCase().trim()

  // Verificar que exista la cuenta
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nombre')
    .eq('email', emailNorm)
    .maybeSingle()

  // Responder siempre OK para no revelar si el email existe o no
  if (!cliente) {
    return res.status(200).json({ ok: true })
  }

  // Generar token seguro de 1 hora
  const token   = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  await supabase
    .from('clientes')
    .update({ reset_token: token, reset_expires_at: expires })
    .eq('id', cliente.id)

  const appUrl   = process.env.NEXT_PUBLIC_APP_URL || 'https://servicio-turno-web-peluapp.xyz'
  const resetUrl = `${appUrl}/reset-password?token=${token}${peluqueriaId ? `&p=${peluqueriaId}` : ''}`

  try {
    await resend.emails.send({
      from:    'PeluApp <turnos@servicio-turno-web-peluapp.xyz>',
      to:      emailNorm,
      subject: '🔑 Reseteo de contraseña — PeluApp',
      html: `
        <div style="font-family:Inter,sans-serif;background:#0f0f0f;color:#f5f5f5;padding:40px;max-width:480px;margin:0 auto;border-radius:16px;">
          <div style="text-align:center;margin-bottom:28px;">
            <div style="background:#7c3aed;width:52px;height:52px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
              <span style="font-size:22px;">🔑</span>
            </div>
            <h1 style="margin:0;font-size:20px;font-weight:700;">Reseteo de contraseña</h1>
            <p style="color:#737373;font-size:13px;margin-top:4px;">PeluApp</p>
          </div>

          <p style="font-size:15px;margin-bottom:24px;line-height:1.6;">
            Hola <strong>${cliente.nombre}</strong>, recibimos una solicitud para resetear tu contraseña.
            Hacé clic en el botón para crear una nueva.
          </p>

          <div style="text-align:center;margin-bottom:24px;">
            <a href="${resetUrl}"
               style="display:inline-block;background:#7c3aed;color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
              Crear nueva contraseña →
            </a>
          </div>

          <p style="color:#737373;font-size:12px;text-align:center;line-height:1.6;">
            Este link es válido por <strong style="color:#f5f5f5;">1 hora</strong>.<br/>
            Si no fuiste vos, podés ignorar este email. Tu contraseña no cambiará.
          </p>
        </div>
      `
    })
  } catch (e) {
    console.error('Error Resend recuperar:', e)
    return res.status(500).json({ error: 'Error al enviar el email.' })
  }

  return res.status(200).json({ ok: true })
}
