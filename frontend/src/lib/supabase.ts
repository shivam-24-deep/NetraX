import { createClient } from "@supabase/supabase-js"

const configuredUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const configuredKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(configuredUrl && configuredKey)
export const SUPABASE_URL = configuredUrl || "https://not-configured.invalid"
export const SUPABASE_ANON_KEY = configuredKey || "not-configured"

const REMEMBER_KEY = "netrax.remember-me"

export function setRememberMe(remember: boolean): void {
  try {
    localStorage.setItem(REMEMBER_KEY, String(remember))
  } catch {
    // storage unavailable — session simply won't persist across restarts
  }
}

// "Remember me" for real: a remembered session lives in localStorage (survives
// closing the browser); an un-remembered one lives in sessionStorage (gone when
// the tab/browser closes).
const authStorage = {
  getItem(key: string): string | null {
    try {
      return sessionStorage.getItem(key) ?? localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string): void {
    try {
      const persistent = localStorage.getItem(REMEMBER_KEY) !== "false"
      ;(persistent ? localStorage : sessionStorage).setItem(key, value)
      ;(persistent ? sessionStorage : localStorage).removeItem(key)
    } catch {
      // storage unavailable
    }
  },
  removeItem(key: string): void {
    try {
      sessionStorage.removeItem(key)
      localStorage.removeItem(key)
    } catch {
      // storage unavailable
    }
  },
}

// Placeholders keep the app (landing page, login UI) rendering when no project
// is configured yet; auth calls then fail and the login form says why.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: authStorage },
})
