-- CORRIGE la migración 001, que no protegía nada.
--
-- Por qué: en Postgres un GRANT SELECT a nivel tabla alcanza TODAS las columnas,
-- así que el `revoke select (admin_password_hash)` de 001 era inútil — con la
-- clave pública se seguía leyendo el hash. Y no se puede revocar el SELECT de la
-- tabla para otorgar columna por columna, porque la app de escritorio hace
-- `select('*')` sobre peluquerias (electron/main.js:617,638) con esa misma clave
-- pública: se romperían todas las instalaciones ya desplegadas.
--
-- Solución: el hash vive en su propia tabla, con RLS y SIN políticas. Así el rol
-- anon no puede leerla ni escribirla de ninguna forma, mientras que la service
-- role key (que solo usan las API routes del panel) saltea RLS.
--
-- Correr en: Supabase → SQL Editor → New query → Run.

create table if not exists peluqueria_admin (
  peluqueria_id uuid primary key references peluquerias(id) on delete cascade,
  password_hash text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table peluqueria_admin enable row level security;

-- Sin políticas: anon queda afuera por completo. No agregar ninguna.
revoke all on peluqueria_admin from anon, authenticated;

-- Limpieza de la 001: la columna quedó sin uso y expuesta.
alter table peluquerias drop column if exists admin_password_hash;
