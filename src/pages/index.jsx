import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Card from '../components/Card'
import Input from '../components/Input'
import Button from '../components/Button'
import { Scissors, AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function Home() {
  const router = useRouter()
  const { p: peluqueriaId } = router.query

  const [peluqueria, setPeluqueria]     = useState(null)
  const [noEncontrada, setNoEncontrada] = useState(false)
  const [vista, setVista]               = useState('login')   // 'login' | 'registro' | 'recuperar'
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [mensajeOk, setMensajeOk]       = useState('')
  const [showPass, setShowPass]         = useState(false)
  const [showPass2, setShowPass2]       = useState(false)

  // Campos login
  const [loginEmail, setLoginEmail]   = useState('')
  const [loginPass, setLoginPass]     = useState('')

  // Campos registro
  const [regNombre, setRegNombre]     = useState('')
  const [regEmail, setRegEmail]       = useState('')
  const [regPass, setRegPass]         = useState('')
  const [regPass2, setRegPass2]       = useState('')
  const [regTel, setRegTel]           = useState('')

  // Campo recuperar
  const [recEmail, setRecEmail]       = useState('')

  useEffect(() => {
    if (!peluqueriaId) return
    supabase.from('peluquerias').select('*').eq('id', peluqueriaId).eq('activo', true).maybeSingle()
      .then(({ data }) => { if (data) setPeluqueria(data); else setNoEncontrada(true) })
  }, [peluqueriaId])

  const irAReservar = (cliente) => {
    sessionStorage.setItem('cliente', JSON.stringify(cliente))
    sessionStorage.setItem('peluqueria_id', peluqueriaId)
    router.push(`/reservar?p=${peluqueriaId}`)
  }

  // ── LOGIN ────────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPass) { setError('Completá todos los campos.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPass })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al ingresar.'); return }
      irAReservar(data.cliente)
    } catch { setError('Error de conexión. Intentá de nuevo.') }
    finally { setLoading(false) }
  }

  // ── REGISTRO ─────────────────────────────────────────────────────────────────
  const handleRegistro = async () => {
    if (!regNombre.trim() || !regEmail.trim() || !regPass) { setError('Completá nombre, email y contraseña.'); return }
    if (!regEmail.includes('@')) { setError('Ingresá un email válido.'); return }
    if (regPass.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (regPass !== regPass2) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: regNombre.trim(), email: regEmail.trim(), password: regPass, telefono: regTel.trim() || null })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al registrarse.'); return }
      irAReservar(data.cliente)
    } catch { setError('Error de conexión. Intentá de nuevo.') }
    finally { setLoading(false) }
  }

  // ── RECUPERAR CONTRASEÑA ──────────────────────────────────────────────────────
  const handleRecuperar = async () => {
    if (!recEmail.trim() || !recEmail.includes('@')) { setError('Ingresá un email válido.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/recuperar-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recEmail.trim(), peluqueriaId })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al enviar el email.'); return }
      setMensajeOk('Te enviamos un link para resetear tu contraseña. Revisá tu email.')
    } catch { setError('Error de conexión. Intentá de nuevo.') }
    finally { setLoading(false) }
  }

  const cambiarVista = (v) => { setVista(v); setError(''); setMensajeOk('') }

  // Sin ID en la URL
  if (!peluqueriaId && router.isReady) return (
    <Layout>
      <div className="flex flex-col items-center gap-6 pt-16 text-center">
        <AlertCircle size={48} className="text-zinc-600" />
        <div>
          <h1 className="text-xl font-bold text-white mb-2">Link inválido</h1>
          <p className="text-zinc-500 text-sm">Este link no corresponde a ninguna peluquería.<br/>Pedile el link correcto al negocio.</p>
        </div>
      </div>
    </Layout>
  )

  if (noEncontrada) return (
    <Layout>
      <div className="flex flex-col items-center gap-6 pt-16 text-center">
        <AlertCircle size={48} className="text-red-500/60" />
        <div>
          <h1 className="text-xl font-bold text-white mb-2">Peluquería no encontrada</h1>
          <p className="text-zinc-500 text-sm">El link puede estar desactivado o ser incorrecto.<br/>Contactá al negocio para obtener el link actualizado.</p>
        </div>
      </div>
    </Layout>
  )

  return (
    <Layout peluqueriaNombre={peluqueria?.nombre}>
      <div className="flex flex-col items-center gap-8 pt-8">

        {/* Hero */}
        <div className="text-center">
          <div className="w-16 h-16 bg-violet-600/20 border border-violet-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Scissors size={28} className="text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {peluqueria ? `Reservá en ${peluqueria.nombre}` : 'Cargando...'}
          </h1>
          <p className="text-zinc-400 text-sm">Elegí el día y horario que más te conviene.</p>
        </div>

        <Card className="w-full max-w-md">

          {/* Tabs login / registro */}
          {vista !== 'recuperar' && (
            <div className="flex gap-1 p-1 bg-zinc-900 rounded-xl mb-6">
              <button
                onClick={() => cambiarVista('login')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  vista === 'login' ? 'bg-violet-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Ingresar
              </button>
              <button
                onClick={() => cambiarVista('registro')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  vista === 'registro' ? 'bg-violet-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Registrarse
              </button>
            </div>
          )}

          {/* ── LOGIN ── */}
          {vista === 'login' && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="font-bold text-white text-lg mb-1">Bienvenido/a de vuelta</h2>
                <p className="text-zinc-500 text-sm">Ingresá con tu email y contraseña.</p>
              </div>

              <Input
                label="Email"
                type="email"
                placeholder="tu@email.com"
                value={loginEmail}
                onChange={e => { setLoginEmail(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />

              <div className="relative">
                <Input
                  label="Contraseña"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Tu contraseña"
                  value={loginPass}
                  onChange={e => { setLoginPass(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  error={error}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 bottom-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <Button onClick={handleLogin} disabled={loading || !peluqueria} fullWidth>
                {loading ? 'Ingresando...' : 'Ingresar →'}
              </Button>

              <button
                onClick={() => cambiarVista('recuperar')}
                className="text-xs text-zinc-500 hover:text-violet-400 transition-colors text-center"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          {/* ── REGISTRO ── */}
          {vista === 'registro' && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="font-bold text-white text-lg mb-1">Crear cuenta</h2>
                <p className="text-zinc-500 text-sm">Registrate para reservar turnos fácilmente.</p>
              </div>

              <Input
                label="Nombre completo"
                placeholder="Juan García"
                value={regNombre}
                onChange={e => { setRegNombre(e.target.value); setError('') }}
              />
              <Input
                label="Email"
                type="email"
                placeholder="tu@email.com"
                value={regEmail}
                onChange={e => { setRegEmail(e.target.value); setError('') }}
              />

              <div className="relative">
                <Input
                  label="Contraseña"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={regPass}
                  onChange={e => { setRegPass(e.target.value); setError('') }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 bottom-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="relative">
                <Input
                  label="Confirmar contraseña"
                  type={showPass2 ? 'text' : 'password'}
                  placeholder="Repetí tu contraseña"
                  value={regPass2}
                  onChange={e => { setRegPass2(e.target.value); setError('') }}
                  error={error}
                  onKeyDown={e => e.key === 'Enter' && handleRegistro()}
                />
                <button
                  type="button"
                  onClick={() => setShowPass2(v => !v)}
                  className="absolute right-3 bottom-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPass2 ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <Input
                label={<>Teléfono <span className="text-zinc-600 text-xs font-normal">(opcional)</span></>}
                type="tel"
                placeholder="+54 9 11 1234 5678"
                value={regTel}
                onChange={e => setRegTel(e.target.value)}
              />

              <Button onClick={handleRegistro} disabled={loading || !peluqueria} fullWidth>
                {loading ? 'Creando cuenta...' : 'Crear cuenta →'}
              </Button>
            </div>
          )}

          {/* ── RECUPERAR CONTRASEÑA ── */}
          {vista === 'recuperar' && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="font-bold text-white text-lg mb-1">Recuperar contraseña</h2>
                <p className="text-zinc-500 text-sm">Te enviamos un link para crear una nueva contraseña.</p>
              </div>

              {mensajeOk ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <p className="text-emerald-400 text-sm font-medium">✓ {mensajeOk}</p>
                </div>
              ) : (
                <>
                  <Input
                    label="Tu email"
                    type="email"
                    placeholder="tu@email.com"
                    value={recEmail}
                    onChange={e => { setRecEmail(e.target.value); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleRecuperar()}
                    error={error}
                  />
                  <Button onClick={handleRecuperar} disabled={loading} fullWidth>
                    {loading ? 'Enviando...' : 'Enviar link de recuperación'}
                  </Button>
                </>
              )}

              <button
                onClick={() => cambiarVista('login')}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors text-center"
              >
                ← Volver al inicio
              </button>
            </div>
          )}

        </Card>
      </div>
    </Layout>
  )
}
