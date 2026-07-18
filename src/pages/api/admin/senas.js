import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../lib/adminAuth'
import { notificarConfirmado } from '../../../lib/whatsapp'

/**
 * Señas pendientes de cobro.
 *
 * GET  → las que están esperando el pago
 * POST { id } → marca la seña como pagada y confirma el turno
 *
 * Espeja `turnosWeb:confirmarSena` de electron/main.js:859, salvo el insert en
 * el SQLite local: de eso se encarga `turnosWeb:sincronizarConfirmados` cuando
 * el peluquero abre la Agenda, porque el turno queda en estado 'confirmado'.
 */
export default async function handler(req, res) {
  const pid = requireAdmin(req, res)
  if (!pid) return

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('turnos_senas')
      .select('*')
      .eq('peluqueria_id', pid)
      .eq('estado', 'pendiente_sena')
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true })

    if (error) return res.status(500).json({ error: 'No pudimos cargar las señas.' })
    return res.status(200).json({ senas: data || [] })
  }

  if (req.method === 'POST') {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'Falta la seña.' })

    // Filtramos por peluqueria_id: una sesión no puede confirmar señas ajenas.
    const { data: sena } = await supabaseAdmin
      .from('turnos_senas').select('*')
      .eq('id', id).eq('peluqueria_id', pid).maybeSingle()
    if (!sena) return res.status(404).json({ error: 'Seña no encontrada.' })
    if (sena.estado === 'pagada') {
      return res.status(409).json({ error: 'Esta seña ya estaba confirmada.' })
    }

    const { error: errSena } = await supabaseAdmin
      .from('turnos_senas').update({ estado: 'pagada' }).eq('id', id)
    if (errSena) return res.status(500).json({ error: 'No pudimos actualizar la seña.' })

    const { error: errTurno } = await supabaseAdmin.from('turnos_web').update({
      estado: 'confirmado',
      respondido_at: new Date().toISOString(),
    }).eq('id', sena.turno_web_id)
    if (errTurno) return res.status(500).json({ error: 'No pudimos confirmar el turno.' })

    const { data: pel } = await supabaseAdmin
      .from('peluquerias').select('nombre').eq('id', pid).maybeSingle()

    const envio = await notificarConfirmado({
      telefono: sena.cliente_telefono,
      nombre: sena.cliente_nombre,
      peluqueria_nombre: pel?.nombre || 'PeluApp',
      fecha: sena.fecha,
      hora: sena.hora,
      peluqueria_id: pid,
    })

    return res.status(200).json({ ok: true, whatsapp: envio })
  }

  res.status(405).end()
}
