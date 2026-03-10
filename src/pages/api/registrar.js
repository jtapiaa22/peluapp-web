import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { nombre, username, email, password, telefono } = req.body

  if (!nombre || !username || !email || !password) {
    return res.status(400).json({ error: 'Nombre, usuario, email y contraseña son obligatorios.' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' })
  }

  const emailNorm    = email.toLowerCase().trim()
  const usernameNorm = username.toLowerCase().trim()

  // Validar formato de username
  if (usernameNorm.length < 3) {
    return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres.' })
  }
  if (!/^[a-z0-9._]+$/.test(usernameNorm)) {
    return res.status(400).json({ error: 'El usuario solo puede tener letras, números, puntos y guiones bajos.' })
  }

  // Verificar si el username ya está en uso
  const { data: usernameExiste } = await supabase
    .from('clientes')
    .select('id')
    .eq('username', usernameNorm)
    .maybeSingle()

  if (usernameExiste) {
    return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso. Elegí otro.' })
  }

  // Ver si ya existe por email
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
    // Cliente antiguo (registrado con código): le asignamos contraseña y username
    const { data, error } = await supabase
      .from('clientes')
      .update({
        nombre:        nombre.trim(),
        username:      usernameNorm,
        telefono:      telefono || null,
        password_hash: hash
      })
      .eq('id', existe.id)
      .select()
      .maybeSingle()
    if (error) throw error
    cliente = data
  } else {
    // Cliente nuevo
    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nombre:        nombre.trim(),
        username:      usernameNorm,
        email:         emailNorm,
        telefono:      telefono || null,
        password_hash: hash
      })
      .select()
      .maybeSingle()
    if (error) throw error
    cliente = data
  }

  if (!cliente) {
    return res.status(500).json({ error: 'Error al crear la cuenta. Verificá que las columnas existan en Supabase.' })
  }

  const { password_hash: _ph, reset_token: _rt, reset_expires_at: _re, ...clienteSeguro } = cliente
  return res.status(200).json({ cliente: clienteSeguro })
}
