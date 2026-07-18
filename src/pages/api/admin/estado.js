import { supabaseAdmin } from '../../../lib/supabaseAdmin'

/** GET /api/admin/estado?p=<peluqueria_id> → { nombre, tieneClave } */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const pid = req.query.p
  if (!pid) return res.status(400).json({ error: 'Falta el identificador de la peluquería.' })

  const { data, error } = await supabaseAdmin
    .from('peluquerias')
    .select('nombre, activo')
    .eq('id', pid)
    .maybeSingle()

  if (error) return res.status(500).json({ error: 'No pudimos verificar la peluquería.' })
  if (!data || !data.activo) return res.status(404).json({ error: 'Peluquería no encontrada.' })

  // El hash vive en peluqueria_admin (ver migraciones/002). Solo miramos si existe.
  const { data: admin } = await supabaseAdmin
    .from('peluqueria_admin')
    .select('peluqueria_id')
    .eq('peluqueria_id', pid)
    .maybeSingle()

  res.status(200).json({ nombre: data.nombre, tieneClave: Boolean(admin) })
}
