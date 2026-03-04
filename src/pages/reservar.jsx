import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Card from '../components/Card'
import Button from '../components/Button'
import { User, Scissors, Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { format, addDays, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'

// ── Horario dinámico ──────────────────────────────────────────────────────────
function generarHorarios(horario = {}) {
  const { bloques, intervalo = 30 } = horario

  const bloquesEfectivos = bloques
    ? bloques.filter(b => b.activo)
    : [{ inicio: horario.inicio || '09:00', fin: horario.fin || '20:00' }]

  const slots = []
  for (const bloque of bloquesEfectivos) {
    const [hI, mI] = bloque.inicio.split(':').map(Number)
    const [hF, mF] = bloque.fin.split(':').map(Number)
    let mins = hI * 60 + mI
    const finMins = hF * 60 + mF
    while (mins < finMins) {
      slots.push(`${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`)
      mins += intervalo
    }
  }
  return slots
}

function generarDias(diasActivos = [1, 2, 3, 4, 5, 6], cantidad = 30) {
  const dias = []
  const hoy  = startOfDay(new Date())
  let i = 1
  while (dias.length < cantidad) {
    const d = addDays(hoy, i++)
    if (diasActivos.includes(d.getDay())) dias.push(format(d, 'yyyy-MM-dd'))
    if (i > 120) break // safety
  }
  return dias
}
// ─────────────────────────────────────────────────────────────────────────────

function formatFechaLinda(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return format(new Date(y, m - 1, d), "EEEE d 'de' MMMM", { locale: es })
}

export default function Reservar() {
  const router = useRouter()
  const { p: peluqueriaId } = router.query

  const [cliente, setCliente]       = useState(null)
  const [peluqueria, setPeluqueria] = useState(null)
  const [paso, setPaso]             = useState(1)
  const [peluqueros, setPeluqueros] = useState([])
  const [servicios, setServicios]   = useState([])
  const [ocupados, setOcupados]             = useState([])
  const [diasBloqueados, setDiasBloqueados] = useState([])
  const [bloqueosPeluquero, setBloqueosPeluquero] = useState([])
  const [seleccion, setSeleccion]   = useState({ peluquero: null, servicio: null, fecha: '', hora: '' })
  const [loading, setLoading]       = useState(false)
  const [enviado, setEnviado]       = useState(false)
  const [error, setError]           = useState('')

  // Horario dinámico según la peluquería
  const horarioConfig = peluqueria?.horario || { inicio: '09:00', fin: '20:00', intervalo: 30, dias: [1,2,3,4,5,6] }
  const HORARIOS = useMemo(() => generarHorarios(horarioConfig), [peluqueria])
  const dias     = useMemo(
    () => generarDias(horarioConfig.dias ?? [1,2,3,4,5,6]).filter(d => !diasBloqueados.includes(d)),
    [peluqueria, diasBloqueados]
  )

  useEffect(() => {
    const c   = sessionStorage.getItem('cliente')
    const pid = sessionStorage.getItem('peluqueria_id')
    if (!c || !pid) { router.push('/'); return }
    setCliente(JSON.parse(c))

    supabase.from('peluquerias').select('*').eq('id', pid).maybeSingle()
      .then(({ data }) => setPeluqueria(data))
    supabase.from('peluqueros_web').select('*').eq('peluqueria_id', pid).eq('activo', true).order('nombre')
      .then(({ data }) => setPeluqueros(data || []))
    supabase.from('servicios_web').select('*').eq('peluqueria_id', pid).eq('activo', true).order('nombre')
      .then(({ data }) => setServicios(data || []))
    // Días bloqueados — substring(0,10) normaliza el DATE de Postgres a "yyyy-mm-dd"
    supabase.from('dias_bloqueados_web').select('fecha').eq('peluqueria_id', pid)
      .then(({ data }) => setDiasBloqueados((data || []).map(d => d.fecha?.substring(0, 10))))
    // Bloqueos por peluquero
    supabase.from('bloqueos_peluquero_web').select('*').eq('peluqueria_id', pid)
      .then(({ data }) => setBloqueosPeluquero(data || []))
  }, [])

  // Devuelve los ocupados frescos (sin depender del state)
  const fetchOcupados = useCallback(async () => {
    if (!seleccion.fecha || !seleccion.peluquero) return []
    const pid = sessionStorage.getItem('peluqueria_id')
    const { data: tw } = await supabase.from('turnos_web').select('hora')
      .eq('peluqueria_id', pid).eq('peluquero_id', seleccion.peluquero.local_id)
      .eq('fecha', seleccion.fecha).in('estado', ['pendiente','confirmado','modificado'])
    const { data: tm } = await supabase.from('turnos_manuales_web').select('hora')
      .eq('peluqueria_id', pid).eq('peluquero_id', seleccion.peluquero.local_id)
      .eq('fecha', seleccion.fecha)
    const hTW = (tw || []).map(t => t.hora.substring(0, 5))
    const hTM = (tm || []).map(t => t.hora.substring(0, 5))
    return [...new Set([...hTW, ...hTM])]
  }, [seleccion.fecha, seleccion.peluquero])

  useEffect(() => {
    fetchOcupados().then(setOcupados)
  }, [fetchOcupados])

  const confirmarReserva = async () => {
    setLoading(true); setError('')
    try {
      // Fetch fresco para evitar el stale closure bug
      const ocupadosFrescos = await fetchOcupados()
      if (ocupadosFrescos.includes(seleccion.hora)) {
        setError('Ese horario acaba de ser tomado. Elegí otro.')
        setLoading(false); return
      }
      const pid = sessionStorage.getItem('peluqueria_id')
      const { error: e } = await supabase.from('turnos_web').insert({
        peluqueria_id:    pid,
        cliente_id:       cliente.id,
        cliente_nombre:   cliente.nombre,
        cliente_email:    cliente.email,
        peluquero_id:     seleccion.peluquero.local_id,
        peluquero_nombre: seleccion.peluquero.nombre,
        servicio_id:      seleccion.servicio?.local_id || null,
        servicio_nombre:  seleccion.servicio?.nombre || null,
        fecha:            seleccion.fecha,
        hora:             seleccion.hora,
        estado:           'pendiente'
      })
      if (e) throw e

      await fetch('/api/enviar-confirmacion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:             cliente.email,
          nombre:            cliente.nombre,
          peluqueria_nombre: peluqueria?.nombre,
          peluquero_nombre:  seleccion.peluquero.nombre,
          servicio_nombre:   seleccion.servicio?.nombre || 'Sin especificar',
          fecha:             seleccion.fecha,
          hora:              seleccion.hora,
          esConfirmacionCambio: false,
          peluqueria_id:     pid
        })
      })
      setEnviado(true)
    } catch(e) {
      if (e?.code === '23505') setError('Ese horario acaba de ser tomado por otra persona. Elegí otro.')
      else setError('Error al confirmar. Intentá de nuevo.')
    }
    finally { setLoading(false) }
  }

  if (!cliente) return null

  // ── PANTALLA DE ÉXITO ──
  if (enviado) return (
    <Layout peluqueriaNombre={peluqueria?.nombre}>
      <div className="flex flex-col items-center gap-6 pt-8 text-center">
        <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center">
          <CheckCircle size={32} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">¡Turno solicitado!</h2>
          <p className="text-zinc-400 text-sm">El peluquero va a revisarlo y te responderá pronto.</p>
        </div>

        <Card className="w-full border-yellow-500/30 bg-yellow-500/5">
          <div className="flex gap-3 items-start">
            <AlertCircle size={22} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="font-bold text-yellow-300 mb-1">⚠️ ¡Atención! Revisá tu email</p>
              <p className="text-yellow-200/70 text-sm">
                Cuando el peluquero responda tu turno vas a recibir un aviso en{' '}
                <strong className="text-yellow-300">{cliente.email}</strong>.
                Entrá a la web para ver si confirmó, modificó o rechazó tu turno.
              </p>
            </div>
          </div>
        </Card>

        <Card className="w-full">
          <h3 className="font-bold text-white mb-4">Resumen</h3>
          <div className="flex flex-col gap-3 text-sm">
            {[
              { label: 'Peluquero', valor: seleccion.peluquero?.nombre },
              { label: 'Servicio',  valor: seleccion.servicio?.nombre || 'Sin especificar' },
              { label: 'Fecha',     valor: <span className="capitalize">{formatFechaLinda(seleccion.fecha)}</span> },
              { label: 'Hora',      valor: `${seleccion.hora}hs` },
            ].map(({ label, valor }) => (
              <div key={label} className="flex justify-between py-2 border-b border-zinc-800 last:border-0">
                <span className="text-zinc-500">{label}</span>
                <span className="text-white font-medium">{valor}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex gap-3 w-full">
          <Button variant="secondary" fullWidth onClick={() => router.push(`/mi-turno?p=${sessionStorage.getItem('peluqueria_id')}`)}>
            Ver mis turnos
          </Button>
          <Button fullWidth onClick={() => { setEnviado(false); setPaso(1); setSeleccion({ peluquero: null, servicio: null, fecha: '', hora: '' }) }}>
            Reservar otro
          </Button>
        </div>
      </div>
    </Layout>
  )

  return (
    <Layout peluqueriaNombre={peluqueria?.nombre}>
      <div className="flex flex-col gap-6">

        {/* Bienvenida */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Hola, {cliente?.nombre?.split(' ')[0]} 👋</h1>
            <p className="text-zinc-500 text-sm">Elegí tu turno</p>
          </div>
          <div className="flex gap-3 items-center">
            <button onClick={() => router.push(`/mi-turno?p=${sessionStorage.getItem('peluqueria_id')}`)}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Mis turnos</button>
            <button onClick={() => { const pid = sessionStorage.getItem('peluqueria_id'); sessionStorage.clear(); router.push(`/?p=${pid}`) }}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Salir</button>
          </div>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-1">
          {['Peluquero','Servicio','Fecha','Hora','Confirmar'].map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1 min-w-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all
                ${paso > i+1 ? 'bg-emerald-500 text-white' : paso === i+1 ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-600'}`}>
                {paso > i+1 ? '✓' : i+1}
              </div>
              <span className={`text-xs truncate hidden sm:block ${paso === i+1 ? 'text-violet-400' : 'text-zinc-600'}`}>{s}</span>
              {i < 4 && <div className="h-px bg-zinc-800 flex-1 mx-1" />}
            </div>
          ))}
        </div>

        {/* PASO 1: Peluquero */}
        {paso === 1 && (
          <Card>
            <h2 className="font-bold text-white mb-4 flex items-center gap-2">
              <User size={18} className="text-violet-400" /> Elegí tu peluquero
            </h2>
            {peluqueros.length === 0
              ? <p className="text-zinc-500 text-sm text-center py-6">No hay peluqueros disponibles.</p>
              : <div className="flex flex-col gap-3">
                  {peluqueros.map(p => {
                    const hoy = new Date().toISOString().substring(0, 10)
                    const bloqueo = bloqueosPeluquero.find(b =>
                      b.peluquero_id === p.local_id && b.desde <= hoy && hoy <= b.hasta
                    )

                    if (bloqueo) {
                      // Peluquero bloqueado — mostrar aviso, no clickeable
                      const [y, m, d] = bloqueo.hasta.split('-').map(Number)
                      const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
                      const fechaVuelta = `${d} de ${meses[m-1]}`
                      return (
                        <div key={p.id} className="flex flex-col gap-2 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
                              <span className="text-yellow-500/70 font-bold text-lg">{p.nombre[0]}</span>
                            </div>
                            <div>
                              <span className="font-medium text-zinc-400 line-through text-sm">{p.nombre}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-yellow-400 text-xs">🏖</span>
                                <span className="text-yellow-300/80 text-xs font-medium">
                                  Vuelve el {fechaVuelta}
                                </span>
                              </div>
                              {bloqueo.motivo && (
                                <p className="text-zinc-500 text-xs mt-0.5 italic">
                                  {bloqueo.motivo}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <button key={p.id} onClick={() => { setSeleccion(s => ({ ...s, peluquero: p })); setPaso(2) }}
                        className="flex items-center gap-4 p-4 rounded-xl border border-zinc-800 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all text-left">
                        <div className="w-10 h-10 rounded-full bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-violet-400 font-bold text-lg">{p.nombre[0]}</span>
                        </div>
                        <span className="font-medium text-white">{p.nombre}</span>
                      </button>
                    )
                  })}
                </div>
            }
          </Card>
        )}

        {/* PASO 2: Servicio */}
        {paso === 2 && (
          <Card>
            <h2 className="font-bold text-white mb-4 flex items-center gap-2">
              <Scissors size={18} className="text-violet-400" /> ¿Qué servicio querés?
            </h2>
            <div className="flex flex-col gap-3">
              {servicios.map(s => (
                <button key={s.id} onClick={() => { setSeleccion(sel => ({ ...sel, servicio: s })); setPaso(3) }}
                  className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all text-left">
                  <span className="font-medium text-white">{s.nombre}</span>
                  {s.precio && <span className="text-violet-400 font-bold">${Number(s.precio).toLocaleString('es-AR')}</span>}
                </button>
              ))}
              <button onClick={() => { setSeleccion(sel => ({ ...sel, servicio: null })); setPaso(3) }}
                className="p-3 rounded-xl border border-dashed border-zinc-700 hover:border-zinc-500 text-zinc-500 hover:text-zinc-300 text-sm transition-all">
                No sé / lo defino en el momento
              </button>
            </div>
            <button onClick={() => setPaso(1)} className="mt-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">← Volver</button>
          </Card>
        )}

        {/* PASO 3: Fecha */}
        {paso === 3 && (
          <Card>
            <h2 className="font-bold text-white mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-violet-400" /> Elegí el día
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {dias.map(d => {
                const [y, m, day] = d.split('-').map(Number)
                const date = new Date(y, m-1, day)
                return (
                  <button key={d} onClick={() => { setSeleccion(s => ({ ...s, fecha: d, hora: '' })); setPaso(4) }}
                    className="flex flex-col items-center p-3 rounded-xl border border-zinc-800 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all">
                    <span className="text-xs text-zinc-500 capitalize">{format(date, 'EEE', { locale: es })}</span>
                    <span className="text-xl font-bold text-white">{format(date, 'd')}</span>
                    <span className="text-xs text-zinc-500 capitalize">{format(date, 'MMM', { locale: es })}</span>
                  </button>
                )
              })}
            </div>
            <button onClick={() => setPaso(2)} className="mt-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">← Volver</button>
          </Card>
        )}

        {/* PASO 4: Hora */}
        {paso === 4 && (
          <Card>
            <h2 className="font-bold text-white mb-1 flex items-center gap-2">
              <Clock size={18} className="text-violet-400" /> Elegí el horario
            </h2>
            <p className="text-zinc-500 text-sm mb-4 capitalize">{formatFechaLinda(seleccion.fecha)}</p>
            <div className="grid grid-cols-4 gap-2">
              {HORARIOS.map(h => {
                const libre = !ocupados.includes(h)
                return (
                  <button key={h} disabled={!libre}
                    onClick={() => { setSeleccion(s => ({ ...s, hora: h })); setPaso(5) }}
                    className={`p-3 rounded-xl text-sm font-medium transition-all border
                      ${!libre
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-700 cursor-not-allowed line-through'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-violet-500/50 hover:bg-violet-500/5'}`}>
                    {h}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-zinc-600">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-zinc-800 inline-block" />Ocupado</span>
            </div>
            <button onClick={() => setPaso(3)} className="mt-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">← Volver</button>
          </Card>
        )}

        {/* PASO 5: Confirmar */}
        {paso === 5 && (
          <Card>
            <h2 className="font-bold text-white mb-4">Confirmá tu reserva</h2>
            <div className="flex flex-col gap-0 mb-6 text-sm">
              {[
                { label: 'Peluquero', valor: seleccion.peluquero?.nombre },
                { label: 'Servicio',  valor: seleccion.servicio?.nombre || 'Sin especificar' },
                { label: 'Fecha',     valor: <span className="capitalize">{formatFechaLinda(seleccion.fecha)}</span> },
                { label: 'Hora',      valor: `${seleccion.hora}hs` },
              ].map(({ label, valor }) => (
                <div key={label} className="flex justify-between items-center py-3 border-b border-zinc-800 last:border-0">
                  <span className="text-zinc-500">{label}</span>
                  <span className="text-white font-medium">{valor}</span>
                </div>
              ))}
            </div>
            {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}
            <Button onClick={confirmarReserva} disabled={loading} fullWidth size="lg">
              {loading ? 'Enviando...' : '✓ Confirmar reserva'}
            </Button>
            <button onClick={() => setPaso(4)} className="mt-3 text-xs text-zinc-600 hover:text-zinc-400 transition-colors block text-center w-full">← Volver</button>
          </Card>
        )}

      </div>
    </Layout>
  )
}