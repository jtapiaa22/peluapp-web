import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Card from '../components/Card'
import Input from '../components/Input'
import Button from '../components/Button'
import { Scissors, AlertCircle } from 'lucide-react'

export default function Home() {
  const router = useRouter()
  const { p: peluqueriaId } = router.query

  const [peluqueria, setPeluqueria] = useState(null)
  const [noEncontrada, setNoEncontrada] = useState(false)
  const [nombre, setNombre]     = useState('')
  const [telefono, setTelefono] = useState('')
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!peluqueriaId) return
    supabase.from('peluquerias').select('*').eq('id', peluqueriaId).eq('activo', true).maybeSingle()
      .then(({ data }) => { if (data) setPeluqueria(data); else setNoEncontrada(true) })
  }, [peluqueriaId])

  const continuar = () => {
    if (!nombre.trim()) { setError('Ingresá tu nombre completo.'); return }
    const digitos = telefono.replace(/\D/g, '')
    if (!telefono.trim() || digitos.length < 8) { setError('Ingresá un número de WhatsApp válido.'); return }
    const cliente = { nombre: nombre.trim(), telefono: telefono.trim() }
    sessionStorage.setItem('cliente', JSON.stringify(cliente))
    sessionStorage.setItem('peluqueria_id', peluqueriaId)
    router.push(`/reservar?p=${peluqueriaId}`)
  }

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
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="font-bold text-white text-lg mb-1">¿Cómo te llamás?</h2>
              <p className="text-zinc-500 text-sm">Solo necesitamos tu nombre y tu WhatsApp para avisarte.</p>
            </div>

            <Input
              label="Nombre completo"
              placeholder="Juan García"
              value={nombre}
              onChange={e => { setNombre(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && continuar()}
            />

            <div>
              <Input
                label="Número de WhatsApp"
                type="tel"
                placeholder="11 6789 1234"
                value={telefono}
                onChange={e => { setTelefono(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && continuar()}
                error={error}
              />
              <p className="text-xs text-zinc-600 mt-1.5">
                Sin el 0 ni el 15. Ej: 11 6789 1234
              </p>
            </div>

            <Button onClick={continuar} disabled={!peluqueria} fullWidth>
              Continuar →
            </Button>
          </div>
        </Card>

      </div>
    </Layout>
  )
}
