import { createClient } from "@supabase/supabase-js"

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (import.meta.env.VITE_SKIP_AUTH === "true" ? "https://netrax-demo.supabase.co" : "")
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (import.meta.env.VITE_SKIP_AUTH === "true" ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder" : "")

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy frontend/.env.example to frontend/.env and fill them in.",
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
