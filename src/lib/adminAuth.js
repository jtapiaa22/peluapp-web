import crypto from 'crypto'

const COOKIE = 'peluapp_admin'
const DIAS_SESION = 30

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET
  // Sin secreto no hay sesión segura posible: preferimos romper antes que
  // firmar con un valor por defecto que cualquiera podría adivinar.
  if (!s || s.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET no configurado (mínimo 32 caracteres)')
  }
  return s
}

function firmar(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function crearToken(peluqueriaId) {
  const exp = Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000
  const payload = `${peluqueriaId}.${exp}`
  return `${payload}.${firmar(payload)}`
}

/** Devuelve el peluqueria_id si el token es válido y no venció; si no, null. */
export function verificarToken(token) {
  if (!token || typeof token !== 'string') return null
  const partes = token.split('.')
  if (partes.length !== 3) return null

  const [pid, exp, sig] = partes
  const esperada = firmar(`${pid}.${exp}`)

  // timingSafeEqual explota si los largos difieren
  const a = Buffer.from(sig)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  if (!Number(exp) || Date.now() > Number(exp)) return null
  return pid
}

export function cookieSesion(token) {
  const maxAge = DIAS_SESION * 24 * 60 * 60
  const seguro = process.env.NODE_ENV === 'production' ? ' Secure;' : ''
  return `${COOKIE}=${token}; Path=/; HttpOnly;${seguro} SameSite=Lax; Max-Age=${maxAge}`
}

export function cookieBorrar() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

/**
 * Guard para API routes: devuelve el peluqueria_id de la sesión, o corta con 401.
 * Uso: `const pid = requireAdmin(req, res); if (!pid) return`
 */
export function requireAdmin(req, res) {
  const pid = verificarToken(req.cookies?.[COOKIE])
  if (!pid) {
    res.status(401).json({ error: 'Sesión vencida. Volvé a entrar.' })
    return null
  }
  return pid
}
