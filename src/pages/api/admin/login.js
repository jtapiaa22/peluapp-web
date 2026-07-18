import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { crearToken, cookieSesion } from '../../../lib/adminAuth'

// Freno simple de fuerza bruta. Vive en memoria del proceso: en serverless no es
// infalible (hay varias instancias), pero corta el intento burdo desde un solo lado.
const intentos = new Map()
const MAX = 8
const VENTANA = 10 * 60 * 1000

function bloqueado(clave) {
  const reg = intentos.get(clave)
  if (!reg) return false
  if (Date.now() - reg.desde > VENTANA) { intentos.delete(clave); return false }
  return reg.n >= MAX
}

function sumarFallo(clave) {
  const reg = intentos.get(clave)
  if (!reg || Date.now() - reg.desde > VENTANA) intentos.set(clave, { n: 1, desde: Date.now() })
  else reg.n++
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { p: pid, clave } = req.body || {}
  if (!pid || !clave) return res.status(400).json({ error: 'Faltan datos.' })

  if (bloqueado(pid)) {
    return res.status(429).json({ error: 'Demasiados intentos fallidos. Esperá unos minutos.' })
  }

  const { data: pel, error } = await supabaseAdmin
    .from('peluquerias')
    .select('id, activo')
    .eq('id', pid)
    .maybeSingle()

  if (error) return res.status(500).json({ error: 'Error del servidor. Probá de nuevo.' })
  if (!pel || !pel.activo) return res.status(404).json({ error: 'Peluquería no encontrada.' })

  const { data: admin } = await supabaseAdmin
    .from('peluqueria_admin')
    .select('password_hash')
    .eq('peluqueria_id', pid)
    .maybeSingle()

  if (!admin) return res.status(409).json({ error: 'Todavía no creaste tu clave.' })

  const ok = await bcrypt.compare(String(clave), admin.password_hash)
  if (!ok) {
    sumarFallo(pid)
    return res.status(401).json({ error: 'Clave incorrecta.' })
  }

  intentos.delete(pid)

  // Si falta ADMIN_SESSION_SECRET no se puede firmar la sesión. Sin este catch
  // salía un 500 pelado y desde afuera parecía que la clave estaba mal.
  try {
    res.setHeader('Set-Cookie', cookieSesion(crearToken(pid)))
  } catch (e) {
    console.error('[admin/login]', e.message)
    return res.status(500).json({ error: 'El panel no está configurado del todo. Avisale a PeluApp.' })
  }

  res.status(200).json({ ok: true })
}
