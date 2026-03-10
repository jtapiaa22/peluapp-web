import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)

function formatFecha(f) {
  if (!f) return ''
  const [y, m, d] = f.split('-')
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${parseInt(d)} de ${meses[parseInt(m)-1]} de ${y}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { turno_id } = req.body
  if (!turno_id) return res.status(400).json({ error: 'Falta turno_id' })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://servicio-turno-web-peluapp.xyz'

  // Traer turno y peluquería juntos
  const { data: turno } = await supabase
    .from('turnos_web').select('*').eq('id', turno_id).single()
  if (!turno) return res.status(404).json({ error: 'Turno no encontrado' })

  const { data: peluqueria } = await supabase
    .from('peluquerias').select('sena_monto, sena_alias, sena_horas_vencimiento, nombre').eq('id', turno.peluqueria_id).single()

  const senaMonto = Number(peluqueria?.sena_monto || 0)
  const senaAlias = peluqueria?.sena_alias?.trim() || ''
  const senaHoras = Number(peluqueria?.sena_horas_vencimiento || 24)

  if (senaMonto > 0 && senaAlias) {
    // HAY SEÑA: poner en esperando_sena
    const venceAt = new Date(Date.now() + senaHoras * 60 * 60 * 1000).toISOString()

    await supabase.from('turnos_web').update({
      estado:          'esperando_sena',
      fecha:           turno.fecha_propuesta,
      hora:            turno.hora_propuesta,
      fecha_propuesta: null,
      hora_propuesta:  null,
      sena_vence_at:   venceAt,
    }).eq('id', turno_id)

    await resend.emails.send({
      from: 'PeluApp <turnos@servicio-turno-web-peluapp.xyz>',
      to: turno.cliente_email,
      subject: `💸 Confirmá tu turno — pagá la seña — ${peluqueria?.nombre || 'PeluApp'}`,
      html: `
        <div style="font-family:Inter,sans-serif;background:#0f0f0f;color:#f5f5f5;padding:40px;max-width:480px;margin:0 auto;border-radius:16px;">
          <div style="text-align:center;margin-bottom:28px;">
            <div style="font-size:40px;margin-bottom:12px;">💸</div>
            <h1 style="margin:0;font-size:20px;font-weight:700;">${peluqueria?.nombre || 'PeluApp'}</h1>
            <p style="color:#737373;font-size:13px;margin-top:4px;">Actualización de tu turno</p>
          </div>
          <p style="font-size:15px;margin-bottom:20px;line-height:1.6;">
            Hola <strong>${turno.cliente_nombre}</strong>, aceptaste el nuevo horario.
            Para confirmar definitivamente tu turno, tenés que pagar la seña.
          </p>
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:18px;margin-bottom:14px;">
            <table style="width:100%;font-size:14px;border-collapse:collapse;">
              <tr><td style="color:#737373;padding:5px 0;">Peluquero</td><td style="text-align:right;">${turno.peluquero_nombre}</td></tr>
              <tr><td style="color:#737373;padding:5px 0;">Fecha</td><td style="text-align:right;">${formatFecha(turno.fecha_propuesta)}</td></tr>
              <tr><td style="color:#737373;padding:5px 0;">Hora</td><td style="text-align:right;">${turno.hora_propuesta?.substring(0,5)}hs</td></tr>
            </table>
          </div>
          <div style="background:#431a0530;border:1px solid #fb923c50;border-radius:12px;padding:20px;margin-bottom:16px;">
            <p style="color:#fb923c;font-size:11px;font-weight:700;margin:0 0 14px;text-transform:uppercase;letter-spacing:1px;">💸 Instrucciones de pago</p>
            <table style="width:100%;font-size:14px;border-collapse:collapse;">
              <tr>
                <td style="color:#737373;padding:7px 0;border-bottom:1px solid #2a2a2a;">Monto</td>
                <td style="text-align:right;color:white;font-weight:800;font-size:18px;padding:7px 0;border-bottom:1px solid #2a2a2a;">$${senaMonto.toLocaleString('es-AR')}</td>
              </tr>
              <tr>
                <td style="color:#737373;padding:7px 0;">Alias / CBU</td>
                <td style="text-align:right;color:#fb923c;font-weight:700;font-family:monospace;font-size:15px;padding:7px 0;">${senaAlias}</td>
              </tr>
            </table>
          </div>
          <div style="background:#451a0310;border:1px solid #fbbf2440;border-radius:10px;padding:14px;margin-bottom:18px;">
            <p style="color:#fbbf24;font-size:13px;margin:0;line-height:1.6;">
              ⏰ Tenés <strong>${senaHoras} horas</strong> para realizar la transferencia.<br/>
              Si no pagás en ese tiempo, el turno se cancela automáticamente.
            </p>
          </div>
          <div style="text-align:center;">
            <a href="${appUrl}/mi-turno?p=${turno.peluqueria_id}" style="display:inline-block;background:#7c3aed;color:white;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
              Ver mi turno →
            </a>
          </div>
        </div>
      `
    }).catch(() => {})

    return res.status(200).json({ ok: true, esperandoSena: true })
  }

  // SIN SEÑA: confirmar directo (flujo original)
  await supabase.from('turnos_web').update({
    estado:          'confirmado',
    fecha:           turno.fecha_propuesta,
    hora:            turno.hora_propuesta,
    fecha_propuesta: null,
    hora_propuesta:  null,
  }).eq('id', turno_id)

  await resend.emails.send({
    from: 'PeluApp <turnos@servicio-turno-web-peluapp.xyz>',
    to: turno.cliente_email,
    subject: `✅ Turno confirmado con nuevo horario — ${peluqueria?.nombre || 'PeluApp'}`,
    html: `
      <div style="font-family:Inter,sans-serif;background:#0f0f0f;color:#f5f5f5;padding:40px;max-width:480px;margin:0 auto;border-radius:16px;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="font-size:40px;margin-bottom:12px;">✅</div>
          <h1 style="margin:0;font-size:20px;font-weight:700;">${peluqueria?.nombre || 'PeluApp'}</h1>
        </div>
        <p style="font-size:15px;margin-bottom:20px;line-height:1.6;">
          Hola <strong>${turno.cliente_nombre}</strong>, tu turno fue <strong style="color:#4ade80">confirmado</strong> con el nuevo horario. ¡Te esperamos!
        </p>
        <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:18px;margin-bottom:20px;">
          <table style="width:100%;font-size:14px;border-collapse:collapse;">
            <tr><td style="color:#737373;padding:5px 0;">Peluquero</td><td style="text-align:right;">${turno.peluquero_nombre}</td></tr>
            <tr><td style="color:#737373;padding:5px 0;">Fecha</td><td style="text-align:right;">${formatFecha(turno.fecha_propuesta)}</td></tr>
            <tr><td style="color:#737373;padding:5px 0;">Hora</td><td style="text-align:right;">${turno.hora_propuesta?.substring(0,5)}hs</td></tr>
          </table>
        </div>
        <div style="text-align:center;">
          <a href="${appUrl}/mi-turno?p=${turno.peluqueria_id}" style="display:inline-block;background:#7c3aed;color:white;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
            Ver mis turnos →
          </a>
        </div>
      </div>
    `
  }).catch(() => {})

  return res.status(200).json({ ok: true, esperandoSena: false })
}