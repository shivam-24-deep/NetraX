import { CheckCircle2, Eye, EyeOff, Loader2, TriangleAlert } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth"

// Supabase reports a bad/expired recovery link in the URL hash, e.g.
// #error=access_denied&error_code=otp_expired&error_description=...
function readLinkError(): string | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  if (!params.get("error")) return null
  return params.get("error_code") === "otp_expired"
    ? "This reset link has expired."
    : (params.get("error_description")?.replaceAll("+", " ") ?? "This reset link is invalid.")
}

export default function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [linkError] = useState(readLinkError)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    setSubmitting(true)
    const { error } = await updatePassword(password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    toast.success("Password updated. You're signed in.")
    navigate("/dashboard", { replace: true })
  }

  return (
    <div className="bg-grid flex min-h-svh flex-col items-center justify-center gap-8 px-6 py-10">
      <Link to="/" className="flex items-center gap-2">
        <img src="/assets/netrax-icon.png?v=2" alt="" className="size-8 object-contain" />
        <span className="text-lg font-semibold tracking-tight">NetraX</span>
      </Link>

      <div className="glass-panel w-full max-w-sm rounded-xl p-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          </div>
        ) : !session || linkError ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <TriangleAlert className="text-risk-medium size-8" />
            <h1 className="text-lg font-semibold">Reset link not valid</h1>
            <p className="text-muted-foreground text-sm">
              {linkError ?? "This reset link is invalid or has expired."} Request a new one from the sign-in page —
              use “Forgot password?”.
            </p>
            <Button asChild className="mt-2">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-1">
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                <CheckCircle2 className="text-risk-low size-5" />
                Set a new password
              </h1>
              <p className="text-muted-foreground text-sm">
                Choose a new password for <span className="text-foreground font-medium">{session.user.email}</span>.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={show ? "text" : "password"}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-9 items-center justify-center"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-new-password">Confirm new password</Label>
              <Input
                id="confirm-new-password"
                type={show ? "text" : "password"}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                aria-invalid={!!error}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}

            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Update password
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
