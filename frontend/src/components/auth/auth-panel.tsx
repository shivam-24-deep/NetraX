import { useState } from "react"
import { Link } from "react-router-dom"

import { LoginForm } from "@/components/auth/login-form"
import { SignupForm } from "@/components/auth/signup-form"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NOT_CONFIGURED_MESSAGE, useAuth } from "@/lib/auth"
import { isSupabaseConfigured } from "@/lib/supabase"

export function AuthPanel({
  defaultTab = "sign-in",
}: {
  defaultTab?: "sign-in" | "sign-up"
}) {
  const { signInWithGoogle } = useAuth()
  const [tab, setTab] = useState<"sign-in" | "sign-up">(defaultTab)
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogle() {
    setGoogleError(null)
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    setGoogleLoading(false)
    if (error) setGoogleError(error)
  }

  if (confirmEmail) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4 text-center">
        <h2 className="text-xl font-semibold">Check your inbox</h2>
        <p className="text-muted-foreground text-sm">
          We sent a confirmation link to <span className="text-foreground font-medium">{confirmEmail}</span>.
          Confirm your email, then sign in.
        </p>
        <Button
          onClick={() => {
            setConfirmEmail(null)
            setTab("sign-in")
          }}
        >
          Back to sign in
        </Button>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-semibold">Welcome to NetraX</h2>
        <p className="text-muted-foreground text-sm">
          Secure access to your forensic investigation workspace.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <p role="status" className="border-risk-medium/40 bg-risk-medium-bg text-risk-medium-foreground rounded-md border px-3 py-2 text-xs">
          {NOT_CONFIGURED_MESSAGE}
        </p>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as "sign-in" | "sign-up")}>
        <TabsList className="w-full">
          <TabsTrigger value="sign-in">Sign In</TabsTrigger>
          <TabsTrigger value="sign-up">Sign Up</TabsTrigger>
        </TabsList>

        <TabsContent value="sign-in" className="mt-4">
          <LoginForm />
        </TabsContent>
        <TabsContent value="sign-up" className="mt-4">
          <SignupForm onSubmitted={setConfirmEmail} />
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-3">
        <div className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">OR</span>
        <div className="bg-border h-px flex-1" />
      </div>

      <div className="flex flex-col gap-2">
        <Button variant="outline" onClick={handleGoogle} disabled={googleLoading}>
          <GoogleIcon className="size-4" />
          Continue with Google
        </Button>
        {googleError && (
          <p role="alert" className="text-destructive text-center text-sm">
            {googleError}
          </p>
        )}
      </div>

      <p className="text-muted-foreground text-center text-sm">
        {tab === "sign-in" ? (
          <>
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => setTab("sign-up")}
              className="text-primary font-medium hover:underline"
            >
              Create account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setTab("sign-in")}
              className="text-primary font-medium hover:underline"
            >
              Sign in
            </button>
          </>
        )}
      </p>

      <Link to="/pitch" className="text-muted-foreground text-center text-xs hover:underline">
        View the NetraX pitch deck
      </Link>
    </div>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.88c2.27-2.09 3.58-5.17 3.58-8.84z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.02c-1.08.72-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.28v3.11C3.25 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.28a12 12 0 0 0 0 10.8z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.6l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77z"
      />
    </svg>
  )
}
