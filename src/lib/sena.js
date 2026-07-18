/**
 * Regla única de cuándo corresponde pedir seña.
 *
 * Vive acá porque se aplica en dos lugares (el panel del peluquero y la
 * aceptación de un cambio de horario por parte del cliente) y antes estaba
 * duplicada, con el riesgo de que una cambie y la otra no.
 *
 * Sobre `sena_activa`: es el interruptor explícito que se va a poder prender y
 * apagar desde Configuración en PeluApp escritorio. Mientras la columna no
 * exista todavía, o esté en null, esto se comporta igual que siempre — la seña
 * vale si hay monto y alias cargados. Solo un `false` explícito la apaga, así
 * ninguna peluquería ya configurada cambia de comportamiento.
 */
export function configSena(peluqueria) {
  const monto  = Number(peluqueria?.sena_monto || 0)
  const alias  = peluqueria?.sena_alias?.trim() || ''
  const horas  = Number(peluqueria?.sena_horas_vencimiento || 24)
  const correo = peluqueria?.sena_correo?.trim() || ''

  const apagada = peluqueria?.sena_activa === false
  const activa  = !apagada && monto > 0 && Boolean(alias)

  return { activa, monto, alias, horas, correo }
}
