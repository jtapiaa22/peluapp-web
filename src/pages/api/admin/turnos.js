import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../lib/adminAuth'

/** GET /api/admin/turnos → turnos a responder + los confirmados de hoy en adelante */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const pid = requireAdmin(req, res)
  if (!pid) return

  const hoy = new Date().toISOString().slice(0, 10)

  const [pendientes, proximos] = await Promise.all([
    supabaseAdmin.from('turnos_web')
      .select('*')
      .eq('peluqueria_id', pid)
      .in('estado', ['pendiente', 'modificado'])
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true }),
    supabaseAdmin.from('turnos_web')
      .select('*')
      .eq('peluqueria_id', pid)
      .in('estado', ['confirmado', 'esperando_sena'])
      .gte('fecha', hoy)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true }),
  ])

  if (pendientes.error || proximos.error) {
    return res.status(500).json({ error: 'No pudimos cargar los turnos.' })
  }

  res.status(200).json({
    pendientes: pendientes.data || [],
    proximos: proximos.data || [],
  })
}
