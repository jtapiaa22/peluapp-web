import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import Card from '../components/Card'
import Input from '../components/Input'
import Button from '../components/Button'
import { Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'

export default function ResetPassword() {
  const router = useRouter()
  const { token, p: peluqueriaId } = router.query

  const [password, setPassword]   = useState('')
  const [password2, setPassword2] = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [exito, setExito]         = useState(false)
  const [nombre, setNombre]       = useState('')

  useEffect(() => {
    if (router.isReady && !token) {
      setError('Link inválido. No hay token en la URL.')
    }
  }, [router.isReady, token])

  const handleReset = async () => {
    if (!password) { setError('Ingresá una contraseña.'); return }
    if (password.length < 6) { setError('Debe tener al menos 6 caracteres.'); return }
    if (password !== password2) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al resetear.'); return }
      setNombre(data.nombre)
      setExito(true)
    } catch { setError('Error de conexión. Intentá de nuevo.') }
    finally { setLoading(false) }
  }

  return (
    <Layout>
      <div className="flex flex-col items-center gap-8 pt-8">

        <div className="text-center">
          <div className="w-16 h-16 bg-violet-600/20 border border-violet-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔑</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Nueva contraseña</h1>
          <p className="text-zinc-400 text-sm">Elegí una contraseña segura para tu cuenta.</p>
        </div>

        <Card className="w-full max-w-md">
          {exito ? (
            <div className="flex flex-col items-center gap-5 text-center py-4">
              <div className="w-14 h-14 bg-emerald-500/15 border border-emerald-500/30 rounded-full flex items-center justify-center">
                <CheckCircle size={28} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="font-bold text-white text-lg mb-1">¡Contraseña actualizada!</h2>
                <p className="text-zinc-400 text-sm">
                  {nombre ? `Hola ${nombre.split(' ')[0]}, ya` : 'Ya'} podés ingresar con tu nueva contraseña.
                </p>
              </div>
              {peluqueriaId && (
                <Button fullWidth onClick={() => router.push(`/?p=${peluqueriaId}`)}>
                  Ir a iniciar sesión →
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="font-bold text-white text-lg mb-1">Crear nueva contraseña</h2>
                <p className="text-zinc-500 text-sm">Ingresala dos veces para confirmar.</p>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                  <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {token && !error && (
                <>
                  <div className="relative">
                    <Input
                      label="Nueva contraseña"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError('') }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 bottom-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <Input
                    label="Confirmar contraseña"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Repetí tu contraseña"
                    value={password2}
                    onChange={e => { setPassword2(e.target.value); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleReset()}
                  />

                  <Button onClick={handleReset} disabled={loading} fullWidth>
                    {loading ? 'Guardando...' : 'Guardar contraseña →'}
                  </Button>
                </>
              )}

              {/* Si hay error del servidor, mostrar botón para pedir otro link */}
              {error && token && (
                <p className="text-xs text-zinc-500 text-center">
                  Volvé al inicio y pedí un nuevo link desde "¿Olvidaste tu contraseña?".
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  )
}
