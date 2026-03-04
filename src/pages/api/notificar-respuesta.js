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

  const {
    email, nombre, peluqueria_nombre, peluquero_nombre,
    accion,
    fecha_original, hora_original,
    fecha_propuesta, hora_propuesta,
    motivo,
    peluqueria_id
  } = req.body

  const appUrl       = process.env.NEXT_PUBLIC_APP_URL || 'https://servicio-turno-web-peluapp.xyz'
  const misTurnosUrl = `${appUrl}/mi-turno?p=${peluqueria_id}`

  const config = {
    confirmado: {
      emoji:  '✅',
      asunto: '✅ Tu turno fue confirmado',
      color:  '#4ade80', bg: '#14532d20', border: '#4ade8040',
      msg:    'Tu turno fue <strong style="color:#4ade80">confirmado</strong>. ¡Te esperamos!'
    },
    modificado: {
      emoji:  '📅',
      asunto: '📅 El peluquero propuso un cambio de horario',
      color:  '#60a5fa', bg: '#1e3a5f20', border: '#60a5fa40',
      msg:    `<strong>${peluquero_nombre}</strong> propuso un cambio en el horario. Entrá para aceptarlo o cancelarlo.`
    },
    rechazado: {
      emoji:  '❌',
      asunto: '❌ Tu turno no pudo ser confirmado',
      color:  '#f87171', bg: '#7f1d1d20', border: '#f8717140',
      msg:    'Lamentablemente tu turno fue <strong style="color:#f87171">rechazado</strong>. Podés pedir otro cuando quieras.'
    },
    cancelado: {
      emoji:  '❌',
      asunto: '❌ Tu turno fue cancelado',
      color:  '#f87171', bg: '#7f1d1d20', border: '#f8717140',
      msg:    'Tu turno fue <strong style="color:#f87171">cancelado</strong> por la peluquería. Podés pedir otro cuando quieras.'
    },
  }

  const cfg = config[accion] || config.rechazado

  try {
    await resend.emails.send({
      from:    'PeluApp <turnos@servicio-turno-web-peluapp.xyz>',
      to:      email,
      subject: `${cfg.asunto} — ${peluqueria_nombre || 'PeluApp'}`,
      html: `
        <div style="font-family:Inter,sans-serif;background:#0f0f0f;color:#f5f5f5;padding:40px;max-width:480px;margin:0 auto;border-radius:16px;">

          <div style="text-align:center;margin-bottom:28px;">
            <div style="font-size:40px;margin-bottom:12px;">${cfg.emoji}</div>
            <h1 style="margin:0;font-size:20px;font-weight:700;">${peluqueria_nombre || 'PeluApp'}</h1>
            <p style="color:#737373;font-size:13px;margin-top:4px;">Actualización de tu turno</p>
          </div>

          <p style="font-size:15px;margin-bottom:20px;line-height:1.6;">
            Hola <strong>${nombre}</strong>, ${cfg.msg}
          </p>

          <!-- Turno original -->
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:18px;margin-bottom:14px;">
            <p style="color:#555;font-size:11px;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;">Turno original</p>
            <table style="width:100%;font-size:14px;border-collapse:collapse;">
              <tr><td style="color:#737373;padding:5px 0;">Peluquero</td><td style="text-align:right;">${peluquero_nombre}</td></tr>
              <tr><td style="color:#737373;padding:5px 0;">Fecha</td><td style="text-align:right;">${formatFecha(fecha_original)}</td></tr>
              <tr><td style="color:#737373;padding:5px 0;">Hora</td><td style="text-align:right;">${hora_original}hs</td></tr>
            </table>
          </div>

          ${accion === 'modificado' && fecha_propuesta ? `
          <!-- Nuevo horario propuesto -->
          <div style="background:${cfg.bg};border:1px solid ${cfg.border};border-radius:12px;padding:18px;margin-bottom:14px;">
            <p style="color:${cfg.color};font-size:11px;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Nuevo horario propuesto</p>
            <table style="width:100%;font-size:14px;border-collapse:collapse;">
              <tr><td style="color:#93c5fd;padding:5px 0;">Fecha</td><td style="text-align:right;color:white;font-weight:700;">${formatFecha(fecha_propuesta)}</td></tr>
              <tr><td style="color:#93c5fd;padding:5px 0;">Hora</td><td style="text-align:right;color:#a78bfa;font-weight:800;font-size:18px;">${hora_propuesta}hs</td></tr>
            </table>
            ${motivo ? `<p style="color:#93c5fd;font-size:13px;margin:10px 0 0;font-style:italic;">💬 ${motivo}</p>` : ''}
          </div>
          <div style="background:#451a0310;border:1px solid #fbbf2440;border-radius:10px;padding:14px;margin-bottom:18px;">
            <p style="color:#fbbf24;font-size:13px;margin:0;line-height:1.5;">
              ⏰ Tenés <strong>12 horas</strong> para aceptar o rechazar el cambio.<br/>
              Si no respondés, el turno se cancela automáticamente.
            </p>
          </div>
          ` : ''}

          ${motivo && accion !== 'modificado' ? `
          <p style="color:#737373;font-size:13px;font-style:italic;margin-bottom:18px;">💬 ${motivo}</p>
          ` : ''}

          <div style="text-align:center;">
            <a href="${misTurnosUrl}"
               style="display:inline-block;background:#7c3aed;color:white;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
              ${accion === 'modificado' ? 'Ver y responder →' : 'Ver mis turnos →'}
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
