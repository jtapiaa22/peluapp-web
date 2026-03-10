import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { identificador, password } = req.body
  if (!identificador || !password) return res.status(400).json({ error: 'Faltan datos.' })

  const valor = identificador.toLowerCase().trim()

  // Buscar por email O por username
  let cliente = null

  if (valor.includes('@')) {
    // Parece un email → buscar por email
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('email', valor)
      .maybeSingle()
    cliente = data
  } else {
    // No tiene @ → buscar por username
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('username', valor)
      .maybeSingle()
    cliente = data
  }

  if (!cliente) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' })
  }

  if (!cliente.password_hash) {
    return res.status(401).json({
      error: 'Esta cuenta fue creada con el sistema anterior. Por favor registrate de nuevo para crear tu contraseña.'
    })
  }

  const ok = await bcrypt.compare(password, cliente.password_hash)
  if (!ok) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' })
  }

  // Nunca devolver el hash al cliente
  const { password_hash, reset_token, reset_expires_at, ...clienteSeguro } = cliente
  return res.status(200).json({ cliente: clienteSeguro })
}
