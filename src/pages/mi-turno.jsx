import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Card from '../components/Card'
import Button from '../components/Button'
import { CheckCircle, XCircle, AlertCircle, Clock, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ESTADOS = {
  pendiente:      { label: 'Esperando respuesta',           color: 'text-yellow-400',  bg: 'border-yellow-500/30  bg-yellow-500/5',   Icon: Clock        },
  confirmado:     { label: 'Confirmado ✓',                  color: 'text-emerald-400', bg: 'border-emerald-500/30 bg-emerald-500/5',  Icon: CheckCircle  },
  modificado:     { label: 'El peluquero propuso un cambio', color: 'text-blue-400',   bg: 'border-blue-500/30    bg-blue-500/5',     Icon: AlertCircle  },
  esperando_sena: { label: 'Esperando pago de seña',        color: 'text-orange-400',  bg: 'border-orange-500/30  bg-orange-500/5',  Icon: DollarSign   },
  rechazado:      { label: 'Rechazado',                     color: 'text-red-400',     bg: 'border-red-500/30     bg-red-500/5',      Icon: XCircle      },
  cancelado:      { label: 'Cancelado',                     color: 'text-zinc-500',    bg: 'border-zinc-700       bg-zinc-800/40',    Icon: XCircle      },
}

function formatFecha(f) {
  if (!f) return ''
  const [y, m, d] = f.split('-').map(Number)
  return format(new Date(y, m - 1, d), "EEEE d 'de' MMMM", { locale: es })
}

function horasRestantes(venceAt) {
  if (!venceAt) return null
  const diff = new Date(venceAt) - new Date()
  if (diff <= 0) return 0
  return Math.ceil(diff / (1000 * 60 * 60))
}

export default function MiTurno() {
  const router = useRouter()
  const [cliente, setCliente]       = useState(null)
  const [peluqueria, setPeluqueria] = useState(null)
  const [turnos, setTurnos]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [accion, setAccion]         = useState({})

  useEffect(() => {
    const c   = sessionStorage.getItem('cliente')
    const pid = router.query.p || sessionStorage.getItem('peluqueria_id')

    if (!pid) { router.push('/'); return }
    sessionStorage.setItem('peluqueria_id', pid)

    if (!c) {
      router.push(`/?p=${pid}`)
      return
    }

    const cli = JSON.parse(c)
    setCliente(cli)
    supabase.from('peluquerias').select('*').eq('id', pid).maybeSingle()
      .then(({ data }) => setPeluqueria(data))
    cargarTurnos(cli.id, pid)
  }, [router.query.p])

  const cargarTurnos = async (clienteId, pid) => {
    setLoading(true)
    const { data } = await supabase
      .from('turnos_web')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('peluqueria_id', pid)
      .order('created_at', { ascending: false })
      .limit(15)
    setTurnos(data || [])
    setLoading(false)
  }

  const aceptarCambio = async (turno) => {
    setAccion(a => ({ ...a, [turno.id]: 'loading' }))
    const res = await fetch('/api/aceptar-cambio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turno_id: turno.id })
    })
    const data = await res.json()
    setAccion(a => ({ ...a, [turno.id]: 'done' }))
    cargarTurnos(cliente.id, sessionStorage.getItem('peluqueria_id'))
  }

  const rechazarCambio = async (turno) => {
    setAccion(a => ({ ...a, [turno.id]: 'loading' }))
    await supabase.from('turnos_web').update({
      estado: 'cancelado',
      motivo: (turno.motivo || '') + ' | Cliente no aceptó el cambio de horario.'
    }).eq('id', turno.id)
    setAccion(a => ({ ...a, [turno.id]: 'done' }))
    cargarTurnos(cliente.id, sessionStorage.getItem('peluqueria_id'))
  }

  const cancelarTurno = async (turno) => {
    const motivo = prompt('¿Por qué cancelás? (opcional, podés dejarlo vacío)')
    if (motivo === null) return
    await supabase.from('turnos_web').update({
      estado: 'cancelado',
      motivo: motivo.trim() || 'Cancelado por el cliente'
    }).eq('id', turno.id)
    cargarTurnos(cliente.id, sessionStorage.getItem('peluqueria_id'))
  }

  if (!cliente) return null

  const pid = sessionStorage.getItem('peluqueria_id')

  return (
    <Layout peluqueriaNombre={peluqueria?.nombre}>
      <div className="flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Mis turnos</h1>
            <p className="text-zinc-500 text-sm">{cliente.nombre}</p>
          </div>
          <div className="flex gap-3 items-center">
            <Button variant="secondary" size="sm" onClick={() => router.push(`/reservar?p=${pid}`)}>
              + Nuevo turno
            </Button>
            <button onClick={() => { sessionStorage.clear(); router.push('/') }}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
              Salir
            </button>
          </div>
        </div>

        {loading && <div className="text-center text-zinc-600 py-12">Cargando...</div>}

        {!loading && turnos.length === 0 && (
          <Card className="text-center py-12">
            <p className="text-zinc-500 mb-4">No tenés turnos todavía.</p>
            <Button onClick={() => router.push(`/reservar?p=${pid}`)}>Reservar turno</Button>
          </Card>
        )}

        {turnos.map(turno => {
          const est      = ESTADOS[turno.estado] || ESTADOS.pendiente
          const { Icon } = est
          const cargando = accion[turno.id] === 'loading'

          const esEsperandoSena = turno.estado === 'esperando_sena'
          const horas = esEsperandoSena ? horasRestantes(turno.sena_vence_at) : null
          const vencido = horas !== null && horas <= 0

          return (
            <Card key={turno.id} className={`border ${est.bg}`}>

              {/* Estado */}
              <div className={`flex items-center gap-2 mb-4 ${est.color}`}>
                <Icon size={18} />
                <span className="font-semibold text-sm">{est.label}</span>
                {esEsperandoSena && horas !== null && !vencido && (
                  <span className="text-zinc-500 text-xs font-normal ml-1">· vence en {horas}hs</span>
                )}
                {vencido && (
                  <span className="text-red-400 text-xs font-semibold ml-1">· vencida</span>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-col gap-0 text-sm mb-4">
                {[
                  { label: 'Peluquero', valor: turno.peluquero_nombre },
                  turno.servicio_nombre && { label: 'Servicio', valor: turno.servicio_nombre },
                  { label: 'Fecha', valor: <span className="capitalize">{formatFecha(turno.fecha)}</span> },
                  { label: 'Hora',  valor: `${turno.hora?.substring(0,5)}hs` },
                ].filter(Boolean).map(({ label, valor }) => (
                  <div key={label} className="flex justify-between py-2 border-b border-zinc-800/60 last:border-0">
                    <span className="text-zinc-500">{label}</span>
                    <span className="text-white font-medium">{valor}</span>
                  </div>
                ))}
              </div>

              {/* ── ESPERANDO SEÑA ── */}
              {esEsperandoSena && !vencido && (
                <div className="mb-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                  <p className="text-orange-300 font-semibold text-sm mb-3">
                    💸 Pagá la seña para confirmar tu turno
                  </p>
                  <div className="flex flex-col gap-2 text-sm mb-4">
                    <div className="flex justify-between py-2 border-b border-zinc-800/60">
                      <span className="text-zinc-400">Monto</span>
                      <span className="text-white font-bold text-base">
                        ${Number(peluqueria?.sena_monto || 0).toLocaleString('es-AR')}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-zinc-400">Alias / CBU</span>
                      <span className="text-orange-300 font-bold font-mono">
                        {peluqueria?.sena_alias || '—'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-orange-500/10 rounded-lg">
                    <Clock size={13} className="text-orange-400 flex-shrink-0" />
                    <span className="text-orange-300/80 text-xs">
                      Tenés <strong>{horas} horas</strong> para pagar. Después se cancela automáticamente.
                    </span>
                  </div>
                </div>
              )}

              {esEsperandoSena && vencido && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 font-semibold text-sm">
                    ⏰ El tiempo para pagar la seña venció. Este turno será cancelado automáticamente.
                  </p>
                </div>
              )}

              {/* MODIFICADO: el peluquero propuso cambio */}
              {turno.estado === 'modificado' && turno.fecha_propuesta && (
                <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <p className="text-blue-300 font-semibold text-sm mb-3">
                    📅 Nuevo horario propuesto:
                  </p>
                  <div className="flex flex-col gap-1 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Nueva fecha</span>
                      <span className="text-white font-medium capitalize">{formatFecha(turno.fecha_propuesta)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Nueva hora</span>
                      <span className="text-white font-bold text-base">{turno.hora_propuesta?.substring(0,5)}hs</span>
                    </div>
                  </div>

                  {turno.motivo && (
                    <p className="text-zinc-400 text-xs mb-3 italic">💬 {turno.motivo}</p>
                  )}

                  {turno.expira_confirmacion_at && (
                    <div className="flex items-center gap-2 mb-4 p-2 bg-yellow-500/10 rounded-lg">
                      <Clock size={13} className="text-yellow-400 flex-shrink-0" />
                      <span className="text-yellow-300/80 text-xs">
                        Si no respondés en 12 horas, el turno se cancela automáticamente.
                      </span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="success" size="sm" fullWidth
                      onClick={() => aceptarCambio(turno)} disabled={cargando}>
                      ✓ Acepto el cambio
                    </Button>
                    <Button variant="danger" size="sm" fullWidth
                      onClick={() => rechazarCambio(turno)} disabled={cargando}>
                      ✗ Cancelar turno
                    </Button>
                  </div>
                </div>
              )}

              {/* Motivo si fue rechazado o cancelado */}
              {(turno.estado === 'rechazado' || turno.estado === 'cancelado') && turno.motivo && (
                <p className="text-xs text-zinc-500 italic mt-2">💬 {turno.motivo}</p>
              )}

              {/* Cancelar si está pendiente o confirmado */}
              {(turno.estado === 'pendiente' || turno.estado === 'confirmado') && (
                <button onClick={() => cancelarTurno(turno)}
                  className="text-xs text-zinc-600 hover:text-red-400 transition-colors mt-1">
                  Cancelar este turno
                </button>
              )}
            </Card>
          )
        })}
      </div>
    </Layout>
  )
}
