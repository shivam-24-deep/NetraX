import type { Session, User } from "@supabase/supabase-js"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

import { loadStoreForUser, resetStore } from "@/lib/mock/store"
import { isSupabaseConfigured, setRememberMe, supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase"

export const NOT_CONFIGURED_MESSAGE =
  "Authentication isn't set up yet — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env and restart the dev server."

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password."
  if (/email not confirmed/i.test(message)) return "Please confirm your email first — check your inbox for the link."
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Please wait a minute and try again."
  if (/already registered/i.test(message)) return "An account with this email already exists. Sign in instead."
  if (/different from the old password/i.test(message)) return "Your new password must be different from your current one."
  if (/session missing|not authenticated/i.test(message)) return "Your reset link has expired. Request a new one from the sign-in page."
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Could not reach the authentication service. Check your connection and try again."
  }
  return message
}

type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  recovery: boolean
  signIn: (email: string, password: string, remember?: boolean) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
  updateProfile: (fullName: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false))

    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      if (event === "PASSWORD_RECOVERY") setRecovery(true)
      if (event === "SIGNED_OUT") setRecovery(false)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  // Each user's investigations live in their own private rows; load them when
  // someone signs in and drop them from memory the moment they sign out.
  const userId = session?.user?.id ?? null
  useEffect(() => {
    if (userId) void loadStoreForUser(userId)
    else resetStore()
  }, [userId])

  async function guarded(action: () => Promise<{ message: string } | null>): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_MESSAGE }
    try {
      const error = await action()
      return { error: error ? friendlyAuthError(error.message) : null }
    } catch {
      return { error: "Could not reach the authentication service. Check your connection and try again." }
    }
  }

  const signIn = (email: string, password: string, remember = true) => {
    setRememberMe(remember)
    return guarded(async () => (await supabase.auth.signInWithPassword({ email: email.trim(), password })).error)
  }

  const signUp = (email: string, password: string, fullName: string) => {
    setRememberMe(true)
    return guarded(async () => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      })
      if (error) return error
      // With email confirmation on, Supabase returns a fake "success" for an
      // already-registered address; the tell is an empty identities list.
      if (data.user && data.user.identities?.length === 0) {
        return { message: "An account with this email already exists. Sign in instead." }
      }
      return null
    })
  }

  const signInWithGoogle = () => {
    setRememberMe(true)
    return guarded(async () => {
      // signInWithOAuth redirects the browser straight to Supabase; if Google
      // isn't enabled the user would land on a raw JSON error page. Ask first.
      const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } })
      const settings = (await res.json()) as { external?: { google?: boolean } }
      if (!settings.external?.google) {
        return { message: "Google sign-in isn't enabled for this project yet. Use email and password for now." }
      }
      return (
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/dashboard` },
        })
      ).error
    })
  }

  const resetPassword = (email: string) =>
    guarded(
      async () =>
        (await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` }))
          .error,
    )

  const updatePassword = (newPassword: string) =>
    guarded(async () => {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (!error) setRecovery(false)
      return error
    })

  const updateProfile = (fullName: string) =>
    guarded(async () => {
      const name = fullName.trim()
      const { error } = await supabase.auth.updateUser({ data: { full_name: name } })
      if (error) return error
      // Mirror into public.profiles; the auth metadata above is the source of truth.
      if (userId) await supabase.from("profiles").update({ display_name: name }).eq("id", userId)
      return null
    })

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } catch {
      setSession(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        recovery,
        signIn,
        updatePassword,
        updateProfile,
        signUp,
        signInWithGoogle,
        resetPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
