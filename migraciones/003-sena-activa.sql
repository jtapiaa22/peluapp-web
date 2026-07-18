-- Interruptor para prender/apagar las señas desde PeluApp escritorio.
--
-- Hasta ahora no habia interruptor: la seña se aplicaba sola si habia monto > 0
-- y alias cargado, asi que la unica forma de apagarla era poner el monto en 0.
--
-- Default true + el codigo tratando null como "activa" hace que nada cambie
-- para las peluquerias ya configuradas: solo un false explicito apaga la seña.
--
-- Correr en: Supabase → SQL Editor → New query → Run.

alter table peluquerias
  add column if not exists sena_activa boolean not null default true;
