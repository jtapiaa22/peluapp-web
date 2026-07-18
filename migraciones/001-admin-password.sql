-- Panel de turnos móvil (/admin) — columna para la clave del peluquero.
-- Correr una sola vez en: Supabase → SQL Editor → New query → Run.

alter table peluquerias
  add column if not exists admin_password_hash text;

-- El hash nunca debe salir por la anon key (que es pública y viaja al navegador).
-- Las API routes del panel usan la service role key, que ignora RLS, así que
-- esto no las afecta.
revoke select (admin_password_hash) on peluquerias from anon;
