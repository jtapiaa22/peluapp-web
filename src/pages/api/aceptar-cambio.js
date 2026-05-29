import { createClient } from '@supabase/supabase-js'
import { notificarSena, notificarConfirmado } from '../../lib/whatsapp'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { turno_id } = req.body
  if (!turno_id) return res.status(400).json({ error: 'Falta turno_id' })

  const { data: turno } = await supabase
    .from('turnos_web').select('*').eq('id', turno_id).single()
  if (!turno) return res.status(404).json({ error: 'Turno no encontrado' })

  const { data: peluqueria } = await supabase
    .from('peluquerias').select('sena_monto, sena_alias, sena_horas_vencimiento, sena_correo, nombre').eq('id', turno.peluqueria_id).single()

  const senaMonto  = Number(peluqueria?.sena_monto || 0)
  const senaAlias  = peluqueria?.sena_alias?.trim() || ''
  const senaHoras  = Number(peluqueria?.sena_horas_vencimiento || 24)
  const senaCorreo = peluqueria?.sena_correo?.trim() || ''
  const telefono  = turno.cliente_telefono

  if (senaMonto > 0 && senaAlias) {
    const venceAt = new Date(Date.now() + senaHoras * 60 * 60 * 1000).toISOString()

    await supabase.from('turnos_web').update({
      estado:          'esperando_sena',
      fecha:           turno.fecha_propuesta,
      hora:            turno.hora_propuesta,
      fecha_propuesta: null,
      hora_propuesta:  null,
      sena_vence_at:   venceAt,
    }).eq('id', turno_id)

    await supabase.from('turnos_senas').insert({
      turno_web_id:     turno.id,
      peluqueria_id:    turno.peluqueria_id,
      cliente_nombre:   turno.cliente_nombre,
      cliente_telefono: telefono,
      peluquero_nombre: turno.peluquero_nombre,
      peluquero_id:     turno.peluquero_id,
      servicio_nombre:  turno.servicio_nombre || null,
      fecha:            turno.fecha_propuesta,
      hora:             turno.hora_propuesta?.substring(0, 5),
      monto:            senaMonto,
      alias:            senaAlias,
      vence_at:         venceAt,
      estado:           'pendiente_sena',
    })

    if (telefono) {
      await notificarSena({
        telefono,
        nombre:            turno.cliente_nombre,
        peluqueria_nombre: peluqueria?.nombre || 'PeluApp',
        sena_monto:        senaMonto,
        sena_alias:        senaAlias,
        sena_horas:        senaHoras,
        sena_correo:       senaCorreo,
        peluqueria_id:     turno.peluqueria_id,
      }).catch(() => {})
    }

    return res.status(200).json({ ok: true, esperandoSena: true })
  }

  // Sin seña: confirmar directo
  await supabase.from('turnos_web').update({
    estado:          'confirmado',
    fecha:           turno.fecha_propuesta,
    hora:            turno.hora_propuesta,
    fecha_propuesta: null,
    hora_propuesta:  null,
  }).eq('id', turno_id)

  if (telefono) {
    await notificarConfirmado({
      telefono,
      nombre:           turno.cliente_nombre,
      peluqueria_nombre: peluqueria?.nombre || 'PeluApp',
      fecha:            turno.fecha_propuesta,
      hora:             turno.hora_propuesta?.substring(0, 5),
      peluqueria_id:    turno.peluqueria_id,
    }).catch(() => {})
  }

  return res.status(200).json({ ok: true, esperandoSena: false })
}
