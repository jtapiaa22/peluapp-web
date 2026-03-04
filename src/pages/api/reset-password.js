import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

// Service role para saltear RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Faltan datos.' })
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' })

  // Buscar cliente con ese token (sin filtrar por fecha primero para mejor diagnóstico)
  const { data: cliente, error: errorBuscar } = await supabase
    .from('clientes')
    .select('id, nombre, email, reset_expires_at')
    .eq('reset_token', token)
    .maybeSingle()

  if (errorBuscar) {
    console.error('Error buscando token:', errorBuscar)
    return res.status(500).json({ error: 'Error interno.' })
  }

  if (!cliente) {
    return res.status(400).json({ error: 'El link es inválido. Pedí uno nuevo.' })
  }

  // Verificar expiración manualmente para dar mejor mensaje
  if (cliente.reset_expires_at && new Date(cliente.reset_expires_at) < new Date()) {
    return res.status(400).json({ error: 'El link expiró. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".' })
  }

  const hash = await bcrypt.hash(password, 12)

  const { error: errorUpdate } = await supabase
    .from('clientes')
    .update({ password_hash: hash, reset_token: null, reset_expires_at: null })
    .eq('id', cliente.id)

  if (errorUpdate) {
    console.error('Error actualizando password:', errorUpdate)
    return res.status(500).json({ error: 'No se pudo actualizar la contraseña. Intentá de nuevo.' })
  }

  return res.status(200).json({ ok: true, nombre: cliente.nombre })
}
