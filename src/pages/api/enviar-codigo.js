import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { email, codigo, peluqueriaNombre } = req.body
  if (!email || !codigo) return res.status(400).json({ error: 'Faltan datos' })

  try {
    await resend.emails.send({
      from: 'PeluApp <turnos@servicio-turno-web-peluapp.xyz>',
      to:      email,
      subject: `Tu código de acceso: ${codigo}`,
      html: `
        <div style="font-family:Inter,sans-serif;background:#0f0f0f;color:#f5f5f5;padding:40px;max-width:480px;margin:0 auto;border-radius:16px;">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="background:#7c3aed;width:56px;height:56px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
              <span style="font-size:24px;text-align:center">✂️</span>
            </div>
            <h1 style="margin:0;font-size:22px;font-weight:700;">${peluqueriaNombre || 'PeluApp'}</h1>
            <p style="color:#737373;font-size:14px;margin-top:4px;">Reservas online</p>
          </div>
          <p style="color:#a1a1aa;font-size:15px;margin-bottom:24px;">Tu código de verificación es:</p>
          <div style="background:#1a1a1a;border:1px solid #2d1f5e;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
            <span style="font-size:42px;font-weight:800;letter-spacing:10px;color:#a78bfa;">${codigo}</span>
          </div>
          <p style="color:#737373;font-size:13px;text-align:center;">
            Válido por <strong style="color:#f5f5f5;">15 minutos</strong>.<br/>
            Si no fuiste vos, ignorá este mensaje.
          </p>
        </div>
      `
    })
    res.status(200).json({ ok: true })
  } catch (e) {
    console.error('Resend error:', e)
    res.status(500).json({ error: 'Error al enviar email' })
  }
}
