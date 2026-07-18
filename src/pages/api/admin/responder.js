import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../lib/adminAuth'
import {
  notificarConfirmado, notificarRechazado, notificarModificado,
  notificarCancelado, notificarSena,
} from '../../../lib/whatsapp'
import { configSena } from '../../../lib/sena'

const ACCIONES = ['confirmado', 'rechazado', 'modificado', 'cancelado']

/**
 * POST /api/admin/responder  { id, accion, fecha_propuesta?, hora_propuesta?, motivo? }
 *
 * Espeja la lógica de `turnosWeb:responder` de electron/main.js. Lo que NO hace es
 * escribir en el SQLite del local — de eso se encarga la app cuando abre la Agenda:
 * `turnosWeb:sincronizarConfirmados` inserta los confirmados que le falten y
 * `limpiarCancelados` borra los cancelados (main.js:949 y :920).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const pid = requireAdmin(req, res)
  if (!pid) return

  const { id, accion, fecha_propuesta, hora_propuesta, motivo } = req.body || {}
  if (!id || !ACCIONES.includes(accion)) return res.status(400).json({ error: 'Datos inválidos.' })
  if (accion === 'modificado' && (!fecha_propuesta || !hora_propuesta)) {
    return res.status(400).json({ error: 'Falta la nueva fecha y hora.' })
  }

  // Traemos el turno filtrando por peluqueria_id: una sesión no puede tocar
  // turnos de otra peluquería aunque adivine el id.
  const { data: turno } = await supabaseAdmin
    .from('turnos_web').select('*').eq('id', id).eq('peluqueria_id', pid).maybeSingle()
  if (!turno) return res.status(404).json({ error: 'Turno no encontrado.' })

  // select('*') a proposito: asi sena_activa se lee sola cuando exista la
  // columna, sin romper mientras todavia no este creada.
  const { data: pel } = await supabaseAdmin
    .from('peluquerias')
    .select('*')
    .eq('id', pid).maybeSingle()

  const sena = configSena(pel)

  const pelNombre = pel?.nombre || 'PeluApp'
  const horaOriginal = turno.hora?.substring(0, 5)
  const base = {
    telefono: turno.cliente_telefono,
    nombre: turno.cliente_nombre,
    peluqueria_nombre: pelNombre,
    peluqueria_id: pid,
  }

  let envio

  if (accion === 'confirmado') {
    // ── Con seña: el turno queda esperando el pago, no confirmado ──
    if (sena.activa) {
      const venceAt = new Date(Date.now() + sena.horas * 60 * 60 * 1000).toISOString()

      const { error } = await supabaseAdmin.from('turnos_web').update({
        estado: 'esperando_sena',
        sena_vence_at: venceAt,
        respondido_at: new Date().toISOString(),
        motivo: motivo || null,
      }).eq('id', id)
      if (error) return res.status(500).json({ error: 'No pudimos actualizar el turno.' })

      await supabaseAdmin.from('turnos_senas').insert({
        turno_web_id: turno.id,
        peluqueria_id: pid,
        cliente_nombre: turno.cliente_nombre,
        cliente_telefono: turno.cliente_telefono,
        peluquero_nombre: turno.peluquero_nombre,
        peluquero_id: turno.peluquero_id,
        servicio_nombre: turno.servicio_nombre || null,
        fecha: turno.fecha,
        hora: horaOriginal,
        monto: sena.monto,
        alias: sena.alias,
        vence_at: venceAt,
        estado: 'pendiente_sena',
      })

      envio = await notificarSena({
        ...base,
        sena_monto: sena.monto,
        sena_alias: sena.alias,
        sena_horas: sena.horas,
        sena_correo: sena.correo,
      })

      return res.status(200).json({ ok: true, esperandoSena: true, whatsapp: envio })
    }

    // ── Sin seña: confirmar directo ──
    const { error } = await supabaseAdmin.from('turnos_web').update({
      estado: 'confirmado',
      motivo: motivo || null,
      respondido_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) return res.status(500).json({ error: 'No pudimos actualizar el turno.' })

    envio = await notificarConfirmado({ ...base, fecha: turno.fecha, hora: horaOriginal })
    return res.status(200).json({ ok: true, whatsapp: envio })
  }

  // ── Modificado / rechazado / cancelado ──
  const expira = accion === 'modificado'
    ? new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    : null

  const { error } = await supabaseAdmin.from('turnos_web').update({
    estado: accion,
    motivo: motivo || null,
    respondido_at: new Date().toISOString(),
    ...(accion === 'modificado'
      ? { fecha_propuesta, hora_propuesta, expira_confirmacion_at: expira }
      : {}),
  }).eq('id', id)
  if (error) return res.status(500).json({ error: 'No pudimos actualizar el turno.' })

  if (accion === 'cancelado') {
    await supabaseAdmin.from('turnos_senas')
      .delete().eq('turno_web_id', turno.id).neq('estado', 'pagada')
  }

  if (accion === 'rechazado') {
    envio = await notificarRechazado({ ...base, motivo })
  } else if (accion === 'cancelado') {
    envio = await notificarCancelado({ ...base, motivo })
  } else {
    envio = await notificarModificado({
      ...base,
      peluquero_nombre: turno.peluquero_nombre,
      fecha_propuesta, hora_propuesta,
    })
  }

  res.status(200).json({ ok: true, whatsapp: envio })
}
