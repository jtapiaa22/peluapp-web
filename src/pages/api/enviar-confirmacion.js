import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

function formatFecha(f) {
  if (!f) return ''
  const [y, m, d] = f.split('-')
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${parseInt(d)} de ${meses[parseInt(m)-1]} de ${y}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { email, nombre, peluqueria_nombre, peluquero_nombre, servicio_nombre, fecha, hora, esConfirmacionCambio, peluqueria_id } = req.body
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://servicio-turno-web-peluapp.xyz'

  try {
    await resend.emails.send({
      from: 'PeluApp <turnos@servicio-turno-web-peluapp.xyz>',
      to:      email,
      subject: esConfirmacionCambio ? '✅ Turno confirmado con nuevo horario' : '🗓️ Turno solicitado — te avisaremos cuando el peluquero responda',
      html: `
        <div style="font-family:Inter,sans-serif;background:#0f0f0f;color:#f5f5f5;padding:40px;max-width:480px;margin:0 auto;border-radius:16px;">
          <div style="text-align:center;margin-bottom:28px;">
            <div style="background:#7c3aed;width:52px;height:52px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
              <span style="font-size:22px;">✂️</span>
            </div>
            <h1 style="margin:0;font-size:20px;font-weight:700;">${peluqueria_nombre || 'PeluApp'}</h1>
          </div>

          <p style="font-size:15px;margin-bottom:20px;">
            Hola <strong>${nombre}</strong>,
            ${esConfirmacionCambio
              ? 'tu turno fue <strong style="color:#4ade80">confirmado</strong> con el nuevo horario. ¡Te esperamos!'
              : 'recibimos tu solicitud. El peluquero la revisará y te avisaremos cuando responda.'}
          </p>

          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin-bottom:20px;">
            <table style="width:100%;font-size:14px;border-collapse:collapse;">
              <tr><td style="color:#737373;padding:7px 0;border-bottom:1px solid #2a2a2a;">Peluquero</td><td style="text-align:right;font-weight:600;padding:7px 0;border-bottom:1px solid #2a2a2a;">${peluquero_nombre}</td></tr>
              <tr><td style="color:#737373;padding:7px 0;border-bottom:1px solid #2a2a2a;">Servicio</td><td style="text-align:right;padding:7px 0;border-bottom:1px solid #2a2a2a;">${servicio_nombre}</td></tr>
              <tr><td style="color:#737373;padding:7px 0;border-bottom:1px solid #2a2a2a;">Fecha</td><td style="text-align:right;padding:7px 0;border-bottom:1px solid #2a2a2a;">${formatFecha(fecha)}</td></tr>
              <tr><td style="color:#737373;padding:7px 0;">Hora</td><td style="text-align:right;font-weight:700;color:#a78bfa;font-size:16px;padding:7px 0;">${hora}hs</td></tr>
            </table>
          </div>

          ${!esConfirmacionCambio ? `
          <div style="background:#451a0310;border:1px solid #fbbf2440;border-radius:12px;padding:16px;margin-bottom:20px;">
            <p style="color:#fbbf24;font-weight:700;margin:0 0 6px;font-size:14px;">⚠️ ¡Atención! Revisá tu email</p>
            <p style="color:#fde68a;font-size:13px;margin:0;line-height:1.5;">
              Cuando el peluquero responda tu turno vas a recibir otro email aquí.<br/>
              <strong>Entrá a la web para ver si confirmó, modificó o rechazó.</strong>
            </p>
          </div>` : ''}

          <div style="text-align:center;">
            <a href="${appUrl}/mi-turno?p=${peluqueria_id}" style="display:inline-block;background:#7c3aed;color:white;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
              Ver mis turnos →
            </a>
          </div>
        </div>
      `
    })
    res.status(200).json({ ok: true })
  } catch (e) {
    console.error('Resend error:', e)
    res.status(500).json({ error: 'Error al enviar email' })
  }
}
