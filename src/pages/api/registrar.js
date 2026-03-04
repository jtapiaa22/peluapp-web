import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { nombre, email, password, telefono } = req.body

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' })
  }

  const emailNorm = email.toLowerCase().trim()

  // Ver si ya existe
  const { data: existe } = await supabase
    .from('clientes')
    .select('id, password_hash')
    .eq('email', emailNorm)
    .maybeSingle()

  if (existe?.password_hash) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese email. Ingresá con tu contraseña.' })
  }

  const hash = await bcrypt.hash(password, 12)

  let cliente
  if (existe) {
    // Cliente antiguo (registrado con código): le asignamos contraseña
    const { data, error } = await supabase
      .from('clientes')
      .update({
        nombre:        nombre.trim(),
        telefono:      telefono || null,
        password_hash: hash
      })
      .eq('id', existe.id)
      .select()
      .single()
    if (error) throw error
    cliente = data
  } else {
    // Cliente nuevo
    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nombre:        nombre.trim(),
        email:         emailNorm,
        telefono:      telefono || null,
        password_hash: hash
      })
      .select()
      .single()
    if (error) throw error
    cliente = data
  }

  const { password_hash, reset_token, reset_expires_at, ...clienteSeguro } = cliente
  return res.status(200).json({ cliente: clienteSeguro })
}
