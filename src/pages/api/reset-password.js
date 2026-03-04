import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Faltan datos.' })
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' })

  // Buscar cliente con token válido y no vencido
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nombre, email')
    .eq('reset_token', token)
    .gte('reset_expires_at', new Date().toISOString())
    .maybeSingle()

  if (!cliente) {
    return res.status(400).json({ error: 'El link es inválido o ya expiró. Pedí uno nuevo.' })
  }

  const hash = await bcrypt.hash(password, 12)

  await supabase
    .from('clientes')
    .update({ password_hash: hash, reset_token: null, reset_expires_at: null })
    .eq('id', cliente.id)

  return res.status(200).json({ ok: true, nombre: cliente.nombre })
}
