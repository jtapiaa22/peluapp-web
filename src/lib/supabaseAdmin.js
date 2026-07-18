import { createClient } from '@supabase/supabase-js'

// Cliente con service role — SOLO para API routes (nunca importar desde una página).
// La anon key es pública y viaja al navegador; para escribir estados de turnos
// necesitamos una clave que el cliente no pueda ver.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Falta SUPABASE_SERVICE_ROLE_KEY. Cargala en .env.local (local) y en Vercel → ' +
    'Settings → Environment Variables. La sacás de Supabase → Settings → API → service_role.'
  )
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)
