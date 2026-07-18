import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import Card from '../components/Card'
import Input from '../components/Input'
import Button from '../components/Button'
import {
  AlertCircle, Check, X, CalendarClock, Clock, User, Scissors,
  LogOut, RefreshCw, ShieldCheck, AlertTriangle,
} from 'lucide-react'

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DIAS   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']

function formatFecha(f) {
  if (!f) return ''
  const [a, m, d] = f.split('-').map(Number)
  const fecha = new Date(a, m - 1, d)
  return `${DIAS[fecha.getDay()]} ${d} de ${MESES[m - 1]}`
}

const hhmm = (h) => (h || '').substring(0, 5)

export default function Admin() {
  const router = useRouter()
  const { p: pid } = router.query

  const [cargando, setCargando]   = useState(true)
  const [peluqueria, setPeluqueria] = useState(null)
  const [tieneClave, setTieneClave] = useState(false)
  const [autenticado, setAutenticado] = useState(false)
  const [errorFatal, setErrorFatal] = useState('')

  // Login
  const [clave, setClave]     = useState('')
  const [errorAuth, setErrorAuth] = useState('')
  const [enviando, setEnviando]   = useState(false)

  // Panel
  const [pendientes, setPendientes] = useState([])
  const [proximos, setProximos]     = useState([])
  const [refrescando, setRefrescando] = useState(false)
  const [abierto, setAbierto]   = useState(null)   // { id, modo: 'rechazar'|'proponer'|'cancelar' }
  const [motivo, setMotivo]     = useState('')
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevaHora, setNuevaHora]   = useState('')
  const [procesando, setProcesando] = useState(null)
  const [aviso, setAviso] = useState(null)  // { tipo, texto }

  const cargarTurnos = useCallback(async () => {
    const r = await fetch('/api/admin/turnos')
    if (r.status === 401) { setAutenticado(false); return }
    const d = await r.json()
    if (r.ok) {
      setPendientes(d.pendientes || [])
      setProximos(d.proximos || [])
      setAutenticado(true)
    }
  }, [])

  // Estado inicial: datos de la peluquería + si ya hay sesión abierta
  useEffect(() => {
    if (!router.isReady) return
    if (!pid) { setCargando(false); return }
    ;(async () => {
      try {
        const r = await fetch(`/api/admin/estado?p=${encodeURIComponent(pid)}`)
        const d = await r.json()
        if (!r.ok) { setErrorFatal(d.error || 'No pudimos cargar la peluquería.'); return }
        setPeluqueria(d.nombre)
        setTieneClave(d.tieneClave)
        await cargarTurnos()
      } catch {
        setErrorFatal('No pudimos conectar. Revisá tu conexión.')
      } finally {
        setCargando(false)
      }
    })()
  }, [router.isReady, pid, cargarTurnos])

  // Refresco automático mientras el panel está abierto
  useEffect(() => {
    if (!autenticado) return
    const t = setInterval(cargarTurnos, 20000)
    return () => clearInterval(t)
  }, [autenticado, cargarTurnos])

  const entrar = async () => {
    setErrorAuth(''); setEnviando(true)
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p: pid, clave }),
      })
      const d = await r.json()
      if (!r.ok) { setErrorAuth(d.error || 'No pudimos entrar.'); return }
      setClave('')
      await cargarTurnos()
    } finally { setEnviando(false) }
  }

  const salir = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    setAutenticado(false)
  }

  const refrescar = async () => {
    setRefrescando(true)
    await cargarTurnos()
    setRefrescando(false)
  }

  const responder = async (id, accion, extra = {}) => {
    setProcesando(id); setAviso(null)
    try {
      const r = await fetch('/api/admin/responder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, accion, ...extra }),
      })
      const d = await r.json()
      if (!r.ok) { setAviso({ tipo: 'error', texto: d.error || 'No se pudo responder.' }); return }

      // El turno se actualizó igual, pero si el WhatsApp no salió hay que decirlo:
      // el cliente no se entera de nada y antes esto fallaba en silencio.
      if (d.whatsapp && d.whatsapp.ok === false) {
        setAviso({
          tipo: 'warning',
          texto: 'El turno se actualizó, pero el WhatsApp al cliente NO se pudo enviar. Avisale por otro medio.',
        })
      } else if (d.esperandoSena) {
        setAviso({ tipo: 'ok', texto: 'Le enviamos los datos de la seña al cliente.' })
      } else {
        setAviso({ tipo: 'ok', texto: 'Listo, le avisamos al cliente por WhatsApp.' })
      }

      setAbierto(null); setMotivo(''); setNuevaFecha(''); setNuevaHora('')
      await cargarTurnos()
    } finally { setProcesando(null) }
  }

  // ── Pantallas de error / carga ───────────────────────────────────────────
  if (cargando) return (
    <Layout><p className="text-zinc-500 text-sm text-center pt-16">Cargando...</p></Layout>
  )

  if (!pid) return (
    <Layout>
      <div className="flex flex-col items-center gap-6 pt-16 text-center">
        <AlertCircle size={48} className="text-zinc-600" />
        <div>
          <h1 className="text-xl font-bold text-white mb-2">Link inválido</h1>
          <p className="text-zinc-500 text-sm">Este link no corresponde a ninguna peluquería.</p>
        </div>
      </div>
    </Layout>
  )

  if (errorFatal) return (
    <Layout>
      <div className="flex flex-col items-center gap-6 pt-16 text-center">
        <AlertCircle size={48} className="text-red-500/60" />
        <p className="text-zinc-400 text-sm">{errorFatal}</p>
      </div>
    </Layout>
  )

  // ── Login / primer ingreso ───────────────────────────────────────────────
  if (!autenticado) return (
    <Layout peluqueriaNombre={peluqueria}>
      <div className="flex flex-col items-center gap-8 pt-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-violet-600/20 border border-violet-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={28} className="text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Panel de turnos</h1>
          <p className="text-zinc-400 text-sm">
            {tieneClave
              ? 'Ingresá tu clave para responder los turnos.'
              : 'Todavía no tenés una clave asignada.'}
          </p>
        </div>

        <Card className="w-full max-w-md">
          {tieneClave ? (
            <div className="flex flex-col gap-5">
              <Input label="Clave" type="password" value={clave} placeholder="Tu clave"
                onChange={e => setClave(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && entrar()} />

              {errorAuth && (
                <div className="flex items-start gap-2 text-red-400 text-xs">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{errorAuth}</span>
                </div>
              )}

              <Button fullWidth disabled={enviando} onClick={entrar}>
                {enviando ? 'Un momento...' : 'Entrar'}
              </Button>
            </div>
          ) : (
            <p className="text-zinc-400 text-sm leading-relaxed">
              Pedile la clave de acceso a <strong className="text-zinc-200">PeluApp</strong> y
              volvé a entrar por este mismo link. Por seguridad las claves del panel se asignan
              desde el sistema, no se crean acá.
            </p>
          )}
        </Card>
      </div>
    </Layout>
  )

  // ── Panel ────────────────────────────────────────────────────────────────
  return (
    <Layout peluqueriaNombre={peluqueria}>
      <div className="flex flex-col gap-5">

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">
            Pendientes {pendientes.length > 0 && (
              <span className="ml-1 text-sm bg-violet-600 text-white rounded-full px-2 py-0.5 align-middle">
                {pendientes.length}
              </span>
            )}
          </h1>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={refrescar} disabled={refrescando}>
              <RefreshCw size={15} className={refrescando ? 'animate-spin' : ''} />
            </Button>
            <Button size="sm" variant="ghost" onClick={salir}><LogOut size={15} /></Button>
          </div>
        </div>

        {aviso && (
          <div className={`rounded-xl p-3 text-xs flex items-start gap-2 border ${
            aviso.tipo === 'error'   ? 'bg-red-950/40 border-red-800/50 text-red-300' :
            aviso.tipo === 'warning' ? 'bg-amber-950/40 border-amber-700/50 text-amber-300' :
                                       'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
          }`}>
            {aviso.tipo === 'warning' ? <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                                      : <Check size={15} className="mt-0.5 shrink-0" />}
            <span>{aviso.texto}</span>
          </div>
        )}

        {pendientes.length === 0 && (
          <Card>
            <div className="text-center py-6">
              <Check size={32} className="text-emerald-500/50 mx-auto mb-3" />
              <p className="text-zinc-300 text-sm font-medium">No hay turnos esperando respuesta</p>
              <p className="text-zinc-600 text-xs mt-1">Cuando alguien reserve, aparece acá.</p>
            </div>
          </Card>
        )}

        {pendientes.map(t => (
          <Card key={t.id}>
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-white truncate">{t.cliente_nombre}</p>
                  <a href={`https://wa.me/${(t.cliente_telefono || '').replace(/\D/g, '')}`}
                     target="_blank" rel="noreferrer"
                     className="text-violet-400 text-xs hover:underline">
                    {t.cliente_telefono}
                  </a>
                </div>
                {t.estado === 'modificado' && (
                  <span className="text-[10px] bg-amber-600/20 text-amber-400 border border-amber-600/30 rounded-full px-2 py-1 shrink-0">
                    cambio propuesto
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5 text-sm text-zinc-400">
                <span className="flex items-center gap-2"><CalendarClock size={14} className="text-zinc-600" />{formatFecha(t.fecha)}</span>
                <span className="flex items-center gap-2"><Clock size={14} className="text-zinc-600" />{hhmm(t.hora)} hs</span>
                <span className="flex items-center gap-2"><User size={14} className="text-zinc-600" />{t.peluquero_nombre}</span>
                {t.servicio_nombre && (
                  <span className="flex items-center gap-2"><Scissors size={14} className="text-zinc-600" />{t.servicio_nombre}</span>
                )}
              </div>

              {abierto?.id === t.id ? (
                <div className="flex flex-col gap-3 border-t border-zinc-800 pt-3">
                  {abierto.modo === 'proponer' ? (
                    <>
                      <p className="text-zinc-300 text-xs">Proponer otro horario al cliente:</p>
                      <Input label="Nueva fecha" type="date" value={nuevaFecha}
                        onChange={e => setNuevaFecha(e.target.value)} />
                      <Input label="Nueva hora" type="time" value={nuevaHora}
                        onChange={e => setNuevaHora(e.target.value)} />
                    </>
                  ) : (
                    <Input label="Motivo (opcional)" value={motivo} placeholder="Se lo mandamos al cliente"
                      onChange={e => setMotivo(e.target.value)} />
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" fullWidth
                      onClick={() => { setAbierto(null); setMotivo(''); setNuevaFecha(''); setNuevaHora('') }}>
                      Volver
                    </Button>
                    <Button size="sm" fullWidth
                      variant={abierto.modo === 'proponer' ? 'primary' : 'danger'}
                      disabled={procesando === t.id || (abierto.modo === 'proponer' && (!nuevaFecha || !nuevaHora))}
                      onClick={() => abierto.modo === 'proponer'
                        ? responder(t.id, 'modificado', { fecha_propuesta: nuevaFecha, hora_propuesta: nuevaHora })
                        : responder(t.id, 'rechazado', { motivo })}>
                      {procesando === t.id ? '...' : abierto.modo === 'proponer' ? 'Enviar propuesta' : 'Rechazar turno'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 border-t border-zinc-800 pt-3">
                  <Button size="sm" variant="success" fullWidth
                    disabled={procesando === t.id}
                    onClick={() => responder(t.id, 'confirmado')}>
                    <Check size={15} /> {procesando === t.id ? '...' : 'Aceptar'}
                  </Button>
                  <Button size="sm" variant="secondary"
                    onClick={() => setAbierto({ id: t.id, modo: 'proponer' })}>
                    <CalendarClock size={15} />
                  </Button>
                  <Button size="sm" variant="danger"
                    onClick={() => setAbierto({ id: t.id, modo: 'rechazar' })}>
                    <X size={15} />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}

        {proximos.length > 0 && (
          <>
            <h2 className="text-sm font-bold text-zinc-400 mt-3">Próximos turnos</h2>
            {proximos.map(t => (
              <Card key={t.id} className="!p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{t.cliente_nombre}</p>
                    <p className="text-zinc-500 text-xs">
                      {formatFecha(t.fecha_propuesta || t.fecha)} · {hhmm(t.hora_propuesta || t.hora)}hs · {t.peluquero_nombre}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.estado === 'esperando_sena' && (
                      <span className="text-[10px] bg-amber-600/20 text-amber-400 border border-amber-600/30 rounded-full px-2 py-1">
                        seña
                      </span>
                    )}
                    <Button size="sm" variant="ghost"
                      disabled={procesando === t.id}
                      onClick={() => responder(t.id, 'cancelado', { motivo: '' })}>
                      {procesando === t.id ? '...' : <X size={15} />}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
    </Layout>
  )
}
